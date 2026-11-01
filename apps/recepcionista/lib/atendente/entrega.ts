/**
 * Apresentação da resposta já decidida pelo motor. Não acrescenta fatos,
 * perguntas, saudações nem uma identidade humana ao texto recebido.
 */
export type BolhaDeResposta = { texto: string; esperaMs: number };
export type PlanoDeEntrega = { bolhas: BolhaDeResposta[]; esperaTotalMs: number };

const MAX_BOLHAS = 3;
const ESPERA_MIN_MS = 3_000;
const ESPERA_MAX_MS = 5_000;
const PRAZO_PRESENCA_MS = 600;

/** Listas, códigos e dados de pagamento continuam no mesmo balão. */
function blocoEstruturado(texto: string): boolean {
  return /(^|\n)\s*(?:[-*•]\s|\d+[.)]\s)|```|000201\d{4}|pix\s*(?:copia|copia\s*e\s*cola|:)/im.test(texto);
}

function separarParagrafos(texto: string): string[] {
  if (blocoEstruturado(texto)) return [texto];
  // Um endereço, horário, valor ou token nunca é cortado por tamanho. Somente
  // uma separação de parágrafo escrita pelo motor autoriza um novo balão.
  return texto.split(/\n[\t ]*\n+/).map((parte) => parte.trim()).filter(Boolean);
}

/**
 * Até três balões, preservando cada bloco de texto. O restante é reunido no
 * último balão, sem truncar URLs, códigos Pix, preços, horários ou perguntas.
 * A espera total da resposta fica entre 3 e 5 s; urgências não esperam.
 */
export function planejarEntrega(textos: string[], opcoes: { urgente?: boolean } = {}): PlanoDeEntrega {
  const partes = textos.flatMap((texto) => separarParagrafos(texto.replace(/\r\n?/g, "\n").trim())).filter(Boolean);
  if (!partes.length) return { bolhas: [], esperaTotalMs: 0 };
  const bolhas = partes.length <= MAX_BOLHAS
    ? partes
    : [...partes.slice(0, MAX_BOLHAS - 1), partes.slice(MAX_BOLHAS - 1).join("\n\n")];
  const tamanho = bolhas.reduce((soma, texto) => soma + [...texto].length, 0);
  const esperaTotalMs = opcoes.urgente ? 0 : Math.min(ESPERA_MAX_MS,
    ESPERA_MIN_MS + Math.max(0, tamanho - 80) * 8);
  const minimoPorBolha = esperaTotalMs ? 600 : 0;
  const disponivel = esperaTotalMs - minimoPorBolha * bolhas.length;
  let alocada = 0;
  return {
    bolhas: bolhas.map((texto, i) => {
      const esperaMs = i === bolhas.length - 1 ? esperaTotalMs - alocada
        : minimoPorBolha + Math.floor(disponivel * [...texto].length / tamanho);
      alocada += esperaMs;
      return { texto, esperaMs };
    }),
    esperaTotalMs,
  };
}

export type DependenciasDaEntrega<Motivo> = {
  /** Consulta posse, pausa humana e chegada de mensagem mais recente. */
  podeContinuar: () => Promise<Motivo | null>;
  esperar: (ms: number) => Promise<void>;
  /** Opcional e sem efeito sobre a entrega. Nunca deve enviar uma mensagem. */
  presenca?: (digitando: boolean, esperaMs: number, signal: AbortSignal) => Promise<unknown>;
  /** Deve confirmar o canal e persistir o balão antes de resolver. Sem retry. */
  enviar: (texto: string) => Promise<void>;
};

export type OpcoesDaEntrega = {
  signal?: AbortSignal;
  /** Relógio injetável para verificar o orçamento da execução. */
  agora?: () => number;
  prazoEm?: number;
};

export type ResultadoDaEntrega<Motivo> =
  | { acao: "CONCLUIDA"; enviadas: number }
  | { acao: "INTERROMPIDA"; enviadas: number; motivo: Motivo | null }
  | { acao: "PRAZO_ESGOTADO"; enviadas: number };

/**
 * Presença é apenas um indicador transitório. Uma API lenta ou indisponível
 * não pode prender o cliente nem impedir que a resposta válida seja entregue.
 */
async function mostrarPresenca<Motivo>(deps: DependenciasDaEntrega<Motivo>, digitando: boolean,
  esperaMs: number, prazoMs: number): Promise<void> {
  if (!deps.presenca || prazoMs <= 0) return;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const encerrar = () => controller.abort();
  try {
    await Promise.race([
      Promise.resolve().then(() => deps.presenca!(digitando, esperaMs, controller.signal)).catch(() => {}),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => { encerrar(); resolve(); }, Math.min(PRAZO_PRESENCA_MS, prazoMs));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    encerrar();
  }
}

async function esperarAteInterrupcao(esperar: () => Promise<void>, signal: AbortSignal | undefined,
  restanteMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let aoAbortar: (() => void) | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(esperar),
      new Promise<void>((resolve) => {
        if (signal?.aborted) { resolve(); return; }
        aoAbortar = resolve;
        signal?.addEventListener("abort", aoAbortar, { once: true });
        if (Number.isFinite(restanteMs)) timer = setTimeout(resolve, Math.max(0, restanteMs));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (aoAbortar) signal?.removeEventListener("abort", aoAbortar);
  }
}

/**
 * Revalida a conversa em cada fronteira da entrega. Não agenda envios no
 * gateway: a espera fica aqui, onde uma tomada humana ainda pode cancelá-la.
 * Falha ou timeout no envio propaga e nunca causa repetição automática.
 */
export async function entregarResposta<Motivo>(plano: PlanoDeEntrega,
  deps: DependenciasDaEntrega<Motivo>, opcoes: OpcoesDaEntrega = {}): Promise<ResultadoDaEntrega<Motivo>> {
  const agora = opcoes.agora ?? Date.now;
  const prazoEm = opcoes.prazoEm ?? Number.POSITIVE_INFINITY;
  let enviadas = 0;
  let comPresenca = false;
  const restante = () => prazoEm - agora();
  const conferir = async (): Promise<ResultadoDaEntrega<Motivo> | null> => {
    if (opcoes.signal?.aborted) return { acao: "INTERROMPIDA", enviadas, motivo: null };
    if (restante() <= 0) return { acao: "PRAZO_ESGOTADO", enviadas };
    const motivo = await deps.podeContinuar();
    if (opcoes.signal?.aborted) return { acao: "INTERROMPIDA", enviadas, motivo: null };
    if (restante() <= 0) return { acao: "PRAZO_ESGOTADO", enviadas };
    return motivo !== null ? { acao: "INTERROMPIDA", enviadas, motivo } : null;
  };
  try {
    for (const bolha of plano.bolhas) {
      let impedimento = await conferir();
      if (impedimento) return impedimento;
      if (bolha.esperaMs > 0) {
        // Não começa uma espera que já excederia o orçamento da execução.
        if (bolha.esperaMs >= restante()) return { acao: "PRAZO_ESGOTADO", enviadas };
        comPresenca = Boolean(deps.presenca);
        // O indicador acontece junto com a espera local; a API de presença da
        // Evolution pode manter a requisição aberta durante sua própria espera.
        await Promise.all([
          mostrarPresenca(deps, true, bolha.esperaMs, restante()),
          esperarAteInterrupcao(() => deps.esperar(bolha.esperaMs), opcoes.signal, restante()),
        ]);
        impedimento = await conferir();
        if (impedimento) return impedimento;
      }
      // Inclui o caso urgente, que não passou por espera/presença.
      impedimento = await conferir();
      if (impedimento) return impedimento;
      await deps.enviar(bolha.texto);
      enviadas += 1;
      impedimento = await conferir();
      if (impedimento) return impedimento;
    }
    return { acao: "CONCLUIDA", enviadas };
  } finally {
    if (comPresenca) await mostrarPresenca(deps, false, 0, Math.max(0, restante()));
  }
}
