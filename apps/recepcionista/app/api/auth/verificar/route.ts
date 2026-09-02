import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { abrirVerificacao, VALIDADE_HORAS } from "@/lib/auth/verificacao";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { enviarEmail } from "@/lib/reengajamento/email";
import { clientIp, rateLimit, TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * REENVIO do link de verificação.
 *
 * Autenticada de propósito: só quem já está dentro da conta pede outro link, e
 * ele sempre vai para o e-mail cadastrado — nunca para um endereço informado
 * na requisição. Sem isso, esta rota viraria uma máquina de mandar e-mail em
 * nome da Nexora para qualquer endereço.
 *
 * Teto duplo: por conta (não adianta trocar de IP) e por IP (não adianta abrir
 * várias contas).
 */
const schema = z.object({}).optional();

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (
    !limitar("verificar-reenvio", companyId, { limit: 5, windowMs: 30 * 60_000 }) ||
    !rateLimit(`verificar-ip:${clientIp(request)}`, { limit: 20, windowMs: 30 * 60_000 })
  ) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    schema.parse(undefined);

    const empresa = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, email: true, emailVerificadoEm: true },
    });
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

    // Já verificado: responde ok sem mandar nada. Não é erro, e reenviar
    // confundiria quem já resolveu.
    if (empresa.emailVerificadoEm) return NextResponse.json({ ok: true, jaVerificado: true });

    const token = await abrirVerificacao(companyId);
    await enviarEmail(empresa.email, {
      assunto: "Confirme seu e-mail na Nexora",
      corpo:
        `${empresa.name}, aqui está o link para confirmar que este e-mail é seu.\n\n` +
        `Ele vale por ${VALIDADE_HORAS} horas, e o link anterior deixou de valer agora.`,
      acao: {
        texto: "Confirmar meu e-mail",
        href: `/verificar?token=${encodeURIComponent(token)}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (erro) {
    await logError("verificar-reenvio", erro, companyId);
    return NextResponse.json({ error: "Não consegui reenviar agora" }, { status: 500 });
  }
}
