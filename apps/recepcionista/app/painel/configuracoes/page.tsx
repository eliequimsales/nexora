"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HORARIO_PADRAO, horarioDaEmpresa, semanaCompleta } from "@/lib/agenda/horario";

/**
 * HORÁRIO DE FUNCIONAMENTO DO NEGÓCIO.
 *
 * Esta tela é dedicada exclusivamente aos horários de funcionamento da semana.
 * O nome da empresa, endereço, formas de pagamento, serviços e o próprio
 * WhatsApp são configurados diretamente na tela do Atendente Virtual.
 *
 * Os campos do perfil continuam no estado do formulário para o PUT não apagá-los
 * ao salvar os horários.
 */

interface BusinessHour {
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

interface Faq {
  question: string;
  answer: string;
}

interface FormState {
  name: string;
  segments: string[];
  description: string;
  address: string;
  productsServices: string;
  pricingInfo: string;
  paymentMethods: string;
  serviceRules: string;
  aiTone: string;
  greetingMessage: string;
  awayMessage: string;
  businessHours: BusinessHour[];
  faqs: Faq[];
  handoffKeywords: string[];
  followUpEnabled: boolean;
  followUpDelayHours: number;
  followUpMessage: string;
  maxFollowUps: number;
}

interface WhatsAppState {
  status: "DISCONNECTED" | "WAITING_QR" | "CONNECTED" | "ERROR";
  qrCode: string | null;
  connectedAt: string | null;
  error: string | null;
}

/** A recusa que o servidor manda quando a assinatura não cobre a ação. */
type Recusa = { motivo: string; acao: { texto: string; href: string } };

/**
 * Informações de estado do WhatsApp mantidas para conformidade e integridade.
 */
const WA_STATUS_INFO: Record<WhatsAppState["status"], { label: string; bolinha: string }> = {
  DISCONNECTED: { label: "Seu WhatsApp ainda não está ligado", bolinha: "bg-panel-line" },
  WAITING_QR: { label: "Aguardando você escanear o QR Code", bolinha: "bg-amber" },
  CONNECTED: { label: "WhatsApp ligado", bolinha: "bg-emerald-500" },
  ERROR: { label: "Não consegui ligar seu WhatsApp", bolinha: "bg-red-500" },
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// O mesmo padrão da página de agendar e do atendimento (lib/agenda/horario.ts):
// a tela mostra o horário que vale de verdade, não um palpite só dela.
const DEFAULT_HOURS: BusinessHour[] = HORARIO_PADRAO.map((h) => ({ ...h }));

// Atalhos de horário — cada um gera a semana inteira com um clique
const HOUR_PRESETS: { label: string; build: () => BusinessHour[] }[] = [
  {
    label: "Seg a sex, 8h–18h",
    build: () =>
      Array.from({ length: 7 }, (_, day) => ({
        day,
        open: "08:00",
        close: "18:00",
        closed: day === 0 || day === 6,
      })),
  },
  {
    label: "Seg a sáb (sáb até 12h)",
    build: () =>
      Array.from({ length: 7 }, (_, day) => ({
        day,
        open: "08:00",
        close: day === 6 ? "12:00" : "18:00",
        closed: day === 0,
      })),
  },
  {
    label: "Todos os dias, 8h–18h",
    build: () =>
      Array.from({ length: 7 }, (_, day) => ({ day, open: "08:00", close: "18:00", closed: false })),
  },
  {
    label: "24 horas",
    build: () =>
      Array.from({ length: 7 }, (_, day) => ({ day, open: "00:00", close: "23:59", closed: false })),
  },
];

const EMPTY_FORM: FormState = {
  name: "",
  segments: [],
  description: "",
  address: "",
  productsServices: "",
  pricingInfo: "",
  paymentMethods: "",
  serviceRules: "",
  aiTone: "profissional, simpático e objetivo",
  greetingMessage: "",
  awayMessage: "",
  businessHours: DEFAULT_HOURS,
  faqs: [],
  handoffKeywords: [],
  followUpEnabled: false,
  followUpDelayHours: 4,
  followUpMessage: "",
  maxFollowUps: 2,
};

function Passo({
  numero,
  title,
  hint,
  children,
}: {
  numero: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber font-display text-sm font-bold text-night">
          {numero}
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {hint && <p className="mt-1 text-sm text-panel-sub">{hint}</p>}
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

const inputClass =
  "w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber";

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [atendenteLigado, setAtendenteLigado] = useState(false);

  useEffect(() => {
    (async () => {
      let res: Response;
      try {
        res = await fetch("/api/company/profile");
      } catch {
        setLoadError(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const profile = data.profile ?? {};
      setForm({
        ...EMPTY_FORM,
        name: data.name ?? "",
        segments: Array.isArray(profile.segments) ? profile.segments : [],
        description: profile.description ?? "",
        address: profile.address ?? "",
        productsServices: profile.productsServices ?? "",
        pricingInfo: profile.pricingInfo ?? "",
        paymentMethods: profile.paymentMethods ?? "",
        serviceRules: profile.serviceRules ?? "",
        aiTone: profile.aiTone ?? EMPTY_FORM.aiTone,
        greetingMessage: profile.greetingMessage ?? "",
        awayMessage: profile.awayMessage ?? "",
        businessHours: semanaCompleta(horarioDaEmpresa(profile.businessHours)),
        faqs: Array.isArray(profile.faqs) ? profile.faqs : [],
        handoffKeywords: Array.isArray(profile.handoffKeywords) ? profile.handoffKeywords : [],
        followUpEnabled: profile.followUpEnabled ?? false,
        followUpDelayHours: profile.followUpDelayHours ?? 4,
        followUpMessage: profile.followUpMessage ?? "",
        maxFollowUps: profile.maxFollowUps ?? 2,
      });
      setAtendenteLigado(Boolean(profile.plantaoAtivo && profile.atendenteLigadoPrimeiraVezEm));
      setLoading(false);
    })();
  }, []);

  function setHour(day: number, patch: Partial<BusinessHour>) {
    setForm((current) => ({
      ...current,
      businessHours: current.businessHours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    }));
  }

  function applyPreset(hours: BusinessHour[]) {
    setForm((current) => ({
      ...current,
      businessHours: hours,
    }));
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    setRecusa(null);
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.acao?.href) {
          setRecusa({ motivo: data.error ?? "Ação recusada", acao: data.acao });
        } else {
          setFeedback({ type: "error", text: data.error ?? "Não consegui salvar agora." });
        }
        return;
      }
      setFeedback({
        type: "ok",
        text: atendenteLigado ? "Salvo — o Atendente Virtual já responde assim." : "Salvo.",
      });
      setTimeout(() => setFeedback(null), 6000);
    } catch {
      setFeedback({ type: "error", text: "Não consegui falar com a internet agora." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-sm text-panel-sub">Carregando…</p>;
  }

  if (loadError) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Não consegui abrir sua página agora.</p>
        <p className="mt-1 text-sm text-panel-sub">
          Confira sua internet e tente de novo. Se continuar, saia e entre novamente.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold transition hover:border-amber"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <Link
          href="/painel/atendente"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-panel-sub transition hover:text-panel-ink"
        >
          ← Voltar para o Atendente Virtual
        </Link>
        <h1 className="font-display text-2xl font-bold">Horário de funcionamento</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Defina quando o seu negócio está aberto. Fora do expediente, o Atendente Virtual pode
          responder às dúvidas e pedidos dos seus clientes.{" "}
          {atendenteLigado
            ? "O Atendente Virtual está ligado e cobre os momentos em que você não pode atender."
            : "Respostas automáticas estão desligadas: o atendente só responde fora do expediente depois que você ativar."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-line bg-panel-card p-4 text-xs text-panel-sub">
        <span>
          Para Ligar meu WhatsApp ou atualizar informações da sua empresa, acesse o{" "}
          <Link href="/painel/atendente" className="font-semibold text-amber-deep hover:underline">
            Atendente Virtual
          </Link>
          .
        </span>
        <Link
          href="/painel/atendente"
          className="font-semibold text-amber-deep hover:underline"
        >
          Abrir Atendente →
        </Link>
      </div>

      {recusa && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
          <p className="text-sm text-panel-ink">{recusa.motivo}</p>
          <a
            href={recusa.acao.href}
            className="mt-3 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            {recusa.acao.texto}
          </a>
        </div>
      )}

      <Passo
        numero={1}
        title="Horários da semana"
        hint="Escolha um atalho rápido ou defina o horário de abertura e fechamento para cada dia da semana."
      >
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-panel-sub">
            Atalhos rápidos
          </span>
          <div className="flex flex-wrap gap-2">
            {HOUR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.build())}
                className="rounded-full border border-panel-line bg-white px-3.5 py-1.5 text-sm font-medium text-panel-ink transition hover:border-amber hover:text-amber-deep"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-panel-line rounded-xl border border-panel-line bg-white">
          {form.businessHours.map((hour) => (
            <div key={hour.day} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap">
              <span className="w-28 text-sm font-semibold text-panel-ink">{WEEKDAYS[hour.day]}</span>

              <div className="flex flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHour(hour.day, { closed: !hour.closed })}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                    hour.closed
                      ? "bg-panel-bg text-panel-sub hover:text-panel-ink"
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  }`}
                >
                  {hour.closed ? "Fechado" : "Aberto"}
                </button>

                {!hour.closed ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className={`${inputClass} w-28 text-center`}
                      value={hour.open}
                      onChange={(e) => setHour(hour.day, { open: e.target.value })}
                    />
                    <span className="text-xs text-panel-sub">até</span>
                    <input
                      type="time"
                      className={`${inputClass} w-28 text-center`}
                      value={hour.close}
                      onChange={(e) => setHour(hour.day, { close: e.target.value })}
                    />
                  </div>
                ) : (
                  <span className="text-xs text-panel-sub">Não abre neste dia</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Passo>

      <div className="fixed inset-x-0 bottom-0 border-t border-panel-line bg-panel-card/95 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6">
          {feedback ? (
            <p className={`text-sm ${feedback.type === "ok" ? "text-emerald-700 font-medium" : "text-red-600"}`}>
              {feedback.text}
            </p>
          ) : (
            <span className="text-sm text-panel-sub">
              Depois de salvar, os novos horários começam a valer imediatamente.
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-amber px-6 py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
