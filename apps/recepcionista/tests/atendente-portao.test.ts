import { describe, expect, it } from "vitest";
import { horarioDaEmpresa } from "@/lib/agenda/horario";
import {
  acessoDoAtendente,
  decidirQuando,
  fimDaSemanaGratis,
  lojaFechada,
  podeLigar,
} from "@/lib/atendente/portao";
import { SEMANA_GRATIS_CONVERSAS, SEMANA_GRATIS_DIAS, TETO_CONVERSAS_MES } from "@/lib/atendente/constantes";

/**
 * QUANDO O ATENDENTE PODE RESPONDER.
 *
 * Nada responde sozinho sem o dono ligar. Com a loja fechada, responde na hora.
 * Com a loja aberta, a mensagem é do dono — o Atendente só entra se ninguém
 * responder em 5 minutos, e só se o dono deixou. Resposta do dono pelo celular
 * cala o Atendente naquela conversa por 12 horas.
 */

const HORARIO = horarioDaEmpresa([]); // seg–sex 8h–20h, sáb 8h–19h, dom fechado
const TERCA_22H = new Date("2026-09-23T01:00:00.000Z");
const TERCA_10H = new Date("2026-09-22T13:00:00.000Z");
const minutosAntes = (base: Date, m: number) => new Date(base.getTime() - m * 60_000);
const diasAntes = (base: Date, d: number) => new Date(base.getTime() - d * 86_400_000);

const ctx = (p: Partial<Parameters<typeof decidirQuando>[0]> = {}): Parameters<typeof decidirQuando>[0] => ({
  ligado: true,
  acesso: "INCLUIDO",
  horarios: HORARIO,
  diasFechados: [],
  expediente: true,
  donoAssumiuEm: null,
  ultimaDoClienteEm: TERCA_22H,
  respondidaDepois: false,
  agora: TERCA_22H,
  origem: "WEBHOOK",
  ...p,
});

describe("acessoDoAtendente", () => {
  const base = { primeiraVezEm: null, conversasNaSemana: 0, conversasNoMes: 0, agora: TERCA_22H };

  it("no plano, incluído até o teto de conversas do mês", () => {
    for (const estado of ["ATIVO", "PASSE", "TRIAL", "TOLERANCIA", "CANCELADO_COM_ACESSO"] as const) {
      expect(acessoDoAtendente({ ...base, estado }), estado).toBe("INCLUIDO");
    }
    expect(acessoDoAtendente({ ...base, estado: "ATIVO", conversasNoMes: TETO_CONVERSAS_MES })).toBe("TETO");
  });

  it("quem paga nunca cai na semana grátis, nem depois de usar a dele", () => {
    expect(
      acessoDoAtendente({ ...base, estado: "ATIVO", primeiraVezEm: diasAntes(TERCA_22H, 30) }),
    ).toBe("INCLUIDO");
  });

  it("sem plano: a primeira semana é por nossa conta", () => {
    expect(acessoDoAtendente({ ...base, estado: "GRATIS" })).toBe("SEMANA_GRATIS");
    expect(
      acessoDoAtendente({ ...base, estado: "GRATIS", primeiraVezEm: diasAntes(TERCA_22H, 3), conversasNaSemana: 12 }),
    ).toBe("SEMANA_GRATIS");
    expect(acessoDoAtendente({ ...base, estado: "TRIAL_EXPIRADO" })).toBe("SEMANA_GRATIS");
  });

  it(`a semana acaba em ${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas`, () => {
    expect(
      acessoDoAtendente({ ...base, estado: "GRATIS", primeiraVezEm: diasAntes(TERCA_22H, SEMANA_GRATIS_DIAS) }),
    ).toBe("SEMANA_ACABOU");
    expect(
      acessoDoAtendente({
        ...base,
        estado: "GRATIS",
        primeiraVezEm: diasAntes(TERCA_22H, 1),
        conversasNaSemana: SEMANA_GRATIS_CONVERSAS,
      }),
    ).toBe("SEMANA_ACABOU");
  });

  it("o fim da semana grátis é exatamente sete dias depois", () => {
    const inicio = diasAntes(TERCA_22H, 2);
    expect(fimDaSemanaGratis(inicio)).toEqual(new Date(inicio.getTime() + SEMANA_GRATIS_DIAS * 86_400_000));
  });

  it("só não liga quando a semana grátis acabou", () => {
    expect(podeLigar("SEMANA_ACABOU")).toBe(false);
    for (const a of ["INCLUIDO", "TETO", "SEMANA_GRATIS"] as const) expect(podeLigar(a), a).toBe(true);
  });
});

describe("lojaFechada", () => {
  it("o avesso do horário da agenda, mais os dias fechados pelo botão", () => {
    expect(lojaFechada({ horarios: HORARIO, diasFechados: [], agora: TERCA_22H })).toBe(true);
    expect(lojaFechada({ horarios: HORARIO, diasFechados: [], agora: TERCA_10H })).toBe(false);
    expect(lojaFechada({ horarios: HORARIO, diasFechados: ["2026-09-22"], agora: TERCA_10H })).toBe(true);
  });
});

describe("decidirQuando — os casos de sempre", () => {
  it("desligado, nunca responde — nem de madrugada", () => {
    expect(decidirQuando(ctx({ ligado: false }))).toEqual({ acao: "SILENCIO", motivo: "DESLIGADO" });
  });

  it("ligado e com a loja fechada, responde na hora", () => {
    expect(decidirQuando(ctx())).toEqual({ acao: "RESPONDER" });
  });

  it("o dono respondeu pelo celular há uma hora: silêncio", () => {
    expect(decidirQuando(ctx({ donoAssumiuEm: minutosAntes(TERCA_22H, 60) }))).toEqual({
      acao: "SILENCIO",
      motivo: "DONO_ASSUMIU",
    });
  });

  it("passadas 12 horas, a conversa volta a ser do Atendente", () => {
    expect(decidirQuando(ctx({ donoAssumiuEm: minutosAntes(TERCA_22H, 13 * 60) }))).toEqual({ acao: "RESPONDER" });
  });

  it("desligado vale mais que qualquer outro motivo", () => {
    expect(decidirQuando(ctx({ ligado: false, donoAssumiuEm: minutosAntes(TERCA_22H, 60) }))).toEqual({
      acao: "SILENCIO",
      motivo: "DESLIGADO",
    });
  });

  it("semana grátis acabada: silêncio, mesmo com a loja fechada", () => {
    expect(decidirQuando(ctx({ acesso: "SEMANA_ACABOU" }))).toEqual({ acao: "SILENCIO", motivo: "SEM_PLANO" });
  });

  it("no teto do plano ele ainda responde — o texto fixo é decidido depois", () => {
    expect(decidirQuando(ctx({ acesso: "TETO" }))).toEqual({ acao: "RESPONDER" });
  });

  it("dia fechado pelo botão: responde mesmo às 10h", () => {
    expect(decidirQuando(ctx({ agora: TERCA_10H, diasFechados: ["2026-09-22"] }))).toEqual({ acao: "RESPONDER" });
  });

  it("entende expediente que vira a madrugada", () => {
    const bar = [{ day: 2, open: "18:00", close: "02:00", closed: false }];
    expect(decidirQuando(ctx({ horarios: bar, expediente: false }))).toEqual({ acao: "SILENCIO", motivo: "ABERTO" });
  });
});

describe("decidirQuando — no expediente", () => {
  it("sem a opção do expediente, a loja aberta é só do dono", () => {
    expect(decidirQuando(ctx({ agora: TERCA_10H, expediente: false }))).toEqual({
      acao: "SILENCIO",
      motivo: "ABERTO",
    });
  });

  it("com a opção, a mensagem que chega espera", () => {
    expect(decidirQuando(ctx({ agora: TERCA_10H, ultimaDoClienteEm: TERCA_10H }))).toEqual({ acao: "ESPERAR" });
  });

  it("o resgate só responde depois de 5 minutos sem resposta", () => {
    const resgate = { agora: TERCA_10H, origem: "RESGATE" as const };
    expect(decidirQuando(ctx({ ...resgate, ultimaDoClienteEm: minutosAntes(TERCA_10H, 4) }))).toEqual({
      acao: "SILENCIO",
      motivo: "CEDO_DEMAIS",
    });
    expect(decidirQuando(ctx({ ...resgate, ultimaDoClienteEm: minutosAntes(TERCA_10H, 5) }))).toEqual({
      acao: "RESPONDER",
    });
  });

  it("alguém já respondeu depois da mensagem: o resgate não entra", () => {
    expect(
      decidirQuando(
        ctx({ agora: TERCA_10H, origem: "RESGATE", ultimaDoClienteEm: minutosAntes(TERCA_10H, 9), respondidaDepois: true }),
      ),
    ).toEqual({ acao: "SILENCIO", motivo: "JA_RESPONDIDA" });
  });
});
