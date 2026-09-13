import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, hashPassword, setSessionCookie } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { signupSchema } from "@/lib/validation";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { respostaDeLimite, type Politica } from "@/lib/limites";

const IP: Politica = { limit: 5, windowMs: 15 * 60_000 };
import { abrirVerificacao, VALIDADE_HORAS } from "@/lib/auth/verificacao";
import { enviarEmail } from "@/lib/reengajamento/email";

export async function POST(request: Request) {
  try {
    if (!rateLimit(`signup:${clientIp(request)}`, IP)) return respostaDeLimite(IP);

    const body = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const { name, email, password, phone } = parsed.data;

    const existing = await prisma.company.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Já existe uma conta com este e-mail" }, { status: 409 });
    }

    const company = await prisma.company.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        // Grava DATA e VERSAO do que foi aceito. Sem a versao o registro e
        // inutil: o texto muda e ninguem sabe mais o que a pessoa leu.
        termosAceitosEm: new Date(),
        termosVersao: VERSAO_DOCUMENTOS,
        // O IP fecha o registro auditável do consentimento: QUANDO, QUAL texto
        // e DE ONDE. Sem ele, "a pessoa aceitou" é afirmação sem prova, e é
        // justamente a prova que a ANPD pede quando alguém contesta o aceite.
        // `clientIp` já devolve o último salto confiável do X-Forwarded-For.
        ipAceite: clientIp(request),
        profile: { create: {} },
      },
    });

    // A conta entra funcionando: bloquear o painel aqui mataria o primeiro
    // minuto do produto, que é onde o dono decide se fica. O que a verificação
    // trava é a COBRANÇA, em /api/billing/checkout.
    //
    // Falha de envio não derruba o cadastro nem vaza para a resposta: a pessoa
    // pode pedir outro link pelo painel, e um 500 aqui perderia a conta inteira
    // por causa do e-mail.
    try {
      const token = await abrirVerificacao(company.id);
      await enviarEmail(company.email, {
        assunto: "Confirme seu e-mail na Nexora",
        corpo:
          `${name}, falta um passo: confirmar que este e-mail é seu.

` +
          `Isso garante que você consiga recuperar a senha depois, e que o ` +
          `comprovante da assinatura chegue até você quando decidir assinar.

` +
          `O link abaixo vale por ${VALIDADE_HORAS} horas.`,
        acao: { texto: "Confirmar meu e-mail", href: `/verificar?token=${encodeURIComponent(token)}` },
      });
    } catch (erro) {
      await logError("signup-verificacao", erro, company.id);
    }

    setSessionCookie(await createSessionToken(company.id, company.sessaoEpoca));
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("auth-signup", error);
    return NextResponse.json({ error: "Erro ao criar conta" }, { status: 500 });
  }
}
