import Link from "next/link";
import { camposPendentes, identificacaoCompleta } from "@/lib/legal/identidade";
import type { Secao } from "@/lib/legal/termos";

/**
 * A CASCA DOS DOCUMENTOS JURÍDICOS.
 *
 * Uma só, para os três documentos, porque documento jurídico com aparência
 * diferente a cada página parece copiado de fonte diferente — e é exatamente a
 * impressão que não se quer passar aqui.
 *
 * Legibilidade é requisito legal, não estética: o art. 6º, VI da LGPD fala em
 * acesso "facilitado" e o CDC exige destaque para cláusulas que limitam direito.
 * Por isso medida de linha curta, tipo grande e fundo papel — o mesmo papel das
 * seções claras da landing, para o leitor não sentir que saiu do site.
 */

export function DocumentoLegal({
  titulo,
  resumo,
  atualizadoEm,
  secoes,
}: {
  titulo: string;
  resumo: string;
  atualizadoEm: string;
  secoes: Secao[];
}) {
  const faltando = camposPendentes();

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
            <Link href="/termos" className="transition hover:text-paper-ink">
              Termos
            </Link>
            <Link href="/privacidade" className="transition hover:text-paper-ink">
              Privacidade
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em]">{titulo}</h1>
        <p className="mt-4 text-lg leading-relaxed text-paper-sub">{resumo}</p>
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.14em] text-paper-sub">
          versão {atualizadoEm}
        </p>

        {/*
          Enquanto a identificação do fornecedor não estiver preenchida, o
          documento diz isso na cara. É feio de propósito: publicar contrato com
          "[DEFINIR]" no lugar do nome de quem presta o serviço é pior do que não
          publicar, e o aviso existe para ninguém esquecer antes da primeira venda.
        */}
        {!identificacaoCompleta() && (
          <div className="mt-8 rounded-xl border-2 border-amber-deep bg-amber/10 p-5">
            <p className="font-display font-bold">Documento ainda não publicável</p>
            <p className="mt-2 text-sm leading-relaxed">
              Faltam dados obrigatórios de identificação do prestador ({faltando.join(", ")}).
              O Decreto 7.962/2013 exige nome, CPF ou CNPJ e endereço em destaque antes de
              qualquer cobrança. Preencha em <code>lib/legal/identidade.ts</code>.
            </p>
          </div>
        )}

        <div className="mt-14 grid gap-12">
          {secoes.map((s) => (
            <section key={s.titulo}>
              <h2 className="font-display text-xl font-semibold tracking-[-0.01em]">
                {s.titulo}
              </h2>
              {s.paragrafos.map((p) => (
                <p key={p} className="mt-4 leading-[1.75] text-paper-ink/85">
                  {p}
                </p>
              ))}
              {s.itens && (
                <ul className="mt-5 grid gap-3">
                  {s.itens.map((i) => (
                    <li key={i} className="flex gap-3 leading-[1.7] text-paper-ink/85">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-paper-line">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-10 text-sm text-paper-sub sm:flex-row sm:justify-between">
          <Link href="/" className="transition hover:text-paper-ink">
            ← Voltar para a Nexora
          </Link>
          <div className="flex gap-5">
            <Link href="/termos" className="transition hover:text-paper-ink">
              Termos de Uso
            </Link>
            <Link href="/privacidade" className="transition hover:text-paper-ink">
              Política de Privacidade
            </Link>
            <Link href="/operador" className="transition hover:text-paper-ink">
              Contrato de Operador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
