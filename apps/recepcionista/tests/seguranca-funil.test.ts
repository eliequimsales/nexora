import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerParametros } from "@/lib/diagnostico/parametros";
import { RETENCAO_DIAS, TETO_GLOBAL_POR_JANELA, cabeMaisEvento } from "@/lib/funil";

/**
 * A SUPERFÍCIE NOVA — auditada depois de existir.
 *
 * A instrumentação de funil abriu a PRIMEIRA rota pública de escrita do
 * produto. Todo o resto que escreve exige sessão; esta não pode, porque o funil
 * começa antes de existir conta. Isso muda o modelo de ameaça dela.
 */

const RAIZ = join(__dirname, "..");

describe("parâmetro de URL não entra cru na árvore de render", () => {
  /**
   * `lerTicket` extraía o número e devolvia a STRING ORIGINAL. Com
   * `?ticket=50<script>` o retorno era `"50<script>"` — que ia parar no value
   * de um input.
   *
   * Não era XSS: o React escapa. Mas é entrada não validada atravessando a
   * fronteira, e ela vira XSS no dia em que alguém puser esse valor num
   * atributo, numa URL ou num dangerouslySetInnerHTML. Validar o valor INTEIRO
   * custa uma linha; descobrir isso depois custa um incidente.
   */
  it("lixo anexado ao número é descartado, não devolvido", () => {
    expect(lerParametros({ ticket: "50<script>" }).ticketReais).not.toContain("<");
    expect(lerParametros({ ticket: '50" onmouseover=x' }).ticketReais).not.toContain('"');
  });

  it("o número legítimo continua chegando", () => {
    expect(lerParametros({ ticket: "50" }).ticketReais).toBe("50");
    expect(lerParametros({ ticket: "49,90" }).ticketReais).toBe("49,90");
    expect(lerParametros({ ticket: "  50  " }).ticketReais).toBe("50");
  });

  it("o que sobra é sempre só dígito, vírgula ou ponto", () => {
    for (const entrada of ["50<script>", "R$ 50", "50abc", "5 0", "50;drop"]) {
      const saida = lerParametros({ ticket: entrada }).ticketReais;
      expect(saida, entrada).toMatch(/^[0-9]*[,.]?[0-9]*$/);
    }
  });
});

describe("a tabela de eventos não cresce para sempre", () => {
  /**
   * `/api/funil` aceita 60 eventos por IP a cada 10 minutos, sem autenticação.
   * Um IP sozinho grava ~8.600 linhas por dia; cem IPs gravam ~1 GB por mês.
   * Não havia limpeza nenhuma, e o banco é um Postgres de plano Hobby.
   *
   * Duas defesas: a tabela tem prazo de validade, e existe um teto global por
   * janela — o rate limit por IP não protege contra tráfego distribuído.
   */
  it("existe prazo de validade, e ele cobre a janela que o relatório lê", () => {
    // O resumo olha 14 dias. Guardar bem mais que isso é custo sem uso.
    expect(RETENCAO_DIAS).toBeGreaterThanOrEqual(30);
    expect(RETENCAO_DIAS).toBeLessThanOrEqual(180);
  });

  it("existe um teto global, não só por IP", () => {
    expect(TETO_GLOBAL_POR_JANELA).toBeGreaterThan(0);
  });

  it("abaixo do teto, aceita", () => {
    expect(cabeMaisEvento(0)).toBe(true);
    expect(cabeMaisEvento(TETO_GLOBAL_POR_JANELA - 1)).toBe(true);
  });

  it("no teto, recusa — e recusa em silêncio, sem virar erro na tela", () => {
    expect(cabeMaisEvento(TETO_GLOBAL_POR_JANELA)).toBe(false);
    expect(cabeMaisEvento(TETO_GLOBAL_POR_JANELA * 10)).toBe(false);
  });

  it("contagem inválida não abre a porta", () => {
    expect(cabeMaisEvento(Number.NaN)).toBe(false);
    expect(cabeMaisEvento(-1)).toBe(false);
  });
});

describe("a rota pública de escrita", () => {
  const rota = readFileSync(join(RAIZ, "app/api/funil/route.ts"), "utf8");

  it("não reaproveita uma mesma instância de Response entre requisições", () => {
    /**
     * `const OK = new NextResponse(...)` no topo do módulo é compartilhado por
     * TODAS as requisições do processo. Resposta é objeto com corpo e headers
     * mutáveis; devolver a mesma instância concorrentemente é a receita para
     * "Body is unusable" ou vazamento de header entre requisições.
     */
    expect(rota).not.toMatch(/^const OK = new NextResponse/m);
  });

  it("aplica o teto global antes de gravar", () => {
    expect(rota).toContain("cabeMaisEvento");
  });

  it("continua respondendo 204 sempre, sem oráculo", () => {
    // Um 4xx diria a quem sonda o que a rota aceita.
    expect(rota).toContain("204");
    expect(rota).not.toMatch(/status:\s*4\d\d/);
  });
});

describe("a limpeza roda de verdade", () => {
  it("o cron diário chama a poda", () => {
    const cron = readFileSync(join(RAIZ, "app/api/cron/reengajamento/route.ts"), "utf8");
    expect(cron).toContain("podarEventos");
  });
});

describe("cardinalidade do criativo é um vetor, não só um detalhe", () => {
  /**
   * `limparCriativo` aceita qualquer identificador de até 32 caracteres. Como a
   * rota é pública, um atacante manda 20.000 eventos com 20.000 criativos
   * DIFERENTES — todos válidos — e o relatório do fundador passa a ter 20.000
   * grupos. A ferramenta que existe para decidir onde gastar R$ 5.000 fica
   * ilegível, e o groupBy fica lento.
   *
   * Não dá para resolver validando mais: um identificador de criativo legítimo
   * é exatamente isso. Resolve-se limitando o RELATÓRIO, e dizendo o que ficou
   * de fora — corte silencioso lê-se como "cobri tudo".
   */
  const resumo = readFileSync(join(RAIZ, "app/api/funil/resumo/route.ts"), "utf8");

  it("o relatório limita quantos criativos mostra", () => {
    expect(resumo).toContain("TETO_CRIATIVOS");
  });

  it("e diz quantos ficou de fora, em vez de cortar em silêncio", () => {
    expect(resumo).toMatch(/omitid|de fora|não listad/i);
  });
});

describe("o cron não roda sem teto", () => {
  it("a chamada semanal limita quantas contas processa por execução", () => {
    /**
     * `company.findMany` sem take, com 3 consultas por empresa dentro do laço.
     * Com muitas contas a execução estoura o tempo da requisição e NINGUÉM
     * recebe — inclusive quem já ia receber. Com teto, a sobra fica para a
     * execução do dia seguinte e a chave da semana garante que ninguém receba
     * duas vezes.
     */
    const fonte = readFileSync(join(RAIZ, "lib/reengajamento/chamada-semanal.ts"), "utf8");
    expect(fonte).toMatch(/take:\s*\w+/);
  });
});
