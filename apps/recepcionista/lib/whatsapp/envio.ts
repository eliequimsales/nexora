import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { sendWhatsAppText } from "./evolution";

/**
 * TODO ENVIO DA NEXORA PASSA POR AQUI.
 *
 * O webhook devolve o eco de cada mensagem enviada pelo número do dono com
 * `fromMe`, do mesmo jeito que devolve uma mensagem que o dono digitou no
 * celular. Guardar o id de cada envio é o que permite separar as duas coisas
 * (lib/plantao/dono.ts). Por isso nenhum outro arquivo chama `sendWhatsAppText`
 * direto — tests/envio-whatsapp.test.ts trava isso.
 */
export async function enviarWhatsApp(
  instance: string,
  phone: string,
  text: string,
): Promise<{ messageId: string | null }> {
  try {
    const { messageId } = await sendWhatsAppText(instance, phone, text);
    if (messageId) {
      await prisma.envioWhatsApp.create({ data: { instance, messageId } }).catch(async (erro) => {
        // Id repetido é o mesmo envio registrado duas vezes: não é problema.
        if ((erro as { code?: string }).code !== "P2002") await logError("envio-registro", erro);
      });
    }
    return { messageId };
  } catch (erro) {
    if (instanciaInexistente(erro)) await marcarConexaoPerdida(instance);
    throw erro;
  }
}

/** O envio que chegou pelo webhook com este id saiu da própria Nexora? */
export async function ehEnvioDaNexora(instance: string, messageId: string): Promise<boolean> {
  const achado = await prisma.envioWhatsApp.findUnique({
    where: { instance_messageId: { instance, messageId } },
    select: { id: true },
  });
  return achado !== null;
}

/**
 * A conexão desta empresa não existe mais no servidor do WhatsApp.
 *
 * É o 404 que aparecia nos logs a cada 5 minutos: o servidor foi recriado e a
 * conexão antiga sumiu, mas o banco continuava dizendo "ligado". Não é problema
 * de uma conversa — vale para todas as mensagens daquela empresa.
 */
export function instanciaInexistente(erro: unknown): boolean {
  if (!(erro instanceof Error)) return false;
  return (
    /Evolution API respondeu 404\b/.test(erro.message) && /instance does not exist/i.test(erro.message)
  );
}

export const AVISO_CONEXAO_PERDIDA =
  "A ligação do seu WhatsApp com a Nexora caiu. Ligue de novo pelo QR Code para voltar a enviar.";

async function marcarConexaoPerdida(instance: string): Promise<void> {
  await prisma.companyProfile
    .updateMany({
      where: { whatsappInstance: instance },
      data: {
        whatsappStatus: "DISCONNECTED",
        whatsappError: AVISO_CONEXAO_PERDIDA,
        whatsappQrCode: null,
      },
    })
    .catch(async (erro) => {
      await logError("envio-conexao-perdida", erro);
    });
}
