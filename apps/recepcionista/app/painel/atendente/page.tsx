"use client";

import { useEffect, useState } from "react";
import type { Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { PainelLigado } from "@/components/atendente/painel-ligado";
import { PassoJeito } from "@/components/atendente/passo-jeito";
import { PassoSabe } from "@/components/atendente/passo-sabe";
import { Simulador } from "@/components/atendente/simulador";

/**
 * ATENDENTE VIRTUAL
 *
 * Antes de ligar: três passos — quem ele é e como fala, o que ele sabe (puxado
 * da agenda e do cadastro), e o teste num WhatsApp na tela, que libera o
 * "Ligar no meu WhatsApp". Depois de ligar: o estado, o que ele fez com a loja
 * fechada e o que precisa do dono. Nenhuma palavra técnica: o dono vê um
 * funcionário, não uma tecnologia.
 */

type Passo = 1 | 2 | 3;

const PASSOS: { n: Passo; titulo: string }[] = [
  { n: 1, titulo: "Quem ele é" },
  { n: 2, titulo: "O que ele sabe" },
  { n: 3, titulo: "Testar e ligar" },
];

export default function PaginaDoAtendente() {
  const [tela, setTela] = useState<TelaDoAtendente | null>(null);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState<Passo>(1);
  const [ajustando, setAjustando] = useState(false);
  const [nome, setNome] = useState("");
  const [jeito, setJeito] = useState<Jeito>("ACOLHEDOR");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/atendente");
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !j) {
          setErro(j?.error ?? "Não consegui abrir o Atendente agora. Tente de novo em instantes.");
          return;
        }
        setTela(j);
        setNome(j.nome);
        setJeito(j.jeito);
      } catch {
        if (vivo) setErro("Não consegui abrir o Atendente agora. Confira a sua internet e tente de novo.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function ajustar(dados: Record<string, unknown>): Promise<boolean> {
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/atendente", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "Não consegui salvar agora. Tente de novo em instantes.");
        return false;
      }
      setTela(j);
      return true;
    } catch {
      setErro("Não consegui salvar agora. Confira a sua internet e tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function receberTela(nova: TelaDoAtendente) {
    setTela(nova);
    // Ligou pelo teste: volta para o painel dele.
    if (nova.ligado && !tela?.ligado) setAjustando(false);
  }

  if (!tela) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-panel-ink">Atendente Virtual</h1>
        {erro ? (
          <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </p>
        ) : (
          <p className="mt-4 text-sm text-panel-sub">Abrindo…</p>
        )}
      </div>
    );
  }

  const mostrarPassos = !tela.ligado || ajustando;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <h1 className="font-display text-2xl text-panel-ink">Atendente Virtual</h1>
        <p className="mt-1 text-sm leading-relaxed text-panel-sub">
          Ele responde os seus clientes no WhatsApp quando você não pode — de noite, no fim de semana e quando a loja
          está cheia — e marca na sua agenda. Nunca finge ser gente, e preço e horário ele só diz o que está no seu
          cadastro.
        </p>
      </header>

      {erro && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erro}
        </p>
      )}

      {mostrarPassos ? (
        <>
          <nav aria-label="Passos para ligar o Atendente" className="flex flex-wrap gap-2">
            {PASSOS.map((p) => {
              const atual = p.n === passo;
              const feito = p.n < passo;
              return (
                <button
                  key={p.n}
                  type="button"
                  onClick={() => setPasso(p.n)}
                  aria-current={atual ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                    atual
                      ? "border-amber bg-amber font-bold text-night"
                      : feito
                        ? "border-amber/50 bg-amber/10 text-panel-ink"
                        : "border-panel-line bg-panel-card text-panel-sub hover:text-panel-ink"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      atual ? "bg-night text-amber" : feito ? "bg-amber text-night" : "bg-panel-bg text-panel-sub"
                    }`}
                    aria-hidden="true"
                  >
                    {feito ? "✓" : p.n}
                  </span>
                  {p.titulo}
                </button>
              );
            })}
            {tela.ligado && (
              <button
                type="button"
                onClick={() => setAjustando(false)}
                className="ml-auto rounded-full px-4 py-2 text-sm font-semibold text-panel-sub hover:text-panel-ink"
              >
                Voltar para o painel dele
              </button>
            )}
          </nav>

          {passo === 1 && (
            <PassoJeito
              tela={tela}
              nome={nome}
              jeito={jeito}
              salvando={salvando}
              aoMudarNome={setNome}
              aoMudarJeito={setJeito}
              aoContinuar={async () => {
                if (await ajustar({ nome, jeito })) setPasso(2);
              }}
            />
          )}
          {passo === 2 && (
            <PassoSabe
              tela={tela}
              salvando={salvando}
              aoAjustar={(ajuste) => void ajustar(ajuste)}
              aoVoltar={() => setPasso(1)}
              aoContinuar={() => setPasso(3)}
            />
          )}
          {passo === 3 && <Simulador tela={tela} nome={nome} jeito={jeito} aoMudarTela={receberTela} />}
        </>
      ) : (
        <PainelLigado
          tela={tela}
          aoMudarTela={setTela}
          aoAjustar={() => {
            setNome(tela.nome);
            setJeito(tela.jeito);
            setPasso(1);
            setAjustando(true);
          }}
        />
      )}
    </div>
  );
}
