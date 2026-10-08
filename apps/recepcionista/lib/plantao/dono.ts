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

      // Localiza a pergunta real do cliente (ignorando saudações isoladas como "Oi")
      const mensagensCliente = mensagensRecentes.filter((m) => m.role === "CUSTOMER");
      const perguntaSubstantiva = mensagensCliente.find((m) => !ehSaudacaoOuDescarte(m.content));
      const perguntaCliente = (perguntaSubstantiva ?? mensagensCliente[0])?.content?.trim();

      if (perguntaCliente && perguntaCliente.length >= 4) {
        const quinzeMinutosAtras = new Date(Date.now() - 15 * 60_000);

        // Se o dono já respondeu a esta mesma pergunta nos últimos 15 minutos,
        // junta as mensagens complementares em vez de fragmentar em múltiplos cards
        const observacaoRecente = await prisma.knowledgeItem.findFirst({
          where: {
            companyId: perfil.companyId,
            status: "OBSERVED",
            question: perguntaCliente.slice(0, 300),
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
          );
        }
      }
    }

    return true;
  },
};
