"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Registra o Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // SW registrado com sucesso
        })
        .catch(() => {
          // Registro falhou silenciosamente
        });
    }

    // 2. Verifica se já está rodando como PWA (Standalone)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error - navigator.standalone é propriedade específica do Safari iOS
        Boolean(window.navigator.standalone);
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return; // Já é app, não mostra nada
    }

    // 3. Verifica se o usuário já dispensou o aviso nos últimos 7 dias
    const dismissedAt = localStorage.getItem("nexora_pwa_dismissed_at");
    if (dismissedAt) {
      const diffDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (diffDays < 7) {
        return;
      }
    }

    // 4. Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // No iOS, se não for standalone, mostra o prompt após 3 segundos
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 5. Detecta Android / Chrome via beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosGuide(false);
    localStorage.setItem("nexora_pwa_dismissed_at", Date.now().toString());
  };

  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <>
      {/* Banner Flutuante no Rodapé (Mobile First) */}
      <aside
        aria-label="Instalação do aplicativo"
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-in"
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-[#0A0A0F]/95 p-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber text-night font-bold shadow-md">
              <span className="font-display text-xl font-black">N</span>
            </div>
            <div>
              <h4 className="font-display text-xs font-bold text-panel-ink">
                Instalar Aplicativo Nexora
              </h4>
              <p className="text-[11px] text-panel-sub">
                Acesse a agenda e clientes com 1 toque no celular
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="rounded-xl bg-amber px-3.5 py-2 text-xs font-bold text-night hover:bg-amber-hover transition shadow-sm"
            >
              {isIos ? "Como instalar" : "Instalar"}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-panel-sub hover:bg-panel-card hover:text-panel-ink transition"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      </aside>

      {/* Modal Guia para iPhone / Safari */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-panel-line bg-night p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber/20 text-2xl text-amber">
              📱
            </div>

            <h3 className="mt-3 font-display text-base font-bold text-panel-ink">
              Instalar Nexora no iPhone
            </h3>
            <p className="mt-1 text-xs text-panel-sub">
              Siga os passos abaixo no Safari para ter o ícone na sua tela inicial:
            </p>

            <div className="mt-4 space-y-2.5 text-left text-xs text-panel-sub">
              <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-panel-bg font-bold text-amber">
                  1
                </span>
                <span>
                  Toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima ⎋).
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-panel-bg font-bold text-amber">
                  2
                </span>
                <span>
                  Role para baixo e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong> ⊞.
                </span>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-panel-bg font-bold text-amber">
                  3
                </span>
                <span>
                  Toque em <strong>&quot;Adicionar&quot;</strong> no canto superior direito.
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-5 w-full rounded-xl bg-amber py-2.5 text-xs font-bold text-night hover:bg-amber-hover transition"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
