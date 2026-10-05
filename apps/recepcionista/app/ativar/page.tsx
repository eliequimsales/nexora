import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * LINK MINIMALISTA /ativar
 *
 * Encaminha direto para /comecar (onde a sessão instantânea é criada
 * e o cliente entra no painel com zero atrito).
 */
export default function AtivarPage() {
  redirect("/comecar");
}
