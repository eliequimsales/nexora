import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { ConfiguracaoErro, getVersoesConfiguracao, restaurarVersaoConfiguracao } from "@/lib/atendente/configuracao";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { limitar, LIMITES } from "@/lib/limites";
import { logError } from "@/lib/errors";

export const dynamic = "force-dynamic";
const entrada = z.object({ revisao: z.number().int().min(0), versaoId: z.string().min(1).max(180) }).strict();
async function responder(request: Request, escrever: boolean) {
  if (escrever) { const erro = validarOrigemECsrfe(request, { exigirJson: true }); if (erro) return erro; }
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar(`configuracao-versoes:${escrever ? "POST" : "GET"}`, companyId, escrever ? LIMITES.escrita : LIMITES.leitura)) return NextResponse.json({ error: "Aguarde um pouco antes de tentar novamente." }, { status: 429 });
  try {
    if (!escrever) return NextResponse.json({ versoes: await getVersoesConfiguracao(companyId) }, { headers: { "Cache-Control": "no-store" } });
    const input = entrada.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Confira a versão que deseja recuperar." }, { status: 400 });
    return NextResponse.json(await restaurarVersaoConfiguracao(companyId, input.data.revisao, input.data.versaoId));
  } catch (e) {
    if (e instanceof ConfiguracaoErro) return NextResponse.json({ error: e.message }, { status: e.status });
    await logError("configuracao-versoes", e, companyId);
    return NextResponse.json({ error: "Não foi possível recuperar a versão agora. A versão em uso foi preservada." }, { status: 500 });
  }
}
export const GET = (request: Request) => responder(request, false);
export const POST = (request: Request) => responder(request, true);
