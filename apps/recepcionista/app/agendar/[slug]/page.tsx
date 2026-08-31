"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A BASE VIVA — página pública de agendamento.
 *
 * O cliente final marca sozinho e digita o próprio nome. O dono nunca cadastra
 * ninguém, e a base — que é o ativo da Nexora — se forma sozinha, para sempre.
 *
 * Pedimos só nome e telefone. Cada campo a mais derruba conversão, e o cálculo
 * de recuperação não precisa de mais nada.
 */

type Servico = { id: string; name: string; durationMin: number; priceCents: number };
type DiaComHoras = { dia: string; horas: string[] };
type Dados = {
  negocio: { nome: string; endereco: string };
  servicos: Servico[];
  servicoSelecionado?: string;
  dias: DiaComHoras[];
};

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rotuloDia = (iso: string) => {
  const d = new Date(`${iso}T12:00:00.000Z`);
  const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getUTCDay()];
  return `${semana} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const mascararTelefone = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
};

export default function PaginaAgendar({ params }: { params: { slug: string } }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [servicoId, setServicoId] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<Dados["negocio"] & { servico: string; dia: string; hora: string } | null>(null);

  const carregar = useCallback(
    async (idServico?: string) => {
      setCarregando(true);
      setErro("");
      try {
        const qs = idServico ? `?serviceId=${encodeURIComponent(idServico)}` : "";
        const res = await fetch(`/api/agendar/${params.slug}${qs}`);
        if (!res.ok) throw new Error("nao-encontrado");
        const json: Dados = await res.json();
        setDados(json);
        setServicoId(json.servicoSelecionado ?? json.servicos[0]?.id ?? "");
      } catch {
        setErro("Não consegui carregar os horários. Tenta de novo em instantes.");
      } finally {
        setCarregando(false);
      }
    },
    [params.slug],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const trocarServico = (id: string) => {
    setServicoId(id);
    setDia("");
    setHora("");
    void carregar(id);
  };

  const marcar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch(`/api/agendar/${params.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, serviceId: servicoId, dia, hora }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui marcar agora.");
        if (res.status === 409) {
          setHora("");
          void carregar(servicoId);
        }
        return;
      }
      setConfirmado({
        nome: json.confirmacao.negocio,
        endereco: dados?.negocio.endereco ?? "",
        servico: json.confirmacao.servico,
        dia: json.confirmacao.dia,
        hora: json.confirmacao.hora,
      });
    } catch {
      setErro("Não consegui marcar agora. Tenta de novo?");
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-panel-bg grid place-items-center p-6">
        <p className="text-panel-sub">Carregando horários…</p>
      </main>
    );
  }

  if (!dados) {
    return (
      <main className="min-h-screen bg-panel-bg grid place-items-center p-6">
        <p className="text-panel-ink text-center">
          Essa página de agendamento não existe.
        </p>
      </main>
    );
  }

  if (confirmado) {
    return (
      <main className="min-h-screen bg-panel-bg grid place-items-center p-6">
        <div className="w-full max-w-md bg-panel-card rounded-2xl border border-panel-line p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber/15 grid place-items-center text-2xl">
            ✓
          </div>
          <h1 className="font-display text-2xl text-panel-ink mb-2">Horário marcado</h1>
          <p className="text-panel-sub mb-6">
            {confirmado.servico} · {rotuloDia(confirmado.dia)} às {confirmado.hora}
          </p>
          <p className="text-sm text-panel-sub">
            {confirmado.nome}
            {confirmado.endereco ? ` · ${confirmado.endereco}` : ""}
          </p>
        </div>
      </main>
    );
  }

  const diaSelecionado = dados.dias.find((d) => d.dia === dia);
  const podeMarcar =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    servicoId &&
    dia &&
    hora;

  return (
    <main className="min-h-screen bg-panel-bg py-8 px-4">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="text-center">
          <h1 className="font-display text-2xl text-panel-ink">{dados.negocio.nome}</h1>
          {dados.negocio.endereco ? (
            <p className="text-sm text-panel-sub mt-1">{dados.negocio.endereco}</p>
          ) : null}
        </header>

        {dados.servicos.length > 1 ? (
          <section className="bg-panel-card rounded-2xl border border-panel-line p-4">
            <h2 className="text-sm font-semibold text-panel-ink mb-3">O que você quer fazer?</h2>
            <div className="space-y-2">
              {dados.servicos.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => trocarServico(s.id)}
                  className={`w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                    servicoId === s.id
                      ? "border-amber bg-amber/10"
                      : "border-panel-line hover:border-panel-sub"
                  }`}
                >
                  <span className="text-panel-ink text-sm">{s.name}</span>
                  <span className="text-panel-sub text-xs tabular-nums">
                    {s.durationMin} min{s.priceCents > 0 ? ` · ${reais(s.priceCents)}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="bg-panel-card rounded-2xl border border-panel-line p-4">
          <h2 className="text-sm font-semibold text-panel-ink mb-3">Escolha o dia</h2>
          {dados.dias.length === 0 ? (
            <p className="text-sm text-panel-sub">
              Sem horários livres por enquanto. Tenta de novo mais tarde.
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dados.dias.map((d) => (
                <button
                  key={d.dia}
                  type="button"
                  onClick={() => {
                    setDia(d.dia);
                    setHora("");
                  }}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-sm transition ${
                    dia === d.dia
                      ? "border-amber bg-amber/10 text-panel-ink"
                      : "border-panel-line text-panel-sub hover:border-panel-sub"
                  }`}
                >
                  {rotuloDia(d.dia)}
                </button>
              ))}
            </div>
          )}
        </section>

        {diaSelecionado ? (
          <section className="bg-panel-card rounded-2xl border border-panel-line p-4">
            <h2 className="text-sm font-semibold text-panel-ink mb-3">Escolha o horário</h2>
            <div className="grid grid-cols-4 gap-2">
              {diaSelecionado.horas.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHora(h)}
                  className={`rounded-lg border py-2 text-sm tabular-nums transition ${
                    hora === h
                      ? "border-amber bg-amber/10 text-panel-ink"
                      : "border-panel-line text-panel-sub hover:border-panel-sub"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {hora ? (
          <section className="bg-panel-card rounded-2xl border border-panel-line p-4 space-y-3">
            <h2 className="text-sm font-semibold text-panel-ink">Seus dados</h2>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-xl border border-panel-line px-3 py-2.5 text-panel-ink placeholder:text-panel-sub/70 focus:outline-none focus:border-amber"
            />
            <input
              value={telefone}
              onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              className="w-full rounded-xl border border-panel-line px-3 py-2.5 text-panel-ink placeholder:text-panel-sub/70 focus:outline-none focus:border-amber"
            />
          </section>
        ) : null}

        {erro ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {erro}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!podeMarcar || enviando}
          onClick={marcar}
          className="w-full rounded-xl bg-amber py-3 font-semibold text-night disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {enviando ? "Marcando…" : "Confirmar horário"}
        </button>

        <p className="text-center text-xs text-panel-sub">
          Seus dados ficam só com {dados.negocio.nome}.
        </p>
      </div>
    </main>
  );
}
