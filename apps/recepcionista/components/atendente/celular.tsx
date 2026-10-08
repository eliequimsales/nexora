"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { conversaDeExemplo, type Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { ehCondicaoPontual } from "@/components/atendente/aprendizado-passivo";

/**
 * O CELULAR — SIMULADOR ULTRA-REALISTA DO WHATSAPP COM CONFIGURAÇÃO INTEGRADA.
 *
 * Suporta três dinâmicas integradas no centro do atendimento:
 * 1. 💬 "Testar como Cliente": o dono testa exatamente como o cliente conversa.
 *    Em cada resposta, ele pode tocar em "Ajustar esta resposta" para mudar regras na hora.
 * 2. 💡 "Aprendizado Passivo": sugestões observadas no WhatsApp real para aprovar com 1 toque.
 * 3. 🎓 "Ensinar Atendente": conversa direta para adicionar serviços, horários e regras.
 */

type MensagemCliente = {
  de: "cliente" | "atendente";
  texto: string;
  fonte?: string;
  agendamentoConfirmado?: boolean;
};

type MensagemEnsino = {
  de: "dono" | "atendente";
  texto: string;
  salvo?: boolean;
};

const SUGESTOES_CLIENTE = ["🕒 Tem horário amanhã?", "💳 Quanto custa?", "📍 Onde fica?"];
const PAUSA_ENTRE_BOLHAS_MS = 650;
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

function formatarHoraAgora(): string {
  const agora = new Date();
  const h = String(agora.getHours()).padStart(2, "0");
  const m = String(agora.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function Celular({
  tela,
  nome,
  jeito,
  aoTestar,
  aoAjustar,
  aoAtualizarTela,
  aoAbrirSabe,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  aoTestar: () => void;
  aoAjustar?: (dados: Record<string, unknown>) => Promise<void>;
  aoAtualizarTela?: () => Promise<void>;
  aoAbrirSabe?: () => void;
}) {
  const semServicos = tela.sabe.servicos.length === 0;

  // Se a empresa ainda não tem serviços cadastrados, começa automaticamente em "ensinar"
  const [modo, setModo] = useState<"ensinar" | "cliente">(() => (semServicos ? "ensinar" : "cliente"));

  // Estados do modo CLIENTE
  const [teste, setTeste] = useState<MensagemCliente[] | null>(null);
  const [estadoCliente, setEstadoCliente] = useState<{ tipo?: string } | null>(null);

  // Estados do Ajuste Interativo dentro do Chat (Modo Cliente)
  const [ajustandoIndice, setAjustandoIndice] = useState<number | null>(null);
  const [etapaAjuste, setEtapaAjuste] = useState<"escolha" | "confirmacao" | "sucesso">("escolha");
  const [regraProposta, setRegraProposta] = useState<{
    titulo: string;
    descricao: string;
    acao: () => Promise<void>;
  } | null>(null);
  const [textoPersonalizado, setTextoPersonalizado] = useState("");
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [perguntaParaRepetir, setPerguntaParaRepetir] = useState<string | null>(null);

  // Estados do Aprendizado Passivo no Chat
  const [ocupadoObs, setOcupadoObs] = useState(false);
  const [obsSucesso, setObsSucesso] = useState<string | null>(null);

  // Estados do modo ENSINO
  const saudacaoInicialEnsino = useMemo(() => {
    if (semServicos) {
      return "Oi! 👋 Me conta: quais serviços você mais vende e quanto custa cada um?";
    }
    return "Oi! 👋 Para adicionar serviços, horários ou regras, é só me mandar aqui!";
  }, [semServicos]);

  const [mensagensEnsino, setMensagensEnsino] = useState<MensagemEnsino[]>([
    { de: "atendente", texto: saudacaoInicialEnsino },
  ]);

  const [sugestoesEnsino, setSugestoesEnsino] = useState<string[]>(
    semServicos
      ? ["Corte R$ 45 e Barba R$ 35", "Consulta R$ 150", "Manicure R$ 35"]
      : ["Seg a Sáb 9h às 19h", "Pix, cartão e dinheiro", "Quando perguntarem X, responda Y"],
  );

  const [entrada, setEntrada] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState("");
  const [horaStatus, setHoraStatus] = useState("09:41");
  const [notificacaoSalvo, setNotificacaoSalvo] = useState(false);

  const rolagem = useRef<HTMLDivElement>(null);
  const campoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHoraStatus(formatarHoraAgora());
  }, []);

  // Evento externo para focar e abrir o modo ensinar
  useEffect(() => {
    const onAtivarEnsinar = () => {
      setModo("ensinar");
      setTimeout(() => campoInput.current?.focus(), 150);
    };
    window.addEventListener("ativar-modo-ensinar", onAtivarEnsinar);
    return () => window.removeEventListener("ativar-modo-ensinar", onAtivarEnsinar);
  }, []);

  // Conversa de exemplo do cliente
  const exemploCliente = useMemo<MensagemCliente[]>(() => {
    const bolhas = conversaDeExemplo(jeito, { ...tela.exemplo.dados, nome });
    return bolhas.map((b, idx) => ({
      de: b.de,
      texto: b.texto,
      agendamentoConfirmado: idx === bolhas.length - 1 && b.de === "atendente",
    }));
  }, [jeito, nome, tela.exemplo.dados]);

  const mensagensExibidas = modo === "ensinar" ? mensagensEnsino : (teste ?? exemploCliente);

  useEffect(() => {
    rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: "smooth" });
  }, [mensagensExibidas.length, digitando, modo]);

  // Envio no modo ENSINO (Onda do Mar)
  async function enviarEnsino(texto: string) {
    const limpo = texto.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!limpo || digitando) return;

    const novoHistorico: MensagemEnsino[] = [...mensagensEnsino, { de: "dono", texto: limpo }];
    setMensagensEnsino(novoHistorico);
    setEntrada("");
    setErro("");
    setDigitando(true);

    try {
      const r = await fetch("/api/atendente/entrevista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: limpo,
          historico: novoHistorico.slice(-8),
        }),
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "Não consegui processar agora. Tente de novo.");
        return;
      }

      await esperar(PAUSA_ENTRE_BOLHAS_MS);

      const algoSalvo =
        (j.salvou?.servicos ?? 0) > 0 ||
        j.salvou?.endereco ||
        j.salvou?.horarios ||
        j.salvou?.pagamento ||
        j.salvou?.regras ||
        j.salvou?.pergunta;

      setMensagensEnsino((atual) => [
        ...atual,
        {
          de: "atendente",
          texto: j.resposta ?? "Anotado com sucesso!",
          salvo: algoSalvo,
        },
      ]);

      if (Array.isArray(j.sugestoes) && j.sugestoes.length > 0) {
        setSugestoesEnsino(j.sugestoes);
      }

      if (algoSalvo) {
        setNotificacaoSalvo(true);
        setTimeout(() => setNotificacaoSalvo(false), 2500);
        // Atualiza a tela inteira (painel à direita) em tempo real!
        aoTestar();
      }
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setDigitando(false);
    }
  }

  // Envio no modo CLIENTE (Simulador de Atendimento)
  async function enviarCliente(texto: string) {
    const limpo = texto.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (!limpo || digitando) return;

    const historico: MensagemCliente[] = [...(teste ?? []), { de: "cliente", texto: limpo }];
    setTeste(historico);
    setEntrada("");
    setErro("");
    setDigitando(true);

    const intencaoMudouAssunto = /pre[çc]o|valor|custa|quanto|hor[aá]rio|onde fica|endere[çc]o/i.test(limpo);
    const estadoEfetivo = intencaoMudouAssunto && !/^\d+$/.test(limpo) ? null : estadoCliente;

    try {
      const r = await fetch("/api/atendente/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: historico.slice(-30).map(({ de, texto: t }) => ({ de, texto: t })),
          estado: estadoEfetivo,
          nome,
          jeito,
          marcaDireto: tela.marcaDireto,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "O teste não rodou agora. Tente de novo.");
        return;
      }
      const respostas: string[] = j.mensagens ?? [];
      const fonte = Array.isArray(j.fontes) ? j.fontes.join(" · ") : undefined;
      const confirmou = Boolean(
        j.marcou ||
          (j.mensagens &&
            j.mensagens.some(
              (m: string) =>
                /(horário|agendamento|reserva|vaga)\s+(está\s+)?(confirmad|marcad)|está agendado|horário reservado/i.test(m) &&
                !/não tenho confirmad|anotado para a equipe/i.test(m),
            )),
      );
      for (let i = 0; i < respostas.length; i++) {
        if (i > 0) await esperar(PAUSA_ENTRE_BOLHAS_MS);
        setTeste((atual) => [
          ...(atual ?? []),
          {
            de: "atendente",
            texto: respostas[i],
            fonte,
            agendamentoConfirmado: i === respostas.length - 1 && confirmou,
          },
        ]);
      }
      setEstadoCliente(j.estado ?? null);
      aoTestar();
      if (j.anotou && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("duvidas-atualizadas"));
      }
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setDigitando(false);
    }
  }

  function recomecar() {
    if (modo === "ensinar") {
      setMensagensEnsino([{ de: "atendente", texto: saudacaoInicialEnsino }]);
      setSugestoesEnsino(
        semServicos
          ? ["Corte R$ 45 e Barba R$ 35", "Consulta R$ 150", "Manicure R$ 35"]
          : ["Seg a Sáb 9h às 19h", "Pix, cartão e dinheiro", "Quando perguntarem X, responda Y"],
      );
    } else {
      setTeste(null);
      setEstadoCliente(null);
    }
    setErro("");
  }

  async function aprovarObs(id: string) {
    setOcupadoObs(true);
    setObsSucesso(null);
    try {
      const res = await fetch(`/api/training/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "aprovar" }),
      });
      if (res.ok) {
        setObsSucesso("✓ Resposta aprovada! Agora seu atendente vai usá-la com outros clientes.");
        if (aoAtualizarTela) await aoAtualizarTela();
        aoTestar();
        setTimeout(() => setObsSucesso(null), 3500);
      }
    } finally {
      setOcupadoObs(false);
    }
  }

  async function rejeitarObs(id: string) {
    setOcupadoObs(true);
    setObsSucesso(null);
    try {
      const res = await fetch(`/api/training/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rejeitar" }),
      });
      if (res.ok) {
        setObsSucesso("✓ Resposta descartada. Não será usada como regra geral.");
        if (aoAtualizarTela) await aoAtualizarTela();
        setTimeout(() => setObsSucesso(null), 3500);
      }
    } finally {
      setOcupadoObs(false);
    }
  }

  async function salvarRegraPersonalizada(regra: string) {
    if (!aoAjustar) return;
    const descAtual = tela.sabe.descricao || "";
    const novaDescricao = descAtual
      ? `${descAtual}\n\n✦ Regra: ${regra}`
      : `✦ Regra: ${regra}`;
    await aoAjustar({ descricao: novaDescricao });
  }

  function abrirAjuste(idx: number) {
    if (ajustandoIndice === idx) {
      setAjustandoIndice(null);
      return;
    }
    setAjustandoIndice(idx);
    setEtapaAjuste("escolha");
    setRegraProposta(null);
    setTextoPersonalizado("");
    setPerguntaParaRepetir(null);
  }

  const sugestoes =
    modo === "ensinar"
      ? sugestoesEnsino
      : estadoCliente?.tipo === "HORARIO"
        ? ["2", ...SUGESTOES_CLIENTE.slice(1)]
        : estadoCliente?.tipo === "SERVICO"
          ? ["1", ...SUGESTOES_CLIENTE.slice(1)]
          : SUGESTOES_CLIENTE;

  return (
    <div className="mx-auto w-full max-w-[560px] md:max-w-[620px]">
      {/* SELETOR DE MODO SUPERIOR (ONDA DO MAR vs CLIENTE vs DADOS) */}
      <div className="mb-2.5 flex items-center justify-between gap-1.5 rounded-2xl border border-panel-line bg-panel-card p-1 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setModo("ensinar");
            setErro("");
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold transition ${
            modo === "ensinar"
              ? "bg-amber text-night shadow-xs"
              : "text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <span>🎓</span>
          <span>Ensinar Atendente</span>
          {semServicos && (
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Comece por aqui" />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("cliente");
            setErro("");
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold transition ${
            modo === "cliente"
              ? "bg-[#00A884] text-white shadow-xs"
              : "text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <span>💬</span>
          <span>Testar como Cliente</span>
        </button>
        {aoAbrirSabe && (
          <button
            type="button"
            onClick={aoAbrirSabe}
            className="flex items-center justify-center gap-1 rounded-xl py-2 px-2.5 text-xs font-semibold text-panel-sub hover:text-panel-ink hover:bg-panel-bg transition"
            title="Ver catálogo e configurações completos"
          >
            <span>📋</span>
            <span className="hidden sm:inline">O que ela sabe</span>
          </button>
        )}
      </div>

      {/* DISPOSITIVO SMARTPHONE ULTRA-REALISTA CENTRALIZADO */}
      <div className="rounded-[3rem] border border-[#2A2E3D] bg-gradient-to-b from-[#2A2E3D] via-[#1A1D27] to-[#0E1017] p-3 shadow-2xl ring-1 ring-white/10">
        <div className="relative flex h-[620px] sm:h-[660px] flex-col overflow-hidden rounded-[2.35rem] bg-[#0B141A] border border-[#1E222D]">
          {/* BARRA DE STATUS DO DISPOSITIVO */}
          <div className="flex h-7 select-none items-center justify-between bg-[#202C33] px-6 pt-1 text-[11px] font-semibold text-white/80">
            <span>{horaStatus}</span>
            <div className="flex h-4 w-20 items-center justify-center rounded-full bg-black/90">
              <span className="h-2 w-2 rounded-full bg-black ring-1 ring-white/10" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/90">
              <span className="text-[10px] font-bold">5G</span>
              <svg className="h-3 w-3 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 21l3.39-.62C9.27 20.74 10.6 21 12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9z" />
              </svg>
              <span className="text-[10px]">98%</span>
            </div>
          </div>

          {/* CABEÇALHO DO WHATSAPP */}
          <div className="flex items-center justify-between border-b border-[#2A3942]/60 bg-[#202C33] px-3 py-2.5 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <svg className="h-4 w-4 text-[#8696A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <div className="relative shrink-0">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-bold text-night shadow-inner ${
                    modo === "ensinar"
                      ? "bg-gradient-to-br from-amber to-amber-500 ring-2 ring-amber/40"
                      : "bg-gradient-to-br from-amber to-amber-600"
                  }`}
                >
                  {modo === "ensinar" ? "⚡" : tela.empresa.trim().charAt(0).toUpperCase() || "N"}
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202C33] bg-[#25D366]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-sm font-bold text-[#E9EDEF]">
                    {modo === "ensinar" ? `${nome.trim() || "Atendente"} · Nexora` : tela.empresa}
                  </p>
                  <svg className="h-3.5 w-3.5 shrink-0 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <p className="text-[11px] text-[#8696A0]">
                  {digitando
                    ? "digitando…"
                    : modo === "ensinar"
                      ? "online agora · modo ensino"
                      : teste
                        ? "online agora"
                        : "exemplo"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#A7B2B8]">
              {(modo === "ensinar" ? mensagensEnsino.length > 1 : Boolean(teste)) && (
                <button
                  type="button"
                  onClick={recomecar}
                  aria-label="Recomeçar"
                  title="Recomeçar conversa"
                  className="rounded-full p-1.5 text-amber transition hover:bg-white/10"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.1 15a7 7 0 0012.4 2M18.9 9A7 7 0 006.5 7" />
                  </svg>
                </button>
              )}
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  modo === "ensinar"
                    ? "border-amber/40 bg-amber/10 text-amber"
                    : "border-[#2A3942] bg-[#182229] text-[#8696A0]"
                }`}
              >
                {modo === "ensinar" ? "Ensinando" : "Ao vivo"}
              </span>
            </div>
          </div>

          {/* AVISO DE SINCRONIZAÇÃO EM TEMPO REAL */}
          {notificacaoSalvo && (
            <div className="bg-emerald-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition animate-in fade-in slide-in-from-top duration-300">
              ✓ Dados salvos e sincronizados com a empresa!
            </div>
          )}

          {/* ÁREA DE CONVERSA COM FUNDO DO WHATSAPP */}
          <div
            ref={rolagem}
            className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3.5 py-4 scroll-smooth"
            style={{
              backgroundImage:
                "radial-gradient(#182229 0.75px, transparent 0.75px), radial-gradient(#182229 0.75px, #0B141A 0.75px)",
              backgroundSize: "30px 30px",
              backgroundPosition: "0 0, 15px 15px",
            }}
            aria-live="polite"
          >
            <div className="flex justify-center">
              <span className="rounded-lg bg-[#182229] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8696A0] shadow-sm">
                HOJE
              </span>
            </div>

            {/* AVISO CLARO DE MODO: TESTE COMO CLIENTE vs ENSINAR */}
            {modo === "cliente" ? (
              <div className="mx-auto max-w-[340px] rounded-lg bg-[#182229]/95 px-3 py-1.5 text-center text-[10px] text-[#8696A0] shadow-sm flex items-center justify-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00A884] shrink-0" />
                <span><strong>Modo Teste:</strong> Digite como cliente. Clique em <em>Ajustar esta resposta</em> para ensinar novas regras.</span>
              </div>
            ) : (
              <div className="mx-auto max-w-[290px] rounded-lg bg-[#182229]/90 px-3 py-1.5 text-center text-[10px] leading-tight text-[#FFD279] shadow-sm">
                💬 Ensine serviços, horários e regras conversando direto no chat.
              </div>
            )}

            {/* CARD DE APRENDIZADO PASSIVO DENTRO DO CHAT */}
            {tela.observacoesPassivas && tela.observacoesPassivas.length > 0 && (
              <div className="mx-auto max-w-[96%] rounded-2xl border border-amber/40 bg-[#1A1D27] p-3 text-xs shadow-md animate-in fade-in duration-300">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-night">
                    💡
                  </span>
                  <span className="font-bold text-amber">Aprendi com seu WhatsApp</span>
                  {ehCondicaoPontual(tela.observacoesPassivas[0].resposta) && (
                    <span className="ml-auto rounded-full bg-amber/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">
                      ⚠️ Condição especial?
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-[11px]">
                  <p className="text-[#8696A0]">Quando um cliente perguntou:</p>
                  <p className="font-medium text-[#E9EDEF] italic">"{tela.observacoesPassivas[0].pergunta}"</p>
                  <p className="mt-1 text-[#8696A0]">Você respondeu:</p>
                  <p className="font-medium text-emerald-300">"{tela.observacoesPassivas[0].resposta}"</p>
                </div>

                {obsSucesso ? (
                  <p className="mt-2 text-[11px] font-semibold text-emerald-400">{obsSucesso}</p>
                ) : (
                  <>
                    <p className="mt-2 text-[10px] text-[#8696A0]">
                      Posso usar essa resposta nos próximos atendimentos?
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={ocupadoObs}
                        onClick={() => aprovarObs(tela.observacoesPassivas[0].id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                      >
                        ✓ Usar sempre
                      </button>
                      <button
                        type="button"
                        disabled={ocupadoObs}
                        onClick={() => rejeitarObs(tela.observacoesPassivas[0].id)}
                        className="rounded-lg bg-[#2A3942] px-2.5 py-1 text-[#8696A0] hover:text-white disabled:opacity-50 transition"
                      >
                        ✕ Só desta vez
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {modo === "ensinar"
              ? mensagensEnsino.map((m, i) => {
                  const ehDono = m.de === "dono";
                  return (
                    <div key={i} className={`flex flex-col ${ehDono ? "items-end" : "items-start"}`}>
                      <div
                        className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md break-words [overflow-wrap:anywhere] ${
                          ehDono
                            ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                            : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                        }`}
                      >
                        <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.texto}</p>

                        {m.salvo && (
                          <div className="mt-2 rounded-xl border border-emerald-500/40 bg-[#0B141A]/80 p-2 text-xs text-emerald-300">
                            <span className="font-bold">✓ Salvo na sua empresa!</span>
                            <p className="text-[10px] text-[#8696A0] mt-0.5">
                              Atualizado nos cartões ao lado em tempo real.
                            </p>
                          </div>
                        )}

                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696A0]">
                          <span>{horaStatus}</span>
                          {ehDono && (
                            <span className="font-bold text-[#53BDEB]" title="Lido">
                              ✓✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              : (mensagensExibidas as MensagemCliente[]).map((m, i) => {
                  const ehCliente = m.de === "cliente";
                  return (
                    <div key={i} className={`flex flex-col ${ehCliente ? "items-end" : "items-start"}`}>
                      <div
                        title={m.fonte}
                        className={`relative max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-md break-words [overflow-wrap:anywhere] ${
                          ehCliente
                            ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                            : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                        }`}
                      >
                        <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.texto}</p>

                        {/* SELO DE CONFIRMAÇÃO DE AGENDAMENTO AUTOMÁTICO */}
                        {m.agendamentoConfirmado && (
                          <div className="mt-2.5 rounded-xl border border-[#25D366]/40 bg-[#0B141A]/70 p-2.5 text-xs text-[#E9EDEF]">
                            <div className="flex items-center gap-1.5 font-bold text-[#25D366]">
                              <span>✓</span> Horário reservado automaticamente
                            </div>
                            <p className="mt-1 text-[11px] text-[#8696A0]">
                              Salvo na agenda da empresa! Cliente recebe confirmação e lembrete anti-falta.
                            </p>
                          </div>
                        )}

                        {/* BOTÃO INTERATIVO: AJUSTAR ESTA RESPOSTA */}
                        {!ehCliente && (
                          <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-1.5">
                            <button
                              type="button"
                              onClick={() => abrirAjuste(i)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber/15 px-2 py-0.5 text-[11px] font-semibold text-amber hover:bg-amber/25 transition"
                            >
                              <span>✏️</span>
                              <span>{ajustandoIndice === i ? "Fechar ajuste" : "Ajustar esta resposta"}</span>
                            </button>
                            <span className="text-[10px] text-[#8696A0]">
                              {m.fonte ? `Fonte: ${m.fonte}` : "Nexora"}
                            </span>
                          </div>
                        )}

                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696A0]">
                          <span>{horaStatus}</span>
                          {ehCliente && (
                            <span className="font-bold text-[#53BDEB]" title="Lido">
                              ✓✓
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CARD INTERATIVO DE AJUSTE DIRETO NA CONVERSA */}
                      {!ehCliente && ajustandoIndice === i && (() => {
                        let perguntaCliente = "";
                        for (let j = i - 1; j >= 0; j--) {
                          if (mensagensExibidas[j]?.de === "cliente") {
                            perguntaCliente = mensagensExibidas[j].texto;
                            break;
                          }
                        }
                        const ctx = `${perguntaCliente} ${m.texto}`.toLowerCase();
                        const ehHorario = /hor[aá]rio|amanh[aã]|agenda|marcar|data|vaga|atend|livre|marcado|agendado/.test(ctx);
                        const ehPreco = /pre[çc]o|valor|custa|quanto|pagamento|pix|cart[aã]o|cobram/.test(ctx);

                        return (
                          <div className="mt-2 w-full max-w-[92%] rounded-2xl border border-amber/40 bg-[#161C22] p-3 text-xs text-[#E9EDEF] shadow-lg animate-in fade-in zoom-in-95 duration-200">
                            {etapaAjuste === "escolha" && (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-amber flex items-center gap-1.5">
                                    <span>⚡</span> Como a Nexora deve responder a isso?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAjustandoIndice(null)}
                                    className="text-[11px] text-[#8696A0] hover:text-white"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {perguntaCliente && (
                                  <p className="text-[11px] text-[#8696A0]">
                                    Para a dúvida: <strong className="text-white">"{perguntaCliente}"</strong>
                                  </p>
                                )}

                                <div className="space-y-1.5 pt-1">
                                  {ehHorario && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRegraProposta({
                                            titulo: "Eu confirmo antes",
                                            descricao: "Vou receber o pedido do cliente, conferir os detalhes e aguardar você aprovar antes de marcar. Nada entra na agenda sem seu aval.",
                                            acao: async () => {
                                              if (aoAjustar) await aoAjustar({ marcaDireto: false });
                                            },
                                          });
                                          setEtapaAjuste("confirmacao");
                                        }}
                                        className="w-full text-left rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-amber/50 hover:bg-[#25333B] transition"
                                      >
                                        <p className="font-bold text-white text-[11px]">👉 Quero confirmar os horários pessoalmente</p>
                                        <p className="text-[10px] text-[#8696A0]">Avisar o cliente que o agendamento precisa de confirmação da equipe.</p>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRegraProposta({
                                            titulo: "Nexora confirma direto",
                                            descricao: "Vou consultar seus horários livres em tempo real e confirmar a reserva diretamente para o cliente.",
                                            acao: async () => {
                                              if (aoAjustar) await aoAjustar({ marcaDireto: true });
                                            },
                                          });
                                          setEtapaAjuste("confirmacao");
                                        }}
                                        className="w-full text-left rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-amber/50 hover:bg-[#25333B] transition"
                                      >
                                        <p className="font-bold text-white text-[11px]">⚡ A Nexora pode confirmar direto na agenda</p>
                                        <p className="text-[10px] text-[#8696A0]">Reserva o horário na hora caso esteja livre.</p>
                                      </button>
                                    </>
                                  )}

                                  {ehPreco && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRegraProposta({
                                            titulo: "Valores sob avaliação",
                                            descricao: "Vou informar com gentileza que valores e orçamentos exatos dependem de avaliação presencial e convidar o cliente a agendar.",
                                            acao: async () => {
                                              await salvarRegraPersonalizada("Valores e orçamentos são informados apenas presencialmente após avaliação.");
                                            },
                                          });
                                          setEtapaAjuste("confirmacao");
                                        }}
                                        className="w-full text-left rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-amber/50 hover:bg-[#25333B] transition"
                                      >
                                        <p className="font-bold text-white text-[11px]">💳 Informar valor apenas em avaliação presencial</p>
                                        <p className="text-[10px] text-[#8696A0]">Não passar preço por WhatsApp antes da consulta.</p>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRegraProposta({
                                            titulo: "Formas de pagamento",
                                            descricao: "Vou informar que aceitamos Pix, dinheiro e cartão de crédito em até 3x sem juros.",
                                            acao: async () => {
                                              if (aoAjustar) await aoAjustar({ pagamento: "Pix, dinheiro e cartão de crédito em até 3x sem juros" });
                                            },
                                          });
                                          setEtapaAjuste("confirmacao");
                                        }}
                                        className="w-full text-left rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-amber/50 hover:bg-[#25333B] transition"
                                      >
                                        <p className="font-bold text-white text-[11px]">💳 Aceitamos Pix, cartão e parcelamento</p>
                                        <p className="text-[10px] text-[#8696A0]">Atualiza as opções de pagamento aceitas.</p>
                                      </button>
                                    </>
                                  )}

                                  {!ehHorario && !ehPreco && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRegraProposta({
                                            titulo: "Chamar atendente humano",
                                            descricao: `Quando o cliente perguntar sobre ${perguntaCliente || "este assunto"}, vou avisar que nossa equipe humana vai assumir o atendimento.`,
                                            acao: async () => {
                                              await salvarRegraPersonalizada(`Quando o cliente perguntar sobre ${perguntaCliente || "esse assunto"}, avise que a equipe humana entrará em contato.`);
                                            },
                                          });
                                          setEtapaAjuste("confirmacao");
                                        }}
                                        className="w-full text-left rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-amber/50 hover:bg-[#25333B] transition"
                                      >
                                        <p className="font-bold text-white text-[11px]">👤 Chamar um atendente humano</p>
                                        <p className="text-[10px] text-[#8696A0]">Não responder sozinho e avisar a equipe.</p>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRegraProposta({
                                            titulo: "Resposta mais curta e objetiva",
                                            descricao: "Vou passar a responder de forma mais rápida, direta e objetiva, sem mensagens longas.",
                                            acao: async () => {
                                              if (aoAjustar) await aoAjustar({ jeito: "DIRETO" });
                                            },
                                          });
                                          setEtapaAjuste("confirmacao");
                                        }}
                                        className="w-full text-left rounded-xl border border-[#2A3942] bg-[#202C33] p-2 hover:border-amber/50 hover:bg-[#25333B] transition"
                                      >
                                        <p className="font-bold text-white text-[11px]">⚡ Resposta mais curta e direta</p>
                                        <p className="text-[10px] text-[#8696A0]">Muda o tom para mais conciso.</p>
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Entrada personalizada */}
                                <div className="pt-2 border-t border-[#2A3942]">
                                  <label className="text-[10px] font-semibold text-[#8696A0] block mb-1">
                                    Ou escreva com suas próprias palavras:
                                  </label>
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      value={textoPersonalizado}
                                      onChange={(e) => setTextoPersonalizado(e.target.value)}
                                      placeholder="Ex: Não atendemos aos sábados…"
                                      className="flex-1 rounded-lg bg-[#202C33] border border-[#2A3942] px-2.5 py-1 text-xs text-white placeholder:text-[#8696A0] focus:outline-none focus:border-amber"
                                    />
                                    <button
                                      type="button"
                                      disabled={!textoPersonalizado.trim()}
                                      onClick={() => {
                                        const regra = textoPersonalizado.trim();
                                        setRegraProposta({
                                          titulo: "Regra personalizada",
                                          descricao: `Vou seguir sua instrução: "${regra}"`,
                                          acao: async () => {
                                            await salvarRegraPersonalizada(regra);
                                          },
                                        });
                                        setEtapaAjuste("confirmacao");
                                      }}
                                      className="rounded-lg bg-amber px-2.5 py-1 text-xs font-bold text-night hover:brightness-110 disabled:opacity-40"
                                    >
                                      Propor
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {etapaAjuste === "confirmacao" && regraProposta && (
                              <div className="space-y-2.5">
                                <p className="font-bold text-amber flex items-center gap-1.5">
                                  <span>🤖</span> A Nexora vai se comportar assim:
                                </p>
                                <div className="rounded-xl bg-[#0B141A] p-2.5 text-xs text-[#E9EDEF] border border-[#2A3942]">
                                  <p className="font-semibold text-white mb-1">{regraProposta.titulo}</p>
                                  <p className="text-[#A7B2B8] leading-relaxed">{regraProposta.descricao}</p>
                                </div>
                                <p className="text-[11px] text-[#8696A0]">Está certo? Posso aplicar essa regra agora?</p>

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    disabled={salvandoAjuste}
                                    onClick={async () => {
                                      setSalvandoAjuste(true);
                                      try {
                                        await regraProposta.acao();
                                        if (aoAtualizarTela) await aoAtualizarTela();
                                        setPerguntaParaRepetir(perguntaCliente || m.texto);
                                        setEtapaAjuste("sucesso");
                                      } finally {
                                        setSalvandoAjuste(false);
                                      }
                                    }}
                                    className="rounded-lg bg-amber px-3.5 py-1.5 font-bold text-night hover:brightness-110 disabled:opacity-50 transition"
                                  >
                                    {salvandoAjuste ? "Salvando…" : "✓ Confirmar regra"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={salvandoAjuste}
                                    onClick={() => setEtapaAjuste("escolha")}
                                    className="rounded-lg border border-[#2A3942] bg-[#202C33] px-3 py-1.5 text-xs text-[#8696A0] hover:text-white"
                                  >
                                    Voltar
                                  </button>
                                </div>
                              </div>
                            )}

                            {etapaAjuste === "sucesso" && (
                              <div className="space-y-2.5">
                                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                                  <span>✅</span> Regra atualizada com sucesso!
                                </p>
                                <p className="text-[11px] text-[#A7B2B8]">
                                  A Sofia já assimilou essa conduta e vai utilizá-la a partir de agora.
                                </p>
                                <div className="flex items-center gap-2 pt-1">
                                  {perguntaParaRepetir && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const p = perguntaParaRepetir;
                                        setAjustandoIndice(null);
                                        void enviarCliente(p);
                                      }}
                                      className="rounded-lg bg-[#00A884] px-3.5 py-1.5 font-bold text-white hover:brightness-110 shadow-sm transition"
                                    >
                                      🔄 Testar novamente agora
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setAjustandoIndice(null)}
                                    className="rounded-lg border border-[#2A3942] bg-[#202C33] px-3 py-1.5 text-xs text-[#8696A0] hover:text-white"
                                  >
                                    Concluir
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}

            {digitando && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-tl-xs bg-[#202C33] px-4 py-3 shadow-md">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce" style={{ animationDelay: "180ms" }} />
                    <span className="h-2 w-2 rounded-full bg-[#8696A0] animate-bounce" style={{ animationDelay: "360ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SUGESTÕES RÁPIDAS DE RESPOSTA */}
          <div className="flex flex-wrap gap-1.5 border-t border-[#1E222D]/60 bg-[#0B141A]/95 px-3 py-2">
            {sugestoes.map((s) => (
              <button
                key={s}
                type="button"
                disabled={digitando}
                onClick={() => {
                  if (modo === "ensinar") {
                    void enviarEnsino(s);
                  } else {
                    void enviarCliente(s);
                  }
                }}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm transition disabled:opacity-40 ${
                  modo === "ensinar"
                    ? "border-amber/40 bg-[#1A1D27] text-amber hover:border-amber hover:bg-amber/20"
                    : "border-[#00A884]/40 bg-[#111B21] text-[#E9EDEF] hover:border-[#00A884] hover:bg-[#005C4B]/40 hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* BARRA DE DIGITAÇÃO DO WHATSAPP */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (modo === "ensinar") {
                void enviarEnsino(entrada);
              } else {
                void enviarCliente(entrada);
              }
            }}
            className="flex items-center gap-2 border-t border-[#2A3942]/50 bg-[#202C33] px-3 py-2.5"
          >
            <span className="text-lg text-[#8696A0] select-none" aria-hidden="true">
              {modo === "ensinar" ? "⚡" : "😀"}
            </span>
            <input
              ref={campoInput}
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              maxLength={500}
              placeholder={
                modo === "ensinar"
                  ? "Ex: Faço corte por 45 e barba por 35…"
                  : "Escreva como um cliente no WhatsApp…"
              }
              aria-label={modo === "ensinar" ? "Ensinar atendente" : "Mensagem de teste"}
              className="min-w-0 flex-1 rounded-full bg-[#2A3942] px-3.5 py-1.5 text-xs text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:ring-1 focus:ring-amber"
            />
            <button
              type="submit"
              disabled={digitando || !entrada.trim()}
              aria-label="Enviar"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow transition hover:brightness-110 disabled:opacity-40 ${
                modo === "ensinar" ? "bg-amber text-night" : "bg-[#00A884]"
              }`}
            >
              <svg className="h-3.5 w-3.5 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-center text-xs text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
