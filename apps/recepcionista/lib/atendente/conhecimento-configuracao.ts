import { Prisma, type KnowledgeItem } from "@nexora/recepcionista-prisma";
import { ConfiguracaoErro, configuracaoNexaSchema, lerEnvelopeConfiguracao, type EnvelopeConfiguracaoNexa } from "./configuracao";

type ConhecimentoParaConfiguracao = Pick<KnowledgeItem, "id" | "question" | "answer">;

/**
 * Uma aprovação explícita atualiza somente o seu item. Quando já há uma
 * publicação, o mesmo item entra nela; outros rascunhos continuam pendentes.
 */
export function atualizarConhecimentoNoEnvelope(
  envelope: EnvelopeConfiguracaoNexa,
  item: ConhecimentoParaConfiguracao,
  acao: "APROVAR" | "REMOVER",
): EnvelopeConfiguracaoNexa {
  const id = `conhecimento:${item.id}`;
  const atualizar = (config: EnvelopeConfiguracaoNexa["rascunho"]) => {
    const anterior = config.conhecimento.itens;
    const existente = anterior.find((i) => i.id === id);
    if (acao === "REMOVER" && !existente || acao === "APROVAR" && existente?.pergunta === item.question
      && existente.resposta === item.answer && existente.situacao === "CONFIRMADO") return config;
    const itens = acao === "REMOVER" ? anterior.filter((i) => i.id !== id)
      : existente ? anterior.map((i) => i.id === id ? { ...i, pergunta: item.question, resposta: item.answer,
        situacao: "CONFIRMADO" as const, origem: "MANUAL" as const } : i)
        : [...anterior, { id, pergunta: item.question, resposta: item.answer, situacao: "CONFIRMADO" as const, origem: "MANUAL" as const }];
    const parsed = configuracaoNexaSchema.safeParse({ ...config, conhecimento: { ...config.conhecimento, itens } });
    if (!parsed.success) throw new ConfiguracaoErro("Não consegui incluir esse conhecimento na configuração. Revise o tamanho ou a quantidade de respostas antes de continuar.", 409);
    return parsed.data;
  };
  const rascunho = atualizar(envelope.rascunho);
  const ativa = envelope.publicado ? atualizar(envelope.publicado.rascunho) : null;
  const alterouPublicacao = !!envelope.publicado && ativa !== envelope.publicado.rascunho;
  if (rascunho === envelope.rascunho && !alterouPublicacao) return envelope;
  const revisao = envelope.revisao + 1;
  return {
    ...envelope,
    rascunho,
    revisao,
    revisadas: envelope.revisadas.filter((etapa) => etapa < 3),
    testes: [],
    ...(alterouPublicacao ? {
      historico: [...(envelope.historico ?? []), envelope.publicado!].slice(-5),
      publicado: { revisao, em: new Date().toISOString(), rascunho: ativa! },
    } : {}),
  };
}

const perguntasPublicadas = (config: EnvelopeConfiguracaoNexa["rascunho"]) => config.conhecimento.itens
  .filter(i => i.situacao === "CONFIRMADO").map(i => ({ question: i.pergunta, answer: i.resposta }));

function espelhoDePerguntas(valor: unknown): unknown {
  if (!Array.isArray(valor)) return null;
  return valor.map(i => i && typeof i === "object" ? { question: i.question, answer: i.answer } : null);
}

/** Executada na mesma transação da aprovação/exclusão do KnowledgeItem. */
export async function sincronizarConhecimentoNoRascunho(
  db: Prisma.TransactionClient,
  companyId: string,
  item: ConhecimentoParaConfiguracao,
  acao: "APROVAR" | "REMOVER",
): Promise<void> {
  const perfil = await db.companyProfile.findUnique({ where: { companyId }, select: { atendenteConfiguracao: true, faqs: true } });
  if (!perfil) throw new ConfiguracaoErro("Cadastro da empresa não encontrado.", 404);
  const envelope = lerEnvelopeConfiguracao(perfil.atendenteConfiguracao);
  // Contas anteriores à configuração por versões continuam usando o acervo
  // aprovado. Não cria uma publicação ou um rascunho incompleto em silêncio.
  if (!envelope) return;
  const novo = atualizarConhecimentoNoEnvelope(envelope, item, acao);
  if (novo === envelope) return;
  // Mantém o espelho operacional coerente quando ele ainda corresponde à
  // publicação. Uma edição externa divergente não é sobrescrita pelo ensino.
  const sincronizarEspelho = envelope.publicado && novo.publicado !== envelope.publicado
    && JSON.stringify(espelhoDePerguntas(perfil.faqs)) === JSON.stringify(perguntasPublicadas(envelope.publicado.rascunho));
  const escrita = await db.companyProfile.updateMany({
    where: { companyId, atendenteConfiguracao: { equals: perfil.atendenteConfiguracao as Prisma.InputJsonValue } },
    data: { atendenteConfiguracao: JSON.parse(JSON.stringify(novo)) as Prisma.InputJsonValue,
      ...(sincronizarEspelho ? { faqs: perguntasPublicadas(novo.publicado!.rascunho) as Prisma.InputJsonValue } : {}) },
  });
  if (escrita.count !== 1) throw new ConfiguracaoErro("A configuração mudou enquanto o conhecimento era salvo. Recarregue e tente novamente.", 409);
}
