"use client";

import Link from "next/link";
import { useState } from "react";

export default function RemoverClientePage() {
  const [telefone, setTelefone] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState<null | {
    visitasApagadas: number;
    entradasAnonimizadas: number;
    naoSeraRecontatado: boolean;
  }>(null);

  const excluir = async () => {
    setApagando(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes/excluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, confirmo: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui apagar esse cliente.");
        return;
      }
      setFeito(json);
      setTelefone("");
      setConfirmando(false);
    } catch {
      setErro("Não consegui falar com a internet agora. Tenta de novo?");
    } finally {
      setApagando(false);
    }
  };

  return (
    <main className="max-w-3xl space-y-6">
      {/* Abas de navegação interna entre Meus clientes e Remover cliente */}
      <div className="flex items-center gap-2 border-b border-panel-line pb-3">
        <Link
          href="/painel/clientes/importar"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-panel-sub hover:bg-white hover:text-panel-ink transition"
        >
          Meus clientes
        </Link>
        <Link
          href="/painel/clientes/remover"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-night shadow-sm"
        >
          Remover cliente
        </Link>
      </div>

      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-panel-ink">Remover cliente</h1>
          <p className="mt-1 text-sm text-panel-sub">
            Quando um cliente pedir para sair da lista ou não receber mais mensagens, apague por aqui.
          </p>
        </div>
        <Link
          href="/painel/clientes/importar"
          className="inline-flex items-center justify-center rounded-xl border border-panel-line bg-white px-4 py-2 text-xs font-semibold text-panel-ink hover:border-amber transition"
        >
          ← Voltar para Meus clientes
        </Link>
      </header>

      {/* Cartão principal de remoção */}
      <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl text-red-600">
            🗑️
          </span>
          <div>
            <h2 className="text-base font-bold text-panel-ink">
              Um cliente pediu para ser apagado
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-panel-sub">
              Digite o telefone dele. Apagamos o cadastro, as visitas e os horários futuros. O que
              ele já gastou continua em Dinheiro recuperado, sem o nome — é o seu faturamento, não o
              dado dele. Se ele já tinha pedido para parar, ele não volta nem se você mandar a
              mesma planilha de novo.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="telefone-para-apagar">
            Telefone do cliente que pediu para ser apagado
          </label>
          <input
            id="telefone-para-apagar"
            value={telefone}
            onChange={(e) => {
              setTelefone(e.target.value);
              setConfirmando(false);
              setFeito(null);
            }}
            placeholder="(11) 98888-7777"
            className="w-56 rounded-xl border border-panel-line bg-white px-3 py-2.5 text-sm outline-none focus:border-amber"
          />
          {!confirmando ? (
            <button
              onClick={() => setConfirmando(true)}
              disabled={telefone.trim().length < 8}
              className="rounded-xl border border-panel-line bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-red-400 hover:text-red-600 disabled:opacity-40"
            >
              Apagar esse cliente
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={excluir}
                disabled={apagando}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {apagando ? "Apagando…" : "Confirmo, apagar para sempre"}
              </button>
              <button
                onClick={() => setConfirmando(false)}
                className="rounded-xl border border-panel-line px-3 py-2.5 text-sm text-panel-sub hover:text-panel-ink"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {erro && <p className="mt-3 text-sm text-red-600 font-medium">{erro}</p>}

        {feito && (
          <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 text-sm text-emerald-950">
            <p className="font-bold">Cliente apagado com sucesso.</p>
            <p className="mt-1 text-xs text-emerald-800">
              {feito.visitasApagadas} visitas removidas.{" "}
              {feito.entradasAnonimizadas > 0 &&
                "O que ele gastou continua somando no seu caixa, só que agora sem o nome dele. "}
              {feito.naoSeraRecontatado
                ? "Ele não será chamado de novo, mesmo que apareça numa lista que você mandar depois."
                : "Se ele aparecer numa lista que você mandar depois, entra como cliente novo."}
            </p>
          </div>
        )}
      </section>

      {/* Exportação de dados */}
      <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
        <h2 className="font-display text-base font-semibold text-panel-ink">Baixar lista completa</h2>
        <p className="mt-1 text-sm text-panel-sub">
          Uma planilha com todos os clientes, quantas vezes vieram, quanto gastaram e quem
          pediu para não receber mensagem. Abre direto no Excel.
        </p>
        <a
          href="/api/dados/exportar"
          className="mt-4 inline-block rounded-xl border border-panel-line bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-amber"
        >
          Baixar minha lista em planilha
        </a>
      </section>
    </main>
  );
}
