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
import { apresentacao, cumprimento, nomeProprio, textosDoJeito, URGENCIA, URGENCIA_CVV } from "./jeitos";
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
  /** A conversa passa para a equipe: o Atendente sai dela (pessoa, reclamação, urgência). */
  equipe?: true;
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

const SINONIMOS_PRECO = new Set([
  "preco", "precos", "valor", "valores", "custa", "custo", "quanto", "tabela",
  "mensalidade", "investimento", "cobranca", "cobra", "cobram", "tarifa"
]);
const SINONIMOS_HORARIO = new Set([
  "horario", "horarios", "hora", "horas", "abre", "fecha", "aberto", "fechado", "funcionamento", "expediente", "atendimento"
]);
const SINONIMOS_ENDERECO = new Set([
  "endereco", "localizacao", "local", "fica", "onde", "rua", "bairro", "cidade", "chegar"
]);
const SINONIMOS_PAGAMENTO = new Set([
  "pagamento", "pagar", "pix", "cartao", "debito", "credito", "dinheiro", "parcela", "parcelamento"
]);

function normalizarParaBusca(txt: string): string {
  return (txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encontrarFaqDireta(
  texto: string,
  perguntas: { question: string; answer: string }[],
): { question: string; answer: string } | null {
  if (!perguntas || !perguntas.length) return null;
  const limpo = normalizarParaBusca(texto);
  if (!limpo) return null;
  const palavrasTexto = limpo.split(/\s+/).filter((w) => w.length >= 2);
  const setPalavrasTexto = new Set(palavrasTexto);

  const temPrecoTexto = palavrasTexto.some((w) => SINONIMOS_PRECO.has(w));
  const temHorarioTexto = palavrasTexto.some((w) => SINONIMOS_HORARIO.has(w));
  const temEnderecoTexto = palavrasTexto.some((w) => SINONIMOS_ENDERECO.has(w));
  const temPagamentoTexto = palavrasTexto.some((w) => SINONIMOS_PAGAMENTO.has(w));

  // 1. Prioridade máxima: correspondência exata ou contenção direta da pergunta
  for (const p of perguntas) {
    const qLimpo = normalizarParaBusca(p.question);
    if (!qLimpo) continue;
    if (limpo === qLimpo || (limpo.length >= 5 && qLimpo.includes(limpo)) || (qLimpo.length >= 5 && limpo.includes(qLimpo))) {
      return p;
    }
  }

  // 2. Sobreposição de palavras-chave da dúvida
  let melhorCandidato: { p: { question: string; answer: string }; pontos: number } | null = null;
  for (const p of perguntas) {
    const qLimpo = normalizarParaBusca(p.question);
    const palavrasQ = qLimpo.split(/\s+/).filter((w) => w.length >= 2);
    if (!palavrasQ.length) continue;

    const comuns = palavrasQ.filter((w) => setPalavrasTexto.has(w));
    let pontos = comuns.length * 2;

    const temPrecoQ = palavrasQ.some((w) => SINONIMOS_PRECO.has(w));
    if (temPrecoTexto && temPrecoQ) pontos += 4;

    const temHorarioQ = palavrasQ.some((w) => SINONIMOS_HORARIO.has(w));
    if (temHorarioTexto && temHorarioQ) pontos += 4;

    const temEnderecoQ = palavrasQ.some((w) => SINONIMOS_ENDERECO.has(w));
    if (temEnderecoTexto && temEnderecoQ) pontos += 4;

    const temPagamentoQ = palavrasQ.some((w) => SINONIMOS_PAGAMENTO.has(w));
    if (temPagamentoTexto && temPagamentoQ) pontos += 4;

    // Se o cliente perguntou preço e a resposta do item contém menção direta a valor/preço/reais
    if (temPrecoTexto && (/r\$|\breais\b|\b\d+\b/i.test(p.answer) || temPrecoQ)) {
      pontos += 3;
    }

    if (pontos >= 3 && (!melhorCandidato || pontos > melhorCandidato.pontos)) {
      melhorCandidato = { p, pontos };
    }
  }

  if (melhorCandidato) return melhorCandidato.p;

  // 3. Se o cliente perguntou especificamente sobre preço ("qual o preço", "quanto custa")
  // e temos um item de FAQ sobre preço, devolve-o diretamente
  if (temPrecoTexto) {
    const faqComPreco = perguntas.find((p) => {
      const q = normalizarParaBusca(p.question);
      const a = normalizarParaBusca(p.answer);
      return (
        q.split(/\s+/).some((w) => SINONIMOS_PRECO.has(w)) ||
        a.includes("reais") ||
        a.includes("r$") ||
        /\d{2,}/.test(a)
      );
    });
    if (faqComPreco) return faqComPreco;
  }

  return null;
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

    return oferecer(servico ?? ATENDIMENTO, pedido, profissional ?? null, null);
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
      const inicio = new Date(opcao.inicio);
      const quando = quandoFalado(inicio);
      const servicoFalado = estado.servicoId ? estado.servicoNome : null;
      const profissionalFalado = opcao.profissional ? nomeProprio(opcao.profissional) : null;

      if (!fatos.marcaDireto) {
        return saida({
          mensagens: comAbertura(fatos.linkAgenda ? t.linkAgenda(fatos.linkAgenda) : t.anoteiHorario({ quando, volta })),
          anotar: { motivo: `Quer marcar ${servicoFalado ?? "um horário"}: ${quando}` },
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
            t.confirmacao({ quando, servico: servicoFalado, profissional: profissionalFalado }),
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

    if (!resposta || !resposta.resposta) {
      return { ...naoSei("Pergunta que o atendente não soube responder", e.texto), usouIa: true };
    }

    // O verificador: todo número da resposta precisa existir nos fatos.
    if (numerosSemFonte(resposta.resposta, textoFatos).length > 0) {
      return { ...naoSei("A resposta tinha informação que não está no seu cadastro", e.texto), usouIa: true };
    }

    const convidou = /hor[aá]rios?/i.test(resposta.resposta) && resposta.resposta.trim().endsWith("?");
    const expressouDuvida =
      resposta.transferir_humano ||
      /não (tenho|temos) (essa|esta) (informa|confirma)|não sei te informar|não consta no nosso|vou consultar a equipe|verificar com a equipe/i.test(
        resposta.resposta,
      );

    return saida({
      mensagens: comAbertura(resposta.resposta),
      estado: convidou ? convite() : null,
      ...(expressouDuvida
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

  // Se o cliente fez uma pergunta direta que a empresa já ensinou no Treinamento ou FAQ,
  // responde na hora com o conhecimento aprovado do dono, sem risco de alucinação.
  if (
    intencao.tipo !== "URGENCIA" &&
    intencao.tipo !== "DESMARCAR" &&
    intencao.tipo !== "PESSOA" &&
    intencao.tipo !== "RECLAMACAO" &&
    intencao.tipo !== "ESCOLHA"
  ) {
    const faqEncontrada = encontrarFaqDireta(e.texto, fatos.perguntas);
    if (faqEncontrada) {
      return saida({
        mensagens: comAbertura(`${faqEncontrada.answer} ${t.convite}`),
        estado: convite(),
        fontes: [`Dúvida que você ensinou: "${faqEncontrada.question}"`],
      });
    }
  }

  switch (intencao.tipo) {
    case "URGENCIA":
      // Antes de qualquer apresentação: quem escreve isso não quer saber quem é o atendente.
      return saida({
        mensagens: [intencao.emocional ? URGENCIA_CVV(fatos.empresa) : URGENCIA(fatos.empresa)],
        urgente: true,
        equipe: true,
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
        equipe: true,
        anotar: { motivo: "Pediu para falar com alguém da equipe" },
        fontes: ["Anotado para você responder"],
      });

    case "RECLAMACAO":
      return saida({
        mensagens: comAbertura(t.reclamacao(volta)),
        equipe: true,
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
      // 1. Dúvida direta ensinada pelo dono tem prioridade máxima
      const faqPreco = encontrarFaqDireta(e.texto, fatos.perguntas);
      if (faqPreco) {
        return saida({
          mensagens: comAbertura(`${faqPreco.answer} ${t.convite}`),
          estado: convite(),
          fontes: [`Dúvida que você ensinou: "${faqPreco.question}"`],
        });
      }

      // 2. Se o cliente especificou um serviço no texto (ex: "preço do corte")
      if (intencao.servicoId) {
        const servico = fatos.servicos.find((s) => s.id === intencao.servicoId);
        if (servico && servico.precoCents > 0) {
          return saida({
            mensagens: comAbertura(
              `${t.preco({ servico: servico.nome, preco: precoFalado(servico.precoCents), duracao: duracaoFalada(servico.duracaoMin) })} ${t.convite}`,
            ),
            estado: convite(),
            fontes: [`Preço e duração do serviço ${servico.nome}`],
          });
        }
        // Se o serviço citado não tem preço na agenda, procura se o dono ensinou nas perguntas
        const faqDoServico = fatos.perguntas.find((p) =>
          normalizarParaBusca(p.question).includes(normalizarParaBusca(servico?.nome ?? "")) ||
          normalizarParaBusca(p.answer).includes(normalizarParaBusca(servico?.nome ?? ""))
        );
        if (faqDoServico) {
          return saida({
            mensagens: comAbertura(`${faqDoServico.answer} ${t.convite}`),
            estado: convite(),
            fontes: [`Dúvida que você ensinou: "${faqDoServico.question}"`],
          });
        }
        if (servico) {
          return saida({
            mensagens: comAbertura(t.semPreco(servico.nome)),
            anotar: { motivo: `Perguntou o valor de ${servico.nome}`, pergunta: e.texto },
            fontes: ["Anotado para você responder"],
          });
        }
      }

      // 3. Pergunta geral de preço ("qual o preço", "quanto custa", "valores"):
      const comPreco = fatos.servicos.filter((s) => s.precoCents > 0).slice(0, MAX_SERVICOS_NA_LISTA);
      if (comPreco.length > 0) {
        if (comPreco.length === 1) {
          const s = comPreco[0];
          return saida({
            mensagens: comAbertura(
              `${t.preco({ servico: s.nome, preco: precoFalado(s.precoCents), duracao: duracaoFalada(s.duracaoMin) })} ${t.convite}`,
            ),
            estado: convite(),
            fontes: [`Preço do serviço ${s.nome}`],
          });
        }
        return saida({
          mensagens: comAbertura(
            `Valores: ${comPreco.map((s) => `${s.nome} — ${precoFalado(s.precoCents)}`).join("; ")}. ${t.convite}`,
          ),
          estado: convite(),
          fontes: ["Preços dos serviços da sua agenda"],
        });
      }

      // 4. Se não há serviços com preço na agenda, consulta as informações da empresa ou IA livre
      return livre();
    }

    case "FUNCIONAMENTO":
      return fatos.horarios.length
        ? saida({
            mensagens: comAbertura(`Funcionamos ${horarioFalado(fatos.horarios)}. ${t.convite}`),
            estado: convite(),
            fontes: ["Horário do seu cadastro"],
          })
        : livre();

    case "ENDERECO":
      return fatos.endereco
        ? saida({
            mensagens: comAbertura(`Estamos em ${fatos.endereco}. ${t.convite}`),
            estado: convite(),
            fontes: ["Endereço do seu cadastro"],
          })
        : livre();

    case "PAGAMENTO":
      return fatos.pagamento
        ? saida({
            mensagens: comAbertura(`Formas de pagamento: ${fatos.pagamento}. ${t.convite}`),
            estado: convite(),
            fontes: ["Formas de pagamento do seu cadastro"],
          })
        : livre();

    case "SAUDACAO":
      return saida({ mensagens: [abertura ? `${abertura} ${t.convite}` : t.convite], estado: convite() });

    case "LIVRE":
    default:
      return livre();
  }
}
