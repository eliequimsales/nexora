"use client";

import Link from "next/link";
import { useState } from "react";
import { MINUTOS_SEM_RESPOSTA } from "@/lib/atendente/constantes";
import type { TelaDoAtendente } from "@/lib/atendente/tela";
import { SemanaDesenhada } from "./semana";

/**
 * PASSO 2 — O QUE ELE SABE.
 *
 * Tudo aqui já existe em outro lugar — agenda, cadastro, perguntas — e é
 * mostrado, não pedido de novo. O único campo aparece quando falta endereço ou
 * pagamento, que é justamente o que o cliente mais pergunta.
 */

type Ajuste = Partial<{
  marcaDireto: boolean;
  expediente: boolean;
  endereco: string;
  pagamento: string;
  fecharHoje: boolean;
}>;

const MAX_PERGUNTAS_VISIVEIS = 6;

function Cartao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-panel-line bg-panel-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display font-semibold text-panel-ink">{titulo}</h3>
        {acao}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function LinkDiscreto({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="shrink-0 text-xs font-semibold text-amber-deep hover:underline">
      {children}
    </Link>
  );
}

function CampoQueFalta({
  rotulo,
  exemplo,
  salvando,
  aoSalvar,
}: {
  rotulo: string;
  exemplo: string;
  salvando: boolean;
  aoSalvar: (valor: string) => void;
}) {
  const [valor, setValor] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valor.trim()) aoSalvar(valor.trim());
      }}
      className="flex flex-wrap gap-2"
    >
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        maxLength={300}
        placeholder={exemplo}
        aria-label={rotulo}
        className="min-w-0 flex-1 rounded-xl border border-panel-line bg-white px-3 py-2 text-sm text-panel-ink focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30"
      />
      <button
        type="submit"
        disabled={salvando || !valor.trim()}
        className="rounded-xl border border-amber bg-amber/10 px-4 py-2 text-sm font-semibold text-panel-ink transition hover:bg-amber/20 disabled:opacity-50"
      >
        Salvar
      </button>
    </form>
  );
}

function Escolha({
  titulo,
  descricao,
  ligada,
  salvando,
  aoMudar,
}: {
  titulo: string;
  descricao: string;
  ligada: boolean;
  salvando: boolean;
  aoMudar: (ligada: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-panel-line bg-panel-card p-5">
      <div>
        <p className="font-semibold text-panel-ink">{titulo}</p>
        <p className="mt-1 text-sm text-panel-sub">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ligada}
        aria-label={titulo}
        disabled={salvando}
        onClick={() => aoMudar(!ligada)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${
          ligada ? "bg-amber" : "bg-panel-line"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${ligada ? "left-6" : "left-1"}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

export function PassoSabe({
  tela,
  salvando,
  aoAjustar,
  aoVoltar,
  aoContinuar,
}: {
  tela: TelaDoAtendente;
  salvando: boolean;
  aoAjustar: (ajuste: Ajuste) => void;
  aoVoltar: () => void;
  aoContinuar: () => void;
}) {
  const quem = tela.nome.trim() || "O Atendente";
  const quemNoMeio = tela.nome.trim() || "o Atendente";
  const { sabe } = tela;
  const perguntasVisiveis = sabe.perguntas.slice(0, MAX_PERGUNTAS_VISIVEIS);

  return (
    <section className="space-y-4">
      <p className="text-sm text-panel-sub">
        {quem} só diz o que está aqui. Preço, horário e endereço vêm do seu cadastro — o que não estiver aqui, ele não
        inventa: diz que não tem confirmado e anota para você.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao titulo="Serviços e preços" acao={<LinkDiscreto href="/painel/agenda">Editar na Agenda</LinkDiscreto>}>
          {sabe.servicos.length === 0 ? (
            <p className="text-sm text-panel-sub">
              Nenhum serviço na agenda ainda. Sem serviço, ele oferece horários de 30 minutos e não fala de preço.
            </p>
          ) : (
            <ul className="divide-y divide-panel-line">
              {sabe.servicos.map((s) => (
                <li key={s.nome} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-panel-ink">{s.nome}</span>
                  <span className={s.semPreco ? "text-amber-deep" : "tabular-nums text-panel-sub"}>{s.detalhe}</span>
                </li>
              ))}
            </ul>
          )}
          {sabe.servicos.some((s) => s.semPreco) && (
            <p className="mt-2 text-xs text-panel-sub">
              Serviço sem preço: ele diz que não tem o valor confirmado e anota para você.
            </p>
          )}
        </Cartao>

        <Cartao titulo="Horário" acao={<LinkDiscreto href="/painel/configuracoes">Ajustar o horário</LinkDiscreto>}>
          <p className="text-sm text-panel-ink">{sabe.horario}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={salvando}
              onClick={() => aoAjustar({ fecharHoje: !sabe.fechadoHoje })}
              className="rounded-xl border border-panel-line px-4 py-2 text-sm font-semibold text-panel-ink transition hover:border-amber disabled:opacity-60"
            >
              {sabe.fechadoHoje ? "Reabrir hoje" : "Fechar hoje"}
            </button>
            <span className="text-xs text-panel-sub">
              {sabe.fechadoHoje
                ? `Hoje está fechado: ${quemNoMeio} atende o dia todo, e o seu link não oferece horário hoje.`
                : "Feriado, imprevisto? Fechando hoje, ele atende o dia todo."}
            </span>
          </div>
        </Cartao>

        <Cartao
          titulo="Perguntas que ele já responde"
          acao={<LinkDiscreto href="/painel/treinamento">Ensinar uma resposta</LinkDiscreto>}
        >
          {perguntasVisiveis.length === 0 ? (
            <p className="text-sm text-panel-sub">
              Nenhuma ainda. O que não estiver aqui ele anota para você responder — e o que você ensinar, ele passa a
              responder.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm text-panel-ink">
              {perguntasVisiveis.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-amber-deep" aria-hidden="true">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
              {sabe.perguntas.length > perguntasVisiveis.length && (
                <li className="text-panel-sub">e mais {sabe.perguntas.length - perguntasVisiveis.length}</li>
              )}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Endereço e pagamento">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-panel-sub">Endereço</p>
              {sabe.endereco ? (
                <p className="mt-1 text-panel-ink">{sabe.endereco}</p>
              ) : (
                <div className="mt-1.5">
                  <CampoQueFalta
                    rotulo="Endereço"
                    exemplo="Rua, número e bairro"
                    salvando={salvando}
                    aoSalvar={(endereco) => aoAjustar({ endereco })}
                  />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-panel-sub">Formas de pagamento</p>
              {sabe.pagamento ? (
                <p className="mt-1 text-panel-ink">{sabe.pagamento}</p>
              ) : (
                <div className="mt-1.5">
                  <CampoQueFalta
                    rotulo="Formas de pagamento"
                    exemplo="Pix, cartão e dinheiro"
                    salvando={salvando}
                    aoSalvar={(pagamento) => aoAjustar({ pagamento })}
                  />
                </div>
              )}
            </div>
          </div>
        </Cartao>
      </div>

      <Cartao titulo="Quando ele atende">
        <SemanaDesenhada dias={tela.semana.dias} texto={tela.semana.texto} nome={tela.nome} />
      </Cartao>

      <div className="grid gap-4 lg:grid-cols-2">
        <Escolha
          titulo="Marcar direto na agenda"
          descricao={
            tela.marcaDireto
              ? "O cliente responde com o número do horário e ele marca na hora, pela mesma regra do seu link."
              : sabe.linkAgenda
                ? "Desligado: ele mostra os horários livres e manda o seu link para o cliente escolher."
                : "Desligado: ele mostra os horários livres e anota a escolha para você confirmar."
          }
          ligada={tela.marcaDireto}
          salvando={salvando}
          aoMudar={(marcaDireto) => aoAjustar({ marcaDireto })}
        />
        <Escolha
          titulo={`Também no expediente, quando ninguém responder em ${MINUTOS_SEM_RESPOSTA} minutos`}
          descricao={
            tela.expediente
              ? `Loja cheia e ninguém viu a mensagem: depois de ${MINUTOS_SEM_RESPOSTA} minutos sem resposta, ele responde por você.`
              : "Desligado: com a loja aberta, só você responde. Ele entra quando a loja fecha."
          }
          ligada={tela.expediente}
          salvando={salvando}
          aoMudar={(expediente) => aoAjustar({ expediente })}
        />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={aoVoltar} className="text-sm font-semibold text-panel-sub hover:text-panel-ink">
          ← Voltar
        </button>
        <button
          type="button"
          onClick={aoContinuar}
          className="rounded-xl bg-amber px-6 py-3 text-sm font-bold text-night transition hover:brightness-110"
        >
          Continuar para o teste
        </button>
      </div>
    </section>
  );
}
