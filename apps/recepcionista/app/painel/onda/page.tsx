"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { deveSilenciar, MOTIVOS_PULO, rotuloDoMotivo } from "@/lib/recuperacao/pulo";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";
import { NOME_DA_ESTEIRA } from "@/lib/recuperacao/esteiras";
import { CartaoDaOferta } from "@/components/cobranca/cartao-da-oferta";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";

/**
 * A ONDA DE SEGUNDA
 *
 * Doze clientes, ~9 minutos. É o loop que forma o hábito: gatilho fixo (segunda
 * de manhã), ação curta, recompensa variável real (quem volta e quanto paga) e
 * investimento em um gesto (dizer o que aconteceu).
 *
 * Regra Zero: nenhum cartão mostra informação sem uma ação executável junto —
 * e isso vale para a recusa por assinatura, que vem do servidor com o botão de
 * resolver e antes era jogada fora.
 */

type Card = {
  id: string;
  clienteId: string;
  nome: string;
  telefone: string;
  esteira: "PRE_ATRASO" | "ATRASO" | "RESGATE" | "EM_DIA";
  diasDesdeUltima: number;
  cicloDias: number;
  confianca: "alta" | "baixa";
  porque: string;
  ticketMedioCents: number;
  valorCents: number;
  toque: number;
  mensagem: string;
  mensagens?: Record<number, string>;
};

type Vazio = {
  motivo: "SEM_BASE" | "TODOS_OPT_OUT" | "SEQUENCIA_ESGOTADA" | "NINGUEM_ATRASADO";
  titulo: string;
  explicacao: string;
  acao: { texto: string; href: string };
};

type Pendente = {
  id: string;
  clienteId: string;
  nome: string;
  toqueNumero: number;
  esteira: string;
  ticketMedioCents: number;
  enviadoEm: string;
};

type Onda = {
  cards: Card[];
  totalEmJogoCents: number;
  composicao: Record<string, number>;
  vazio: Vazio | null;
  /** Contatos de semanas anteriores em que o dono ainda não disse o que houve. */
  perguntar?: Pendente[];
  /** A primeira Onda por nossa conta, quando a conta está sem plano. */
  primeiraOnda?: { enviadas: number; ate: string | null; total: number } | null;
};

/** A recusa que o servidor manda quando a assinatura não cobre a ação. */
type Recusa = {
  motivo: string;
  acao: { texto: string; href: string };
  /** A conta da lista do dono, quando ele ainda pode escolher um plano. */
  oferta?: import("@/lib/billing/oferta").Oferta | null;
  /** Marcar nunca trava: os contatos que esperam resposta vêm junto da recusa. */
  perguntar?: Pendente[];
};

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_ESTEIRA: Record<string, { texto: string; classe: string }> = {
  PRE_ATRASO: { texto: NOME_DA_ESTEIRA.PRE_ATRASO, classe: "bg-amber/20 text-[#7A5A10]" },
  ATRASO: { texto: NOME_DA_ESTEIRA.ATRASO, classe: "bg-amber/15 text-amber-deep" },
  RESGATE: { texto: NOME_DA_ESTEIRA.RESGATE, classe: "bg-panel-line text-panel-sub" },
};

const ROTULOS_MENSAGEM: Record<number, { titulo: string; desc: string }> = {
  1: { titulo: "1ª Opção", desc: "Saudade" },
  2: { titulo: "2ª Opção", desc: "Horário" },
  3: { titulo: "3ª Opção", desc: "Agendar" },
  4: { titulo: "4ª Opção", desc: "Despedida" },
};

function textoAtivoDoCard(card: Card, toqueSelecionado?: number): string {
  const t = toqueSelecionado ?? card.toque;
  return card.mensagens?.[t] ?? card.mensagem;
}

/**
 * O gesto em um clique: abre a conversa com a mensagem já escrita.
 *
 * Precisa do número com o 55 na frente, que é o formato que o wa.me exige.
 * `variantesDeTelefone` já resolve as três grafias que convivem na base do
 * dono (com país, sem país, com e sem o nono dígito). Sem número reconhecível,
 * o botão simplesmente não aparece — link quebrado é pior que ausência.
 */
function linkDoWhatsApp(card: Card, textoCustom?: string): string | null {
  const comPais = variantesDeTelefone(card.telefone).find(
    (v) => v.startsWith("55") && v.length >= 12,
  );
  if (!comPais) return null;
  const texto = textoCustom ?? card.mensagem;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

/**
 * QUEM DESSA LISTA APARECEU?
 *
 * Os contatos de semanas anteriores em que o dono ainda não disse o que houve.
 * Marcar nunca trava (MARCAR_RESULTADO): a lista aparece com a Onda e também
 * embaixo da oferta, depois da parede — senão a primeira Onda mostraria
 * "ninguém respondeu" para quem só não teve onde marcar.
 */
function QuemApareceu({
  pendentes,
  aoMarcar,
}: {
  pendentes: Pendente[];
  aoMarcar: (p: Pendente, resultado: string, extra?: Record<string, unknown>) => void;
}) {
  if (pendentes.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber/40 bg-amber/10 p-4">
      <h2 className="font-semibold text-panel-ink">Quem dessa lista apareceu?</h2>
      <p className="mt-1 text-sm text-panel-sub">
        Só entra em Dinheiro recuperado o que você disser aqui. Pode deixar para depois —
        volto a perguntar.
      </p>

      <ul className="mt-4 space-y-2">
        {pendentes.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-panel-line bg-panel-card px-4 py-3"
          >
            <span className="font-medium text-panel-ink">{p.nome}</span>
            <span className="text-xs text-panel-sub">
              faz {Math.floor((Date.now() - new Date(p.enviadoEm).getTime()) / 86_400_000)} dias
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => aoMarcar(p, "VOLTOU", { valorCents: p.ticketMedioCents })}
                className="rounded-lg border border-amber/40 px-3 py-1.5 text-sm text-amber-deep hover:bg-amber/10"
              >
                Voltou{p.ticketMedioCents > 0 ? ` (${reais(p.ticketMedioCents)})` : ""}
              </button>
              <button
                type="button"
                onClick={() => aoMarcar(p, "SEM_RESPOSTA")}
                className="rounded-lg border border-panel-line px-3 py-1.5 text-sm text-panel-sub hover:text-panel-ink"
              >
                Não veio
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PaginaOnda() {
  // Quem chega do diagnóstico acabou de ver os próprios clientes sumidos e
  // criou a conta por causa disso. Cair numa tela igual à de sempre quebra a
  // promessa que a página de venda acabou de fazer.
  const [vindoDoDiagnostico, setVindoDoDiagnostico] = useState(false);
  useEffect(() => {
    setVindoDoDiagnostico(
      new URLSearchParams(window.location.search).get("origem") === "diagnostico",
    );
  }, []);

  const [onda, setOnda] = useState<Onda | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recusa, setRecusa] = useState<Recusa | null>(null);
  const [feitos, setFeitos] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState("");
  const [pulando, setPulando] = useState("");
  const [toquesSelecionados, setToquesSelecionados] = useState<Record<string, number>>({});
  const [tamanhoLote, setTamanhoLote] = useState<12 | 25>(12);

  // Conexão direta do WhatsApp
  const [statusWhatsApp, setStatusWhatsApp] = useState<string>("DESLIGADO");
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false);
  const [enviandoDireto, setEnviandoDireto] = useState<string | null>(null);
  const [enviandoLote, setEnviandoLote] = useState(false);
  const [progressoLote, setProgressoLote] = useState<{ atual: number; total: number }>({ atual: 0, total: 0 });

  const checarWhatsApp = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) return;
      const data = await res.json();
      if (data.state?.status) {
        setStatusWhatsApp(data.state.status);
      }
    } catch {
      // Falhas silenciosas de rede
    }
  }, []);

  useEffect(() => {
    void checarWhatsApp();
  }, [checarWhatsApp]);

  const carregar = useCallback(async (tamanho = 12) => {
    setCarregando(true);
    setErro("");
    setRecusa(null);
    try {
      const res = await fetch(`/api/onda?tamanho=${tamanho}`);
      const json = await res.json();
      if (!res.ok) {
        // O servidor manda o motivo e o caminho para resolver. Achatar tudo em
        // "não consegui agora" deixava o dono bloqueado sem forma de pagar.
        if (json.acao?.href) {
          setRecusa({
            motivo: json.error ?? "",
            acao: json.acao,
            oferta: json.oferta ?? null,
            perguntar: json.perguntar ?? [],
          });
        }
        else setErro(json.error ?? "Não consegui montar sua lista agora. Tenta de novo?");
        return;
      }
      setOnda(json);
    } catch {
      setErro("Não consegui falar com a internet agora. Tenta de novo?");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(tamanhoLote);
  }, [carregar, tamanhoLote]);

  const trocarTamanho = (novoTamanho: 12 | 25) => {
    setTamanhoLote(novoTamanho);
    void carregar(novoTamanho);
  };

  const copiar = async (card: Card, texto: string) => {
    await navigator.clipboard.writeText(texto);
    setCopiado(card.id);
    window.setTimeout(() => setCopiado(""), 1600);
  };

  const marcar = async (card: Card, resultado: string, extra: Record<string, unknown> = {}) => {
    const toqueEfetivo = toquesSelecionados[card.id] ?? card.toque;
    const res = await fetch("/api/onda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: card.clienteId,
        toque: toqueEfetivo,
        esteira: card.esteira,
        resultado,
        ...extra,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      setFeitos((f) => ({ ...f, [card.id]: json.efeito }));
      setPulando("");
    }
  };

  /**
   * Envia a mensagem pelo WhatsApp ligado da empresa. Devolve false quando o lote
   * precisa parar: o WhatsApp caiu, ou a ação travou (a primeira Onda acabou no
   * meio) — e aí a tela recarrega e vira a parede, com o resultado da Onda.
   */
  const enviarDireto = async (card: Card): Promise<boolean> => {
    const toqueEfetivo = toquesSelecionados[card.id] ?? card.toque;
    const textoEfetivo = textoAtivoDoCard(card, toqueEfetivo);
    setEnviandoDireto(card.id);
    try {
      const res = await fetch("/api/onda/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: card.clienteId,
          toque: toqueEfetivo,
          esteira: card.esteira,
          mensagem: textoEfetivo,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.precisaConectar) {
          setModalWhatsAppAberto(true);
          return false;
        }
        if (res.status === 402) {
          void carregar(tamanhoLote);
          return false;
        }
        alert(json.error ?? "Não consegui enviar a mensagem agora. Tente novamente.");
        return true;
      }
      setFeitos((f) => ({ ...f, [card.id]: json.efeito }));
      return true;
    } catch {
      alert("Falha de conexão ao enviar a mensagem. Verifique sua internet.");
      return true;
    } finally {
      setEnviandoDireto(null);
    }
  };

  /** Disparo sequencial dos clientes restantes com pausa de segurança */
  const enviarRestantes = async () => {
    if (!onda) return;
    const pendentes = onda.cards.filter((c) => !feitos[c.id]);
    if (pendentes.length === 0) return;

    setEnviandoLote(true);
    setProgressoLote({ atual: 0, total: pendentes.length });

    for (let i = 0; i < pendentes.length; i++) {
      const card = pendentes[i];
      setProgressoLote({ atual: i + 1, total: pendentes.length });
      if (!(await enviarDireto(card))) break;
      // Pausa segura de 2,5 segundos entre envios para proteção do WhatsApp
      if (i < pendentes.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
    setEnviandoLote(false);
  };

  /**
   * Diz o que houve com um contato de SEMANAS ANTERIORES.
   *
   * Some da lista na hora, e não depois de recarregar: a pergunta "quem
   * apareceu?" só funciona se responder for instantâneo.
   */
  const marcarPendente = async (
    p: Pendente,
    resultado: string,
    extra: Record<string, unknown> = {},
  ) => {
    setOnda((atual) =>
      atual ? { ...atual, perguntar: (atual.perguntar ?? []).filter((x) => x.id !== p.id) } : atual,
    );
    // Depois da parede, a mesma pergunta mora embaixo da oferta.
    setRecusa((atual) =>
      atual ? { ...atual, perguntar: (atual.perguntar ?? []).filter((x) => x.id !== p.id) } : atual,
    );

    await fetch("/api/onda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: p.clienteId,
        toque: p.toqueNumero,
        esteira: p.esteira,
        resultado,
        ...extra,
      }),
    });
  };

  if (carregando) {
    return (
      <main className="p-6">
        <p className="text-panel-sub">Procurando quem sumiu…</p>
      </main>
    );
  }

  if (recusa) {
    return (
      <main className="max-w-2xl space-y-6 p-6">
        <CartaoDaOferta motivo={recusa.motivo} acao={recusa.acao} oferta={recusa.oferta ?? null} />
        {/* Marcar quem apareceu nunca trava: é assim que a parede mostra o que a Onda fez. */}
        <QuemApareceu pendentes={recusa.perguntar ?? []} aoMarcar={marcarPendente} />
      </main>
    );
  }

  if (erro || !onda) {
    return (
      <main className="max-w-2xl p-6">
        <p className="text-panel-sub">{erro || "Nada por aqui."}</p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="mt-4 rounded-xl border border-panel-line px-4 py-2.5 text-sm font-semibold transition hover:border-amber"
        >
          Tentar de novo
        </button>
      </main>
    );
  }

  const resolvidos = Object.keys(feitos).length;
  const total = onda.cards.length;
  const restantes = total - resolvidos;
  const whatsappLigado = statusWhatsApp === "CONNECTED";

  // Tela vazia honesta: encher a lista com cliente marginal mata a confiança na
  // primeira mensagem que o dono manda para alguém que esteve lá semana
  // passada. O motivo vem calculado do servidor, com a ação correspondente.
  if (total === 0) {
    const vazio = onda.vazio;
    return (
      <main className="max-w-2xl p-6">
        <h1 className="mb-2 font-display text-2xl text-panel-ink">Reativar clientes</h1>
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="font-semibold text-panel-ink">
            {vazio?.titulo ?? "Nenhum cliente para chamar agora."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-panel-sub">
            {vazio?.explicacao ??
              "Sua lista está em dia. Quando alguém passar do tempo de voltar, aparece aqui."}
          </p>
          {vazio?.acao && (
            <a
              href={vazio.acao.href}
              className="mt-4 inline-block rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-night transition hover:brightness-110"
            >
              {vazio.acao.texto}
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl space-y-6 p-6">
      {/* Modal de Conexão do WhatsApp */}
      <ModalConectarWhatsApp
        aberto={modalWhatsAppAberto}
        aoFechar={() => setModalWhatsAppAberto(false)}
        aoConectar={() => {
          setStatusWhatsApp("CONNECTED");
          setModalWhatsAppAberto(false);
        }}
      />

      {vindoDoDiagnostico && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-4">
          <p className="font-semibold text-panel-ink">
            Aqui estão os primeiros {total} clientes que o diagnóstico encontrou.
          </p>
          <p className="mt-1 text-sm text-panel-sub">
            A mensagem já está escrita com o que cada um costuma fazer aí. Você pode enviar
            pelo seu WhatsApp ligado ou abrir a conversa e mandar de lá.
          </p>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-panel-ink">Reativar clientes</h1>
          <p className="text-sm text-panel-sub">
            Pessoas que já compraram de você e já passou o tempo que ele mesmo costuma demorar para voltar.
          </p>
          <p className="mt-1 text-xs text-panel-sub">
            {resolvidos} de {total} resolvidos hoje.
          </p>
        </div>

        {/* Seletor de Tamanho do Lote — a primeira Onda por nossa conta tem o tamanho padrão. */}
        {!onda.primeiraOnda && (
          <div className="flex items-center gap-1.5 rounded-xl border border-panel-line bg-panel-card p-1">
            <button
              type="button"
              onClick={() => trocarTamanho(12)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tamanhoLote === 12
                  ? "bg-amber font-semibold text-night shadow-sm"
                  : "text-panel-sub hover:text-panel-ink"
              }`}
            >
              Lote padrão (12)
            </button>
            <button
              type="button"
              onClick={() => trocarTamanho(25)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tamanhoLote === 25
                  ? "bg-amber font-semibold text-night shadow-sm"
                  : "text-panel-sub hover:text-panel-ink"
              }`}
            >
              Lote expandido (25)
            </button>
          </div>
        )}
      </header>

      {/* Barra de Status e Conexão do WhatsApp */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${
        whatsappLigado
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber/30 bg-amber/10"
      }`}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
            {whatsappLigado ? "🟢" : "📱"}
          </span>
          <div>
            <p className="text-sm font-semibold text-panel-ink">
              {whatsappLigado ? "Seu WhatsApp está ligado" : "Ligue seu WhatsApp na Nexora"}
            </p>
            <p className="text-xs text-panel-sub">
              {whatsappLigado
                ? "As mensagens saem pelo número do seu negócio, uma de cada vez."
                : "Ligue pelo QR Code e mande daqui, sem abrir uma conversa por vez."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {whatsappLigado ? (
            <>
              <Link
                href="/painel/configuracoes"
                className="rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/10"
              >
                Ver conexão
              </Link>
              {restantes > 1 && (
                <button
                  type="button"
                  disabled={enviandoLote}
                  onClick={enviarRestantes}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 font-display text-xs font-bold text-night transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {enviandoLote ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-night border-t-transparent" />
                      <span>Enviando {progressoLote.atual} de {progressoLote.total}...</span>
                    </>
                  ) : (
                    <>Enviar as restantes ({restantes})</>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalWhatsAppAberto(true)}
                className="rounded-xl bg-amber px-4 py-2 font-display text-xs font-bold text-night transition hover:brightness-110"
              >
                Escanear QR Code
              </button>
              <Link
                href="/painel/configuracoes"
                className="rounded-xl border border-amber/30 px-3 py-2 font-display text-xs font-medium text-panel-sub transition hover:text-panel-ink"
              >
                Tela completa
              </Link>
            </div>
          )}
        </div>
      </div>

      {onda.totalEmJogoCents > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50/40 p-3 text-xs text-emerald-950">
          <span className="text-base">💰</span>
          <span>
            Juntas, essas pessoas costumam gastar{" "}
            <strong className="font-bold text-emerald-900">{reais(onda.totalEmJogoCents)}</strong> por visita.
          </span>
        </div>
      )}

      {/* PENDENTES DE SEMANAS ANTERIORES */}
      <QuemApareceu pendentes={onda.perguntar ?? []} aoMarcar={marcarPendente} />

      <div className="space-y-3">
        {onda.cards.map((card) => {
          const feito = feitos[card.id];
          const rotulo = ROTULO_ESTEIRA[card.esteira];
          const toqueAtivo = toquesSelecionados[card.id] ?? card.toque;
          const texto = textoAtivoDoCard(card, toqueAtivo);
          const zap = linkDoWhatsApp(card, texto);
          const enviandoEste = enviandoDireto === card.id;

          return (
            <article
              key={card.id}
              className={`rounded-2xl border bg-panel-card p-5 transition ${
                feito ? "border-emerald-500/40 opacity-75" : "border-panel-line"
              }`}
            >
              {/* Topo do cartão: Identificação e Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-line/50 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-base text-panel-ink">{card.nome}</h2>
                  <span className="text-xs text-panel-sub">{card.telefone}</span>
                </div>
                <div className="flex items-center gap-2">
                  {rotulo ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rotulo.classe}`}>
                      {rotulo.texto}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-panel-bg border border-panel-line px-2.5 py-0.5 text-xs text-panel-sub">
                    {card.toque}ª mensagem
                  </span>
                </div>
              </div>

              {/* Informação direta sobre a ausência */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-panel-sub">
                <span className="font-medium text-panel-ink">
                  Última visita há {card.diasDesdeUltima} dias
                </span>
                {card.cicloDias > 0 && card.confianca === "alta" && (
                  <span>• Costuma voltar a cada {card.cicloDias} dias</span>
                )}
                {card.valorCents > 0 && (
                  <span>• Gasto médio: {reais(card.valorCents)}</span>
                )}
              </div>

              {feito ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <span>✓</span>
                  <span>{feito}</span>
                </div>
              ) : pulando === card.id ? (
                <div className="mt-4 rounded-xl border border-panel-line bg-panel-bg p-4">
                  <p className="text-xs leading-relaxed text-panel-sub">
                    Por que não quer chamar? Menos o último, todos estes motivos tiram essa
                    pessoa da sua lista <strong className="font-semibold">para sempre</strong> —
                    ela nunca mais vai aparecer aqui, e não tem como desfazer.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MOTIVOS_PULO.map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => marcar(card, "PULADO", { motivoPulo: valor })}
                        className="rounded-lg border border-panel-line bg-white px-3 py-1.5 text-xs text-panel-sub hover:border-red-300 hover:text-red-600 transition"
                      >
                        {rotuloDoMotivo(valor)}
                        {deveSilenciar(valor) && (
                          <span className="ml-1 text-[10px] text-panel-sub">(nunca mais)</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPulando("")}
                    className="mt-3 text-xs text-panel-sub hover:text-panel-ink underline"
                  >
                    Voltar
                  </button>
                </div>
              ) : (
                <>
                  {/* Mensagem pronta estilo WhatsApp */}
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-panel-ink flex items-center gap-1.5">
                        <span className="text-emerald-600">💬</span> Mensagem pronta:
                      </span>
                      {card.mensagens && Object.keys(card.mensagens).length > 1 && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4].map((num) => {
                            if (!card.mensagens?.[num]) return null;
                            const isSelecionado = toqueAtivo === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setToquesSelecionados((ts) => ({ ...ts, [card.id]: num }))}
                                className={`rounded-lg px-2.5 py-1 text-xs transition ${
                                  isSelecionado
                                    ? "bg-amber text-night font-bold shadow-xs"
                                    : "bg-panel-bg text-panel-sub hover:text-panel-ink border border-panel-line"
                                }`}
                              >
                                {ROTULOS_MENSAGEM[num]?.desc ?? `${num}ª`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/25 p-4 text-sm leading-relaxed text-panel-ink shadow-xs">
                      <p className="whitespace-pre-wrap">{texto}</p>
                    </div>
                  </div>

                  {/* Barra de Ações: Clara, sem conflito visual */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-panel-line/60 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Ação Primária: Enviar */}
                      {whatsappLigado ? (
                        <button
                          type="button"
                          disabled={enviandoEste || enviandoLote}
                          onClick={() => enviarDireto(card)}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-bold text-night transition shadow-sm disabled:opacity-50"
                        >
                          {enviandoEste ? (
                            <>
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                              <span>Enviando pelo seu WhatsApp...</span>
                            </>
                          ) : (
                            <>
                              <span>⚡</span>
                              <span>Enviar mensagem de recuperação</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          {zap ? (
                            <a
                              href={zap}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => marcar(card, "AGUARDANDO")}
                              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] px-4 py-2.5 text-sm font-bold text-white transition shadow-sm"
                            >
                              <span>💬</span>
                              <span>Chamar no WhatsApp</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setModalWhatsAppAberto(true)}
                              className="inline-flex items-center gap-2 rounded-xl bg-amber hover:brightness-110 px-4 py-2.5 text-sm font-bold text-night transition shadow-sm"
                            >
                              <span>⚡</span>
                              <span>Enviar mensagem de recuperação</span>
                            </button>
                          )}
                        </>
                      )}

                      {/* Botão Copiar */}
                      <button
                        type="button"
                        onClick={() => copiar(card, texto)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-panel-line bg-white px-3 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink hover:border-panel-sub transition"
                        title="Copiar texto da mensagem"
                      >
                        <span>📋</span>
                        <span>{copiado === card.id ? "Copiado ✓" : "Copiar mensagem"}</span>
                      </button>

                      {/* Se WhatsApp conectado, também permite abrir a conversa manualmente se quiser */}
                      {whatsappLigado && zap && (
                        <a
                          href={zap}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => marcar(card, "AGUARDANDO")}
                          className="inline-flex items-center gap-1 rounded-xl border border-panel-line bg-white px-3 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink hover:border-panel-sub transition"
                          title="Abrir no aplicativo do WhatsApp"
                        >
                          <span>💬</span>
                          <span>Abrir conversa no WhatsApp</span>
                        </a>
                      )}
                    </div>

                    {/* Ações Secundárias / Exceções */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-panel-sub">
                      <button
                        type="button"
                        onClick={() => marcar(card, "AGUARDANDO")}
                        className="hover:text-panel-ink hover:underline transition"
                        title="Marcar como enviada manualmente"
                      >
                        Já mandei
                      </button>

                      <button
                        type="button"
                        onClick={() => marcar(card, "VOLTOU", { valorCents: card.ticketMedioCents })}
                        className="hover:text-amber-deep hover:underline transition"
                        title="Marcar que o cliente já retornou"
                      >
                        Voltou ({reais(card.ticketMedioCents)})
                      </button>

                      <button
                        type="button"
                        onClick={() => setPulando(card.id)}
                        className="text-panel-sub hover:text-red-600 transition"
                      >
                        Não quero chamar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <footer className="rounded-2xl border border-panel-line bg-panel-card p-4">
        <h3 className="mb-1 text-sm font-semibold text-panel-ink">
          Por que só {total} e não a minha lista inteira?
        </h3>
        <p className="text-sm leading-relaxed text-panel-sub">
          O WhatsApp protege números que não disparam em massa, e você atende com calma quem responder hoje. Quem não entrar hoje volta nas próximas semanas.
        </p>
      </footer>
    </main>
  );
}
