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

export type DependenciasDoDono = {
  ehEnvioDaNexora: (instance: string, messageId: string) => Promise<boolean>;
  esperar: (ms: number) => Promise<void>;
  /** Marca a hora na conversa com esse telefone. false quando a conexão não é de empresa nenhuma. */
  marcarQueODonoAssumiu: (instance: string, phone: string, quando: Date, texto?: string | null) => Promise<boolean>;
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
  );
  return marcou ? "DONO_ASSUMIU" : "SEM_EMPRESA";
}

export const dependenciasReais: DependenciasDoDono = {
  ehEnvioDaNexora,
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  async marcarQueODonoAssumiu(instance, phone, quando, texto) {
    const perfil = await prisma.companyProfile.findUnique({
      where: { whatsappInstance: instance },
      select: { companyId: true },
    });
    if (!perfil) return false;

    // Cria ou atualiza a conversa quando o dono responde ou inicia pelo celular
    const conversa = await prisma.conversation.upsert({
      where: { companyId_customerPhone: { companyId: perfil.companyId, customerPhone: phone } },
      create: { companyId: perfil.companyId, customerPhone: phone, donoAssumiuEm: quando },
      update: { donoAssumiuEm: quando },
      select: { id: true },
    });

    // Se o dono enviou mensagem de texto, salva no histórico da conversa como HUMAN
    // e extrai a resposta para sugerir aprendizado passivo no treinamento (status OBSERVED).
    if (texto && texto.trim()) {
      const conteudo = texto.trim();
      await prisma.message.create({
        data: {
          conversationId: conversa.id,
          role: "HUMAN",
          content: conteudo,
        },
      });

      const ultimaPerguntaCliente = await prisma.message.findFirst({
        where: {
          conversationId: conversa.id,
          role: "CUSTOMER",
        },
        orderBy: { createdAt: "desc" },
        select: { content: true },
      });

      if (ultimaPerguntaCliente && ultimaPerguntaCliente.content) {
        await recordTeamObservation(
          perfil.companyId,
          ultimaPerguntaCliente.content,
          conteudo,
        );
      }
    }

    return true;
  },
};
