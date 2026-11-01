import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionCompanyId } from "@/lib/auth";
import { AvaliacaoErro, avaliarAtendimento, getAvaliacaoAtendimento } from "@/lib/atendimento/avaliacao";
import { LIMITES, limitar } from "@/lib/limites";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { logErroSemConteudo } from "@/lib/errors";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
function falha(e: unknown) {
  if (e instanceof AvaliacaoErro) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Avaliação inválida." }, { status: 400, headers });
  return NextResponse.json({ error: "Não foi possível carregar ou salvar a avaliação. Tente novamente." }, { status: 500, headers });
}
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers });
  if (!limitar("avaliacao-leitura", companyId, LIMITES.leitura)) return NextResponse.json({ error: "Tente novamente em instantes." }, { status: 429, headers });
  try { return NextResponse.json(await getAvaliacaoAtendimento(companyId, params.id), { headers }); }
  catch (e) { if (!(e instanceof AvaliacaoErro)) await logErroSemConteudo("avaliacao-leitura", e, companyId); return falha(e); }
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const origem = validarOrigemECsrfe(request, { exigirJson: true }); if (origem) return origem;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers });
  if (!limitar("avaliacao-escrita", companyId, LIMITES.escrita)) return NextResponse.json({ error: "Tente novamente em instantes." }, { status: 429, headers });
  try { const body = await request.json().catch(() => null); return NextResponse.json({ ok: true, evaluation: await avaliarAtendimento(companyId, params.id, body) }, { headers }); }
  catch (e) { if (!(e instanceof AvaliacaoErro) && !(e instanceof ZodError)) await logErroSemConteudo("avaliacao-escrita", e, companyId); return falha(e); }
}
