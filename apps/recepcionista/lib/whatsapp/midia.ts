/** Mídias recebidas sem leitura, transcrição, download ou interpretação do arquivo. */
export const TIPOS_DE_MIDIA = ["audio", "imagem", "documento", "video", "figurinha"] as const;
export type TipoDeMidia = (typeof TIPOS_DE_MIDIA)[number];

const ROTULOS: Record<TipoDeMidia, string> = {
  audio: "áudio",
  imagem: "imagem",
  documento: "documento",
  video: "vídeo",
  figurinha: "figurinha",
};

const marcador = (tipo: TipoDeMidia) => `[Mídia recebida: ${ROTULOS[tipo]}; conteúdo não interpretado]`;

/** O marcador ocupa uma linha própria; a legenda continua sendo texto do cliente. */
export function textoDeMidiaNaoInterpretada(tipo: TipoDeMidia, legenda = ""): string {
  return [marcador(tipo), legenda.trim()].filter(Boolean).join("\n");
}

/** Só reconhece os marcadores canônicos gerados pelo adaptador e pelo simulador. */
export function midiasNaoInterpretadas(texto: string): TipoDeMidia[] {
  const linhas = new Set(texto.split(/\r?\n/).map((linha) => linha.trim()));
  return TIPOS_DE_MIDIA.filter((tipo) => linhas.has(marcador(tipo)));
}

/** Não descarta legenda ou texto da mesma rajada; eles ainda podem conter pedidos reais. */
export function textoSemMarcadoresDeMidia(texto: string): string {
  const marcadores = new Set(TIPOS_DE_MIDIA.map(marcador));
  return texto.split(/\r?\n/).filter((linha) => !marcadores.has(linha.trim())).join("\n").trim();
}
