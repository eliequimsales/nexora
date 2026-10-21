import type { ConfiguracaoNexa, InformacaoNexa } from "./configuracao-schema";
import type { Fatos } from "./fatos";

const confirmado = (info: InformacaoNexa) => info.situacao === "CONFIRMADO" ? info.valor.trim() : "";

/** Projeta somente o que foi conferido. O rascunho nunca altera a fonte publicada. */
export function aplicarConfiguracaoAosFatos(config: ConfiguracaoNexa, base: Fatos): Fatos {
  const servicos = config.informacoes.servicos
    .filter((s) => s.situacao === "CONFIRMADO")
    .map((s) => ({ id: s.id, nome: s.nome, descricao: s.descricao,
      precoModo: s.precoModo, precoCents: s.precoModo === "FIXO" ? s.precoCents ?? 0 : 0,
      duracaoMin: s.duracaoMin ?? 0 }));
  const horarios = config.informacoes.horariosSituacao === "CONFIRMADO" ? config.informacoes.horarios : [];
  const descricao = [confirmado(config.negocio.descricao),
    config.negocio.modalidade === "ONLINE" ? "Atendimento online." : "",
    confirmado(config.negocio.regiao) ? `Região atendida: ${confirmado(config.negocio.regiao)}.` : "",
  ].filter(Boolean).join("\n");
  return {
    ...base,
    empresa: config.negocio.nome,
    nome: config.atendimento.nome,
    jeito: config.atendimento.jeito,
    marcaDireto: config.atendimento.agendamento === "DIRETO",
    agendamento: config.atendimento.agendamento,
    expediente: config.atendimento.quando === "APOIO_EXPEDIENTE",
    configuracaoDivergente: false,
    servicos,
    horarios,
    diasFechados: config.informacoes.diasFechados,
    endereco: confirmado(config.informacoes.endereco),
    pagamento: confirmado(config.informacoes.pagamento),
    descricao,
    pricingInfo: "",
    productsServices: servicos.map((s) => `${s.nome}${s.descricao ? `: ${s.descricao}` : ""}`).join("\n"),
    serviceRules: "",
    perguntas: config.conhecimento.itens.filter((i) => i.situacao === "CONFIRMADO")
      .map((i) => ({ question: i.pergunta, answer: i.resposta })),
    linkAgenda: config.atendimento.agendamento !== "DESLIGADO" && servicos.length && horarios.length
      ? base.linkAgenda : null,
  };
}
