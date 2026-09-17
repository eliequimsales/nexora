import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { capturarUtmsDaUrl, obterUtmsSalvas } from "@/lib/analytics/utm";
import {
  ehPixelAtivo,
  track,
  trackCustom,
  trackPageView,
  trackViewContent,
  trackStartRegistration,
  trackCompleteRegistration,
  trackFirstClientAdded,
  trackFirstRecoverySent,
  trackInitiateCheckout,
  trackPurchase,
} from "@/lib/analytics/pixel";

describe("Meta Pixel em ambiente Node / SSR", () => {
  it("trata ausência de window com segurança e sem erros", () => {
    expect(ehPixelAtivo()).toBe(false);
    expect(() => track("PageView")).not.toThrow();
    expect(() => trackCustom("UsedCalculator")).not.toThrow();
    expect(capturarUtmsDaUrl()).toBeNull();
    expect(obterUtmsSalvas()).toBeNull();
  });
});

describe("Meta Pixel e UTMs em ambiente de navegador (simulado)", () => {
  let sessionStore: Record<string, string> = {};
  let localStore: Record<string, string> = {};
  const mockSessionStorage = {
    getItem: (k: string) => sessionStore[k] || null,
    setItem: (k: string, v: string) => { sessionStore[k] = v; },
    clear: () => { sessionStore = {}; },
  };
  const mockLocalStorage = {
    getItem: (k: string) => localStore[k] || null,
    setItem: (k: string, v: string) => { localStore[k] = v; },
    clear: () => { localStore = {}; },
  };

  beforeEach(() => {
    sessionStore = {};
    localStore = {};
    (global as any).window = {
      location: new URL("https://nexora.app/?utm_source=facebook&utm_campaign=anuncio_teste&fbclid=fb_999&c=video1"),
      sessionStorage: mockSessionStorage,
      localStorage: mockLocalStorage,
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it("captura UTMs da URL e persiste no armazenamento", () => {
    const utms = capturarUtmsDaUrl();
    expect(utms).toEqual({
      utm_source: "facebook",
      utm_campaign: "anuncio_teste",
      fbclid: "fb_999",
      criativo: "video1",
    });

    const recuperadas = obterUtmsSalvas();
    expect(recuperadas).toEqual(utms);
  });

  it("dispara window.fbq('track', ...) com os parâmetros padrão e enriquecidos com UTMs", () => {
    const mockFbq = vi.fn();
    (global as any).window.fbq = mockFbq;

    capturarUtmsDaUrl();

    trackPageView();
    expect(mockFbq).toHaveBeenCalledWith("track", "PageView", expect.objectContaining({
      utm_source: "facebook",
      utm_campaign: "anuncio_teste",
    }));

    trackViewContent("Landing Page");
    expect(mockFbq).toHaveBeenCalledWith("track", "ViewContent", expect.objectContaining({
      content_name: "Landing Page",
      utm_source: "facebook",
    }));

    trackCompleteRegistration("email");
    expect(mockFbq).toHaveBeenCalledWith("track", "CompleteRegistration", expect.objectContaining({
      status: true,
      content_name: "email",
    }));
    expect(mockFbq).toHaveBeenCalledWith("track", "Lead", expect.objectContaining({
      content_name: "Cadastro Criado",
    }));

    trackInitiateCheckout("mensal_cartao", "R$ 97,00");
    expect(mockFbq).toHaveBeenCalledWith("track", "InitiateCheckout", expect.objectContaining({
      content_name: "mensal_cartao",
      currency: "BRL",
      value: 97,
    }));

    trackPurchase(97.0, "mensal_cartao");
    expect(mockFbq).toHaveBeenCalledWith("track", "Purchase", expect.objectContaining({
      value: 97.0,
      currency: "BRL",
      content_name: "mensal_cartao",
    }));
  });

  it("dispara window.fbq('trackCustom', ...) para eventos personalizados do funil", () => {
    const mockFbq = vi.fn();
    (global as any).window.fbq = mockFbq;

    trackCustom("UsedCalculator", { ramo: "barbearia" });
    expect(mockFbq).toHaveBeenCalledWith("trackCustom", "UsedCalculator", expect.objectContaining({
      ramo: "barbearia",
    }));

    trackStartRegistration();
    expect(mockFbq).toHaveBeenCalledWith("trackCustom", "StartRegistration", expect.any(Object));

    trackFirstClientAdded("lista");
    expect(mockFbq).toHaveBeenCalledWith("trackCustom", "FirstClientAdded", expect.objectContaining({
      content_category: "lista",
    }));

    trackFirstRecoverySent();
    expect(mockFbq).toHaveBeenCalledWith("trackCustom", "FirstRecoverySent", expect.objectContaining({
      content_name: "WhatsApp Reversao",
    }));
  });
});
