/**
 * Envio de e-mail.
 *
 * Feito com `fetch` direto na API do Resend, sem SDK: uma dependência a mais no
 * bundle para montar um POST de três campos não se paga, e trocar de provedor
 * aqui é reescrever uma função.
 *
 * Degrada em silêncio de propósito. Sem RESEND_API_KEY o motor continua rodando
 * e apenas não envia — o produto não pode parar de funcionar porque a régua de
 * e-mail não está configurada.
 */

import type { Toque } from "./motor";

export type Envio = { enviado: boolean; motivo?: string };

export function emailConfigurado(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE);
}

/** Escapa texto do usuário antes de entrar no HTML do e-mail. */
function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function montarHtml(
  toque: Mensagem,
  appUrl: string,
  urlDescadastro: string | undefined,
): string {
  const paragrafos = toque.corpo
    .split("\n\n")
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#16150F;">${escapar(
          p,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#FAF8F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;padding:32px;">
    <div style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:#0A0A0F;color:#EAB308;border-radius:9px;font-weight:800;font-size:18px;">N</div>
    <div style="height:24px"></div>
    ${paragrafos}
    <a href="${appUrl}${toque.acao.href}" style="display:inline-block;margin-top:8px;background:#EAB308;color:#16150F;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:11px;">${escapar(
      toque.acao.texto,
    )}</a>
    ${
      urlDescadastro
        ? `<p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#8F8973;">
      Você recebe este e-mail porque criou uma conta na Nexora.
      <a href="${urlDescadastro}" style="color:#8F8973;">Não quero mais receber</a>.
    </p>`
        : ""
    }
  </div>
</body></html>`;
}

/** O que todo e-mail precisa ter: assunto, corpo e UMA ação. */
export type Mensagem = Pick<Toque, "assunto" | "corpo" | "acao">;

/**
 * `urlDescadastro` é opcional de propósito.
 *
 * E-mail transacional — redefinir senha, recibo, aviso de cobrança — NÃO leva
 * link de descadastro: ele não é comunicação de marketing, e oferecer saída de
 * algo que a pessoa não pode recusar confunde e ainda faz ela sair da régua
 * achando que está resolvendo outra coisa.
 */
export async function enviarEmail(
  para: string,
  toque: Mensagem,
  urlDescadastro?: string,
): Promise<Envio> {
  if (!emailConfigurado()) return { enviado: false, motivo: "email-nao-configurado" };

  const appUrl = process.env.APP_URL ?? "";

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_REMETENTE,
      to: [para],
      subject: toque.assunto,
      html: montarHtml(toque, appUrl, urlDescadastro),
      // Texto puro junto: e-mail só-HTML tem nota pior de spam, e a régua toda
      // depende de chegar na caixa de entrada.
      text:
        `${toque.corpo}\n\n${toque.acao.texto}: ${appUrl}${toque.acao.href}` +
        (urlDescadastro ? `\n\nNão quero mais receber: ${urlDescadastro}` : ""),
      ...(urlDescadastro
        ? { headers: { "List-Unsubscribe": `<${urlDescadastro}>` } }
        : {}),
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    return { enviado: false, motivo: `resend-${resposta.status}: ${detalhe.slice(0, 200)}` };
  }

  return { enviado: true };
}
