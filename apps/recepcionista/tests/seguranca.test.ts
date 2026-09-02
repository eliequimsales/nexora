import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/rate-limit";
import { decidirVinculoGoogle } from "@/lib/auth/vinculo-google";
import { sessaoAindaVale } from "@/lib/auth/epoca";

/**
 * CORREÇÕES DA AUDITORIA DE SEGURANÇA — 01/09/2026.
 *
 * Cada teste aqui corresponde a um achado confirmado lendo o código. O que a
 * auditoria mostrou não foi um bug isolado: foi um PADRÃO. Em três lugares
 * diferentes, a ausência de um segredo desligava a proteção em vez de barrar
 * a requisição — `if (expectedToken)` no webhook, `?? ""` no middleware,
 * `?? ""` no HMAC da supressão. Falhar aberto é sempre a escolha errada.
 */

describe("IP do cliente atrás de proxy — X-Forwarded-For é do cliente até o proxy escrever", () => {
  /**
   * `.split(",")[0]` pegava o PRIMEIRO elemento. Nenhum proxy reescreve esse
   * header: ele APENDA o IP real ao fim da cadeia. Então o primeiro elemento é
   * o que o cliente mandou — e com ele o atacante trocava de identidade a cada
   * requisição, anulando o rate limit do login, do cadastro e da recuperação
   * de senha, além de encher o mapa de baldes com chaves inventadas.
   *
   * O elemento confiável é o ÚLTIMO: foi escrito pelo proxy mais próximo.
   */
  const req = (xff?: string) =>
    new Request("https://app.exemplo/x", { headers: xff ? { "x-forwarded-for": xff } : {} });

  it("pega o último da cadeia, que foi o proxy quem escreveu", () => {
    expect(clientIp(req("1.1.1.1, 2.2.2.2, 203.0.113.9"))).toBe("203.0.113.9");
  });

  it("cadeia forjada pelo cliente não muda o resultado", () => {
    // O atacante manda "9.9.9.9" e o proxy apenda o IP real dele.
    const a = clientIp(req("9.9.9.9, 203.0.113.9"));
    const b = clientIp(req("8.8.8.8, 203.0.113.9"));
    expect(a).toBe(b);
    expect(a).toBe("203.0.113.9");
  });

  it("um único valor é usado como está", () => {
    expect(clientIp(req("203.0.113.9"))).toBe("203.0.113.9");
  });

  it("sem header, não inventa identidade", () => {
    expect(clientIp(req())).toBe("desconhecido");
  });

  it("valor vazio ou só vírgulas não vira chave utilizável", () => {
    expect(clientIp(req("  ,  , "))).toBe("desconhecido");
  });

  it("não aceita lixo arbitrário como chave de balde", () => {
    // Sem validação, o atacante escolhe a chave e enche o mapa de rate limit.
    expect(clientIp(req("nao-e-ip"))).toBe("desconhecido");
    expect(clientIp(req("a".repeat(500)))).toBe("desconhecido");
  });

  it("aceita IPv6", () => {
    expect(clientIp(req("2001:db8::1"))).toBe("2001:db8::1");
  });
});

describe("entrar com o Google não pode adotar conta criada por outra pessoa", () => {
  /**
   * PRÉ-SEQUESTRO DE CONTA. O cadastro por senha cria conta com QUALQUER
   * e-mail e não confirma posse. O callback do Google achava a empresa só por
   * `where: { email }` e abria sessão.
   *
   * Então: o atacante cadastra contato@barbeariadojoao.com.br com uma senha que
   * ele escolhe. Semanas depois o dono real clica "Entrar com o Google" e cai
   * DENTRO da conta do atacante. Ele importa a base — nome, telefone, histórico
   * e valores de centenas de clientes — e o atacante entra depois com a senha
   * que nunca deixou de funcionar.
   */

  it("primeira vez pelo Google, sem conta nenhuma: cria", () => {
    expect(decidirVinculoGoogle(null, "sub-novo").acao).toBe("CRIAR");
  });

  it("sem identificador do Google, não cria conta nem para e-mail inédito", () => {
    // Criar sem `sub` reintroduziria o problema pelo outro lado: a conta
    // nasceria sem identidade amarrada e poderia ser adotada depois.
    expect(decidirVinculoGoogle(null, "").acao).toBe("RECUSAR");
  });

  it("conta já ligada a este Google: entra", () => {
    expect(
      decidirVinculoGoogle({ id: "c1", googleSub: "sub-123", emailVerificadoEm: null }, "sub-123")
        .acao,
    ).toBe("ENTRAR");
  });

  it("conta ligada a OUTRO Google com o mesmo e-mail: recusa", () => {
    const d = decidirVinculoGoogle(
      { id: "c1", googleSub: "sub-do-dono", emailVerificadoEm: new Date() },
      "sub-do-atacante",
    );
    expect(d.acao).toBe("RECUSAR");
  });

  it("conta criada por senha e nunca verificada: RECUSA em vez de adotar", () => {
    // Este é o achado. Antes, aqui a sessão era aberta.
    const d = decidirVinculoGoogle({ id: "c1", googleSub: null, emailVerificadoEm: null }, "sub-1");
    expect(d.acao).toBe("RECUSAR");
    // A mensagem importa: sem ela o dono legítimo trava sem saber o que fazer.
    if (d.acao === "RECUSAR") expect(d.motivo).toContain("senha");
  });

  it("conta com e-mail já comprovado: vincula o Google e entra", () => {
    const d = decidirVinculoGoogle(
      { id: "c1", googleSub: null, emailVerificadoEm: new Date("2026-01-01") },
      "sub-1",
    );
    expect(d.acao).toBe("VINCULAR");
  });

  it("sem o identificador do Google, nunca vincula", () => {
    // Se o id_token não trouxe `sub`, não há identidade para amarrar.
    expect(decidirVinculoGoogle({ id: "c1", googleSub: null, emailVerificadoEm: new Date() }, "").acao).toBe(
      "RECUSAR",
    );
  });
});

describe("trocar a senha derruba as sessões abertas", () => {
  /**
   * O JWT é sem estado, com 7 dias de validade e nenhuma revogação: trocar a
   * senha só reescrevia o hash, e o logout só apagava o cookie do próprio
   * navegador. Quem tivesse roubado o cookie continuava dentro por uma semana
   * — justamente depois da ação que a vítima toma para se proteger.
   *
   * A época é um contador na conta. O token carrega a época em que nasceu;
   * incrementar o contador invalida todos os tokens anteriores de uma vez.
   */

  it("token da época atual vale", () => {
    expect(sessaoAindaVale(3, 3)).toBe(true);
  });

  it("token de época anterior não vale mais", () => {
    expect(sessaoAindaVale(2, 3)).toBe(false);
  });

  it("token sem época é de antes da mudança e não vale", () => {
    // Fail closed: token velho, sem o campo, é recusado em vez de aceito.
    expect(sessaoAindaVale(undefined, 0)).toBe(false);
    expect(sessaoAindaVale(null, 0)).toBe(false);
  });

  it("época adulterada para cima não passa", () => {
    expect(sessaoAindaVale(999, 3)).toBe(false);
  });

  it("época não numérica não passa", () => {
    expect(sessaoAindaVale("3" as unknown as number, 3)).toBe(false);
  });
});

describe("nada pode falhar aberto quando falta um segredo", () => {
  /**
   * O PADRÃO, não o bug. A auditoria achou a mesma escolha errada em três
   * lugares independentes: a ausência do segredo DESLIGAVA a proteção em vez
   * de barrar a requisição.
   *
   *   webhook do WhatsApp:  if (expectedToken) { ...confere... }
   *   middleware:           jwtVerify(token, encode(JWT_SECRET ?? ""))
   *   hashTelefone:         createHmac("sha256", SUPRESSAO_SECRET ?? JWT_SECRET ?? "")
   *
   * Nos dois primeiros o resultado é acesso liberado; no terceiro, um HMAC com
   * chave vazia, que é um digest quebrável por força bruta. As rotas de cron
   * sempre fizeram certo. Este teste existe para que o padrão certo seja o
   * único que sobrevive ao build.
   */
  const RAIZ = join(__dirname, "..");

  /**
   * Comentários fora antes de comparar.
   *
   * Os comentários destes arquivos CITAM o código antigo — "antes era
   * `JWT_SECRET ?? \"\"`" — porque registrar o erro é o que impede ele de
   * voltar. Casar contra o arquivo cru reprovaria justamente a documentação da
   * correção. O teste procura o PADRÃO no código, não a palavra no texto.
   */
  const semComentarios = (fonte: string) =>
    fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

  const GUARDAM_SEGREDO = [
    "middleware.ts",
    "app/api/webhook/whatsapp/route.ts",
    "app/api/cron/follow-ups/route.ts",
    "app/api/cron/reengajamento/route.ts",
  ];

  for (const arq of GUARDAM_SEGREDO) {
    it(`${arq} não usa segredo com fallback vazio`, () => {
      const fonte = leia(arq);
      expect(fonte).not.toMatch(/(JWT_SECRET|WEBHOOK_TOKEN|CRON_SECRET)\s*\?\?\s*["'`]/);
      expect(fonte).not.toMatch(/(JWT_SECRET|WEBHOOK_TOKEN|CRON_SECRET)\s*\|\|\s*["'`]/);
    });
  }

  it("o webhook do WhatsApp recusa quando o token não está no ambiente", () => {
    const fonte = leia("app/api/webhook/whatsapp/route.ts");
    // Padrão correto: `!expectedToken ||` dentro da condição de recusa.
    expect(fonte).toMatch(/if\s*\(\s*!expectedToken\s*\|\|/);
    // Padrão errado, que era o código antigo: proteção dentro de um if.
    expect(fonte).not.toMatch(/if\s*\(\s*expectedToken\s*\)\s*\{/);
  });

  it("o middleware recusa quando JWT_SECRET não está no ambiente", () => {
    const fonte = leia("middleware.ts");
    expect(fonte).toMatch(/if\s*\(\s*!segredo\s*\)/);
    expect(fonte).toContain('algorithms: ["HS256"]');
  });
});

describe("o CSV do Livro-Caixa não executa fórmula na máquina do dono", () => {
  it("o nome do cliente passa por neutralizarFormula", () => {
    // O outro gerador de CSV do sistema (lib/dados/exportar.ts) já neutraliza.
    // Este tinha implementação própria, escapava aspas e não tratava fórmula —
    // e aspas não impedem o Excel de avaliar a célula.
    const fonte = readFileSync(join(__dirname, "..", "app/api/livro-caixa/route.ts"), "utf8");
    expect(fonte).toContain("neutralizarFormula(");
  });
});

describe("dupla marcação na agenda pública", () => {
  /**
   * TOCTOU. A rota checa `livres.includes(hora)` e só depois cria o
   * agendamento. Entre a checagem e a criação, outra requisição pega o mesmo
   * horário — e não há constraint no banco para impedir, só um índice.
   *
   * O próprio comentário do código diz "dupla marcação é o pior defeito
   * possível numa agenda — o cliente aparece e não tem cadeira". O código
   * recalcula os livres no servidor justamente por causa disso, e mesmo assim
   * a corrida passa.
   *
   * A rota é PÚBLICA: dá para encher a agenda de um negócio com conflitos de
   * propósito.
   *
   * Constraint única em (companyId, startsAt) não serve: agendamento CANCELADO
   * ou FALTOU libera o horário, e a constraint bloquearia a remarcação. A saída
   * é transação serializável — o Postgres aborta a segunda, e ela vira o mesmo
   * 409 que o usuário já veria.
   */
  const rota = readFileSync(
    join(__dirname, "..", "app/api/agendar/[slug]/route.ts"),
    "utf8",
  );

  it("a checagem de horário livre e a criação acontecem na mesma transação", () => {
    expect(rota).toContain("$transaction");
    expect(rota).toContain("Serializable");
  });

  it("conflito de concorrência vira 409, não 500", () => {
    expect(rota).toContain("ehConflitoDeConcorrencia");
  });
});
