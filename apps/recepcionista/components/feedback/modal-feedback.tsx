"use client";

import { useState } from "react";
import type { CategoriaFeedback } from "@/lib/feedback/tipos";
import { EMAIL_FEEDBACK } from "@/lib/feedback/servico";

type ModalFeedbackProps = {
  aberto: boolean;
  onFechar: () => void;
  emailPadrao?: string;
  telefonePadrao?: string;
  nomePadrao?: string;
};

const CATEGORIAS: { id: CategoriaFeedback; label: string; icone: string }[] = [
  { id: "sugestao", label: "Sugestão / Ideia", icone: "💡" },
  { id: "problema", label: "Dificuldade / Bug", icone: "⚠️" },
  { id: "duvida", label: "Dúvida", icone: "💬" },
  { id: "elogio", label: "Elogio", icone: "❤️" },
  { id: "outro", label: "Outro", icone: "✏️" },
];

const LEGENDA_ESTRELAS: Record<number, string> = {
  1: "Precisa melhorar muito",
  2: "Abaixo do esperado",
  3: "Regular / Neutro",
  4: "Muito bom",
  5: "Excelente / Incrível",
};

export function ModalFeedback({
  aberto,
  onFechar,
  emailPadrao = "",
  telefonePadrao = "",
  nomePadrao = "",
}: ModalFeedbackProps) {
  const [rating, setRating] = useState<number>(5);
  const [categoria, setCategoria] = useState<CategoriaFeedback>("sugestao");
  const [mensagem, setMensagem] = useState("");
  const [email, setEmail] = useState(emailPadrao);
  const [whatsapp, setWhatsapp] = useState(telefonePadrao);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!aberto) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mensagem.trim().length < 3) {
      setErro("Por favor, escreva sua mensagem com pelo menos 3 caracteres.");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          categoria,
          mensagem: mensagem.trim(),
          email: email.trim() || emailPadrao,
          whatsapp: whatsapp.trim() || telefonePadrao,
          nomeCliente: nomePadrao,
          pagina: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.erro || "Falha ao enviar feedback.");
      }

      setSucesso(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro de conexão ao enviar.";
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  function handleResetEFechar() {
    setSucesso(false);
    setMensagem("");
    setErro(null);
    onFechar();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        onClick={handleResetEFechar}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Conteúdo do Modal */}
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-800 bg-[#121217] p-6 shadow-2xl text-gray-100 z-10 my-auto">
        <button
          type="button"
          onClick={handleResetEFechar}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          aria-label="Fechar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {sucesso ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-2xl">
              ✓
            </div>
            <h3 className="text-xl font-bold text-white">Muito obrigado pelo seu feedback!</h3>
            <p className="text-sm text-gray-300 max-w-sm mx-auto leading-relaxed">
              Sua mensagem foi enviada diretamente aos fundadores da Nexora (
              <span className="text-amber-400 font-mono text-xs">{EMAIL_FEEDBACK}</span>). Vamos
              analisá-la com carinho para melhorar a ferramenta para o seu negócio.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={handleResetEFechar}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 font-bold text-gray-950 hover:bg-amber-300 transition"
              >
                Concluir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 text-xs font-black text-gray-950">
                  N
                </span>
                <h3 id="feedback-titulo" className="text-lg font-bold text-white">
                  O que podemos melhorar na Nexora?
                </h3>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Sua sugestão ou crítica chega direto na caixa de entrada dos fundadores.
              </p>
            </div>

            {/* Avaliação em Estrelas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Sua experiência geral com a plataforma
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((nota) => (
                  <button
                    key={nota}
                    type="button"
                    onClick={() => setRating(nota)}
                    className="p-1 text-2xl transition hover:scale-125 focus:outline-none"
                    aria-label={`Avaliar com ${nota} estrelas`}
                  >
                    <span className={nota <= rating ? "text-amber-400" : "text-gray-600"}>
                      ★
                    </span>
                  </button>
                ))}
                <span className="ml-2 text-xs font-medium text-amber-300/90">
                  {LEGENDA_ESTRELAS[rating]}
                </span>
              </div>
            </div>

            {/* Chips de Categoria */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Tipo de Feedback
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map((cat) => {
                  const ativa = categoria === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoria(cat.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition border ${
                        ativa
                          ? "bg-amber-400/15 border-amber-400/60 text-amber-300"
                          : "bg-gray-800/60 border-gray-700/60 text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <span>{cat.icone}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo de Mensagem */}
            <div className="space-y-1.5">
              <label htmlFor="feedback-mensagem" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Sua Mensagem <span className="text-amber-400">*</span>
              </label>
              <textarea
                id="feedback-mensagem"
                rows={4}
                required
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Conte com detalhes o que você achou, o que você sente falta ou qual problema você enfrentou..."
                className="w-full rounded-xl border border-gray-700 bg-gray-900/90 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
              />
            </div>

            {/* Contato para Resposta */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="feedback-email" className="block text-xs text-gray-400">
                  Seu E-mail (para podermos responder)
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="feedback-whatsapp" className="block text-xs text-gray-400">
                  WhatsApp (opcional)
                </label>
                <input
                  id="feedback-whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {erro && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400">
                {erro}
              </div>
            )}

            {/* Rodapé e Envio */}
            <div className="pt-2 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <a
                href={`mailto:${EMAIL_FEEDBACK}?subject=Feedback%20Nexora`}
                className="text-xs text-gray-400 hover:text-amber-300 transition"
              >
                Escrever direto por e-mail →
              </a>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleResetEFechar}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando || mensagem.trim().length < 3}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {enviando ? "Enviando..." : "Enviar Feedback"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
