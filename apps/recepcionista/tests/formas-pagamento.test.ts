import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORMAS_DE_PAGAMENTO, formasDePagamentoTexto } from "@/lib/billing/preco";

/**
 * FORMA DE PAGAMENTO PROMETIDA vs. FORMA DE PAGAMENTO LIGADA.
 *
 * Em 30/08/2026 três telas prometiam "cartão ou boleto" enquanto o boleto
 * estava DESLIGADO no dashboard. O cliente só descobriria no checkout — o pior
 * lugar possível para descobrir. O erro é invisível para o TypeScript porque a
 * promessa é uma string solta e a verdade mora fora do repositório.
 */

const RAIZ = join(__dirname, "..");

/** Telas e e-mails que o dono da barbearia lê antes de decidir pagar. */
const ARQUIVOS_DE_COPY = [
  "app/page.tsx",
  "app/diagnostico/page.tsx",
  "app/painel/assinatura/page.tsx",
  "lib/reengajamento/motor.ts",
];

/** Tudo que a Stripe BR poderia oferecer e que alguém pode escrever sem pensar. */
const MEIOS_CONHECIDOS = ["cartão", "boleto", "pix"];

describe("frase das formas de pagamento", () => {
  it("no singular não inventa conjunção", () => {
    expect(formasDePagamentoTexto(["cartão"])).toBe("cartão");
  });

  it("com dois, liga com 'ou'", () => {
    expect(formasDePagamentoTexto(["cartão", "boleto"])).toBe("cartão ou boleto");
  });

  it("com três, vírgula até o último", () => {
    expect(formasDePagamentoTexto(["cartão", "boleto", "Pix"])).toBe(
      "cartão, boleto ou Pix",
    );
  });
});

describe("nenhuma tela promete meio de pagamento desligado", () => {
  const ligados = FORMAS_DE_PAGAMENTO.map((f) => f.toLowerCase());
  const proibidos = MEIOS_CONHECIDOS.filter((m) => !ligados.includes(m));

  for (const arquivo of ARQUIVOS_DE_COPY) {
    it(`${arquivo} não cita meio desligado`, () => {
      const texto = readFileSync(join(RAIZ, arquivo), "utf8").toLowerCase();
      for (const meio of proibidos) {
        expect(texto, `"${meio}" aparece em ${arquivo} mas não está ligado na Stripe`)
          .not.toContain(meio);
      }
    });
  }
});
