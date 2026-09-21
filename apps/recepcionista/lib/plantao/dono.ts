import { prisma } from "@/lib/db";
import type { MensagemDoDono } from "@/lib/whatsapp/evolution";
import { ehEnvioDaNexora } from "@/lib/whatsapp/envio";

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
  marcarQueODonoAssumiu: (instance: string, phone: string, quando: Date) => Promise<boolean>;
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

  const marcou = await deps.marcarQueODonoAssumiu(msg.instance, msg.phone, msg.enviadaEm ?? agora);
  return marcou ? "DONO_ASSUMIU" : "SEM_EMPRESA";
}

export const dependenciasReais: DependenciasDoDono = {
  ehEnvioDaNexora,
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
  async marcarQueODonoAssumiu(instance, phone, quando) {
    const perfil = await prisma.companyProfile.findUnique({
      where: { whatsappInstance: instance },
      select: { companyId: true },
    });
    if (!perfil) return false;

    // Cria a conversa quando é o dono quem começa: se o cliente responder às
    // 22h15 uma conversa que o dono abriu às 22h10, o Plantão precisa saber que
    // tem gente cuidando dela. Só telefone e hora — o texto do dono não é salvo.
    await prisma.conversation.upsert({
      where: { companyId_customerPhone: { companyId: perfil.companyId, customerPhone: phone } },
      create: { companyId: perfil.companyId, customerPhone: phone, donoAssumiuEm: quando },
      update: { donoAssumiuEm: quando },
    });
    return true;
  },
};
