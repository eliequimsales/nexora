import { redirect } from "next/navigation";

/**
 * O painel abre em Atendente Virtual, a sessao principal da plataforma.
 */
export default function PainelPage() {
  redirect("/painel/atendente");
}
