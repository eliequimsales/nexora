/**
 * CANAL DE DEMONSTRAÇÃO DIRETA NO WHATSAPP
 *
 * Permite que leads testem o Atendente Virtual ao vivo no próprio WhatsApp antes
 * de criarem conta ou preencherem qualquer formulário.
 *
 * Pequeno empresário no Brasil compra conversando: ao mandar um "Oi" e receber
 * resposta imediata demonstrando agilidade, atendimento noturno e agendamento,
 * a fricção de conversão cai a quase zero.
 */

export const WHATSAPP_DEMO_DEFAULT_NUMBER = "5521966106737";
export const WHATSAPP_DEMO_DEFAULT_TEXT =
  "Oi! Vi o anúncio da Nexora e quero ver como ela atenderia na minha empresa.";

export function limparNumeroWhatsApp(bruto: string | null | undefined): string | null {
  const limpo = (bruto ?? "").replace(/\D/g, "");
  if (!/^55\d{10,11}$/.test(limpo)) return null;
  return limpo;
}

export function obterLinkWhatsAppDemo(textoCustomizado?: string): string {
  const envNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_DEMO ||
    process.env.NEXT_PUBLIC_WHATSAPP_SUPORTE ||
    WHATSAPP_DEMO_DEFAULT_NUMBER;

  const numeroValido = limparNumeroWhatsApp(envNumber) ?? WHATSAPP_DEMO_DEFAULT_NUMBER;
  const texto = textoCustomizado ?? WHATSAPP_DEMO_DEFAULT_TEXT;

  return `https://wa.me/${numeroValido}?text=${encodeURIComponent(texto)}`;
}
