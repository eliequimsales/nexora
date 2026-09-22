"use client";

import { useEffect, useRef, useState } from "react";
import type { Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente, Tom } from "@/lib/atendente/tela";
import { Ajustes } from "@/components/atendente/ajustes";
import { Celular } from "@/components/atendente/celular";
import { Ligar } from "@/components/atendente/ligar";
import { Situacao } from "@/components/atendente/situacao";

/**
 * ATENDENTE VIRTUAL — UMA TELA SÓ, QUE SE EXPLICA SOZINHA.
 *
 * À esquerda, o celular: o Atendente conversando com os dados do negócio. É a
 * explicação — e é também onde o dono testa. À direita, poucos ajustes, salvos
 * sozinhos, e uma ação principal: ligar. Depois de ligado, o mesmo lugar mostra
 * como ele está e o que precisa do dono.
 */

const PILULA: Record<Tom, { texto: string; classe: string; ponto: string }> = {
  ATENDENDO: { texto: "Atendendo agora", classe: "bg-emerald-50 text-emerald-800", ponto: "bg-emerald-500 animate-pulse" },
  DE_OLHO: { texto: "Ligado", classe: "bg-emerald-50 text-emerald-800", ponto: "bg-emerald-500" },
  ESPERANDO: { texto: "Ligado", classe: "bg-emerald-50 text-emerald-800", ponto: "bg-emerald-500" },
  PARADO: { texto: "Parado", classe: "bg-red-50 text-red-700", ponto: "bg-red-500" },
  DESLIGADO: { texto: "Desligado", classe: "bg-panel-card text-panel-sub border border-panel-line", ponto: "bg-panel-line" },
};

/** Tempo sem digitar antes de salvar o nome. */
const ESPERA_DO_NOME_MS = 700;

export default function PaginaDoAtendente() {
  const [tela, setTela] = useState<TelaDoAtendente | null>(null);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [jeito, setJeito] = useState<Jeito>("ACOLHEDOR");
  const [testado, setTestado] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const esperaDoNome = useRef<ReturnType<typeof setTimeout>>();
  const esperaDoSalvo = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/atendente");
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok || !j) {
          setErro(j?.error ?? "Não consegui abrir agora. Tente de novo.");
          return;
        }
        setTela(j);
        setNome(j.nome);
        setJeito(j.jeito);
        setTestado(j.testado);
      } catch {
        if (vivo) setErro("Sem conexão agora. Tente de novo.");
      }
    })();
    return () => {
      vivo = false;
      clearTimeout(esperaDoNome.current);
      clearTimeout(esperaDoSalvo.current);
    };
  }, []);

  async function ajustar(dados: Record<string, unknown>) {
    setErro("");
    try {
      const r = await fetch("/api/atendente", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "Não consegui salvar agora. Tente de novo.");
        return;
      }
      setTela(j);
      setSalvo(true);
      clearTimeout(esperaDoSalvo.current);
      esperaDoSalvo.current = setTimeout(() => setSalvo(false), 1500);
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    }
  }

  function mudarNome(novo: string) {
    setNome(novo);
    clearTimeout(esperaDoNome.current);
    esperaDoNome.current = setTimeout(() => void ajustar({ nome: novo }), ESPERA_DO_NOME_MS);
  }

  function mudarJeito(novo: Jeito) {
    setJeito(novo);
    void ajustar({ jeito: novo });
  }

  if (!tela) {
    return (
      <div>
        <h1 className="font-display text-2xl text-panel-ink">Atendente Virtual</h1>
        {erro ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {erro}
          </p>
        ) : (
          <p className="mt-4 text-sm text-panel-sub">Abrindo…</p>
        )}
      </div>
    );
  }

  const pilula = PILULA[tela.estado.tom];
  const ajustes = (
    <Ajustes
      tela={tela}
      nome={nome}
      jeito={jeito}
      aoMudarNome={mudarNome}
      aoMudarJeito={mudarJeito}
      aoAjustar={(dados) => void ajustar(dados)}
    />
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-panel-ink">Atendente Virtual</h1>
          <p className="mt-1 text-sm text-panel-sub">Responde seus clientes no WhatsApp quando você não pode.</p>
        </div>
        <div className="flex items-center gap-3">
          {salvo && <span className="text-xs text-panel-sub">Salvo</span>}
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${pilula.classe}`}>
            <span className={`h-2 w-2 rounded-full ${pilula.ponto}`} aria-hidden="true" />
            {pilula.texto}
          </span>
        </div>
      </header>

      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}

      {/* grid-cols-1 é minmax(0, 1fr): no celular a coluna encolhe até a tela, em vez de crescer até o item mais largo. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Celular tela={tela} nome={nome} jeito={jeito} aoTestar={() => setTestado(true)} />

        <div className="space-y-4">
          {tela.ligado ? <Situacao tela={tela} aoMudarTela={setTela} /> : ajustes}
          {(!tela.ligado || tela.acesso === "SEMANA_ACABOU") && (
            <Ligar tela={tela} testado={testado} aoMudarTela={setTela} />
          )}
          {tela.ligado && (
            <details className="group rounded-2xl border border-panel-line bg-panel-card">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-panel-ink">
                <span className="mr-2 inline-block text-panel-sub transition group-open:rotate-90">›</span>
                Ajustar nome, jeito e dados
              </summary>
              <div className="border-t border-panel-line p-4">{ajustes}</div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
