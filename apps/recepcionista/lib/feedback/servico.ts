/**
 * Serviço de captura e entrega de feedback da Nexora.
 *
 * Envia as mensagens e avaliações diretamente para o e-mail oficial
 * dos fundadores (nexora.iabusiness@gmail.com) com reply-to configurado
 * para o e-mail do cliente, permitindo resposta com 1 clique.
 */

import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import type { CategoriaFeedback, FeedbackDados, ResultadoFeedback } from "./tipos";

export const EMAIL_FEEDBACK = "nexora.iabusiness@gmail.com";

export const CATEGORIAS_LABEL: Record<CategoriaFeedback, string> = {
  sugestao: "Sugestão / Ideia",
  problema: "Dificuldade / Problema",
  duvida: "Dúvida",
  elogio: "Elogio",
  outro: "Outro",
};

export function ratingParaTexto(r: number): string {
  switch (r) {
    case 5:
      return "⭐⭐⭐⭐⭐ (5/5 - Excelente)";
    case 4:
      return "⭐⭐⭐⭐ (4/5 - Muito bom)";
    case 3:
      return "⭐⭐⭐ (3/5 - Regular)";
    case 2:
      return "⭐⭐ (2/5 - Abaixo do esperado)";
    case 1:
      return "⭐ (1/5 - Precisa melhorar muito)";
    default:
      return `${r}/5`;
  }
}

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function montarHtmlFeedback(dados: FeedbackDados, dataIso: string): string {
  const ratingTexto = ratingParaTexto(dados.rating);
  const categoriaTexto = CATEGORIAS_LABEL[dados.categoria] ?? dados.categoria;
  const mensagemFormatada = escapar(dados.mensagem).replace(/\n/g, "<br>");

  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#0d0d12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#f3f4f6;">
  <div style="max-width:600px;margin:0 auto;background:#16161f;border:1px solid #2a2a38;border-radius:14px;padding:32px;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
    
    <div style="display:flex;align-items:center;margin-bottom:24px;border-bottom:1px solid #2a2a38;padding-bottom:16px;">
      <div style="width:36px;height:36px;line-height:36px;text-align:center;background:#0A0A0F;color:#EAB308;border:1px solid #EAB308;border-radius:8px;font-weight:800;font-size:18px;margin-right:12px;display:inline-block;">N</div>
      <div style="display:inline-block;vertical-align:middle;">
        <h2 style="margin:0;font-size:18px;color:#ffffff;font-weight:700;">Novo Feedback Recebido — Nexora</h2>
        <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">Data: ${dataIso}</p>
      </div>
    </div>

    <div style="background:#1f1f2e;border:1px solid #374151;border-radius:10px;padding:16px;margin-bottom:20px;">
      <div style="margin-bottom:8px;">
        <span style="font-size:12px;text-transform:uppercase;color:#9ca3af;font-weight:600;">Avaliação:</span>
        <div style="font-size:16px;color:#fbbf24;font-weight:700;margin-top:2px;">${ratingTexto}</div>
      </div>
      <div>
        <span style="font-size:12px;text-transform:uppercase;color:#9ca3af;font-weight:600;">Categoria:</span>
        <div style="font-size:14px;color:#e5e7eb;font-weight:600;margin-top:2px;">${escapar(categoriaTexto)}</div>
      </div>
    </div>

    <div style="margin-bottom:24px;">
      <span style="font-size:12px;text-transform:uppercase;color:#9ca3af;font-weight:600;">Mensagem do Cliente:</span>
      <div style="margin-top:8px;padding:16px;background:#0d0d12;border-left:4px solid #EAB308;border-radius:6px;font-size:15px;line-height:1.6;color:#ffffff;">
        ${mensagemFormatada}
      </div>
    </div>

    <div style="border-top:1px solid #2a2a38;padding-top:18px;margin-top:24px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#9ca3af;text-transform:uppercase;font-weight:600;">Dados de Contato & Contexto:</h3>
      <table style="width:100%;font-size:13px;color:#d1d5db;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;width:120px;color:#9ca3af;">Cliente / Empresa:</td>
          <td style="padding:6px 0;font-weight:600;color:#ffffff;">${escapar(dados.companyName || dados.nomeCliente || "Não informado")}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#9ca3af;">E-mail:</td>
          <td style="padding:6px 0;"><a href="mailto:${escapar(dados.email)}" style="color:#60a5fa;text-decoration:none;">${escapar(dados.email)}</a> (clique para responder)</td>
        </tr>
        ${dados.whatsapp ? `<tr><td style="padding:6px 0;color:#9ca3af;">WhatsApp:</td><td style="padding:6px 0;">${escapar(dados.whatsapp)}</td></tr>` : ""}
        ${dados.pagina ? `<tr><td style="padding:6px 0;color:#9ca3af;">Página:</td><td style="padding:6px 0;color:#9ca3af;">${escapar(dados.pagina)}</td></tr>` : ""}
        ${dados.companyId ? `<tr><td style="padding:6px 0;color:#9ca3af;">ID da Empresa:</td><td style="padding:6px 0;font-family:monospace;color:#9ca3af;">${escapar(dados.companyId)}</td></tr>` : ""}
      </table>
    </div>

    <div style="margin-top:28px;text-align:center;border-top:1px solid #2a2a38;padding-top:16px;">
      <a href="mailto:${escapar(dados.email)}?subject=Re:%20Feedback%20Nexora" style="display:inline-block;background:#EAB308;color:#0A0A0F;text-decoration:none;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;">
        Responder ao Cliente Agora →
      </a>
    </div>

  </div>
</body>
</html>`;
}

export function montarTextoPuroFeedback(dados: FeedbackDados, dataIso: string): string {
  const ratingTexto = ratingParaTexto(dados.rating);
  const categoriaTexto = CATEGORIAS_LABEL[dados.categoria] ?? dados.categoria;

  return `[NOVO FEEDBACK - NEXORA]
Data: ${dataIso}

Avaliação: ${ratingTexto}
Categoria: ${categoriaTexto}

Mensagem:
${dados.mensagem}

---
Dados do Cliente:
Empresa/Nome: ${dados.companyName || dados.nomeCliente || "Não informado"}
E-mail: ${dados.email}
${dados.whatsapp ? `WhatsApp: ${dados.whatsapp}\n` : ""}${dados.pagina ? `Página: ${dados.pagina}\n` : ""}${dados.companyId ? `ID Empresa: ${dados.companyId}\n` : ""}
Para responder, envie um e-mail diretamente para: ${dados.email}
`;
}

export async function enviarFeedback(dados: FeedbackDados): Promise<ResultadoFeedback> {
  const dataIso = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  // 1. Sempre gravamos em log estruturado no banco para garantir que nenhum feedback se perca
  try {
    await prisma.errorLog.create({
      data: {
        context: "feedback-cliente",
        message: JSON.stringify({
          rating: dados.rating,
          categoria: dados.categoria,
          mensagem: dados.mensagem,
          email: dados.email,
          whatsapp: dados.whatsapp,
          companyName: dados.companyName,
          companyId: dados.companyId,
          pagina: dados.pagina,
          data: dataIso,
        }),
        companyId: dados.companyId ?? null,
      },
    });
  } catch (erroDb) {
    console.error("[feedback] Falha ao persistir feedback no log:", erroDb);
  }

  // 2. Se o Resend estiver configurado, enviamos por e-mail para nexora.iabusiness@gmail.com
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailRemetente = process.env.EMAIL_REMETENTE;

  if (!resendApiKey || !emailRemetente) {
    console.info(
      `[feedback] Resend não configurado no ambiente. Feedback gravado no banco para ${EMAIL_FEEDBACK}.`,
    );
    return { enviado: true, motivo: "salvo-no-banco-sem-resend" };
  }

  const categoriaTexto = CATEGORIAS_LABEL[dados.categoria] ?? dados.categoria;
  const nomeRemetente = dados.companyName || dados.nomeCliente || dados.email;
  const assunto = `[Feedback Nexora] ${categoriaTexto} (${dados.rating}★) - ${nomeRemetente}`;

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailRemetente,
        to: [EMAIL_FEEDBACK],
        reply_to: dados.email,
        subject: assunto,
        html: montarHtmlFeedback(dados, dataIso),
        text: montarTextoPuroFeedback(dados, dataIso),
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      await logError("feedback-envio-resend", new Error(`Status ${resposta.status}: ${detalhe}`));
      return { enviado: false, motivo: `resend-${resposta.status}` };
    }

    return { enviado: true };
  } catch (erro) {
    await logError("feedback-envio-falha", erro);
    return { enviado: false, motivo: "falha-conexao-resend" };
  }
}
