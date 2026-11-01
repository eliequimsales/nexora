import { NextResponse } from "next/server";
import { getSessionCompanyId } from "@/lib/auth";
import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { extrairTextoDeArquivo, MAX_ARQUIVO_AUDIO } from "@/lib/atendente/materiais";
import { transcreverMaterial } from "@/lib/ai/transcricao";
import { limitar } from "@/lib/limites";
import { validarOrigemECsrfe } from "@/lib/seguranca/origem";
import { logError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origem = validarOrigemECsrfe(request); if (origem) return origem;
  const companyId = await getSessionCompanyId();
  if (!companyId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!limitar("atendente-material-extrair", companyId, { limit: 6, windowMs: 60_000 })) return NextResponse.json({ error: "Aguarde um momento antes de enviar outro arquivo." }, { status: 429 });
  try {
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new ConfiguracaoErro("Selecione um arquivo para enviar.", 415);
    const limite = MAX_ARQUIVO_AUDIO + 64 * 1024;
    if (Number(request.headers.get("content-length")) > limite) throw new ConfiguracaoErro("O áudio pode ter até 10 MB; arquivos de texto, até 64 KB.", 413);
    const reader = request.body?.getReader(); if (!reader) throw new ConfiguracaoErro("Nenhum arquivo foi recebido.", 400);
    const chunks: Uint8Array[] = []; let tamanho = 0;
    try { for (;;) { const r = await reader.read(); if (r.done) break; tamanho += r.value.byteLength; if (tamanho > limite) { await reader.cancel(); throw new ConfiguracaoErro("O arquivo ultrapassa o limite permitido.", 413); } chunks.push(r.value); } } finally { reader.releaseLock(); }
    const dados = await new Response(Buffer.concat(chunks), { headers: { "content-type": request.headers.get("content-type")! } }).formData().catch(() => null);
    const arquivo = dados?.get("arquivo");
    if (!arquivo || typeof arquivo === "string" || !arquivo.size) throw new ConfiguracaoErro("Selecione um arquivo com conteúdo.", 400);
    const audio = /\.(?:mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|flac)$/i.test(arquivo.name);
    const texto = audio ? await transcreverMaterial(arquivo) : extrairTextoDeArquivo(arquivo.name, new Uint8Array(await arquivo.arrayBuffer()));
    const nome = arquivo.name.split(/[\\/]/).at(-1)?.replace(/[\u0000-\u001F]/g, "").slice(0, 180) || "Material enviado";
    return NextResponse.json({ texto, nome, tipo: audio ? "AUDIO" : "ARQUIVO", aviso: audio ? "Confira a transcrição, principalmente nomes, valores e horários, antes de guardar." : "Confira o texto extraído antes de guardar. Nenhuma informação foi aplicada ao atendimento." }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ConfiguracaoErro) return NextResponse.json({ error: e.message }, { status: e.status });
    await logError("atendente-extrair-material", e, companyId);
    return NextResponse.json({ error: "Não consegui ler esse arquivo agora. Nenhuma informação foi salva." }, { status: 500 });
  }
}
