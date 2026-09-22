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

/**
 * O ATENDENTE VIRTUAL ASSUMIU O QUE O PLANTÃO PROMETIA.
 *
 * A tela diz se as respostas automáticas estão ligadas ou não — de verdade, pelo
 * estado do banco — e aponta para a tela do Atendente. O jeito livre, as regras
 * em texto livre, a primeira mensagem, a mensagem de fechado e o lembrete
 * saíram da tela, mas continuam no formulário: o schema tem default em tudo, e
 * um campo que some do PUT é apagado sem aviso.
 */
describe("a tela de configurações depois do Atendente Virtual", () => {
  const semComentarios = tela.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("fala do Atendente Virtual e leva até ele, sem o nome antigo", () => {
    expect(semComentarios).toContain("Atendente Virtual");
    expect(semComentarios).toContain('href="/painel/atendente"');
    expect(semComentarios).not.toMatch(/Plantão/);
  });

  it("o estado das respostas automáticas vem do banco, pela mesma regra do Atendente", () => {
    expect(semComentarios).toMatch(
      /setAtendenteLigado\(Boolean\(profile\.plantaoAtivo && profile\.atendenteLigadoPrimeiraVezEm\)\)/,
    );
    const rota = readFileSync(join(RAIZ, "app/api/company/profile/route.ts"), "utf8");
    expect(rota).toMatch(/plantaoAtivo:\s*true/);
    expect(rota).toMatch(/atendenteLigadoPrimeiraVezEm:\s*true/);
  });

  it("os campos que o Atendente substituiu saíram da tela, mas não do formulário", () => {
    for (const campo of ["aiTone", "serviceRules", "greetingMessage", "awayMessage", "followUpEnabled", "followUpMessage"]) {
      expect(semComentarios, campo).not.toContain(`set("${campo}"`);
      expect(semComentarios, campo).toMatch(new RegExp(`${campo}:\\s*profile\\.${campo}`));
    }
  });

  it("a conexão do WhatsApp não promete clique mágico nem disparo", () => {
    const modal = readFileSync(join(RAIZ, "components/painel/modal-conectar-whatsapp.tsx"), "utf8");
    expect(modal).not.toMatch(/1 clique|um clique|1 toque|dispar/i);
  });
});
