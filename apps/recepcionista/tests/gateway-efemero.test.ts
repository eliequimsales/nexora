import { describe, expect, it } from "vitest";
import { problemaNoGateway } from "@/lib/whatsapp/endereco";

/**
 * O GATEWAY DO WHATSAPP NÃO PODE SER UM TÚNEL DE DESENVOLVIMENTO.
 *
 * Achado real desta auditoria: EVOLUTION_API_URL apontava para um endereço
 * *.trycloudflare.com — o túnel rápido e gratuito da Cloudflare. Ele não é
 * infraestrutura: é o atalho que se usa para testar do próprio computador.
 *
 * Por ali passa o conteúdo das conversas dos clientes, com nome e telefone.
 * Três problemas ao mesmo tempo:
 *
 *   1. O endereço é público e o nome é sorteado a cada execução. Quando o
 *      processo local cai, o túnel morre e o WhatsApp para em silêncio — a
 *      URL guardada aponta para o nada.
 *   2. A ponta do túnel é uma máquina pessoal, não um servidor. Dado de
 *      terceiro trafegando para o PC de alguém não está em nenhuma política
 *      de privacidade, e não estaria certo se estivesse.
 *   3. A única barreira é o cabeçalho de chave. Endereço público sem rede
 *      privada na frente é uma superfície que não deveria existir.
 *
 * A guarda não conserta a hospedagem — isso custa dinheiro e é decisão de
 * quem paga. Ela impede que o problema entre em produção em silêncio, que é
 * exatamente como esse tipo de coisa vira incidente.
 */

describe("em produção, túnel de desenvolvimento é recusado", () => {
  for (const url of [
    "https://muze-wherever-width-presents.trycloudflare.com",
    "https://algo.ngrok.io",
    "https://algo.ngrok-free.app",
    "https://qualquer.loca.lt",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]) {
    it(`recusa ${new URL(url).hostname}`, () => {
      expect(problemaNoGateway(url, "production")).toBeTruthy();
    });
  }

  it("a mensagem diz o que está errado, não só que está errado", () => {
    const p = problemaNoGateway("https://x.trycloudflare.com", "production");
    expect(p).toContain("trycloudflare.com");
  });

  it("endereço de servidor de verdade passa", () => {
    expect(problemaNoGateway("https://evolution.nexora.app", "production")).toBeNull();
    expect(problemaNoGateway("https://evo-production-1a2b.up.railway.app", "production")).toBeNull();
  });
});

describe("em produção, o gateway precisa ser HTTPS", () => {
  it("http puro é recusado: a conversa do cliente vai em claro", () => {
    expect(problemaNoGateway("http://evolution.nexora.app", "production")).toBeTruthy();
  });

  it("https passa", () => {
    expect(problemaNoGateway("https://evolution.nexora.app", "production")).toBeNull();
  });
});

describe("fora de produção, o túnel é a ferramenta certa", () => {
  it("desenvolvimento aceita trycloudflare", () => {
    expect(problemaNoGateway("https://x.trycloudflare.com", "development")).toBeNull();
  });

  it("desenvolvimento aceita localhost em http", () => {
    expect(problemaNoGateway("http://localhost:8080", "development")).toBeNull();
  });
});

describe("entrada inútil não passa por acidente", () => {
  it("vazio é problema", () => {
    expect(problemaNoGateway("", "production")).toBeTruthy();
  });

  it("texto que não é URL é problema, e não explode", () => {
    expect(problemaNoGateway("nao-e-url", "production")).toBeTruthy();
  });
});
