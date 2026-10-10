/**
 * DEFESA DE ORIGEM E PROTEÇÃO ANTI-CSRF / CROSS-SITE.
 *
 * Valida cabeçalhos de origem (Origin, Referer, Sec-Fetch-Site) e tipo de conteúdo (Content-Type)
 * para mutações sensíveis no servidor, impedindo que scripts ou formulários em sites
 * terceiros façam submissões contra a sessão do usuário ou logins falsos.
 */

import { NextResponse } from "next/server";

const DOMINIOS_PERMITIDOS = new Set([
  "meunexora.com.br",
  "www.meunexora.com.br",
]);

function extrairHost(urlStr: string | null): string | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

function hostPermitido(hostAlvo: string, hostRequisicao: string | null): boolean {
  const alvoLimpo = hostAlvo.split(":")[0];
  const reqLimpo = hostRequisicao ? hostRequisicao.split(":")[0].toLowerCase() : null;

  // Mesma origem da requisição atual
  if (reqLimpo && alvoLimpo === reqLimpo) return true;

  // Domínios oficiais de produção
  if (DOMINIOS_PERMITIDOS.has(alvoLimpo)) return true;

  // Desenvolvimento local
  if (alvoLimpo === "localhost" || alvoLimpo === "127.0.0.1") return true;

  // Ambientes de preview/staging na Railway
  if (alvoLimpo.endsWith(".railway.app")) return true;

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

  const hostReq = request.headers.get("x-forwarded-host") || request.headers.get("host");

  const origin = request.headers.get("origin");
  if (origin) {
    const hostOrigin = extrairHost(origin);
    if (!hostOrigin || !hostPermitido(hostOrigin, hostReq)) {
      return false;
    }
    return true;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    const hostReferer = extrairHost(referer);
    if (!hostReferer || !hostPermitido(hostReferer, hostReq)) {
      return false;
    }
    return true;
  }

  // Requisições sem Origin e sem Referer (ex: chamadas diretas por curl ou testes programáticos)
  return true;
}

/**
 * Valida se o Content-Type é application/json para endpoints que esperam JSON.
 * Impede que formulários HTML de navegadores (form-urlencoded, multipart, text/plain)
 * façam submissões sem preflight.
 */
export function exigeJson(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType) return true;
  return contentType.includes("application/json");
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
