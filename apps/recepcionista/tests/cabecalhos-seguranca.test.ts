import { describe, expect, it } from "vitest";
import nextConfig from "../next.config.mjs";

/**
 * CABEÇALHOS DE SEGURANÇA (CSP, HSTS, X-Frame-Options, etc.).
 *
 * Trava sem teste é intenção, não garantia: se alguém alterar ou apagar
 * next.config.mjs amanhã, este teste impede o enfraquecimento da blindagem
 * do site inteiro.
 */

describe("cabeçalhos de resposta de segurança (next.config.mjs)", () => {
  it("define headers para todas as rotas (/:path*)", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    if (!nextConfig.headers) throw new Error("nextConfig.headers indefinido");
    const regras = await nextConfig.headers();
    expect(Array.isArray(regras)).toBe(true);

    const regraGlobal = regras.find((r) => r.source === "/:path*");
    expect(regraGlobal).toBeDefined();
    expect(Array.isArray(regraGlobal?.headers)).toBe(true);
  });

  async function obterCabecalhos(): Promise<Record<string, string>> {
    if (!nextConfig.headers) throw new Error("nextConfig.headers indefinido");
    const regras = await nextConfig.headers();
    const regraGlobal = regras.find((r) => r.source === "/:path*");
    const mapa: Record<string, string> = {};
    for (const h of regraGlobal?.headers || []) {
      mapa[h.key] = h.value;
    }
    return mapa;
  }

  it("HSTS (Strict-Transport-Security) está ativo e com validade mínima de 1 ano", async () => {
    const headers = await obterCabecalhos();
    const hsts = headers["Strict-Transport-Security"];
    expect(hsts).toBeDefined();
    expect(hsts).toContain("includeSubDomains");

    const match = hsts?.match(/max-age=(\d+)/);
    expect(match).toBeTruthy();
    const maxAge = Number(match?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000); // Mínimo 1 ano
  });

  it("CSP (Content-Security-Policy) blinda contra XSS, clickjacking e exfiltração", async () => {
    const headers = await obterCabecalhos();
    const csp = headers["Content-Security-Policy"];
    expect(csp).toBeDefined();

    // Default restrito à própria origem
    expect(csp).toContain("default-src 'self'");

    // Anti-clickjacking robusto
    expect(csp).toContain("frame-ancestors 'none'");

    // Impede plugins legados perigosos (Flash, Java)
    expect(csp).toContain("object-src 'none'");

    // Conexões e formulários restritos à própria origem (impede envio de dados roubados)
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");

    // Força HTTPS
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("X-Frame-Options está configurado como DENY", async () => {
    const headers = await obterCabecalhos();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("X-Content-Type-Options está configurado como nosniff", async () => {
    const headers = await obterCabecalhos();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("Referrer-Policy protege a privacidade dos links", async () => {
    const headers = await obterCabecalhos();
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("Permissions-Policy bloqueia acesso a hardware sensível sem necessidade", async () => {
    const headers = await obterCabecalhos();
    const pp = headers["Permissions-Policy"];
    expect(pp).toBeDefined();
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  it("Desabilita pré-resolução de DNS e cross-domain policies", async () => {
    const headers = await obterCabecalhos();
    expect(headers["X-DNS-Prefetch-Control"]).toBe("off");
    expect(headers["X-Permitted-Cross-Domain-Policies"]).toBe("none");
  });
});
