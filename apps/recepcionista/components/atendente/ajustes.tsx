"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { JEITOS, NOME_DO_JEITO, type Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { emReais } from "@/lib/billing/preco";

/**
 * OS AJUSTES — POUCOS, CURTOS, SALVOS SOZINHOS.
 *
 * Nome, jeito e quando ele responde numa lista só; o que ele sabe logo abaixo,
 * com o campo aparecendo só onde falta alguma coisa. Nada de botão "salvar":
 * mudou, está salvo — e o celular ao lado já mostra o efeito.
 */

type Ajuste = Partial<{ marcaDireto: boolean; expediente: boolean; endereco: string; pagamento: string; descricao: string }>;

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Linha({
  rotulo,
  detalhe,
  empilhar = false,
  children,
}: {
  rotulo: string;
  /** Embaixo da linha inteira: espremido ao lado do controle, virava quatro linhas no celular. */
  detalhe?: string;
  /** No celular, o controle desce para baixo do rótulo — para o que não cabe ao lado dele. */
  empilhar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5">
      <div
        className={
          empilhar
            ? "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            : "flex items-center justify-between gap-4"
        }
      >
        <p className="min-w-0 text-sm font-medium text-panel-ink">{rotulo}</p>
        <div className="shrink-0">{children}</div>
      </div>
      {detalhe && <p className="mt-1 text-xs text-panel-sub">{detalhe}</p>}
    </div>
  );
}

function Chave({ rotulo, ligada, aoMudar }: { rotulo: string; ligada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligada)}
      className={`relative h-7 w-12 rounded-full transition ${ligada ? "bg-amber" : "bg-panel-line"}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${ligada ? "left-6" : "left-1"}`}
        aria-hidden="true"
      />
    </button>
  );
}

function Marca({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700" aria-label="Pronto">
      ✓
    </span>
  ) : (
    <span className="h-5 w-5 rounded-full border-2 border-amber" aria-label="Falta" />
  );
}

/** Uma linha do "O que ele sabe". No celular, o valor desce para baixo do rótulo em vez de sumir cortado. */
function LinhaDoDado({
  ok,
  rotulo,
  valor,
  aoClicar,
  children,
}: {
  ok: boolean;
  rotulo: string;
  valor: string;
  aoClicar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={aoClicar}
      className={`flex items-center gap-3 px-5 py-3 ${aoClicar ? "cursor-pointer" : ""}`}
    >
      <Marca ok={ok} />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
        <p className="text-sm font-medium text-panel-ink sm:w-20 sm:shrink-0">{rotulo}</p>
        <p className={`break-words text-sm sm:min-w-0 sm:flex-1 sm:truncate ${ok ? "text-panel-sub" : "text-amber-deep"}`}>
          {valor}
        </p>
      </div>
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Dado({
  ok,
  rotulo,
  valor,
  href,
  acao,
}: {
  ok: boolean;
  rotulo: string;
  valor: string;
  href: string;
  acao: string;
}) {
  return (
    <LinhaDoDado ok={ok} rotulo={rotulo} valor={valor}>
      <Link href={href} className="text-xs font-semibold text-amber-deep hover:underline">
        {acao}
      </Link>
    </LinhaDoDado>
  );
}

function DadoDoCadastro({
  rotulo,
  valor,
  exemplo,
  aoSalvar,
}: {
  rotulo: string;
  valor: string;
  exemplo: string;
  aoSalvar: (valor: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const campo = useRef<HTMLInputElement>(null);

  if (editando) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Um caminho só para salvar: sair do campo. O Enter só tira o foco.
          campo.current?.blur();
        }}
        className="flex items-center gap-3 px-5 py-2.5"
      >
        <Marca ok={Boolean(valor)} />
        <p className="w-20 shrink-0 text-sm font-medium text-panel-ink">{rotulo}</p>
        <input
          ref={campo}
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => {
            if (texto.trim() && texto.trim() !== valor) aoSalvar(texto.trim());
            setEditando(false);
          }}
          maxLength={300}
          placeholder={exemplo}
          aria-label={rotulo}
          className="min-w-0 flex-1 rounded-lg border border-panel-line bg-white px-3 py-1.5 text-sm text-panel-ink focus:border-amber focus:outline-none"
        />
      </form>
    );
  }

  return (
    <LinhaDoDado ok={Boolean(valor)} rotulo={rotulo} valor={valor || "falta"}>
      <button
        type="button"
        onClick={() => {
          setTexto(valor);
          setEditando(true);
        }}
        className="text-xs font-semibold text-amber-deep hover:underline"
      >
        {valor ? "Mudar" : "Adicionar"}
      </button>
    </LinhaDoDado>
  );
}

type ItemServico = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
};

function ModalServicos({
  aoFechar,
  aoAtualizar,
}: {
  aoFechar: () => void;
  aoAtualizar: () => void;
}) {
  const [servicos, setServicos] = useState<ItemServico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [duracaoMin, setDuracaoMin] = useState(30);

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const res = await fetch("/api/agenda/servicos");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.servicos)) {
        setServicos(data.servicos);
      } else {
        setErro(data?.error ?? "Não consegui carregar os serviços.");
      }
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aoFechar]);

  function iniciarEdicao(s: ItemServico) {
    setEditandoId(s.id);
    setNome(s.name);
    setPreco(s.priceCents > 0 ? (s.priceCents / 100).toFixed(2).replace(".", ",") : "");
    setDuracaoMin(s.durationMin || 30);
    setErro("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setNome("");
    setPreco("");
    setDuracaoMin(30);
    setErro("");
  }

  function converterReaisParaCentavos(valor: string): number {
    const limpo = valor.replace(/[^\d,.]/g, "").replace(",", ".");
    const n = parseFloat(limpo);
    if (isNaN(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 2) {
      setErro("Digite o nome do serviço.");
      return;
    }

    setSalvando(true);
    setErro("");
    const precoCents = converterReaisParaCentavos(preco);

    try {
      if (editandoId) {
        const res = await fetch("/api/agenda/servicos", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editandoId,
            nome: nomeLimpo,
            precoCents,
            duracaoMin,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setErro(data?.error ?? "Não consegui salvar o serviço.");
          return;
        }
      } else {
        const res = await fetch("/api/agenda/servicos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nomeLimpo,
            precoCents,
            duracaoMin,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setErro(data?.error ?? "Não consegui salvar o serviço.");
          return;
        }
      }

      cancelarEdicao();
      await carregar();
      aoAtualizar();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    setRemovendoId(id);
    setErro("");
    try {
      const res = await fetch(`/api/agenda/servicos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setErro("Não consegui remover o serviço.");
        return;
      }
      if (editandoId === id) cancelarEdicao();
      await carregar();
      aoAtualizar();
    } catch {
      setErro("Sem conexão agora. Tente de novo.");
    } finally {
      setRemovendoId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-servicos"
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-panel-line bg-panel-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4 pb-3">
          <div>
            <h2 id="titulo-servicos" className="font-display text-lg font-bold text-panel-ink sm:text-xl">
              Serviços e preços
            </h2>
            <p className="mt-0.5 text-xs text-panel-sub">
              O que o Atendente oferece e responde o valor aos clientes.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg p-1.5 text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {erro && (
          <div className="my-2 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">
            {erro}
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto py-2 pr-1">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-panel-sub">
              Cadastrados ({servicos.length})
            </p>
            {carregando ? (
              <p className="py-4 text-center text-xs text-panel-sub">Carregando serviços…</p>
            ) : servicos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-panel-line p-4 text-center">
                <p className="text-xs text-panel-sub">Nenhum serviço cadastrado ainda.</p>
                <p className="mt-1 text-xs text-panel-sub">
                  Adicione seus serviços abaixo para o Atendente saber o valor.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-panel-line rounded-xl border border-panel-line bg-panel-bg">
                {servicos.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-panel-ink">{s.name}</p>
                      <p className="text-xs text-panel-sub">
                        {s.priceCents > 0 ? emReais(s.priceCents) : "Sem preço"} · {s.durationMin} min
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => iniciarEdicao(s)}
                        className="text-xs font-semibold text-amber-deep hover:underline"
                      >
                        Editar
                      </button>
                      <span className="text-panel-line">·</span>
                      <button
                        type="button"
                        disabled={removendoId === s.id}
                        onClick={() => remover(s.id)}
                        className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                      >
                        {removendoId === s.id ? "Removendo…" : "Remover"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={salvar} className="space-y-3 rounded-xl border border-panel-line bg-panel-bg/60 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-panel-sub">
              {editandoId ? "Alterar serviço" : "Adicionar serviço"}
            </p>

            <div>
              <label className="mb-1 block text-xs font-medium text-panel-sub">Nome do serviço</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={80}
                placeholder="Ex: Corte, Manicure, Consulta..."
                className="w-full rounded-lg border border-panel-line bg-white px-3 py-1.5 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-panel-sub">Preço (R$)</label>
                <input
                  type="text"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-panel-line bg-white px-3 py-1.5 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-panel-sub">Duração</label>
                <select
                  value={duracaoMin}
                  onChange={(e) => setDuracaoMin(Number(e.target.value))}
                  className="w-full rounded-lg border border-panel-line bg-white px-3 py-1.5 text-sm text-panel-ink focus:border-amber focus:outline-none"
                >
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos (1h)</option>
                  <option value={90}>90 minutos (1h30)</option>
                  <option value={120}>120 minutos (2h)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={salvando || nome.trim().length < 2}
                className="rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night transition hover:bg-amber-hover disabled:opacity-50"
              >
                {salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "+ Salvar serviço"}
              </button>
              {editandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="rounded-xl border border-panel-line bg-white px-3 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-3 flex justify-end border-t border-panel-line pt-3">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl bg-panel-bg px-4 py-2 text-xs font-semibold text-panel-ink transition hover:bg-panel-line"
          >
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}

const TEMAS_RAPIDOS = [
  { id: "atraso", rotulo: "⏱️ Tolerância de atraso", prefixo: "⏱️ Tolerância de atraso", exemplo: "Tolerância máxima de 15 minutos para atrasos." },
  { id: "estacionamento", rotulo: "🚗 Estacionamento", prefixo: "🚗 Estacionamento", exemplo: "Estacionamento conveniado gratuito na rua lateral." },
  { id: "pagamento", rotulo: "💳 Parcelamento e Pix", prefixo: "💳 Pagamento", exemplo: "Parcelamos em até 3x sem juros no cartão e Pix." },
  { id: "marcas", rotulo: "🏷️ Marcas e produtos", prefixo: "🏷️ Produtos", exemplo: "Usamos produtos profissionais de alta qualidade." },
  { id: "referencia", rotulo: "📍 Ponto de referência", prefixo: "📍 Localização", exemplo: "Estamos em frente à praça central, ao lado da farmácia." },
  { id: "feriados", rotulo: "📅 Feriados", prefixo: "📅 Feriados", exemplo: "Não atendemos em feriados nacionais ou municipais." },
  { id: "outro", rotulo: "✏️ Outro assunto", prefixo: "✦ Regra", exemplo: "" },
];

function extrairItens(textoBruto: string): string[] {
  if (!textoBruto || !textoBruto.trim()) return [];
  const linhas = textoBruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (linhas.length > 1) return linhas;

  const unica = linhas[0] ?? "";
  const partes = unica
    .split(/(?=[⏱️🚗💳🏷️📍📅✏️✦🟣])|(?<=[.!?])\s+(?=[A-Za-zÀ-ÿ0-9\s]+:)/u)
    .map((p) => p.trim())
    .filter(Boolean);

  return partes.length > 1 ? partes : [unica];
}

function temaJaCadastrado(temaId: string, lista: string[]): boolean {
  if (temaId === "outro") return false;
  return lista.some((item) => {
    const t = item.toLowerCase();
    if (temaId === "atraso") return t.includes("tolerância") || t.includes("tolerancia") || t.includes("atraso");
    if (temaId === "estacionamento") return t.includes("estacionamento");
    if (temaId === "pagamento") return t.includes("parcelamento") || t.includes("pagamento") || t.includes("pix") || t.includes("cartão") || t.includes("cartao");
    if (temaId === "marcas") return t.includes("marca") || t.includes("produto");
    if (temaId === "referencia") return t.includes("referência") || t.includes("referencia") || t.includes("localização") || t.includes("localizacao");
    if (temaId === "feriados") return t.includes("feriado");
    return false;
  });
}

function SecaoOQueEleDeveSaber({
  descricao,
  aoSalvar,
}: {
  descricao: string;
  aoSalvar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(descricao);
  const [salvo, setSalvo] = useState(false);
  const [temaAtivo, setTemaAtivo] = useState<string | null>(null);
  const [campoNovo, setCampoNovo] = useState("");
  const [modoLivre, setModoLivre] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTexto(descricao);
  }, [descricao]);

  function salvarTexto(novo: string) {
    const limpo = novo.slice(0, 2000);
    setTexto(limpo);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      aoSalvar(limpo);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }, 600);
  }

  const itens = extrairItens(texto);

  function adicionarItem(novo: string) {
    const textoLimpo = novo.trim();
    if (!textoLimpo) return;
    const novosItens = [...itens, textoLimpo];
    salvarTexto(novosItens.join("\n"));
    setTemaAtivo(null);
    setCampoNovo("");
  }

  function removerItem(indice: number) {
    const novosItens = itens.filter((_, i) => i !== indice);
    salvarTexto(novosItens.join("\n"));
  }

  function selecionarTema(id: string) {
    const tema = TEMAS_RAPIDOS.find((t) => t.id === id);
    if (!tema) return;
    setTemaAtivo(id);
    setCampoNovo(tema.exemplo);
  }

  return (
    <section className="rounded-2xl border border-panel-line bg-panel-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-panel-ink flex items-center gap-1.5">
            <span className="text-amber">✦</span> Coisas que seu atendente deve saber sobre a empresa
          </h2>
          <p className="mt-0.5 text-xs text-panel-sub">
            Regras de atendimento, estacionamento, marcas e diferenciais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {salvo && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Salvo
            </span>
          )}
          <button
            type="button"
            onClick={() => setModoLivre(!modoLivre)}
            className="text-[11px] font-semibold text-amber-deep hover:underline"
          >
            {modoLivre ? "Voltar para tópicos" : "Editar em texto livre"}
          </button>
        </div>
      </div>

      {/* BANNER EDUCATIVO / ORIENTAÇÃO */}
      <div className="rounded-xl border border-amber/30 bg-amber/5 p-3.5 text-xs text-panel-ink">
        <div className="flex items-center gap-1.5 font-bold text-amber-deep">
          <span>💡</span> Treine o seu atendente como se fosse um funcionário de verdade
        </div>
        <p className="mt-1 leading-relaxed text-panel-sub">
          O atendente só responde o que você ensinar aqui e nunca inventa nada.
        </p>
        <p className="mt-0.5 leading-relaxed text-panel-sub">
          Quanto mais detalhes você colocar, melhor ele atenderá seus clientes.
        </p>
      </div>

      {modoLivre ? (
        <div className="space-y-1.5">
          <textarea
            value={texto}
            onChange={(e) => salvarTexto(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Exemplo: Estacionamento grátis na rua lateral. Aceitamos Pix e cartão em 3x. Tolerância de 15 minutos para atrasos."
            className="w-full rounded-xl border border-panel-line bg-white p-3.5 text-sm text-panel-ink placeholder:text-panel-sub/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber leading-relaxed resize-y"
          />
          <div className="flex items-center justify-between text-[11px] text-panel-sub">
            <span>Salva sozinho enquanto você digita</span>
            <span>{texto.length}/2000 letras</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div>
            <p className="text-xs font-semibold text-panel-sub mb-2">
              Escolha um tema para adicionar em segundos:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMAS_RAPIDOS.map((t) => {
                const jaTem = temaJaCadastrado(t.id, itens);
                if (jaTem) {
                  return (
                    <div
                      key={t.id}
                      title="Este assunto já está cadastrado abaixo"
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-800 select-none"
                    >
                      <span>✓ {t.rotulo}</span>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-900">
                        já adicionado
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => selecionarTema(t.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      temaAtivo === t.id
                        ? "border-amber bg-amber/15 text-panel-ink font-semibold"
                        : "border-panel-line bg-white text-panel-ink hover:border-amber/50 hover:bg-panel-bg"
                    }`}
                  >
                    + {t.rotulo}
                  </button>
                );
              })}
            </div>
          </div>

          {temaAtivo && (
            <div className="rounded-xl border border-amber/40 bg-amber/5 p-3 space-y-2">
              <p className="text-xs font-bold text-panel-ink">
                Adicionar {TEMAS_RAPIDOS.find((t) => t.id === temaAtivo)?.rotulo}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={campoNovo}
                  onChange={(e) => setCampoNovo(e.target.value.slice(0, 200))}
                  maxLength={200}
                  placeholder="Digite a regra ou informação para o atendente..."
                  className="flex-1 rounded-lg border border-panel-line bg-white px-3 py-1.5 text-xs text-panel-ink focus:border-amber focus:outline-none"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const prefixo = TEMAS_RAPIDOS.find((t) => t.id === temaAtivo)?.prefixo;
                      const textoFinal = prefixo && !campoNovo.startsWith(prefixo)
                        ? `${prefixo}: ${campoNovo}`
                        : campoNovo;
                      adicionarItem(textoFinal);
                    }}
                    disabled={!campoNovo.trim()}
                    className="rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-night hover:brightness-110 disabled:opacity-40"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemaAtivo(null);
                      setCampoNovo("");
                    }}
                    className="rounded-lg border border-panel-line bg-white px-2.5 py-1.5 text-xs font-medium text-panel-sub hover:bg-panel-bg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-panel-sub">
                Informações cadastradas ({itens.length}):
              </p>
              {itens.length > 0 && (
                <span className="text-[11px] text-panel-sub">
                  Cada regra é consultada pelo atendente
                </span>
              )}
            </div>

            {itens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-panel-line bg-white/50 p-4 text-center text-xs text-panel-sub">
                Nenhuma informação cadastrada ainda. Escolha um tema acima para começar.
              </p>
            ) : (
              <div className="space-y-2">
                {itens.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-panel-line bg-white p-3 text-xs text-panel-ink shadow-xs transition hover:border-amber/40"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-sm shrink-0 select-none">
                        {item.slice(0, 2).match(/\p{Extended_Pictographic}/u) ? item.slice(0, 2) : "✦"}
                      </span>
                      <span className="flex-1 break-words font-medium leading-relaxed">
                        {item.replace(/^[\p{Extended_Pictographic}\s✦]+/u, "")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerItem(idx)}
                      aria-label="Remover informação"
                      title="Remover informação"
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-panel-line px-2 py-1 text-[11px] font-medium text-panel-sub transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <span>✕</span>
                      <span className="hidden sm:inline">Remover</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function Ajustes({
  tela,
  nome,
  jeito,
  aoMudarNome,
  aoMudarJeito,
  aoAjustar,
  aoAtualizarTela,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  aoMudarNome: (nome: string) => void;
  aoMudarJeito: (jeito: Jeito) => void;
  aoAjustar: (ajuste: Ajuste) => void;
  aoAtualizarTela?: () => void;
}) {
  const [modalServicosAberto, setModalServicosAberto] = useState(false);
  const servicos = tela.sabe.servicos.length;
  const semPreco = tela.sabe.servicos.filter((s) => s.semPreco).length;
  const perguntas = tela.sabe.perguntas.length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-panel-line bg-panel-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="nome-negocio" className="text-sm font-bold text-panel-ink block">
              Nome
            </label>
            <p className="text-xs text-panel-sub">
              Nome do negócio ou atendente.
            </p>
          </div>
          <input
            id="nome-negocio"
            value={nome}
            onChange={(e) => aoMudarNome(e.target.value.slice(0, 30))}
            maxLength={30}
            placeholder={tela.empresa || "Nome da empresa"}
            aria-label="Nome"
            autoComplete="off"
            className="w-48 rounded-xl border border-panel-line bg-white px-3.5 py-2 text-right text-sm text-panel-ink placeholder:text-panel-sub/60 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber shadow-xs"
          />
        </div>
      </section>

      <SecaoOQueEleDeveSaber
        descricao={tela.sabe.descricao ?? ""}
        aoSalvar={(descricao) => aoAjustar({ descricao })}
      />

      <section className="divide-y divide-panel-line rounded-2xl border border-panel-line bg-panel-card">
        <p className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-panel-sub">O que ele sabe</p>
        <Dado ok rotulo="Horário" valor={tela.sabe.horario} href="/painel/configuracoes" acao="Mudar" />
        <LinhaDoDado
          ok={servicos > 0}
          rotulo="Serviços"
          valor={
            servicos === 0 ? "nenhum" : `${plural(servicos, "serviço", "serviços")}${semPreco ? ` · ${semPreco} sem preço` : ""}`
          }
          aoClicar={() => setModalServicosAberto(true)}
        >
          <button
            type="button"
            onClick={() => setModalServicosAberto(true)}
            className="text-xs font-semibold text-amber-deep hover:underline"
          >
            {servicos === 0 ? "Cadastrar" : "Mudar"}
          </button>
        </LinhaDoDado>
        <DadoDoCadastro
          rotulo="Endereço"
          valor={tela.sabe.endereco}
          exemplo="Rua, número e bairro"
          aoSalvar={(endereco) => aoAjustar({ endereco })}
        />
        <DadoDoCadastro
          rotulo="Pagamento"
          valor={tela.sabe.pagamento}
          exemplo="Pix, cartão e dinheiro"
          aoSalvar={(pagamento) => aoAjustar({ pagamento })}
        />
        <Dado
          ok={perguntas > 0}
          rotulo="Perguntas"
          valor={perguntas === 0 ? "nenhuma" : plural(perguntas, "resposta", "respostas")}
          href="/painel/treinamento"
          acao="Ensinar"
        />
      </section>

      {modalServicosAberto && (
        <ModalServicos
          aoFechar={() => setModalServicosAberto(false)}
          aoAtualizar={() => aoAtualizarTela?.()}
        />
      )}
    </div>
  );
}
