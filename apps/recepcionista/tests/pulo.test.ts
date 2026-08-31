import { describe, expect, it } from "vitest";
import { MOTIVOS_PULO, deveSilenciar, rotuloDoMotivo } from "@/lib/recuperacao/pulo";

/**
 * Antes desta correção o mapa era o inverso do certo: quem MUDOU DE CIDADE era
 * silenciado, e quem PEDIU PARA PARAR caía em "OUTRO" — o único motivo que NÃO
 * silenciava. O cliente que exerceu o direito dele era o único ignorado.
 */

describe("quais motivos silenciam", () => {
  it("pedido explícito do cliente silencia — é o caso que existe por lei", () => {
    expect(deveSilenciar("PEDIU_PARAR")).toBe(true);
  });

  it("motivos de futilidade silenciam: não adianta mandar", () => {
    expect(deveSilenciar("MUDOU_CIDADE")).toBe(true);
    expect(deveSilenciar("NAO_E_CLIENTE")).toBe(true);
    expect(deveSilenciar("FALECEU")).toBe(true);
    expect(deveSilenciar("EVENTO")).toBe(true);
  });

  it("OUTRO não silencia: motivo desconhecido não é consentimento retirado", () => {
    expect(deveSilenciar("OUTRO")).toBe(false);
  });

  it("motivo inválido nunca silencia", () => {
    expect(deveSilenciar("QUALQUER_COISA" as never)).toBe(false);
    expect(deveSilenciar(undefined)).toBe(false);
  });
});

describe("a lista é a fonte única", () => {
  it("todo motivo tem rótulo em português para a tela", () => {
    for (const m of MOTIVOS_PULO) {
      expect(rotuloDoMotivo(m).length).toBeGreaterThan(3);
    }
  });

  it("PEDIU_PARAR está na lista que a tela renderiza", () => {
    expect(MOTIVOS_PULO).toContain("PEDIU_PARAR");
  });
});
