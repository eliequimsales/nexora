"use client";

import { useEffect, useState } from "react";
import { obterLinkWhatsAppDemo } from "@/lib/whatsapp/demo";

const MENSAGEM_PADRAO = "Oi Sofia, quero ativar meu Atendente Nexora!";

export default function PaginaObrigado() {
  const [segundos, setSegundos] = useState(5);
  const [pausado, setPausado] = useState(false);

  const whatsappUrl = obterLinkWhatsAppDemo(MENSAGEM_PADRAO);

  useEffect(() => {
    if (pausado) return;

    if (segundos <= 0) {
      window.location.href = whatsappUrl;
      return;
    }

    const timer = setTimeout(() => {
      setSegundos((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [segundos, pausado, whatsappUrl]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between px-4 py-8 sm:py-12">
      {/* Topo / Logo */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-lg">
            N
          </div>
          <span className="font-semibold tracking-tight text-slate-200 text-base">Nexora</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Acesso Liberado
        </span>
      </header>

      {/* Cartão Central (A Onda) */}
      <section className="max-w-xl mx-auto w-full my-auto py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Efeito sutil de brilho superior */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-80" />

          {/* Ícone de Sucesso */}
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 shadow-inner shadow-emerald-500/10">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Título Principal */}
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Compra Aprovada com Sucesso! 🎉
            </h1>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              Seu Atendente Oficial já está pronto e te esperando no WhatsApp.
            </p>
          </div>

          {/* Barra de Progresso / Contagem de 5 segundos */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 mb-6 text-center">
            <p className="text-xs sm:text-sm text-slate-300 mb-2">
              Redirecionando você direto para a conversa em{" "}
              <span className="font-bold text-emerald-400 text-base">{segundos}s</span>...
            </p>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(segundos / 5) * 100}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setPausado((p) => !p)}
              className="mt-2 text-[11px] text-slate-500 hover:text-slate-400 underline underline-offset-2"
            >
              {pausado ? "Retomar redirecionamento" : "Pausar contagem"}
            </button>
          </div>

          {/* Botão Magnético de Ação Única */}
          <a
            href={whatsappUrl}
            onClick={() => setPausado(true)}
            className="group w-full flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/30 hover:shadow-emerald-500/40 transform active:scale-[0.99] border border-emerald-400/40 text-center"
          >
            <span className="flex items-center justify-center gap-2 text-base sm:text-lg tracking-wide uppercase">
              Continuar no WhatsApp com a Sofia
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </span>
            <span className="text-xs text-emerald-100/90 font-normal mt-1">
              (Resposta em 3 segundos para você ver funcionando ao vivo)
            </span>
          </a>

          {/* Caixa de Esclarecimento Rápido (O Efeito UAU) */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-start gap-3 text-left bg-slate-950/40 rounded-xl p-3.5 border border-slate-800/40">
            <span className="text-lg">⚡</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Como funciona:</strong> Ao tocar no botão, o seu WhatsApp abrirá com uma mensagem já digitada. Assim que você enviar, a Sofia responde na hora para você ver a velocidade do atendimento e colocar para rodar no seu número.
            </p>
          </div>

          {/* Link de Contingência */}
          <p className="text-center text-xs text-slate-500 mt-5">
            Não abriu automaticamente?{" "}
            <a
              href={whatsappUrl}
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              Toque aqui para abrir a conversa
            </a>
          </p>
        </div>
      </section>

      {/* Rodapé Seguro */}
      <footer className="max-w-xl mx-auto w-full text-center text-xs text-slate-500 border-t border-slate-900 pt-4">
        Nexora Oficial • Ambiente Seguro & Criptografado de Ponta a Ponta
      </footer>
    </main>
  );
}
