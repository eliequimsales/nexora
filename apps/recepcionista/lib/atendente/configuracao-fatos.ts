import type { ConfiguracaoNexa, InformacaoNexa } from "./configuracao-schema";
import type { Fatos } from "./fatos";

const confirmado = (info: InformacaoNexa) => info.situacao === "CONFIRMADO" ? info.valor.trim() : "";

/** Projeta somente o que foi conferido. O rascunho nunca altera a fonte publicada. */
export function aplicarConfiguracaoAosFatos(config: ConfiguracaoNexa, base: Fatos): Fatos {
  const materiaisExpirados = (config.materiais ?? []).filter(m => m.validoAte !== null && new Date(m.validoAte).getTime() <= Date.now());
  const servicos = config.informacoes.servicos
    .filter((s) => (s.situacao === "CONFIRMADO" || s.situacao === "REVISAR") && s.nome.trim().length > 0)
    .map((s) => ({ id: s.id, nome: s.nome, descricao: s.descricao,
      precoModo: s.precoModo, precoCents: s.precoModo === "FIXO" ? s.precoCents ?? 0 : 0,
      duracaoMin: s.duracaoMin ?? 0 }));
  const horarios = ((config.informacoes.horariosSituacao === "CONFIRMADO" || config.informacoes.horariosSituacao === "REVISAR") && config.informacoes.horarios.length > 0)
    ? config.informacoes.horarios
    : base.horarios;
  const descricao = [
    confirmado(config.negocio.descricao) || config.negocio.descricao.valor.trim(),
    config.negocio.modalidade === "ONLINE" ? "Atendimento online." : "",
    (confirmado(config.negocio.regiao) || config.negocio.regiao.valor.trim()) ? `Região atendida: ${confirmado(config.negocio.regiao) || config.negocio.regiao.valor.trim()}.` : "",
  ].filter(Boolean).join("\n");
  return {
    ...base,
    empresa: config.negocio.nome,
    nome: config.atendimento.nome,
    jeito: config.atendimento.jeito,
    marcaDireto: config.atendimento.agendamento === "DIRETO",
    agendamento: config.atendimento.agendamento,
    gestaoReservas: config.atendimento.gestaoReservas,
    expediente: config.atendimento.quando === "APOIO_EXPEDIENTE",
    configuracaoDivergente: false,
    servicos,
    horarios,
    diasFechados: config.informacoes.diasFechados,
    endereco: confirmado(config.informacoes.endereco) || config.informacoes.endereco.valor.trim() || base.endereco,
    pagamento: confirmado(config.informacoes.pagamento) || config.informacoes.pagamento.valor.trim() || base.pagamento,
    descricao,
    pricingInfo: "",
    productsServices: servicos.map((s) => `${s.nome}${s.descricao ? `: ${s.descricao}` : ""}`).join("\n"),
    serviceRules: "",
    perguntas: config.conhecimento.itens.filter((i) => i.situacao === "CONFIRMADO" && !materiaisExpirados.some(m => i.id.startsWith(`${m.id}:`)))
      .map((i) => ({ question: i.pergunta, answer: i.resposta })),
    linkAgenda: config.atendimento.agendamento !== "DESLIGADO" && servicos.length && horarios.length
      ? base.linkAgenda : null,
  };
}
