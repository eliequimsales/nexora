import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  getSessionCompanyId,
  SESSION_COOKIE,
} from "@/lib/auth";
import { logError } from "@/lib/errors";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { relogioDoCadastro } from "@/lib/billing/relogio";
import { appRedirect } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * ROTA DE ENTRADA INSTANTÂNEA DIRETO NO PRODUTO (SEM CADASTRO, SEM FRICÇÃO).
 *
 * Como Route Handler, tem permissão nativa do Next.js para emitir cookies
 * de sessão diretamente na resposta HTTP.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);

  // 1. Se já tem sessão válida ativa, entra direto nela sem criar conta duplicada
  try {
    const existingCompanyId = await getSessionCompanyId();
    if (existingCompanyId) {
      return NextResponse.redirect(appRedirect("/painel/atendente", request.url));
    }
  } catch {
    // Se cookie estiver inválido, prossegue para criar nova sessão isolada
  }

  // 2. Proteção contra flood de criação por IP (máx 10 contas a cada 15 min por IP)
  if (!rateLimit(`comecar:${ip}`, { limit: 10, windowMs: 15 * 60_000 })) {
    return NextResponse.redirect(appRedirect("/cadastro?erro=limite", request.url));
  }

  try {
    const randomHex = randomBytes(8).toString("hex");
    const tempEmail = `convidado_${randomHex}@temporario.meunexora.com.br`;
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await hashPassword(randomPassword);

    const company = await prisma.company.create({
      data: {
        name: "Minha Empresa",
        email: tempEmail,
        phone: "",
        passwordHash,
        termosAceitosEm: new Date(),
        termosVersao: VERSAO_DOCUMENTOS,
        ipAceite: ip,
        trialEndsAt: relogioDoCadastro(VERSAO_DOCUMENTOS, new Date()),
        profile: { create: {} },
      },
      select: { id: true, sessaoEpoca: true },
    });

    const token = await createSessionToken(company.id, company.sessaoEpoca);
    setSessionCookie(token);

    const redirectUrl = appRedirect("/painel/atendente?origem=instantaneo", request.url);
    const response = NextResponse.redirect(redirectUrl);

    // Garante cabeçalho Set-Cookie na resposta HTTP
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    await logError("comecar-instantaneo", error);
    return NextResponse.redirect(appRedirect("/cadastro?erro=comecar", request.url));
  }
}
