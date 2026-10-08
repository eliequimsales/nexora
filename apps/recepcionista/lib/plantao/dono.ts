import { prisma } from "@/lib/db";
import type { MensagemDoDono } from "@/lib/whatsapp/evolution";
import { ehEnvioDaNexora } from "@/lib/whatsapp/envio";
import { recordTeamObservation } from "@/lib/training";

/**
 * O DONO ASSUMIU A CONVERSA?
 *
 * Toda mensagem que sai do número do dono chega pelo webhook com `fromMe` — a
 * que ele digitou no celular e a que a Nexora enviou por ele. O registro de
 * envios (lib/whatsapp/envio.ts) separa as duas. Como o eco pode chegar antes
 * de o envio terminar de ser registrado, id desconhecido ganha uma segunda
 * conferência depois de ESPERA_DO_ECO_MS.
 *
 * Errar para um lado cala o Plantão depois da própria resposta; para o outro,
 * faz o Plantão responder por cima do dono. Na dúvida sem id, vale o dono.
 */

export const ESPERA_DO_ECO_MS = 2_500;

/** Mais velha que isto, é o WhatsApp sincronizando histórico — não o dono agora. */
export const IDADE_MAXIMA_MS = 10 * 60_000;

/**
 * Detecta se uma mensagem é apenas saudação, despedida ou confirmação monossilábica.
 * Mensagens assim pertencem ao histórico da conversa, mas NÃO devem virar regra de FAQ.
 */
export function ehSaudacaoOuDescarte(texto: string): boolean {
  const limpo = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (limpo.length < 3) return true;

  // Frases inteiras comuns de saudação, despedida ou confirmação
  const frasesDescarte = [
    /^(oi|ola|opa|e ai|ei)\s*(tudo\s*bem|tudo\s*bom|como\s*vai|bom\s*dia|boa\s*tarde|boa\s*noite)?$/,
    /^(bom\s*dia|boa\s*tarde|boa\s*noite)\s*(tudo\s*bem|tudo\s*bom|como\s*vai)?$/,
    /^(tudo\s*bem|tudo\s*bom|como\s*vai)$/,
    /^(tchau|ate\s*mais|ate\s*logo|ate\s*amanha|ate\s*breve|abraco|valeu|falou)$/,
    /^(ok|beleza|blz|fechado|combinado|certo|entendido|perfeito|tranquilo|sim|nao|ta\s*bom|ta\s*ok|isso|pode\s*ser)$/,
    /^(obrigado|obrigada|por\s*nada|de\s*nada|disponha|tmj)$/,
  ];

  if (frasesDescarte.some((rx) => rx.test(limpo))) {
    return true;
  }

  const palavrasDescarte = new Set([
    "oi", "ola", "opa", "ei", "ai", "bom", "boa", "dia", "tarde", "noite",
    "tudo", "bem", "como", "vai", "tchau", "ate", "mais", "logo", "amanha",
    "breve", "abraco", "valeu", "falou", "ok", "beleza", "blz", "fechado",
    "combinado", "certo", "entendido", "perfeito", "tranquilo", "sim", "nao",
    "ta", "isso", "obrigado", "obrigada", "por", "nada", "de", "disponha", "tmj",
  ]);

  const palavras = limpo.split(" ");
  if (palavras.length <= 4 && palavras.every((p) => palavrasDescarte.has(p))) {
    return true;
  }

  return false;
}

/**
 * Associa a resposta do dono à pergunta correta quando o cliente fez mais de uma pergunta.
 * Exemplo: cliente pergunta "Quanto custa o clareamento?" e depois "Aceitam Unimed?".
 * Se o dono responde "O clareamento é R$ 350", associa ao preço do clareamento, NÃO ao convênio.
 */
export function selecionarPerguntaParaResposta(
  perguntasCliente: string[],
  respostaDono: string,
): string {
  if (perguntasCliente.length === 0) return "";
  if (perguntasCliente.length === 1) return perguntasCliente[0];

  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const stopWords = new Set([
    "a", "o", "as", "os", "de", "do", "da", "dos", "das", "em", "no", "na",
    "nos", "nas", "por", "pelo", "pela", "pelos", "pelas", "com", "sem",
    "um", "uma", "uns", "umas", "e", "ou", "que", "se", "para", "pra",
    "tem", "voce", "voces", "vc", "vcs", "eu", "ele", "ela",
    "me", "te", "nos", "lhe", "lhes", "meu", "minha", "seu", "sua",
    "qual", "quais", "quanto", "quantos", "quanta", "quantas", "como",
    "onde", "quando", "quem", "por que", "porque", "eh", "sao", "foi",
  ]);

  const respNorm = normalizar(respostaDono);
  const tokensResp = respNorm
    .split(" ")
    .filter((w) => w.length >= 3 && !stopWords.has(w));
  const tokensRespSet = new Set(tokensResp);

  // Heurísticas semânticas temáticas
  const temPreco = /\b(r\$|\$|reais|custa|valor|preco|cobramos|sai por|\d+)\b/i.test(respostaDono);
  const temConvenio = /\b(unimed|bradesco|amil|sulamerica|notredame|convenio|plano|particular)\b/i.test(respNorm);
  const temHorario = /\b(hora|horario|segunda|terca|quarta|quinta|sexta|sabado|domingo|aberto|fechado|as \d+|\d+h)\b/i.test(respNorm);
  const temEndereco = /\b(rua|av|avenida|bairro|numero|local|endereco|fica em|fica na|fica no|perto)\b/i.test(respNorm);

  let melhorIndice = 0;
  let melhorScore = -1;

  for (let i = 0; i < perguntasCliente.length; i++) {
    const perg = perguntasCliente[i];
    const pergNorm = normalizar(perg);
    const tokensPerg = pergNorm.split(" ").filter((w) => w.length >= 3 && !stopWords.has(w));

    let score = 0;

    // 1. Sobreposição de palavras-chave
    for (const t of tokensPerg) {
      if (tokensRespSet.has(t)) {
        score += t.length >= 5 ? 3 : 2;
      } else if (tokensResp.some((r) => r.includes(t) || t.includes(r))) {
        score += 1;
      }
    }

    // 2. Alinhamento de Preço / Valor
    if (temPreco && /\b(quanto|custa|valor|preco|tabela|pagar|cobre|orcamento)\b/i.test(pergNorm)) {
      score += 4;
    }

    // 3. Alinhamento de Convênio / Plano
    if (temConvenio && /\b(convenio|plano|unimed|bradesco|amil|aceita|atende)\b/i.test(pergNorm)) {
      score += 4;
    }

    // 4. Alinhamento de Horário / Agendamento
    if (temHorario && /\b(quando|horario|hora|aberto|funciona|atende|atendimento|abre|fecha|agenda|marcar)\b/i.test(pergNorm)) {
      score += 4;
    }

    // 5. Alinhamento de Endereço / Localização
    if (temEndereco && /\b(onde|local|localizacao|endereco|fica|como chego)\b/i.test(pergNorm)) {
      score += 4;
    }

    if (score > melhorScore) {
      melhorScore = score;
      melhorIndice = i;
    }
  }

  return perguntasCliente[melhorIndice];
}

export type DependenciasDoDono = {
  ehEnvioDaNexora: (instance: string, messageId: string) => Promise<boolean>;
  esperar: (ms: number) => Promise<void>;
  /** Marca a hora na conversa com esse telefone. false quando a conexão não é de empresa nenhuma. */
  marcarQueODonoAssumiu: (
    instance: string,
    phone: string,
    quando: Date,
    texto?: string | null,
    messageId?: string | null,
  ) => Promise<boolean>;
};

export type ResultadoDoDono = "ECO_DA_NEXORA" | "DONO_ASSUMIU" | "ANTIGA" | "SEM_EMPRESA";

export async function registrarMensagemDoDono(
  msg: MensagemDoDono,
  deps: DependenciasDoDono,
  agora: Date = new Date(),
): Promise<ResultadoDoDono> {
  if (msg.enviadaEm && agora.getTime() - msg.enviadaEm.getTime() > IDADE_MAXIMA_MS) return "ANTIGA";

  if (msg.messageId) {
    if (await deps.ehEnvioDaNexora(msg.instance, msg.messageId)) return "ECO_DA_NEXORA";
    await deps.esperar(ESPERA_DO_ECO_MS);
    if (await deps.ehEnvioDaNexora(msg.instance, msg.messageId)) return "ECO_DA_NEXORA";
  }

  const marcou = await deps.marcarQueODonoAssumiu(
    msg.instance,
    msg.phone,
    msg.enviadaEm ?? agora,
    msg.text,
    msg.messageId,
  );
  return marcou ? "DONO_ASSUMIU" : "SEM_EMPRESA";
}

export const dependenciasReais: DependenciasDoDono = {
  ehEnvioDaNexora,
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  async marcarQueODonoAssumiu(instance, phone, quando, texto, messageId) {
    const perfil = await prisma.companyProfile.findUnique({
      where: { whatsappInstance: instance },
      select: { companyId: true },
    });
    if (!perfil) return false;

    // Idempotência: se esta mensagem já foi registrada (ex.: retry do webhook), evita duplicata
    if (messageId) {
      const jaExiste = await prisma.message.findFirst({
        where: { whatsappMessageId: messageId },
        select: { id: true },
      });
      if (jaExiste) return true;
    }

    // Cria ou atualiza a conversa quando o dono responde ou inicia pelo celular
    const conversa = await prisma.conversation.upsert({
      where: { companyId_customerPhone: { companyId: perfil.companyId, customerPhone: phone } },
      create: { companyId: perfil.companyId, customerPhone: phone, donoAssumiuEm: quando },
      update: { donoAssumiuEm: quando },
      select: { id: true },
    });

    if (texto && texto.trim()) {
      const conteudo = texto.trim();

      // Grava no histórico preservando o ID único para idempotência
      await prisma.message.create({
        data: {
          conversationId: conversa.id,
          role: "HUMAN",
          content: conteudo,
          whatsappMessageId: messageId ?? undefined,
        },
      });

      // Se for apenas saudação, despedida ou confirmação ("Olá", "Ok", "Até amanhã"),
      // não cria nem altera itens de conhecimento
      if (ehSaudacaoOuDescarte(conteudo)) {
        return true;
      }

      // Busca mensagens recentes para entender o contexto real da conversa
      const mensagensRecentes = await prisma.message.findMany({
        where: { conversationId: conversa.id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { role: true, content: true, createdAt: true },
      });

      // Localiza perguntas substantivas do cliente na ordem cronológica recente
      const mensagensCliente = mensagensRecentes.filter((m) => m.role === "CUSTOMER");
      const duvidasSubstantivas = mensagensCliente
        .map((m) => m.content.trim())
        .filter((c) => !ehSaudacaoOuDescarte(c));

      // Seleciona com precisão semântica qual pergunta do cliente o dono realmente respondeu
      const perguntaCliente =
        selecionarPerguntaParaResposta(duvidasSubstantivas, conteudo) ||
        mensagensCliente[0]?.content?.trim();

      if (perguntaCliente && perguntaCliente.length >= 4) {
        const quinzeMinutosAtras = new Date(Date.now() - 15 * 60_000);
        const sourceConversa = `TEAM_OBSERVATION:${conversa.id}`;

        // Agrupamento estritamente ISOLADO para esta conversa específica:
        // respostas de clientes distintos NUNCA são mescladas entre si
        const observacaoRecente = await prisma.knowledgeItem.findFirst({
          where: {
            companyId: perfil.companyId,
            source: sourceConversa,
            status: "OBSERVED",
            createdAt: { gte: quinzeMinutosAtras },
          },
          orderBy: { createdAt: "desc" },
        });

        if (observacaoRecente) {
          if (!observacaoRecente.answer.includes(conteudo)) {
            const respostaCombinada = `${observacaoRecente.answer} ${conteudo}`.trim().slice(0, 1500);
            await prisma.knowledgeItem.update({
              where: { id: observacaoRecente.id },
              data: { answer: respostaCombinada },
            });
          }
        } else {
          await recordTeamObservation(
            perfil.companyId,
            perguntaCliente,
            conteudo,
            conversa.id,
          );
        }
      }
    }

    return true;
  },
};
