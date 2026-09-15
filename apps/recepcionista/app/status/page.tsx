import type { Metadata } from "next";
import Link from "next/link";
import { RodapePapel } from "@/components/rodape-papel";
import { linkDeSuporte } from "@/lib/institucional";
import { FORNECEDOR } from "@/lib/legal/identidade";
import type { EstadoDoComponente, ResumoDoStatus } from "@/lib/status/resumo";
import { statusAgora } from "@/lib/status/verificar";

export const metadata: Metadata = {
  title: "Status — Nexora",
  description: "O serviço conferido agora: painel, pagamentos, e-mails e WhatsApp.",
};

// Confere na hora em que a página abre. Gerada no build, mostraria o dia do build.
export const dynamic = "force-dynamic";

/**
 * STATUS DA NEXORA.
 *
 * Mostra o que foi conferido agora, e diz que é só isso. Sem histórico guardado
 * não existe percentual de disponibilidade para mostrar — e inventar um seria a
 * página de confiança mentindo justamente sobre confiança.
 */

const TOM: Record<ResumoDoStatus["tom"], string> = {
  ok: "border-leaf-dark/30 bg-leaf/15 text-leaf-dark",
  parcial: "border-amber-deep/30 bg-amber/15 text-amber-deep",
  fora: "border-red-700/30 bg-red-600/10 text-red-700",
};

const ROTULO: Record<EstadoDoComponente, { texto: string; ponto: string }> = {
  operando: { texto: "Operando", ponto: "bg-leaf" },
  fora: { texto: "Com problema", ponto: "bg-red-600" },
  nao_configurado: { texto: "Não configurado", ponto: "bg-amber" },
  desligado: { texto: "Desligado", ponto: "bg-paper-sub" },
};

export default async function PaginaDeStatus() {
  const status = await statusAgora();
  const hora = status.verificadoEm.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-paper text-paper-ink">
      <header className="border-b border-paper-line">
        <div className="mx-auto flex max-w-page items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber font-display text-base font-bold text-night">
              N
            </span>
            <span className="font-display font-semibold">Nexora</span>
          </Link>
          <nav className="flex gap-5 text-sm text-paper-sub">
            <Link href="/sobre" className="transition hover:text-paper-ink">
              Sobre
            </Link>
            <Link href="/termos" className="transition hover:text-paper-ink">
              Termos
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em]">Status da Nexora</h1>

        <p
          className={`mt-8 rounded-xl border p-5 font-display text-xl font-semibold ${TOM[status.resumo.tom]}`}
        >
          {status.resumo.titulo}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-paper-sub">
          Verificado às {hora}, horário de Brasília. Esta página confere o serviço no momento em
          que você abre e não guarda histórico, por isso não mostra índice de disponibilidade.
        </p>

        <ul className="mt-10 grid gap-3">
          {status.componentes.map((componente) => {
            const rotulo = ROTULO[componente.estado];
            return (
              <li
                key={componente.chave}
                className="flex flex-col gap-2 rounded-xl border border-paper-line p-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{componente.nome}</p>
                  <p className="mt-1 text-sm text-paper-sub">{componente.detalhe}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-medium">
                  <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${rotulo.ponto}`} />
                  {rotulo.texto}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-sm leading-relaxed text-paper-sub">
          Algo parou de funcionar e não aparece aqui?{" "}
          <a href={linkDeSuporte(FORNECEDOR)} className="font-semibold text-paper-ink underline underline-offset-4">
            Fale com o suporte
          </a>
          .
        </p>
      </main>

      <RodapePapel />
    </div>
  );
}
