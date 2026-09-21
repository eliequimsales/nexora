import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { FORNECEDOR } from "@/lib/legal/identidade";
import { enviarEmail } from "@/lib/reengajamento/email";
import {
  implantacaoDaSessao,
  implantacaoNoCheckout,
  inicioDaSemana,
  PRAZO_DA_IMPLANTACAO_DIAS,
  precoDaImplantacao,
} from "./implantacao";
import { stripe } from "./stripe";

/**
 * A implantação lida do banco e da Stripe. A regra mora em implantacao.ts.
 */

/** O Price da implantação para este checkout, ou null. Nunca derruba o pagamento. */
export async function implantacaoParaOCheckout(
  companyId: string,
  entraEmTeste: boolean,
  agora = new Date(),
): Promise<string | null> {
  const precoId = precoDaImplantacao(process.env);
  if (!precoId || entraEmTeste) return null;
  try {
    const [comprada, vendidasNaSemana] = await Promise.all([
      prisma.implantacao.findUnique({ where: { companyId }, select: { id: true } }),
      prisma.implantacao.count({ where: { compradaEm: { gte: inicioDaSemana(agora) } } }),
    ]);
    return implantacaoNoCheckout({
      precoId,
      jaComprou: Boolean(comprada),
      vendidasNaSemana,
      entraEmTeste,
    });
  } catch (erro) {
    await logError("implantacao-oferta", erro, companyId);
    return null;
  }
}

/**
 * Registra a implantação de uma sessão paga — uma por sessão e por empresa — e
 * avisa o fundador. Roda depois de o acesso estar gravado e nunca lança: um
 * problema aqui não pode atrasar o que o dono pagou.
 */
export async function registrarImplantacao(
  companyId: string,
  sessao: Stripe.Checkout.Session,
): Promise<void> {
  const precoId = precoDaImplantacao(process.env);
  if (!precoId) return;

  try {
    const itens = await stripe().checkout.sessions.listLineItems(sessao.id, { limit: 20 });
    const valorCents = implantacaoDaSessao(itens.data, precoId);
    if (valorCents === null) return;

    try {
      await prisma.implantacao.create({
        data: { companyId, stripeSessionId: sessao.id, valorCents },
      });
    } catch (erro) {
      if ((erro as { code?: string })?.code !== "P2002") throw erro;
      // Já registrada: é a reentrega da mesma compra. Se foi por OUTRA sessão, o
      // dono pagou a implantação duas vezes e a segunda precisa ser devolvida.
      const existente = await prisma.implantacao.findUnique({
        where: { companyId },
        select: { stripeSessionId: true },
      });
      if (existente && existente.stripeSessionId !== sessao.id) {
        await logError(
          "implantacao-paga-duas-vezes",
          new Error(`Sessão ${sessao.id} pagou a implantação de novo: devolver`),
          companyId,
        );
      }
      return;
    }

    await avisarFundador(companyId);
  } catch (erro) {
    await logError("implantacao-registrar", erro, companyId);
  }
}

async function avisarFundador(companyId: string): Promise<void> {
  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, email: true, phone: true },
  });
  if (!empresa) return;

  const envio = await enviarEmail(FORNECEDOR.email, {
    assunto: `Implantação vendida: ${empresa.name}`,
    corpo:
      `${empresa.name} comprou a implantação.\n\n` +
      `E-mail: ${empresa.email}\nTelefone: ${empresa.phone}\n\n` +
      `Pelos Termos, a chamada acontece em até ${PRAZO_DA_IMPLANTACAO_DIAS} dias da compra. ` +
      "O cliente tem o botão para marcar pelo WhatsApp em Minha conta.",
    acao: { texto: "Abrir a Nexora", href: "/login" },
  });
  if (!envio.enviado) {
    await logError(
      "implantacao-aviso",
      new Error(`O aviso da implantação não saiu: ${envio.motivo ?? "sem motivo"}`),
      companyId,
    );
  }
}
