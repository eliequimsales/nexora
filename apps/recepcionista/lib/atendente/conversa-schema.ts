import type { ConfiguracaoNexa, TelaConfiguracaoNexa } from "./configuracao-schema";
import type { ResumoTopicoConfiguracao, TopicoConfiguracao } from "./configuracao-topicos";

/** Contrato da conversa administrativa; nunca é uma conversa com clientes. */
export type MensagemDeConfiguracao = {
  id: string;
  de: "dono" | "atendente";
  texto: string;
  em: string;
  topico?: TopicoConfiguracao | null;
};

export type PerguntaDeConfiguracao = { chave: string; texto: string; sugestoes: string[] };

export type RespostaConversaConfiguracao = {
  tela: TelaConfiguracaoNexa;
  mensagens: MensagemDeConfiguracao[];
  pergunta: PerguntaDeConfiguracao | null;
  alteracoes: string[];
  aviso?: string;
  topicoAtual?: TopicoConfiguracao | null;
  topicos?: ResumoTopicoConfiguracao[];
};

/** Persistido no mesmo envelope do rascunho, por empresa. */
export type EstadoConversaConfiguracao = {
  mensagens: MensagemDeConfiguracao[];
  ignoradas: string[];
  ultimaPergunta: string | null;
  /** Esclarecimento contextual que precisa sobreviver ao recarregamento. */
  perguntaPendente?: PerguntaDeConfiguracao | null;
  /** Conversa livre sem pergunta ativa; não vincula a próxima fala a um campo oculto. */
  perguntaSuspensa?: boolean;
  /** Assunto retomado ao voltar à configuração, sem depender da última frase. */
  topicoAtual?: TopicoConfiguracao | null;
  /** Preferências de condução, nunca fatos ou políticas de atendimento. */
  camposAdiados?: string[];
  /** Entendimento persistente, separado dos dados públicos da empresa. */
  memoriaSemantica?: {
    servicoEmFocoId: string | null;
    categorias: string[];
    listaServicosConcluida: boolean;
  };
};

function assuntoDaPergunta(c: ConfiguracaoNexa, chave: string): unknown {
  const campo = chave.replace(/^esclarecimento:/, "").replace(/:(?:revisar|restantes)$/, "");
  const servico = campo.match(/^servico:(.+):(preco|duracao|condicaoPreco)$/);
  if (servico) {
    const s = c.informacoes.servicos.find(item => item.id === servico[1]);
    if (!s) return undefined;
    return servico[2] === "preco" ? [s.nome, s.precoModo, s.precoCents] : servico[2] === "duracao" ? [s.nome, s.duracaoMin] : [s.nome, s.precoModo, s.descricao];
  }
  if (campo.startsWith("servico:")) return c.informacoes.servicos.find(s => campo === `servico:${s.id}`);
  if (campo === "atendimento.antecedenciaHoras") return c.atendimento.gestaoReservas?.antecedenciaHoras;
  const [grupo, atributo] = campo.split(".");
  if (grupo === "negocio") return c.negocio[atributo as keyof typeof c.negocio];
  if (grupo === "informacoes") return c.informacoes[atributo as keyof typeof c.informacoes];
  if (grupo === "atendimento") return c.atendimento[atributo as keyof typeof c.atendimento];
  if (campo === "conhecimento" || campo.startsWith("pergunta:")) return c.conhecimento;
  return undefined;
}

/** Uma pergunta não pode continuar apontando para um campo resolvido ou item removido. */
export function manterEsclarecimento(pendente: PerguntaDeConfiguracao | null | undefined,
  anterior: ConfiguracaoNexa, atual: ConfiguracaoNexa, ignoradas: string[] = []): PerguntaDeConfiguracao | null {
  if (!pendente) return null;
  const chave = pendente.chave.replace(/^esclarecimento:/, "");
  // Encerrar a lista evita pedir novos itens. Uma dúvida sobre alterar um item
  // existente continua válida e precisa sobreviver à recarga da conversa.
  if (ignoradas.some(item => (item === chave || chave.startsWith(`${item}:`))
    && !(item === "informacoes.servicos" && chave === item && pendente.chave.startsWith("esclarecimento:")))) return null;
  const antes = assuntoDaPergunta(anterior, pendente.chave);
  const depois = assuntoDaPergunta(atual, pendente.chave);
  return depois !== undefined && JSON.stringify(antes) === JSON.stringify(depois) ? pendente : null;
}
