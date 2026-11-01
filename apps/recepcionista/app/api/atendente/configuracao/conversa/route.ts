import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { logError } from "@/lib/errors";
import { LIMITES, limitar } from "@/lib/limites";
import { TOO_MANY_ATTEMPTS } from "@/lib/rate-limit";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { conversarConfiguracao, getConversaConfiguracao, mensagemConversaConfiguracaoSchema, topicoConfiguracaoSchema } from "@/lib/atendente/conversa";

export const dynamic = "force-dynamic";

async function responder(request: Request, escrever: boolean) {
  if (escrever) {
    const origem = validarOrigemECsrfe(request, { exigirJson: true });
    if (origem) return origem;
  }
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar(`atendente-conversa:${escrever ? "POST" : "GET"}`, companyId, escrever ? { limit: 30, windowMs: 60_000 } : LIMITES.leitura)) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, { status: 429 });
  }
  try {
    if (!escrever) {
      const valor = new URL(request.url).searchParams.get("topico");
      const topico = valor === null ? null : topicoConfiguracaoSchema.safeParse(valor);
      if (topico && !topico.success) return NextResponse.json({ error: "Escolha um dos tópicos da configuração." }, { status: 400 });
      const resposta = topico?.success ? await getConversaConfiguracao(companyId, topico.data) : await getConversaConfiguracao(companyId);
      return NextResponse.json(resposta, { headers: { "Cache-Control": "no-store" } });
    }
    if (Number(request.headers.get("content-length")) > 32000) return NextResponse.json({ error: "Essa mensagem ficou longa. Divida em duas partes para continuar." }, { status: 413 });
    const body = await request.json().catch(() => null);
    const input = mensagemConversaConfiguracaoSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: "Escreva uma mensagem de até 6.000 caracteres para continuar." }, { status: 400 });
    return NextResponse.json(await conversarConfiguracao(companyId, input.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ConfiguracaoErro) return NextResponse.json({ error: error.message, pendencias: error.pendencias }, { status: error.status });
    await logError("atendente-conversa-configuracao", error, companyId);
    return NextResponse.json({ error: "Não consegui salvar essa mensagem agora. Seu rascunho anterior continua preservado; tente novamente." }, { status: 500 });
  }
}
export const GET = (request: Request) => responder(request, false);
export const POST = (request: Request) => responder(request, true);
