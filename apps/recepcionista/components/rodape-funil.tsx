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
 * O RODAPÉ DO FUNIL — landing, diagnóstico e páginas de nicho.
 *
 * Gerado a cada acesso (noStore): razão social e documento vêm das variáveis do
 * servidor, e o build do Docker não as enxerga. Gerado no build, o rodapé sairia
 * sem empresa nenhuma.
 */
export function RodapeFunil({ nota }: { nota?: string }) {
  noStore();
  const empresa = linhaDaEmpresa(FORNECEDOR, anoAtual());

  return (
    <footer className="border-t border-nx-border px-6 pb-24 pt-10 sm:pb-10">
      <div className="mx-auto grid max-w-6xl gap-8 text-sm text-nx-muted md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <p className="max-w-md">
            Nexora — recuperação de clientes inativos para pequenos negócios de serviço.
          </p>
          {nota && <p className="max-w-md">{nota}</p>}
          <p className="text-nx-secondary">
            {empresa ??
              "A identificação completa de quem presta o serviço está nos Termos de Uso."}
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-2 text-xs">
            {SELOS_DO_RODAPE.map((selo) => (
              <li key={selo.texto}>
                <Link
                  href={selo.href}
                  className="inline-flex items-center gap-1.5 rounded-md border border-nx-border px-2.5 py-1 transition-colors hover:text-nx-primary"
                >
                  <span aria-hidden="true" className="text-nx-success">
                    ✓
                  </span>
                  {selo.texto}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Institucional" className="flex flex-wrap content-start gap-x-5 gap-y-2">
          {LINKS_DO_RODAPE.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-nx-primary">
              {link.texto}
            </Link>
          ))}
          <a href={linkDeSuporte(FORNECEDOR)} className="transition-colors hover:text-nx-primary">
            Suporte
          </a>
        </nav>
      </div>
    </footer>
  );
}
