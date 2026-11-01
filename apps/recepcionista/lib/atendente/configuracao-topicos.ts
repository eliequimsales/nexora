import type { ConfiguracaoNexa, PendenciaNexa } from "./configuracao-schema";

export const TOPICOS_CONFIGURACAO = [
  { id: "EMPRESA", titulo: "Sua empresa", descricao: "Nome, área de atuação e o que você oferece.", etapa: 0 },
  { id: "SERVICOS", titulo: "Serviços e preços", descricao: "Itens, valores e duração dos atendimentos.", etapa: 1 },
  { id: "FUNCIONAMENTO", titulo: "Horários e local", descricao: "Expediente, endereço e formas de pagamento.", etapa: 1 },
  { id: "ATENDIMENTO", titulo: "Jeito de atender", descricao: "Nome, estilo, agenda e quando chamar sua equipe.", etapa: 2 },
  { id: "REGRAS", titulo: "Perguntas e regras", descricao: "Dúvidas frequentes, orientações e exceções.", etapa: 3 },
] as const;
export type TopicoConfiguracao = typeof TOPICOS_CONFIGURACAO[number]["id"];
export const IDS_TOPICOS_CONFIGURACAO = ["EMPRESA", "SERVICOS", "FUNCIONAMENTO", "ATENDIMENTO", "REGRAS"] as const;
export type EstadoTopicoConfiguracao = "PENDENTE" | "REVISAR" | "PREENCHIDO";
export type ResumoTopicoConfiguracao = {
  id: TopicoConfiguracao; titulo: string; descricao: string; etapa: number;
  estado: EstadoTopicoConfiguracao; rotulo: string; resumo: string; pendencias: number;
};

export function topicoDaChave(chave: string): TopicoConfiguracao | null {
  const campo = chave.replace(/^esclarecimento:/, "");
  if (campo.startsWith("servico:") || campo.startsWith("informacoes.servicos")) return "SERVICOS";
  if (/^negocio\.(?:modalidade|regiao)(?::|$)/.test(campo)) return "FUNCIONAMENTO";
  if (/^negocio\.objetivo(?::|$)/.test(campo)) return "ATENDIMENTO";
  if (/^negocio\.(?:nome|segmento|descricao)(?::|$)/.test(campo)) return "EMPRESA";
  if (campo.startsWith("informacoes.")) return "FUNCIONAMENTO";
  if (campo.startsWith("atendimento.")) return "ATENDIMENTO";
  if (campo === "conhecimento" || campo.startsWith("conhecimento.") || campo.startsWith("pergunta:")) return "REGRAS";
  return null;
}

export function campoPertenceAoTopico(chave: string, topico?: TopicoConfiguracao | null): boolean {
  return !topico || topicoDaChave(chave) === topico;
}

/** Estado do rascunho, sem afirmar publicação, ativação ou qualidade do atendimento. */
export function resumirTopicosConfiguracao(c: ConfiguracaoNexa, pendencias: PendenciaNexa[], ignoradas: string[] = []): ResumoTopicoConfiguracao[] {
  return TOPICOS_CONFIGURACAO.map(topico => {
    const faltas = pendencias.filter(p => p.bloqueia && topicoDaChave(p.campo) === topico.id).length;
    const revisar = topico.id === "EMPRESA" ? c.negocio.descricao.situacao === "REVISAR"
      : topico.id === "SERVICOS" ? c.informacoes.servicos.some(s => s.situacao === "REVISAR")
      : topico.id === "FUNCIONAMENTO" ? c.informacoes.horariosSituacao === "REVISAR" || [c.negocio.regiao, c.informacoes.endereco, c.informacoes.pagamento].some(i => i.situacao === "REVISAR")
      : topico.id === "REGRAS" ? c.conhecimento.itens.some(i => i.situacao === "REVISAR") : false;
    const preenchido = topico.id === "EMPRESA" ? c.negocio.nome.trim().length >= 2 && c.negocio.nome.trim().toLowerCase() !== "minha empresa" && c.negocio.segmento.trim().length >= 2
      : topico.id === "SERVICOS" ? c.informacoes.servicos.some(s => s.nome.trim().length >= 2)
      : topico.id === "FUNCIONAMENTO" ? c.informacoes.horariosSituacao === "CONFIRMADO" && c.informacoes.horarios.length === 7
      : topico.id === "ATENDIMENTO" ? c.atendimento.nome.trim().length >= 2
      : c.conhecimento.itens.length > 0 || ignoradas.includes("conhecimento");
    const estado: EstadoTopicoConfiguracao = faltas || !preenchido ? "PENDENTE" : revisar ? "REVISAR" : "PREENCHIDO";
    const resumo = topico.id === "EMPRESA" ? [c.negocio.nome, c.negocio.segmento].filter(Boolean).join(" · ") || "Conte o básico do seu negócio"
      : topico.id === "SERVICOS" ? c.informacoes.servicos.length ? `${c.informacoes.servicos.length} ${c.informacoes.servicos.length === 1 ? "item cadastrado" : "itens cadastrados"}` : "Adicione o que seus clientes procuram"
      : topico.id === "FUNCIONAMENTO" ? c.informacoes.horariosSituacao === "CONFIRMADO" ? "Expediente informado" : "Defina onde e quando sua empresa atende"
      : topico.id === "ATENDIMENTO" ? c.atendimento.nome || "Personalize seu atendente"
      : c.conhecimento.itens.length ? `${c.conhecimento.itens.length} ${c.conhecimento.itens.length === 1 ? "orientação cadastrada" : "orientações cadastradas"}` : ignoradas.includes("conhecimento") ? "Sem regras adicionais por enquanto" : "Acrescente o que é importante saber";
    return { ...topico, estado, rotulo: estado === "PENDENTE" ? "Preencher" : estado === "REVISAR" ? "Conferir" : "Preenchido", resumo, pendencias: faltas };
  });
}
