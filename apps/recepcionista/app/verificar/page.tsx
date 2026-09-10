import Link from "next/link";
import { concluirVerificacao } from "@/lib/auth/verificacao";

export const dynamic = "force-dynamic";

/**
 * A página que consome o link.
 *
 * Server Component: o token é lido, gasto e descartado no servidor, sem nunca
 * passar por JavaScript de cliente — onde ele ficaria no histórico do
 * navegador e em qualquer extensão instalada.
 */
export default async function VerificarPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const resultado = token
    ? await concluirVerificacao(token)
    : { ok: false as const, motivo: "Link incompleto." };

  return (
    <main className="flex min-h-screen items-center justify-center bg-nx-bg px-6 text-nx-primary">
      <div className="w-full max-w-md rounded-2xl border border-nx-border bg-nx-surface p-8 shadow-nx-panel">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-nx-gold text-base font-bold text-nx-bg">
          N
        </span>

        {resultado.ok ? (
          <>
            <h1 className="mt-6 text-2xl font-bold">E-mail confirmado</h1>
            <p className="mt-3 leading-relaxed text-nx-secondary">
              Pronto. Agora a recuperação de senha funciona, e o comprovante da assinatura
              chega até você quando decidir assinar.
            </p>
            <Link
              href="/painel/onda"
              className="mt-7 inline-block rounded-xl bg-nx-gold shadow-nx-glow-sm px-5 py-3 font-semibold text-nx-bg transition hover:bg-nx-gold/90 active:scale-[0.98]"
            >
              Ir para a Onda de segunda
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-bold">Esse link não vale mais</h1>
            <p className="mt-3 leading-relaxed text-nx-secondary">{resultado.motivo}</p>
            <p className="mt-3 leading-relaxed text-nx-secondary">
              Entre no painel e peça um link novo — leva um minuto.
            </p>
            <Link
              href="/painel"
              className="mt-7 inline-block rounded-xl border border-nx-border px-5 py-3 font-semibold transition hover:border-nx-gold"
            >
              Ir para o painel
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
