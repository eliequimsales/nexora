"use client";

import { useState } from "react";
import { ModalFeedback } from "./modal-feedback";

type BotaoFeedbackProps = {
  emailPadrao?: string;
  telefonePadrao?: string;
  nomePadrao?: string;
};

export function BotaoFeedback({
  emailPadrao,
  telefonePadrao,
  nomePadrao,
}: BotaoFeedbackProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="group flex items-center gap-2 rounded-full border border-gray-700/80 bg-[#121217]/95 px-3.5 py-2 text-xs font-semibold text-gray-200 shadow-2xl backdrop-blur-md transition-all duration-200 hover:border-amber-400/60 hover:bg-[#1a1a22] hover:text-white hover:scale-105 active:scale-95"
          title="Envie uma sugestão ou feedback para a equipe Nexora"
          aria-label="Abrir formulário de feedback"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 text-amber-400 transition-colors group-hover:bg-amber-400 group-hover:text-gray-950">
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </span>
          <span className="font-medium">Feedback</span>
        </button>
      </div>

      <ModalFeedback
        aberto={aberto}
        onFechar={() => setAberto(false)}
        emailPadrao={emailPadrao}
        telefonePadrao={telefonePadrao}
        nomePadrao={nomePadrao}
      />
    </>
  );
}
