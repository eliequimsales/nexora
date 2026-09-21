import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A TELA NÃO PODE PROMETER O QUE O SISTEMA NÃO FAZ.
 *
 * Com o Plantão desligado por padrão, "Atendente online e atendendo" e "sua
 * atendente responde sozinha" viraram mentira no minuto em que a Fase 0 entrou.
 */

const RAIZ = join(__dirname, "..");
const tela = readFileSync(join(RAIZ, "app/painel/configuracoes/page.tsx"), "utf8");

describe("a tela de configurações", () => {
  it("não diz que a atendente está atendendo nem que responde sozinha", () => {
    expect(tela).not.toContain("Atendente online e atendendo");
    expect(tela).not.toMatch(/responde sozinha/i);
    expect(tela).not.toMatch(/a atendente não recebe nem responde nada/i);
  });

  it("diz, com todas as letras, que as respostas automáticas estão desligadas", () => {
    expect(tela).toMatch(/Respostas automáticas estão desligadas/);
  });

  it("com o WhatsApp conectado, o selo diz só que ele está ligado", () => {
    expect(tela).toMatch(/CONNECTED:\s*\{\s*label:\s*"WhatsApp ligado"/);
  });
});
