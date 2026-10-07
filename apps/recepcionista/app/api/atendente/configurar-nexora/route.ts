import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCompanyId } from "@/lib/auth";
import { obterPresetDoRamo } from "@/lib/onboarding/presets";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { connectWhatsApp } from "@/lib/whatsapp/instance";

export const dynamic = "force-dynamic";

const HORARIOS_24H_ONLINE = [
  { day: 0, open: "00:00", close: "00:00", closed: true },
  { day: 1, open: "00:00", close: "00:00", closed: true },
  { day: 2, open: "00:00", close: "00:00", closed: true },
  { day: 3, open: "00:00", close: "00:00", closed: true },
  { day: 4, open: "00:00", close: "00:00", closed: true },
  { day: 5, open: "00:00", close: "00:00", closed: true },
  { day: 6, open: "00:00", close: "00:00", closed: true },
];

/**
 * ROTA PARA CONFIGURAÇÃO IMEDIATA DA NEXORA COMERCIAL NO BANCO
 *
 * Aplica o preset de demonstração, 24h de resposta instantânea e
 * ativação do número de WhatsApp da Nexora.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("configurar-nexora", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const preset = obterPresetDoRamo("nexora");
  const agora = new Date();

  // 1. Atualiza dados da empresa e perfil (plano ativo ilimitado + plantão 24h ativo)
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: "Nexora",
      phone: "5521966106737",
      subscriptionStatus: "active",
      profile: {
        upsert: {
          create: {
            atendenteNome: preset.atendenteNome,
            atendenteJeito: "ACOLHEDOR",
            plantaoAtivo: true,
            atendenteExpediente: true,
            atendenteLigadoPrimeiraVezEm: agora,
            atendenteTestadoEm: agora,
            description: preset.description,
            address: preset.endereco,
            paymentMethods: preset.pagamento,
            serviceRules: preset.serviceRules,
            businessHours: HORARIOS_24H_ONLINE,
          },
          update: {
            atendenteNome: preset.atendenteNome,
            atendenteJeito: "ACOLHEDOR",
            plantaoAtivo: true,
            atendenteExpediente: true,
            atendenteLigadoPrimeiraVezEm: agora,
            atendenteTestadoEm: agora,
            description: preset.description,
            address: preset.endereco,
            paymentMethods: preset.pagamento,
            serviceRules: preset.serviceRules,
            businessHours: HORARIOS_24H_ONLINE,
          },
        },
      },
    },
  });

  // 2. Garante os serviços oficiais da Nexora
  const servicosExistentes = await prisma.service.findMany({
    where: { companyId },
  });

  if (servicosExistentes.length === 0) {
    await prisma.service.createMany({
      data: preset.servicos.map((s, idx) => ({
        companyId,
        name: s.name,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        order: idx,
        active: true,
      })),
    });
  }

  // 3. Cadastra as dúvidas e regras aprovadas da Nexora
  for (const d of preset.duvidas) {
    const jaTem = await prisma.knowledgeItem.findFirst({
      where: { companyId, question: d.question },
    });
    if (!jaTem) {
      await prisma.knowledgeItem.create({
        data: {
          companyId,
          question: d.question,
          answer: d.answer,
          source: "TRAINING",
          status: "APPROVED",
          approvedAt: agora,
        },
      });
    }
  }

  // 4. Inicia conexão com Evolution API para gerar Código de Pareamento e QR Code
  let whatsappState = null;
  try {
    whatsappState = await connectWhatsApp(companyId, "5521966106737");
  } catch (err) {
    console.error("[configurar-nexora] Erro ao conectar WhatsApp:", err);
  }

  return NextResponse.json({
    ok: true,
    message: "Conta da Nexora configurada com sucesso com regras, planos e respostas de conversão!",
    whatsapp: whatsappState,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
