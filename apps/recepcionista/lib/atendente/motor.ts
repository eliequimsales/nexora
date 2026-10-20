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
import { duracaoFalada, precoFalado, type Fatos, type ServicoDoAtendente } from "./fatos";
import { detectarIntencao, detectarIntencoes, type Intencao } from "./intencao";
import { apresentacao, cumprimento, nomeProprio, textosDoJeito, URGENCIA, URGENCIA_CVV } from "./jeitos";
import { escolherTres, formatarOpcao, opcoesParaEscolha, type EstadoDaConversa } from "./oferta";
import { montarPrompt } from "./prompt";
import { catalogoDeRespostas, validarSelecaoDeFontes } from "./conhecimento";
import { responderComercial } from "./comercial";
import { midiasNaoInterpretadas, textoSemMarcadoresDeMidia } from "@/lib/whatsapp/midia";

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
 * pagamento); só o que sobra vai para a IA, que seleciona IDs do catálogo.
 * A resposta usa os fatos desses IDs, nunca o texto livre produzido pelo modelo.
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
  reutilizada?: boolean;
};

export type SaidaDoMotor = {
  mensagens: string[];
  estado: EstadoDaConversa | null;
  marcou?: Marcacao;
  anotar?: { motivo: string; pergunta?: string };
  urgente?: boolean;
  /** A conversa passa para a equipe: o Atendente sai dela (pessoa, reclamação, urgência). */
  equipe?: true;
  /** De onde veio cada fato — o simulador mostra isso embaixo da resposta. */
  fontes: string[];
  usouIa: boolean;
};

const MAX_SERVICOS_NA_LISTA = 9;

const trecho = (texto: string) => texto.trim().replace(/\s+/g, " ").slice(0, 120);

function saida(s: Partial<SaidaDoMotor> & { mensagens: string[] }): SaidaDoMotor {
  return { estado: null, fontes: [], usouIa: false, ...s };
}

function normalizarParaBusca(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:oi|ola|bom dia|boa tarde|boa noite)\s+/, "")
    .replace(/\s+(?:por favor|pfv|obrigado|obrigada)$/, "");
}

/** Palavras genéricas compartilhadas não provam que uma FAQ responde à dúvida. */
function encontrarFaqDireta(texto: string, perguntas: Fatos["perguntas"]): Fatos["perguntas"][number] | null {
  const limpo = normalizarParaBusca(texto);
  const exata = perguntas.find((p) => normalizarParaBusca(p.question) === limpo);
  if (exata) return exata;
  // Mantém o preço geral ensinado, somente quando a pergunta não nomeia um serviço.
  if (/^(?:(?:qual|quais) (?:e |sao )?(?:o |os )?)?(?:preco|precos|valor|valores|tabela(?: de precos)?|quanto custa|quanto e|quanto fica)$/.test(limpo)) {
    const gerais = perguntas.filter((p) => /^(?:(?:qual|quais) (?:e |sao )?(?:o |os )?)?(?:preco|precos|valor|valores|tabela de precos|quanto custa)(?: do plano| cobrado)?$/.test(normalizarParaBusca(p.question)));
    if (gerais.length === 1) return gerais[0];
  }
  return null;
}

export async function responder(e: EntradaDoMotor, deps: DependenciasDoMotor): Promise<SaidaDoMotor> {
  const midias = midiasNaoInterpretadas(e.texto);
  if (midias.length) {
    const texto = textoSemMarcadoresDeMidia(e.texto);
    const aviso = "Recebi sua mídia, mas não consigo interpretar o conteúdo dela por aqui. Pode escrever o que você precisa em uma mensagem?";
    if (!texto) return saida({ mensagens: [aviso], estado: e.estado,
      fontes: ["Mídia recebida sem interpretação"] });
    const resposta = await responder({ ...e, texto,
      historico: e.historico.map((m) => ({ ...m, content: textoSemMarcadoresDeMidia(m.content) }))
        .filter((m) => m.content.trim()) }, deps);
    if (resposta.urgente || resposta.equipe) return resposta;
    return { ...resposta, mensagens: [[...resposta.mensagens, aviso].join("\n")],
      fontes: [...resposta.fontes, "Mídia recebida sem interpretação"] };
  }
  if (e.fatos.comercial) {
    return responderComercial(e, deps);
  }

  const { fatos, agora } = e;
  const t = textosDoJeito(fatos.jeito);
  const agoraIso = agora.toISOString();
  const volta =
    e.contexto === "FECHADO"
      ? textoDaVolta(proximaAbertura(fatos.horarios, fatos.diasFechados, agora), agora)
      : null;

  const jaConversou = e.historico.some((m) => m.role === "AI" || m.role === "HUMAN");
  const abertura = e.primeiraDoDia && !jaConversou
    ? t.saudacao({ cumprimento: cumprimento(agora), cliente: e.clienteNome,
        apresentacao: apresentacao({ nome: fatos.nome, empresa: fatos.empresa }) })
    : `${cumprimento(agora)}${e.clienteNome ? `, ${e.clienteNome}` : ""}!`;
  // Uma dúvida direta recebe a resposta primeiro, sem um segundo balão de apresentação.
  const comAbertura = (texto: string) => [texto];
  const naoSei = (motivo: string, pergunta?: string): SaidaDoMotor =>
    saida({
      mensagens: [t.naoSei(volta)],
      estado: e.estado,
      anotar: { motivo, ...(pergunta ? { pergunta } : {}) },
      fontes: ["Informação pendente de confirmação"],
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
    let livres: Livre[];
    try {
      livres = (await deps.livres({ servico, dias, profissional })).filter(
        (l) => !ocupado || l.inicio.getTime() !== ocupado.inicio || l.profissional !== ocupado.profissional,
      );
    } catch {
      return saida({
        mensagens: ["Não consegui consultar a agenda agora. A disponibilidade ainda precisa ser confirmada pela equipe."],
        estado: e.estado,
        anotar: { motivo: `Falha ao consultar horários para ${servico.nome}` },
        fontes: ["Consulta de agenda indisponível"],
      });
    }
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
        : t.ofertaLead({
            // Sem serviço cadastrado, o horário é de 30 minutos, mas o cliente não
            // lê um serviço que o dono nunca cadastrou.
            servico: servico.id ? servico.nome : null,
            detalhe: servico.id ? detalhe : null,
            quando: pedido.dia ? diaFalado(pedido.dia, agora) : null,
          }));
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
    if (!fatos.horarios.length || !fatos.servicos.length) {
      return naoSei("A agenda precisa de serviços e horários confirmados antes de oferecer uma reserva", e.texto);
    }
    let servico = servicoId ? fatos.servicos.find((s) => s.id === servicoId) : undefined;
    if (!servico && fatos.servicos.length === 1) servico = fatos.servicos[0];

    // Com marcação direta desligada (padrão) e link disponível, convida direto pelo link interativo
    if (!fatos.marcaDireto && fatos.linkAgenda) {
      const linkComServico = servico?.id ? `${fatos.linkAgenda}?serviceId=${servico.id}` : fatos.linkAgenda;
      return saida({
        mensagens: comAbertura(
          t.conviteLink({ link: linkComServico, servico: servico?.id ? servico.nome : null }),
        ),
        fontes: ["Link da sua agenda online", ...(servico?.id ? [`Serviço ${servico.nome}`] : [])],
      });
    }

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

    return servico ? oferecer(servico, pedido, profissional ?? null, null)
      : naoSei("O serviço solicitado precisa de confirmação", e.texto);
  }

  async function escolher(n: number): Promise<SaidaDoMotor> {
    const estado = e.estado;
    if (estado?.tipo === "SERVICO") {
      const opcao = estado.opcoes.find((o) => o.n === n);
      const servico = opcao && fatos.servicos.find((s) => s.id === opcao.servicoId);
      if (servico && !fatos.marcaDireto && fatos.linkAgenda) {
        const linkComServico = `${fatos.linkAgenda}?serviceId=${servico.id}`;
        return saida({
          mensagens: comAbertura(t.conviteLink({ link: linkComServico, servico: servico.nome })),
          fontes: ["Link da sua agenda online", `Serviço ${servico.nome}`],
        });
      }
      return servico ? oferecer(servico, estado.pedido, null, null) : pedirHorario(undefined, estado.pedido, undefined);
    }

    const opcao = estado?.tipo === "HORARIO" ? estado.opcoes.find((o) => o.n === n) : undefined;
    if (estado?.tipo === "HORARIO" && opcao) {
      const servicoAtual = fatos.servicos.find((s) => s.id === estado.servicoId);
      if (!fatos.horarios.length || !servicoAtual || servicoAtual.duracaoMin !== estado.duracaoMin) {
        return saida({ mensagens: ["Os dados dessa opção precisam ser conferidos novamente antes de reservar. A equipe pode verificar o serviço e o horário para você."],
          anotar: { motivo: "Oferta anterior incompatível com os dados atuais da agenda" },
          fontes: ["Reserva pendente de nova verificação"] });
      }
      const inicio = new Date(opcao.inicio);
      const quando = quandoFalado(inicio);
      const servicoFalado = estado.servicoId ? estado.servicoNome : null;
      const profissionalFalado = opcao.profissional ? nomeProprio(opcao.profissional) : null;

      if (!fatos.marcaDireto) {
        return saida({
          mensagens: comAbertura(fatos.linkAgenda ? t.linkAgenda(fatos.linkAgenda) : t.anoteiHorario({ quando, volta })),
          anotar: { motivo: `Quer marcar ${servicoFalado ?? "um horário"}: ${quando}` },
          fontes: ["Horários livres da sua agenda", "Escolha pendente de confirmação"],
        });
      }

      let resultado: ResultadoDaMarcacao;
      try {
        resultado = await deps.marcar({
        servico: { id: estado.servicoId, nome: estado.servicoNome, duracaoMin: estado.duracaoMin },
        inicio,
        profissional: opcao.profissional,
        cliente: { nome: e.clienteNome ?? "Cliente", telefone: e.telefone },
        });
      } catch {
        resultado = { ok: false, motivo: "RESULTADO_DESCONHECIDO" };
      }
      if (!resultado.ok && resultado.motivo === "RESULTADO_DESCONHECIDO") {
        return saida({
          mensagens: ["Ainda não consegui confirmar o resultado dessa reserva. A equipe precisa verificar antes de uma nova tentativa."],
          estado, equipe: true,
          anotar: { motivo: `Verificar resultado da reserva de ${estado.servicoNome}: ${quando}` },
          fontes: ["Resultado da reserva em verificação"],
        });
      }

      if (resultado.ok) {
        const valorCents = fatos.servicos.find((s) => s.id === estado.servicoId)?.precoCents ?? 0;
        return saida({
          mensagens: comAbertura(
            t.confirmacao({ quando, servico: servicoFalado, profissional: profissionalFalado }),
          ),
          marcou: {
            inicio,
            servico: estado.servicoNome,
            profissional: opcao.profissional,
            valorCents,
            appointmentId: resultado.appointmentId,
            clienteId: resultado.clienteId,
            reutilizada: resultado.reutilizada,
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

  async function livre(pergunta = e.texto): Promise<SaidaDoMotor> {
    const faq = encontrarFaqDireta(pergunta, fatos.perguntas);
    if (faq) return saida({ mensagens: [faq.answer.trim()], estado: e.estado,
      fontes: [`Dúvida que você ensinou: "${faq.question}"`] });

    const catalogo = catalogoDeRespostas(fatos);
    if (!catalogo.length) return naoSei("Não há informação aprovada para esta pergunta", pergunta);
    const systemPrompt = montarPrompt({
      textoDosFatos: JSON.stringify(catalogo), jeito: fatos.jeito, nome: fatos.nome,
      empresa: fatos.empresa, contexto: e.contexto, volta,
      agoraTexto: getLocalTime(agora).formatted,
    });
    let resposta: ReceptionistReply;
    try {
      // A pergunta em análise fica por último, inclusive quando veio de uma mensagem composta.
      const historico = e.historico.at(-1)?.content === pergunta
        ? e.historico : [...e.historico, { role: "CUSTOMER" as const, content: pergunta }];
      resposta = await deps.ia({ systemPrompt, historico });
    } catch {
      return { ...naoSei("Não foi possível consultar a informação", pergunta), usouIa: true };
    }
    const selecao = validarSelecaoDeFontes(resposta, catalogo);
    if (!selecao) return { ...naoSei("A resposta não indicou fontes autorizadas", pergunta), usouIa: true };
    const referencia = detectarIntencao(pergunta, ctx);
    const servicosReferidos = referencia.servicoIds ?? [];
    if (servicosReferidos.length && selecao.fontes.some((fonte) =>
      fonte.id.startsWith("servico:") && !servicosReferidos.some((id) =>
        fonte.id === `servico:${id}:preco` || fonte.id === `servico:${id}:duracao`))) {
      return { ...naoSei("A fonte selecionada não corresponde ao serviço solicitado", pergunta), usouIa: true };
    }
    if (resposta.transferir_humano) return saida({
      mensagens: [t.pessoa(volta)], estado: e.estado, equipe: true, usouIa: true,
      anotar: { motivo: "Solicitação que precisa de avaliação da equipe", pergunta },
      fontes: ["Solicitação de avaliação humana"],
    });
    const mensagens = [...new Set(selecao.fontes.map((fonte) => fonte.texto))];
    if (selecao.pendente) mensagens.push(t.naoSei(volta));
    return saida({
      mensagens: [mensagens.join("\n")], estado: e.estado, usouIa: true,
      fontes: selecao.fontes.map((fonte) => fonte.assunto),
      ...(selecao.pendente ? { anotar: { motivo: "Parte da pergunta precisa de confirmação", pergunta } } : {}),
    });
  }

  const ctx = {
    servicos: fatos.servicos.map((s) => ({ id: s.id, nome: s.nome })),
    profissionais: fatos.profissionais, palavrasDoDono: e.palavrasDoDono,
    estado: e.estado?.tipo ?? null, opcoes: opcoesParaEscolha(e.estado), agora,
    historico: e.historico,
    servicoAtualId: e.estado?.tipo === "HORARIO" ? e.estado.servicoId ?? undefined : undefined,
  };
  const principal = detectarIntencao(e.texto, ctx);
  const exclusivas = new Set(["URGENCIA", "DESMARCAR", "PESSOA", "RECLAMACAO", "ESCOLHA", "CONFIRMA", "NEGA"]);

  async function responderIntencao(intencao: Intencao): Promise<SaidaDoMotor> {
    const pergunta = intencao.texto ?? e.texto;
    switch (intencao.tipo) {
      case "URGENCIA":
        return saida({ mensagens: [intencao.emocional ? URGENCIA_CVV(fatos.empresa) : URGENCIA(fatos.empresa)],
          urgente: true, equipe: true, anotar: { motivo: `Urgência: ${trecho(e.texto)}` },
          fontes: ["Orientação fixa de urgência"] });
      case "DESMARCAR":
        return saida({ mensagens: ["A alteração do seu agendamento precisa ser confirmada pela equipe. O pedido ainda não significa que o horário foi cancelado ou alterado."],
          equipe: true, anotar: { motivo: "Quer desmarcar ou remarcar um horário" },
          fontes: ["Alteração pendente de confirmação"] });
      case "PESSOA":
        return saida({ mensagens: [t.pessoa(volta)], equipe: true,
          anotar: { motivo: "Pediu para falar com alguém da equipe" }, fontes: ["Pedido de atendimento humano"] });
      case "RECLAMACAO":
        return saida({ mensagens: [t.reclamacao(volta)], equipe: true,
          anotar: { motivo: `Reclamação: ${trecho(e.texto)}` }, fontes: ["Pedido de atenção da equipe"] });
      case "ESCOLHA": return escolher(intencao.escolha!);
      case "NEGA": return saida({ mensagens: ["Tudo bem. Se precisar, estou por aqui."] });
      case "AGRADECIMENTO": return saida({ mensagens: [t.agradecimento], estado: e.estado });
      case "CONFIRMA":
      case "HORARIO": return pedirHorario(intencao.servicoId, intencao.pedido, intencao.profissional);
      case "IDENTIDADE":
        return saida({ mensagens: [`${apresentacao({ nome: fatos.nome, empresa: fatos.empresa })}. Posso ajudar com informações do atendimento; se preferir falar com a equipe, é só pedir.`], estado: e.estado,
          fontes: ["Identidade do atendimento virtual"] });
      case "PRECO":
      case "DURACAO": {
        const ids = intencao.servicoIds?.length ? intencao.servicoIds : intencao.servicoId ? [intencao.servicoId] : [];
        const selecionados = fatos.servicos.filter((s) => ids.includes(s.id));
        if (selecionados.length) {
          const textos: string[] = [];
          const semPreco: string[] = [];
          for (const servico of selecionados) {
            if (intencao.tipo === "DURACAO") {
              if (servico.duracaoMin > 0) textos.push(`${servico.nome} leva ${duracaoFalada(servico.duracaoMin)}.`);
              else return naoSei(`Duração não confirmada: ${servico.nome}`, pergunta);
            }
            else if (servico.precoCents > 0) textos.push(t.preco({ servico: servico.nome,
              preco: precoFalado(servico.precoCents), duracao: null }));
            else { textos.push(t.semPreco(servico.nome)); semPreco.push(servico.nome); }
          }
          return saida({ mensagens: [textos.join("\n")], estado: e.estado,
            fontes: selecionados.map((s) => `${intencao.tipo === "DURACAO" ? "Duração" : "Preço"} do serviço ${s.nome}`),
            ...(semPreco.length ? { anotar: { motivo: `Preço não confirmado: ${semPreco.join(", ")}`, pergunta } } : {}) });
        }
        const faq = encontrarFaqDireta(pergunta, fatos.perguntas);
        if (faq) return saida({ mensagens: [faq.answer.trim()], estado: e.estado, fontes: [`Dúvida que você ensinou: "${faq.question}"`] });
        // Lista só quando o cliente pediu uma tabela. Um serviço desconhecido não vira outro serviço.
        if (/\b(tabela|precos|valores|servicos)\b/.test(normalizarParaBusca(pergunta)) && intencao.tipo === "PRECO") {
          const lista = fatos.servicos.filter((s) => s.precoCents > 0).slice(0, MAX_SERVICOS_NA_LISTA);
          if (lista.length) return saida({ mensagens: [lista.map((s) => `${s.nome}: ${precoFalado(s.precoCents)}.`).join("\n")], estado: e.estado,
            fontes: lista.map((s) => `Preço do serviço ${s.nome}`) });
        }
        const generica = /^(?:(?:qual|quais) (?:e |sao )?(?:o |os )?)?(?:preco|valor|quanto custa|quanto e|quanto fica|quanto tempo|quanto dura)$/.test(normalizarParaBusca(pergunta));
        if (generica) return saida({ mensagens: ["De qual serviço você gostaria de saber?"], estado: e.estado });
        return livre(pergunta);
      }
      case "FUNCIONAMENTO": {
        const dia = intencao.pedido.dia;
        if (dia && fatos.horarios.length) {
          const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
          const horario = fatos.horarios.find((h) => h.day === semana);
          const fechado = fatos.diasFechados.includes(dia) || !horario || horario.closed || horario.open === horario.close;
          return saida({ mensagens: [fechado ? `Não abrimos ${diaFalado(dia, agora)}.`
            : `${diaFalado(dia, agora).replace(/^./, (c) => c.toUpperCase())}, funcionamos das ${horario.open} às ${horario.close}.`],
            estado: e.estado, fontes: ["Horário e dias fechados do cadastro"] });
        }
        return fatos.horarios.length ? saida({ mensagens: [`Funcionamos ${horarioFalado(fatos.horarios)}.`], estado: e.estado,
          fontes: ["Horário do cadastro"] }) : livre(pergunta);
      }
      case "ENDERECO": return fatos.endereco ? saida({ mensagens: [`Estamos em ${fatos.endereco}.`], estado: e.estado,
        fontes: ["Endereço do cadastro"] }) : livre(pergunta);
      case "PAGAMENTO": return fatos.pagamento ? saida({ mensagens: [`Formas de pagamento: ${fatos.pagamento}.`], estado: e.estado,
        fontes: ["Formas de pagamento do cadastro"] }) : livre(pergunta);
      case "SAUDACAO": return saida({ mensagens: [`${abertura} Como posso ajudar?`], estado: e.estado });
      default: return livre(pergunta);
    }
  }

  if (exclusivas.has(principal.tipo)) return responderIntencao(principal);
  const intencoes = detectarIntencoes(e.texto, ctx);
  const respostas: SaidaDoMotor[] = [];
  for (const intencao of intencoes) {
    const resposta = await responderIntencao(intencao);
    respostas.push(resposta);
    if (resposta.equipe) break;
  }
  if (respostas.length === 1) return respostas[0];
  const anotacoes = respostas.flatMap((r) => r.anotar ? [r.anotar] : []);
  return saida({
    mensagens: [[...new Set(respostas.flatMap((r) => r.mensagens))].join("\n")],
    estado: respostas.findLast((r) => r.estado && r.estado !== e.estado)?.estado ?? e.estado,
    fontes: [...new Set(respostas.flatMap((r) => r.fontes))], usouIa: respostas.some((r) => r.usouIa),
    ...(respostas.some((r) => r.equipe) ? { equipe: true as const } : {}),
    ...(anotacoes.length ? { anotar: { motivo: anotacoes.map((a) => a.motivo).join("; "),
      pergunta: anotacoes.map((a) => a.pergunta).filter(Boolean).join("; ") || undefined } } : {}),
  });
}
