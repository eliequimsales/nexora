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
import { obterPresetDoRamo } from "@/lib/onboarding/presets";

export const dynamic = "force-dynamic";

/**
 * ROTA DE ENTRADA INSTANTÂNEA DIRETO NO PRODUTO (SEM CADASTRO, SEM FRICÇÃO).
 *
 * Como Route Handler, tem permissão nativa do Next.js para emitir cookies
 * de sessão diretamente na resposta HTTP.
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const { searchParams } = new URL(request.url);
  const empresaParam = searchParams.get("empresa")?.trim();
  const telefoneParam = searchParams.get("telefone")?.trim();
  const ramoParam = searchParams.get("ramo")?.trim();

  // 1. Se já tem sessão válida ativa:
  try {
    const existingCompanyId = await getSessionCompanyId();
    if (existingCompanyId) {
      if (ramoParam) {
        const countServices = await prisma.service.count({ where: { companyId: existingCompanyId } });
        if (countServices === 0) {
          const preset = obterPresetDoRamo(ramoParam);
          await prisma.company.update({
            where: { id: existingCompanyId },
            data: {
              ...(empresaParam ? { name: empresaParam } : { name: preset.nomeEmpresa }),
              profile: {
                update: {
                  atendenteNome: preset.atendenteNome,
                  description: preset.description,
                  address: preset.endereco,
                  paymentMethods: preset.pagamento,
                  serviceRules: preset.serviceRules,
                },
              },
            },
          });
          await prisma.service.createMany({
            data: preset.servicos.map((s, idx) => ({
              companyId: existingCompanyId,
              name: s.name,
              durationMin: s.durationMin,
              priceCents: s.priceCents,
              order: idx,
              active: true,
            })),
          });
          await prisma.knowledgeItem.createMany({
            data: preset.duvidas.map((d) => ({
              companyId: existingCompanyId,
              question: d.question,
              answer: d.answer,
              source: "TRAINING",
              status: "APPROVED",
              approvedAt: new Date(),
            })),
          });
        }
      }
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
    const hasPreset = Boolean(ramoParam);
    const preset = hasPreset ? obterPresetDoRamo(ramoParam) : null;
    const nomeEmpresa = empresaParam && empresaParam.length <= 100 ? empresaParam : (preset ? preset.nomeEmpresa : "Minha Empresa");
    const telefoneEmpresa = telefoneParam && telefoneParam.length <= 25 ? telefoneParam.replace(/[^\d+() -]/g, "") : "";

    const randomHex = randomBytes(8).toString("hex");
    const tempEmail = `convidado_${randomHex}@temporario.meunexora.com.br`;
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await hashPassword(randomPassword);

    const company = await prisma.company.create({
      data: {
        name: nomeEmpresa,
        email: tempEmail,
        phone: telefoneEmpresa,
        passwordHash,
        termosAceitosEm: new Date(),
        termosVersao: VERSAO_DOCUMENTOS,
        ipAceite: ip,
        trialEndsAt: relogioDoCadastro(VERSAO_DOCUMENTOS, new Date()),
        profile: {
          create: preset
            ? {
                atendenteNome: preset.atendenteNome,
                description: preset.description,
                address: preset.endereco,
                paymentMethods: preset.pagamento,
                serviceRules: preset.serviceRules,
              }
            : {},
        },
      },
      select: { id: true, sessaoEpoca: true },
    });

    // Cria serviços inteligentes de referência do segmento
    if (preset && preset.servicos.length > 0) {
      await prisma.service.createMany({
        data: preset.servicos.map((s, idx) => ({
          companyId: company.id,
          name: s.name,
          durationMin: s.durationMin,
          priceCents: s.priceCents,
          order: idx,
          active: true,
        })),
      });
    }

    // Cria conhecimento inicial do atendente (aprovado) para responder na hora
    if (preset && preset.duvidas.length > 0) {
      await prisma.knowledgeItem.createMany({
        data: preset.duvidas.map((d) => ({
          companyId: company.id,
          question: d.question,
          answer: d.answer,
          source: "TRAINING",
          status: "APPROVED",
          approvedAt: new Date(),
        })),
      });
    }

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
