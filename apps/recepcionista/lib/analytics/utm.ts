/**
 * CAPTURA E PERSISTÊNCIA DE PARÂMETROS UTM E FBCLID
 *
 * Salva a origem da visita (campanha, criativo, anúncio) no navegador para que,
 * quando o visitante navegar entre as páginas e finalmente se cadastrar, a conta
 * dele no banco de dados e os eventos do Meta Pixel saibam exatamente qual
 * anúncio converteu.
 */

export type ParametrosUtm = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  criativo?: string;
};

const CHAVE_STORAGE = "nx_utm_params";

function ehAmbienteNavegador(): boolean {
  return typeof window !== "undefined" && typeof window.location !== "undefined";
}

/**
 * Lê os parâmetros da URL atual e persiste se houver alguma UTM ou fbclid.
 */
export function capturarUtmsDaUrl(): ParametrosUtm | null {
  if (!ehAmbienteNavegador()) return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const utms: ParametrosUtm = {};

    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    const content = params.get("utm_content");
    const term = params.get("utm_term");
    const fbclid = params.get("fbclid");
    const criativo = params.get("c");

    if (source) utms.utm_source = source.slice(0, 100);
    if (medium) utms.utm_medium = medium.slice(0, 100);
    if (campaign) utms.utm_campaign = campaign.slice(0, 100);
    if (content) utms.utm_content = content.slice(0, 100);
    if (term) utms.utm_term = term.slice(0, 100);
    if (fbclid) utms.fbclid = fbclid.slice(0, 150);
    if (criativo) utms.criativo = criativo.slice(0, 50);

    if (Object.keys(utms).length > 0) {
      salvarUtms(utms);
      return utms;
    }

    return obterUtmsSalvas();
  } catch {
    return null;
  }
}

/**
 * Salva as UTMs no sessionStorage e localStorage.
 */
export function salvarUtms(utms: ParametrosUtm): void {
  if (!ehAmbienteNavegador()) return;
  try {
    const json = JSON.stringify({ ...utms, timestamp: Date.now() });
    window.sessionStorage?.setItem(CHAVE_STORAGE, json);
    window.localStorage?.setItem(CHAVE_STORAGE, json);
  } catch {
    // Storage bloqueado
  }
}

/**
 * Devolve as UTMs capturadas anteriormente na sessão ou no armazenamento local.
 */
export function obterUtmsSalvas(): ParametrosUtm | null {
  if (!ehAmbienteNavegador()) return null;
  try {
    const bruto =
      window.sessionStorage?.getItem(CHAVE_STORAGE) ||
      window.localStorage?.getItem(CHAVE_STORAGE);
    if (!bruto) return null;
    const parsed = JSON.parse(bruto);
    return {
      utm_source: parsed.utm_source,
      utm_medium: parsed.utm_medium,
      utm_campaign: parsed.utm_campaign,
      utm_content: parsed.utm_content,
      utm_term: parsed.utm_term,
      fbclid: parsed.fbclid,
      criativo: parsed.criativo,
    };
  } catch {
    return null;
  }
}
