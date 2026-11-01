import { describe, expect, it } from "vitest";
import { instanteLocal, lerPedidoDeDia } from "@/lib/atendente/datas";
import { escolherTres, type Livre } from "@/lib/atendente/oferta";

const agora = new Date("2026-10-23T13:00:00Z");
function livre(dia: string, minuto: number): Livre {
  const inicio = instanteLocal(dia, minuto);
  return { inicio, fim: new Date(inicio.getTime() + 30 * 60_000), profissional: "Ana" };
}

describe("hora exata declarada pelo cliente", () => {
  it.each([
    ["Quero marcar amanhã às 14h", 840],
    ["Quero marcar amanhã às14h", 840],
    ["14:30", 870],
    ["Para as14", 840],
    ["Amanhã às 0h", 0],
    ["Amanhã às 23h59", 1439],
  ])("interpreta %s sem inferir duração", (texto, esperado) => {
    expect(lerPedidoDeDia(texto, agora).horaExata).toBe(esperado);
  });
  it("a hora sozinha não inventa um dia", () => {
    expect(lerPedidoDeDia("14:30", agora)).toEqual({ horaExata: 870 });
  });
  it.each(["antes das 14h", "até as 14:30", "entre 14h e 16h", "das 14h às 16h", "14h ou 16h", "às 24h", "às 14:99", "às 14:3", "qualquer horário", "não sei a hora"])("não trata limite/ambiguidade/valor inválido como exato: %s", (texto) => {
    expect(lerPedidoDeDia(texto, agora).horaExata).toBeUndefined();
  });
  it.each(["depois das 14h", "após as 14:00", "a partir das14h"])("preserva limite inferior: %s", (texto) => {
    expect(lerPedidoDeDia(texto, agora)).toEqual({ aPartirDe: 840 });
  });
  it("meia-noite usa o dia local informado", () => {
    const pedido = lerPedidoDeDia("Amanhã às 0h", new Date("2026-10-24T02:59:00Z"));
    expect(pedido).toEqual({ dia: "2026-10-24", horaExata: 0 });
    expect(instanteLocal(pedido.dia!, pedido.horaExata!).toISOString()).toBe("2026-10-24T03:00:00.000Z");
  });
});

describe("oferta respeita minuto exato e diferencia alternativas", () => {
  it("seleciona somente 14h, sem tratar 13h59 nem 14h01 como equivalentes", () => {
    const exata = livre("2026-10-24", 840);
    const r = escolherTres([livre("2026-10-24", 839), livre("2026-10-24", 841), exata], { dia: "2026-10-24", horaExata: 840 });
    expect(r).toEqual({ opcoes: [exata], noDiaPedido: true });
  });
  it("mantém limite inferior como limite, incluindo depois da hora", () => {
    const apos = [livre("2026-10-24", 840), livre("2026-10-24", 930)];
    expect(escolherTres([livre("2026-10-24", 839), ...apos], { dia: "2026-10-24", aPartirDe: 840 }).opcoes).toEqual(apos);
  });
  it("alternativas em outro dia não confirmam o pedido original", () => {
    const outraData = livre("2026-10-25", 840);
    expect(escolherTres([outraData], { dia: "2026-10-24", horaExata: 840 })).toEqual({ opcoes: [outraData], noDiaPedido: false });
  });
  it("sem o minuto solicitado, oferece alternativas do mesmo dia como alternativas", () => {
    const outras = [livre("2026-10-24", 810), livre("2026-10-24", 900)];
    expect(escolherTres(outras, { dia: "2026-10-24", horaExata: 840 })).toEqual({ opcoes: outras, noDiaPedido: false });
  });
  it("sem hora conhecida, não aplica um filtro exato", () => {
    const opcoes = [livre("2026-10-24", 540), livre("2026-10-24", 840)];
    expect(escolherTres(opcoes, { dia: "2026-10-24" })).toEqual({ opcoes, noDiaPedido: true });
  });
});
