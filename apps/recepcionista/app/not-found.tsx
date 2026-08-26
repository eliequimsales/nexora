import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-night px-6 text-center text-mist">
      <p className="font-mono text-sm text-amber">erro 404</p>
      <h1 className="mt-3 font-display text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-3 max-w-md text-mist/60">
        O endereço que você tentou acessar não existe ou foi movido.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-leaf px-6 py-3 text-sm font-semibold text-night transition hover:brightness-110"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
