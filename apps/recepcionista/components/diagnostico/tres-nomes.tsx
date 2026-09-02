"use client";

import { useState } from "react";
import { AcaoConvite } from "@/components/acao-convite";
import { registrar } from "@/components/funil";
import { diagnosticarTresNomes, QUANDO, type NomeLembrado } from "@/lib/recuperacao/tres-nomes";

/**
 * A PORTA QUE ABRE NO CELULAR.
 *
 * Os três caminhos de entrada do Diagnóstico eram um textarea com dica de
 * "Ctrl+C do Excel" (gesto que não existe no iPhone), um seletor de arquivo do
 * Android, e "cole a conversa do WhatsApp" — que exporta uma conversa, ou seja
 * UM cliente, e sem telefone. Dois exigem computador e o terceiro quase não
 * funciona. Nenhuma otimização de anúncio empurra tráfego para dentro de uma
 * porta que não abre no aparelho em que a pessoa está.
 *
 * Aqui não se pede arquivo nenhum. O dono já sabe de cor quem sumiu — ele pensa
 * nessas pessoas no chuveiro. Três nomes, o "quando" em botão, telefone opcional.
 *
 * Termina em TRÊS MENSAGENS PRONTAS, não num número. Regra Zero: a tela acaba na
 * ação que gera dinheiro para ele, e ele pode mandar hoje à noite. Se uma pessoa
 * responder, R$ 97 deixa de ser promessa e vira conta de padaria — antes de a
 * Nexora cobrar qualquer coisa.
 */

const VAZIO: NomeLembrado = { nome: "", diasSumido: 90, telefone: "" };

const EXEMPLOS = ["Ex.: Marcos", "Ex.: dona Cida", "Ex.: o Júnior"];

export function TresNomes({
  segmento,
  negocio,
  ticketCents,
  aoQuererLista,
}: {
  segmento: string;
  negocio: string;
  ticketCents?: number;
  aoQuererLista: () => void;
}) {
  const [nomes, setNomes] = useState<NomeLembrado[]>([{ ...VAZIO }, { ...VAZIO }, { ...VAZIO }]);
  const [mostrou, setMostrou] = useState(false);
  const [enviados, setEnviados] = useState<Set<number>>(new Set());

  const preenchidos = nomes.filter((n) => n.nome.trim().length > 0);

  const atualizar = (i: number, patch: Partial<NomeLembrado>) =>
    setNomes((atual) => atual.map((n, j) => (j === i ? { ...n, ...patch } : n)));

  const ver = () => {
    setMostrou(true);
    registrar("viu_numero");
  };

  if (!mostrou) {
    return (
      <div className="rounded-2xl border border-night-line bg-night-soft p-6">
        <h2 className="font-display text-xl font-semibold text-mist">
          Quem some da sua cabeça primeiro?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-mist/60">
          Não precisa de lista nem de planilha. Escreve três pessoas que você lembra que
          sumiram — eu escrevo a mensagem para cada uma e você manda hoje mesmo.
        </p>

        <div className="mt-6 grid gap-5">
          {nomes.map((n, i) => (
            <div key={i} className="rounded-xl border border-night-line bg-night p-4">
              <input
                value={n.nome}
                onChange={(ev) => {
                  if (!n.nome && ev.target.value) registrar("comecou_entrada");
                  atualizar(i, { nome: ev.target.value });
                }}
                placeholder={EXEMPLOS[i]}
                autoComplete="off"
                className="w-full bg-transparent text-base text-mist outline-none placeholder:text-mist/25"
              />

              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-mist/40">
                Sem aparecer há quanto tempo?
              </p>

              {/*
                Botão e não campo de data. O dono não sabe que foi dia 14/03 —
                ele sabe "uns seis meses". Botão é mais honesto sobre o que ele
                realmente tem, e no celular é a diferença entre continuar e
                desistir no meio.
              */}
              <div className="mt-2 flex flex-wrap gap-2">
                {QUANDO.map((q) => (
                  <button
                    key={q.dias}
                    onClick={() => atualizar(i, { diasSumido: q.dias })}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                      n.diasSumido === q.dias
                        ? "border-amber bg-amber/15 font-semibold text-amber"
                        : "border-night-line text-mist/60 hover:border-mist/30"
                    }`}
                  >
                    {q.rotulo}
                  </button>
                ))}
              </div>

              <input
                value={n.telefone}
                onChange={(ev) => atualizar(i, { telefone: ev.target.value })}
                placeholder="Telefone (opcional — sem ele eu te dou o texto pronto)"
                inputMode="tel"
                autoComplete="off"
                className="mt-4 w-full border-t border-night-line bg-transparent pt-3 text-sm text-mist outline-none placeholder:text-mist/25"
              />
            </div>
          ))}
        </div>

        <button
          onClick={ver}
          disabled={preenchidos.length === 0}
          className="mt-6 w-full rounded-xl bg-amber px-5 py-4 font-display text-base font-bold text-night transition hover:brightness-110 disabled:opacity-40"
        >
          {preenchidos.length === 0
            ? "Escreve pelo menos um nome"
            : preenchidos.length === 1
              ? "Escrever a mensagem"
              : `Escrever as ${preenchidos.length} mensagens`}
        </button>

        <button
          onClick={aoQuererLista}
          className="mt-3 w-full text-sm text-mist/45 underline underline-offset-4 hover:text-mist/70"
        >
          Tenho a lista aqui — quero ver a base inteira
        </button>
      </div>
    );
  }

  const d = diagnosticarTresNomes(preenchidos, { segmento, negocio, ticketCents });

  return (
    <div className="rounded-2xl border border-night-line bg-night-soft p-6">
      <h2 className="font-display text-xl font-semibold text-mist">
        {d.cartoes.length === 1 ? "A mensagem está pronta" : "As mensagens estão prontas"}
      </h2>

      {d.textoDoValor && (
        <p className="mt-2 text-sm leading-relaxed text-mist/60">{d.textoDoValor}</p>
      )}

      {/*
        A ressalva vem ANTES dos cartões, não num rodapé cinza. Três nomes de
        memória não são uma base, e a tela que abre a relação não pode começar
        exagerando a própria precisão.
      */}
      <p className="mt-4 rounded-xl border border-night-line bg-night/60 p-3 text-xs leading-relaxed text-mist/50">
        {d.ressalva}
      </p>

      <div className="mt-6 grid gap-4">
        {d.cartoes.map((c, i) => (
          <div key={`${c.nome}-${i}`} className="rounded-xl border border-night-line bg-night p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display font-semibold text-mist">{c.nome}</span>
              <span className="font-mono text-xs text-mist/40">há {c.diasSumido} dias</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-mist/60">{c.porque}</p>

            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-night-soft p-3 text-sm leading-relaxed text-mist/80">
              {c.convite.texto}
            </p>

            <AcaoConvite
              texto={c.convite.texto}
              href={c.convite.href}
              nome={c.primeiroNome}
              aoAgir={() => {
                registrar("clicou_mensagem");
                setEnviados((s) => new Set(s).add(i));
              }}
            />
          </div>
        ))}
      </div>

      {/*
        O passo seguinte só aparece DEPOIS de ele agir. Pedir a base antes de ele
        mandar a primeira mensagem seria trocar a ação dele pela nossa — e é
        exatamente o erro que a tela antiga cometia ao terminar em "criar conta".
      */}
      {enviados.size > 0 && (
        <div className="mt-7 rounded-xl border border-amber/30 bg-amber/10 p-5">
          <p className="font-display font-semibold text-mist">
            {enviados.size === 1 ? "Mandou uma." : `Mandou ${enviados.size}.`} Agora a parte
            que você não consegue fazer de cabeça:
          </p>
          <p className="mt-2 text-sm leading-relaxed text-mist/70">
            Você lembrou de três. Na sua lista tem mais — e eu calculo o ritmo de cada
            cliente, um por um, para dizer quem está sumindo agora, antes de virar hábito
            não voltar.
          </p>
          <button
            onClick={aoQuererLista}
            className="mt-4 w-full rounded-xl bg-amber px-5 py-3.5 font-display font-bold text-night transition hover:brightness-110"
          >
            Ver quem mais sumiu na minha lista
          </button>
        </div>
      )}

      <button
        onClick={() => setMostrou(false)}
        className="mt-4 w-full text-sm text-mist/45 underline underline-offset-4 hover:text-mist/70"
      >
        Voltar e mudar os nomes
      </button>
    </div>
  );
}
