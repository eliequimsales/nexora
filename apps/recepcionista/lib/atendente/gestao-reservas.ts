import { z } from "zod";
import { politicaPermite, type ReservaDoCliente, type ResultadoGestaoReserva } from "@/lib/agenda/gestao-reservas";
import type { Livre } from "@/lib/agenda/livres";
import { diaFalado, horaFalada, lerPedidoDeDia, localDe, normalizarTexto, type PedidoDeDia } from "./datas";
import { escolherTres, formatarOpcao, type OpcaoDeHorario } from "./oferta";
import type { Fatos } from "./fatos";

const reservaSchema = z.object({ id: z.string().min(1).max(160), servicoId: z.string().max(160).nullable(),
  servicoNome: z.string().min(1).max(300), inicio: z.string().datetime({ offset: true }), fim: z.string().datetime({ offset: true }),
  profissional: z.string().max(120).nullable(), versao: z.string().datetime({ offset: true }) });
const opcaoSchema = z.object({ n: z.number().int().min(1).max(3), inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }), profissional: z.string().max(120).nullable() });
const estadoSchema = z.object({ tipo: z.literal("GERIR_RESERVA"), acao: z.enum(["ESCOLHER", "CANCELAR", "REMARCAR"]),
  etapa: z.enum(["ACAO", "RESERVA", "CANCELAMENTO", "HORARIO", "REMARCACAO"]),
  reservas: z.array(reservaSchema).max(9), selecionada: z.string().max(160).nullable(), opcoes: z.array(opcaoSchema).max(3),
  proposta: opcaoSchema.nullable(), criadoEm: z.string().datetime({ offset: true }) });
export type EstadoGestaoReserva = z.infer<typeof estadoSchema>;
export const lerEstadoGestaoReserva = (valor: unknown): EstadoGestaoReserva | null => {
  const r = estadoSchema.safeParse(valor); return r.success ? r.data : null;
};
export type AlteracaoReservaConfirmada = { acao: "CANCELAR" | "REMARCAR"; appointmentId: string; servico: string;
  inicioAnterior: string; inicio: string; reutilizada: boolean };
export type DependenciasGestaoReservas = {
  listar: () => Promise<ReservaDoCliente[]>;
  livres: (reserva: ReservaDoCliente, dias: string[]) => Promise<Livre[]>;
  alterar: (reserva: ReservaDoCliente, acao: "CANCELAR" | "REMARCAR", novaOpcao?: Omit<OpcaoDeHorario, "n">) => Promise<ResultadoGestaoReserva>;
};
type RespostaGestao = { mensagens: string[]; estado: EstadoGestaoReserva | null; fontes: string[];
  equipe?: true; anotar?: { motivo: string }; alterouReserva?: AlteracaoReservaConfirmada };

const quando = (reserva: Pick<ReservaDoCliente, "inicio" | "servicoNome">, agora: Date) => {
  const d = localDe(new Date(reserva.inicio));
  return `${reserva.servicoNome}, ${diaFalado(d.data, agora)} às ${horaFalada(d.minutos)}`;
};
function acaoExplicita(texto: string): "CANCELAR" | "REMARCAR" | null {
  const t = normalizarTexto(texto);
  if (/\b(?:nao (?:quero|e para|preciso)|se |talvez |caso |quanto custa|qual a regra|como funciona)\b/.test(t)) return null;
  if (/\b(?:remarcar|remarca|trocar (?:o |meu )?horario|mudar (?:o |meu )?horario|reagendar)\b/.test(t)) return "REMARCAR";
  if (/\b(?:cancelar|cancele|cancela|cancelamento|desmarcar|desmarca|desmarque)\b/.test(t)) return "CANCELAR";
  return null;
}
const simExplicito = (texto: string) => /^(?:sim(?:,? (?:pode|confirmo|quero))?(?: (?:cancelar|remarcar|confirmar))?|confirmo(?: (?:o cancelamento|a remarcacao|a alteracao))?|pode (?:cancelar|remarcar|confirmar)|confirmar)[.!\s]*$/.test(normalizarTexto(texto));
const desistiu = (texto: string) => /^(?:nao(?:,? obrigado| quero mais| pode cancelar)?|deixa(?: para la)?|desisti|nao confirmar|nao confirme)[.!\s]*$/.test(normalizarTexto(texto));
const numero = (texto: string) => {
  const m = normalizarTexto(texto).match(/^(?:(?:quero |a |o |opcao |reserva |horario |numero )+)?([1-9])[.!\s]*$/);
  return m ? Number(m[1]) : null;
};
const resposta = (mensagem: string, estado: EstadoGestaoReserva | null = null): RespostaGestao => ({ mensagens: [mensagem], estado, fontes: ["Agenda interna do cliente e autorização publicada"] });
const equipe = (motivo: string, mensagem = "A alteração do seu agendamento precisa ser confirmada pela equipe. O pedido ainda não significa que o horário foi cancelado ou alterado."): RespostaGestao => ({
  ...resposta(mensagem), equipe: true, anotar: { motivo },
});

/** O fluxo só aceita confirmações de uma proposta específica gerada pelo servidor. */
export async function responderGestaoReservas(p: { texto: string; estado: EstadoGestaoReserva | null; fatos: Fatos; agora: Date;
  iniciar: boolean }, deps?: DependenciasGestaoReservas): Promise<RespostaGestao | null> {
  if (!p.iniciar && !p.estado) return null;
  if (!deps) return equipe("Alteração de reserva sem integração disponível");
  if (p.fatos.configuracaoDivergente) return equipe("Configuração divergente durante alteração de reserva");
  if (!p.fatos.marcaDireto || p.fatos.agendamento !== "DIRETO") return equipe("Agendamento direto desativado para alteração automática");
  if (p.estado && desistiu(p.texto)) return resposta("Tudo bem, não fiz nenhuma alteração na sua reserva.");
  let estado = p.estado;
  const explicita = acaoExplicita(p.texto);
  if (!estado || (explicita && estado.acao !== explicita)) {
    estado = { tipo: "GERIR_RESERVA", acao: explicita ?? "ESCOLHER", etapa: "ACAO", reservas: [], selecionada: null,
      opcoes: [], proposta: null, criadoEm: p.agora.toISOString() };
  }
  if (estado.acao === "ESCOLHER") {
    if (!explicita) return resposta("Você prefere trocar o horário ou cancelar o agendamento?", estado);
    estado = { ...estado, acao: explicita };
  }
  const acao = estado.acao === "CANCELAR" ? "CANCELAR" : "REMARCAR";
  const politica = p.fatos.gestaoReservas;
  if (!politica || politica[acao === "CANCELAR" ? "cancelar" : "remarcar"] !== true || politica.antecedenciaHoras === null) return equipe("Alteração de reserva depende de autorização da empresa");

  if (estado.etapa === "ACAO") {
    let reservas: ReservaDoCliente[];
    try { reservas = await deps.listar(); } catch { return equipe("Não foi possível consultar as reservas do cliente"); }
    if (!reservas.length) return equipe("Reserva não localizada na agenda conectada", "Não encontrei um agendamento futuro nesse número na agenda conectada. A equipe precisa conferir o pedido antes de fazer uma alteração.");
    if (reservas.length > 8) return equipe("Muitas reservas para seleção segura");
    estado = { ...estado, reservas, etapa: "RESERVA", selecionada: reservas.length === 1 ? reservas[0].id : null };
    if (reservas.length > 1) return resposta(`Qual agendamento você quer ${acao === "CANCELAR" ? "cancelar" : "remarcar"}?\n\n${reservas.map((r, i) => `${i + 1} · ${quando(r, p.agora)}`).join("\n")}`, estado);
  } else if (estado.etapa === "RESERVA" && !estado.selecionada) {
    const n = numero(p.texto);
    if (!n || !estado.reservas[n - 1]) return resposta("Me diga o número do agendamento que você quer alterar.", estado);
    estado = { ...estado, selecionada: estado.reservas[n - 1].id };
  }
  const selecionada = estado.selecionada;
  const reserva = estado.reservas.find(r => r.id === selecionada);
  if (!reserva) return equipe("Estado de seleção da reserva inválido");
  if (!politicaPermite(politica, acao, reserva.inicio, p.agora)) return equipe("Pedido fora da antecedência autorizada para alteração", "Esse agendamento está fora do prazo que a empresa autorizou para alterações automáticas. Vou pausar o atendimento virtual para a equipe avaliar seu pedido. A reserva continua como está.");

  if (acao === "CANCELAR") {
    if (estado.etapa !== "CANCELAMENTO") return resposta(`Encontrei ${quando(reserva, p.agora)}.\n\nPosso confirmar o cancelamento desse agendamento?`, { ...estado, etapa: "CANCELAMENTO" });
    if (!simExplicito(p.texto)) return resposta("Para cancelar esse agendamento, preciso da sua confirmação. Posso confirmar o cancelamento?", estado);
  } else {
    if (estado.etapa === "REMARCACAO") {
      if (!simExplicito(p.texto)) {
        const novoPedido = lerPedidoDeDia(p.texto, p.agora);
        if (novoPedido.dia || novoPedido.horaExata !== undefined || novoPedido.periodo || novoPedido.aPartirDe !== undefined) estado = { ...estado, etapa: "HORARIO", proposta: null, opcoes: [] };
        else return resposta("Posso confirmar a troca para o horário que mostrei? Se quiser outro, pode me dizer o dia e a hora.", estado);
      }
    }
    if (estado.etapa !== "REMARCACAO") {
      const n = estado.etapa === "HORARIO" ? numero(p.texto) : null;
      let opcao = n ? estado.opcoes.find(o => o.n === n) : undefined;
      if (!opcao) {
        const pedido: PedidoDeDia = lerPedidoDeDia(p.texto, p.agora);
        if (!pedido.dia) return resposta(`Seu agendamento atual é ${quando(reserva, p.agora)}. Para qual dia você quer trocar?`, { ...estado, etapa: "HORARIO", opcoes: [] });
        let livres: Livre[];
        try { livres = await deps.livres(reserva, [pedido.dia]); } catch { return equipe("Não foi possível consultar opções para remarcação"); }
        const escolhas = escolherTres(livres, pedido);
        const opcoes = escolhas.opcoes.map((o, i) => ({ n: i + 1, inicio: o.inicio.toISOString(), fim: o.fim.toISOString(), profissional: o.profissional }));
        if (!opcoes.length) return resposta("Não encontrei horário disponível nesse dia para manter seu serviço e profissional. Qual outro dia funciona para você?", { ...estado, etapa: "HORARIO", opcoes: [] });
        if (pedido.horaExata !== undefined && escolhas.noDiaPedido && opcoes.length === 1) opcao = opcoes[0];
        else return resposta(`${pedido.horaExata !== undefined && !escolhas.noDiaPedido ? "Esse horário não está livre. " : ""}Encontrei estas opções para trocar:\n\n${escolhas.opcoes.map((o, i) => formatarOpcao(i + 1, o)).join("\n")}\n\nQual delas você prefere?`, { ...estado, etapa: "HORARIO", opcoes });
      }
      estado = { ...estado, etapa: "REMARCACAO", proposta: opcao, opcoes: [] };
      return resposta(`Posso trocar ${quando(reserva, p.agora)} para ${quando({ ...reserva, inicio: opcao.inicio }, p.agora)}?`, estado);
    }
  }
  let resultado: ResultadoGestaoReserva;
  try { resultado = await deps.alterar(reserva, acao, estado.proposta ?? undefined); } catch { resultado = { estado: "DESCONHECIDA" }; }
  if (resultado.estado !== "CONCLUIDA") {
    if (resultado.estado === "DESCONHECIDA") return equipe("Resultado da alteração de reserva desconhecido; conferir agenda antes de nova tentativa", "Ainda não consegui confirmar o resultado dessa alteração. A equipe precisa conferir a agenda antes de tentar novamente.");
    return equipe(`Alteração não concluída: ${resultado.motivo}`, "A reserva ou as condições mudaram enquanto conferíamos. A equipe precisa verificar antes de confirmar a alteração.");
  }
  const comprovada = resultado.reserva;
  if (resultado.acao !== acao || comprovada.id !== reserva.id || (acao === "REMARCAR"
    && (!estado.proposta || comprovada.inicio !== estado.proposta.inicio || comprovada.fim !== estado.proposta.fim))) return equipe("Integração devolveu alteração sem comprovação", "Ainda não consegui conferir o resultado dessa alteração. A equipe precisa verificar a agenda antes de uma nova tentativa.");
  return { ...resposta(acao === "CANCELAR" ? `Pronto, o cancelamento de ${quando(reserva, p.agora)} foi confirmado.` : `Pronto, seu agendamento foi alterado para ${quando(comprovada, p.agora)}.`),
    alterouReserva: { acao, appointmentId: reserva.id, servico: comprovada.servicoNome, inicioAnterior: reserva.inicio,
      inicio: comprovada.inicio, reutilizada: resultado.reutilizada } };
}
