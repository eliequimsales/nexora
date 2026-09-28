"use client";

import { useCallback, useEffect, useState } from "react";

interface Gap {
  id: string;
  question: string;
  askCount: number;
  source: string;
}

interface Item {
  id: string;
  question: string;
  answer: string;
  source: string;
}

interface Inconsistency {
  question: string;
  options: { id: string; answer: string }[];
}

interface FaqItem {
  question: string;
  answer: string;
}

interface Report {
  stats: { totalConversations: number; resolvedByAttendant: number; sentToTeam: number };
  topGaps: Gap[];
  pendingItems: Item[];
  observations: Item[];
  inconsistencies: Inconsistency[];
  interview: { segmentName: string; topics: { topic: string; question: string }[] } | null;
  score: { overall: number; areas: { label: string; pct: number }[]; openGaps: number };
  diary: string[];
}

interface CompanyProfileData {
  name: string;
  description: string;
  address: string;
  paymentMethods: string;
  serviceRules: string;
  productsServices?: string;
  pricingInfo?: string;
  aiTone?: string;
  greetingMessage?: string;
  awayMessage?: string;
  businessHours?: unknown[];
  faqs?: FaqItem[];
  handoffKeywords?: string[];
  segments?: string[];
  followUpEnabled?: boolean;
  followUpDelayHours?: number;
  followUpMessage?: string;
  maxFollowUps?: number;
}

type Tab = "bases" | "faq" | "gaps" | "revisao";

const FAQ_SUGESTOES = [
  {
    pergunta: "Precisa agendar com antecedência?",
    resposta: "Recomendamos agendar com antecedência pelo nosso link para garantir seu horário. Se houver vaga de última hora, atendemos com prazer!",
  },
  {
    pergunta: "Tem estacionamento no local?",
    resposta: "Temos estacionamento no local / convênio próximo para sua comodidade.",
  },
  {
    pergunta: "Como funciona em caso de atraso?",
    resposta: "Temos uma tolerância de 10 minutos. Caso vá se atrasar mais, pedimos que nos avise para reorganizarmos os atendimentos.",
  },
  {
    pergunta: "Posso levar acompanhante?",
    resposta: "Sim, pode trazer acompanhante! Temos espaço de espera confortável com água e café.",
  },
];

export default function TreinamentoPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<Tab>("bases");

  // Campos das bases do negócio
  const [descricao, setDescricao] = useState("");
  const [endereco, setEndereco] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [regras, setRegras] = useState("");

  // FAQ
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaResposta, setNovaResposta] = useState("");
  const [mostrandoFormFaq, setMostrandoFormFaq] = useState(false);
  const [faqEditandoIdx, setFaqEditandoIdx] = useState<number | null>(null);

  // Dúvidas de clientes (gaps)
  const [respostasGaps, setRespostasGaps] = useState<Record<string, string>>({});

  // Edições de itens pendentes
  const [edits, setEdits] = useState<Record<string, { question: string; answer: string }>>({});

  // Estados de carregamento e feedback
  const [salvandoCampo, setSalvandoCampo] = useState<string | null>(null);
  const [salvoSucesso, setSalvoSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  // KUS entrevista
  const [excludedTopics, setExcludedTopics] = useState<Set<string>>(new Set());

  function avisarSucesso(mensagem: string) {
    setSalvoSucesso(mensagem);
    setErro("");
    setTimeout(() => setSalvoSucesso(null), 5000);
  }

  const carregarDados = useCallback(async () => {
    try {
      const [resTreino, resPerfil] = await Promise.all([
        fetch("/api/training"),
        fetch("/api/company/profile"),
      ]);

      if (resTreino.ok) {
        const dadosTreino: Report = await resTreino.json();
        setReport(dadosTreino);
      }

      if (resPerfil.ok) {
        const dadosPerfil = await resPerfil.json();
        const p = dadosPerfil.profile ?? {};
        const comp: CompanyProfileData = {
          name: dadosPerfil.name ?? "",
          description: p.description ?? "",
          address: p.address ?? "",
          paymentMethods: p.paymentMethods ?? "",
          serviceRules: p.serviceRules ?? "",
          productsServices: p.productsServices ?? "",
          pricingInfo: p.pricingInfo ?? "",
          aiTone: p.aiTone ?? "profissional, simpático e objetivo",
          greetingMessage: p.greetingMessage ?? "",
          awayMessage: p.awayMessage ?? "",
          businessHours: p.businessHours ?? [],
          faqs: Array.isArray(p.faqs) ? p.faqs : [],
          handoffKeywords: p.handoffKeywords ?? [],
          segments: p.segments ?? [],
          followUpEnabled: p.followUpEnabled ?? false,
          followUpDelayHours: p.followUpDelayHours ?? 4,
          followUpMessage: p.followUpMessage ?? "",
          maxFollowUps: p.maxFollowUps ?? 2,
        };
        setProfile(comp);
        setDescricao(comp.description);
        setEndereco(comp.address);
        setPagamento(comp.paymentMethods);
        setRegras(comp.serviceRules);
      }
    } catch {
      setErro("Não foi possível carregar os dados agora. Tente recarregar a página.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function salvarPerfil(camposParaAtualizar: Partial<CompanyProfileData>, chaveSalvando: string, mensagem: string) {
    if (!profile) return;
    setSalvandoCampo(chaveSalvando);
    setErro("");

    const payload = {
      name: profile.name || "Minha Empresa",
      description: camposParaAtualizar.description ?? descricao,
      address: camposParaAtualizar.address ?? endereco,
      paymentMethods: camposParaAtualizar.paymentMethods ?? pagamento,
      serviceRules: camposParaAtualizar.serviceRules ?? regras,
      faqs: camposParaAtualizar.faqs ?? profile.faqs ?? [],
      businessHours: profile.businessHours ?? [],
      segments: profile.segments ?? [],
      productsServices: profile.productsServices ?? "",
      pricingInfo: profile.pricingInfo ?? "",
      aiTone: profile.aiTone ?? "profissional, simpático e objetivo",
      greetingMessage: profile.greetingMessage ?? "",
      awayMessage: profile.awayMessage ?? "",
      handoffKeywords: profile.handoffKeywords ?? [],
      followUpEnabled: profile.followUpEnabled ?? false,
      followUpDelayHours: profile.followUpDelayHours ?? 4,
      followUpMessage: profile.followUpMessage ?? "",
      maxFollowUps: profile.maxFollowUps ?? 2,
    };

    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j.error ?? "Não consegui salvar agora. Tente de novo.");
        return;
      }

      avisarSucesso(mensagem);
      await carregarDados();
    } catch {
      setErro("Sem conexão agora. Verifique sua internet.");
    } finally {
      setSalvandoCampo(null);
    }
  }

  async function adicionarOuEditarFaq() {
    if (!novaPergunta.trim() || !novaResposta.trim()) {
      setErro("Preencha a pergunta e a resposta para ensinar o atendente.");
      return;
    }

    const faqsAtuais = [...(profile?.faqs ?? [])];
    if (faqEditandoIdx !== null && faqEditandoIdx >= 0 && faqEditandoIdx < faqsAtuais.length) {
      faqsAtuais[faqEditandoIdx] = {
        question: novaPergunta.trim(),
        answer: novaResposta.trim(),
      };
    } else {
      faqsAtuais.push({
        question: novaPergunta.trim(),
        answer: novaResposta.trim(),
      });
    }

    await salvarPerfil(
      { faqs: faqsAtuais },
      "faq",
      faqEditandoIdx !== null ? "Pergunta atualizada com sucesso!" : "Nova pergunta ensinada com sucesso! O atendente já sabe responder.",
    );

    setNovaPergunta("");
    setNovaResposta("");
    setFaqEditandoIdx(null);
    setMostrandoFormFaq(false);
  }

  async function removerFaq(idxParaRemover: number) {
    const faqsAtuais = (profile?.faqs ?? []).filter((_, i) => i !== idxParaRemover);
    await salvarPerfil({ faqs: faqsAtuais }, `remover-faq-${idxParaRemover}`, "Pergunta removida do conhecimento do atendente.");
  }

  function iniciarEdicaoFaq(idx: number) {
    const item = profile?.faqs?.[idx];
    if (!item) return;
    setNovaPergunta(item.question);
    setNovaResposta(item.answer);
    setFaqEditandoIdx(idx);
    setMostrandoFormFaq(true);
  }

  async function responderGap(gap: Gap) {
    const resposta = (respostasGaps[gap.id] ?? "").trim();
    if (!resposta) {
      setErro("Escreva como o atendente deve responder essa dúvida.");
      return;
    }

    setSalvandoCampo(gap.id);
    setErro("");
    try {
      const res = await fetch("/api/training/teach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gapId: gap.id,
          question: gap.question,
          answer: resposta,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(j.error ?? "Não consegui registrar a resposta agora.");
        return;
      }

      avisarSucesso("Resposta ensinada! O atendente revisou e colocou na fila de aprovação.");
      setRespostasGaps((prev) => {
        const next = { ...prev };
        delete next[gap.id];
        return next;
      });
      await carregarDados();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setSalvandoCampo(null);
    }
  }

  async function dispensarGap(gapId: string) {
    setSalvandoCampo(`d-${gapId}`);
    try {
      await fetch(`/api/training/gaps/${gapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dispensar" }),
      });
      avisarSucesso("Dúvida dispensada.");
      await carregarDados();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setSalvandoCampo(null);
    }
  }

  async function revisarItem(item: Item, acao: "aprovar" | "rejeitar") {
    setSalvandoCampo(item.id);
    const edit = edits[item.id] ?? { question: item.question, answer: item.answer };
    try {
      const res = await fetch(`/api/training/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: acao, ...edit }),
      });
      if (res.ok) {
        avisarSucesso(acao === "aprovar" ? "Conhecimento aprovado! O atendente já está usando." : "Item rejeitado.");
        await carregarDados();
      }
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setSalvandoCampo(null);
    }
  }

  async function resolverInconsistencia(grupo: Inconsistency, idEscolhido: string) {
    setSalvandoCampo(idEscolhido);
    try {
      for (const opt of grupo.options) {
        await fetch(`/api/training/items/${opt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: opt.id === idEscolhido ? "aprovar" : "rejeitar" }),
        });
      }
      avisarSucesso("Resposta correta definida! O atendente usará esta versão.");
      await carregarDados();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setSalvandoCampo(null);
    }
  }

  async function iniciarEntrevista() {
    if (!report?.interview) return;
    const topics = report.interview.topics.map((t) => t.topic).filter((t) => !excludedTopics.has(t));
    setSalvandoCampo("interview");
    try {
      const res = await fetch("/api/training/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics }),
      });
      if (res.ok) {
        avisarSucesso("Perguntas de integração preparadas!");
        await carregarDados();
      }
    } finally {
      setSalvandoCampo(null);
    }
  }

  if (carregando || !report) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
        <p className="text-sm font-medium text-panel-sub">Carregando o treinamento do seu atendente...</p>
      </div>
    );
  }

  const { score, topGaps, pendingItems, observations, inconsistencies, interview } = report;
  const totalPendencias = pendingItems.length + observations.length + inconsistencies.length;
  const totalFaqs = profile?.faqs?.length ?? 0;

  const temDescricao = Boolean(descricao.trim());
  const temEndereco = Boolean(endereco.trim());
  const temPagamento = Boolean(pagamento.trim());
  const temRegras = Boolean(regras.trim());

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-2xl font-bold text-panel-ink">Treinamento do Atendente</h1>
        <p className="mt-1 text-sm text-panel-sub">
          Ensine aqui tudo o que o seu atendente precisa saber para tirar dúvidas e atender seus clientes no WhatsApp com perfeição.
        </p>
      </div>

      {/* Alertas de Feedback */}
      {salvoSucesso && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm animate-fade-in">
          <span>✓</span>
          <span>{salvoSucesso}</span>
        </div>
      )}
      {erro && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-sm">
          <span>✕</span>
          <span>{erro}</span>
        </div>
      )}

      {/* Card de Conhecimento Geral */}
      <section className="overflow-hidden rounded-2xl border border-panel-line bg-panel-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-panel-sub">Nível de Treinamento</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-panel-ink">{score.overall}%</span>
              <span className="text-xs font-medium text-panel-sub">
                {score.overall >= 80 ? "Atendente bem treinado e autônomo" : "Complete os tópicos abaixo para atingir 100%"}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                score.overall >= 80
                  ? "bg-emerald-50 text-emerald-700"
                  : score.overall >= 50
                  ? "bg-amber/15 text-amber-deep"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {score.overall >= 80 ? "✓ Pronto para responder" : "⚠️ Requer ensinamentos"}
            </span>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-panel-bg">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score.overall >= 80 ? "bg-emerald-500" : score.overall >= 50 ? "bg-amber" : "bg-amber-deep"
            }`}
            style={{ width: `${Math.max(5, score.overall)}%` }}
          />
        </div>

        {/* Pílulas de Status das Áreas */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setAbaAtiva("bases")}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
              temDescricao ? "border-emerald-200 bg-emerald-50/40 text-emerald-800" : "border-panel-line bg-panel-bg text-panel-sub hover:border-amber"
            }`}
          >
            <span className="font-bold">{temDescricao ? "✓" : "○"}</span>
            <span className="truncate font-medium">Sobre a empresa</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva("bases")}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
              temEndereco ? "border-emerald-200 bg-emerald-50/40 text-emerald-800" : "border-panel-line bg-panel-bg text-panel-sub hover:border-amber"
            }`}
          >
            <span className="font-bold">{temEndereco ? "✓" : "○"}</span>
            <span className="truncate font-medium">Endereço</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva("bases")}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
              temPagamento ? "border-emerald-200 bg-emerald-50/40 text-emerald-800" : "border-panel-line bg-panel-bg text-panel-sub hover:border-amber"
            }`}
          >
            <span className="font-bold">{temPagamento ? "✓" : "○"}</span>
            <span className="truncate font-medium">Pagamento</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva("faq")}
            className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition ${
              totalFaqs > 0 ? "border-emerald-200 bg-emerald-50/40 text-emerald-800" : "border-panel-line bg-panel-bg text-panel-sub hover:border-amber"
            }`}
          >
            <span className="font-bold">{totalFaqs > 0 ? "✓" : "○"}</span>
            <span className="truncate font-medium">{totalFaqs > 0 ? `${totalFaqs} FAQs salvas` : "Cadastrar FAQs"}</span>
          </button>
        </div>
      </section>

      {/* Navegação de Abas */}
      <div className="flex border-b border-panel-line text-sm font-semibold">
        <button
          type="button"
          onClick={() => setAbaAtiva("bases")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
            abaAtiva === "bases"
              ? "border-amber text-panel-ink"
              : "border-transparent text-panel-sub hover:text-panel-ink"
          }`}
        >
          <span>🏢</span>
          <span>Bases do Negócio</span>
          {(!temDescricao || !temEndereco || !temPagamento || !temRegras) && (
            <span className="h-2 w-2 rounded-full bg-amber" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("faq")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
            abaAtiva === "faq"
              ? "border-amber text-panel-ink"
              : "border-transparent text-panel-sub hover:text-panel-ink"
          }`}
        >
          <span>💬</span>
          <span>Perguntas Frequentes (FAQ)</span>
          <span className="rounded-full bg-panel-bg px-2 py-0.5 text-xs text-panel-sub">
            {totalFaqs}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("gaps")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
            abaAtiva === "gaps"
              ? "border-amber text-panel-ink"
              : "border-transparent text-panel-sub hover:text-panel-ink"
          }`}
        >
          <span>📱</span>
          <span>Dúvidas do WhatsApp</span>
          {topGaps.length > 0 && (
            <span className="rounded-full bg-amber px-2 py-0.5 text-xs font-bold text-night">
              {topGaps.length}
            </span>
          )}
        </button>

        {totalPendencias > 0 && (
          <button
            type="button"
            onClick={() => setAbaAtiva("revisao")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 transition ${
              abaAtiva === "revisao"
                ? "border-amber text-panel-ink"
                : "border-transparent text-panel-sub hover:text-panel-ink"
            }`}
          >
            <span>⚖️</span>
            <span>Aprovações</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
              {totalPendencias}
            </span>
          </button>
        )}
      </div>

      {/* ABA 1: BASES DO NEGÓCIO */}
      {abaAtiva === "bases" && (
        <div className="space-y-5 animate-fade-in">
          <p className="text-xs text-panel-sub">
            Preencha cada área em poucas palavras. O atendente usará essas informações para responder aos clientes com segurança.
          </p>

          {/* 1. Sobre a Empresa */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏢</span>
                  <h3 className="font-display text-base font-semibold text-panel-ink">Sobre a empresa e serviços</h3>
                  {temDescricao ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Pronto</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-deep">Falta preencher</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-panel-sub">
                  O que seu negócio faz, especialidades e o que você oferece aos clientes.
                </p>
              </div>
            </div>

            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, 2000))}
              placeholder="Ex: Somos uma estética especializada em limpeza de pele profunda, hidratação e harmonização. Trabalhamos com atendimento personalizado e produtos de alta qualidade."
              className="mt-3 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-panel-sub">{descricao.length} / 2000 caracteres</span>
              <button
                type="button"
                onClick={() => salvarPerfil({ description: descricao.trim() }, "descricao", "Sobre a empresa atualizado com sucesso!")}
                disabled={salvandoCampo === "descricao" || descricao.trim() === (profile?.description ?? "")}
                className="rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-night transition hover:brightness-105 disabled:opacity-50"
              >
                {salvandoCampo === "descricao" ? "Salvando..." : "Salvar este campo"}
              </button>
            </div>
          </div>

          {/* 2. Endereço e Como Chegar */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📍</span>
                  <h3 className="font-display text-base font-semibold text-panel-ink">Endereço e como chegar</h3>
                  {temEndereco ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Pronto</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-deep">Falta preencher</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-panel-sub">
                  Localização exata, ponto de referência e informações de estacionamento.
                </p>
              </div>
            </div>

            <textarea
              rows={2}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value.slice(0, 300))}
              placeholder="Ex: Av. Paulista, 1000 - Sala 42, Bela Vista. Em frente ao metrô Trianon-Masp. Temos convênio com o estacionamento ao lado."
              className="mt-3 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-panel-sub">{endereco.length} / 300 caracteres</span>
              <button
                type="button"
                onClick={() => salvarPerfil({ address: endereco.trim() }, "endereco", "Endereço atualizado com sucesso!")}
                disabled={salvandoCampo === "endereco" || endereco.trim() === (profile?.address ?? "")}
                className="rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-night transition hover:brightness-105 disabled:opacity-50"
              >
                {salvandoCampo === "endereco" ? "Salvando..." : "Salvar este campo"}
              </button>
            </div>
          </div>

          {/* 3. Formas de Pagamento */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">💳</span>
                  <h3 className="font-display text-base font-semibold text-panel-ink">Formas de pagamento aceitas</h3>
                  {temPagamento ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Pronto</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-deep">Falta preencher</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-panel-sub">
                  Meios aceitos (Pix, dinheiro, débito, crédito) e condições de parcelamento.
                </p>
              </div>
            </div>

            <textarea
              rows={2}
              value={pagamento}
              onChange={(e) => setPagamento(e.target.value.slice(0, 1000))}
              placeholder="Ex: Aceitamos Pix, dinheiro, cartões de crédito e débito. Parcelamos em até 3x sem juros (ou em até 10x com taxa da maquininha)."
              className="mt-3 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-panel-sub">{pagamento.length} / 1000 caracteres</span>
              <button
                type="button"
                onClick={() => salvarPerfil({ paymentMethods: pagamento.trim() }, "pagamento", "Formas de pagamento atualizadas com sucesso!")}
                disabled={salvandoCampo === "pagamento" || pagamento.trim() === (profile?.paymentMethods ?? "")}
                className="rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-night transition hover:brightness-105 disabled:opacity-50"
              >
                {salvandoCampo === "pagamento" ? "Salvando..." : "Salvar este campo"}
              </button>
            </div>
          </div>

          {/* 4. Regras de Atendimento */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  <h3 className="font-display text-base font-semibold text-panel-ink">Regras e políticas de atendimento</h3>
                  {temRegras ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">✓ Pronto</span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-deep">Falta preencher</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-panel-sub">
                  Tolerância a atrasos, regras para remarcações ou cancelamentos e acompanhantes.
                </p>
              </div>
            </div>

            <textarea
              rows={2}
              value={regras}
              onChange={(e) => setRegras(e.target.value.slice(0, 2000))}
              placeholder="Ex: Tolerância máxima de 10 minutos de atraso para não comprometer os próximos horários. Para remarcar, pedimos aviso prévio de pelo menos 2 horas."
              className="mt-3 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
            />

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-panel-sub">{regras.length} / 2000 caracteres</span>
              <button
                type="button"
                onClick={() => salvarPerfil({ serviceRules: regras.trim() }, "regras", "Regras de atendimento atualizadas com sucesso!")}
                disabled={salvandoCampo === "regras" || regras.trim() === (profile?.serviceRules ?? "")}
                className="rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-night transition hover:brightness-105 disabled:opacity-50"
              >
                {salvandoCampo === "regras" ? "Salvando..." : "Salvar este campo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: PERGUNTAS FREQUENTES (FAQ) */}
      {abaAtiva === "faq" && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-panel-ink">
                Perguntas e Respostas Frequentes ({totalFaqs})
              </h2>
              <p className="text-xs text-panel-sub">
                Ensine como o atendente deve responder às perguntas mais frequentes que chegam no WhatsApp.
              </p>
            </div>
            {!mostrandoFormFaq && (
              <button
                type="button"
                onClick={() => {
                  setFaqEditandoIdx(null);
                  setNovaPergunta("");
                  setNovaResposta("");
                  setMostrandoFormFaq(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber px-4 py-2 text-xs font-semibold text-night transition hover:brightness-105"
              >
                <span>+</span>
                <span>Ensinar nova pergunta</span>
              </button>
            )}
          </div>

          {/* Sugestões Rápidas de 1 Clique */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-4">
            <p className="text-xs font-semibold text-panel-ink">💡 Sugestões comuns para ensinar com 1 clique:</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {FAQ_SUGESTOES.map((sug) => (
                <button
                  key={sug.pergunta}
                  type="button"
                  onClick={() => {
                    setNovaPergunta(sug.pergunta);
                    setNovaResposta(sug.resposta);
                    setFaqEditandoIdx(null);
                    setMostrandoFormFaq(true);
                  }}
                  className="rounded-lg border border-panel-line bg-panel-bg px-3 py-1.5 text-xs text-panel-ink transition hover:border-amber hover:bg-amber/10"
                >
                  + {sug.pergunta}
                </button>
              ))}
            </div>
          </div>

          {/* Formulário de Adicionar / Editar FAQ */}
          {mostrandoFormFaq && (
            <div className="rounded-2xl border-2 border-amber/40 bg-amber-50/20 p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3">
                <h3 className="font-display text-sm font-bold text-panel-ink">
                  {faqEditandoIdx !== null ? "Editar pergunta ensinada" : "Ensinar nova pergunta ao atendente"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setMostrandoFormFaq(false);
                    setFaqEditandoIdx(null);
                  }}
                  className="text-xs text-panel-sub hover:text-panel-ink"
                >
                  ✕ Fechar
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-panel-ink">Pergunta do cliente:</label>
                  <input
                    type="text"
                    value={novaPergunta}
                    onChange={(e) => setNovaPergunta(e.target.value.slice(0, 300))}
                    placeholder="Ex: Vocês atendem por ordem de chegada ou só agendado?"
                    maxLength={300}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-panel-ink">Como o atendente deve responder:</label>
                  <textarea
                    rows={3}
                    value={novaResposta}
                    onChange={(e) => setNovaResposta(e.target.value.slice(0, 1500))}
                    placeholder="Ex: Atendemos prioritariamente com horário marcado para garantir seu conforto. Você pode escolher seu horário no nosso link de agendamento!"
                    maxLength={1500}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrandoFormFaq(false);
                      setFaqEditandoIdx(null);
                    }}
                    className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={adicionarOuEditarFaq}
                    disabled={salvandoCampo === "faq" || !novaPergunta.trim() || !novaResposta.trim()}
                    className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night transition hover:brightness-105 disabled:opacity-50"
                  >
                    {salvandoCampo === "faq" ? "Ensinando..." : faqEditandoIdx !== null ? "Salvar alterações" : "Adicionar ao conhecimento"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de FAQs Cadastradas */}
          {totalFaqs === 0 && !mostrandoFormFaq ? (
            <div className="rounded-2xl border border-dashed border-panel-line bg-panel-card p-8 text-center">
              <span className="text-3xl">💬</span>
              <h3 className="mt-2 text-sm font-semibold text-panel-ink">Nenhuma pergunta cadastrada ainda</h3>
              <p className="mt-1 text-xs text-panel-sub">
                Use as sugestões acima ou clique em &ldquo;Ensinar nova pergunta&rdquo; para deixar seu atendente preparado.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(profile?.faqs ?? []).map((faq, idx) => (
                <div key={idx} className="rounded-2xl border border-panel-line bg-panel-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-panel-ink">&ldquo;{faq.question}&rdquo;</p>
                      <p className="text-xs text-panel-sub">{faq.answer}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => iniciarEdicaoFaq(idx)}
                        className="rounded-lg p-1.5 text-xs text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
                        title="Editar pergunta"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => removerFaq(idx)}
                        disabled={salvandoCampo === `remover-faq-${idx}`}
                        className="rounded-lg p-1.5 text-xs text-red-600 transition hover:bg-red-50"
                        title="Remover pergunta"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 3: DÚVIDAS DO WHATSAPP (GAPS) */}
      {abaAtiva === "gaps" && (
        <div className="space-y-4 animate-fade-in">
          <div>
            <h2 className="font-display text-base font-semibold text-panel-ink">
              Dúvidas reais que clientes perguntaram no WhatsApp
            </h2>
            <p className="text-xs text-panel-sub">
              Sempre que um cliente perguntar algo que o atendente ainda não sabe, a dúvida aparece aqui para você ensinar com 1 clique.
            </p>
          </div>

          {topGaps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-panel-line bg-panel-card p-8 text-center">
              <span className="text-3xl">🎉</span>
              <h3 className="mt-2 text-sm font-semibold text-panel-ink">Nenhuma dúvida pendente de clientes no momento</h3>
              <p className="mt-1 text-xs text-panel-sub">
                Seu atendente está afiado! Se algum cliente perguntar algo novo no WhatsApp, a pergunta será listada aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {topGaps.map((gap) => (
                <div key={gap.id} className="rounded-2xl border border-amber/30 bg-amber-50/20 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-amber/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-deep">
                        Perguntado no WhatsApp ({gap.askCount}x)
                      </span>
                      <p className="mt-1.5 text-base font-bold text-panel-ink">&ldquo;{gap.question}&rdquo;</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-medium text-panel-ink">Como o atendente deve responder:</label>
                    <textarea
                      rows={2}
                      value={respostasGaps[gap.id] ?? ""}
                      onChange={(e) => setRespostasGaps({ ...respostasGaps, [gap.id]: e.target.value })}
                      placeholder="Escreva a resposta correta para o atendente aprender..."
                      className="mt-1 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => dispensarGap(gap.id)}
                      disabled={salvandoCampo === `d-${gap.id}`}
                      className="text-xs font-semibold text-panel-sub hover:text-panel-ink"
                    >
                      Não é relevante / Dispensar
                    </button>
                    <button
                      type="button"
                      onClick={() => responderGap(gap)}
                      disabled={salvandoCampo === gap.id || !(respostasGaps[gap.id] ?? "").trim()}
                      className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night transition hover:brightness-105 disabled:opacity-50"
                    >
                      {salvandoCampo === gap.id ? "Ensinando..." : "Ensinar atendente"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA 4: APROVAÇÕES E INCONSISTÊNCIAS */}
      {abaAtiva === "revisao" && (
        <div className="space-y-5 animate-fade-in">
          <div>
            <h2 className="font-display text-base font-semibold text-panel-ink">
              Itens aguardando sua revisão e aprovação ({totalPendencias})
            </h2>
            <p className="text-xs text-panel-sub">
              Nada vira resposta definitiva sem a sua confirmação. Revise e aprove para o atendente começar a usar.
            </p>
          </div>

          {/* Inconsistências */}
          {inconsistencies.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-panel-sub">Respostas conflitantes encontradas</h3>
              {inconsistencies.map((grupo) => (
                <div key={grupo.question} className="rounded-2xl border border-panel-line bg-panel-card p-5">
                  <p className="text-sm font-bold text-panel-ink">&ldquo;{grupo.question}&rdquo;</p>
                  <p className="mt-0.5 text-xs text-panel-sub">Qual destas respostas é a correta?</p>

                  <div className="mt-3 space-y-2">
                    {grupo.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex flex-col gap-2 rounded-xl border border-panel-line bg-panel-bg p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="text-xs text-panel-ink">{opt.answer}</p>
                        <button
                          type="button"
                          onClick={() => resolverInconsistencia(grupo, opt.id)}
                          disabled={salvandoCampo !== null}
                          className="shrink-0 rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-night transition hover:brightness-105"
                        >
                          Esta está correta
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Itens Pendentes e Observações */}
          {(pendingItems.length > 0 || observations.length > 0) && (
            <div className="space-y-3">
              {[...pendingItems, ...observations].map((item) => {
                const edit = edits[item.id] ?? { question: item.question, answer: item.answer };
                return (
                  <div key={item.id} className="rounded-2xl border border-amber/30 bg-amber-50/20 p-5">
                    <input
                      value={edit.question}
                      onChange={(e) => setEdits({ ...edits, [item.id]: { ...edit, question: e.target.value } })}
                      className="w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-sm font-semibold text-panel-ink focus:border-amber focus:outline-none"
                    />
                    <textarea
                      rows={2}
                      value={edit.answer}
                      onChange={(e) => setEdits({ ...edits, [item.id]: { ...edit, answer: e.target.value } })}
                      className="mt-2 w-full rounded-xl border border-panel-line bg-white p-3 text-sm text-panel-ink focus:border-amber focus:outline-none"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => revisarItem(item, "rejeitar")}
                        disabled={salvandoCampo === item.id}
                        className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
                      >
                        Rejeitar
                      </button>
                      <button
                        type="button"
                        onClick={() => revisarItem(item, "aprovar")}
                        disabled={salvandoCampo === item.id}
                        className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night transition hover:brightness-105"
                      >
                        {salvandoCampo === item.id ? "Aprovando..." : "Aprovar — pode usar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* KUS Entrevista de Integração (se disponível) */}
      {interview && (
        <section className="rounded-2xl border border-panel-line bg-panel-card p-5">
          <h3 className="font-display text-sm font-bold text-panel-ink">
            Roteiro de integração para {interview.segmentName}
          </h3>
          <p className="mt-1 text-xs text-panel-sub">
            Selecione os assuntos que você deseja ensinar ao atendente para agilizar a configuração inicial.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {interview.topics.map((t) => (
              <label key={t.topic} className="flex items-center gap-2 text-xs text-panel-ink">
                <input
                  type="checkbox"
                  checked={!excludedTopics.has(t.topic)}
                  onChange={(e) => {
                    const next = new Set(excludedTopics);
                    if (e.target.checked) next.delete(t.topic);
                    else next.add(t.topic);
                    setExcludedTopics(next);
                  }}
                  className="rounded border-panel-line text-amber focus:ring-amber"
                />
                <span>{t.topic}</span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={iniciarEntrevista}
              disabled={salvandoCampo === "interview"}
              className="rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night transition hover:brightness-105 disabled:opacity-50"
            >
              {salvandoCampo === "interview" ? "Preparando..." : "Começar roteiro de perguntas"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
