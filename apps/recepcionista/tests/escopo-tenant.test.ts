import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O ESCOPO DE TENANT É VERIFICADO NO BUILD, JÁ QUE NÃO É NO BANCO.
 *
 * A base não tem Row Level Security. O isolamento entre contas existe só no
 * código de aplicação: toda consulta filtra por companyId. Isso funciona
 * enquanto ninguém esquece — e "ninguém esquece" não é um controle de
 * segurança, é uma esperança. Uma consulta sem companyId devolve a base de
 * clientes de outro assinante, que é o pior vazamento que este produto pode
 * ter.
 *
 * Enquanto o RLS não existe (ver docs/runbooks/rls.md, que precisa de banco de
 * pé para ser aplicado e verificado), este teste é o controle: qualquer
 * consulta a modelo com companyId precisa provar o escopo, ou o build quebra.
 *
 * Não substitui RLS. RLS protege contra o erro em tempo de execução, inclusive
 * de código que este teste não vê. Este teste protege contra o erro entrando
 * no repositório, que é a etapa anterior.
 */

const RAIZ = join(__dirname, "..");

/** Modelos cujas linhas pertencem a UMA empresa. Derivado do schema. */
const MODELOS_DE_TENANT = [
  "reengajamento",
  "passwordReset",
  "companyProfile",
  "conversation",
  "lead",
  "knowledgeGap",
  "knowledgeItem",
  "errorLog",
  "customer",
  "service",
  "appointment",
  "recoveryTouch",
  "recoveryEntry",
  "registroImportacao",
  "supressao",
  "verificacaoEmail",
];

/**
 * Exceções, cada uma com o motivo escrito. Isenção sem motivo vira hábito, e
 * daí a lista cresce até o teste não significar mais nada.
 */
const ISENTAS: { arquivo: string; modelo: string; motivo: string }[] = [
  {
    arquivo: "lib/errors.ts",
    modelo: "errorLog",
    motivo: "grava log de erro; companyId é opcional porque nem todo erro tem sessão",
  },
  {
    arquivo: "lib/senha.ts",
    modelo: "passwordReset",
    motivo: "o token É a credencial; a busca é pelo hash dele, e o companyId sai do resultado",
  },
  {
    arquivo: "lib/auth/verificacao.ts",
    modelo: "verificacaoEmail",
    motivo: "mesmo desenho do reset: o token é a credencial, o companyId sai do resultado",
  },
  {
    arquivo: "lib/reengajamento/servico.ts",
    modelo: "reengajamento",
    motivo: "a régua roda por cron sobre todas as contas, por desenho",
  },
  {
    arquivo: "lib/billing/converger.ts",
    modelo: "companyProfile",
    motivo: "converge a partir do id que veio da Stripe, já resolvido para uma empresa",
  },
  {
    arquivo: "lib/conversation-service.ts",
    modelo: "companyProfile",
    motivo: "é o ponto de ENTRADA do webhook: resolve QUAL empresa é, pela instância do WhatsApp",
  },
];

function listarFontes(dir: string): string[] {
  const saida: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      saida.push(...listarFontes(caminho));
    } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
      saida.push(caminho);
    }
  }
  return saida;
}

/** Extrai cada chamada Prisma com o corpo do objeto passado. */
function chamadas(fonte: string): { modelo: string; metodo: string; corpo: string; linha: number }[] {
  const achados: { modelo: string; metodo: string; corpo: string; linha: number }[] = [];
  const re = /\b(?:prisma|tx)\.(\w+)\.(findUnique|findUniqueOrThrow|findFirst|findMany|update|updateMany|delete|deleteMany|count|aggregate|groupBy)\s*\(/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) {
    // Equilibra parênteses a partir da abertura para pegar o argumento inteiro,
    // inclusive quando ele tem objetos aninhados.
    let profundidade = 1;
    let i = m.index + m[0].length;
    while (i < fonte.length && profundidade > 0) {
      if (fonte[i] === "(") profundidade++;
      else if (fonte[i] === ")") profundidade--;
      i++;
    }
    achados.push({
      modelo: m[1],
      metodo: m[2],
      corpo: fonte.slice(m.index, i),
      linha: fonte.slice(0, m.index).split("\n").length,
    });
  }
  return achados;
}

const fontes = [...listarFontes(join(RAIZ, "app")), ...listarFontes(join(RAIZ, "lib"))];

describe("toda consulta a modelo de tenant prova o escopo", () => {
  const violacoes: string[] = [];

  for (const caminho of fontes) {
    const rel = caminho.slice(RAIZ.length + 1).replace(/\\/g, "/");
    const fonte = readFileSync(caminho, "utf8");

    for (const c of chamadas(fonte)) {
      if (!MODELOS_DE_TENANT.includes(c.modelo)) continue;
      if (ISENTAS.some((i) => i.arquivo === rel && i.modelo === c.modelo)) continue;

      // A PROPRIEDADE QUE IMPORTA não é "toda consulta cita companyId".
      //
      // O padrão seguro e dominante neste código é: verificar com
      // `findFirst({ id, companyId })`, checar o 404, e só então agir sobre o
      // id JÁ VERIFICADO. Exigir companyId também no update seguinte
      // reprovaria doze consultas corretas — e um teste que reprova o código
      // certo é abandonado na primeira semana.
      //
      // O perigo real é agir sobre um id que veio DA REQUISIÇÃO sem ter
      // passado por essa verificação. É isso que se checa aqui.
      const idDaRequisicao =
        /where:\s*\{[^}]*\b(params\.|parsed\.data\.|body\.|searchParams|await\s+request)/.test(
          c.corpo,
        );
      if (idDaRequisicao && !/companyId/.test(c.corpo)) {
        violacoes.push(`${rel}:${c.linha}  prisma.${c.modelo}.${c.metodo} — id da requisição sem companyId`);
      }
    }
  }

  it("nenhuma consulta sem prova de escopo", () => {
    expect(violacoes, `\n${violacoes.join("\n")}\n`).toEqual([]);
  });
});

describe("a lista de isenções não vira depósito", () => {
  it("toda isenção tem motivo escrito", () => {
    for (const i of ISENTAS) {
      expect(i.motivo.length, `${i.arquivo}:${i.modelo}`).toBeGreaterThan(30);
    }
  });

  it("nenhuma isenção aponta para arquivo que não existe mais", () => {
    for (const i of ISENTAS) {
      expect(() => readFileSync(join(RAIZ, i.arquivo), "utf8"), i.arquivo).not.toThrow();
    }
  });

  it("são poucas — se crescer, o problema é o desenho, não o teste", () => {
    expect(ISENTAS.length).toBeLessThanOrEqual(8);
  });
});
