"use client";

import { useEffect, useState, useCallback } from "react";

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
  const [carregando, setCarregando] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"DESLIGADO" | "AGUARDANDO_QR" | "CONECTADO" | "ERRO">("DESLIGADO");
  const [erro, setErro] = useState("");

  const buscarStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.state?.status === "CONNECTED") {
        setStatus("CONECTADO");
        if (aoConectar) aoConectar();
      } else if (data.state?.qrCode) {
        setQrCode(data.state.qrCode);
        setStatus("AGUARDANDO_QR");
      }
    } catch {
      // Ignora falhas de polling temporárias
    }
  }, [aoConectar]);

  const iniciarConexao = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/whatsapp/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Não consegui gerar o código agora. Tenta de novo?");
        setStatus("ERRO");
        return;
      }
      if (data.state?.status === "CONNECTED") {
        setStatus("CONECTADO");
        if (aoConectar) aoConectar();
      } else if (data.state?.qrCode) {
        setQrCode(data.state.qrCode);
        setStatus("AGUARDANDO_QR");
      }
    } catch {
      setErro("Falha ao comunicar com o servidor. Verifique sua conexão e tente novamente.");
      setStatus("ERRO");
    } finally {
      setCarregando(false);
    }
  }, [aoConectar]);

  useEffect(() => {
    if (!aberto) return;
    void iniciarConexao();
  }, [aberto, iniciarConexao]);

  useEffect(() => {
    if (!aberto || status === "CONECTADO") return;
    const interval = setInterval(() => {
      void buscarStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, [aberto, status, buscarStatus]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
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
          <h2 className="font-display text-xl font-bold sm:text-2xl">
            Ligar meu WhatsApp na Nexora
          </h2>
          <p className="mt-2 text-sm text-panel-sub">
            Conecte seu aparelho para enviar as mensagens de recuperação com 1 clique direto pelo sistema, sem precisar abrir janelas extras.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center">
          {status === "CONECTADO" ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-white shadow-lg shadow-emerald-500/30">
                ✓
              </div>
              <h3 className="font-display text-lg font-bold text-emerald-400">
                WhatsApp conectado com sucesso!
              </h3>
              <p className="mt-1 text-sm text-panel-sub">
                Seu número está pronto para disparar as mensagens em 1 toque.
              </p>
              <button
                type="button"
                onClick={aoFechar}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-2.5 font-display text-sm font-bold text-night transition hover:bg-emerald-400"
              >
                Continuar para os disparos
              </button>
            </div>
          ) : carregando ? (
            <div className="flex h-64 w-64 flex-col items-center justify-center rounded-2xl border border-dashed border-panel-line bg-panel-bg/50">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
              <p className="mt-4 text-xs font-medium text-panel-sub">Gerando código seguro...</p>
            </div>
          ) : erro ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
              <p className="text-sm font-medium text-red-400">{erro}</p>
              <button
                type="button"
                onClick={iniciarConexao}
                className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/30"
              >
                Tentar gerar novo código
              </button>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center">
              <div className="relative rounded-2xl border border-panel-line bg-white p-3 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Código QR para conexão do WhatsApp"
                  className="h-60 w-60 rounded-lg object-contain"
                />
              </div>
              <p className="mt-3 text-xs text-panel-sub">
                O código atualiza sozinho a cada minuto
              </p>
            </div>
          ) : null}
        </div>

        {status !== "CONECTADO" && (
          <div className="mt-6 rounded-xl border border-panel-line bg-panel-bg p-4 text-left">
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-panel-sub">
              Como conectar seu celular:
            </h4>
            <ol className="mt-2 space-y-2 text-xs text-panel-ink">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 font-bold text-amber-deep">
                  1
                </span>
                <span>Abra o <strong>WhatsApp</strong> no seu celular</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 font-bold text-amber-deep">
                  2
                </span>
                <span>Toque em <strong>Configurações</strong> (ou três pontinhos) &gt; <strong>Aparelhos conectados</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber/20 font-bold text-amber-deep">
                  3
                </span>
                <span>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para o código acima</span>
              </li>
            </ol>
          </div>
        )}

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
