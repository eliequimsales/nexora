/**
 * DEFESA DE ORIGEM E PROTEÇÃO ANTI-CSRF / CROSS-SITE.
 *
 * Valida cabeçalhos de origem (Origin, Referer, Sec-Fetch-Site, Sec-Fetch-Mode) e tipo de conteúdo
 * (Content-Type) para mutações sensíveis no servidor, impedindo que scripts ou formulários em sites
 * terceiros façam submissões contra a sessão do usuário ou logins falsos.
 *
 * Em conformidade com OWASP Cross-Site Request Forgery Prevention Cheat Sheet:
 * - Validação estrita de Origin e Referer contra domínios exatos autorizados.
 * - Verificação de Fetch Metadata (Sec-Fetch-Site, Sec-Fetch-Mode).
 * - Validação estrita do MIME type (Content-Type exato application/json, sem submissões de formulário cego).
 */

import { NextResponse } from "next/server";

const DOMINIOS_PERMITIDOS = new Set([
  "meunexora.com.br",
  "www.meunexora.com.br",
]);

function extrairOrigem(urlStr: string | null): { protocol: string; host: string; hostname: string; port: string } | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    return {
      protocol: parsed.protocol.toLowerCase(),
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
      port: parsed.port,
    };
  } catch {
    return null;
  }
}

function origemPermitida(
  origem: { protocol: string; host: string; hostname: string; port: string },
): boolean {
  const emProducao = process.env.NODE_ENV === "production";

  // 1. Em produção, o protocolo DEVE ser https
  if (emProducao && origem.protocol !== "https:") {
    return false;
  }

  // 2. Desenvolvimento local (localhost / 127.0.0.1)
  if (origem.hostname === "localhost" || origem.hostname === "127.0.0.1") {
    if (emProducao) {
      return false;
    }
    return true;
  }

  // 3. Domínios oficiais de produção exatos (porta padrão 443 ou vazia)
  if (DOMINIOS_PERMITIDOS.has(origem.hostname)) {
    if (origem.port && origem.port !== "443" && origem.port !== "") {
      return false;
    }
    return true;
  }

  // 4. Se houver APP_URL configurado no ambiente, confere com a origem exata dele (esquema, host e porta)
  if (process.env.APP_URL) {
    try {
      const appUrlParsed = new URL(process.env.APP_URL);
      if (
        origem.protocol === appUrlParsed.protocol.toLowerCase() &&
        origem.host === appUrlParsed.host.toLowerCase()
      ) {
        return true;
      }
    } catch {
      // url inválida
    }
  }

  return false;
}

/**
 * Confere se a origem da requisição é legítima (Same-Origin).
 */
export function verificarOrigemPermitida(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  // Se o navegador reporta cross-site explicitamente, rejeita imediatamente
  if (secFetchSite === "cross-site") {
    return false;
  }

  // Se o navegador reporta modo de navegação em uma requisição de API, rejeita
  const secFetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase();
  if (secFetchMode === "navigate") {
    return false;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    const parsedOrigin = extrairOrigem(originHeader);
    if (!parsedOrigin || !origemPermitida(parsedOrigin)) {
      return false;
    }
    return true;
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    const parsedReferer = extrairOrigem(refererHeader);
    if (!parsedReferer || !origemPermitida(parsedReferer)) {
      return false;
    }
    return true;
  }

  // Se não tem nem Origin nem Referer:
  // Se houver sinal Sec-Fetch-Site diferente de "same-origin", rejeita
  if (secFetchSite && secFetchSite !== "same-origin") {
    return false;
  }

  // Em produção, se a requisição porta cookies de sessão, exige sinal comprovado de origem
  if (process.env.NODE_ENV === "production") {
    const cookie = request.headers.get("cookie");
    if (cookie && cookie.includes("rd_session")) {
      return false;
    }
  }

  return true;
}

/**
 * Valida se o Content-Type é application/json para endpoints que esperam JSON.
 * A essência do tipo MIME deve ser estritamente "application/json".
 * Impede que formulários HTML de navegadores (form-urlencoded, multipart, text/plain)
 * façam submissões sem preflight.
 */
export function exigeJson(request: Request): boolean {
  const rawContentType = request.headers.get("content-type");
  if (!rawContentType) return false;
  const mime = rawContentType.split(";")[0].trim().toLowerCase();
  return mime === "application/json";
}

/**
 * Guarda central para handlers de mutação: valida origem e tipo de conteúdo.
 * Retorna NextResponse de erro (403 ou 415) se inválido, ou null se aprovado.
 */
export function validarOrigemECsrfe(
  request: Request,
  opcoes?: { exigirJson?: boolean },
): Response | null {
  if (!verificarOrigemPermitida(request)) {
    return NextResponse.json(
      { error: "Requisição rejeitada por segurança: origem cruzada não permitida." },
      { status: 403 },
    );
  }

  if (opcoes?.exigirJson && !exigeJson(request)) {
    return NextResponse.json(
      { error: "Content-Type inválido: esperado application/json." },
      { status: 415 },
    );
  }

  return null;
}
