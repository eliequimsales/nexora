import { ConfiguracaoErro } from "@/lib/atendente/configuracao";
import { MAX_ARQUIVO_AUDIO, MAX_TEXTO_MATERIAL } from "@/lib/atendente/materiais";

/** Apenas áudio fornecido pelo responsável. Não baixa URLs nem ativa leitura de áudio de clientes. */
export function configuracaoDaTranscricao() {
  const provedor = (process.env.TRANSCRIPTION_PROVIDER ?? process.env.AI_PROVIDER ?? "groq").trim().toLowerCase();
  if (provedor !== "groq" && provedor !== "openai") return null;
  const chave = process.env[provedor === "groq" ? "GROQ_API_KEY" : "OPENAI_API_KEY"];
  return chave ? { provedor, chave, modelo: process.env.TRANSCRIPTION_MODEL?.trim() || (provedor === "groq" ? "whisper-large-v3-turbo" : "gpt-transcribe") } : null;
}

export async function transcreverMaterial(arquivo: Blob & { name: string }, buscar: typeof fetch = fetch): Promise<string> {
  const config = configuracaoDaTranscricao();
  if (!config) throw new ConfiguracaoErro("A transcrição de áudio ainda não está disponível nesta instalação. Você pode escrever ou enviar um arquivo de texto.", 503);
  if (!arquivo.size || arquivo.size > MAX_ARQUIVO_AUDIO) throw new ConfiguracaoErro("Envie um áudio de até 10 MB.", 413);
  const extensao = arquivo.name.toLowerCase().split(".").at(-1) ?? "";
  const aceitas = config.provedor === "groq" ? ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac"] : ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm"];
  if (!aceitas.includes(extensao)) throw new ConfiguracaoErro("Formato de áudio não aceito pelo provedor. Envie MP3, M4A, WAV ou WEBM.", 415);
  const dados = new FormData(); dados.append("file", arquivo, arquivo.name); dados.append("model", config.modelo);
  if (config.provedor === "groq") { dados.append("language", "pt"); dados.append("response_format", "json"); }
  else dados.append("languages[]", "pt");
  let resposta: Response;
  try { resposta = await buscar(config.provedor === "groq" ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${config.chave}` }, body: dados, signal: AbortSignal.timeout(45_000) }); }
  catch { throw new ConfiguracaoErro("Não consegui concluir a transcrição agora. Nenhuma informação foi salva; tente novamente ou escreva o conteúdo.", 502); }
  if (!resposta.ok) throw new ConfiguracaoErro("O serviço de transcrição não aceitou o áudio agora. Confira sua disponibilidade e tente novamente.", 502);
  const resultado = await resposta.json().catch(() => null);
  const texto = typeof resultado?.text === "string" ? resultado.text.trim() : "";
  if (!texto) throw new ConfiguracaoErro("Não foi possível entender a fala desse áudio. Envie uma gravação mais clara ou escreva as informações.", 422);
  if (texto.length > MAX_TEXTO_MATERIAL) throw new ConfiguracaoErro("A transcrição passou de 6.000 caracteres. Divida a gravação em áudios menores.", 413);
  return texto;
}
