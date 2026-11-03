"use client";

import { useEffect, useRef, useState } from "react";
import {
  CENARIOS_NEXA,
  type CenarioNexa,
  type TelaConfiguracaoNexa,
} from "@/lib/atendente/configuracao-schema";
import {
  BOTAO_NEXA as BOTAO,
  CAMPO_NEXA as CAMPO,
  PRINCIPAL_NEXA as PRINCIPAL,
} from "./configuracao-campos";
import {
  requisitarConfiguracaoNexa as requisitar,
  type OperarConfiguracaoNexa,
} from "./configuracao-requisicao";

export type PedidoTesteNexa = { cenario: CenarioNexa; seq: number };

type Mensagem = {
  id: string;
  de: "cliente" | "atendente";
  texto: string;
  hora: string;
  lido?: boolean;
};

type Props = {
  tela: TelaConfiguracaoNexa;
  ocupado: boolean;
  sujo: boolean;
  erro: string;
  pedido: PedidoTesteNexa | null;
  operar: OperarConfiguracaoNexa;
  prepararTeste: () => Promise<TelaConfiguracaoNexa | null>;
  aplicar: (tela: TelaConfiguracaoNexa) => void;
  corrigir: (cenario: CenarioNexa) => void;
  proximoCenario?: CenarioNexa | null;
  concluirTeste?: () => void;
  nomeEmpresa?: string;
  nomeAtendente?: string;
  className?: string;
};

function formatarHoraAgora(): string {
  const agora = new Date();
  const h = String(agora.getHours()).padStart(2, "0");
  const m = String(agora.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

const SUGESTOES_RAPIDAS = [
  { id: "sabado", texto: "Vocês atendem no sábado?", icone: "⏰" },
  { id: "valores", texto: "Quais são os serviços e valores?", icone: "💳" },
  { id: "local", texto: "Qual o endereço de vocês?", icone: "📍" },
  { id: "agendar", texto: "Quero agendar um horário", icone: "📅" },
] as const;

export function SimuladorConfiguracaoNexa({
  tela,
  ocupado,
  sujo,
  erro,
  pedido,
  operar,
  prepararTeste,
  aplicar,
  corrigir,
  proximoCenario,
  concluirTeste,
  nomeEmpresa = "Minha Empresa",
  nomeAtendente = "Nex",
  className = "",
}: Props) {
  // Conversa inicial idêntica à referência visual do usuário
  const [historico, setHistorico] = useState<Mensagem[]>([
    {
      id: "msg-init-1",
      de: "cliente",
      texto: "Vocês atendem no sábado?",
      hora: "10:22",
      lido: true,
    },
    {
      id: "msg-init-2",
      de: "atendente",
      texto:
        "Sim! Atendemos aos sábados, das 8h às 13h. Se quiser, posso verificar os horários disponíveis e já agendar para você. 😊",
      hora: "10:23",
    },
  ]);

  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<unknown>(null);
  const [cenario, setCenario] = useState<CenarioNexa>("INFORMACOES");
  const [fontes, setFontes] = useState<unknown>(null);
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState(false);
  const [horaStatus, setHoraStatus] = useState("10:24");
  const [mostrarOpcoesAvancadas, setMostrarOpcoesAvancadas] = useState(false);

  const fimRef = useRef<HTMLDivElement>(null);
  const campoTextoRef = useRef<HTMLInputElement>(null);
  const seqTratada = useRef(0);

  // Relógio do status bar
  useEffect(() => {
    setHoraStatus(formatarHoraAgora());
    const timer = setInterval(() => setHoraStatus(formatarHoraAgora()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Reseta ao mudar a revisão
  useEffect(() => {
    setHistorico([
      {
        id: "msg-init-1",
        de: "cliente",
        texto: "Vocês atendem no sábado?",
        hora: "10:22",
        lido: true,
      },
      {
        id: "msg-init-2",
        de: "atendente",
        texto:
          "Sim! Atendemos aos sábados, das 8h às 13h. Se quiser, posso verificar os horários disponíveis e já agendar para você. 😊",
        hora: "10:23",
      },
    ]);
    setEstado(null);
    setFontes(null);
    setUltimoTeste(null);
  }, [tela.revisao]);

  // Scroll suave ao receber novas mensagens
  useEffect(() => {
    fimRef.current?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [historico, respondendo]);

  async function testar(
    pergunta: string,
    escolhido = cenario,
    novaConversa = false
  ) {
    if (ocupado || respondendo || (!pergunta.trim() && escolhido !== "MIDIA"))
      return;
    setRespondendo(true);
    const base = await prepararTeste();
    if (!base) {
      setRespondendo(false);
      return;
    }

    const reiniciar = novaConversa || base.revisao !== tela.revisao;
    const antes = reiniciar ? [] : historico;
    const mensagemTexto =
      escolhido === "MIDIA" && !pergunta.trim()
        ? "[Mídia recebida: áudio; conteúdo não interpretado]"
        : pergunta.trim();

    const novaMensagemCliente: Mensagem = {
      id: `msg-${Date.now()}-c`,
      de: "cliente",
      texto: mensagemTexto,
      hora: formatarHoraAgora(),
      lido: true,
    };

    const mensagens = [...antes.slice(-29), novaMensagemCliente];
    setHistorico(mensagens);
    setTexto("");
    setUltimoTeste(null);

    const payloadMensagens = mensagens.map((m) => ({
      de: m.de,
      texto: m.texto,
    }));

    const resultado = await operar(async () => {
      const resposta = await requisitar<{
        mensagens: string[];
        estado: unknown;
        fontes?: unknown;
        testeId?: string;
      }>("/api/atendente/simular", "POST", {
        configuracaoRevisao: base.revisao,
        cenario: escolhido,
        mensagens:
          escolhido === "MIDIA" && novaConversa
            ? [{ de: "cliente", texto: "", midia: "audio" }]
            : payloadMensagens,
        estado: reiniciar ? null : estado,
      });
      return {
        resposta,
        nova: await requisitar<TelaConfiguracaoNexa>(
          "/api/atendente/configuracao"
        ),
      };
    });

    if (resultado) {
      const novasBolhas: Mensagem[] = resultado.resposta.mensagens.map(
        (t, idx) => ({
          id: `msg-${Date.now()}-a-${idx}`,
          de: "atendente",
          texto: t,
          hora: formatarHoraAgora(),
        })
      );
      setHistorico([...mensagens, ...novasBolhas]);
      setEstado(resultado.resposta.estado);
      setFontes(resultado.resposta.fontes ?? null);
      setUltimoTeste(resultado.resposta.testeId ?? null);
      aplicar(resultado.nova);
    } else {
      setHistorico(antes);
      setTexto(pergunta);
    }
    setRespondendo(false);
    requestAnimationFrame(() => campoTextoRef.current?.focus());
  }

  useEffect(() => {
    if (!pedido || pedido.seq === seqTratada.current) return;
    seqTratada.current = pedido.seq;
    setCenario(pedido.cenario);
    const c = CENARIOS_NEXA.find((item) => item.id === pedido.cenario)!;
    void testar(c.pergunta, c.id, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.seq]);

  async function revisar(correto: boolean) {
    if (!ultimoTeste || ocupado || sujo) return;
    const nova = await operar(() =>
      requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", {
        acao: "REVISAR_TESTE",
        revisao: tela.revisao,
        testeId: ultimoTeste,
        correto,
      })
    );
    if (nova) {
      aplicar(nova);
      if (!correto) corrigir(cenario);
    }
  }

  function limparConversa() {
    setHistorico([]);
    setEstado(null);
    setFontes(null);
    setUltimoTeste(null);
  }

  const atual = tela.testes.find(
    (t) => t.id === ultimoTeste && t.revisao === tela.revisao
  );
  const proximo =
    proximoCenario && proximoCenario !== atual?.cenario
      ? CENARIOS_NEXA.find((c) => c.id === proximoCenario)
      : null;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Sugestões Rápidas de 1 Clique */}
      <div className="mb-3 flex w-full max-w-[390px] flex-wrap items-center justify-center gap-1.5 px-2">
        {SUGESTOES_RAPIDAS.map((sug) => (
          <button
            key={sug.id}
            type="button"
            disabled={respondendo || ocupado}
            onClick={() => void testar(sug.texto)}
            className="inline-flex items-center gap-1 rounded-full border border-panel-line bg-panel-card px-2.5 py-1 text-[11px] font-medium text-panel-ink shadow-2xs hover:border-emerald-500/50 hover:bg-emerald-500/5 disabled:opacity-50 transition"
          >
            <span>{sug.icone}</span>
            <span>{sug.texto}</span>
          </button>
        ))}
      </div>

      {/* MOCKUP DO SMARTPHONE (Idêntico ao design do WhatsApp enviado) */}
      <div className="relative w-full max-w-[375px] sm:max-w-[390px] select-none">
        {/* Moldura Externa do Celular (iPhone Bezel) */}
        <div className="relative rounded-[50px] border-[11px] border-[#1e2024] bg-[#efeae2] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.15)_inset] overflow-hidden flex flex-col h-[670px] sm:h-[700px]">
          
          {/* 1. BARRA DE STATUS DO IPHONE */}
          <div className="h-10 bg-white flex items-center justify-between px-7 shrink-0 z-20 border-b border-[#f0f2f5]">
            <span className="text-xs font-bold text-black tracking-tight">
              {horaStatus}
            </span>

            {/* Dynamic Island / Notch */}
            <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#111] mr-8"></div>
            </div>

            {/* Ícones de Sinal, Wifi e Bateria */}
            <div className="flex items-center gap-1.5 text-black">
              {/* Sinal */}
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M2 18h3v-4H2v4zm5 0h3v-8H7v8zm5 0h3V6h-3v12zm5 0h3V2h-3v16z" />
              </svg>
              {/* WiFi */}
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 3.5c3.55 0 6.78 1.41 9.15 3.71L12 19.34 2.85 11.21C5.22 8.91 8.45 7.5 12 7.5z" />
              </svg>
              {/* Bateria */}
              <div className="w-5 h-2.5 rounded-[3px] border border-black p-0.5 flex items-center">
                <div className="h-full w-full bg-black rounded-[1px]"></div>
              </div>
            </div>
          </div>

          {/* 2. CABEÇALHO DO WHATSAPP */}
          <div className="bg-white border-b border-[#e9edef] px-3 py-2 flex items-center justify-between shrink-0 shadow-xs z-10">
            <div className="flex items-center gap-2 min-w-0">
              {/* Botão Voltar */}
              <button
                type="button"
                onClick={limparConversa}
                title="Limpar conversa"
                className="text-[#3b4a54] hover:text-black transition"
              >
                <svg
                  className="w-5 h-5 stroke-[2.5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Avatar Oficial (Robô Verde / Nex) */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white shadow-xs overflow-hidden border border-emerald-600/20">
                  <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A1.5 1.5 0 0 0 6 14.5 1.5 1.5 0 0 0 7.5 16 1.5 1.5 0 0 0 9 14.5 1.5 1.5 0 0 0 7.5 13m9 0a1.5 1.5 0 0 0-1.5 1.5 1.5 1.5 0 0 0 1.5 1.5 1.5 1.5 0 0 0 1.5-1.5 1.5 1.5 0 0 0-1.5-1.5M12 17c-1.33 0-2.42.84-2.83 2h5.66c-.41-1.16-1.5-2-2.83-2z" />
                  </svg>
                </div>
              </div>

              {/* Nome da Empresa & Selo Verificado */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-bold text-[#111b21] truncate leading-tight">
                    {nomeEmpresa || "Minha Empresa"}
                  </h2>
                  {/* Selo Verde Oficial Verificado */}
                  <svg
                    className="w-4 h-4 shrink-0 fill-[#00a884]"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <p className="text-[11px] text-[#667781] leading-tight truncate">
                  {respondendo ? (
                    <span className="font-semibold text-[#00a884] animate-pulse">
                      digitando…
                    </span>
                  ) : (
                    `Atendente Virtual (${nomeAtendente || "Nex"})`
                  )}
                </p>
              </div>
            </div>

            {/* Menu 3 Pontinhos */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMostrarOpcoesAvancadas((prev) => !prev)}
                title="Opções de teste"
                className="rounded-full p-1 text-[#54656f] hover:bg-black/5 hover:text-black transition"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Menu Dropdown de Opções Avançadas */}
          {mostrarOpcoesAvancadas && (
            <div className="border-b border-[#e9edef] bg-white p-3 text-xs shadow-md z-20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#111b21]">
                  Cenários de Teste:
                </span>
                <button
                  type="button"
                  onClick={limparConversa}
                  className="text-red-600 hover:underline"
                >
                  Limpar conversa
                </button>
              </div>
              <div className="flex gap-2">
                <select
                  className={CAMPO}
                  value={cenario}
                  disabled={ocupado || respondendo}
                  onChange={(e) => setCenario(e.target.value as CenarioNexa)}
                >
                  {CENARIOS_NEXA.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
                <button
                  className={BOTAO}
                  type="button"
                  disabled={ocupado || respondendo}
                  onClick={() => {
                    const c = CENARIOS_NEXA.find((item) => item.id === cenario)!;
                    void testar(c.pergunta, c.id, true);
                    setMostrarOpcoesAvancadas(false);
                  }}
                >
                  Testar
                </button>
              </div>
            </div>
          )}

          {/* 3. ÁREA DE CHAT (WALLPAPER OFICIAL DO WHATSAPP) */}
          <div
            className="flex-1 p-3 overflow-y-auto space-y-3.5 flex flex-col"
            style={{
              backgroundColor: "#efeae2",
              backgroundImage:
                "radial-gradient(#d7d0c4 1px, transparent 1px), radial-gradient(#d7d0c4 1px, #efeae2 1px)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0, 12px 12px",
            }}
          >
            {/* Pílula de Data "Hoje" */}
            <div className="flex justify-center my-1 shrink-0">
              <span className="rounded-lg bg-white/85 shadow-2xs px-2.5 py-0.5 text-[11px] font-medium text-[#54656f]">
                Hoje
              </span>
            </div>

            {/* Lista de Mensagens */}
            <div className="flex-1 flex flex-col justify-end space-y-3">
              {historico.map((m) => {
                const ehCliente = m.de === "cliente";
                return (
                  <div
                    key={m.id}
                    className={`flex ${ehCliente ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`relative max-w-[85%] rounded-2xl px-3.5 py-2 shadow-xs text-sm text-[#111b21] leading-relaxed ${
                        ehCliente
                          ? "rounded-tr-xs bg-[#d9fdd3]"
                          : "rounded-tl-xs bg-white"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                          ehCliente ? "text-[#667781]" : "text-[#8696a0]"
                        }`}
                      >
                        <span>{m.hora}</span>
                        {ehCliente && (
                          <svg
                            className="w-3.5 h-3.5 text-[#53bdeb]"
                            viewBox="0 0 16 11"
                            fill="currentColor"
                          >
                            <path d="M11.07 0.93a0.75 0.75 0 0 0-1.06 0L5.36 5.58 3.49 3.71a0.75 0.75 0 0 0-1.06 1.06l2.4 2.4a0.75 0.75 0 0 0 1.06 0l5.18-5.18a0.75 0.75 0 0 0 0-1.06z" />
                            <path d="M15.07 0.93a0.75 0.75 0 0 0-1.06 0L9.36 5.58l-0.8-0.8a0.75 0.75 0 1 0-1.06 1.06l1.33 1.33a0.75 0.75 0 0 0 1.06 0l5.18-5.18a0.75 0.75 0 0 0 0-1.06z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Bolha de Digitando do WhatsApp */}
              {respondendo && (
                <div className="flex justify-start">
                  <div className="relative rounded-2xl rounded-tl-xs bg-white px-4 py-2.5 shadow-xs flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#00a884] animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 rounded-full bg-[#00a884] animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 rounded-full bg-[#00a884] animate-bounce"></span>
                  </div>
                </div>
              )}

              <div ref={fimRef} />
            </div>
          </div>

          {/* 4. BARRA DE INPUT E BOTÃO FLUTUANTE DE ENVIO (WHATSAPP NATIVO) */}
          <div className="bg-[#efeae2] p-2 flex items-center gap-1.5 shrink-0 z-10">
            {/* Pílula Branca do Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void testar(texto);
              }}
              className="flex-1 bg-white rounded-full px-3 py-2 flex items-center gap-2 shadow-xs border border-[#e9edef]"
            >
              {/* Ícone de Emoji */}
              <button
                type="button"
                className="text-[#54656f] hover:text-[#111b21] transition"
                onClick={() => setTexto((prev) => `${prev} 😊`)}
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </button>

              {/* Campo de Texto */}
              <input
                ref={campoTextoRef}
                type="text"
                placeholder="Mensagem"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                disabled={respondendo || ocupado}
                className="flex-1 text-sm text-[#111b21] placeholder-[#8696a0] bg-transparent outline-none min-w-0"
              />

              {/* Ícone de Anexo / Clips */}
              <button
                type="button"
                className="text-[#54656f] hover:text-[#111b21] transition"
              >
                <svg
                  className="w-5 h-5 fill-current -rotate-45"
                  viewBox="0 0 24 24"
                >
                  <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5V6H9v9.5a3 3 0 0 0 6 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z" />
                </svg>
              </button>
            </form>

            {/* Botão Circular Verde (Microfone / Enviar) */}
            <button
              type="button"
              disabled={respondendo || ocupado}
              onClick={() => {
                if (texto.trim()) {
                  void testar(texto);
                } else {
                  void testar("Olá, gostaria de saber mais sobre a empresa!");
                }
              }}
              title={texto.trim() ? "Enviar mensagem" : "Enviar mensagem de teste"}
              className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-md hover:bg-[#009677] active:scale-95 transition shrink-0"
            >
              {texto.trim() ? (
                /* Ícone Avião / Enviar */
                <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              ) : (
                /* Ícone Microfone */
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
            </button>
          </div>

          {/* 5. BARRA DE INÍCIO DO IPHONE (HOME INDICATOR) */}
          <div className="h-4 bg-[#efeae2] flex items-center justify-center pb-1 shrink-0">
            <div className="w-28 h-1 bg-black/40 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Fontes utilizadas (se houver) */}
      {Array.isArray(fontes) && fontes.length > 0 && (
        <details className="mt-3 w-full max-w-[390px] rounded-xl border border-panel-line bg-panel-card p-2.5 text-xs text-panel-sub">
          <summary className="cursor-pointer font-medium text-panel-ink">
            Informações utilizadas nesta resposta
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {fontes
              .filter((f): f is string => typeof f === "string")
              .map((f, i) => (
                <li key={i}>{f}</li>
              ))}
          </ul>
        </details>
      )}

      {/* Avaliação do Teste (Correto / Preciso Corrigir) */}
      {ultimoTeste && (
        <div className="mt-3 w-full max-w-[390px] space-y-2 rounded-2xl border border-panel-line bg-panel-card p-3 shadow-2xs">
          <p className="text-xs font-semibold text-panel-ink text-center">
            A resposta do Nex está de acordo com a sua empresa?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 ${BOTAO} ${
                atual?.correto === true
                  ? "!border-emerald-500 !bg-emerald-500/10 !text-emerald-900"
                  : ""
              }`}
              disabled={ocupado || sujo}
              onClick={() => void revisar(true)}
            >
              ✓ Está correta
            </button>
            <button
              type="button"
              className={`flex-1 ${BOTAO}`}
              disabled={ocupado || sujo}
              onClick={() => void revisar(false)}
            >
              ✎ Preciso corrigir
            </button>
          </div>

          {atual?.correto === true &&
            (proximo ? (
              <button
                type="button"
                className={`${PRINCIPAL} w-full`}
                disabled={ocupado || respondendo || sujo}
                onClick={() => {
                  setCenario(proximo.id);
                  void testar(proximo.pergunta, proximo.id, true);
                }}
              >
                Testar próxima situação →
              </button>
            ) : proximoCenario === null && concluirTeste ? (
              <button
                type="button"
                className={`${PRINCIPAL} w-full`}
                disabled={ocupado || respondendo || sujo}
                onClick={concluirTeste}
              >
                Concluir testes e avançar
              </button>
            ) : null)}
        </div>
      )}

      {/* Ações de Apoio */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-panel-sub">
        <button
          type="button"
          onClick={limparConversa}
          className="rounded-xl border border-panel-line bg-panel-card px-3 py-1.5 font-semibold text-panel-ink shadow-2xs hover:bg-panel-bg"
        >
          🔄 Recomeçar Conversa
        </button>

        {erro && (
          <p role="alert" className="w-full text-center text-xs text-red-600">
            {erro}
          </p>
        )}
      </div>
    </div>
  );
}
