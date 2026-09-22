import type { Livre } from "@/lib/agenda/livres";
import type { ResultadoDaMarcacao } from "@/lib/agenda/marcacao";
import { getLocalTime } from "@/lib/ai/prompt";
import type { HistoryMessage, ReceptionistReply } from "@/lib/ai/provider";
import { DIAS_DE_BUSCA } from "./constantes";
import {
  diaFalado,
  horarioFalado,
  localDe,
  proximaAbertura,
  quandoFalado,
  somarDias,
  textoDaVolta,
  type PedidoDeDia,
} from "./datas";
import { duracaoFalada, precoFalado, textoDosFatos, type Fatos, type ServicoDoAtendente } from "./fatos";
import { detectarIntencao } from "./intencao";
import { apresentacao, cumprimento, textosDoJeito, URGENCIA, URGENCIA_CVV } from "./jeitos";
import { escolherTres, formatarOpcao, opcoesParaEscolha, type EstadoDaConversa } from "./oferta";
import { montarPrompt } from "./prompt";
import { numerosSemFonte } from "./verificador";

/**
 * O MOTOR DO ATENDENTE VIRTUAL.
 *
 * Recebe a mensagem do cliente, a escolha pendente na conversa e os fatos da
 * empresa, e decide a resposta. É o MESMO motor no WhatsApp de verdade e no
 * simulador da tela: o que muda são as dependências — a agenda, a marcação e a
 * IA. No simulador, "marcar" só confere se o horário continua livre.
 *
 * A ordem é a do desenho aprovado: o que tem resposta certa sai por código
 * (urgência, pessoa, reclamação, escolha de opção, horário, preço, endereço,
 * pagamento); só o que sobra vai para a IA, com os fatos do banco, e passa pelo
 * verificador antes de sair. Número sem fonte derruba a resposta.
 *
 * O motor não envia nem salva nada: devolve as mensagens, o novo estado da
 * conversa e o que anotar. Quem executa é lib/atendente/executar.ts (WhatsApp)
 * ou a rota do simulador.
 */

export type Contexto = "FECHADO" | "EXPEDIENTE";

export type EntradaDoMotor = {
  texto: string;
  /** A conversa até aqui, com a mensagem do cliente no fim. Vai para a IA. */
  historico: HistoryMessage[];
  estado: EstadoDaConversa | null;
  /** Primeira resposta do dia nesta conversa: é quando ele se apresenta. */
  primeiraDoDia: boolean;
  clienteNome: string | null;
  telefone: string;
  fatos: Fatos;
  agora: Date;
  contexto: Contexto;
  /** As palavras que o dono cadastrou para ser chamado. */
  palavrasDoDono: string[];
};

export type PedidoDeLivres = { servico: ServicoDoAtendente; dias: string[]; profissional?: string | null };

export type PedidoDeMarcacaoDoMotor = {
  servico: { id: string | null; nome: string; duracaoMin: number };
  inicio: Date;
  profissional: string | null;
  cliente: { nome: string; telefone: string };
};

export type DependenciasDoMotor = {
  livres: (p: PedidoDeLivres) => Promise<Livre[]>;
  marcar: (p: PedidoDeMarcacaoDoMotor) => Promise<ResultadoDaMarcacao>;
  ia: (p: { systemPrompt: string; historico: HistoryMessage[] }) => Promise<ReceptionistReply>;
};

export type Marcacao = {
  inicio: Date;
  servico: string;
  profissional: string | null;
  valorCents: number;
  appointmentId: string | null;
  clienteId: string | null;
};

export type SaidaDoMotor = {
  mensagens: string[];
  estado: EstadoDaConversa | null;
  marcou?: Marcacao;
  anotar?: { motivo: string; pergunta?: string };
  urgente?: boolean;
  /** De onde veio cada fato — o simulador mostra isso embaixo da resposta. */
  fontes: string[];
  usouIa: boolean;
};

/** Sem serviço cadastrado, a agenda pública oferece o atendimento de 30 minutos. */
const ATENDIMENTO: ServicoDoAtendente = { id: "", nome: "Atendimento", precoCents: 0, duracaoMin: 30 };

const MAX_SERVICOS_NA_LISTA = 9;

const trecho = (texto: string) => texto.trim().replace(/\s+/g, " ").slice(0, 120);

function saida(s: Partial<SaidaDoMotor> & { mensagens: string[] }): SaidaDoMotor {
  return { estado: null, fontes: [], usouIa: false, ...s };
}

export async function responder(e: EntradaDoMotor, deps: DependenciasDoMotor): Promise<SaidaDoMotor> {
  const { fatos, agora } = e;
  const t = textosDoJeito(fatos.jeito);
  const agoraIso = agora.toISOString();
  const volta =
    e.contexto === "FECHADO"
      ? textoDaVolta(proximaAbertura(fatos.horarios, fatos.diasFechados, agora), agora)
      : null;

  const abertura = e.primeiraDoDia
    ? `${t.saudacao({
        cumprimento: cumprimento(agora),
        cliente: e.clienteNome,
        apresentacao: apresentacao({ nome: fatos.nome, empresa: fatos.empresa }),
      })} ${e.contexto === "FECHADO" ? t.contextoFechado(volta) : t.contextoExpediente}`
    : null;
  const comAbertura = (texto: string) => (abertura ? [abertura, texto] : [texto]);
  const convite = (): EstadoDaConversa => ({ tipo: "CONVITE", criadoEm: agoraIso });
  const naoSei = (motivo: string, pergunta?: string): SaidaDoMotor =>
    saida({
      mensagens: comAbertura(t.naoSei(volta)),
      anotar: { motivo, ...(pergunta ? { pergunta } : {}) },
      fontes: ["Anotado para você responder"],
    });

  async function oferecer(
    servico: ServicoDoAtendente,
    pedido: PedidoDeDia,
    profissional: string | null,
    aviso: string | null,
    ocupado?: { inicio: number; profissional: string | null },
  ): Promise<SaidaDoMotor> {
    const primeiroDia = pedido.dia ?? localDe(agora).data;
    const dias = Array.from({ length: DIAS_DE_BUSCA }, (_, i) => somarDias(primeiroDia, i));
    // O horário que acabou de ser tomado não volta na lista, mesmo que a leitura
    // da agenda ainda não tenha visto a marcação de quem chegou antes.
    const livres = (await deps.livres({ servico, dias, profissional })).filter(
      (l) => !ocupado || l.inicio.getTime() !== ocupado.inicio || l.profissional !== ocupado.profissional,
    );
    const { opcoes, noDiaPedido } = escolherTres(livres, pedido);

    if (opcoes.length === 0) {
      return saida({
        mensagens: comAbertura(t.semAgenda),
        anotar: { motivo: `Queria horário para ${servico.nome} e não havia vaga` },
        fontes: ["Horários livres da sua agenda"],
      });
    }

    const detalhe =
      servico.precoCents > 0
        ? `${precoFalado(servico.precoCents)}, ${duracaoFalada(servico.duracaoMin)}`
        : duracaoFalada(servico.duracaoMin);
    const cabeca =
      aviso ??
      (pedido.dia && !noDiaPedido
        ? t.semHorario(diaFalado(pedido.dia, agora))
        : t.ofertaLead({ servico: servico.nome, detalhe, quando: pedido.dia ? diaFalado(pedido.dia, agora) : null }));
    const fechamento = fatos.marcaDireto
      ? t.respondaComNumero
      : fatos.linkAgenda
        ? t.linkAgenda(fatos.linkAgenda)
        : t.respondaParaAnotar;

    return saida({
      mensagens: comAbertura([cabeca, ...opcoes.map((o, i) => formatarOpcao(i + 1, o)), fechamento].join("\n")),
      estado: {
        tipo: "HORARIO",
        servicoId: servico.id || null,
        servicoNome: servico.nome,
        duracaoMin: servico.duracaoMin,
        opcoes: opcoes.map((o, i) => ({
          n: i + 1,
          inicio: o.inicio.toISOString(),
          fim: o.fim.toISOString(),
          profissional: o.profissional,
        })),
        criadoEm: agoraIso,
      },
      fontes: [
        "Horários livres da sua agenda",
        ...(servico.id ? [`Preço e duração do serviço ${servico.nome}`] : []),
      ],
    });
  }

  function pedirHorario(
    servicoId: string | undefined,
    pedido: PedidoDeDia,
    profissional: string | undefined,
  ): Promise<SaidaDoMotor> | SaidaDoMotor {
    let servico = servicoId ? fatos.servicos.find((s) => s.id === servicoId) : undefined;
    if (!servico && fatos.servicos.length === 1) servico = fatos.servicos[0];

    if (!servico && fatos.servicos.length > 1) {
      const lista = fatos.servicos.slice(0, MAX_SERVICOS_NA_LISTA);
      return saida({
        mensagens: comAbertura(
          [
            t.escolherServico,
            ...lista.map((s, i) => `${i + 1} · ${s.nome}${s.precoCents > 0 ? ` (${precoFalado(s.precoCents)})` : ""}`),
          ].join("\n"),
        ),
        estado: {
          tipo: "SERVICO",
          opcoes: lista.map((s, i) => ({ n: i + 1, servicoId: s.id, nome: s.nome })),
          pedido,
          criadoEm: agoraIso,
        },
        fontes: ["Serviços da sua agenda"],
      });
    }

    return oferecer(servico ?? ATENDIMENTO, pedido, profissional ?? null, null);
  }

  async function escolher(n: number): Promise<SaidaDoMotor> {
    const estado = e.estado;
    if (estado?.tipo === "SERVICO") {
      const opcao = estado.opcoes.find((o) => o.n === n);
      const servico = opcao && fatos.servicos.find((s) => s.id === opcao.servicoId);
      return servico ? oferecer(servico, estado.pedido, null, null) : pedirHorario(undefined, estado.pedido, undefined);
    }

    const opcao = estado?.tipo === "HORARIO" ? estado.opcoes.find((o) => o.n === n) : undefined;
    if (estado?.tipo === "HORARIO" && opcao) {
      const inicio = new Date(opcao.inicio);
      const quando = quandoFalado(inicio);

      if (!fatos.marcaDireto) {
        return saida({
          mensagens: comAbertura(fatos.linkAgenda ? t.linkAgenda(fatos.linkAgenda) : t.anoteiHorario({ quando, volta })),
          anotar: { motivo: `Quer marcar ${estado.servicoNome}: ${quando}` },
          fontes: ["Horários livres da sua agenda", "Anotado para você confirmar"],
        });
      }

      const resultado = await deps.marcar({
        servico: { id: estado.servicoId, nome: estado.servicoNome, duracaoMin: estado.duracaoMin },
        inicio,
        profissional: opcao.profissional,
        cliente: { nome: e.clienteNome ?? "Cliente", telefone: e.telefone },
      });

      if (resultado.ok) {
        const valorCents = fatos.servicos.find((s) => s.id === estado.servicoId)?.precoCents ?? 0;
        return saida({
          mensagens: comAbertura(
            t.confirmacao({ quando, servico: estado.servicoNome, profissional: opcao.profissional }),
          ),
          marcou: {
            inicio,
            servico: estado.servicoNome,
            profissional: opcao.profissional,
            valorCents,
            appointmentId: resultado.appointmentId,
            clienteId: resultado.clienteId,
          },
          fontes: ["Marcado na sua agenda, pela mesma regra do seu link"],
        });
      }

      // Ocupado no meio: os próximos três do mesmo dia em diante, sem o que foi tomado.
      const servico = fatos.servicos.find((s) => s.id === estado.servicoId) ?? {
        id: estado.servicoId ?? "",
        nome: estado.servicoNome,
        precoCents: 0,
        duracaoMin: estado.duracaoMin,
      };
      return oferecer(servico, { dia: localDe(inicio).data }, null, t.ocupado, {
        inicio: inicio.getTime(),
        profissional: opcao.profissional,
      });
    }

    return livre();
  }

  async function livre(): Promise<SaidaDoMotor> {
    const textoFatos = textoDosFatos(fatos);
    const systemPrompt = montarPrompt({
      textoDosFatos: textoFatos,
      jeito: fatos.jeito,
      nome: fatos.nome,
      empresa: fatos.empresa,
      contexto: e.contexto,
      volta,
      agoraTexto: getLocalTime(agora).formatted,
    });

    let resposta: ReceptionistReply;
    try {
      resposta = await deps.ia({ systemPrompt, historico: e.historico });
    } catch {
      return { ...naoSei("Pergunta que o atendente não soube responder", e.texto), usouIa: true };
    }

    // O verificador: todo número da resposta precisa existir nos fatos.
    if (numerosSemFonte(resposta.resposta, textoFatos).length > 0) {
      return { ...naoSei("A resposta tinha informação que não está no seu cadastro", e.texto), usouIa: true };
    }

    const convidou = /hor[aá]rios?/i.test(resposta.resposta) && resposta.resposta.trim().endsWith("?");
    return saida({
      mensagens: comAbertura(resposta.resposta),
      estado: convidou ? convite() : null,
      ...(resposta.transferir_humano
        ? {
            anotar: {
              motivo: resposta.motivo_transferencia || "Pergunta que o atendente não soube responder",
              pergunta: e.texto,
            },
          }
        : {}),
      fontes: ["Frase do atendente, conferida com os seus dados"],
      usouIa: true,
    });
  }

  const intencao = detectarIntencao(e.texto, {
    servicos: fatos.servicos.map((s) => ({ id: s.id, nome: s.nome })),
    profissionais: fatos.profissionais,
    palavrasDoDono: e.palavrasDoDono,
    estado: e.estado?.tipo ?? null,
    opcoes: opcoesParaEscolha(e.estado),
    agora,
  });

  switch (intencao.tipo) {
    case "URGENCIA":
      // Antes de qualquer apresentação: quem escreve isso não quer saber quem é o atendente.
      return saida({
        mensagens: [intencao.emocional ? URGENCIA_CVV(fatos.empresa) : URGENCIA(fatos.empresa)],
        urgente: true,
        anotar: { motivo: `Urgência: ${trecho(e.texto)}` },
        fontes: ["Texto fixo de urgência, com aviso para você"],
      });

    case "DESMARCAR":
      return saida({
        mensagens: comAbertura(t.pessoa(volta)),
        anotar: { motivo: "Quer desmarcar ou remarcar um horário" },
        fontes: ["Anotado para você resolver"],
      });

    case "PESSOA":
      return saida({
        mensagens: comAbertura(t.pessoa(volta)),
        anotar: { motivo: "Pediu para falar com alguém da equipe" },
        fontes: ["Anotado para você responder"],
      });

    case "RECLAMACAO":
      return saida({
        mensagens: comAbertura(t.reclamacao(volta)),
        anotar: { motivo: `Reclamação: ${trecho(e.texto)}` },
        fontes: ["Anotado para você responder"],
      });

    case "ESCOLHA":
      return escolher(intencao.escolha!);

    case "NEGA":
    case "AGRADECIMENTO":
      return saida({ mensagens: comAbertura(t.agradecimento) });

    case "CONFIRMA":
    case "HORARIO":
      return pedirHorario(intencao.servicoId, intencao.pedido, intencao.profissional);

    case "PRECO": {
      const servicoId = intencao.servicoId ?? (fatos.servicos.length === 1 ? fatos.servicos[0].id : undefined);
      const servico = servicoId ? fatos.servicos.find((s) => s.id === servicoId) : undefined;
      if (servico) {
        if (servico.precoCents > 0) {
          return saida({
            mensagens: comAbertura(
              `${t.preco({ servico: servico.nome, preco: precoFalado(servico.precoCents), duracao: duracaoFalada(servico.duracaoMin) })} ${t.convite}`,
            ),
            estado: convite(),
            fontes: [`Preço e duração do serviço ${servico.nome}`],
          });
        }
        return saida({
          mensagens: comAbertura(t.semPreco(servico.nome)),
          anotar: { motivo: `Perguntou o valor de ${servico.nome}`, pergunta: e.texto },
          fontes: ["Anotado para você responder"],
        });
      }
      const comPreco = fatos.servicos.filter((s) => s.precoCents > 0).slice(0, MAX_SERVICOS_NA_LISTA);
      if (comPreco.length) {
        return saida({
          mensagens: comAbertura(
            `Valores: ${comPreco.map((s) => `${s.nome} — ${precoFalado(s.precoCents)}`).join("; ")}. ${t.convite}`,
          ),
          estado: convite(),
          fontes: ["Preços dos serviços da sua agenda"],
        });
      }
      return naoSei("Perguntou preço", e.texto);
    }

    case "FUNCIONAMENTO":
      return saida({
        mensagens: comAbertura(`Funcionamos ${horarioFalado(fatos.horarios)}. ${t.convite}`),
        estado: convite(),
        fontes: ["Horário do seu cadastro"],
      });

    case "ENDERECO":
      return fatos.endereco
        ? saida({
            mensagens: comAbertura(`Estamos em ${fatos.endereco}. ${t.convite}`),
            estado: convite(),
            fontes: ["Endereço do seu cadastro"],
          })
        : naoSei("Perguntou o endereço", e.texto);

    case "PAGAMENTO":
      return fatos.pagamento
        ? saida({
            mensagens: comAbertura(`Formas de pagamento: ${fatos.pagamento}. ${t.convite}`),
            estado: convite(),
            fontes: ["Formas de pagamento do seu cadastro"],
          })
        : naoSei("Perguntou as formas de pagamento", e.texto);

    case "SAUDACAO":
      return saida({ mensagens: [abertura ? `${abertura} ${t.convite}` : t.convite], estado: convite() });

    case "LIVRE":
    default:
      return livre();
  }
}
