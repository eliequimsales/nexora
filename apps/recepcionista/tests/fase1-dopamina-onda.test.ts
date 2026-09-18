import { describe, expect, it } from "vitest";
import { retornoDaAssinatura } from "@/lib/painel/retorno";
import { mensagemDoToque } from "@/lib/recuperacao/toques";

describe("Fase 1: Dashboard de Dopamina & Opções de Mensagem", () => {
  it("o cálculo de retorno identifica lucro líquido quando o recuperado cobre a mensalidade", () => {
    const ret = retornoDaAssinatura({ recuperadoCents: 25_000, custoCents: 9_700 });
    expect(ret.cobre).toBe(true);
    expect(ret.multiplicador).toBe(2.5);
    const lucroLiquido = ret.recuperadoCents - ret.custoCents;
    expect(lucroLiquido).toBe(15_300);
  });

  it("as 4 mensagens da régua têm ganchos distintos sem repetição", () => {
    const ctx = { primeiroNome: "Carlos", negocio: "Barbearia Vip", link: "meunexora.com.br/agendar/vip" };
    const m1 = mensagemDoToque(1, ctx);
    const m2 = mensagemDoToque(2, ctx);
    const m3 = mensagemDoToque(3, ctx);
    const m4 = mensagemDoToque(4, ctx);

    expect(m1).toContain("Passei os olhos na agenda");
    expect(m2).toContain("separei");
    expect(m3).toContain("marcar direto por aqui");
    expect(m4).toContain("última vez que te chamo");

    const unicos = new Set([m1, m2, m3, m4]);
    expect(unicos.size).toBe(4);
  });
});
