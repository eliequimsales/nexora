import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, getSessionCompanyId, hashPassword, setSessionCookie } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { respostaDeLimite, type Politica } from "@/lib/limites";
import { abrirVerificacao, VALIDADE_HORAS } from "@/lib/auth/verificacao";
import { enviarEmail } from "@/lib/reengajamento/email";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";

export const dynamic = "force-dynamic";

const IP: Politica = { limit: 10, windowMs: 15 * 60_000 };

const salvarContaSchema = z.object({
  email: z.string().email("E-mail inválido").max(100),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(100),
  name: z.string().min(2, "Nome da empresa muito curto").max(100).optional(),
});

export async function POST(request: Request) {
  const erroOrigem = validarOrigemECsrfe(request, { exigirJson: true });
  if (erroOrigem) return erroOrigem;

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
    const emailDestino = email.trim().toLowerCase();
    if (emailDestino.endsWith("@temporario.meunexora.com.br")) {
      return NextResponse.json(
        { error: "O e-mail definitivo deve ser um endereço de e-mail real" },
        { status: 400 },
      );
    }

    // Garante no servidor que apenas contas temporárias (guest) podem usar esta rota
    const atual = await prisma.company.findUnique({
      where: { id: companyId },
      select: { email: true, sessaoEpoca: true },
    });
    if (!atual) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    const emailAtual = atual.email?.trim().toLowerCase() ?? "";
    const ehContaConvidado = emailAtual.endsWith("@temporario.meunexora.com.br");
    if (!ehContaConvidado) {
      return NextResponse.json(
        { error: "Esta conta já é permanente. Para alterar a senha, utilize as configurações de segurança ou recuperação de senha." },
        { status: 403 },
      );
    }

    // Confere se outra conta já usa este e-mail
    const existente = await prisma.company.findUnique({
      where: { email: emailDestino },
      select: { id: true },
    });
    if (existente && existente.id !== companyId) {
      return NextResponse.json(
        { error: "Já existe uma conta cadastrada com este e-mail" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    // Transição atômica condicionada ao estado e época observados.
    // Impede que duas requisições concorrentes promovam ou substituam credenciais em sequência:
    // a primeira vence e a segunda encontra count === 0.
    const transicao = await prisma.company.updateMany({
      where: {
        id: companyId,
        sessaoEpoca: atual.sessaoEpoca,
        email: atual.email,
      },
      data: {
        email: emailDestino,
        passwordHash,
        emailVerificadoEm: null,
        sessaoEpoca: { increment: 1 },
        ...(name ? { name: name.trim() } : {}),
      },
    });

    if (transicao.count === 0) {
      return NextResponse.json(
        { error: "Esta conta já foi promovida ou modificada por outra requisição simultânea" },
        { status: 409 },
      );
    }

    const atualizada = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { id: true, sessaoEpoca: true },
    });

    // Emite nova sessão com a nova época
    setSessionCookie(await createSessionToken(atualizada.id, atualizada.sessaoEpoca));

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
