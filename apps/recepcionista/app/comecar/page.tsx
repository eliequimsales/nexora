import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * PÁGINA /comecar
 *
 * Encaminha imediatamente para o Route Handler /api/auth/comecar,
 * onde a sessão instantânea é criada e os cookies HttpOnly são atribuídos.
 */
export default function ComecarPage() {
  redirect("/api/auth/comecar");
}
