import { describe, expect, it } from "vitest";
import { verificarOrigemPermitida, exigeJson, validarOrigemECsrfe } from "../lib/seguranca/origem";

describe("Proteção de Origem e Anti-CSRF (lib/seguranca/origem.ts)", () => {
  it("aprova requisições da mesma origem (same-origin)", () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/login", {
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://www.meunexora.com.br",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(true);
  });

  it("aprova requisições em localhost em desenvolvimento", () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(true);
  });

  it("rejeita requisições com sec-fetch-site cross-site", () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/login", {
      headers: {
        host: "www.meunexora.com.br",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(false);
  });

  it("rejeita requisições vindas de origem de atacante (evil.com)", () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/login", {
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://evil.com",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(false);

    const res = validarOrigemECsrfe(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("rejeita referer externo de atacante", () => {
    const req = new Request("https://www.meunexora.com.br/api/auth/login", {
      headers: {
        host: "www.meunexora.com.br",
        referer: "https://malicious-site.com/attack.html",
      },
    });
    expect(verificarOrigemPermitida(req)).toBe(false);
  });

  it("valida obrigatoriedade de Content-Type application/json", () => {
    const reqForm = new Request("https://www.meunexora.com.br/api/auth/login", {
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://www.meunexora.com.br",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    expect(exigeJson(reqForm)).toBe(false);
    const resForm = validarOrigemECsrfe(reqForm, { exigirJson: true });
    expect(resForm?.status).toBe(415);

    const reqJson = new Request("https://www.meunexora.com.br/api/auth/login", {
      headers: {
        host: "www.meunexora.com.br",
        origin: "https://www.meunexora.com.br",
        "content-type": "application/json; charset=utf-8",
      },
    });
    expect(exigeJson(reqJson)).toBe(true);
    expect(validarOrigemECsrfe(reqJson, { exigirJson: true })).toBeNull();
  });
});
