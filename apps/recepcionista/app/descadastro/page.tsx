import { Descadastrar } from "./descadastrar";

export const dynamic = "force-dynamic";

/**
 * Página de descadastro. Pública, e só uma coisa acontece aqui.
 *
 * A confirmação é um clique de verdade porque os antivírus de link do Gmail e
 * do Outlook abrem todos os links do e-mail: se o descadastro acontecesse ao
 * abrir a página, o dono sairia da lista sem nunca ter pedido.
 */
export default function PaginaDescadastro({
  searchParams,
}: {
  searchParams: { e?: string; t?: string };
}) {
  const empresa = searchParams.e ?? "";
  const token = searchParams.t ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-night-line bg-night-soft p-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-night font-display text-lg font-bold text-amber">
          N
        </span>

        {!empresa || !token ? (
          <>
            <h1 className="mt-6 font-display text-2xl text-mist">Link incompleto</h1>
            <p className="mt-3 text-sm text-mist/70">
              Esse link não tem as informações necessárias. Abra o link direto do e-mail que
              você recebeu, ou responda aquele e-mail pedindo para sair — a gente tira na mão.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl text-mist">
              Parar de receber e-mails da Nexora?
            </h1>
            <p className="mt-3 text-sm text-mist/70">
              Você deixa de receber os avisos de ativação, de fim de teste e de resultado.
            </p>
            <p className="mt-3 text-sm text-mist/70">
              Os avisos sobre <strong className="text-mist">cobrança e pagamento</strong>{" "}
              continuam, porque são sobre dinheiro seu — e sua conta e sua base não são
              afetadas em nada.
            </p>
            <Descadastrar empresa={empresa} token={token} />
          </>
        )}
      </div>
    </main>
  );
}
