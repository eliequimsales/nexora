import { prisma } from "@/lib/db";
import { hashTelefone } from "@/lib/dados/excluir";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";
import { ehConflitoDeConcorrencia } from "./concorrencia";
import { calcularSlots } from "./disponibilidade";
import { entradaPorLink } from "./entrada-publica";
import { horarioDaEmpresa, lerDiasFechados } from "./horario";
import { ANTECEDENCIA_MINUTOS } from "./livres";
import { extrairProfissional, formatarDataLocal, formatarHoraLocal, listarProfissionais } from "./painel";

/**
 * A MARCAÇÃO — UMA SÓ, PARA A PÁGINA PÚBLICA E PARA O ATENDENTE VIRTUAL.
 *
 * Antes ela morava dentro da rota pública. Com o Atendente marcando pelo
 * WhatsApp, duas cópias da mesma regra seriam duas definições de "livre", e a
 * primeira divergência entre elas é dois clientes na mesma cadeira.
 *
 * A MARCAÇÃO INTEIRA NUMA TRANSAÇÃO SERIALIZÁVEL. Checar e só depois criar
 * deixava uma janela em que outra requisição pegava o mesmo horário — não existe
 * constraint no banco para impedir. Constraint única em (companyId, startsAt)
 * não serviria: agendamento CANCELADO ou FALTOU libera o horário. Serializável
 * resolve sem mentir sobre o domínio: o Postgres aborta a transação perdedora,
 * que vira o mesmo "ocupado" de sempre.
 *
 * O que a marcação pode escrever na lista do dono segue `entradaPorLink`:
 * cliente que já existe não é reescrito, e quem está na supressão entra sem
 * receber mensagem.
 *
 * No simulador (`simulacao: true`), só confere se o horário continua livre:
 * nada é criado.
 */

export type PedidoDeMarcacao = {
  companyId: string;
  servico: { id: string | null; nome: string; duracaoMin: number };
  inicio: Date;
  /** null é "primeiro disponível". */
  profissional: string | null;
  cliente: { nome: string; telefone: string };
  origem: "LINK" | "ATENDENTE";
  simulacao?: boolean;
  agora?: Date;
};

export type ResultadoDaMarcacao =
  | {
      ok: true;
      profissional: string;
      inicio: Date;
      fim: Date;
      appointmentId: string | null;
      clienteId: string | null;
    }
  | { ok: false; motivo: "OCUPADO" };

const OCUPADO: ResultadoDaMarcacao = { ok: false, motivo: "OCUPADO" };

/** Sinaliza, de dentro da transação, que o horário foi ocupado no caminho. */
class HorarioOcupado extends Error {}

type Leitor = Pick<typeof prisma, "appointment">;

export async function marcarNaAgenda(p: PedidoDeMarcacao): Promise<ResultadoDaMarcacao> {
  const agora = p.agora ?? new Date();
  const dia = formatarDataLocal(p.inicio);
  const hora = formatarHoraLocal(p.inicio);
  const diaData = new Date(`${dia}T00:00:00.000Z`);
  const fim = new Date(p.inicio.getTime() + p.servico.duracaoMin * 60_000);

  const perfil = await prisma.companyProfile.findUnique({
    where: { companyId: p.companyId },
    select: { businessHours: true, diasFechados: true },
  });
  if (lerDiasFechados(perfil?.diasFechados).includes(dia)) return OCUPADO;
  const horarios = horarioDaEmpresa(perfil?.businessHours);

  /** O profissional que fica com o horário, ou null se ninguém pode. */
  async function quemAtende(db: Leitor): Promise<string | null> {
    const ocupadosDia = await db.appointment.findMany({
      where: {
        companyId: p.companyId,
        status: { in: ["MARCADO", "CONFIRMADO"] },
        startsAt: { gte: diaData, lt: new Date(diaData.getTime() + 48 * 60 * 60_000) },
      },
      select: { startsAt: true, endsAt: true, notes: true },
    });

    const livreCom = (nome: string | null) =>
      calcularSlots({
        dia: diaData,
        horarios,
        duracaoMin: p.servico.duracaoMin,
        ocupados: ocupadosDia
          .filter((a) => nome === null || extrairProfissional(a.notes).toLowerCase() === nome.toLowerCase())
          .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt })),
        agora,
        antecedenciaMinutos: ANTECEDENCIA_MINUTOS,
      }).includes(hora);

    if (p.profissional) return livreCom(p.profissional) ? p.profissional : null;
    const equipe = await listarProfissionais(p.companyId);
    if (equipe.length > 0) return equipe.find((e) => livreCom(e.nome))?.nome ?? null;
    return livreCom(null) ? "Atendimento Geral" : null;
  }

  if (p.simulacao) {
    const profissional = await quemAtende(prisma);
    return profissional
      ? { ok: true, profissional, inicio: p.inicio, fim, appointmentId: null, clienteId: null }
      : OCUPADO;
  }

  try {
    const criado = await prisma.$transaction(
      async (tx) => {
        const profissional = await quemAtende(tx);
        if (!profissional) throw new HorarioOcupado();

        const telefone = p.cliente.telefone.replace(/\D/g, "");
        const variantes = variantesDeTelefone(telefone);
        const existente = await tx.customer.findFirst({
          where: { companyId: p.companyId, phone: { in: variantes.length ? variantes : [telefone] } },
          select: { id: true },
        });

        const hash = hashTelefone(telefone);
        const suprimido = hash
          ? (await tx.supressao.count({ where: { companyId: p.companyId, telefoneHash: hash } })) > 0
          : false;
        const entrada = entradaPorLink({ existe: Boolean(existente), nomeInformado: p.cliente.nome, suprimido });

        const cliente =
          existente ??
          (await tx.customer.create({
            data: {
              companyId: p.companyId,
              phone: telefone,
              source: p.origem,
              ...entrada.criar!,
              ...(entrada.criar!.optOut ? { optOutAt: new Date() } : {}),
            },
            select: { id: true },
          }));

        const agendamento = await tx.appointment.create({
          data: {
            companyId: p.companyId,
            customerId: cliente.id,
            serviceId: p.servico.id,
            startsAt: p.inicio,
            endsAt: fim,
            source: p.origem,
            notes: JSON.stringify({ profissional, servicoNome: p.servico.nome }),
          },
          select: { id: true },
        });

        return { profissional, appointmentId: agendamento.id, clienteId: cliente.id };
      },
      { isolationLevel: "Serializable" },
    );

    return { ok: true, inicio: p.inicio, fim, ...criado };
  } catch (erro) {
    // Perder a corrida não é falha do sistema: é o horário ter acabado de ser
    // ocupado — que é o que quem pediu precisa ler, e não um erro.
    if (erro instanceof HorarioOcupado || ehConflitoDeConcorrencia(erro)) return OCUPADO;
    throw erro;
  }
}
