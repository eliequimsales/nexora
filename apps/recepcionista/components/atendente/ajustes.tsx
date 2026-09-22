"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MINUTOS_SEM_RESPOSTA } from "@/lib/atendente/constantes";
import { JEITOS, NOME_DO_JEITO, type Jeito } from "@/lib/atendente/jeitos";
import type { TelaDoAtendente } from "@/lib/atendente/tela";

/**
 * OS AJUSTES — POUCOS, CURTOS, SALVOS SOZINHOS.
 *
 * Nome, jeito e quando ele responde numa lista só; o que ele sabe logo abaixo,
 * com o campo aparecendo só onde falta alguma coisa. Nada de botão "salvar":
 * mudou, está salvo — e o celular ao lado já mostra o efeito.
 */

type Ajuste = Partial<{ marcaDireto: boolean; expediente: boolean; endereco: string; pagamento: string }>;

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
  children,
}: {
  ok: boolean;
  rotulo: string;
  valor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Marca ok={ok} />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
        <p className="text-sm font-medium text-panel-ink sm:w-20 sm:shrink-0">{rotulo}</p>
        <p className={`break-words text-sm sm:min-w-0 sm:flex-1 sm:truncate ${ok ? "text-panel-sub" : "text-amber-deep"}`}>
          {valor}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
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

export function Ajustes({
  tela,
  nome,
  jeito,
  aoMudarNome,
  aoMudarJeito,
  aoAjustar,
}: {
  tela: TelaDoAtendente;
  nome: string;
  jeito: Jeito;
  aoMudarNome: (nome: string) => void;
  aoMudarJeito: (jeito: Jeito) => void;
  aoAjustar: (ajuste: Ajuste) => void;
}) {
  const servicos = tela.sabe.servicos.length;
  const semPreco = tela.sabe.servicos.filter((s) => s.semPreco).length;
  const perguntas = tela.sabe.perguntas.length;

  return (
    <div className="space-y-4">
      <section className="divide-y divide-panel-line rounded-2xl border border-panel-line bg-panel-card">
        <Linha rotulo="Nome">
          <input
            value={nome}
            onChange={(e) => aoMudarNome(e.target.value.slice(0, 30))}
            maxLength={30}
            placeholder="Sem nome"
            aria-label="Nome do atendente"
            autoComplete="off"
            className="w-40 rounded-lg border border-panel-line bg-white px-3 py-1.5 text-right text-sm text-panel-ink placeholder:text-panel-sub/60 focus:border-amber focus:outline-none"
          />
        </Linha>
        <Linha rotulo="Jeito" empilhar>
          <div role="radiogroup" aria-label="Jeito de falar" className="flex rounded-xl bg-panel-bg p-1 sm:inline-flex">
            {JEITOS.map((j) => (
              <button
                key={j}
                type="button"
                role="radio"
                aria-checked={jeito === j}
                onClick={() => aoMudarJeito(j)}
                className={`flex-auto rounded-lg px-2 py-1.5 text-xs font-semibold transition sm:flex-none sm:px-3 ${
                  jeito === j ? "bg-white text-panel-ink shadow-sm" : "text-panel-sub hover:text-panel-ink"
                }`}
              >
                {NOME_DO_JEITO[j]}
              </button>
            ))}
          </div>
        </Linha>
        <Linha rotulo="Loja fechada" detalhe={tela.foraDoHorario}>
          <span className="text-sm font-semibold text-emerald-700">responde na hora</span>
        </Linha>
        <Linha rotulo={`Loja aberta, sem resposta em ${MINUTOS_SEM_RESPOSTA} min`}>
          <Chave
            rotulo={`Responder com a loja aberta, sem resposta em ${MINUTOS_SEM_RESPOSTA} minutos`}
            ligada={tela.expediente}
            aoMudar={(expediente) => aoAjustar({ expediente })}
          />
        </Linha>
        <Linha rotulo="Marca direto na agenda">
          <Chave rotulo="Marca direto na agenda" ligada={tela.marcaDireto} aoMudar={(marcaDireto) => aoAjustar({ marcaDireto })} />
        </Linha>
      </section>

      <section className="divide-y divide-panel-line rounded-2xl border border-panel-line bg-panel-card">
        <p className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-panel-sub">O que ele sabe</p>
        <Dado ok rotulo="Horário" valor={tela.sabe.horario} href="/painel/configuracoes" acao="Mudar" />
        <Dado
          ok={servicos > 0}
          rotulo="Serviços"
          valor={
            servicos === 0 ? "nenhum" : `${plural(servicos, "serviço", "serviços")}${semPreco ? ` · ${semPreco} sem preço` : ""}`
          }
          href="/painel/agenda"
          acao={servicos === 0 ? "Cadastrar" : "Ver"}
        />
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
    </div>
  );
}
