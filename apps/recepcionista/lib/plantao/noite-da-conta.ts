import { prisma } from "@/lib/db";
import { horarioDaEmpresa, lerDiasFechados } from "@/lib/agenda/horario";
import { inicioDaSemana } from "@/lib/billing/implantacao";
import {
  calcularGatilhoDaNoite,
  type GatilhoDaNoite,
  type MensagemClienteNoite,
} from "./noite";

/**
 * Consulta o banco da empresa para extrair mensagens recebidas da semana
 * e calcular as métricas do Gatilho da Noite (Fase 0 do Plantão).
 */
export async function gatilhoDaNoiteDaEmpresa(
  companyId: string,
  agora: Date = new Date(),
): Promise<GatilhoDaNoite> {
  const [empresa, perfil] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { createdAt: true },
    }),
    prisma.companyProfile.findUnique({
      where: { companyId },
      select: {
        whatsappStatus: true,
        whatsappInstance: true,
        businessHours: true,
        diasFechados: true,
      },
    }),
  ]);

  const whatsappConectado =
    Boolean(perfil?.whatsappInstance) && perfil?.whatsappStatus === "CONNECTED";
  const horarios = horarioDaEmpresa(perfil?.businessHours);
  const diasFechados = lerDiasFechados(perfil?.diasFechados);

  // Semana de vida da conta
  const criadaEm = empresa?.createdAt ?? agora;
  const semana = Math.max(1, Math.ceil((agora.getTime() - criadaEm.getTime()) / (7 * 86_400_000)));

  if (!whatsappConectado) {
    return calcularGatilhoDaNoite({
      mensagens: [],
      horarios,
      diasFechados,
      whatsappConectado: false,
      semana,
      agora,
    });
  }

  const inicio = inicioDaSemana(agora);

  const conversas = await prisma.conversation.findMany({
    where: {
      companyId,
      updatedAt: { gte: inicio },
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      status: true,
      donoAssumiuEm: true,
      messages: {
        where: {
          createdAt: { gte: inicio },
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const mensagensCliente: MensagemClienteNoite[] = [];

  for (const conv of conversas) {
    const msgsCliente = conv.messages.filter((m) => m.role === "CUSTOMER");
    for (const mc of msgsCliente) {
      const respondidaDepois = conv.messages.some(
        (m) =>
          (m.role === "HUMAN" || m.role === "AI") &&
          m.createdAt.getTime() > mc.createdAt.getTime(),
      );
      const donoRespondeu =
        Boolean(conv.donoAssumiuEm) &&
        conv.donoAssumiuEm!.getTime() >= mc.createdAt.getTime();
      const finalizada = conv.status === "FINISHED";

      mensagensCliente.push({
        id: mc.id,
        clienteNome: conv.customerName,
        clienteTelefone: conv.customerPhone,
        recebidaEm: mc.createdAt,
        respondida: respondidaDepois || donoRespondeu || finalizada,
      });
    }
  }

  return calcularGatilhoDaNoite({
    mensagens: mensagensCliente,
    horarios,
    diasFechados,
    whatsappConectado: true,
    semana,
    agora,
  });
}
