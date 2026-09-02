import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FRASE_SOCORRO, linkDeSocorro, temCanalDeSocorro } from "@/lib/contato";

/**
 * A PROMESSA SÓ EXISTE SE O CANAL EXISTIR.
 *
 * Três telas prometiam "me manda que eu converto na mão" e em todo o app não
 * havia um wa.me fora do convite. A promessa quebrava justamente com o lead
 * mais motivado: o que tentou, falhou, e leu que alguém ajudaria.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("sem número cadastrado, não há promessa", () => {
  it("o link não é inventado", () => {
    if (!temCanalDeSocorro()) expect(linkDeSocorro()).toBeNull();
  });

  it("quando existe canal, o link já vem com a mensagem escrita", () => {
    if (temCanalDeSocorro()) {
      const l = linkDeSocorro("colar a lista")!;
      expect(l).toContain("wa.me/55");
      expect(l).toContain("text=");
    }
  });
});

describe("nenhuma tela escreve a frase à mão", () => {
  /**
   * Se uma tela digitar a frase por conta própria, ela volta a prometer um
   * canal que pode não existir — e ninguém percebe até um cliente tentar.
   */
  for (const arq of [
    "app/diagnostico/page.tsx",
    "app/diagnostico/painel.tsx",
    "app/api/diagnostico/route.ts",
  ]) {
    it(`${arq} usa a constante`, () => {
      const fonte = leia(arq);
      expect(fonte).not.toContain("converto na mão");
    });
  }
});
