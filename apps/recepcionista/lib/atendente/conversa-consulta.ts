import type { ConfiguracaoNexa, ServicoNexa } from "./configuracao-schema";

const normalizar = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const escapar = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contem = (texto: string, trecho: string) => new RegExp(`(?<![a-z0-9])${escapar(trecho)}(?![a-z0-9])`).test(texto);
const segredo = /\b(?:sk[-_]|gsk_)[a-z0-9_-]{12,}|\bBearer\s+\S+|\b(?:senha|password|secret|token|api[_ -]?key)\s*[:=]/i;

function perguntaDeConsulta(texto: string): boolean {
  const t = normalizar(texto);
  const semPedidoDeAlteracao = t.replace(/\b(?:sem|nao) (?:mudar|alterar|atualizar) (?:nada|nenhuma informacao)\b/g, "");
  if (!/[?]/.test(t) && !/^(?:(?:e|entao|mas)\s+)?(?:qual|quais|quanto|como ficou|me (?:diga|confirme|lembre))\b/.test(t)) return false;
  if (/\b(?:altere|alterar|mude|mudar|troque|trocar|defina|definir|atualize|atualizar|corrija|corrigir|adicione|adicionar|inclua|incluir|remova|remover|exclua|excluir|renomeie|renomear|salve|cobrar|cobre|aumentar|diminuir|baixar|invente|ignore|finja|system|prompt)\b/.test(semPedidoDeAlteracao)
    || /\b(?:se|caso|posso|poderia|deveria|talvez|hipoteticamente)\b.{0,60}\b(?:custa|cobro|cobrar|preco|valor|dura|duracao|nome)\b/.test(t)
    || /\b(?:antig[oa]s?|anteriores?|anteriormente|passad[oa]s?|historico|custava|custavam)\b|\bqual era\b/.test(t)
    || /\b(?:agora custa|passou a custar|quero chamar|vou cobrar|custa\s*(?:r\$\s*)?\d|dura\s*\d)\b/.test(t)) return false;
  // Uma declaração junto da pergunta precisa passar pela interpretação principal.
  return texto.split(/(?<=[.!?])\s+|;\s*|\n+/).filter(Boolean).every(parte => {
    const p = normalizar(parte);
    return /[?]/.test(p) || /^(?:(?:e|entao|mas)\s+)?(?:qual|quais|quanto|como ficou|me (?:diga|confirme|lembre))\b/.test(p)
      || /^(?:oi|ola|bom dia|boa tarde|boa noite|por favor|so quero conferir(?:,?\s+sem mudar nada)?|sem mudar nada)[!.\s]*$/.test(p);
  });
}

function grupoExplicito(servico: ServicoNexa, consulta: string): string | null {
  // A categoria precisa ter sido registrada na descrição. Não é inferida pelo nome.
  const descricao = normalizar(servico.descricao).replace(/[.!;]+$/, "");
  if (!descricao || descricao.length > 100 || !contem(consulta, descricao)) return null;
  return descricao;
}

function selecionarServico(servicos: ServicoNexa[], consulta: string): ServicoNexa | null {
  const grupos = [...new Set(servicos.map(s => grupoExplicito(s, consulta)).filter((g): g is string => !!g))];
  if (grupos.length > 1) return null;
  const candidatos = grupos.length ? servicos.filter(s => grupoExplicito(s, consulta) === grupos[0]) : servicos;
  const ordinal = consulta.match(/\b(?:o|a)?\s*(primeiro|primeira|segundo|segunda|terceiro|terceira|ultimo|ultima)\b/)?.[1];
  const mencoes = servicos.flatMap(s => [...consulta.matchAll(new RegExp(`(?<![a-z0-9])${escapar(normalizar(s.nome))}(?![a-z0-9])`, "g"))]
    .map(m => ({ servico: s, inicio: m.index!, fim: m.index! + m[0].length })));
  const explicitos = mencoes.filter(m => !mencoes.some(outro => outro.servico.id !== m.servico.id && outro.inicio <= m.inicio && outro.fim >= m.fim && outro.fim - outro.inicio > m.fim - m.inicio));
  const nomeados = [...new Map(explicitos.map(m => [m.servico.id, m.servico])).values()];
  if (nomeados.length > 1) return null;
  if (nomeados.length && !candidatos.some(s => s.id === nomeados[0].id)) return null;
  if (ordinal) {
    if (!grupos.length) return null;
    const indice = /^(?:ultimo|ultima)$/.test(ordinal) ? candidatos.length - 1 : /^(?:primeiro|primeira)$/.test(ordinal) ? 0 : /^(?:segundo|segunda)$/.test(ordinal) ? 1 : 2;
    const alvo = candidatos[indice];
    return alvo && (!nomeados.length || nomeados[0].id === alvo.id) ? alvo : null;
  }
  if (nomeados.length) return nomeados[0];
  const curtos = candidatos.filter(s => (normalizar(s.nome).match(/[a-z]{4,}/g) ?? []).some(palavra =>
    new RegExp(`\\b(?:o|a|do|da|esse|essa|este|esta)\\s+${escapar(palavra)}\\b`).test(consulta)));
  if (curtos.length) return curtos.length === 1 ? curtos[0] : null;
  // Um único item no catálogo não prova que uma pergunta sobre outro nome
  // desconhecido se refere a ele. O grupo explícito pode ter apenas um item.
  return grupos.length && candidatos.length === 1 ? candidatos[0] : null;
}

/** Consulta canônica de dados atuais. Nunca executa ou transforma a pergunta em configuração. */
export function consultarDadosDaConfiguracao(c: ConfiguracaoNexa, texto: string): { texto: string; somenteResposta: true } | null {
  if (!perguntaDeConsulta(texto)) return null;
  const t = normalizar(texto);
  // Consultas combinadas com uma explicação do produto ficam com o diálogo
  // principal, para não responder apenas uma parte da pergunta.
  if (/\b(?:teste|testar|simulador|conectar|conexao|agendamento|agenda)\b/.test(t)
    || (texto.match(/\?/g)?.length ?? 0) > 1) return null;
  if (/\b(?:nome|chama)\b/.test(t) && /\b(?:empresa|negocio)\b/.test(t)) {
    const nome = c.negocio.nome.trim();
    if (segredo.test(nome)) return null;
    return { texto: nome && normalizar(nome) !== "minha empresa" ? `O nome informado para a empresa é ${nome}.` : "O nome da empresa ainda não foi informado.", somenteResposta: true };
  }
  const querPreco = /\b(?:preco|precos|valor|valores|custa|custam|cobram)\b|\bquanto (?:e|fica)\b/.test(t);
  const querDuracao = /\b(?:duracao|tempo|demora|dura|duram|minutos?|horas?)\b/.test(t);
  if (!querPreco && !querDuracao) return null;
  const servico = selecionarServico(c.informacoes.servicos.filter(s => s.situacao === "CONFIRMADO" && s.nome.trim()), t);
  if (!servico || segredo.test(servico.nome)) return null;
  const dados: string[] = [];
  if (querPreco) dados.push(servico.precoModo === "SOB_CONSULTA" ? "valor sob consulta" : servico.precoCents === null ? "valor ainda não informado"
    : (servico.precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " "));
  if (querDuracao) dados.push(servico.duracaoMin === null ? "duração ainda não informada" : `duração de ${servico.duracaoMin} ${servico.duracaoMin === 1 ? "minuto" : "minutos"}`);
  return { texto: `${servico.nome}: ${dados.join("; ")}.`, somenteResposta: true };
}
