"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { conversaDeExemplo, type Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { ModalServicos } from "@/components/atendente/ajustes";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";

/**
 * O CELULAR — SIMULADOR ULTRA-REALISTA DO WHATSAPP.
 *
 * Experiência ampla e intuitiva:
 * 1. 💬 Conversa / Teste: experimente perguntas, ajuste respostas na hora e teste novamente.
 * 2. 🏢 Informações do meu negócio: consulte e altere catálogo, regras, horários e conexão.
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

const TEMAS_RAPIDOS = [
  { id: "atraso", rotulo: "⏱️ Tolerância de atraso", prefixo: "⏱️ Tolerância: ", exemplo: "Tolerância de 15 minutos para atrasos." },
  { id: "estacionamento", rotulo: "🚗 Estacionamento", prefixo: "🚗 Estacionamento: ", exemplo: "Estacionamento gratuito conveniado na rua lateral." },
  { id: "pagamento", rotulo: "💳 Parcelamento e Pix", prefixo: "💳 Pagamento: ", exemplo: "Parcelamos em até 3x sem juros no cartão e Pix." },
  { id: "marcas", rotulo: "🏷️ Marcas e produtos", prefixo: "🏷️ Produtos: ", exemplo: "Usamos produtos de primeira qualidade." },
  { id: "referencia", rotulo: "📍 Ponto de referência", prefixo: "📍 Localização: ", exemplo: "Estamos em frente à praça central." },
];

function extrairRegras(textoBruto?: string | null): string[] {
  if (!textoBruto || !textoBruto.trim()) return [];
  return textoBruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        Boolean(l) &&
        !l.endsWith("?") &&
        !/^(oq|o que|como|quando|onde|qual|quanto|por que|pq)\b/i.test(l) &&
        !/posso te ensinar|o que você faz|como funciona/i.test(l),
    );
}

export function Celular({
  tela,
  nome,
  jeito,
  aoTestar,
  aoAjustar,
  aoMudarNome,
  aoAtualizarTela,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  aoTestar: () => void;
  aoAjustar?: (dados: Record<string, unknown>) => void;
  aoMudarNome?: (novo: string) => void;
  aoMudarJeito?: (novo: Jeito) => void;
  aoAtualizarTela?: () => void;
}) {
  const semServicos = tela.sabe.servicos.length === 0;

  // Visualização ativa: Conversa ou Informações do meu negócio
  const [abaAtiva, setAbaAtiva] = useState<"chat" | "perfil">("chat");

  // Modo do chat: cliente ou ensino direto
  const [modoChat, setModoChat] = useState<"ensinar" | "cliente">(() => (semServicos ? "ensinar" : "cliente"));

  // Modais abertos a partir do WhatsApp
  const [modalServicosAberto, setModalServicosAberto] = useState(false);
  const [modalConectarAberto, setModalConectarAberto] = useState(false);

  // Estados de edição inline
  const [editandoNome, setEditandoNome] = useState(false);
  const [nomeTemp, setNomeTemp] = useState(nome || tela.empresa);
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [enderecoTemp, setEnderecoTemp] = useState(tela.sabe.endereco || "");
  const [editandoPagamento, setEditandoPagamento] = useState(false);
  const [pagamentoTemp, setPagamentoTemp] = useState(tela.sabe.pagamento || "");
  const [temaRegraAtivo, setTemaRegraAtivo] = useState<string | null>(null);
  const [novaRegraInput, setNovaRegraInput] = useState("");

  // Fluxo de ajuste inline de respostas no chat
  const [ajustandoIdx, setAjustandoIdx] = useState<number | null>(null);
  const [ajusteTexto, setAjusteTexto] = useState("");
  const [ultimaPerguntaCliente, setUltimaPerguntaCliente] = useState<string | null>(null);

  // Estados do modo CLIENTE
  const [teste, setTeste] = useState<MensagemCliente[] | null>(null);
  const [estadoCliente, setEstadoCliente] = useState<{ tipo?: string } | null>(null);

  // Estados do modo ENSINO
  const primeiraMsgEnsino = useMemo(() => {
    if (semServicos) {
      return "Oi! 👋 Me conta: quais serviços você mais vende e quanto custa cada um?";
    }
    return "Oi! 👋 Para adicionar serviços, horários ou regras, é só me mandar aqui!";
  }, [semServicos]);

  const [mensagensEnsino, setMensagensEnsino] = useState<MensagemEnsino[]>([
    { de: "atendente", texto: primeiraMsgEnsino },
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

  useEffect(() => {
    setNomeTemp(nome || tela.empresa);
  }, [nome, tela.empresa]);

  useEffect(() => {
    setEnderecoTemp(tela.sabe.endereco || "");
  }, [tela.sabe.endereco]);

  useEffect(() => {
    setPagamentoTemp(tela.sabe.pagamento || "");
  }, [tela.sabe.pagamento]);

  useEffect(() => {
    const onAtivarEnsinar = () => {
      setAbaAtiva("chat");
      setModoChat("ensinar");
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

  const mensagensExibidas = modoChat === "ensinar" ? mensagensEnsino : (teste ?? exemploCliente);

  useEffect(() => {
    rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: "smooth" });
  }, [mensagensExibidas.length, digitando, modoChat, abaAtiva, ajustandoIdx]);

  // Salvar ajustes no servidor
  async function executarAjuste(dados: Record<string, unknown>) {
    setErro("");
    try {
      if (aoAjustar) {
        await aoAjustar(dados);
      } else {
        const r = await fetch("/api/atendente", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dados),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setErro(j?.error ?? "Não consegui salvar agora. Tente de novo.");
          return;
        }
      }
      setNotificacaoSalvo(true);
      setTimeout(() => setNotificacaoSalvo(false), 2000);
      aoAtualizarTela?.();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    }
  }

  // Alternar ligar / desligar atendente
  async function alternarLigado(novoEstado: boolean) {
    try {
      const r = await fetch("/api/atendente/ligar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligar: novoEstado }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j) {
        aoAtualizarTela?.();
      } else if (r.status === 409 && j?.faltando === "WHATSAPP") {
        setModalConectarAberto(true);
      }
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    }
  }


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
        aoTestar();
        aoAtualizarTela?.();
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

    setUltimaPerguntaCliente(limpo);
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
          marcaDireto: tela.marcaDireto ?? true,
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
    if (modoChat === "ensinar") {
      setMensagensEnsino([{ de: "atendente", texto: primeiraMsgEnsino }]);
      setSugestoesEnsino(
        semServicos
          ? ["Corte R$ 45 e Barba R$ 35", "Consulta R$ 150", "Manicure R$ 35"]
          : ["Seg a Sáb 9h às 19h", "Pix, cartão e dinheiro", "Quando perguntarem X, responda Y"],
      );
    } else {
      setTeste(null);
      setEstadoCliente(null);
      setUltimaPerguntaCliente(null);
    }
    setErro("");
    setAjustandoIdx(null);
  }

  const regrasAtuais = useMemo(() => extrairRegras(tela.sabe.descricao), [tela.sabe.descricao]);

  function adicionarRegra(texto: string) {
    const limpo = texto.trim();
    if (!limpo) return;
    const novas = [...regrasAtuais, limpo];
    void executarAjuste({ descricao: novas.join("\n") });
    setTemaRegraAtivo(null);
    setNovaRegraInput("");
  }

  function removerRegra(indice: number) {
    const novas = regrasAtuais.filter((_, i) => i !== indice);
    void executarAjuste({ descricao: novas.join("\n") });
  }

  // Salvar ajuste feito direto na resposta do chat
  async function salvarAjusteResposta(novoTexto: string) {
    const limpo = novoTexto.trim();
    if (!limpo) return;
    adicionarRegra(limpo);
    setAjustandoIdx(null);
    setAjusteTexto("");

    setTeste((atual) => [
      ...(atual ?? []),
      {
        de: "atendente",
        texto: "Entendido! Salvei essa regra para os próximos atendimentos.",
      },
    ]);
  }

  const sugestoes =
    modoChat === "ensinar"
      ? sugestoesEnsino
      : estadoCliente?.tipo === "HORARIO"
        ? ["2", ...SUGESTOES_CLIENTE.slice(1)]
        : estadoCliente?.tipo === "SERVICO"
          ? ["1", ...SUGESTOES_CLIENTE.slice(1)]
          : SUGESTOES_CLIENTE;

  const totalServicos = tela.sabe.servicos.length;
  const semPreco = tela.sabe.servicos.filter((s) => s.semPreco).length;

  return (
    <div className="mx-auto w-full max-w-[440px]">
      {/* ABAS SUPERIORES DO WHATSAPP (CONVERSA vs PERFIL COMERCIAL) */}
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-panel-line bg-panel-card p-1 shadow-xs">
        <button
          type="button"
          onClick={() => {
            setAbaAtiva("chat");
            setErro("");
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold transition ${
            abaAtiva === "chat"
              ? "bg-[#00A884] text-white shadow-xs"
              : "text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <span>💬</span>
          <span>Conversa / Teste</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAbaAtiva("perfil");
            setErro("");
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-semibold transition ${
            abaAtiva === "perfil"
              ? "bg-amber text-night shadow-xs"
              : "text-panel-sub hover:text-panel-ink hover:bg-panel-bg"
          }`}
        >
          <span>🏢</span>
          <span>Perfil Comercial & Dados</span>
          {semServicos && (
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Configure aqui" />
          )}
        </button>
      </div>

      {/* DISPOSITIVO SMARTPHONE ULTRA-REALISTA */}
      <div className="rounded-[3rem] border border-[#2A2E3D] bg-gradient-to-b from-[#2A2E3D] via-[#1A1D27] to-[#0E1017] p-3 shadow-2xl ring-1 ring-white/10">
        <div className="relative flex h-[620px] sm:h-[640px] flex-col overflow-hidden rounded-[2.35rem] bg-[#0B141A] border border-[#1E222D]">
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
          {abaAtiva === "chat" ? (
            <div className="flex items-center justify-between border-b border-[#2A3942]/60 bg-[#202C33] px-3 py-2.5 shadow-sm">
              <button
                type="button"
                onClick={() => setAbaAtiva("perfil")}
                title="Clique para consultar informações do negócio"
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition hover:opacity-85"
              >
                <div className="relative shrink-0">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-bold text-night shadow-inner ${
                      modoChat === "ensinar"
                        ? "bg-gradient-to-br from-amber to-amber-500 ring-2 ring-amber/40"
                        : "bg-gradient-to-br from-amber to-amber-600"
                    }`}
                  >
                    {modoChat === "ensinar" ? "⚡" : tela.empresa.trim().charAt(0).toUpperCase() || "N"}
                  </div>
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#202C33] ${
                      tela.whatsappLigado ? "bg-[#25D366]" : "bg-amber-400"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#E9EDEF]">
                    {modoChat === "ensinar" ? `${nome.trim() || "Atendente"} · Nexora` : tela.empresa}
                  </p>
                  <p className="text-[11px] text-[#00A884]">
                    {digitando
                      ? "digitando…"
                      : modoChat === "ensinar"
                        ? "online · clique para ver dados ›"
                        : teste
                          ? "online agora"
                          : "exemplo"}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-2 text-[#A7B2B8]">
                {(modoChat === "ensinar" ? mensagensEnsino.length > 1 : Boolean(teste)) && (
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
                <button
                  type="button"
                  onClick={() => setAbaAtiva("perfil")}
                  className="rounded-full border border-[#2A3942] bg-[#182229] px-2.5 py-1 text-xs font-semibold text-[#E9EDEF] hover:border-amber hover:text-amber transition"
                >
                  Perfil ›
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-[#2A3942]/60 bg-[#202C33] px-3 py-2.5 shadow-sm">
              <button
                type="button"
                onClick={() => setAbaAtiva("chat")}
                className="flex items-center gap-2 text-xs font-semibold text-[#00A884] hover:text-white transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Voltar para o chat</span>
              </button>
              <span className="text-xs font-bold text-[#E9EDEF]">Perfil Comercial</span>
              <span className="text-[10px] text-[#25D366] font-semibold">✓ Verificado</span>
            </div>
          )}

          {/* AVISO DE SINCRONIZAÇÃO EM TEMPO REAL */}
          {notificacaoSalvo && (
            <div className="bg-emerald-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition animate-in fade-in slide-in-from-top duration-300">
              ✓ Dados salvos com sucesso na sua empresa!
            </div>
          )}

          {/* CONTEÚDO PRINCIPAL: MODO CHAT OU PERFIL DO NEGÓCIO */}
          {abaAtiva === "chat" ? (
            <>
              {/* SUB-SELETOR: ENSINAR vs TESTAR COMO CLIENTE */}
              <div className="flex border-b border-[#1E222D] bg-[#111B21] px-3 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setModoChat("cliente")}
                  className={`flex-1 rounded-lg py-1 px-2 font-semibold transition ${
                    modoChat === "cliente"
                      ? "bg-[#00A884] text-white shadow-xs"
                      : "text-[#8696A0] hover:text-[#E9EDEF]"
                  }`}
                >
                  💬 Testar como cliente
                </button>
                <button
                  type="button"
                  onClick={() => setModoChat("ensinar")}
                  className={`flex-1 rounded-lg py-1 px-2 font-semibold transition ${
                    modoChat === "ensinar"
                      ? "bg-amber text-night shadow-xs"
                      : "text-[#8696A0] hover:text-[#E9EDEF]"
                  }`}
                >
                  🎓 Ensinar conversando
                </button>
              </div>

              {/* ÁREA DE CONVERSA COM FUNDO DO WHATSAPP */}
              <div
                ref={rolagem}
                className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-4 scroll-smooth"
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

                <div className="mx-auto max-w-[340px] rounded-lg bg-[#182229]/90 px-3 py-1.5 text-center text-[10px] leading-tight text-[#FFD279] shadow-sm">
                  {modoChat === "ensinar"
                    ? "💬 Digite preços, horários ou regras. O atendente anota tudo na hora."
                    : "🔒 Teste como um cliente. Você pode ajustar qualquer resposta na hora."}
                </div>

                {modoChat === "ensinar"
                  ? mensagensEnsino.map((m, i) => {
                      const ehDono = m.de === "dono";
                      return (
                        <div key={i} className={`flex flex-col ${ehDono ? "items-end" : "items-start"}`}>
                          <div
                            className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-md break-words [overflow-wrap:anywhere] ${
                              ehDono
                                ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                                : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                            }`}
                          >
                            <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.texto}</p>

                            {m.salvo && (
                              <div className="mt-2 rounded-xl border border-emerald-500/40 bg-[#0B141A]/80 p-2 text-xs text-emerald-300">
                                <span className="font-bold">✓ Salvo na sua empresa!</span>
                                <button
                                  type="button"
                                  onClick={() => setAbaAtiva("perfil")}
                                  className="mt-1 block text-[11px] font-semibold text-amber hover:underline"
                                >
                                  Ver em informações do negócio ›
                                </button>
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
                            className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-md break-words [overflow-wrap:anywhere] ${
                              ehCliente
                                ? "rounded-tr-xs bg-[#005C4B] text-[#E9EDEF]"
                                : "rounded-tl-xs bg-[#202C33] text-[#E9EDEF]"
                            }`}
                          >
                            <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">{m.texto}</p>

                            {m.agendamentoConfirmado && (
                              <div className="mt-2.5 rounded-xl border border-[#25D366]/40 bg-[#0B141A]/70 p-2 text-xs text-[#E9EDEF]">
                                <div className="flex items-center gap-1.5 font-bold text-[#25D366]">
                                  <span>✓</span> Horário reservado automaticamente
                                </div>
                                <p className="mt-1 text-[11px] text-[#8696A0]">
                                  Salvo na agenda da empresa com aviso para o cliente.
                                </p>
                              </div>
                            )}

                            {/* BOTÃO PARA AJUSTAR ESTA RESPOSTA DIRETAMENTE */}
                            {!ehCliente && (
                              <div className="mt-2 pt-1 border-t border-[#2A3942]/50 flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAjustandoIdx(i);
                                    setAjusteTexto("");
                                  }}
                                  className="text-[11px] font-semibold text-amber hover:underline flex items-center gap-1"
                                >
                                  <span>✏️</span> Ajustar esta resposta
                                </button>
                                <span className="text-[10px] text-[#8696A0]">{horaStatus}</span>
                              </div>
                            )}

                            {/* CAIXA DE AJUSTE INLINE DE RESPOSTA */}
                            {ajustandoIdx === i && (
                              <div className="mt-2.5 rounded-xl border border-amber/60 bg-[#0B141A] p-2.5 text-xs space-y-2">
                                <p className="font-bold text-amber">Como a Sofia deve responder?</p>
                                <input
                                  value={ajusteTexto}
                                  onChange={(e) => setAjusteTexto(e.target.value.slice(0, 150))}
                                  maxLength={150}
                                  placeholder="Ex: Custa R$ 50 / Não atendemos domingo..."
                                  className="w-full rounded-lg border border-[#2A3942] bg-[#182229] px-2.5 py-1.5 text-xs text-[#E9EDEF] focus:border-amber focus:outline-none"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAjustandoIdx(null)}
                                    className="px-2 py-1 text-xs text-[#8696A0] hover:text-white"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!ajusteTexto.trim()}
                                    onClick={() => void salvarAjusteResposta(ajusteTexto)}
                                    className="rounded-lg bg-amber px-3 py-1 text-xs font-bold text-night disabled:opacity-40"
                                  >
                                    Salvar regra
                                  </button>
                                </div>
                              </div>
                            )}

                            {ehCliente && (
                              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696A0]">
                                <span>{horaStatus}</span>
                                <span className="font-bold text-[#53BDEB]" title="Lido">
                                  ✓✓
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                {/* BOTÃO PARA TESTAR NOVAMENTE APÓS UM AJUSTE */}
                {ultimaPerguntaCliente && (
                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      disabled={digitando}
                      onClick={() => void enviarCliente(ultimaPerguntaCliente)}
                      className="rounded-full border border-amber/40 bg-[#182229] px-3.5 py-1.5 text-xs font-bold text-amber hover:bg-amber/20 transition shadow"
                    >
                      💬 Testar novamente: &quot;{ultimaPerguntaCliente}&quot;
                    </button>
                  </div>
                )}

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

              {/* SUGESTÕES RÁPIDAS DE TESTE */}
              <div className="flex flex-wrap gap-2 border-t border-[#1E222D]/60 bg-[#0B141A]/95 px-3.5 py-2">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={digitando}
                    onClick={() => {
                      if (modoChat === "ensinar") {
                        void enviarEnsino(s);
                      } else {
                        void enviarCliente(s);
                      }
                    }}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm transition disabled:opacity-40 ${
                      modoChat === "ensinar"
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
                  if (modoChat === "ensinar") {
                    void enviarEnsino(entrada);
                  } else {
                    void enviarCliente(entrada);
                  }
                }}
                className="flex items-center gap-2 border-t border-[#2A3942]/50 bg-[#202C33] px-3.5 py-2.5"
              >
                <span className="text-lg text-[#8696A0] select-none" aria-hidden="true">
                  {modoChat === "ensinar" ? "⚡" : "😀"}
                </span>
                <input
                  ref={campoInput}
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  maxLength={500}
                  placeholder={
                    modoChat === "ensinar"
                      ? "Ex: Faço corte por 45 e barba por 35…"
                      : "Escreva como um cliente no WhatsApp…"
                  }
                  aria-label={modoChat === "ensinar" ? "Ensinar atendente" : "Mensagem de teste"}
                  className="min-w-0 flex-1 rounded-full bg-[#2A3942] px-4 py-2 text-xs sm:text-sm text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:ring-1 focus:ring-amber"
                />
                <button
                  type="submit"
                  disabled={digitando || !entrada.trim()}
                  aria-label="Enviar"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow transition hover:brightness-110 disabled:opacity-40 ${
                    modoChat === "ensinar" ? "bg-amber text-night" : "bg-[#00A884]"
                  }`}
                >
                  <svg className="h-4 w-4 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </form>
            </>
          ) : (
            /* VISUALIZAÇÃO AMPLIADA DE INFORMAÇÕES DO MEU NEGÓCIO */
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth">
              {/* CARTÃO DE IDENTIDADE DO PERFIL */}
              <div className="rounded-2xl border border-[#2A3942] bg-[#182229] p-4 text-center shadow-md">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber to-amber-600 font-display text-2xl font-bold text-night shadow-inner">
                  {tela.empresa.trim().charAt(0).toUpperCase() || "N"}
                </div>

                <div className="mt-3">
                  {editandoNome ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <input
                        value={nomeTemp}
                        onChange={(e) => setNomeTemp(e.target.value.slice(0, 30))}
                        maxLength={30}
                        className="rounded-lg border border-amber bg-[#0B141A] px-2.5 py-1 text-center text-xs sm:text-sm font-bold text-[#E9EDEF] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (nomeTemp.trim()) {
                            if (aoMudarNome) aoMudarNome(nomeTemp.trim());
                            void executarAjuste({ nome: nomeTemp.trim() });
                          }
                          setEditandoNome(false);
                        }}
                        className="rounded-lg bg-amber px-3 py-1 text-xs font-bold text-night"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNomeTemp(nome || tela.empresa);
                          setEditandoNome(false);
                        }}
                        className="rounded-lg border border-[#2A3942] px-2 py-1 text-xs text-[#8696A0]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      <h3 className="text-base font-bold text-[#E9EDEF]">{nomeTemp || tela.empresa}</h3>
                      <button
                        type="button"
                        onClick={() => setEditandoNome(true)}
                        className="text-xs text-amber hover:underline"
                        title="Editar nome"
                      >
                        ✎
                      </button>
                    </div>
                  )}
                  <p className="mt-0.5 text-xs text-[#8696A0]">
                    Atendente Virtual · Responde clientes no WhatsApp
                  </p>
                </div>
              </div>

              {/* STATUS DE CONEXÃO DO WHATSAPP E ATENDIMENTO */}
              <div className="rounded-2xl border border-[#2A3942] bg-[#182229] p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        tela.whatsappLigado && tela.ligado
                          ? "bg-[#25D366] animate-pulse"
                          : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold text-[#E9EDEF]">
                        {tela.ligado ? "Atendente Ligado" : "Atendente Desligado"}
                      </p>
                      <p className="text-xs text-[#8696A0]">
                        {tela.whatsappLigado
                          ? "Conectado no seu WhatsApp oficial"
                          : "WhatsApp ainda não conectado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!tela.whatsappLigado ? (
                      <button
                        type="button"
                        onClick={() => setModalConectarAberto(true)}
                        className="rounded-xl bg-[#00A884] px-3.5 py-2 text-xs font-bold text-white shadow hover:brightness-110 transition"
                      >
                        Conectar meu WhatsApp
                      </button>
                    ) : tela.ligado ? (
                      <button
                        type="button"
                        onClick={() => void alternarLigado(false)}
                        className="rounded-xl border border-[#2A3942] px-3 py-1.5 text-xs font-semibold text-[#8696A0] hover:text-red-400 transition"
                      >
                        Desligar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void alternarLigado(true)}
                        className="rounded-xl bg-[#00A884] px-3.5 py-1.5 text-xs font-bold text-white shadow hover:brightness-110 transition"
                      >
                        Ligar Atendente
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* CLIENTES QUE PRECISAM DE VOCÊ */}
              {tela.precisaDeVoce && tela.precisaDeVoce.length > 0 && (
                <div className="rounded-2xl border border-amber/50 bg-amber/10 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber">
                      ⚠️ Precisa de você ({tela.precisaDeVoce.length})
                    </span>
                    <a
                      href={`/painel/conversas/${tela.precisaDeVoce[0].conversationId}`}
                      className="text-xs font-bold text-amber underline"
                    >
                      Ver conversa ›
                    </a>
                  </div>
                  <p className="text-xs text-[#E9EDEF] truncate">
                    {tela.precisaDeVoce[0].cliente}: {tela.precisaDeVoce[0].motivo}
                  </p>
                </div>
              )}

              {/* DECISÕES DE ATENDIMENTO */}
              <div className="rounded-2xl border border-[#2A3942] bg-[#182229] p-4 space-y-3.5 shadow-sm">
                <p className="text-xs font-bold text-amber">⚡ Como atender no WhatsApp</p>

                {/* 1. Agendamento */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-[#E9EDEF]">Quem confirma os agendamentos?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void executarAjuste({ marcaDireto: false })}
                      className={`rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                        !tela.marcaDireto
                          ? "border-amber bg-amber/15 text-amber ring-1 ring-amber"
                          : "border-[#2A3942] bg-[#0B141A] text-[#8696A0] hover:text-[#E9EDEF]"
                      }`}
                    >
                      Eu aprovo os pedidos
                    </button>
                    <button
                      type="button"
                      onClick={() => void executarAjuste({ marcaDireto: true })}
                      className={`rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                        tela.marcaDireto
                          ? "border-amber bg-amber/15 text-amber ring-1 ring-amber"
                          : "border-[#2A3942] bg-[#0B141A] text-[#8696A0] hover:text-[#E9EDEF]"
                      }`}
                    >
                      O atendente confirma horários disponíveis
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8696A0] leading-tight">
                    {!tela.marcaDireto
                      ? "Anota o pedido e aguarda sua confirmação."
                      : "Consulta a agenda e confirma o horário na hora."}
                  </p>
                </div>

                {/* 2. Expediente */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-semibold text-[#E9EDEF]">Quando responder:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void executarAjuste({ expediente: true })}
                      className={`rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                        tela.expediente
                          ? "border-amber bg-amber/15 text-amber ring-1 ring-amber"
                          : "border-[#2A3942] bg-[#0B141A] text-[#8696A0] hover:text-[#E9EDEF]"
                      }`}
                    >
                      24 horas (dia e noite)
                    </button>
                    <button
                      type="button"
                      onClick={() => void executarAjuste({ expediente: false })}
                      className={`rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                        !tela.expediente
                          ? "border-amber bg-amber/15 text-amber ring-1 ring-amber"
                          : "border-[#2A3942] bg-[#0B141A] text-[#8696A0] hover:text-[#E9EDEF]"
                      }`}
                    >
                      Só fora do expediente
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8696A0] leading-tight">
                    {tela.expediente
                      ? "Responde seus clientes 24 horas por dia."
                      : "Responde apenas quando a empresa fechar."}
                  </p>
                </div>
              </div>

              {/* O QUE O ATENDENTE SABE RESPONDER */}
              <div className="rounded-2xl border border-[#2A3942] bg-[#182229] p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#E9EDEF]">✦ O que ele sabe responder</p>
                  <span className="text-[11px] text-[#8696A0]">Dados da empresa</span>
                </div>

                {/* Linha Horário */}
                <div className="flex items-center justify-between gap-3 border-b border-[#2A3942]/60 pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#E9EDEF]">🕒 Horários</p>
                    <p className="truncate text-xs text-[#8696A0]">
                      {tela.sabe.horario || "seg a dom fechado"}
                    </p>
                  </div>
                  <a
                    href="/painel/configuracoes"
                    className="shrink-0 text-xs font-bold text-amber hover:underline"
                  >
                    Mudar
                  </a>
                </div>

                {/* Linha Serviços */}
                <div className="flex items-center justify-between gap-3 border-b border-[#2A3942]/60 pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#E9EDEF]">💼 Serviços e preços</p>
                    <p className="truncate text-xs text-[#8696A0]">
                      {totalServicos === 0
                        ? "Nenhum serviço"
                        : `${totalServicos} serviços${semPreco ? ` · ${semPreco} sem preço` : ""}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalServicosAberto(true)}
                    className="shrink-0 text-xs font-bold text-amber hover:underline"
                  >
                    Mudar
                  </button>
                </div>

                {/* Linha Endereço */}
                <div className="border-b border-[#2A3942]/60 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#E9EDEF]">📍 Endereço</p>
                    <button
                      type="button"
                      onClick={() => setEditandoEndereco(!editandoEndereco)}
                      className="text-xs font-bold text-amber hover:underline"
                    >
                      {editandoEndereco ? "Cancelar" : tela.sabe.endereco ? "Mudar" : "Adicionar"}
                    </button>
                  </div>
                  {editandoEndereco ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={enderecoTemp}
                        onChange={(e) => setEnderecoTemp(e.target.value)}
                        placeholder="Rua, número e bairro"
                        className="min-w-0 flex-1 rounded-lg border border-amber bg-[#0B141A] px-3 py-1.5 text-xs text-[#E9EDEF] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void executarAjuste({ endereco: enderecoTemp.trim() });
                          setEditandoEndereco(false);
                        }}
                        className="rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-night"
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 break-words text-xs text-[#8696A0]">
                      {tela.sabe.endereco || "Não cadastrado"}
                    </p>
                  )}
                </div>

                {/* Linha Pagamento */}
                <div className="border-b border-[#2A3942]/60 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#E9EDEF]">💳 Formas de pagamento</p>
                    <button
                      type="button"
                      onClick={() => setEditandoPagamento(!editandoPagamento)}
                      className="text-xs font-bold text-amber hover:underline"
                    >
                      {editandoPagamento ? "Cancelar" : tela.sabe.pagamento ? "Mudar" : "Adicionar"}
                    </button>
                  </div>
                  {editandoPagamento ? (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={pagamentoTemp}
                        onChange={(e) => setPagamentoTemp(e.target.value)}
                        placeholder="Pix, cartão e dinheiro"
                        className="min-w-0 flex-1 rounded-lg border border-amber bg-[#0B141A] px-3 py-1.5 text-xs text-[#E9EDEF] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void executarAjuste({ pagamento: pagamentoTemp.trim() });
                          setEditandoPagamento(false);
                        }}
                        className="rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-night"
                      >
                        Salvar
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 break-words text-xs text-[#8696A0]">
                      {tela.sabe.pagamento || "Não cadastrado"}
                    </p>
                  )}
                </div>

                {/* Regras e diferenciais da empresa */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#E9EDEF]">
                      ✦ Regras ({regrasAtuais.length})
                    </p>
                    <span className="text-[11px] text-[#8696A0]">Tolerância, vagas, etc.</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {TEMAS_RAPIDOS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTemaRegraAtivo(t.id);
                          setNovaRegraInput(t.exemplo);
                        }}
                        className="rounded-full border border-[#2A3942] bg-[#0B141A] px-3 py-1 text-[11px] font-medium text-[#E9EDEF] hover:border-amber transition"
                      >
                        + {t.rotulo}
                      </button>
                    ))}
                  </div>

                  {temaRegraAtivo && (
                    <div className="rounded-xl border border-amber/40 bg-[#0B141A] p-3 space-y-2">
                      <input
                        value={novaRegraInput}
                        onChange={(e) => setNovaRegraInput(e.target.value.slice(0, 150))}
                        maxLength={150}
                        placeholder="Digite a regra ou detalhe..."
                        className="w-full rounded-lg border border-[#2A3942] bg-[#182229] px-3 py-1.5 text-xs text-[#E9EDEF] focus:border-amber focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTemaRegraAtivo(null)}
                          className="rounded-lg px-2.5 py-1 text-xs text-[#8696A0]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!novaRegraInput.trim()}
                          onClick={() => adicionarRegra(novaRegraInput)}
                          className="rounded-lg bg-amber px-3 py-1 text-xs font-bold text-night disabled:opacity-40"
                        >
                          Salvar regra
                        </button>
                      </div>
                    </div>
                  )}

                  {regrasAtuais.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {regrasAtuais.map((regra, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[#0B141A] p-2 text-xs text-[#E9EDEF]"
                        >
                          <span className="truncate flex-1">{regra}</span>
                          <button
                            type="button"
                            onClick={() => removerRegra(idx)}
                            className="text-red-400 hover:text-red-300 text-xs font-bold px-1.5"
                            title="Remover regra"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* BOTÃO PARA VOLTAR AO CHAT E TESTAR IMEDIATAMENTE */}
              <div className="pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => setAbaAtiva("chat")}
                  className="w-full rounded-xl bg-[#00A884] py-3.5 text-center text-xs sm:text-sm font-bold text-white shadow hover:brightness-110 transition"
                >
                  💬 Voltar para a Conversa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {erro && (
        <p role="alert" className="mt-2.5 text-center text-xs text-red-600">
          {erro}
        </p>
      )}

      {/* MODAL DE SERVIÇOS & PREÇOS */}
      {modalServicosAberto && (
        <ModalServicos
          aoFechar={() => setModalServicosAberto(false)}
          aoAtualizar={() => {
            aoAtualizarTela?.();
            aoTestar();
          }}
        />
      )}

      {/* MODAL DE CONEXÃO DO WHATSAPP */}
      <ModalConectarWhatsApp
        aberto={modalConectarAberto}
        aoFechar={() => setModalConectarAberto(false)}
        aoConectar={() => {
          setModalConectarAberto(false);
          aoAtualizarTela?.();
        }}
        telefonePadrao={tela.empresaTelefone}
      />
    </div>
  );
}
