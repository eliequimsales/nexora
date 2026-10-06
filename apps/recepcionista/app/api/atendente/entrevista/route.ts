import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import {
  obterMensagemInicialEntrevista,
  processarEntrevistaDono,
} from "@/lib/atendente/entrevista";

export const dynamic = "force-dynamic";

/**
 * API DA ENTREVISTA DA ONDA DO MAR.
 *
 * GET: Retorna o cumprimento inicial e sugestões de resposta adequadas ao status da empresa.
 * POST: Processa a resposta do dono, extrai serviços/endereço/horários/pagamentos/perguntas,
 * salva no banco e devolve a próxima onda da conversa com sugestões.
 */

export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente", companyId, LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  try {
    const dados = await obterMensagemInicialEntrevista(companyId);
    return NextResponse.json(dados);
  } catch (erro) {
    await logError("atendente-entrevista-get", erro, companyId);
    return NextResponse.json(
      { error: "Não consegui iniciar a conversa com a atendente agora." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!limitar("atendente-ajuste", companyId, LIMITES.escrita)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const mensagem = typeof body?.mensagem === "string" ? body.mensagem.trim() : "";
  const historico = Array.isArray(body?.historico) ? body.historico : undefined;

  if (!mensagem) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  try {
    const resultado = await processarEntrevistaDono({
      companyId,
      mensagem,
      historico,
    });

    return NextResponse.json(resultado);
  } catch (erro) {
    await logError("atendente-entrevista-post", erro, companyId);
    return NextResponse.json(
      { error: "Não consegui processar a resposta agora. Tente de novo." },
      { status: 500 },
    );
  }
}
