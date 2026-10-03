import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionCompanyId, hashPassword } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { respostaDeLimite, type Politica } from "@/lib/limites";
import { abrirVerificacao, VALIDADE_HORAS } from "@/lib/auth/verificacao";
import { enviarEmail } from "@/lib/reengajamento/email";

export const dynamic = "force-dynamic";

const IP: Politica = { limit: 10, windowMs: 15 * 60_000 };

const salvarContaSchema = z.object({
  email: z.string().email("E-mail inválido").max(100),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(100),
  name: z.string().min(2, "Nome da empresa muito curto").max(100).optional(),
});

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!rateLimit(`salvar-conta:${clientIp(request)}`, IP)) {
    return respostaDeLimite(IP);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = salvarContaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const { email, password, name } = parsed.data;

    // Confere se outra conta já usa este e-mail
    const existente = await prisma.company.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existente && existente.id !== companyId) {
      return NextResponse.json(
        { error: "Já existe uma conta cadastrada com este e-mail" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.company.update({
      where: { id: companyId },
      data: {
        email,
        passwordHash,
        ...(name ? { name } : {}),
      },
    });

    // Envia verificação de e-mail de forma resiliente
    try {
      const token = await abrirVerificacao(companyId);
      await enviarEmail(email, {
        assunto: "Confirme seu e-mail na Nexora",
        corpo:
          `Falta um passo para proteger sua conta: confirmar que este e-mail é seu.\n\n` +
          `O link abaixo vale por ${VALIDADE_HORAS} horas.`,
        acao: { texto: "Confirmar meu e-mail", href: `/verificar?token=${encodeURIComponent(token)}` },
      });
    } catch (erro) {
      await logError("salvar-conta-verificacao", erro, companyId);
    }

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    await logError("salvar-conta", error, companyId);
    return NextResponse.json({ error: "Erro ao salvar conta" }, { status: 500 });
  }
}
