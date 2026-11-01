import type { ConfiguracaoNexa } from "./configuracao-schema";
import type { EstadoConversaConfiguracao } from "./conversa-schema";
import type { TopicoConfiguracao } from "./configuracao-topicos";

const normalizar = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Preferências da entrevista não viram regras do negócio nem autorizam ações. */
export function preferenciasDaConversa(estado: EstadoConversaConfiguracao, texto: string): string[] {
  const adiados = new Set(estado.camposAdiados ?? []);
  const t = normalizar(texto);
  const deixarDepois = /\b(?:depois|mais tarde|outro momento|ainda nao sei|nao sei ainda)\b/;
  const retomar = /\b(?:agora|vamos|podemos|quero)\b.{0,35}\b(?:definir|configurar|informar|passar|falar|aos?|dos?|sobre)\b/;
  for (const [campo, assunto] of [["servicos.precos", /\b(?:precos?|valores?)\b/], ["servicos.duracao", /\b(?:duracao|duracoes|tempo)\b/]] as const) {
    if (!assunto.test(t)) continue;
    if (deixarDepois.test(t)) adiados.add(campo);
    else if (retomar.test(t)) adiados.delete(campo);
  }
  return [...adiados].slice(-150);
}

/** Ignora somente a pergunta adiada; uma informação espontânea continua sendo recebida. */
export function estadoParaPerguntas(c: ConfiguracaoNexa, estado: EstadoConversaConfiguracao): EstadoConversaConfiguracao {
  const ignoradas = new Set(estado.ignoradas);
  for (const s of c.informacoes.servicos) {
    if (estado.camposAdiados?.includes("servicos.precos")) ignoradas.add(`servico:${s.id}:preco`);
    if (estado.camposAdiados?.includes("servicos.duracao")) ignoradas.add(`servico:${s.id}:duracao`);
  }
  return { ...estado, ignoradas: [...ignoradas] };
}

/** Só um pedido explícito muda o foco; mencionar um dado de outro assunto não perde o atual. */
export function mudancaExplicitaDeTopico(texto: string): TopicoConfiguracao | null {
  const t = normalizar(texto);
  const trecho = t.match(/\b(?:agora\s+)?(?:vamos|quero|podemos|prefiro)\s+(?:(?:falar|configurar|definir|passar|tratar|ir|mudar)\s+)?(?:(?:para|sobre|de|dos|das|aos|as|os|a)\s+){0,3}(.{1,65})/)?.[1];
  if (!trecho) return null;
  if (/^(?:horarios?|expediente|endereco|local|pagamentos?)\b/.test(trecho)) return "FUNCIONAMENTO";
  if (/^(?:servicos?|precos?|valores?|produtos?)\b/.test(trecho)) return "SERVICOS";
  if (/^(?:regras?|perguntas? frequentes|duvidas? frequentes)\b/.test(trecho)) return "REGRAS";
  if (/^(?:nome (?:da|de minha) empresa|empresa|negocio)\b/.test(trecho)) return "EMPRESA";
  if (/^(?:atendente|tom|jeito de atender|agendamento|agenda)\b/.test(trecho)) return "ATENDIMENTO";
  return null;
}
