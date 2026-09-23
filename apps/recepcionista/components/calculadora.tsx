"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { registrar } from "@/components/funil";
import {
  EXEMPLO,
  FATIAS,
  MAX_CLIENTES,
  MAX_TICKET_REAIS,
  contaDaCalculadora,
  lerInteiro,
  type Fatia,
} from "@/lib/recuperacao/calculadora";
import { FAIXA_EM_TEXTO, JANELA_DIAS } from "@/lib/recuperacao/estimativa";

/**
 * A CALCULADORA DA HOME — a conta que o visitante faz com os números dele.
 *
 * Veio da Nexora antiga, com duas trocas: a conta é a do diagnóstico
 * (lib/recuperacao/estimativa.ts), para a home nunca prometer um valor que o
 * diagnóstico desmente; e o ticket segue para o diagnóstico pela URL, em vez de
 * ficar guardado no navegador.
 *
 * Numa página de ramo (/barbearia) ela recebe o ramo: a conta usa o ritmo dele e
 * o link leva o ramo junto, para o diagnóstico repetir a mesma conta.
 *
 * Medição: dois eventos, só o nome. Nenhum número digitado sai daqui.
 */

const MARCA_DE_USO = "nx_calc";

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const CAMPO =
  "mt-2 w-full rounded-lg border border-nx-border bg-nx-surface-2 px-4 py-3 text-2xl font-bold text-nx-primary outline-none transition-colors placeholder:text-nx-muted focus:border-nx-gold/60 focus:ring-2 focus:ring-nx-gold/15";

const plural = (n: number, palavra: string) => `${palavra}${n === 1 ? "" : "s"}`;

export function Calculadora({ ramo }: { ramo?: string }) {
  const [clientes, setClientes] = useState(EXEMPLO.clientes);
  const [ticketReais, setTicketReais] = useState(EXEMPLO.ticketReais);
  const [fatia, setFatia] = useState<Fatia>(EXEMPLO.fatia);
  const [criativo, setCriativo] = useState<string | null>(null);
  const jaUsou = useRef(false);
  const jaClicou = useRef(false);

  // O criativo do anúncio vem da URL da home. Lido depois de montar: no servidor
  // não existe window, e o link sem ele continua funcionando.
  useEffect(() => {
    setCriativo(new URLSearchParams(window.location.search).get("c"));
  }, []);

  const conta = useMemo(
    () => contaDaCalculadora({ clientes, ticketReais, fatia, ramo }),
    [clientes, ticketReais, fatia, ramo],
  );

  /** Uma vez por sessão da aba; sem armazenamento, uma vez por visita à página. */
  function marcarUso() {
    if (jaUsou.current) return;
    jaUsou.current = true;
    try {
      if (window.sessionStorage.getItem(MARCA_DE_USO)) return;
      window.sessionStorage.setItem(MARCA_DE_USO, "1");
    } catch {
      // Armazenamento bloqueado: conta por visita, o melhor possível sem ele.
    }
    registrar("usou_calculadora");
  }

  function aoIrParaLogin() {
    if (jaClicou.current) return;
    jaClicou.current = true;
    registrar("clicou_calculadora");
  }

  return (
    <div className="rounded-2xl border border-nx-gold/30 bg-nx-surface p-6 shadow-nx-panel sm:p-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label htmlFor="calc-clientes" className="block text-sm font-medium text-nx-secondary">
              Quantos clientes já passaram pelo seu negócio?
            </label>
            <input
              id="calc-clientes"
              inputMode="numeric"
              value={clientes === 0 ? "" : String(clientes)}
              onChange={(e) => {
                setClientes(lerInteiro(e.target.value, MAX_CLIENTES));
                marcarUso();
              }}
              placeholder={String(EXEMPLO.clientes)}
              className={CAMPO}
            />
          </div>

          <div>
            <label htmlFor="calc-ticket" className="block text-sm font-medium text-nx-secondary">
              Quanto um cliente gasta, em média, por atendimento? (R$)
            </label>
            <input
              id="calc-ticket"
              inputMode="numeric"
              value={ticketReais === 0 ? "" : String(ticketReais)}
              onChange={(e) => {
                setTicketReais(lerInteiro(e.target.value, MAX_TICKET_REAIS));
                marcarUso();
              }}
              placeholder={String(EXEMPLO.ticketReais)}
              className={CAMPO}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-nx-secondary">
              Quanto da sua base você acha que está parada?
            </p>
            <div className="mt-2 flex gap-2">
              {FATIAS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={fatia === f}
                  onClick={() => {
                    setFatia(f);
                    marcarUso();
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98] ${
                    fatia === f
                      ? "border-nx-gold/50 bg-nx-gold/15 text-nx-gold"
                      : "border-nx-border bg-nx-surface-2 text-nx-secondary hover:bg-nx-surface-3"
                  }`}
                >
                  {Math.round(f * 100)}%
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-nx-muted">
              Não sabe? Comece com {Math.round(EXEMPLO.fatia * 100)}% e ajuste. O diagnóstico com a sua
              lista mostra o número de verdade.
            </p>
            <p className="mt-3 text-xs text-nx-muted">
              Os números já preenchidos são um exemplo. Troque pelos seus.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-xl border border-nx-border bg-nx-bg/60 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-error">
            Parado na sua base agora
          </p>
          {/* O dinheiro primeiro: é o que o dono sente. A contagem de clientes
              explica de onde ele vem, logo abaixo. */}
          <p className="mt-2 text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            {reais(conta.umaVisitaCents)}
          </p>
          <p className="mt-2 text-sm text-nx-muted">
            em {conta.parados.toLocaleString("pt-BR")} {plural(conta.parados, "cliente")}{" "}
            {conta.parados === 1 ? "que parou" : "que pararam"} de vir — uma visita de cada um.
          </p>

          <div className="mt-6 border-t border-nx-border pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-nx-success">
              Em {JANELA_DIAS} dias, voltando no ritmo
            </p>
            <p className="mt-1 text-3xl font-bold text-nx-success">
              {reais(conta.faixa.min)} a {reais(conta.faixa.max)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-nx-muted">
              {FAIXA_EM_TEXTO} de retorno — a mesma faixa que o diagnóstico usa na sua lista.
              Considera {conta.visitas} {plural(conta.visitas, "visita")} de quem volta a cada{" "}
              {conta.ciclo} dias.
            </p>
            <p className="mt-2 text-xs font-medium leading-relaxed text-nx-secondary">
              Estimativa baseada no histórico informado. Não representa receita garantida.
            </p>
          </div>

          {conta.abaixoDoCorte && (
            <p className="mt-5 rounded-lg border border-nx-warning/25 bg-nx-warning-muted p-3 text-sm leading-relaxed text-nx-primary">
              Com esses números, a Nexora provavelmente não compensa para você agora. O diagnóstico
              confirma com a sua lista, de graça.
            </p>
          )}

          <Link
            href="/login"
            onClick={aoIrParaLogin}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-nx-gold px-5 py-3.5 font-semibold text-nx-bg shadow-nx-glow-sm transition-all hover:bg-nx-gold/90 active:scale-[0.98]"
          >
            Trazer esses clientes de volta agora <span aria-hidden="true">→</span>
          </Link>
          {/* O botão convida a trazer de volta, mas o próximo passo é o
              diagnóstico: a frase diz isso, para o clique não virar surpresa. */}
          <p className="mt-2 text-center text-xs text-nx-muted">
            Grátis e sem cartão. Primeiro você vê quem são, antes de decidir qualquer coisa.
          </p>
        </div>
      </div>

      <p className="mt-6 border-t border-nx-border pt-4 text-center text-xs leading-relaxed text-nx-muted">
        A conta à vista:{" "}
        <strong className="text-nx-secondary">
          {conta.parados.toLocaleString("pt-BR")} {plural(conta.parados, "cliente")} ×{" "}
          {reais(ticketReais * 100)} × {conta.visitas} {plural(conta.visitas, "visita")}
        </strong>{" "}
        = {reais(conta.potencialCents)}. Campanhas de recuperação costumam trazer de volta{" "}
        {FAIXA_EM_TEXTO} disso em {JANELA_DIAS} dias.
      </p>
    </div>
  );
}
