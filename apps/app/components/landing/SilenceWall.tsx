/**
 * O mural do silêncio — elemento-assinatura da landing.
 *
 * A tese da Nexora é que o cliente não cancela, ele apenas para de aparecer.
 * Aqui isso vira imagem: quanto mais tempo em silêncio, mais o nome apaga.
 * A última linha está quase invisível — é o cliente que já foi embora.
 *
 * Server component: a animação é 100% CSS (sem JS), escalonada por delay.
 */

const ROWS = [
  { name: 'Maria Souza', days: 34 },
  { name: 'Rafael Costa', days: 58 },
  { name: 'Ana Lima', days: 76 },
  { name: 'Bruno Carvalho', days: 103 },
  { name: 'Carla Dias', days: 141 },
  { name: 'João Pereira', days: 188 },
  { name: 'Fernanda Melo', days: 237 },
];

/** Opacidade decai com o tempo de ausência. Nunca zera: o cliente ainda existe. */
function fade(days: number): number {
  const t = Math.min(days / 260, 1);
  return Number((1 - t * 0.82).toFixed(3));
}

export function SilenceWall() {
  return (
    <figure className="relative mx-auto w-full max-w-2xl">
      <figcaption className="mb-4 flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
          Último contato
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/25">
          silêncio
        </span>
      </figcaption>

      <ul className="space-y-px">
        {ROWS.map((row, i) => (
          <li key={row.name} style={{ opacity: fade(row.days) }}>
            <div
              className="nx-emerge flex items-baseline gap-4 py-2.5"
              style={{ animationDelay: `${180 + i * 130}ms` }}
            >
              <span className="shrink-0 text-base sm:text-lg font-medium tracking-tight text-white">
                {row.name}
              </span>

              {/* A régua encurta conforme o silêncio aumenta */}
              <span aria-hidden className="flex-1 self-center">
                <span
                  className="block h-px bg-gradient-to-r from-white/30 to-transparent"
                  style={{ width: `${Math.max(10, 100 - (row.days / 260) * 88)}%` }}
                />
              </span>

              <span className="w-[5.5rem] shrink-0 text-right font-mono text-sm tabular-nums text-white/70">
                {row.days} dias
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* A lista continua além do que a tela mostra — como a base real */}
      <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-white/30">
        e mais 113 nomes
      </p>
    </figure>
  );
}
