"use client";

import { useState } from "react";

/**
 * A AÇÃO DE MANDAR A MENSAGEM — com ou sem telefone.
 *
 * O caminho feliz é o link wa.me: abre a conversa daquela pessoa com o texto já
 * escrito, um toque e acabou.
 *
 * Sem telefone, a ação NÃO some. Antes ela sumia — `conviteDeVolta` devolvia
 * null e o card ficava sem botão. No fluxo de Três Nomes, onde o dono digita o
 * nome de cabeça, isso mataria a tela inteira.
 *
 * Sem número: copia o texto e abre o WhatsApp. Ele escolhe o contato na agenda
 * dele — gesto que faz cinquenta vezes por dia, e que ninguém precisa ensinar.
 */
export function AcaoConvite({
  texto,
  href,
  nome,
  aoAgir,
  variante = "escuro",
}: {
  texto: string;
  href: string | null;
  nome: string;
  aoAgir?: () => void;
  variante?: "escuro" | "claro";
}) {
  const [copiado, setCopiado] = useState(false);

  const cor =
    variante === "escuro"
      ? "border-amber/40 text-amber hover:bg-amber/10"
      : "border-paper-line text-paper-ink hover:border-amber";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Clipboard bloqueado (contexto inseguro, permissão negada). O texto está
      // visível na tela logo acima — dá para selecionar na mão. Falhar em
      // silêncio aqui é melhor do que um alerta que trava o WhatsApp Web.
      setCopiado(false);
    }
    aoAgir?.();
  };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={aoAgir}
        className={`mt-3 inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${cor}`}
      >
        Mandar para {nome || "esse cliente"} no WhatsApp
      </a>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={copiar}
        className={`inline-flex flex-1 items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${cor}`}
      >
        {copiado ? "Copiado — agora é só colar" : "Copiar a mensagem"}
      </button>
      <a
        href="https://wa.me/"
        target="_blank"
        rel="noopener noreferrer"
        onClick={aoAgir}
        className={`inline-flex items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${cor}`}
      >
        Abrir WhatsApp
      </a>
    </div>
  );
}
