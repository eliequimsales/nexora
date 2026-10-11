"use client";

import React, { useEffect, useState } from "react";
import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";

const MENSAGEM = "Oi Sofia, quero ajuda com meu acesso ao guia Anti-Vácuo.";
const SEGUNDOS_PARA_ABRIR = 3;
const CHAVE_ABERTURA = "nexora:guia-antivacuo:whatsapp-aberto";

function registrarAbertura() {
  try {
    window.sessionStorage.setItem(CHAVE_ABERTURA, "1");
  } catch {
    // A conversa continua acessível quando o navegador bloqueia o armazenamento.
  }
}

export function ContinuarComSofia() {
  const [segundos, setSegundos] = useState(SEGUNDOS_PARA_ABRIR);
  const [pausado, setPausado] = useState(false);
  const [tentouAbrir, setTentouAbrir] = useState(false);
  const whatsappUrl = obterLinkWhatsAppDemo(MENSAGEM);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(CHAVE_ABERTURA) === "1") setTentouAbrir(true);
    } catch {
      // Sem armazenamento, mantemos a pausa e o botão disponíveis.
    }
  }, []);

  useEffect(() => {
    if (pausado || tentouAbrir) return;
    if (segundos <= 0) {
      setTentouAbrir(true);
      registrarAbertura();
      try {
        window.location.assign(whatsappUrl);
      } catch {
        // Se o navegador bloquear a abertura automática, o botão continua disponível.
      }
      return;
    }
    const timer = window.setTimeout(
      () => setSegundos((atual) => atual - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [segundos, pausado, tentouAbrir, whatsappUrl]);

  return (
    <main
      className="flex min-h-[100svh] flex-col bg-zinc-950 px-5 py-6 text-zinc-100 sm:px-6 sm:py-9"
      onFocusCapture={(event) => {
        // Foco pelo teclado pausa antes de a pessoa precisar localizar o botão.
        // O clique com o mouse não altera o estado antes de acionar Pausar/Retomar.
        if (event.target.matches(":focus-visible")) setPausado(true);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Tab") setPausado(true);
      }}
    >
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-4">
        <span className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366] text-lg font-bold text-zinc-950"
            aria-hidden="true"
          >
            n
          </span>
          nexora<span className="-ml-2 text-[#25D366]">.</span>
        </span>
        <span className="text-xs text-zinc-400">Guia Anti-Vácuo</span>
      </header>

      <section
        aria-labelledby="continuar-titulo"
        className="mx-auto my-auto w-full max-w-lg py-12 sm:py-16"
      >
        <div
          className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#25D366]/25 bg-[#25D366]/10 text-[#25D366]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
            <path d="M8.5 11.5h7M8.5 15h4" />
          </svg>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#25D366]">
          Seu próximo passo
        </p>
        <h1
          id="continuar-titulo"
          className="max-w-sm text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl"
        >
          Vamos continuar com a Sofia.
        </h1>
        <p className="mt-5 text-base leading-7 text-zinc-300">
          Abra a conversa para pedir ajuda com seu acesso ao guia Anti-Vácuo.
        </p>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Se você já comprou, tenha a confirmação da compra em mãos.
        </p>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
          <a
            href={whatsappUrl}
            onClick={() => {
              setPausado(true);
              registrarAbertura();
            }}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#25D366] px-4 py-4 text-center text-base font-semibold leading-6 text-zinc-950 transition-colors hover:bg-[#45e581] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#25D366]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 shrink-0"
            >
              <path d="M12 2a10 10 0 0 0-8.66 15l-1.3 4.74L6.9 20.5A10 10 0 1 0 12 2Zm0 18.18a8.13 8.13 0 0 1-4.17-1.14l-.3-.18-2.88.76.77-2.8-.2-.31A8.18 8.18 0 1 1 12 20.18Zm4.49-6.12c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.13-.16.24-.63.8-.77.97-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.96-1.21-.72-.64-1.21-1.44-1.35-1.68-.14-.25-.02-.38.1-.5.11-.11.25-.28.37-.42.12-.14.16-.24.24-.4.09-.17.04-.31-.02-.43-.06-.12-.55-1.33-.75-1.82-.2-.47-.4-.4-.55-.41h-.47c-.16 0-.43.06-.65.31-.23.24-.86.83-.86 2.02s.88 2.34 1 2.5c.12.17 1.73 2.65 4.2 3.71.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.46-.6 1.67-1.17.21-.58.21-1.07.14-1.17-.06-.1-.22-.16-.47-.29Z" />
            </svg>
            <span>Conversar com a Sofia no WhatsApp</span>
          </a>
          <p className="mt-4 text-center text-sm leading-6 text-zinc-400">
            A mensagem já vai preenchida. É só tocar em enviar no WhatsApp.
          </p>

          <div className="mt-5 border-t border-zinc-800 pt-4 text-center">
            <p
              role="status"
              aria-live="polite"
              className="text-sm leading-6 text-zinc-300"
            >
              {tentouAbrir
                ? "O WhatsApp não abriu? Use o botão acima."
                : pausado
                  ? "A abertura automática está pausada."
                  : `Tentaremos abrir o WhatsApp em ${segundos} ${segundos === 1 ? "segundo" : "segundos"}.`}
            </p>
            {!tentouAbrir && (
              <button
                type="button"
                onClick={() => setPausado((atual) => !atual)}
                className="mt-1 min-h-11 rounded-md px-3 text-sm text-zinc-400 underline decoration-zinc-600 underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
              >
                {pausado
                  ? "Retomar abertura automática"
                  : "Pausar abertura automática"}
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-lg border-t border-zinc-800/80 pt-5 text-center text-xs leading-5 text-zinc-400">
        Nexora · Atendimento pelo WhatsApp
      </footer>
    </main>
  );
}
