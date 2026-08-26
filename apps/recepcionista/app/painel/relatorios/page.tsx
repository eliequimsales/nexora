"use client";

import { useEffect, useState } from "react";

interface Reports {
  days: number;
  totalConversations: number;
  aiHandled: number;
  transferred: number;
  leads: number;
  waitingNow: number;
  topQuestions: { text: string; count: number }[];
  hourly: number[];
}

const PERIODS = [7, 30, 90];

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
      <p className="text-sm text-panel-sub">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-medium ${accent ? "text-leaf-dark" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export default function RelatoriosPage() {
  const [days, setDays] = useState(30);
  const [reports, setReports] = useState<Reports | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/reports?days=${days}`);
      if (res.ok) setReports(await res.json());
    })();
  }, [days]);

  if (!reports) {
    return <p className="p-8 text-center text-sm text-panel-sub">Carregando relatórios...</p>;
  }

  const maxHourly = Math.max(1, ...reports.hourly);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <div className="flex gap-2">
          {PERIODS.map((period) => (
            <button
              key={period}
              onClick={() => setDays(period)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                days === period
                  ? "border-leaf-dark bg-leaf-dark text-white"
                  : "border-panel-line bg-panel-card text-panel-sub hover:text-panel-ink"
              }`}
            >
              {period} dias
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total de conversas" value={reports.totalConversations} />
        <StatCard label="Respondidas pelo Atendente" value={reports.aiHandled} accent />
        <StatCard label="Encaminhadas à equipe" value={reports.transferred} />
        <StatCard label="Oportunidades capturadas" value={reports.leads} accent />
        <StatCard label="Aguardando equipe agora" value={reports.waitingNow} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <h2 className="font-display text-lg font-semibold">Principais dúvidas dos clientes</h2>
          {reports.topQuestions.length === 0 ? (
            <p className="mt-4 text-sm text-panel-sub">
              Ainda não há perguntas registradas neste período.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {reports.topQuestions.map((question, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 shrink-0 rounded bg-panel-bg px-2 py-0.5 font-mono text-xs text-panel-sub">
                    {question.count}×
                  </span>
                  <span className="leading-snug">{question.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <h2 className="font-display text-lg font-semibold">Horários com mais mensagens</h2>
          <div className="mt-6 flex h-40 items-end gap-1">
            {reports.hourly.map((count, hour) => (
              <div key={hour} className="group relative flex-1">
                <div
                  className="w-full rounded-t bg-leaf-dark/80 transition group-hover:bg-leaf-dark"
                  style={{ height: `${Math.max(2, (count / maxHourly) * 150)}px` }}
                  title={`${hour}h — ${count} mensagem${count === 1 ? "" : "s"}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-panel-sub">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
