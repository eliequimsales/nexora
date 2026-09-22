import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { proximoFechamento } from "@/lib/atendente/datas";
import { estadoDoAtendente, textoDoUso } from "@/lib/atendente/tela";

/**
 * A TELA DO ATENDENTE VIRTUAL — O QUE ELA DIZ.
 *
 * O estado em uma frase, sem palavra técnica: se ele está atendendo agora,
 * quando entra, por que parou. E o uso contado como o dono entende.
 */

const emBrasilia = (data: string, h: number, m = 0) => {
  const [a, mes, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, mes - 1, d, h + 3, m));
};
const DIA = 86_400_000;

const HORARIOS = [
  { day: 0, open: "09:00", close: "19:00", closed: true },
  { day: 1, open: "09:00", close: "19:00", closed: false },
  { day: 2, open: "09:00", close: "19:00", closed: false },
  { day: 3, open: "09:00", close: "19:00", closed: false },
  { day: 4, open: "09:00", close: "19:00", closed: false },
  { day: 5, open: "09:00", close: "19:00", closed: false },
  { day: 6, open: "09:00", close: "14:00", closed: false },
];

describe("proximoFechamento", () => {
  it("aberta na terça de manhã: fecha hoje às 19h", () => {
    expect(proximoFechamento(HORARIOS, [], emBrasilia("2026-09-22", 10))).toEqual(emBrasilia("2026-09-22", 19));
  });

  it("no sábado, fecha às 14h", () => {
    expect(proximoFechamento(HORARIOS, [], emBrasilia("2026-09-26", 10))).toEqual(emBrasilia("2026-09-26", 14));
  });

  it("expediente que vira a madrugada fecha no dia seguinte", () => {
    const bar = [{ day: 2, open: "18:00", close: "02:00", closed: false }];
    expect(proximoFechamento(bar, [], emBrasilia("2026-09-22", 23))).toEqual(emBrasilia("2026-09-23", 2));
  });

  it("dia fechado pelo botão não conta", () => {
    expect(proximoFechamento(HORARIOS, ["2026-09-22"], emBrasilia("2026-09-22", 10))).toEqual(
      emBrasilia("2026-09-23", 19),
    );
  });
});

const base = {
  ligado: true,
  nome: "Bia",
  acesso: "INCLUIDO" as const,
  whatsappLigado: true,
  horarios: HORARIOS,
  diasFechados: [] as string[],
  expediente: true,
  agora: emBrasilia("2026-09-22", 22),
};

describe("estadoDoAtendente — o estado em uma frase", () => {
  it("loja fechada: está atendendo agora", () => {
    expect(estadoDoAtendente(base)).toEqual({ texto: "Bia está atendendo agora.", tom: "ATENDENDO" });
  });

  it(`loja aberta, com o expediente ligado: entra depois de ${MINUTOS_SEM_RESPOSTA} minutos`, () => {
    const e = estadoDoAtendente({ ...base, agora: emBrasilia("2026-09-22", 10) });
    expect(e.tom).toBe("DE_OLHO");
    expect(e.texto).toBe(`Você está atendendo. Se ninguém responder em ${MINUTOS_SEM_RESPOSTA} minutos, Bia entra.`);
  });

  it("loja aberta, sem o expediente: diz quando volta", () => {
    const e = estadoDoAtendente({ ...base, expediente: false, agora: emBrasilia("2026-09-22", 10) });
    expect(e).toEqual({ texto: "Você está atendendo. Bia volta hoje às 19h, quando você fechar.", tom: "ESPERANDO" });
  });

  it("desligado, sem WhatsApp ou depois da semana grátis: diz por que parou", () => {
    expect(estadoDoAtendente({ ...base, ligado: false }).tom).toBe("DESLIGADO");
    expect(estadoDoAtendente({ ...base, whatsappLigado: false }).texto).toMatch(/WhatsApp está desligado/);
    expect(estadoDoAtendente({ ...base, acesso: "SEMANA_ACABOU" }).texto).toMatch(/semana grátis acabou/);
  });

  it("sem nome, fala do Atendente", () => {
    expect(estadoDoAtendente({ ...base, nome: " " }).texto).toBe("O Atendente está atendendo agora.");
  });

  it("nenhuma frase fala de tecnologia", () => {
    const frases = [
      estadoDoAtendente(base),
      estadoDoAtendente({ ...base, ligado: false }),
      estadoDoAtendente({ ...base, acesso: "TETO" }),
      estadoDoAtendente({ ...base, whatsappLigado: false }),
    ].map((e) => e.texto);
    for (const f of frases) expect(f, f).not.toMatch(/\bIA\b|intelig[êe]ncia|prompt|token|modelo|inst[âa]ncia|webhook/i);
  });
});

describe("textoDoUso — contado como o dono entende", () => {
  const agora = emBrasilia("2026-09-22", 22);

  it("no plano, as conversas do mês contra o teto", () => {
    const t = textoDoUso({ acesso: "INCLUIDO", agora, uso: { conversasNoMes: 37, conversasNaSemana: 0, primeiraVezEm: null } });
    expect(t).toBe(`37 de ${TETO_CONVERSAS_MES} conversas neste mês`);
  });

  it("antes de ligar, a semana grátis inteira", () => {
    const t = textoDoUso({ acesso: "SEMANA_GRATIS", agora, uso: { conversasNoMes: 0, conversasNaSemana: 0, primeiraVezEm: null } });
    expect(t).toBe(`Primeira semana grátis: ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas.`);
  });

  it("durante a semana, o que falta", () => {
    const t = textoDoUso({
      acesso: "SEMANA_GRATIS",
      agora,
      uso: { conversasNoMes: 19, conversasNaSemana: 19, primeiraVezEm: new Date(agora.getTime() - 3 * DIA) },
    });
    expect(t).toBe(`Semana grátis: faltam ${SEMANA_GRATIS_DIAS - 3} dias ou ${SEMANA_GRATIS_CONVERSAS - 19} conversas.`);
  });

  it("no último dia e na última conversa, no singular", () => {
    const t = textoDoUso({
      acesso: "SEMANA_GRATIS",
      agora,
      uso: {
        conversasNoMes: SEMANA_GRATIS_CONVERSAS - 1,
        conversasNaSemana: SEMANA_GRATIS_CONVERSAS - 1,
        primeiraVezEm: new Date(agora.getTime() - (SEMANA_GRATIS_DIAS - 1) * DIA),
      },
    });
    expect(t).toBe("Semana grátis: falta 1 dia ou 1 conversa.");
  });
});

// ——— A tela: o que ela nunca diz, e as travas do "Ligar" ———

const RAIZ = join(__dirname, "..");
const TELAS_DO_ATENDENTE = [
  "app/painel/atendente/page.tsx",
  "components/atendente/celular.tsx",
  "components/atendente/ajustes.tsx",
  "components/atendente/ligar.tsx",
  "components/atendente/situacao.tsx",
  "lib/atendente/tela.ts",
];
const fonte = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/** O texto que o dono lê: literais e texto entre tags, sem comentário, import nem classe. */
function visivel(codigo: string): string[] {
  const limpo = codigo
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/^\s*import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, " ")
    .replace(/className=(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*")/g, " ");
  return [
    ...[...limpo.matchAll(/"([^"\n]{2,})"/g)].map((m) => m[1]),
    ...[...limpo.matchAll(/`([^`]{2,})`/g)].map((m) => m[1]),
    ...[...limpo.matchAll(/>([^<>{}]{2,})</g)].map((m) => m[1]),
  ]
    .filter((t) => !/^[A-Za-z_][A-Za-z0-9_./-]*$/.test(t.trim()))
    // O `>` de um genérico (useState<Jeito>) abre uma captura falsa de código.
    .filter((t) => !/[;=]|\bconst\b/.test(t));
}

describe("a tela do Atendente mostra um funcionário, não uma tecnologia", () => {
  for (const tela of TELAS_DO_ATENDENTE) {
    it(`${tela} não fala de IA, prompt, token, modelo, instância nem webhook`, () => {
      const achados = visivel(fonte(tela)).filter(
        (t) =>
          /\bIA\b/.test(t) ||
          /intelig[êe]ncia artificial|\bprompts?\b|\btokens?\b|\bmodelos?\b|inst[âa]ncia|webhook/i.test(t),
      );
      expect(achados, achados.join(" | ")).toEqual([]);
    });
  }
});

/**
 * A TELA SE EXPLICA SOZINHA (22/09/2026).
 *
 * A primeira versão tinha três passos, três conversas lado a lado, o mesmo
 * horário dito três vezes e um parágrafo em cada cartão. O fundador chamou de
 * "contaminada", e o objetivo virou um só: um produto tão claro que se explica
 * sozinho. Esta trava impede o parágrafo de voltar.
 */
describe("a tela do Atendente não explica a si mesma", () => {
  const MAX_FRASE = 130;

  for (const tela of TELAS_DO_ATENDENTE) {
    it(`${tela}: nenhuma frase na tela passa de ${MAX_FRASE} caracteres`, () => {
      const longas = visivel(fonte(tela))
        .map((t) => t.replace(/\$\{[^}]*\}/g, "…").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > MAX_FRASE);
      expect(longas, longas.join("\n")).toEqual([]);
    });
  }

  it("é uma tela só: sem passo a passo e sem botão de continuar", () => {
    const pagina = fonte("app/painel/atendente/page.tsx");
    expect(pagina).not.toMatch(/Passo \d|PASSOS|Continuar para/);
  });

  // A coluna "auto" de uma grade cresce até o item mais largo: no celular, o
  // celular e os cartões passavam da borda da tela.
  it("cabe no celular: a coluna única encolhe até a tela", () => {
    const pagina = fonte("app/painel/atendente/page.tsx");
    expect(pagina).toMatch(/className="grid grid-cols-1 /);
  });
});

describe("o celular é a explicação", () => {
  const celular = fonte("components/atendente/celular.tsx");

  it("abre com a conversa de exemplo do motor, com os dados do negócio, e se declara exemplo", () => {
    expect(celular).toContain("conversaDeExemplo(");
    expect(celular).toMatch(/: "exemplo"/);
  });

  it("e o dono testa ali mesmo, com o motor de verdade", () => {
    expect(celular).toContain("/api/atendente/simular");
  });

  it("oferece ouvir em voz alta quando o navegador tem voz", () => {
    expect(celular).toContain("speechSynthesis");
  });
});

describe("o \"Ligar no meu WhatsApp\"", () => {
  // Sem os comentários: o cabeçalho do arquivo também fala do botão.
  const ligar = fonte("components/atendente/ligar.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("só liga depois do primeiro teste", () => {
    expect(ligar).toContain("Ligar no meu WhatsApp");
    expect(ligar).toMatch(/disabled=\{!testado/);
  });

  it("a frase honesta sobre o QR Code aparece na hora de decidir, antes de confirmar", () => {
    const aviso = ligar.indexOf("não é a oficial do WhatsApp");
    const confirmar = ligar.indexOf("Ligar agora");
    expect(aviso).toBeGreaterThan(-1);
    expect(ligar).toMatch(/reduz o risco, mas não zera/);
    expect(confirmar).toBeGreaterThan(aviso);
  });

  it("sem WhatsApp, abre a conexão em vez de recusar", () => {
    expect(ligar).toContain("ModalConectarWhatsApp");
  });

  it("a recusa da cobrança vira botão, com o caminho que resolve", () => {
    expect(ligar).toMatch(/recusa\.acao\.href/);
  });
});
