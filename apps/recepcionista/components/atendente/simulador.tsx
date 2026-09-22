"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MINUTOS_SEM_RESPOSTA } from "@/lib/atendente/constantes";
import type { Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";

/**
 * PASSO 3 — TESTAR E LIGAR.
 *
 * Um WhatsApp na tela, rodando o mesmo motor que vai atender os clientes, com
 * os dados de verdade: horários livres, preços, endereço. Nada é enviado e nada
 * é marcado. Cada resposta diz de onde veio o que ela afirma.
 *
 * O "Ligar no meu WhatsApp" aparece depois do primeiro teste. Sem WhatsApp
 * ligado, o botão abre a conexão e liga em seguida; sem acesso, a recusa vira o
 * botão que resolve.
 */

type Mensagem = { de: "cliente" | "atendente"; texto: string; fontes?: string[] };
type Recusa = { error: string; acao: { texto: string; href: string } };

const SUGESTOES = ["Tem horário amanhã?", "Quanto custa?", "Onde fica?", "Vocês abrem domingo?"];
/** O ritmo do WhatsApp de verdade: uma bolha por vez. */
const PAUSA_ENTRE_BOLHAS_MS = 700;

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export function Simulador({
  tela,
  nome,
  jeito,
  aoMudarTela,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  aoMudarTela: (tela: TelaDoAtendente) => void;
}) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [estado, setEstado] = useState<{ tipo?: string } | null>(null);
  const [entrada, setEntrada] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [erro, setErro] = useState("");
  const [testado, setTestado] = useState(tela.testado);
  const [marcouNoTeste, setMarcouNoTeste] = useState<string | null>(null);
  const [respostasLivres, setRespostasLivres] = useState(tela.respostasLivres);
  const [contexto, setContexto] = useState(tela.contextoAgora);
  const [ligando, setLigando] = useState(false);
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [conectando, setConectando] = useState(false);
  const rolagem = useRef<HTMLDivElement>(null);

  const quem = nome.trim() || "O Atendente";
  /** No meio da frase: o nome, ou só "ele". */
  const ele = nome.trim() || "ele";

  useEffect(() => {
    rolagem.current?.scrollTo({ top: rolagem.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, digitando]);

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || digitando) return;
    const historico: Mensagem[] = [...mensagens, { de: "cliente", texto: limpo }];
    setMensagens(historico);
    setEntrada("");
    setErro("");
    setDigitando(true);
    try {
      const r = await fetch("/api/atendente/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: historico.slice(-30).map(({ de, texto: t }) => ({ de, texto: t })),
          estado,
          nome,
          jeito,
          marcaDireto: tela.marcaDireto,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) {
        setErro(j?.error ?? "O teste não rodou agora. Tente de novo em instantes.");
        return;
      }
      const respostas: string[] = j.mensagens ?? [];
      for (let i = 0; i < respostas.length; i++) {
        if (i > 0) await esperar(PAUSA_ENTRE_BOLHAS_MS);
        const ultima = i === respostas.length - 1;
        setMensagens((m) => [...m, { de: "atendente", texto: respostas[i], fontes: ultima ? j.fontes : undefined }]);
      }
      setEstado(j.estado ?? null);
      setRespostasLivres(Boolean(j.respostasLivres));
      setContexto(j.contexto === "EXPEDIENTE" ? "EXPEDIENTE" : "FECHADO");
      setMarcouNoTeste(j.marcou?.quando ?? null);
      setTestado(true);
    } catch {
      setErro("O teste não rodou agora. Confira a sua internet e tente de novo.");
    } finally {
      setDigitando(false);
    }
  }

  function recomecar() {
    setMensagens([]);
    setEstado(null);
    setMarcouNoTeste(null);
    setErro("");
  }

  async function ligar() {
    setLigando(true);
    setRecusa(null);
    setErro("");
    try {
      const r = await fetch("/api/atendente/ligar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligar: true }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j) {
        aoMudarTela(j);
        return;
      }
      if (r.status === 409 && j?.faltando === "WHATSAPP") {
        setConectando(true);
        return;
      }
      if (r.status === 402 && j?.acao?.href) {
        setRecusa({ error: j.error, acao: j.acao });
        return;
      }
      setErro(j?.error ?? "Não consegui ligar agora. Tente de novo em instantes.");
    } catch {
      setErro("Não consegui ligar agora. Confira a sua internet e tente de novo.");
    } finally {
      setLigando(false);
    }
  }

  // O modal refaz a conexão quando o callback muda: por isso os dois são
  // estáveis, e o "ligar" mais recente é lido por referência.
  const ligarAgora = useRef(ligar);
  ligarAgora.current = ligar;
  const fecharConexao = useCallback(() => setConectando(false), []);
  const conectou = useCallback(() => {
    setConectando(false);
    void ligarAgora.current();
  }, []);

  // Depois de uma oferta, a sugestão é responder com o número — é assim que ele marca.
  const sugestoes =
    estado?.tipo === "HORARIO" ? ["2", ...SUGESTOES.slice(1)] : estado?.tipo === "SERVICO" ? ["1", ...SUGESTOES.slice(1)] : SUGESTOES;

  return (
    <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,24rem)_1fr]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              disabled={digitando}
              onClick={() => enviar(s)}
              className="rounded-full border border-panel-line bg-panel-card px-3 py-1.5 text-sm text-panel-ink transition hover:border-amber disabled:opacity-50"
            >
              {s.length === 1 ? `Responder “${s}”` : s}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-[2rem] border-4 border-night bg-wa-frame shadow-xl">
          <div className="flex items-center gap-3 bg-night-soft px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber font-display font-bold text-night">
              {tela.empresa.trim().charAt(0).toUpperCase() || "N"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-mist">{tela.empresa}</p>
              <p className="text-xs text-mist/60">{digitando ? "digitando…" : "WhatsApp de teste"}</p>
            </div>
          </div>

          <div ref={rolagem} className="h-[26rem] space-y-2 overflow-y-auto px-3 py-4" aria-live="polite">
            {mensagens.length === 0 && (
              <p className="mx-auto mt-24 max-w-[16rem] text-center text-sm text-mist/60">
                Escreva como se fosse um cliente, ou escolha uma sugestão.
              </p>
            )}
            {mensagens.map((m, i) => (
              <div key={i} className={m.de === "cliente" ? "flex justify-start" : "flex flex-col items-end"}>
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-snug text-mist ${
                    m.de === "cliente" ? "rounded-tl-sm bg-wa-in" : "rounded-tr-sm bg-wa-out"
                  }`}
                >
                  {m.texto}
                </p>
                {m.fontes && m.fontes.length > 0 && (
                  <p className="mt-1 max-w-[85%] text-right text-[10px] leading-tight text-mist/50">
                    De onde veio: {m.fontes.join(" · ")}
                  </p>
                )}
              </div>
            ))}
            {digitando && (
              <div className="flex justify-end">
                <span className="rounded-2xl rounded-tr-sm bg-wa-out px-3 py-2 text-xs text-mist/70">digitando…</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(entrada);
            }}
            className="flex items-center gap-2 bg-night-soft px-3 py-3"
          >
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              maxLength={500}
              placeholder="Escreva como um cliente…"
              aria-label="Mensagem de teste"
              className="min-w-0 flex-1 rounded-full bg-wa-in px-4 py-2 text-sm text-mist placeholder:text-mist/40 focus:outline-none focus:ring-2 focus:ring-amber"
            />
            <button
              type="submit"
              disabled={digitando || !entrada.trim()}
              className="rounded-full bg-amber px-4 py-2 text-sm font-bold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </div>

        {mensagens.length > 0 && (
          <button
            type="button"
            onClick={recomecar}
            className="mt-3 text-xs font-semibold text-panel-sub hover:text-panel-ink"
          >
            Começar a conversa de novo
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
          <h2 className="font-display text-lg text-panel-ink">Teste como um cliente</h2>
          <p className="mt-1 text-sm text-panel-sub">
            {contexto === "FECHADO"
              ? `Agora a loja está fechada: é exatamente assim que ${ele} responde.`
              : `Agora a loja está aberta: é assim que ${ele} responde quando ninguém responde em ${MINUTOS_SEM_RESPOSTA} minutos.`}{" "}
            Nada sai para ninguém e nada é marcado de verdade.
          </p>
          {!respostasLivres && (
            <p className="mt-3 rounded-xl bg-panel-bg px-3 py-2 text-xs text-panel-sub">
              Neste momento, pergunta fora do seu cadastro fica anotada para você responder. Horários, preços, endereço e
              marcação funcionam normalmente.
            </p>
          )}
          {marcouNoTeste && (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              No teste, nada foi marcado. De verdade, {marcouNoTeste} entraria na sua agenda na hora, e o cliente
              receberia essa confirmação.
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {erro}
            </p>
          )}
        </div>

        {tela.ligado ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-800">{quem} já está ligado no seu WhatsApp.</p>
            <p className="mt-1 text-sm text-emerald-800/80">O que você ajustou aqui já vale nas próximas conversas.</p>
          </div>
        ) : testado ? (
          <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
            <h2 className="font-display text-lg text-panel-ink">Pronto para ligar?</h2>
            <p className="mt-1 text-sm text-panel-sub">{tela.uso.texto}</p>
            {!tela.whatsappLigado && (
              <p className="mt-2 text-sm text-panel-sub">
                Primeiro você liga o seu WhatsApp, por código ou QR Code, e {ele} entra
                em seguida.
              </p>
            )}
            {recusa ? (
              <div className="mt-4 rounded-xl border border-amber/50 bg-panel-card p-4">
                <p className="text-sm text-panel-ink">{recusa.error}</p>
                <Link
                  href={recusa.acao.href}
                  className="mt-3 inline-block rounded-xl bg-amber px-5 py-3 text-sm font-bold text-night transition hover:brightness-110"
                >
                  {recusa.acao.texto}
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={ligar}
                disabled={ligando}
                className="mt-4 w-full rounded-xl bg-amber px-6 py-3.5 text-base font-bold text-night shadow-sm transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
              >
                {ligando ? "Ligando…" : "Ligar no meu WhatsApp"}
              </button>
            )}
            <p className="mt-4 text-xs leading-relaxed text-panel-sub">
              Uma coisa que você precisa saber: a conexão por QR Code não é a oficial do WhatsApp, e números podem ser
              restringidos. O Atendente só responde quem escreveu primeiro e nunca manda mensagem sozinho —
              isso reduz o risco, mas não zera.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-panel-line p-5">
            <p className="text-sm text-panel-sub">
              Faça pelo menos um teste ao lado. O botão para ligar no seu WhatsApp aparece depois dele.
            </p>
          </div>
        )}
      </div>

      <ModalConectarWhatsApp aberto={conectando} aoFechar={fecharConexao} aoConectar={conectou} />
    </section>
  );
}
