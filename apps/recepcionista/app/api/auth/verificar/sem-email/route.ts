import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { podeLiberarSemEmail } from "@/lib/auth/verificacao";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { limitar } from "@/lib/limites";
import { emailConfigurado } from "@/lib/reengajamento/email";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * LIBERA A PRÓPRIA CONTA QUANDO NÃO HÁ COMO MANDAR E-MAIL.
 *
 * Autenticada, como o reenvio: age sempre sobre a conta da sessão, nunca sobre
 * um id vindo no corpo. Quem decide é `podeLiberarSemEmail` — com o Resend
 * ligado esta rota recusa, mesmo que a tela ainda esteja mostrando o botão de
 * uma página velha aberta há dez minutos.
 *
 * A liberação vai para o log. É o único registro de que esta conta entrou sem
 * provar o endereço, e é dele que a gente vai precisar no dia em que um
 * comprovante de compra não chegar a lugar nenhum.
 */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("verificar-sem-email", companyId, { limit: 5, windowMs: 60 * 60_000 })) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { emailVerificadoEm: true },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    if (
      !podeLiberarSemEmail({
        emailConfigurado: emailConfigurado(),
        jaVerificado: Boolean(empresa.emailVerificadoEm),
      })
    ) {
      return NextResponse.json(
        {
          error:
            "O envio de e-mail está ligado nesta instalação. Confirme pelo link " +
            "que chega na sua caixa de entrada.",
        },
        { status: 409 },
      );
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { emailVerificadoEm: new Date() },
    });

    await logError(
      "verificacao-liberada-sem-email",
      new Error(
        "Conta marcada como verificada sem prova de posse do e-mail: " +
          "RESEND_API_KEY/EMAIL_REMETENTE não configurados.",
      ),
      companyId,
    );

    return NextResponse.json({ ok: true });
  } catch (erro) {
    await logError("verificar-sem-email", erro, companyId);
    return NextResponse.json({ error: "Não consegui liberar agora" }, { status: 500 });
  }
}
