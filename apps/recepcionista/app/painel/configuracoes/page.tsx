"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * MEU ATENDENTE NO WHATSAPP — a tela de ativação do produto.
 *
 * Não é "configurações": é a PRIMEIRA tela que um dono novo vê (o cadastro e o
 * login com Google empurram para cá). Ela era um formulão de oito blocos e ~25
 * campos vazios, com o bloco que liga o WhatsApp lá embaixo, no fim de tudo.
 *
 * Agora é um passo a passo: ligar o WhatsApp primeiro (é o que faz o produto
 * existir), depois o mínimo que a atendente precisa saber para responder, e o
 * resto recolhido. Quem só quer ligar o bot em dois minutos consegue; quem quer
 * afinar abre o bloco de baixo.
 *
 * OS NOMES DOS CAMPOS NÃO MUDAM. `followUpEnabled`, `handoffKeywords` e
 * companhia são contrato com o Zod em lib/validation.ts, e o schema tem
 * `.default()` em quase tudo: um campo renomeado não dá erro — ele é
 * silenciosamente trocado pelo default e APAGA o dado do dono. O que muda aqui
 * é só o que ele lê.
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
 * O selo diz o que ESTÁ ACONTECENDO com o WhatsApp dele, não o estado da
 * máquina. "Desconectado" e "Erro na conexão" descreviam o sistema e não diziam
 * o que fazer a respeito.
 */
const WA_STATUS_INFO: Record<WhatsAppState["status"], { label: string; bolinha: string }> = {
  DISCONNECTED: { label: "Seu WhatsApp ainda não está ligado", bolinha: "bg-panel-line" },
  WAITING_QR: { label: "Aguardando você escanear o QR Code", bolinha: "bg-amber" },
  CONNECTED: { label: "Atendente online e atendendo", bolinha: "bg-emerald-500" },
  ERROR: { label: "Não consegui ligar seu WhatsApp", bolinha: "bg-red-500" },
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
  "w-full rounded-lg border border-panel-line bg-white px-3 py-2.5 text-sm text-panel-ink outline-none focus:border-amber";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [redirecionando] = useState(true);

  useEffect(() => {
    router.replace("/painel/clientes/importar");
  }, [router]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [hypotheses, setHypotheses] = useState<{ area: string; confidence: number }[]>([]);
  const [wa, setWa] = useState<WhatsAppState | null>(null);
  const [waBusy, setWaBusy] = useState(false);

  function addSegment(area: string) {
    const value = area.trim();
    setForm((current) =>
      value && !current.segments.includes(value) && current.segments.length < 3
        ? { ...current, segments: [...current.segments, value] }
        : current,
    );
  }

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (!res.ok || !active) return;
        const data = await res.json();
        setWa(data.state);
      } catch {
        /* mantém o estado anterior */
      }
    };
    loadStatus();
    const interval = setInterval(loadStatus, 5_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  /**
   * Ligar o WhatsApp.
   *
   * A recusa por assinatura (402) NÃO traz `state`, então o código antigo
   * (`if (data.state) …` e mais nada) fazia o botão piscar e não acontecer
   * absolutamente nada: sem erro, sem explicação e sem caminho para pagar.
   */
  async function connectWhatsApp() {
    setWaBusy(true);
    setRecusa(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.acao?.href) setRecusa({ motivo: data.error ?? "", acao: data.acao });
        else
          setFeedback({
            type: "error",
            text: "Não consegui ligar seu WhatsApp agora. Tenta de novo em um minuto.",
          });
        return;
      }
      if (data.state) setWa(data.state);
    } catch {
      setFeedback({ type: "error", text: "Não consegui falar com a internet agora." });
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
        businessHours:
          Array.isArray(profile.businessHours) && profile.businessHours.length === 7
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
        setFeedback({ type: "error", text: data.error ?? "Não consegui salvar agora." });
        return;
      }
      setFeedback({ type: "ok", text: "Salvo — sua atendente já responde assim." });
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

  const status = wa?.status ?? "DISCONNECTED";
  const selo = WA_STATUS_INFO[status];

  if (redirecionando) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        <p className="text-sm text-panel-sub">Redirecionando para Meus clientes…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="font-display text-2xl font-bold">WhatsApp</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Sua atendente responde os clientes 24 horas por dia, no seu número. Ela só fala o
          que você ensinar nesta página — nada é inventado.
        </p>
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
        title="Ligar meu WhatsApp"
        hint="Sem este passo a atendente não recebe nem responde nada."
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${selo.bolinha}`} />
          <span className="text-sm font-medium text-panel-ink">{selo.label}</span>
          {status === "CONNECTED" && wa?.connectedAt && (
            <span className="text-xs text-panel-sub">
              ligado em {new Date(wa.connectedAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {status === "ERROR" && (
          /* O texto interno do servidor NUNCA chega aqui: já houve caminho real
             para o dono ler nome de variável de ambiente nesta caixa. */
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Alguma coisa impediu a ligação do seu WhatsApp. Tente de novo em um minuto — se
            continuar assim, fale com a gente que a gente resolve.
          </p>
        )}

        {status !== "CONNECTED" && (
          <button
            type="button"
            onClick={connectWhatsApp}
            disabled={waBusy}
            className="rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
          >
            {waBusy
              ? "Abrindo…"
              : status === "WAITING_QR"
                ? "Mostrar um código novo"
                : "Escanear QR Code no WhatsApp"}
          </button>
        )}

        {status === "WAITING_QR" && wa?.qrCode && (
          /* Caixa branca de propósito: o código precisa de contraste alto para
             a câmera do celular conseguir ler. */
          <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-6 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wa.qrCode} alt="Código para ligar seu WhatsApp" className="h-52 w-52" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Como fazer, no seu celular:</p>
              <ol className="mt-2 space-y-1.5">
                <li>1. Abra o WhatsApp no seu celular</li>
                <li>2. Vá em &quot;Aparelhos conectados&quot; e depois em &quot;Conectar um aparelho&quot;</li>
                <li>3. Aponte a câmera para o código aqui do lado</li>
              </ol>
              <p className="mt-3 text-xs text-gray-600">
                O código troca sozinho de tempos em tempos. Assim que você escanear, esta tela
                avisa que deu certo.
              </p>
            </div>
          </div>
        )}

        {status === "CONNECTED" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>Para testar:</strong> pegue outro celular e mande uma mensagem para o seu
            número. Em alguns segundos sua atendente responde sozinha.
          </div>
        )}

        <p className="text-xs text-panel-sub">
          Tudo é ligado automaticamente — você não precisa mexer em nada técnico.
        </p>
      </Passo>

      <Passo
        numero={2}
        title="O que a atendente precisa saber sobre o seu negócio"
        hint="É com isto que ela responde. O que não estiver aqui, ela não inventa: ela chama você."
      >
        <Field label="Nome do seu negócio">
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>

        <Field label="O que você vende">
          <textarea
            className={inputClass}
            rows={4}
            placeholder={"Ex.:\n- Corte de cabelo\n- Barba\n- Corte + barba"}
            value={form.productsServices}
            onChange={(e) => set("productsServices", e.target.value)}
          />
        </Field>

        <Field label="Preços, pacotes e descontos">
          <textarea
            className={inputClass}
            rows={4}
            placeholder={"Ex.:\nCorte: R$ 50 | Barba: R$ 35\nCorte + barba: R$ 75\n10% de desconto à vista"}
            value={form.pricingInfo}
            onChange={(e) => set("pricingInfo", e.target.value)}
          />
        </Field>

        <Field label="Como o cliente pode pagar">
          <input
            className={inputClass}
            placeholder="Ex.: Pix, cartão em até 6x, dinheiro"
            value={form.paymentMethods}
            onChange={(e) => set("paymentMethods", e.target.value)}
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
          <span className="mb-1 block text-sm font-medium">Horário de funcionamento</span>
          <p className="mb-2 text-xs text-panel-sub">
            Escolha um atalho e ajuste os dias se precisar. Fora do horário, a atendente avisa
            o cliente e usa a mensagem de quando você está fechado.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {HOUR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => set("businessHours", preset.build())}
                className="rounded-full border border-panel-line px-3.5 py-1.5 text-sm text-panel-sub transition hover:border-amber hover:text-amber-deep"
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
                    hour.closed ? "bg-panel-bg text-panel-sub" : "bg-emerald-100 text-emerald-700"
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
        </div>
      </Passo>

      {/*
        O resto fica recolhido. Um <details> nativo: é o único padrão de
        colapsável que este repositório já usou, não precisa de JavaScript e não
        pode ser compartilhado com o funil público (tests/tema-funil.test.ts
        proíbe componente comum entre os dois mundos).
      */}
      <details className="group rounded-2xl border border-panel-line bg-panel-card p-6">
        <summary className="cursor-pointer list-none font-display text-lg font-semibold">
          <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
          Configurações adicionais (opcional)
        </summary>
        <p className="mt-1 text-sm text-panel-sub">
          Sua atendente já funciona sem nada disto. Abra quando quiser afinar o jeito dela.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <span className="mb-1 block text-sm font-medium">Sobre o seu negócio</span>
            <textarea
              className={inputClass}
              rows={3}
              placeholder="Ex.: Barbearia no centro, atendendo o bairro há 10 anos, especializada em barba."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium">O que seu negócio faz (até 3)</span>
            <p className="mb-2 text-xs text-panel-sub">
              Com isto preenchido, sua atendente já chega conhecendo as palavras do seu ramo. A
              decisão é sempre sua — a sugestão é só um atalho.
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {form.segments.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1.5 rounded-full bg-panel-bg px-3 py-1 text-sm"
                >
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
                placeholder="Ex.: Barbearia, Estética"
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
                className="shrink-0 rounded-lg border border-panel-line px-4 text-sm transition hover:border-amber"
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
                        text: "Não consegui adivinhar. Escreva ali em cima o que seu negócio faz, salve, e tente de novo.",
                      });
                  } catch {
                    setFeedback({ type: "error", text: "Não consegui falar com a internet agora." });
                  } finally {
                    setDetecting(false);
                  }
                }}
                disabled={detecting}
                className="shrink-0 rounded-lg border border-panel-line px-4 text-sm transition hover:border-amber disabled:opacity-50"
              >
                {detecting ? "Pensando…" : "Adivinhar para mim"}
              </button>
            </div>
            {hypotheses.length > 0 && (
              <div className="mt-3 rounded-xl bg-panel-bg p-3">
                {/* Sem o "· 94%": porcentagem de modelo de IA não diz nada ao
                    dono, e a ordem já carrega a mesma informação. */}
                <p className="mb-2 text-xs text-panel-sub">
                  Acho que seu negócio é isto aqui — escolha para adicionar:
                </p>
                <div className="flex flex-wrap gap-2">
                  {hypotheses.map((h, index) => (
                    <button
                      key={h.area}
                      type="button"
                      onClick={() => addSegment(h.area)}
                      className="rounded-full border border-panel-line bg-panel-card px-3 py-1.5 text-sm transition hover:border-amber"
                    >
                      {index === 0 ? "Mais provável: " : "Também pode ser: "}
                      {h.area}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Field label="Como a atendente deve falar com o cliente">
            <input
              className={inputClass}
              placeholder="Ex.: acolhedor e informal, como alguém da casa"
              value={form.aiTone}
              onChange={(e) => set("aiTone", e.target.value)}
            />
          </Field>

          <Field label="O que ela pode e não pode falar">
            <textarea
              className={inputClass}
              rows={3}
              placeholder="Ex.: Nunca prometer prazo como garantido — quem confirma sou eu. Sempre perguntar o nome antes de anotar."
              value={form.serviceRules}
              onChange={(e) => set("serviceRules", e.target.value)}
            />
          </Field>

          <div>
            <span className="mb-1 block text-sm font-medium">
              Quando o cliente escrever isso, me chame
            </span>
            <p className="mb-2 text-xs text-panel-sub">
              Se a mensagem do cliente tiver uma destas palavras, a atendente para e chama
              você. Algumas já funcionam sozinhas, sem você escrever nada: atendente, humano,
              suporte, responsável.
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
                    onClick={() =>
                      set("handoffKeywords", form.handoffKeywords.filter((k) => k !== keyword))
                    }
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
                placeholder="Ex.: falar com o dono"
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
                className="shrink-0 rounded-lg border border-panel-line px-4 text-sm hover:border-amber"
              >
                Adicionar
              </button>
            </div>
          </div>

          <Field label="Primeira mensagem que o cliente recebe">
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Ex.: Olá! 👋 Aqui é a atendente da [seu negócio]. Como posso ajudar?"
              value={form.greetingMessage}
              onChange={(e) => set("greetingMessage", e.target.value)}
            />
          </Field>

          <Field label="Mensagem de quando você está fechado">
            <textarea
              className={inputClass}
              rows={2}
              placeholder="Ex.: Estamos fechados agora, mas já anotei sua mensagem — retorno amanhã a partir das 8h."
              value={form.awayMessage}
              onChange={(e) => set("awayMessage", e.target.value)}
            />
          </Field>

          <div className="rounded-xl border border-panel-line p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.followUpEnabled}
                onChange={(e) => set("followUpEnabled", e.target.checked)}
              />
              Mandar um lembrete quando o cliente parar de responder
            </label>
            <p className="mt-1 text-xs text-panel-sub">
              Muita gente pergunta o preço e some. O lembrete traz parte dessa gente de volta.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Esperar quantas horas antes de lembrar?">
                <input
                  type="number"
                  min={1}
                  max={72}
                  className={inputClass}
                  value={form.followUpDelayHours}
                  onChange={(e) => set("followUpDelayHours", parseInt(e.target.value, 10) || 1)}
                />
              </Field>
              <Field label="No máximo quantos lembretes por cliente?">
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

            <div className="mt-4">
              <Field label="O que o lembrete vai dizer">
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Ex.: Oi! Ficou alguma dúvida? Estou por aqui se precisar 😊"
                  value={form.followUpMessage}
                  onChange={(e) => set("followUpMessage", e.target.value)}
                />
              </Field>
              {form.followUpEnabled && !form.followUpMessage.trim() && (
                /* Ligado com a mensagem vazia, o envio não acontece — e antes a
                   tela deixava o dono acreditar que estava funcionando. */
                <p className="mt-2 rounded-lg bg-amber/20 p-2.5 text-xs text-[#7A5A10]">
                  Escreva a mensagem acima, senão o lembrete não é enviado.
                </p>
              )}
            </div>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium">Perguntas que os clientes sempre fazem</span>
            <p className="mb-3 text-xs text-panel-sub">
              A pergunta e a resposta certa. É daqui que ela tira o que responder.
            </p>
            <div className="space-y-4">
              {form.faqs.map((faq, index) => (
                <div key={index} className="rounded-xl border border-panel-line p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-panel-sub">Pergunta {index + 1}</span>
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
                    placeholder="O que o cliente pergunta"
                    value={faq.question}
                    onChange={(e) =>
                      set(
                        "faqs",
                        form.faqs.map((f, i) => (i === index ? { ...f, question: e.target.value } : f)),
                      )
                    }
                  />
                  <textarea
                    className={inputClass}
                    rows={2}
                    placeholder="O que ela deve responder"
                    value={faq.answer}
                    onChange={(e) =>
                      set(
                        "faqs",
                        form.faqs.map((f, i) => (i === index ? { ...f, answer: e.target.value } : f)),
                      )
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("faqs", [...form.faqs, { question: "", answer: "" }])}
                className="rounded-lg border border-dashed border-panel-line px-4 py-2 text-sm text-panel-sub hover:border-amber hover:text-amber-deep"
              >
                + Adicionar pergunta
              </button>
            </div>
          </div>
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 border-t border-panel-line bg-panel-card/95 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6">
          {feedback ? (
            <p className={`text-sm ${feedback.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
              {feedback.text}
            </p>
          ) : (
            <span className="text-sm text-panel-sub">
              Depois de salvar, sua atendente já responde assim.
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
