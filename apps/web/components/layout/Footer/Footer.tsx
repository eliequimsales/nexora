import Link from 'next/link';

const FOOTER_LINKS = {
  Produto: [
    { label: 'Como funciona', href: '/#como-funciona' },
    { label: 'Módulos', href: '/produto' },
    { label: 'Preços', href: '/precos' },
    { label: 'Integrações', href: '/produto#integracoes' },
  ],
  Nichos: [
    { label: 'Imobiliário', href: '/nichos/imobiliario' },
    { label: 'Jurídico', href: '/nichos/juridico' },
    { label: 'Saúde', href: '/nichos/saude' },
    { label: 'Educação', href: '/nichos/educacao' },
    { label: 'Serviços', href: '/nichos/servicos' },
  ],
  Empresa: [
    { label: 'Sobre', href: '/sobre' },
    { label: 'Blog', href: '/blog' },
    { label: 'Carreiras', href: '/carreiras' },
    { label: 'Parceiros', href: '/parceiros' },
    { label: 'Contato', href: '/contato' },
  ],
  Legal: [
    { label: 'Termos de uso', href: '/termos' },
    { label: 'Privacidade', href: '/privacidade' },
    { label: 'Cookies', href: '/cookies' },
    { label: 'LGPD', href: '/lgpd' },
  ],
} as const;

export function Footer() {
  return (
    <footer className="border-t border-brand-border bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4 group w-fit">
              <span className="w-7 h-7 rounded-lg bg-brand-amber flex items-center justify-center text-text-inverse font-bold text-sm transition-all duration-200 group-hover:shadow-glow-amber-sm">
                B
              </span>
              <span className="font-semibold text-text-primary">B&apos;reshit</span>
            </Link>
            <p className="text-sm text-text-muted leading-relaxed">
              Operação inteligente começa aqui.
            </p>
          </div>

          {/* Links */}
          {(Object.entries(FOOTER_LINKS) as [string, readonly { label: string; href: string }[]][]).map(
            ([group, links]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-text-muted tracking-wider uppercase mb-4">
                  {group}
                </p>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-brand-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            © {new Date().getFullYear()} B&apos;reshit. Todos os direitos reservados.
          </p>
          <p className="text-xs text-text-muted">
            Construído com IA. Operado por humanos.
          </p>
        </div>
      </div>
    </footer>
  );
}
