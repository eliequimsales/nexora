import { redirect } from "next/navigation";

/**
 * O painel abre na Onda, não na lista de conversas.
 *
 * Regra Zero: a primeira tela tem que terminar numa ação executável. Lista de
 * conversas é informação; a Onda é o dinheiro.
 */
export default function PainelPage() {
  redirect("/painel/onda");
}
