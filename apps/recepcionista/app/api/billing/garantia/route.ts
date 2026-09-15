import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { devolverPelaGarantia } from "@/lib/billing/devolucao";
import { stripeConfigurado } from "@/lib/billing/stripe";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PEDIDO DA GARANTIA DINHEIRO RECUPERADO.
 *
 * O painel confere sozinho. Do navegador só chega "quero pedir": quem decide é a
 * mesma regra que desenha a tela (lib/billing/garantia.ts), aqui no servidor, com
 * os dados do banco. Toda recusa sai com o motivo e o caminho.
 */
export async function POST() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("garantia", companyId, LIMITES.terceiro)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  if (!stripeConfigurado()) {
    return NextResponse.json(
      { error: "A cobrança ainda não está configurada nesta instalação." },
      { status: 503 },
    );
  }

  try {
    const resultado = await devolverPelaGarantia(companyId);
    if (!resultado.devolvido) {
      return NextResponse.json(
        { error: resultado.motivo, acao: resultado.acao },
        { status: resultado.http },
      );
    }
    return NextResponse.json({ devolvido: true, valorCents: resultado.valorCents });
  } catch (erro) {
    await logError("garantia-devolver", erro, companyId);
    return NextResponse.json(
      {
        error:
          "Não consegui concluir a devolução agora. Tente de novo em alguns minutos: o que já " +
          "foi estornado não é estornado duas vezes.",
      },
      { status: 500 },
    );
  }
}
