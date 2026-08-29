import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { enviarEmail } from "@/lib/reengajamento/email";
import { abrirPedido, VALIDADE_MINUTOS } from "@/lib/senha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pedido de redefinição de senha.
 *
 * A resposta é SEMPRE a mesma, exista ou não a conta. Dizer "não encontramos
 * esse e-mail" transformaria esta rota num verificador de quais e-mails têm
 * conta na Nexora — e a lista de donos de negócio que usam a ferramenta é
 * exatamente o que um concorrente ou um golpista quer.
 */

const schema = z.object({ email: z.string().email().max(160) });

const MESMA_RESPOSTA = {
  ok: true,
  mensagem:
    "Se existir uma conta com esse e-mail, o link de redefinição já está a caminho. " +
    "Ele vale por 1 hora. Confere também a caixa de spam.",
};

export async function POST(request: Request) {
  // Limite por IP: sem ele, esta rota vira gerador de e-mail em massa a partir
  // de uma lista de endereços de terceiros.
  if (!rateLimit(`recuperar:${clientIp(request)}`, { limit: 5, windowMs: 15 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const empresa = await prisma.company.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    if (empresa) {
      const token = await abrirPedido(empresa.id);
      const appUrl = process.env.APP_URL ?? new URL(request.url).origin;

      // Sem link de descadastro: e-mail transacional não é comunicação de
      // marketing, e oferecer saída de algo que a pessoa não pode recusar só
      // confunde.
      const envio = await enviarEmail(empresa.email, {
        assunto: "Redefinir a senha da sua conta Nexora",
        corpo:
          `${empresa.name}, recebi um pedido para redefinir a senha da sua conta.\n\n` +
          `O link abaixo vale por ${VALIDADE_MINUTOS} minutos e só pode ser usado uma vez.\n\n` +
          `Se não foi você que pediu, pode ignorar este e-mail — sua senha continua a mesma ` +
          `e ninguém consegue entrar sem esse link.`,
        acao: {
          texto: "Criar uma senha nova",
          href: `/redefinir?token=${encodeURIComponent(token)}`,
        },
      });

      // Falha de envio não vaza para a resposta: revelaria que a conta existe.
      if (!envio.enviado) {
        await logError(
          "recuperar-senha-envio",
          new Error(envio.motivo ?? "falha ao enviar"),
          empresa.id,
        );
      }
    }

    return NextResponse.json(MESMA_RESPOSTA);
  } catch (erro) {
    await logError("recuperar-senha", erro);
    // Mesmo em erro interno, a resposta não muda de forma — a diferença entre
    // as respostas é o que um atacante usa para enumerar contas.
    return NextResponse.json(MESMA_RESPOSTA);
  }
}
