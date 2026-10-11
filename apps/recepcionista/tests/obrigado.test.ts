import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaginaObrigado, { metadata, viewport } from "@/app/obrigado/page";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("continuação pública com a Sofia", () => {
  it("não confirma compra nem libera acesso em uma visita direta", () => {
    const html = renderToStaticMarkup(createElement(PaginaObrigado));
    expect(html).toContain("Vamos continuar com a Sofia.");
    expect(html).toContain(
      "Se você já comprou, tenha a confirmação da compra em mãos.",
    );
    expect(html).not.toMatch(
      /pagamento confirmado|compra aprovada|acesso liberado|já está pronto/i,
    );
  });

  it("parâmetros de retorno forjados não viram confirmação de pagamento", () => {
    const props = {
      searchParams: { ok: "1", pago: "true", session_id: "cs_inventada" },
    };
    const html = renderToStaticMarkup(createElement(PaginaObrigado, props));
    expect(html).toBe(renderToStaticMarkup(createElement(PaginaObrigado)));
  });

  it("abre uma única conversa pelo número configurado, sem alegar compra na mensagem", () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_DEMO", "5511999999999");
    const html = renderToStaticMarkup(createElement(PaginaObrigado));
    const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(hrefs).toHaveLength(1);
    const url = new URL(hrefs[0]);
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/5511999999999");
    expect(url.searchParams.get("text")).toBe(
      "Oi Sofia, quero ajuda com meu acesso ao guia Anti-Vácuo.",
    );
    expect(html).toContain("Conversar com a Sofia no WhatsApp");
  });

  it("começa em três segundos, com pausa acessível e opção de abrir manualmente", () => {
    const html = renderToStaticMarkup(createElement(PaginaObrigado));
    expect(html).toContain("Tentaremos abrir o WhatsApp em 3 segundos.");
    expect(html).toContain("Pausar abertura automática");
    expect(html).toContain('role="status"');
    const cliente = readFileSync(
      join(__dirname, "../app/obrigado/continuar-com-sofia.tsx"),
      "utf8",
    );
    expect(cliente).toContain("if (pausado || tentouAbrir) return;");
    expect(cliente).toContain("window.clearTimeout(timer)");
  });

  it("não promete tempo de resposta e permite zoom sem indexar a página de retorno", () => {
    const html = renderToStaticMarkup(createElement(PaginaObrigado));
    expect(html).not.toMatch(
      /responde na hora|resposta em 3 segundos|criptografado de ponta a ponta/i,
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(viewport.userScalable).toBe(true);
    expect(viewport.maximumScale).toBeGreaterThan(1);
  });
});
