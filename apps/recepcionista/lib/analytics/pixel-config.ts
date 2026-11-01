/** IDs entram em JavaScript/HTML de inicialização; somente o formato numérico é aceito. */
export function idsDoPixel(valores: Array<string | undefined>): string[] {
  return [...new Set(valores.flatMap(v => (v ?? "").split(",")).map(v => v.trim()).filter(v => /^\d{5,30}$/.test(v)))];
}
export function pixelSemJavascript(ids: string[]): string {
  return idsDoPixel(ids).map(id => `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&amp;ev=PageView&amp;noscript=1" alt="" />`).join("");
}
