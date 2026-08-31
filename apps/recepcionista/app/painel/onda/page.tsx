"use client";

import { useCallback, useEffect, useState } from "react";
import { MOTIVOS_PULO, rotuloDoMotivo } from "@/lib/recuperacao/pulo";

/**
 * A ONDA DE SEGUNDA
 *
 * Doze clientes, ~9 minutos de copiar e colar. É o loop que forma o hábito:
 * gatilho fixo (segunda de manhã), ação curta, recompensa variável real (quem
 * volta e quanto paga) e investimento em um toque (marcar o resultado).
 *
 * Regra Zero: nenhum card mostra informação sem uma ação executável junto.
 * Verdade acima de marketing: confiança baixa é dita na cara, não escondida.
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

type Onda = {
  cards: Card[];
  totalEmJogoCents: number;
  composicao: Record<string, number>;
  vazio: Vazio | null;
};

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO_ESTEIRA: Record<string, { texto: string; classe: string }> = {
  PRE_ATRASO: { texto: "Prestes a sumir", classe: "bg-amber/20 text-[#7A5A10]" },
  ATRASO: { texto: "Atrasado", classe: "bg-amber/15 text-amber-deep" },
  RESGATE: { texto: "Sumido há muito", classe: "bg-panel-line text-panel-sub" },
};

export default function PaginaOnda() {
  // Quem chega do diagnóstico acabou de ver os próprios clientes sumidos e
  // criou a conta por causa disso. Cair numa tela igual à de sempre quebra a
  // promessa que a página de venda acabou de fazer — ele precisa ver, aqui,
  // que aquela mesma lista chegou inteira.
  const [vindoDoDiagnostico, setVindoDoDiagnostico] = useState(false);
  useEffect(() => {
    setVindoDoDiagnostico(
      new URLSearchParams(window.location.search).get("origem") === "diagnostico",
    );
  }, []);

  const [onda, setOnda] = useState<Onda | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [feitos, setFeitos] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState("");
  const [pulando, setPulando] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/onda");
      if (!res.ok) throw new Error();
      setOnda(await res.json());
    } catch {
      setErro("Não consegui montar a onda agora.");
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

  if (carregando) {
    return (
      <main className="p-6">
        <p className="text-panel-sub">Montando sua onda…</p>
      </main>
    );
  }

  if (erro || !onda) {
    return (
      <main className="p-6">
        <p className="text-panel-sub">{erro || "Nada por aqui."}</p>
      </main>
    );
  }

  const enviados = Object.keys(feitos).length;
  const total = onda.cards.length;

  // Tela vazia honesta: encher a lista com cliente marginal mata a confiança na
  // primeira mensagem que o dono manda para alguém que esteve lá semana passada.
  //
  // Mas vazio tem QUATRO causas opostas, e dizer "ninguém está atrasado" para
  // quem nunca importou nada é mentira na primeira tela do produto. O motivo
  // vem calculado do servidor, com a ação correspondente (Regra Zero).
  if (total === 0) {
    const vazio = onda.vazio;
    return (
      <main className="p-6 max-w-2xl">
        <h1 className="font-display text-2xl text-panel-ink mb-2">Onda de segunda</h1>
        <div className="bg-panel-card rounded-2xl border border-panel-line p-6">
          <p className="text-panel-ink font-medium mb-2">
            {vazio?.titulo ?? "Hoje você não precisa abrir"}
          </p>
          <p className="text-sm text-panel-sub">
            {vazio?.explicacao ??
              "Ninguém da sua base está atrasado o suficiente para valer uma mensagem esta semana."}
          </p>
          <a
            href={vazio?.acao.href ?? "/painel/clientes/importar"}
            className="mt-5 inline-flex rounded-xl bg-amber px-5 py-3 text-sm font-semibold text-night transition hover:brightness-110"
          >
            {vazio?.acao.texto ?? "Importar minha lista de clientes"}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-6 max-w-2xl space-y-4">
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
          Onda de segunda — {total} clientes
        </h1>
        <p className="text-sm text-panel-sub mt-1">
          {reais(onda.totalEmJogoCents)} estimados em jogo. Estimativa baseada no histórico
          de gasto de cada um. Não é promessa.
        </p>
        <p className="text-sm text-panel-sub mt-1 tabular-nums">
          {enviados} de {total} enviados · Tempo estimado: {Math.max(1, Math.round(total * 0.75))} minutos
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-panel-line overflow-hidden">
          <div
            className="h-full bg-amber transition-all"
            style={{ width: `${(enviados / total) * 100}%` }}
          />
        </div>
      </header>

      <div className="space-y-3">
        {onda.cards.map((card) => {
          const feito = feitos[card.id];
          const rotulo = ROTULO_ESTEIRA[card.esteira];

          return (
            <article
              key={card.id}
              className={`bg-panel-card rounded-2xl border p-4 transition ${
                feito ? "border-leaf/40 opacity-70" : "border-panel-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h2 className="font-semibold text-panel-ink">{card.nome}</h2>
                  <p className="text-xs text-panel-sub tabular-nums">{card.telefone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {rotulo ? (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${rotulo.classe}`}>
                      {rotulo.texto}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-panel-sub tabular-nums">
                    toque {card.toque} de 4
                  </span>
                </div>
              </div>

              <p className="text-sm text-panel-sub leading-relaxed">
                Última visita há{" "}
                <span className="tabular-nums text-panel-ink">{card.diasDesdeUltima} dias</span>.{" "}
                {card.porque}
              </p>

              {card.confianca === "baixa" ? (
                <p className="mt-2 text-xs text-[#7A5A10] bg-amber/15 rounded-lg px-2.5 py-1.5">
                  Confiança BAIXA. Estamos te avisando porque é verdade, não porque atrapalha.
                  Mesmo assim vale o toque: o custo de tentar é uma mensagem.
                </p>
              ) : null}

              {feito ? (
                <p className="mt-3 text-sm text-amber-deep">{feito}</p>
              ) : pulando === card.id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {MOTIVOS_PULO.map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => marcar(card, "PULADO", { motivoPulo: valor })}
                      className="text-xs rounded-lg border border-panel-line px-2.5 py-1.5 text-panel-sub hover:border-panel-sub"
                    >
                      {rotuloDoMotivo(valor)}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-panel-bg border border-panel-line p-3 text-sm text-panel-ink font-sans">
                    {card.mensagem}
                  </pre>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copiar(card)}
                      className="rounded-lg bg-amber px-3 py-2 text-sm font-semibold text-night"
                    >
                      {copiado === card.id ? "Copiado ✓" : "Copiar mensagem"}
                    </button>
                    <button
                      type="button"
                      onClick={() => marcar(card, "SEM_RESPOSTA")}
                      className="rounded-lg border border-panel-line px-3 py-2 text-sm text-panel-ink hover:border-panel-sub"
                    >
                      Enviei
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
                      Pular
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <footer className="bg-panel-card rounded-2xl border border-panel-line p-4">
        <h3 className="text-sm font-semibold text-panel-ink mb-1">
          Por que só {total} e não a sua lista inteira?
        </h3>
        <p className="text-sm text-panel-sub leading-relaxed">
          Dois motivos práticos: o WhatsApp bloqueia número que dispara em massa, e você não
          teria mão para atender 100 pessoas respondendo hoje à tarde. Quem não entrar hoje
          entra na onda da semana que vem — e quem não responder hoje recebe de novo daqui a
          4 dias, porque 4 a 5 tentativas recuperam cerca de 81% mais gente do que uma só.
        </p>
      </footer>
    </main>
  );
}
