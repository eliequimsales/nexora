import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";

export const PRECO_MANUAL_CENTS = 2_700;

/** Link exclusivo do guia. Os planos do atendente têm outra cobrança. */
export function obterCompraManual(linkConfigurado?: string) {
  try {
    const url = new URL(linkConfigurado?.trim() ?? "");
    if (url.protocol === "https:" && !url.username && !url.password) {
      return { href: url.href, pagamentoDisponivel: true };
    }
  } catch {
    // Sem pagamento configurado, oferecemos contato, nunca uma compra fictícia.
  }

  return {
    href: obterLinkWhatsAppDemo(
      "Oi Sofia, tenho interesse no guia Anti-Vácuo de R$ 27. Como posso comprar e receber o material?",
    ),
    pagamentoDisponivel: false,
  };
}
