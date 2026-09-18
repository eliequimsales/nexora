import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { exigirAcesso } from "@/lib/billing/guarda";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";
import { sendWhatsAppText } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

const enviarSchema = z.object({
  clienteId: z.string().min(1),
  toque: z.number().int().min(1).max(4),
  esteira: z.enum(["PRE_ATRASO", "ATRASO", "RESGATE"]),
  mensagem: z.string().min(1).max(4000),
});

/**
 * DISPARO DIRETO DA ONDA
 *
 * Envia a mensagem de recuperação selecionada direto pelo WhatsApp conectado
 * do próprio dono e salva no mesmo instante o status AGUARDANDO no banco.
 *
 * Sem extensão, sem copiar e colar, com auto-registro imediato no servidor.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("onda-enviar", companyId, LIMITES.pesado)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  // Trava de assinatura: envio de mensagens exige plano ou período de teste ativo
  const barrado = await exigirAcesso(companyId, "ENVIAR_TOQUE");
  if (barrado) return barrado;

  try {
    const json = await request.json();
    const parsed = enviarSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const { clienteId, toque, esteira, mensagem } = parsed.data;

    // 1. Verifica a conexão do WhatsApp da empresa
    const perfil = await prisma.companyProfile.findUnique({
      where: { companyId },
      select: { whatsappInstance: true, whatsappStatus: true },
    });

    if (!perfil?.whatsappInstance || perfil.whatsappStatus !== "CONNECTED") {
      return NextResponse.json(
        {
          error: "Seu WhatsApp ainda não está ligado. Conecte seu aparelho para enviar direto pelo sistema.",
          precisaConectar: true,
        },
        { status: 400 },
      );
    }

    // 2. Busca o cliente
    const cliente = await prisma.customer.findFirst({
      where: { id: clienteId, companyId },
      select: { id: true, name: true, phone: true, optOut: true },
    });

    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    if (cliente.optOut) {
      return NextResponse.json(
        { error: "Este cliente pediu para não receber mensagens." },
        { status: 400 },
      );
    }

    // 3. Normaliza o telefone para o padrão exigido pelo WhatsApp (55 + DDD + número)
    const comPais = variantesDeTelefone(cliente.phone).find(
      (v) => v.startsWith("55") && v.length >= 12,
    );

    if (!comPais) {
      return NextResponse.json(
        { error: "Telefone do cliente não possui formato válido para WhatsApp." },
        { status: 400 },
      );
    }

    // 4. Dispara a mensagem via Evolution API pelo número do dono
    await sendWhatsAppText(perfil.whatsappInstance, comPais, mensagem.trim());

    // 5. Auto-registro: salva o status AGUARDANDO no banco de dados
    const pendente = await prisma.recoveryTouch.findFirst({
      where: { companyId, customerId: clienteId, touchNumber: toque, outcome: "AGUARDANDO" },
      orderBy: { sentAt: "desc" },
      select: { id: true },
    });

    let touchId: string;
    if (pendente) {
      const atualizado = await prisma.recoveryTouch.update({
        where: { id: pendente.id },
        data: {
          esteira,
          sentAt: new Date(),
          outcome: "AGUARDANDO",
          outcomeAt: null,
        },
        select: { id: true },
      });
      touchId = atualizado.id;
    } else {
      const novo = await prisma.recoveryTouch.create({
        data: {
          companyId,
          customerId: clienteId,
          touchNumber: toque,
          esteira,
          outcome: "AGUARDANDO",
          sentAt: new Date(),
          outcomeAt: null,
        },
        select: { id: true },
      });
      touchId = novo.id;
    }

    return NextResponse.json({
      ok: true,
      touchId,
      status: "AGUARDANDO",
      efeito: "Mensagem enviada com sucesso! Aguardando resposta do cliente.",
    });
  } catch (error) {
    await logError("onda-enviar", error, companyId);
    return NextResponse.json(
      { error: "Não consegui enviar a mensagem pelo WhatsApp agora. Tenta de novo?" },
      { status: 500 },
    );
  }
}
