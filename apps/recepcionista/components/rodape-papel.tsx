import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import {
  anoAtual,
  linhaDaEmpresa,
  linkDeSuporte,
  LINKS_DO_RODAPE,
  SELOS_DO_RODAPE,
} from "@/lib/institucional";
import { FORNECEDOR } from "@/lib/legal/identidade";

/**
 * O RODAPÉ DO PAPEL — documentos jurídicos, /sobre e /status.
 *
 * Mesmos dados do rodapé do funil (lib/institucional.ts), no visual claro dos
 * documentos. Gerado a cada acesso pelo mesmo motivo: a empresa vem das variáveis
 * do servidor, que o build não enxerga.
 */
export function RodapePapel() {
  noStore();
  const empresa = linhaDaEmpresa(FORNECEDOR, anoAtual());

  return (
    <footer className="border-t border-paper-line">
      <div className="mx-auto grid max-w-3xl gap-6 px-6 py-10 text-sm text-paper-sub">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Link href="/" className="transition hover:text-paper-ink">
            ← Voltar para a Nexora
          </Link>
          <nav aria-label="Institucional" className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS_DO_RODAPE.map((link) => (
              <Link key={link.href} href={link.href} className="transition hover:text-paper-ink">
                {link.texto}
              </Link>
            ))}
            <Link href="/operador" className="transition hover:text-paper-ink">
              Contrato de Operador
            </Link>
            <a href={linkDeSuporte(FORNECEDOR)} className="transition hover:text-paper-ink">
              Suporte
            </a>
          </nav>
        </div>
        <div className="space-y-3 border-t border-paper-line pt-5">
          <p>
            {empresa ??
              "A identificação completa de quem presta o serviço está nos Termos de Uso."}
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-2 text-xs">
            {SELOS_DO_RODAPE.map((selo) => (
              <li key={selo.texto}>
                <Link
                  href={selo.href}
                  className="inline-flex items-center gap-1.5 rounded-md border border-paper-line px-2.5 py-1 transition hover:text-paper-ink"
                >
                  <span aria-hidden="true" className="text-amber-deep">
                    ✓
                  </span>
                  {selo.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
