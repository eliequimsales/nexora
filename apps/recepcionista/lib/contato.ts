/**
 * O CANAL DE SOCORRO — e a regra de só prometer o que existe.
 *
 * Três telas prometiam "me manda do jeito que estiver que eu converto na mão":
 * a landing, o painel do diagnóstico e o erro 422 da rota. Em todo o app não
 * havia um único `wa.me` fora de `lib/recuperacao/convite.ts`. A promessa não
 * tinha porta.
 *
 * E ela quebrava com o lead MAIS motivado que existe: o que tentou, não
 * conseguiu, e leu que alguém ajudaria.
 *
 * Mesmo desenho de `lib/legal/identidade.ts`: enquanto o número não estiver
 * preenchido, a frase simplesmente NÃO APARECE. Promessa só existe quando o
 * canal existe — e o build não deixa esquecer, porque o teste verifica que
 * nenhuma tela escreve a frase à mão.
 *
 * PREENCHER COM O NÚMERO DO WHATSAPP BUSINESS DA NEXORA, nunca com o número
 * pessoal de quem atende: o número pessoal é a agenda inteira da pessoa, e é
 * exatamente o risco que o produto passa o dia inteiro dizendo para o cliente
 * não correr.
 *
 * Formato: só dígitos, com país e DDD. Ex.: "5511988887777".
 */
const WHATSAPP_SUPORTE = "";

const SO_DIGITOS = /^55\d{10,11}$/;

export function temCanalDeSocorro(): boolean {
  return SO_DIGITOS.test(WHATSAPP_SUPORTE);
}

/** A frase, ou null quando não há canal. Nunca escreva isto à mão numa tela. */
export const FRASE_SOCORRO =
  "Se estiver difícil, me manda do jeito que estiver que eu converto na mão.";

/**
 * Link pronto, com a mensagem já escrita — para ele não ter que explicar do
 * zero justamente no momento em que já está frustrado.
 */
export function linkDeSocorro(contexto?: string): string | null {
  if (!temCanalDeSocorro()) return null;
  const texto = contexto
    ? `Oi! Tentei usar a Nexora e travei em: ${contexto}`
    : "Oi! Tentei fazer o diagnóstico da Nexora e travei. Consegue me ajudar?";
  return `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(texto)}`;
}
