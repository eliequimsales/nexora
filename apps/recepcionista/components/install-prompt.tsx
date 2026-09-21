"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function openPwaInstall() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-pwa-install"));
  }
}

export function BotaoBaixarApp({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openPwaInstall}
      className={
        className ||
        "inline-flex items-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-3.5 py-1.5 text-xs font-bold text-amber hover:bg-amber/20 transition shadow-sm"
      }
    >
      <span>📱</span>
      <span>Baixar App</span>
    </button>
  );
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    // 1. Registra o Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // SW registrado
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

    checkStandalone();

    // 3. Detecta dispositivos móveis e iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isMobileDevice = /android|iphone|ipad|ipod|mobile/.test(userAgent);
    setIsIos(isIosDevice);
    setIsMobile(isMobileDevice);

    // 4. Captura o evento de instalação nativo (Chrome / Android / Edge Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Escuta evento global para abrir modal de qualquer lugar
    const handleOpenCustom = () => {
      setModalAberto(true);
    };

    window.addEventListener("open-pwa-install", handleOpenCustom);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("open-pwa-install", handleOpenCustom);
    };
  }, []);

  const handleInstallNativo = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      setModalAberto(false);
    }
    setDeferredPrompt(null);
  };

  const copiarLink = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText("https://www.meunexora.com.br");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  // Se já estiver rodando como aplicativo instalado, não mostra o botão flutuante
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Botão Fixo e Explícito de Baixar Aplicativo */}
      <div className="fixed bottom-4 right-4 z-40 animate-fade-in">
        <button
          onClick={() => setModalAberto(true)}
          className="group flex items-center gap-2.5 rounded-full border border-amber/40 bg-[#0A0A0F]/95 px-4 py-2.5 shadow-2xl backdrop-blur-md hover:border-amber hover:bg-night transition-all active:scale-95"
          title="Baixar e instalar o aplicativo Nexora"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber text-night font-black text-xs shadow-sm">
            N
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-panel-ink group-hover:text-amber transition">
              Baixar Aplicativo
            </span>
            <span className="block text-[10px] text-panel-sub">
              {isMobile ? "Instalar no celular" : "Celular ou PC"}
            </span>
          </div>
          <span className="text-amber text-sm font-bold ml-1">↓</span>
        </button>
      </div>

      {/* Modal Explícito de Download / Instalação */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-panel-line bg-night p-6 shadow-2xl">
            {/* Botão Fechar */}
            <button
              onClick={() => setModalAberto(false)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-panel-sub hover:bg-panel-bg hover:text-panel-ink transition"
            >
              ✕
            </button>

            {/* Cabeçalho */}
            <div className="flex items-center gap-3 border-b border-panel-line pb-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber text-night font-display text-2xl font-black shadow-md">
                N
              </div>
              <div>
                <span className="text-[11px] font-bold text-amber uppercase tracking-wider">
                  Aplicativo Oficial
                </span>
                <h3 className="font-display text-lg font-bold text-panel-ink">
                  Baixar Nexora no Celular
                </h3>
              </div>
            </div>

            {/* Conteúdo dinâmico: Se estiver no PC ou no Celular */}
            <div className="mt-5 space-y-4">
              {!isMobile ? (
                /* ========================================================================= */
                /* VISÃO NO COMPUTADOR (DESKTOP) -> QR CODE PARA O CELULAR                   */
                /* ========================================================================= */
                <div className="text-center space-y-3">
                  <p className="text-xs text-panel-sub">
                    Aponte a câmera do seu celular para o QR Code abaixo para abrir e instalar o aplicativo direto no seu celular:
                  </p>

                  <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-amber/30 bg-white p-3 shadow-inner">
                    <Image
                      src="/icons/qr-code-pwa.png"
                      alt="QR Code para instalar o aplicativo Nexora"
                      width={180}
                      height={180}
                      className="rounded-lg"
                      priority
                    />
                  </div>

                  <div className="rounded-xl border border-panel-line bg-panel-bg p-2.5 flex items-center justify-between text-xs">
                    <span className="font-mono text-panel-sub text-[11px] truncate mr-2">
                      https://www.meunexora.com.br
                    </span>
                    <button
                      onClick={copiarLink}
                      className="shrink-0 rounded-lg bg-panel-card border border-panel-line px-2.5 py-1 text-xs font-semibold text-panel-ink hover:text-amber transition"
                    >
                      {copiado ? "Copiado! ✓" : "Copiar link"}
                    </button>
                  </div>

                  {deferredPrompt && (
                    <div className="pt-2 border-t border-panel-line">
                      <button
                        onClick={handleInstallNativo}
                        className="w-full rounded-xl bg-amber py-2.5 text-xs font-bold text-night hover:bg-amber-hover transition shadow-sm"
                      >
                        💻 Ou instale neste computador agora
                      </button>
                    </div>
                  )}
                </div>
              ) : isIos ? (
                /* ========================================================================= */
                /* VISÃO NO IPHONE (IOS / SAFARI)                                            */
                /* ========================================================================= */
                <div className="space-y-3">
                  <p className="text-xs text-panel-sub">
                    No iPhone, você instala o aplicativo em 3 toques rápidos pelo Safari:
                  </p>

                  <div className="space-y-2 text-xs text-panel-sub">
                    <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber text-night font-bold">
                        1
                      </span>
                      <span>
                        Toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima ⎋ na barra inferior do Safari).
                      </span>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber text-night font-bold">
                        2
                      </span>
                      <span>
                        Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong> ⊞.
                      </span>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber text-night font-bold">
                        3
                      </span>
                      <span>
                        Toque em <strong>&quot;Adicionar&quot;</strong> no canto superior direito.
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-xs text-emerald-300">
                    ✓ O ícone da Nexora vai direto para a tela inicial do seu iPhone!
                  </div>
                </div>
              ) : (
                /* ========================================================================= */
                /* VISÃO NO ANDROID / CHROME                                                 */
                /* ========================================================================= */
                <div className="space-y-3 text-center">
                  <p className="text-xs text-panel-sub">
                    Instale a Nexora para acessar a agenda e recuperar clientes com 1 toque no celular, em tela cheia:
                  </p>

                  {deferredPrompt ? (
                    <button
                      onClick={handleInstallNativo}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber py-3.5 text-sm font-bold text-night hover:bg-amber-hover transition shadow-lg"
                    >
                      <span>📲</span>
                      <span>Instalar Aplicativo Agora</span>
                    </button>
                  ) : (
                    <div className="space-y-2 text-left text-xs text-panel-sub">
                      <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber text-night font-bold">
                          1
                        </span>
                        <span>
                          Toque nos <strong>três pontinhos (⋮)</strong> no canto superior do Chrome.
                        </span>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl border border-panel-line bg-panel-card p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber text-night font-bold">
                          2
                        </span>
                        <span>
                          Selecione <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-panel-sub">
                    Não ocupa espaço no celular e atualiza automaticamente.
                  </p>
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="mt-5 border-t border-panel-line pt-4 flex justify-end">
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-xl border border-panel-line px-5 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
