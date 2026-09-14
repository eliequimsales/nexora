import { redirect } from "next/navigation";

/**
 * O painel abre em Meus clientes, permitindo cadastrar e visualizar a base.
 */
export default function PainelPage() {
  redirect("/painel/clientes/importar");
}
