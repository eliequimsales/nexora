import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-xs font-mono text-brand-amber tracking-widest uppercase mb-4">
          404
        </p>
        <h1 className="text-2xl font-semibold text-text-primary mb-2">
          Página não encontrada
        </h1>
        <p className="text-sm text-text-secondary mb-8">
          Esse endereço não existe ou você não tem acesso a ele.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-brand-amber hover:text-brand-amber/80 transition-colors"
        >
          ← Voltar ao início
        </Link>
      </div>
    </div>
  );
}
