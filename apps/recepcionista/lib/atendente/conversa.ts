import { z } from "zod";
import { configuracaoDaIaFaltando, configurationCompletion, metadadosFalhaDaIa, type jsonCompletion } from "@/lib/ai/provider";
import { ConfiguracaoErro, getContextoConversaConfiguracao, salvarTurnoConversaConfiguracao } from "./configuracao";
import type { EstadoConversaConfiguracao, RespostaConversaConfiguracao } from "./conversa-schema";
import { manterEsclarecimento } from "./conversa-schema";
import type { ConfiguracaoNexa } from "./configuracao-schema";
import { extracaoDeConversaSchema, FORMATO_EXTRACAO_CONVERSA, PROMPT_EXTRACAO_CONVERSA, perguntaDeContinuacaoConfiguracao, preencherPorConversa, proximaPerguntaDaConfiguracao } from "./conversa-motor";
import { campoPertenceAoTopico, IDS_TOPICOS_CONFIGURACAO, resumirTopicosConfiguracao, topicoDaChave, type TopicoConfiguracao } from "./configuracao-topicos";
import { explicacaoDaAtualizacaoDaConfiguracao, explicacaoDoProdutoPorFonte, respostaDoDialogoConfiguracao } from "./conversa-dialogo";
import { contextoParaDialogoConfiguracao } from "./conversa-contexto";
import { estadoParaPerguntas, mudancaExplicitaDeTopico, preferenciasDaConversa } from "./conversa-conducao";
import { consultarDadosDaConfiguracao } from "./conversa-consulta";

export { preencherPorConversa, proximaPerguntaDaConfiguracao } from "./conversa-motor";
export const topicoConfiguracaoSchema = z.enum(IDS_TOPICOS_CONFIGURACAO);
export const mensagemConversaConfiguracaoSchema = z.object({
  revisao: z.number().int().min(0),
  mensagemId: z.string().uuid(),
  texto: z.string().trim().min(1).max(6000),
  perguntaChave: z.string().max(300).nullable(),
  topico: topicoConfiguracaoSchema.nullable().optional(),
}).strict();

export function perguntaAtual(rascunho: ConfiguracaoNexa, conversa: EstadoConversaConfiguracao, topico?: TopicoConfiguracao | null) {
  const mudouDeAssunto = Boolean(topico && topico !== conversa.topicoAtual);
  if (conversa.perguntaSuspensa && !mudouDeAssunto) return null;
  const pendente = manterEsclarecimento(conversa.perguntaPendente, rascunho, rascunho, conversa.ignoradas);
  return pendente && campoPertenceAoTopico(pendente.chave, topico) ? pendente
    : proximaPerguntaDaConfiguracao(rascunho, { ...estadoParaPerguntas(rascunho, conversa), perguntaSuspensa: false, perguntaPendente: null }, topico);
}

function assuntoAtual(rascunho: ConfiguracaoNexa, conversa: EstadoConversaConfiguracao, topico?: TopicoConfiguracao | null): TopicoConfiguracao {
  return topico ?? conversa.topicoAtual ?? topicoDaChave(manterEsclarecimento(conversa.perguntaPendente, rascunho, rascunho, conversa.ignoradas)?.chave ?? "")
    ?? topicoDaChave(proximaPerguntaDaConfiguracao(rascunho, { ...estadoParaPerguntas(rascunho, conversa), perguntaPendente: null, perguntaSuspensa: false })?.chave ?? "") ?? "EMPRESA";
}

export async function getConversaConfiguracao(companyId: string, topico?: TopicoConfiguracao | null): Promise<RespostaConversaConfiguracao> {
  const contexto = await getContextoConversaConfiguracao(companyId);
  const atual = assuntoAtual(contexto.tela.rascunho, contexto.conversa, topico);
  // O GET é só leitura; o assunto será persistido junto da próxima mensagem.
  const escopo = topico ?? contexto.conversa.topicoAtual ?? atual;
  const retomada = topico ? { ...contexto.conversa, perguntaSuspensa: false } : contexto.conversa;
  return { tela: contexto.tela, mensagens: contexto.conversa.mensagens, pergunta: perguntaAtual(contexto.tela.rascunho, retomada, escopo), alteracoes: [],
    topicoAtual: atual, topicos: resumirTopicosConfiguracao(contexto.tela.rascunho, contexto.tela.pendencias, contexto.conversa.ignoradas) };
}

type DependenciasDaConversa = {
  interpretar: typeof jsonCompletion;
  iaDisponivel: () => boolean;
  agora: () => Date;
};
const dependenciasReais: DependenciasDaConversa = { interpretar: configurationCompletion, iaDisponivel: () => !configuracaoDaIaFaltando(), agora: () => new Date() };

/** Mesmo processamento em produção e nos testes reais em memória; nenhuma escrita aqui. */
export async function prepararTurnoDeConfiguracao(rascunho: ConfiguracaoNexa, conversa: EstadoConversaConfiguracao,
  input: z.infer<typeof mensagemConversaConfiguracaoSchema>, deps: DependenciasDaConversa = dependenciasReais) {
    const conversaLivre = !input.topico && !conversa.topicoAtual && input.perguntaChave === null;
    const focoAnterior = assuntoAtual(rascunho, conversa, input.topico);
    const pergunta = input.perguntaChave === null ? null : perguntaAtual(rascunho, conversa, focoAnterior);
    if (input.perguntaChave !== (pergunta?.chave ?? null)) throw new ConfiguracaoErro("A conversa avançou em outra tela. Recarregue a pergunta antes de responder.", 409);
    const foco = mudancaExplicitaDeTopico(input.texto) ?? focoAnterior;
    const preferencias = preferenciasDaConversa(conversa, input.texto);
    const memoria = { ...conversa, camposAdiados: preferencias, topicoAtual: foco };
    let extracao: unknown;
    let contexto: ReturnType<typeof contextoParaDialogoConfiguracao> | undefined;
    const normalizar = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim().replace(/[.!]+$/, "");
    const atalhoVisivel = pergunta && (/^(?:pular|definir depois)$/i.test(input.texto.trim())
      || pergunta.sugestoes.some(s => normalizar(s) === normalizar(input.texto)));
    // Uma conferência inequívoca lê o cadastro atual. Não precisa reinterpretar
    // fatos com o modelo nem transformar a pergunta em uma nova configuração.
    const consultaDeNome = /^(?:qual (?:e )?o?\s*nome (?:da|do) (?:minha |meu |nossa |nosso |sua |seu )?(?:empresa|negocio)|como se chama (?:a|o) (?:minha |meu |nossa |nosso |sua |seu )?(?:empresa|negocio))\s*\??$/.test(normalizar(input.texto));
    const consultaDireta = (consultaDeNome ? consultarDadosDaConfiguracao(rascunho, input.texto) : null)
      ?? explicacaoDaAtualizacaoDaConfiguracao(input.texto);
    if (consultaDireta) {
      extracao = extracaoDeConversaSchema.parse({
        nome: null, segmento: null, descricao: null, endereco: null, regiao: null,
        pagamento: null, nomeAtendente: null, modalidade: null, objetivo: null,
        jeito: null, quando: null, agendamento: null, horarios: [], servicos: [],
        perguntas: [], esclarecimento: null, continuacao: null,
        dialogo: { intencao: "PERGUNTAR", resposta: consultaDireta.texto, fontesIds: [] },
      });
    }
    if (deps.iaDisponivel() && !atalhoVisivel && !consultaDireta) {
      try {
        contexto = contextoParaDialogoConfiguracao(rascunho, memoria, input.texto, pergunta, foco);
        const { HISTORICO_RECENTE, MENSAGEM_ATUAL, ...dados } = contexto;
        const messages = HISTORICO_RECENTE.map(m => ({ role: m.de === "dono" ? "user" as const : "assistant" as const, content: m.texto }));
        // A fala atual é o último turno real. O cadastro é contexto de consulta, não outra fala do dono.
        messages.push({ role: "user", content: MENSAGEM_ATUAL });
        const raw = await deps.interpretar(PROMPT_EXTRACAO_CONVERSA, JSON.stringify(dados), 3072, FORMATO_EXTRACAO_CONVERSA, { messages });
        extracao = extracaoDeConversaSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
      } catch (error) {
        console.warn("[configuracao-conversa] interpretacao_indisponivel", {
          motivo: error instanceof z.ZodError ? "contrato" : error instanceof SyntaxError ? "json" : error instanceof RangeError ? "tamanho" : "provedor",
          ...(typeof metadadosFalhaDaIa === "function" ? metadadosFalhaDaIa(error) : {}),
        });
        // Uma falha do modelo não significa que o dono se explicou mal. A tentativa
        // permanece no navegador; nenhum fato ou turno parcial é gravado.
        throw new ConfiguracaoErro("Não consegui responder agora. Sua mensagem continua aqui. Toque em tentar de novo.", 503);
      }
    }
    if (!atalhoVisivel && !consultaDireta && !deps.iaDisponivel() && deps === dependenciasReais) {
      throw new ConfiguracaoErro("A conversa está indisponível agora. Sua mensagem continua aqui para tentar de novo.", 503);
    }
    const pendenteAnterior = manterEsclarecimento(conversa.perguntaPendente, rascunho, rascunho, conversa.ignoradas);
    const resultado = preencherPorConversa(rascunho, input.texto, { ...conversa, perguntaPendente: pergunta, perguntaSuspensa: pergunta === null }, extracao);
    const remapear = (v: string) => Object.entries(resultado.remapeamentosIds ?? {}).reduce((a, [antes, depois]) => a.replace(`servico:${antes}:`, `servico:${depois}:`), v);
    const contrato = extracaoDeConversaSchema.safeParse(extracao);
    if (contrato.success) {
      if (contrato.data.continuacao) contrato.data.continuacao.campo = remapear(contrato.data.continuacao.campo);
      if (contrato.data.dialogo) contrato.data.dialogo.fontesIds = contrato.data.dialogo.fontesIds.map(id => resultado.remapeamentosIds?.[id.replace(/^servico:/, "")] ? `servico:${resultado.remapeamentosIds[id.replace(/^servico:/, "")]}` : id);
      extracao = contrato.data;
    }
    const memoriaAtual = { ...memoria, ignoradas: resultado.ignoradas };
    const dialogo = resultado.esclarecimento ? null : consultaDireta ?? consultarDadosDaConfiguracao(resultado.rascunho, input.texto)
      ?? respostaDoDialogoConfiguracao(extracao, resultado.rascunho, input.texto)
      ?? explicacaoDoProdutoPorFonte(extracao, contexto?.FONTES_DIALOGO ?? [], input.texto);
    const analise = extracaoDeConversaSchema.safeParse(extracao);
    const duvidaExplicita = input.texto.includes("?") || /^(?:como|qual|quais|por que|o que|me explique|pode me explicar|nao entendi|não entendi)\b/i.test(input.texto.trim());
    const intencaoDePergunta = duvidaExplicita && !resultado.alteracoes.length
      || analise.success && (analise.data.dialogo?.intencao === "PERGUNTAR" || analise.data.dialogo?.intencao === "MISTO" && duvidaExplicita)
      || Boolean(dialogo && duvidaExplicita && !resultado.alteracoes.length);
    const continuacao = !intencaoDePergunta ? perguntaDeContinuacaoConfiguracao(extracao, resultado.rascunho,
      estadoParaPerguntas(resultado.rascunho, memoriaAtual), foco) : null;
    const adiouPerguntaVisivel = atalhoVisivel && /^(?:pular|definir depois)$/i.test(input.texto.trim());
    const pendente = resultado.esclarecimento ?? continuacao
      ?? (adiouPerguntaVisivel ? null : manterEsclarecimento(pendenteAnterior, rascunho, resultado.rascunho, resultado.ignoradas));
    const servicosAnotados = resultado.alteracoes.filter(a => a.startsWith("Serviço: ")).map(a => a.slice("Serviço: ".length));
    const adiouAgora = preferencias.some(campo => !(conversa.camposAdiados ?? []).includes(campo));
    const confirmacao = dialogo?.texto ?? (intencaoDePergunta && !resultado.esclarecimento
      ? "Preciso entender melhor essa dúvida para responder com segurança. Pode me explicar o que você quer configurar?"
      : resultado.resposta) ?? (adiouAgora ? "Combinado, deixamos essa parte para depois. Pode continuar me contando os serviços."
      : servicosAnotados.length && servicosAnotados.length === resultado.alteracoes.length ? `Anotei ${servicosAnotados.join(" e ")}.`
      : resultado.alteracoes.length === 1 && resultado.alteracoes[0] === "Horários informados" ? "Anotei os horários."
      : resultado.alteracoes.length ? "Atualizei essas informações." : "");
    // Uma explicação ou preferência não é seguida de uma pergunta obrigatória do roteiro.
    const suspensa = !resultado.esclarecimento && !continuacao && (conversaLivre || intencaoDePergunta || adiouAgora || !!dialogo && !resultado.alteracoes.length || confirmacao.includes("?"));
    let proxima = resultado.esclarecimento ?? continuacao ?? (suspensa ? null
      : pendente && campoPertenceAoTopico(pendente.chave, foco) ? pendente
      : proximaPerguntaDaConfiguracao(resultado.rascunho, { ...estadoParaPerguntas(resultado.rascunho, memoriaAtual), perguntaPendente: null, perguntaSuspensa: false }, foco));
    // O dono não precisa descobrir um botão para continuar quando um assunto termina.
    if (!proxima && !suspensa && foco) {
      const seguintes = IDS_TOPICOS_CONFIGURACAO.slice(IDS_TOPICOS_CONFIGURACAO.indexOf(foco) + 1);
      for (const assunto of seguintes) {
        proxima = proximaPerguntaDaConfiguracao(resultado.rascunho, { ...estadoParaPerguntas(resultado.rascunho, memoriaAtual), perguntaPendente: null, perguntaSuspensa: false }, assunto);
        if (proxima) break;
      }
    }
    const ativo = topicoDaChave(proxima?.chave ?? "") ?? foco ?? null;
    const ids = new Set(resultado.rascunho.informacoes.servicos.map(s => s.id));
    const remapId = (id: string | null | undefined) => id ? resultado.remapeamentosIds?.[id] ?? id : null;
    const anteriorFoco = remapId(conversa.memoriaSemantica?.servicoEmFocoId);
    const modeloFoco = analise.success ? remapId(analise.data.conducao?.servicoEmFocoId) : null;
    const alterados = resultado.rascunho.informacoes.servicos.filter(s => JSON.stringify(s) !== JSON.stringify(rascunho.informacoes.servicos.find(a => a.id === s.id)));
    const focoPergunta = resultado.rascunho.informacoes.servicos.find(s => proxima?.chave.startsWith(`servico:${s.id}:`) || proxima?.chave.startsWith(`esclarecimento:servico:${s.id}:`))?.id;
    const focoServico = ativo === "SERVICOS" ? focoPergunta ?? (modeloFoco && ids.has(modeloFoco) ? modeloFoco : null) ?? alterados.at(-1)?.id ?? (anteriorFoco && ids.has(anteriorFoco) ? anteriorFoco : null) : null;
    const categorias = new Set(conversa.memoriaSemantica?.categorias ?? []);
    if (analise.success) for (const s of analise.data.servicos) if (s.categoria && resultado.rascunho.informacoes.servicos.some(a => a.descricao.toLowerCase().includes(s.categoria!.toLowerCase()))) categorias.add(s.categoria);
    const encerramento = "Você pode continuar neste assunto ou seguir para o próximo quando quiser.";
    const resposta = [confirmacao, proxima?.texto ?? (!suspensa && !confirmacao ? encerramento : null)].filter(Boolean).join("\n\n");
    const em = deps.agora().toISOString();
    const estado: EstadoConversaConfiguracao = { ...memoriaAtual,
      mensagens: [...conversa.mensagens,
        { id: input.mensagemId, de: "dono" as const, texto: input.texto, em, topico: ativo },
        { id: `resposta:${input.mensagemId}`, de: "atendente" as const, texto: resposta || encerramento, em, topico: ativo },
      ].slice(-80), ultimaPergunta: proxima?.chave ?? null, perguntaPendente: pendente,
      perguntaSuspensa: !proxima, topicoAtual: ativo,
      memoriaSemantica: { servicoEmFocoId: focoServico, categorias: [...categorias].slice(-40), listaServicosConcluida: resultado.ignoradas.includes("informacoes.servicos") },
    };
    const aviso = resultado.aviso;
    return { rascunho: resultado.rascunho, conversa: estado, alteracoes: resultado.alteracoes,
      ...(aviso ? { aviso } : {}), revisarInformacoes: !suspensa && proximaPerguntaDaConfiguracao(resultado.rascunho, { ...resultado, perguntaSuspensa: false }) === null };
}

export async function conversarConfiguracao(companyId: string, entrada: z.infer<typeof mensagemConversaConfiguracaoSchema>,
  deps: DependenciasDaConversa = dependenciasReais): Promise<RespostaConversaConfiguracao> {
  const input = mensagemConversaConfiguracaoSchema.parse(entrada);
  const salvo = await salvarTurnoConversaConfiguracao(companyId, input, (rascunho, conversa) => prepararTurnoDeConfiguracao(rascunho, conversa, input, deps));
  return { tela: salvo.tela, mensagens: salvo.conversa.mensagens,
    pergunta: perguntaAtual(salvo.tela.rascunho, salvo.conversa, salvo.conversa.topicoAtual ?? input.topico), alteracoes: salvo.alteracoes,
    topicoAtual: salvo.conversa.topicoAtual ?? input.topico ?? null, topicos: resumirTopicosConfiguracao(salvo.tela.rascunho, salvo.tela.pendencias, salvo.conversa.ignoradas),
    ...(salvo.aviso ? { aviso: salvo.aviso } : {}) };
}
