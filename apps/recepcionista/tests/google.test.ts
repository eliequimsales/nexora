import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRedirect } from "@/lib/google";

describe("appRedirect — redirects sempre no domínio público", () => {
  const original = process.env.APP_URL;
  beforeEach(() => {
    process.env.APP_URL = "https://recepcionista-production-2eea.up.railway.app";
  });
  afterEach(() => {
    process.env.APP_URL = original;
  });

  it("usa APP_URL e ignora o host interno do proxy (localhost:8080)", () => {
    const url = appRedirect("/painel", "http://localhost:8080/api/auth/google/callback");
    expect(url.origin).toBe("https://recepcionista-production-2eea.up.railway.app");
    expect(url.pathname).toBe("/painel");
  });

  it("preserva query strings", () => {
    expect(appRedirect("/login?erro=google", "http://localhost:8080").search).toBe("?erro=google");
  });

  it("cai no fallback quando APP_URL não está definido", () => {
    delete process.env.APP_URL;
    expect(appRedirect("/login", "https://exemplo.com/x").origin).toBe("https://exemplo.com");
  });
});
