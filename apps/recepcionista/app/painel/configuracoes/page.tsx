"use client";

import { useEffect, useState } from "react";

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

const WA_STATUS_INFO: Record<WhatsAppState["status"], { label: string; className: string }> = {
  DISCONNECTED: { label: "Desconectado", className: "bg-gray-100 text-gray-600 border-gray-200" },
  WAITING_QR: { label: "Aguardando leitura do QR Code", className: "bg-amber-50 text-amber-700 border-amber-300" },
  CONNECTED: { label: "Conectado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ERROR: { label: "Erro na conexão", className: "bg-red-50 text-red-700 border-red-200" },
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const DEFAULT_HOURS: BusinessHour[] = Array.from({ length: 7 }, (_, day) => ({
  day,
  open: "08:00",
  close: "18:00",
  closed: day === 0,
}));

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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-panel-sub">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-leaf-dark";

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [hypotheses, setHypotheses] = useState<{ area: string; confidence: number }[]>([]);
  const [wa, setWa] = useState<WhatsAppState | null>(null);

  function addSegment(area: string) {
    const value = area.trim();
    setForm((current) =>
      value && !current.segments.includes(value) && current.segments.length < 3
        ? { ...current, segments: [...current.segments, value] }
        : current,
    );
  }
  const [waBusy, setWaBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStatus = async (sync: boolean) => {
      try {
        const res = await fetch(`/api/whatsapp/status${sync ? "?sync=1" : ""}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        setWa(data.state);
      } catch {
        /* mantém o estado anterior */
      }
    };
    loadStatus(false);
    const interval = setInterval(() => loadStatus(false), 5_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function connectWhatsApp() {
    setWaBusy(true);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      if (data.state) setWa(data.state);
    } catch {
      /* o polling atualiza o estado */
    } finally {
      setWaBusy(false);
    }
  }

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
        businessHours: Array.isArray(profile.businessHours) && profile.businessHours.length === 7
          ? profile.businessHours
          : DEFAULT_HOURS,
        faqs: Array.isArray(profile.faqs) ? profile.faqs : [],
        handoffKeywords: Array.isArray(profile.handoffKeywords) ? profile.handoffKeywords : [],
        followUpEnabled: profile.followUpEnabled ?? false,
        followUpDelayHours: profile.followUpDelayHours ?? 4,
        followUpMessage: profile.followUpMessage ?? "",
        maxFollowUps: profile.maxFollowUps ?? 2,
      });
      setLoading(false);
    })();
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setHour(day: number, patch: Partial<BusinessHour>) {
    set(
      "businessHours",
      form.businessHours.map((h) => (h.day === day ? { ...h, ...patch } : h)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error ?? "Erro ao salvar" });
        return;
      }
      setFeedback({ type: "ok", text: "Salvo — seu Atendente já responde com os novos dados." });
      setTimeout(() => setFeedback(null), 6000);
    } catch {
      setFeedback({ type: "error", text: "Falha de conexão. Tente novamente." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="p-8 text-center text-sm text-panel-sub">Carregando configurações...</p>;
  }

  if (loadError) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Não foi possível carregar as configurações.</p>
        <p className="mt-1 text-sm text-panel-sub">
          Verifique sua conexão e recarregue a página. Se continuar, saia e entre novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="font-display text-2xl font-bold">Meu Atendente</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Tudo que você cadastrar aqui vira o conhecimento do seu Atendente. Ele só responde com o
          que estiver nesta página — nada é inventado.
        </p>
      </div>

      <Section title="Empresa">
        <Field label="Nome da empresa">
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Descrição do negócio">
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Ex.: Empresa de serviços no centro de Campinas, atendendo a região há 10 anos..."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="Endereço">
          <input
            className={inputClass}
            placeholder="Rua, número, bairro, cidade"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium">Áreas de atuação (até 3)</span>
          <p className="mb-2 text-xs text-panel-sub">
            Com as áreas definidas, seu Atendente já chega conhecendo o vocabulário do seu mercado
            e prepara a entrevista de integração no Treinamento. A decisão é sempre sua — a
            sugestão é só um atalho.
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            {form.segments.map((area) => (
              <span key={area} className="inline-flex items-center gap-1.5 rounded-full bg-panel-bg px-3 py-1 text-sm">
                {area}
                <button
                  type="button"
                  onClick={() => set("segments", form.segments.filter((s) => s !== area))}
                  className="text-panel-sub hover:text-red-600"
                  aria-label={`Remover ${area}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Ex.: Academia, Loja de Suplementos..."
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSegment(newSegment);
                  setNewSegment("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                addSegment(newSegment);
                setNewSegment("");
              }}
              className="shrink-0 rounded-lg border border-panel-line px-4 text-sm transition hover:border-leaf-dark"
            >
              Adicionar
            </button>
            <button
              type="button"
              onClick={async () => {
                setDetecting(true);
                setHypotheses([]);
                try {
                  const res = await fetch("/api/segment/detect", { method: "POST" });
                  const data = await res.json();
                  if (res.ok && data.hypotheses?.length) setHypotheses(data.hypotheses);
                  else
                    setFeedback({
                      type: "error",
                      text: "Não consegui sugerir — preencha a descrição do negócio e tente de novo, ou digite a área.",
                    });
                } finally {
                  setDetecting(false);
                }
              }}
              disabled={detecting}
              className="shrink-0 rounded-lg border border-panel-line px-4 text-sm transition hover:border-leaf-dark disabled:opacity-50"
            >
              {detecting ? "Analisando..." : "Sugerir áreas"}
            </button>
          </div>
          {hypotheses.length > 0 && (
            <div className="mt-3 rounded-xl bg-panel-bg p-3">
              <p className="mb-2 text-xs text-panel-sub">
                Acredito que sua empresa se enquadre em uma destas áreas — toque para adicionar:
              </p>
              <div className="flex flex-wrap gap-2">
                {hypotheses.map((h, index) => (
                  <button
                    key={h.area}
                    type="button"
                    onClick={() => addSegment(h.area)}
                    className="rounded-full border border-panel-line bg-panel-card px-3 py-1.5 text-sm transition hover:border-leaf-dark"
                  >
                    {["🥇", "🥈", "🥉"][index] ?? "•"} {h.area} · {h.confidence}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section
        title="Horário de funcionamento"
        hint="Escolha um atalho e ajuste os dias se precisar. Fora do horário, o Atendente avisa o cliente e usa a mensagem 'fora do horário'."
      >
        <div className="flex flex-wrap gap-2">
          {HOUR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => set("businessHours", preset.build())}
              className="rounded-full border border-panel-line px-3.5 py-1.5 text-sm text-panel-sub transition hover:border-leaf-dark hover:text-leaf-dark"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="divide-y divide-panel-line rounded-xl border border-panel-line">
          {form.businessHours.map((hour) => (
            <div key={hour.day} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="w-24 text-sm font-medium">{WEEKDAYS[hour.day]}</span>
              <button
                type="button"
                onClick={() => setHour(hour.day, { closed: !hour.closed })}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  hour.closed
                    ? "bg-panel-bg text-panel-sub"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {hour.closed ? "Fechado" : "Aberto"}
              </button>
              {!hour.closed && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className={`${inputClass} w-28`}
                    value={hour.open}
                    onChange={(e) => setHour(hour.day, { open: e.target.value })}
                  />
                  <span className="text-sm text-panel-sub">até</span>
                  <input
                    type="time"
                    className={`${inputClass} w-28`}
                    value={hour.close}
                    onChange={(e) => setHour(hour.day, { close: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Produtos, serviços e preços">
        <Field label="Produtos e serviços">
          <textarea
            className={inputClass}
            rows={4}
            placeholder={"Ex.:\n- Serviço padrão (até 1h)\n- Serviço premium\n- Visita técnica / orçamento"}
            value={form.productsServices}
            onChange={(e) => set("productsServices", e.target.value)}
          />
        </Field>
        <Field label="Preços e condições comerciais">
          <textarea
            className={inputClass}
            rows={4}
            placeholder={"Ex.:\n- Serviço padrão: R$ 250\n- Orçamento: gratuito\n- Desconto de 10% no pagamento à vista"}
            value={form.pricingInfo}
            onChange={(e) => set("pricingInfo", e.target.value)}
          />
        </Field>
        <Field label="Formas de pagamento">
          <input
            className={inputClass}
            placeholder="Ex.: Pix, cartão em até 6x, dinheiro"
            value={form.paymentMethods}
            onChange={(e) => set("paymentMethods", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Perguntas frequentes" hint="Perguntas que os clientes fazem sempre — e a resposta oficial da empresa.">
        {form.faqs.map((faq, index) => (
          <div key={index} className="rounded-xl border border-panel-line p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-panel-sub">FAQ {index + 1}</span>
              <button
                type="button"
                onClick={() => set("faqs", form.faqs.filter((_, i) => i !== index))}
                className="text-xs text-red-600 hover:underline"
              >
                remover
              </button>
            </div>
            <input
              className={`${inputClass} mb-2`}
              placeholder="Pergunta"
              value={faq.question}
              onChange={(e) =>
                set("faqs", form.faqs.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)))
              }
            />
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Resposta"
              value={faq.answer}
              onChange={(e) =>
                set("faqs", form.faqs.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)))
              }
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => set("faqs", [...form.faqs, { question: "", answer: "" }])}
          className="rounded-lg border border-dashed border-panel-line px-4 py-2 text-sm text-panel-sub hover:border-leaf-dark hover:text-leaf-dark"
        >
          + Adicionar pergunta
        </button>
      </Section>

      <Section title="Comportamento do Atendente">
        <Field label="Regras de atendimento">
          <textarea
            className={inputClass}
            rows={3}
            placeholder="Ex.: Nunca confirmar prazo como garantido — a equipe confirma. Sempre pedir o nome antes de registrar um orçamento."
            value={form.serviceRules}
            onChange={(e) => set("serviceRules", e.target.value)}
          />
        </Field>
        <Field label="Tom de voz">
          <input
            className={inputClass}
            placeholder="Ex.: acolhedor e informal, como um atendente experiente da casa"
            value={form.aiTone}
            onChange={(e) => set("aiTone", e.target.value)}
          />
        </Field>
        <div>
          <span className="mb-1 block text-sm font-medium">
            Palavras que encaminham para sua equipe
          </span>
          <p className="mb-2 text-xs text-panel-sub">
            Se a mensagem do cliente contiver uma destas expressões, o Atendente para e chama sua
            equipe.
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            {form.handoffKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1.5 rounded-full bg-panel-bg px-3 py-1 text-sm"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => set("handoffKeywords", form.handoffKeywords.filter((k) => k !== keyword))}
                  className="text-panel-sub hover:text-red-600"
                  aria-label={`Remover ${keyword}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Ex.: falar com atendente"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const value = newKeyword.trim();
                  if (value && !form.handoffKeywords.includes(value)) {
                    set("handoffKeywords", [...form.handoffKeywords, value]);
                  }
                  setNewKeyword("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const value = newKeyword.trim();
                if (value && !form.handoffKeywords.includes(value)) {
                  set("handoffKeywords", [...form.handoffKeywords, value]);
                }
                setNewKeyword("");
              }}
              className="shrink-0 rounded-lg border border-panel-line px-4 text-sm hover:border-leaf-dark"
            >
              Adicionar
            </button>
          </div>
        </div>
      </Section>

      <Section title="Mensagens">
        <Field label="Mensagem de saudação (primeira mensagem da conversa)">
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Ex.: Olá! 👋 Aqui é o atendente da [sua empresa]. Como posso ajudar?"
            value={form.greetingMessage}
            onChange={(e) => set("greetingMessage", e.target.value)}
          />
        </Field>
        <Field label="Mensagem fora do horário">
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Ex.: Estamos fechados agora, mas já anotei sua mensagem — a equipe retorna amanhã a partir das 8h."
            value={form.awayMessage}
            onChange={(e) => set("awayMessage", e.target.value)}
          />
        </Field>
      </Section>

      <Section
        title="Follow-up automático"
        hint="Reengaja clientes que pararam de responder no meio da conversa."
      >
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.followUpEnabled}
            onChange={(e) => set("followUpEnabled", e.target.checked)}
          />
          Ativar follow-up automático
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Enviar após (horas sem resposta)">
            <input
              type="number"
              min={1}
              max={72}
              className={inputClass}
              value={form.followUpDelayHours}
              onChange={(e) => set("followUpDelayHours", parseInt(e.target.value, 10) || 1)}
            />
          </Field>
          <Field label="Máximo de follow-ups por conversa">
            <input
              type="number"
              min={0}
              max={5}
              className={inputClass}
              value={form.maxFollowUps}
              onChange={(e) => set("maxFollowUps", parseInt(e.target.value, 10) || 0)}
            />
          </Field>
        </div>
        <Field label="Mensagem de follow-up">
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Ex.: Oi! Ficou alguma dúvida? Estou por aqui se precisar 😊"
            value={form.followUpMessage}
            onChange={(e) => set("followUpMessage", e.target.value)}
          />
        </Field>
      </Section>

      <Section
        title="Conectar WhatsApp"
        hint="Conecte o número da sua empresa para o Atendente começar a responder."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
              WA_STATUS_INFO[wa?.status ?? "DISCONNECTED"].className
            }`}
          >
            {WA_STATUS_INFO[wa?.status ?? "DISCONNECTED"].label}
          </span>
          {wa?.status === "CONNECTED" && wa.connectedAt && (
            <span className="text-xs text-panel-sub">
              conectado em {new Date(wa.connectedAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {wa?.status === "ERROR" && wa.error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {wa.error}
          </p>
        )}

        {wa?.status !== "CONNECTED" && (
          <button
            type="button"
            onClick={connectWhatsApp}
            disabled={waBusy}
            className="rounded-lg bg-leaf-dark px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {waBusy
              ? "Conectando..."
              : wa?.status === "WAITING_QR"
                ? "Gerar novo QR Code"
                : "Criar conexão"}
          </button>
        )}

        {/* Caixa branca de propósito: QR precisa de contraste alto para a câmera */}
        {wa?.status === "WAITING_QR" && wa.qrCode && (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-6 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wa.qrCode} alt="QR Code para conectar o WhatsApp" className="h-52 w-52" />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900">Como conectar:</p>
              <p className="mt-2">
                Abra o WhatsApp no celular &gt; Dispositivos conectados &gt; Conectar dispositivo
                &gt; escaneie o QR Code.
              </p>
              <p className="mt-2 text-xs">
                O QR renova sozinho. Assim que você escanear, o status muda para
                &quot;Conectado&quot; automaticamente.
              </p>
            </div>
          </div>
        )}

        {wa?.status === "CONNECTED" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>Para testar:</strong> envie uma mensagem de outro celular para o seu número.
            Em alguns segundos a conversa aparece na aba <strong>Conversas</strong> — com a
            resposta do seu Atendente.
          </div>
        )}

        <p className="text-xs text-panel-sub">
          A conexão e o recebimento de mensagens são configurados automaticamente — você não
          precisa mexer em nada técnico.
        </p>
      </Section>

      <div className="fixed inset-x-0 bottom-0 border-t border-panel-line bg-panel-card/95 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6">
          {feedback ? (
            <p className={`text-sm ${feedback.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
              {feedback.text}
            </p>
          ) : (
            <span className="text-sm text-panel-sub">As alterações valem imediatamente.</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-leaf-dark px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
