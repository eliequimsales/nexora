/**
 * META PIXEL (FACEBOOK PIXEL) - DISPARO SEGURO DE EVENTOS
 *
 * Envelopa window.fbq para que qualquer chamada em ambiente SSR, teste,
 * ou navegador com ad blocker execute silenciosamente sem quebrar o sistema.
 */

import { obterUtmsSalvas } from "./utm";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function ehPixelAtivo(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Dispara evento padrão da Meta (ex.: PageView, CompleteRegistration, Lead, Purchase, InitiateCheckout).
 */
export function track(evento: string, parametros?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  try {
    const utms = obterUtmsSalvas() || {};
    const payload = { ...utms, ...parametros };

    if (ehPixelAtivo()) {
      window.fbq!("track", evento, payload);
    } else {
      // Em desenvolvimento ou antes do script carregar, log silencioso
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[MetaPixel] track "${evento}":`, payload);
      }
    }
  } catch {
    // Métrica nunca derruba o app
  }
}

/**
 * Dispara evento personalizado no Meta Pixel (ex.: StartRegistration, FirstClientAdded, UsedCalculator).
 */
export function trackCustom(evento: string, parametros?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  try {
    const utms = obterUtmsSalvas() || {};
    const payload = { ...utms, ...parametros };

    if (ehPixelAtivo()) {
      window.fbq!("trackCustom", evento, payload);
    } else {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log(`[MetaPixel] trackCustom "${evento}":`, payload);
      }
    }
  } catch {
    // Métrica nunca derruba o app
  }
}

// ---------------------------------------------------------------------------
// Helpers para os eventos principais do funil da Nexora
// ---------------------------------------------------------------------------

export function trackPageView(): void {
  track("PageView");
}

export function trackViewContent(nomeConteudo: string, extra?: Record<string, unknown>): void {
  track("ViewContent", { content_name: nomeConteudo, ...extra });
}

export function trackStartRegistration(): void {
  trackCustom("StartRegistration");
}

export function trackCompleteRegistration(metodo: string = "email"): void {
  track("CompleteRegistration", { status: true, content_name: metodo });
  // Dispara Lead junto para maximizar compatibilidade com campanhas otimizadas para Lead
  track("Lead", { content_name: "Cadastro Criado" });
}

export function trackFirstClientAdded(metodo: "manual" | "lista" = "manual"): void {
  trackCustom("FirstClientAdded", { content_category: metodo });
}

export function trackFirstRecoverySent(): void {
  trackCustom("FirstRecoverySent", { content_name: "WhatsApp Reversao" });
}

export function trackInitiateCheckout(plano: string, preco?: string): void {
  track("InitiateCheckout", {
    content_name: plano,
    currency: "BRL",
    value: plano.includes("anual") ? 970 : 97,
    price_label: preco,
  });
}

export function trackPurchase(valorReais: number = 97.0, plano: string = "pro_mensal"): void {
  track("Purchase", {
    value: valorReais,
    currency: "BRL",
    content_name: plano,
    content_type: "product",
  });
}
