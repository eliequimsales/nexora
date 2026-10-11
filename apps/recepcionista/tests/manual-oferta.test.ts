import { describe, expect, it } from "vitest";
import { obterCompraManual } from "@/lib/manual/oferta";

describe("compra avulsa do guia", () => {
  it("usa somente o destino configurado para o material", () => {
    expect(
      obterCompraManual(" https://pagamento.example/guia?oferta=27 "),
    ).toEqual({
      href: "https://pagamento.example/guia?oferta=27",
      pagamentoDisponivel: true,
    });
  });

  it.each([
    undefined,
    "",
    "invalido",
    "/api/billing/checkout",
    "http://pagamento.example/guia",
    "javascript:alert(1)",
    "https://usuario:senha@pagamento.example/guia",
  ])("oferece contato sem simular compra para %s", (config) => {
    const compra = obterCompraManual(config);
    const url = new URL(compra.href);
    expect(compra.pagamentoDisponivel).toBe(false);
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toContain(
      "Como posso comprar e receber o material?",
    );
    expect(url.searchParams.get("text")).not.toContain("acabei de garantir");
  });
});
