import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * LINK MINIMALISTA /ativar
 *
 * Encaminha direto para /comecar preservando parâmetros (como ramo e empresa),
 * onde a sessão instantânea é criada e o cliente entra no painel com zero atrito.
 */
export default function AtivarPage(props: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const searchParams = props?.searchParams;
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
  redirect(`/comecar${qs ? `?${qs}` : ""}`);
}
