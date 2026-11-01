import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { importarMaterial, materialEntradaSchema } from "@/lib/atendente/materiais";
import { removerMaterial } from "@/lib/atendente/materiais";
import { z } from "zod";
import { configuracaoDaTranscricao } from "@/lib/ai/transcricao";
import { limitar, LIMITES } from "@/lib/limites";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { logError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET() {
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar("atendente-materiais:GET", companyId, LIMITES.leitura)) return NextResponse.json({ error: "Aguarde um momento e tente novamente." }, { status: 429 });
  return NextResponse.json({ audioDisponivel: !!configuracaoDaTranscricao(), formatos: ["txt", "md", "csv", "json"], limiteTexto: 6000, limiteAudioMb: 10 }, { headers });
}
export async function POST(request: Request) {
  const origem = validarOrigemECsrfe(request, { exigirJson: true }); if (origem) return origem;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar("atendente-materiais:POST", companyId, { limit: 10, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde um momento antes de enviar outro material." }, { status: 429 });
  try {
    // Lê por stream com limite real, inclusive em transfer-encoding sem content-length.
    const leitor = request.body?.getReader(); let tamanho = 0; let bruto = "";
    if (leitor) { const decoder = new TextDecoder(); try { for (;;) { const r = await leitor.read(); if (r.done) break; tamanho += r.value.byteLength; if (tamanho > 32_000) { await leitor.cancel(); throw new ConfiguracaoErro("Divida o material em partes de até 6.000 caracteres.", 413); } bruto += decoder.decode(r.value, { stream: true }); } bruto += decoder.decode(); } finally { leitor.releaseLock(); } }
    let body: unknown; try { body = JSON.parse(bruto); } catch { throw new ConfiguracaoErro("Não consegui ler esse material. Reabra o envio e tente novamente.", 400); }
    const entrada = materialEntradaSchema.safeParse(body);
    if (!entrada.success) return NextResponse.json({ error: "Informe um nome e um texto de até 6.000 caracteres para o material." }, { status: 400 });
    return NextResponse.json(await importarMaterial(companyId, entrada.data), { headers });
  } catch (e) {
    if (e instanceof ConfiguracaoErro) return NextResponse.json({ error: e.message }, { status: e.status });
    await logError("atendente-importar-material", e, companyId);
    return NextResponse.json({ error: "Não consegui guardar o material agora. O rascunho anterior continua preservado." }, { status: 500 });
  }
}
export async function DELETE(request: Request) {
  const origem = validarOrigemECsrfe(request, { exigirJson: true }); if (origem) return origem;
  const companyId = await getSessionCompanyId(); if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar("atendente-materiais:DELETE", companyId, { limit: 10, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde um momento e tente novamente." }, { status: 429 });
  try {
    if (Number(request.headers.get("content-length")) > 2000) throw new ConfiguracaoErro("Pedido de remoção inválido.", 413);
    const input = z.object({ revisao: z.number().int().min(0), id: z.string().min(1).max(160) }).strict().safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "Reabra o material para tentar remover novamente." }, { status: 400 });
    return NextResponse.json(await removerMaterial(companyId, input.data), { headers });
  } catch (e) {
    if (e instanceof ConfiguracaoErro) return NextResponse.json({ error: e.message }, { status: e.status });
    await logError("atendente-remover-material", e, companyId);
    return NextResponse.json({ error: "Não consegui remover esse material agora." }, { status: 500 });
  }
}
