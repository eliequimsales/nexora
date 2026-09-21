import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import {
  formatarDataLocal,
  formatarHoraLocal,
  gerarTextoLembrete,
  marcarLembreteEnviado,
  obterLembretes,
} from "@/lib/agenda/painel";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";
import { enviarWhatsApp } from "@/lib/whatsapp/envio";

export const dynamic = "force-dynamic";

const lembreteSchema = z.object({
  agendamentoId: z.string().optional(),
  emLote: z.boolean().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mensagemPersonalizada: z.string().max(2000).optional(),
});

/**
 * GET /api/agenda/lembrete
 * Retorna os clientes com agendamentos futuros (hoje ou data especificada)
 * e o status de envio de lembrete de cada um.
 */
export async function GET(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-lembrete-get", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const url = new URL(request.url);
    const dataParam = url.searchParams.get("data");
    const dataAlvo =
      dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)
        ? dataParam
        : formatarDataLocal(new Date());

    const [lembretes, perfil] = await Promise.all([
      obterLembretes(companyId, dataAlvo),
      prisma.companyProfile.findUnique({
        where: { companyId },
        select: { whatsappInstance: true, whatsappStatus: true },
      }),
    ]);

    const whatsappConectado =
      Boolean(perfil?.whatsappInstance) && perfil?.whatsappStatus === "CONNECTED";

    return NextResponse.json({
      ok: true,
      data: dataAlvo,
      total: lembretes.length,
      pendentes: lembretes.filter((l) => !l.lembreteEnviado).length,
      enviados: lembretes.filter((l) => l.lembreteEnviado).length,
      whatsappConectado,
      lembretes,
    });
  } catch (error) {
    await logError("agenda-lembrete-get", error, companyId);
    return NextResponse.json(
      { error: "Não consegui carregar os lembretes agora" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/agenda/lembrete
 * Dispara lembrete individual ou em lote.
 * Se o WhatsApp da empresa estiver conectado via Evolution API, envia de forma automática.
 * Se não estiver conectado, marca como enviado e retorna link para envio via WhatsApp Web/celular.
 */
export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  if (!limitar("agenda-lembrete-post", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const json = await request.json();
    const parsed = lembreteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const { agendamentoId, emLote, data, mensagemPersonalizada } = parsed.data;

    const perfil = await prisma.companyProfile.findUnique({
      where: { companyId },
      select: { whatsappInstance: true, whatsappStatus: true },
    });

    const whatsappConectado =
      Boolean(perfil?.whatsappInstance) && perfil?.whatsappStatus === "CONNECTED";

    const dataAlvo = data || formatarDataLocal(new Date());
    const todosLembretes = await obterLembretes(companyId, dataAlvo);

    if (emLote) {
      // Disparo em lote para todos os clientes ainda não lembrados
      const pendentes = todosLembretes.filter((l) => !l.lembreteEnviado);
      if (pendentes.length === 0) {
        return NextResponse.json({
          ok: true,
          enviados: 0,
          mensagem: "Todos os agendamentos desta data já receberam lembrete.",
        });
      }

      let enviadosComSucesso = 0;

      for (const item of pendentes) {
        const texto = mensagemPersonalizada || item.mensagemPronta;
        if (whatsappConectado && perfil?.whatsappInstance) {
          const comPais = variantesDeTelefone(item.telefone).find(
            (v) => v.startsWith("55") && v.length >= 12,
          );
          if (comPais) {
            try {
              await enviarWhatsApp(perfil.whatsappInstance, comPais, texto);
              await marcarLembreteEnviado(companyId, item.id);
              enviadosComSucesso++;
            } catch (err) {
              await logError("agenda-lembrete-lote-item", err, companyId);
            }
          }
        } else {
          // Sem WhatsApp conectado: marca como processado no painel
          await marcarLembreteEnviado(companyId, item.id);
          enviadosComSucesso++;
        }
      }

      return NextResponse.json({
        ok: true,
        enviados: enviadosComSucesso,
        whatsappConectado,
        mensagem: whatsappConectado
          ? `${enviadosComSucesso} lembrete(s) disparado(s) com sucesso pelo seu WhatsApp!`
          : `${enviadosComSucesso} lembrete(s) marcado(s) como prontos.`,
      });
    }

    // Disparo individual
    if (!agendamentoId) {
      return NextResponse.json(
        { error: "Informe o agendamentoId para envio individual" },
        { status: 400 },
      );
    }

    let itemAlvo = todosLembretes.find((l) => l.id === agendamentoId);

    if (!itemAlvo) {
      // Busca direto no banco caso a data enviada divirja do instante do agendamento
      const appt = await prisma.appointment.findFirst({
        where: { id: agendamentoId, companyId },
        include: {
          customer: true,
          service: true,
          company: { select: { name: true, profile: { select: { address: true } } } },
        },
      });

      if (!appt || !appt.customer) {
        return NextResponse.json(
          { error: "Agendamento não encontrado" },
          { status: 404 },
        );
      }

      const dataIso = formatarDataLocal(appt.startsAt);
      const horaStr = formatarHoraLocal(appt.startsAt);
      let profissionalNome = "Profissional";
      try {
        if (appt.notes && appt.notes.startsWith("{")) {
          const parsedNotes = JSON.parse(appt.notes);
          if (parsedNotes.profissional) profissionalNome = parsedNotes.profissional;
        }
      } catch {}

      const empresaNome = appt.company?.name || "Nosso Estabelecimento";
      const servicoNome = appt.service?.name || "Atendimento";
      const textoPronto = gerarTextoLembrete({
        clienteNome: appt.customer.name,
        dataIso,
        hora: horaStr,
        servicoNome,
        profissionalNome,
        empresaNome,
        endereco: appt.company?.profile?.address || undefined,
      });

      itemAlvo = {
        id: appt.id,
        clienteId: appt.customerId,
        nome: appt.customer.name,
        telefone: appt.customer.phone,
        servicoId: appt.serviceId,
        servicoNome,
        valorCents: appt.service?.priceCents ?? 0,
        duracaoMin: appt.service?.durationMin ?? 30,
        data: dataIso,
        horaInicio: horaStr,
        horaFim: formatarHoraLocal(appt.endsAt),
        horarioFormatado: `${horaStr} - ${formatarHoraLocal(appt.endsAt)}`,
        profissional: profissionalNome,
        status: appt.status,
        source: appt.source,
        observacoes: "",
        historicoVisitas: 0,
        cicloDias: 30,
        cicloConfianca: "baixa" as const,
        proximoRetornoEsperado: null,
        lembreteEnviado: false,
        lembreteEnviadoEm: null,
        lembreteStatus: "PENDENTE",
        mensagemPronta: textoPronto,
        whatsappUrl: `https://wa.me/55${appt.customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(textoPronto)}`,
      };
    }

    const textoFinal = mensagemPersonalizada || itemAlvo.mensagemPronta;

    if (whatsappConectado && perfil?.whatsappInstance) {
      const comPais = variantesDeTelefone(itemAlvo.telefone).find(
        (v) => v.startsWith("55") && v.length >= 12,
      );
      if (!comPais) {
        return NextResponse.json(
          { error: "Telefone do cliente com formato inválido para WhatsApp" },
          { status: 400 },
        );
      }

      await enviarWhatsApp(perfil.whatsappInstance, comPais, textoFinal);
      await marcarLembreteEnviado(companyId, itemAlvo.id);

      return NextResponse.json({
        ok: true,
        enviado: true,
        whatsappConectado: true,
        mensagem: "Lembrete enviado com sucesso pelo seu WhatsApp!",
      });
    }

    // Se o WhatsApp não estiver conectado, marca e devolve o link pronto
    await marcarLembreteEnviado(companyId, itemAlvo.id);
    return NextResponse.json({
      ok: true,
      enviado: false,
      whatsappConectado: false,
      whatsappUrl: itemAlvo.whatsappUrl,
      mensagem: "Abra a mensagem pronta no WhatsApp para enviar com 1 clique.",
    });
  } catch (error) {
    await logError("agenda-lembrete-post", error, companyId);
    return NextResponse.json(
      { error: "Não consegui processar o lembrete agora" },
      { status: 500 },
    );
  }
}
