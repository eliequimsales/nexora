"use client";

import { useCallback, useEffect, useState } from "react";
import { deveSilenciar, MOTIVOS_PULO, rotuloDoMotivo } from "@/lib/recuperacao/pulo";
import { variantesDeTelefone } from "@/lib/recuperacao/telefone";

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
};

/** A recusa que o servidor manda quando a assinatura não cobre a ação. */
type Recusa = { motivo: string; acao: { texto: string; href: string } };

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_ESTEIRA: Record<string, { texto: string; classe: string }> = {
  PRE_ATRASO: { texto: "Prestes a sumir", classe: "bg-amber/20 text-[#7A5A10]" },
  ATRASO: { texto: "Atrasado", classe: "bg-amber/15 text-amber-deep" },
  RESGATE: { texto: "Sumido há muito", classe: "bg-panel-line text-panel-sub" },
};

/**
 * O gesto em um clique: abre a conversa com a mensagem já escrita.
 *
 * Precisa do número com o 55 na frente, que é o formato que o wa.me exige.
 * `variantesDeTelefone` já resolve as três grafias que convivem na base do
 * dono (com país, sem país, com e sem o nono dígito). Sem número reconhecível,
 * o botão simplesmente não aparece — link quebrado é pior que ausência.
 */
function linkDoWhatsApp(card: Card): string | null {
  const comPais = variantesDeTelefone(card.telefone).find(
    (v) => v.startsWith("55") && v.length >= 12,
  );
  if (!comPais) return null;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(card.mensagem)}`;
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setRecusa(null);
    try {
      const res = await fetch("/api/onda");
      const json = await res.json();
      if (!res.ok) {
        // O servidor manda o motivo e o caminho para resolver. Achatar tudo em
        // "não consegui agora" deixava o dono bloqueado sem forma de pagar.
        if (json.acao?.href) setRecusa({ motivo: json.error ?? "", acao: json.acao });
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
    void carregar();
  }, [carregar]);

  const copiar = async (card: Card) => {
    await navigator.clipboard.writeText(card.mensagem);
    setCopiado(card.id);
    window.setTimeout(() => setCopiado(""), 1600);
  };

  const marcar = async (card: Card, resultado: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch("/api/onda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: card.clienteId,
        toque: card.toque,
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
      <main className="max-w-2xl p-6">
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-6">
          <p className="text-panel-ink">{recusa.motivo}</p>
          <a
            href={recusa.acao.href}
            className="mt-4 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            {recusa.acao.texto}
          </a>
        </div>
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

  // Tela vazia honesta: encher a lista com cliente marginal mata a confiança na
  // primeira mensagem que o dono manda para alguém que esteve lá semana
  // passada. O motivo vem calculado do servidor, com a ação correspondente.
  if (total === 0) {
    const vazio = onda.vazio;
    return (
      <main className="max-w-2xl p-6">
        <h1 className="mb-2 font-display text-2xl text-panel-ink">Reativar clientes</h1>
        <div className="rounded-2xl border border-panel-line bg-panel-card p-6">
          <p className="mb-2 font-medium text-panel-ink">
            {vazio?.titulo ?? "Hoje você não precisa abrir"}
          </p>
          <p className="text-sm text-panel-sub">
            {vazio?.explicacao ??
              "Ninguém da sua lista está atrasado o suficiente para valer uma mensagem esta semana."}
          </p>
          <a
            href={vazio?.acao.href ?? "/painel/clientes/importar"}
            className="mt-5 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            {vazio?.acao.texto ?? "Trazer meus clientes"}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl space-y-4 p-4 sm:p-6">
      {vindoDoDiagnostico && (
        <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
          <p className="font-display text-panel-ink">
            Sua lista entrou inteira. Não precisa colar de novo.
          </p>
          <p className="mt-2 text-sm text-panel-sub">
            Aqueles clientes que você viu na tela anterior estão aqui embaixo, com a
            mensagem já escrita para cada um. Comece mandando para três — leva dois
            minutos e você já sente se funciona.
          </p>
        </div>
      )}

      <header>
        <h1 className="font-display text-2xl text-panel-ink">
          Reativar clientes — {total} clientes
        </h1>
        {/*
          A frase que explica a tela antes de o dono precisar saber o nome dela.
          Diz "passou do tempo que ele mesmo costuma demorar" e não "mais de 30
          dias" porque a conta é por pessoa: quem corta o cabelo a cada 24 dias
          entra aqui antes dos 30, e quem vai ao salão a cada 45 não entra aos
          31. Prometer um número redondo seria mais bonito e seria falso.
        */}
        <p className="mt-1 text-sm leading-relaxed text-panel-sub">
          Estes clientes já compraram de você e pararam de voltar — cada um já passou do
          tempo que ele mesmo costuma demorar. A Nexora já escreveu a mensagem para chamar
          cada um de volta.
        </p>
        <p className="mt-2 text-sm text-panel-sub">
          {reais(onda.totalEmJogoCents)} é o que essas pessoas costumam gastar juntas. É o
          tamanho do que dá para recuperar — não é promessa.
        </p>
        <p className="mt-1 text-sm tabular-nums text-panel-sub">
          {resolvidos} de {total} resolvidos · Leva uns{" "}
          {Math.max(1, Math.round(total * 0.75))} minutos
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-line">
          <div
            className="h-full bg-amber transition-all"
            style={{ width: `${(resolvidos / total) * 100}%` }}
          />
        </div>
      </header>

      {/*
        QUEM APARECEU?
        Vem ANTES dos 12 cartões porque é dinheiro que já pode ter voltado e
        ainda não está contado. "Enviei" grava AGUARDANDO (que é a verdade), e
        sem esta pergunta tudo ficaria AGUARDANDO para sempre — o Livro-Caixa
        ficaria mais vazio do que quando o botão mentia.
      */}
      {(onda.perguntar?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-5">
          <h2 className="font-display font-semibold text-panel-ink">
            Semana passada você falou com {onda.perguntar!.length}{" "}
            {onda.perguntar!.length === 1 ? "pessoa" : "pessoas"}. Quem apareceu?
          </h2>
          <p className="mt-1 text-sm text-panel-sub">
            Só entra em Dinheiro recuperado o que você disser aqui. Pode deixar para depois —
            volto a perguntar.
          </p>

          <ul className="mt-4 space-y-2">
            {onda.perguntar!.map((p) => (
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
                    onClick={() =>
                      marcarPendente(p, "VOLTOU", { valorCents: p.ticketMedioCents })
                    }
                    className="rounded-lg border border-amber/40 px-3 py-1.5 text-sm text-amber-deep hover:bg-amber/10"
                  >
                    Voltou{p.ticketMedioCents > 0 ? ` (${reais(p.ticketMedioCents)})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => marcarPendente(p, "SEM_RESPOSTA")}
                    className="rounded-lg border border-panel-line px-3 py-1.5 text-sm text-panel-sub hover:text-panel-ink"
                  >
                    Não veio
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {onda.cards.map((card) => {
          const feito = feitos[card.id];
          const rotulo = ROTULO_ESTEIRA[card.esteira];
          const zap = linkDoWhatsApp(card);

          return (
            <article
              key={card.id}
              className={`rounded-2xl border bg-panel-card p-4 transition ${
                feito ? "border-leaf/40 opacity-70" : "border-panel-line"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-panel-ink">{card.nome}</h2>
                  <p className="text-xs tabular-nums text-panel-sub">{card.telefone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {rotulo ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${rotulo.classe}`}>
                      {rotulo.texto}
                    </span>
                  ) : null}
                  <span className="text-[11px] tabular-nums text-panel-sub">
                    {card.toque}ª de 4 mensagens
                  </span>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-panel-sub">
                Última visita há{" "}
                <span className="tabular-nums text-panel-ink">{card.diasDesdeUltima} dias</span>.{" "}
                {card.porque}
              </p>

              {card.confianca === "baixa" ? (
                <p className="mt-2 rounded-lg bg-amber/15 px-2.5 py-1.5 text-xs text-[#7A5A10]">
                  Isso aqui é um palpite — tenho pouca informação sobre esse cliente. Estou te
                  avisando porque é verdade, não porque atrapalha. Mesmo assim vale mandar: o
                  custo de tentar é uma mensagem.
                </p>
              ) : null}

              {feito ? (
                <p className="mt-3 text-sm text-amber-deep">{feito}</p>
              ) : pulando === card.id ? (
                <div className="mt-3">
                  <p className="text-xs leading-relaxed text-panel-sub">
                    Por que não quer chamar? Menos o último, todos estes motivos tiram essa
                    pessoa da sua lista <strong className="font-semibold">para sempre</strong> —
                    ela nunca mais vai aparecer aqui, e não tem como desfazer.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MOTIVOS_PULO.map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => marcar(card, "PULADO", { motivoPulo: valor })}
                        className="rounded-lg border border-panel-line px-2.5 py-1.5 text-xs text-panel-sub hover:border-panel-sub"
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
                    className="mt-2 text-xs text-panel-sub underline"
                  >
                    Voltar
                  </button>
                </div>
              ) : (
                <>
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-panel-line bg-panel-bg p-3 font-sans text-sm text-panel-ink">
                    {card.mensagem}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {zap && (
                      <a
                        href={zap}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-amber px-3 py-2 text-sm font-semibold text-night"
                      >
                        Abrir conversa no WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => copiar(card)}
                      className="rounded-lg border border-panel-line px-3 py-2 text-sm text-panel-ink hover:border-panel-sub"
                    >
                      {copiado === card.id ? "Copiado ✓" : "Copiar mensagem"}
                    </button>
                    <button
                      type="button"
                      // AGUARDANDO, nao SEM_RESPOSTA. O cliente acabou de
                      // receber -- chamar isso de "nao respondeu" descartava
                      // todo retorno que viesse depois, e o Livro-Caixa e
                      // exatamente o que prova que a Nexora vale a mensalidade.
                      onClick={() => marcar(card, "AGUARDANDO")}
                      className="rounded-lg border border-panel-line px-3 py-2 text-sm text-panel-ink hover:border-panel-sub"
                    >
                      Já mandei
                    </button>
                    <button
                      type="button"
                      onClick={() => marcar(card, "VOLTOU", { valorCents: card.ticketMedioCents })}
                      className="rounded-lg border border-amber/40 px-3 py-2 text-sm text-amber-deep hover:bg-amber/10"
                    >
                      Voltou e pagou {reais(card.ticketMedioCents)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPulando(card.id)}
                      className="rounded-lg px-3 py-2 text-sm text-panel-sub hover:text-panel-ink"
                    >
                      Não quero chamar
                    </button>
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
          Dois motivos práticos: o WhatsApp bloqueia número que dispara em massa, e você não
          teria mão para atender 100 pessoas respondendo hoje à tarde. Quem não entrar hoje
          entra na semana que vem — e quem não responder aparece aqui de novo daqui a 4 dias,
          para você mandar a segunda mensagem. Insistir 4 ou 5 vezes recupera cerca de 81%
          mais gente do que tentar uma vez só.
        </p>
      </footer>
    </main>
  );
}
