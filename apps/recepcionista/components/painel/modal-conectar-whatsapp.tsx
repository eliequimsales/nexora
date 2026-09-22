"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ModalConectarWhatsAppProps {
  aberto: boolean;
  aoFechar: () => void;
  aoConectar?: () => void;
}

export function ModalConectarWhatsApp({
  aberto,
  aoFechar,
  aoConectar,
}: ModalConectarWhatsAppProps) {
  const [aba, setAba] = useState<"CODIGO" | "QR">("CODIGO");
  const [carregando, setCarregando] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [telefone, setTelefone] = useState("");
  const [status, setStatus] = useState<"DESLIGADO" | "AGUARDANDO_QR" | "CONECTADO" | "ERRO">("DESLIGADO");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Formata telefone (XX) XXXXX-XXXX
  const formatarTelefoneInput = (valor: string) => {
    const nums = valor.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
  };

  // Quem abre o modal costuma passar uma função nova a cada render. Com ela nas
  // dependências, a aba do QR Code pedia uma conexão nova a cada render até o
  // código chegar. Lida por referência, a conexão só é pedida quando precisa.
  const aoConectarAgora = useRef(aoConectar);
  aoConectarAgora.current = aoConectar;

  const buscarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.state?.status === "CONNECTED") {
        setStatus("CONECTADO");
        aoConectarAgora.current?.();
      } else if (data.state?.qrCode) {
        setQrCode(data.state.qrCode);
        if (!pairingCode) {
          setStatus("AGUARDANDO_QR");
        }
      }
    } catch {
      // Ignora falhas de polling temporárias
    }
  }, [pairingCode]);

  const iniciarConexao = useCallback(async (phoneParam?: string) => {
    setCarregando(true);
    setErro("");
    try {
      const body = phoneParam ? JSON.stringify({ phone: phoneParam.replace(/\D/g, "") }) : undefined;
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não consegui gerar o código agora. Tenta de novo?");
        setStatus("ERRO");
        return;
      }
      if (data.state?.status === "CONNECTED") {
        setStatus("CONECTADO");
        aoConectarAgora.current?.();
      } else {
        if (data.state?.pairingCode) {
          setPairingCode(data.state.pairingCode);
        }
        if (data.state?.qrCode) {
          setQrCode(data.state.qrCode);
        }
        setStatus("AGUARDANDO_QR");
      }
    } catch {
      setErro("Falha ao comunicar com o servidor. Verifique sua conexão e tente novamente.");
      setStatus("ERRO");
    } finally {
      setCarregando(false);
    }
  }, []);

  const handleGerarCodigo = (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = telefone.replace(/\D/g, "");
    if (limpo.length < 10) {
      setErro("Por favor, digite o DDD e o número completo (ex: 11 98888-7777).");
      return;
    }
    void iniciarConexao(limpo);
  };

  const handleCopiarCodigo = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  useEffect(() => {
    if (!aberto) return;
    // Se abrir na aba QR, inicia conexão QR padrão
    if (aba === "QR" && !qrCode) {
      void iniciarConexao();
    }
  }, [aberto, aba, qrCode, iniciarConexao]);

  useEffect(() => {
    if (!aberto || status === "CONECTADO") return;
    const interval = setInterval(() => {
      void buscarStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [aberto, status, buscarStatus]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl border border-panel-line bg-panel-card p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={aoFechar}
          className="absolute right-4 top-4 rounded-lg p-2 text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
          aria-label="Fechar"
        >
          ✕
        </button>

        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl">
            💬
          </div>
          <h2 className="font-display text-xl font-bold sm:text-2xl text-panel-ink">
            Ligar meu WhatsApp na Nexora
          </h2>
          <p className="mt-1 text-xs text-panel-sub max-w-md mx-auto">
            As mensagens da Onda saem pelo seu número — e, se você ligar o Atendente Virtual, é por ele que ele
            responde quando você não pode.
          </p>
        </div>

        {status !== "CONECTADO" && (
          <div className="mt-5 flex rounded-xl border border-panel-line bg-panel-bg p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAba("CODIGO")}
              className={`flex-1 rounded-lg py-2 text-center transition ${
                aba === "CODIGO"
                  ? "bg-amber text-night font-bold shadow-sm"
                  : "text-panel-sub hover:text-panel-ink"
              }`}
            >
              📱 Código no Celular
            </button>
            <button
              type="button"
              onClick={() => {
                setAba("QR");
                if (!qrCode) void iniciarConexao();
              }}
              className={`flex-1 rounded-lg py-2 text-center transition ${
                aba === "QR"
                  ? "bg-amber text-night font-bold shadow-sm"
                  : "text-panel-sub hover:text-panel-ink"
              }`}
            >
              📷 Escanear QR Code
            </button>
          </div>
        )}

        <div className="mt-6">
          {status === "CONECTADO" ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white shadow-lg shadow-emerald-500/30">
                ✓
              </div>
              <h3 className="font-display text-lg font-bold text-emerald-400">
                WhatsApp conectado com sucesso!
              </h3>
              <p className="mt-1 text-xs text-panel-sub">
                Pronto: as mensagens já saem pelo seu número.
              </p>
              <button
                type="button"
                onClick={aoFechar}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-2.5 font-display text-xs font-bold text-night transition hover:bg-emerald-400"
              >
                Continuar
              </button>
            </div>
          ) : erro ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
              <p className="text-xs font-medium text-red-400">{erro}</p>
              <button
                type="button"
                onClick={() => (aba === "CODIGO" ? iniciarConexao(telefone) : iniciarConexao())}
                className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/30"
              >
                Tentar novamente
              </button>
            </div>
          ) : aba === "CODIGO" ? (
            /* ========================================================================= */
            /* ABA 1: CONECTAR COM CÓDIGO DE PAREAMENTO (NÚMERO DE TELEFONE)             */
            /* ========================================================================= */
            <div className="space-y-4">
              {!pairingCode ? (
                <form onSubmit={handleGerarCodigo} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-panel-sub mb-1">
                      Seu número de WhatsApp com DDD
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: (11) 98888-7777"
                      value={telefone}
                      onChange={(e) => setTelefone(formatarTelefoneInput(e.target.value))}
                      className="w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2.5 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={carregando}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber py-2.5 text-xs font-bold text-night hover:bg-amber-hover transition shadow-sm disabled:opacity-50"
                  >
                    {carregando ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                    ) : (
                      <span>⚡ Gerar código de pareamento</span>
                    )}
                  </button>

                  <p className="text-[11px] text-panel-sub text-center">
                    Você receberá um código de 8 dígitos para digitar no seu WhatsApp.
                  </p>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="rounded-2xl border border-amber/40 bg-amber/5 p-4 shadow-sm">
                    <span className="text-[11px] font-semibold text-amber uppercase tracking-wider block">
                      Seu código de conexão
                    </span>
                    <div className="mt-2 font-mono text-2xl font-black text-panel-ink tracking-widest sm:text-3xl">
                      {pairingCode}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopiarCodigo}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber px-4 py-1.5 text-xs font-bold text-night hover:bg-amber-hover transition"
                    >
                      <span>{copiado ? "Código copiado! ✓" : "Copiar código 📋"}</span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-panel-line bg-panel-bg p-4 text-left text-xs space-y-2 text-panel-sub">
                    <span className="font-bold text-panel-ink block">
                      Como conectar no WhatsApp:
                    </span>
                    <ol className="space-y-2 text-panel-ink">
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 font-bold text-amber text-[11px]">
                          1
                        </span>
                        <span>Abra o <strong>WhatsApp</strong> no celular.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 font-bold text-amber text-[11px]">
                          2
                        </span>
                        <span>Toque em <strong>Aparelhos conectados</strong> &gt; <strong>Conectar com número de telefone</strong>.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 font-bold text-amber text-[11px]">
                          3
                        </span>
                        <span>Digite o código <strong>{pairingCode}</strong> acima.</span>
                      </li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPairingCode(null)}
                    className="text-xs text-panel-sub hover:text-panel-ink underline"
                  >
                    Trocar número ou gerar novo código
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* ABA 2: CONECTAR COM QR CODE (COMPUTADOR)                                  */
            /* ========================================================================= */
            <div className="flex flex-col items-center">
              {carregando ? (
                <div className="flex h-60 w-60 flex-col items-center justify-center rounded-2xl border border-dashed border-panel-line bg-panel-bg/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
                  <p className="mt-3 text-xs font-medium text-panel-sub">Gerando QR Code...</p>
                </div>
              ) : qrCode ? (
                <div className="flex flex-col items-center">
                  <div className="relative rounded-2xl border border-panel-line bg-white p-3 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCode}
                      alt="Código QR para conexão do WhatsApp"
                      className="h-56 w-56 rounded-lg object-contain"
                    />
                  </div>
                  <p className="mt-3 text-xs text-panel-sub">
                    O código atualiza sozinho a cada minuto
                  </p>
                </div>
              ) : null}

              <div className="mt-4 w-full rounded-xl border border-panel-line bg-panel-bg p-4 text-left text-xs space-y-2">
                <span className="font-bold text-panel-ink block">
                  Como escanear:
                </span>
                <ol className="space-y-1.5 text-panel-ink">
                  <li>1. Abra o WhatsApp no celular.</li>
                  <li>2. Toque em <strong>Aparelhos conectados</strong> &gt; <strong>Conectar um aparelho</strong>.</li>
                  <li>3. Aponte a câmera para o QR Code acima.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
          >
            {status === "CONECTADO" ? "Fechar" : "Fazer isso depois"}
          </button>
        </div>
      </div>
    </div>
  );
}
