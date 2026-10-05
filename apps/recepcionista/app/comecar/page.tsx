import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * PÁGINA /comecar
 *
 * Encaminha imediatamente para o Route Handler /api/auth/comecar,
 * onde a sessão instantânea é criada e os cookies HttpOnly são atribuídos.
 */
export default function ComecarPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const query = new URLSearchParams();
  if (searchParams) {
    for (const [key, val] of Object.entries(searchParams)) {
      if (typeof val === "string") {
        query.set(key, val);
      } else if (Array.isArray(val) && val[0]) {
        query.set(key, val[0]);
      }
    }
  }
  const qs = query.toString();
  redirect(`/api/auth/comecar${qs ? `?${qs}` : ""}`);
}
