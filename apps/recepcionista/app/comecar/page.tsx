import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  getSessionCompanyId,
} from "@/lib/auth";
import { logError } from "@/lib/errors";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { relogioDoCadastro } from "@/lib/billing/relogio";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * PÁGINA DE ENTRADA INSTANTÂNEA DIRETO NO PRODUTO (/comecar).
 *
 * O visitante clica no anúncio ou no CTA da Landing Page e entra imediatamente
 * no Painel do Atendente (/painel/atendente), sem passar por formulários.
 */
export default async function ComecarPage() {
  // 1. Se já tem sessão válida, vai direto ao painel sem duplicar conta
  try {
    const existingCompanyId = await getSessionCompanyId();
    if (existingCompanyId) {
      redirect("/painel/atendente");
    }
  } catch (e: unknown) {
    const err = e as { digest?: string };
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw e;
  }

  // 2. Proteção contra flood de criação por IP
  const reqHeaders = headers();
  const xff = reqHeaders.get("x-forwarded-for") ?? undefined;
  const dummyReq = new Request("https://localhost", {
    headers: xff ? { "x-forwarded-for": xff } : {},
  });
  const ip = clientIp(dummyReq);

  if (!rateLimit(`comecar:${ip}`, { limit: 10, windowMs: 15 * 60_000 })) {
    redirect("/cadastro?erro=limite");
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

    redirect("/painel/atendente?origem=instantaneo");
  } catch (error: unknown) {
    const err = error as { digest?: string };
    if (err?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    await logError("comecar-page", error);
    redirect("/cadastro?erro=comecar");
  }
}
