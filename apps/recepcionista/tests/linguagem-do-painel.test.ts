import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O PAINEL FALA A LÍNGUA DE QUEM PAGA.
 *
 * Quem usa a Nexora é dono de barbearia, de clínica, de estética, de loja de
 * bairro. Ele não sabe o que é follow-up, handoff, ticket médio, toque, ciclo
 * nem atribuição — e cada uma dessas palavras estava numa tela que ele precisa
 * entender para ganhar dinheiro. Palavra que ele não entende é botão que ele
 * não aperta.
 *
 * ESTE TESTE OLHA SÓ O TEXTO VISÍVEL. Nome de campo, classe de CSS e rota
 * continuam em inglês e em código — renomear `followUpEnabled` apagaria o dado
 * do cliente, porque o Zod tem `default` em tudo e troca campo desconhecido por
 * vazio sem reclamar. O contrato com o servidor fica; o que muda é o que o dono
 * lê.
 *
 * O QUE FICA DE PROPÓSITO: "Onda de segunda" e "Livro-Caixa" são os nomes do
 * ritual e do extrato, prometidos na landing e travados no menu. Não são
 * jargão a eliminar — são nomes próprios a explicar na primeira aparição de
 * cada tela.
 */

const RAIZ = join(__dirname, "..");

const TELAS = [
  "app/painel/layout.tsx",
  "app/painel/configuracoes/page.tsx",
  "app/painel/clientes/importar/page.tsx",
  "app/painel/onda/page.tsx",
  "app/painel/livro-caixa/page.tsx",
  // Texto de painel também, e dos mais lidos: o checklist é a primeira coisa
  // que o dono vê ao entrar, e o cartão de retorno é o número que o faz renovar.
  "components/painel/checklist-ativacao.tsx",
  "components/painel/cartao-retorno.tsx",
];

// O `[^:]` antes do `//` existe para não engolir `https://…` como se fosse
// comentário — foi assim que um link legítimo sumiu da varredura.
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Extrai o que o dono REALMENTE lê: texto entre tags e literais de string que
 * pareçam frase. Descarta className, href e afins, e descarta qualquer literal
 * que seja um identificador puro — `set("followUpEnabled", …)` é contrato com o
 * banco, não é frase na tela.
 */
function textosVisiveis(fonte: string): string[] {
  const limpo = semComentarios(fonte)
    // Import nunca é texto de tela — sem isto, `from "./ciclo"` era lido como
    // se a palavra "ciclo" estivesse aparecendo para o dono.
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, " ")
    .replace(/className="[^"]*"/g, " ")
    // A classe pode ser um template com interpolação que contém aspas
    // (`${x ? "a" : "b"}`). Parar na primeira aspa deixava uma crase solta, e a
    // captura seguinte engolia blocos inteiros de código como se fossem frase.
    .replace(/className=\{(?:[^{}]|\{[^{}]*\})*\}/g, " ")
    .replace(/(?:href|src|accept|aria-label|key)=\{?[`"][^`"]*[`"]\}?/g, " ")
    // O `>` da arrow function abre uma captura falsa e traz código para dentro
    // do "texto visível" (`=> setGravado(null)` virava frase de tela).
    .replace(/=>/g, " ");

  const literais = [
    ...[...limpo.matchAll(/"([^"\\\n]{2,})"/g)].map((m) => m[1]),
    // Crase com interpolação é frase de tela também: tira o ${…} e lê o resto.
    ...[...limpo.matchAll(/`([^`\\]{2,})`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, " ")),
  ];
  const entreTags = [...limpo.matchAll(/>([^<>]{2,})</g)]
    .map((m) => m[1].replace(/\{[^{}]*\}/g, " "))
    // Chave sobrando = o fragmento é uma expressão JSX cortada ao meio, não uma
    // frase. Sem isto, `{form.followUpEnabled && …}` era lido como texto de tela.
    .filter((t) => !/[{}]/.test(t));

  return [...literais, ...entreTags]
    .map((t) => t.trim())
    .filter((t) => t.length > 1)
    // Identificador puro não é frase: é nome de campo, de estado ou de enum.
    .filter((t) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(t));
}

/** Cada proibição diz o que pôr no lugar — senão o teste vira enigma. */
const PROIBIDO: { termo: RegExp; troque: string }[] = [
  { termo: /\bfollow[ -]?up/i, troque: "lembrete" },
  { termo: /\bhandoff/i, troque: "chamar você / passar para a sua equipe" },
  { termo: /ticket\s*médio/i, troque: "gasta em média R$ X por visita" },
  { termo: /\btoques?\b/i, troque: "mensagem (ex.: 2ª de 4 mensagens)" },
  { termo: /\bprotocolo\b/i, troque: "as 4 mensagens" },
  { termo: /\bsequência\b/i, troque: "as tentativas com esse cliente" },
  { termo: /\bgrav(ar|ando|ado|ada|ados|adas)\b/i, troque: "salvar / salvando / salvo" },
  { termo: /\bbases?\b/i, troque: "sua lista de clientes" },
  { termo: /atribuiç/i, troque: "não dá para provar que foi pela sua mensagem" },
  { termo: /\bdesfecho/i, troque: "se apareceu ou não" },
  { termo: /\bciclos?\b/i, troque: "costuma voltar a cada N dias" },
  { termo: /média do segmento/i, troque: "média de negócios parecidos com o seu" },
  { termo: /reimport/i, troque: "mandar a mesma planilha de novo" },
  { termo: /\bFAQ\b/, troque: "Pergunta 1, Pergunta 2…" },
  { termo: /tom de voz/i, troque: "como a atendente deve falar com o cliente" },
  { termo: /confiança\s+(baixa|alta)/i, troque: "isso aqui é um palpite" },
  { termo: /\b(CSV|TXT|TSV)\b/, troque: "planilha, bloco de notas" },
  { termo: /\bCDC\b/, troque: "Código de Defesa do Consumidor, por extenso" },
  { termo: /webhook/i, troque: "nunca aparece para o dono" },
  { termo: /APP_URL/, troque: "nome de variável não vai para a tela" },
  { termo: /\binstância\b/i, troque: "sua conexão do WhatsApp" },
  { termo: /em jogo/i, troque: "é o que essas pessoas costumam gastar juntas" },
  { termo: /\bdesconectado\b/i, troque: "seu WhatsApp ainda não está ligado" },
  { termo: /criar conexão/i, troque: "Ligar meu WhatsApp" },
  { termo: /condições comerciais/i, troque: "preços, pacotes e descontos" },
  { termo: /\bsaudação\b/i, troque: "primeira mensagem que o cliente recebe" },
  { termo: /\bopt[ -]?out\b/i, troque: "pediu para não receber mensagem" },
];

describe("nenhuma tela do painel fala em jargão", () => {
  for (const tela of TELAS) {
    const visiveis = textosVisiveis(readFileSync(join(RAIZ, tela), "utf8"));

    for (const { termo, troque } of PROIBIDO) {
      it(`${tela} não diz ${termo}`, () => {
        const achados = visiveis.filter((t) => termo.test(t));
        expect(
          achados,
          `Em ${tela}, troque por: ${troque}\nEncontrado: ${achados.join(" | ")}`,
        ).toEqual([]);
      });
    }
  }
});

/**
 * O JARGÃO TAMBÉM NASCE NO SERVIDOR.
 *
 * "O ciclo é de 24 dias", "ticket médio R$ 80" e "os 4 toques do protocolo" não
 * estão em tela nenhuma: vêm prontos destas três libs e são renderizados crus
 * no cartão da Onda e no estado vazio. Varrer só as telas deixaria o pior
 * jargão passar — ele chega por baixo.
 */
const FRASES_DO_SERVIDOR = [
  "lib/recuperacao/ciclo.ts",
  "lib/recuperacao/onda.ts",
  "lib/recuperacao/servico.ts",
  // O texto dos três passos e o do estado de R$ 0 nascem aqui, prontos, e
  // chegam à tela sem passar por nenhuma das telas varridas acima.
  "lib/painel/ativacao.ts",
  "lib/painel/retorno.ts",
];

describe("o texto que o servidor manda para a tela também é em português de dono", () => {
  for (const arquivo of FRASES_DO_SERVIDOR) {
    const visiveis = textosVisiveis(readFileSync(join(RAIZ, arquivo), "utf8"));

    for (const { termo, troque } of PROIBIDO) {
      it(`${arquivo} não manda ${termo}`, () => {
        const achados = visiveis.filter((t) => termo.test(t));
        expect(
          achados,
          `Em ${arquivo}, troque por: ${troque}\nEncontrado: ${achados.join(" | ")}`,
        ).toEqual([]);
      });
    }
  }
});

describe("o menu diz o que a tela faz, sem metáfora", () => {
  it("a tela que traz cliente de volta se chama pelo que faz", () => {
    const layout = readFileSync(join(RAIZ, "app/painel/layout.tsx"), "utf8");
    expect(layout).toContain("Reativar clientes");
    expect(layout).not.toContain("Onda de segunda");
  });

  it("a tela do dinheiro se chama pelo que mostra", () => {
    const layout = readFileSync(join(RAIZ, "app/painel/layout.tsx"), "utf8");
    expect(layout).toContain("Dinheiro recuperado");
    expect(layout).not.toContain("Livro-Caixa");
  });

  it("e o título de cada tela bate com o nome no menu", () => {
    const onda = readFileSync(join(RAIZ, "app/painel/onda/page.tsx"), "utf8");
    const livro = readFileSync(join(RAIZ, "app/painel/livro-caixa/page.tsx"), "utf8");
    expect(onda).toContain("Reativar clientes");
    expect(onda).not.toContain("Onda de segunda");
    expect(livro).toMatch(/>Dinheiro recuperado</);
  });

  it("cada tela continua se explicando, e não só se nomeando", () => {
    const onda = readFileSync(join(RAIZ, "app/painel/onda/page.tsx"), "utf8");
    const livro = readFileSync(join(RAIZ, "app/painel/livro-caixa/page.tsx"), "utf8");
    // A frase diz o que a tela é. "já passou do tempo que ele mesmo costuma
    // demorar", e NÃO "não voltam há mais de 30 dias": a conta é por pessoa.
    // Quem corta o cabelo a cada 24 dias entra na lista antes dos 30; quem vai
    // ao salão a cada 45 não entra aos 31. O número redondo era mentira.
    expect(onda).toMatch(/já compraram de você/i);
    expect(onda).toMatch(/o tempo que ele mesmo costuma demorar/i);
    expect(livro).toMatch(/sem você gastar/i);
  });
});

/**
 * A PLANILHA TAMBÉM É TELA.
 *
 * O dono abre o extrato no Excel e às vezes manda para o contador. Saía
 * `data,cliente,dias_sumido,esteira,toque,valor_reais,atribuido`: nome de
 * coluna de banco de dados, separado por vírgula (que o Excel brasileiro joga
 * numa célula só) e sem BOM, o que faz "excluído" virar "excluÃ­do".
 */
describe("a planilha do Livro-Caixa abre no Excel do dono", () => {
  // Sem comentários: o código EXPLICA por que o cabeçalho antigo saiu, citando
  // os nomes crus. O guarda persegue o que vai para a planilha, não a
  // justificativa de quem consertou.
  const rota = semComentarios(readFileSync(join(RAIZ, "app/api/livro-caixa/route.ts"), "utf8"));

  it("o cabeçalho está em português", () => {
    expect(rota).toContain('"Dias sumido"');
    expect(rota).toContain('"Conta como recuperado?"');
  });

  it("não usa nome de coluna de banco de dados", () => {
    for (const cru of ["dias_sumido", "valor_reais"]) {
      expect(rota, cru).not.toContain(cru);
    }
  });

  it("traz BOM e ponto-e-vírgula, a mesma convenção da outra planilha do app", () => {
    expect(rota).toContain("BOM_CSV");
    expect(rota).toMatch(/SEP_CSV\s*=\s*";"/);
  });
});
