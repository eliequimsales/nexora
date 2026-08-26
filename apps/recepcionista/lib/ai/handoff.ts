function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gatilho determinístico de handoff: se a mensagem do cliente contém alguma
 * palavra/frase configurada pela empresa, transfere para humano ANTES de
 * chamar a IA (mais barato e mais confiável que depender do modelo).
 */
export function matchesHandoffKeyword(text: string, keywords: string[]): boolean {
  const normalizedText = normalize(text);
  if (!normalizedText) return false;
  return keywords.some((keyword) => {
    const normalizedKeyword = normalize(keyword);
    return normalizedKeyword.length > 0 && normalizedText.includes(normalizedKeyword);
  });
}
