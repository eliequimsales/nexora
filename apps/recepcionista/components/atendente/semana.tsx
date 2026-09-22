import { horaFalada } from "@/lib/atendente/datas";
import type { DiaDesenhado } from "@/lib/atendente/semana";

/**
 * A SEMANA DESENHADA: QUEM ATENDE EM CADA FAIXA.
 *
 * É o avesso do horário da agenda, e o dono não configura nada aqui: aberto é
 * você, fechado é o Atendente. O desenho mostra de relance; as frases embaixo
 * dizem a mesma coisa em palavras.
 */

const MARCAS = [0, 6, 12, 18, 24];
const DIA_MIN = 24 * 60;

export function SemanaDesenhada({ dias, texto, nome }: { dias: DiaDesenhado[]; texto: string[]; nome: string }) {
  const quem = nome.trim() || "o Atendente";

  return (
    <div>
      <div className="space-y-1.5" role="img" aria-label={`Quando ${quem} atende: ${texto.join("; ")}`}>
        {dias.map((d) => (
          <div key={d.dia} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-xs font-semibold text-panel-sub">{d.nome}</span>
            <div className="flex h-5 flex-1 overflow-hidden rounded-md bg-panel-bg">
              {d.faixas.map((f) => (
                <div
                  key={`${f.de}-${f.ate}`}
                  title={`${horaFalada(f.de)}–${horaFalada(f.ate)}: ${f.quem === "ATENDENTE" ? quem : "você"}`}
                  className={f.quem === "ATENDENTE" ? "bg-amber/80" : "bg-panel-line"}
                  style={{ width: `${((f.ate - f.de) / DIA_MIN) * 100}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ml-11 mt-1 flex justify-between text-[10px] tabular-nums text-panel-sub" aria-hidden="true">
        {MARCAS.map((h) => (
          <span key={h}>{h}h</span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-panel-sub">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-panel-line" aria-hidden="true" />
          aberto — você atende
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber/80" aria-hidden="true" />
          fechado — {quem} atende
        </span>
      </div>

      <ul className="mt-3 space-y-0.5 text-sm text-panel-ink">
        {texto.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
    </div>
  );
}
