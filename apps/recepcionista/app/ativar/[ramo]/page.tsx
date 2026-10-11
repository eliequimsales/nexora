import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * LINK LIMPO POR ROTA: /ativar/[ramo]
 *
 * Permite URLs ultra-limpas e elegantes sem query string técnica:
 * Ex: meunexora.com.br/ativar/clinica
 *     meunexora.com.br/ativar/odonto
 *     meunexora.com.br/ativar/barbearia
 *
 * Encaminha direto para /comecar?ramo=[ramo] autenticando instantaneamente
 * a sessão com os dados pré-configurados daquele ramo.
 */
export default function AtivarRamoPage(props: {
  params: { ramo: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const ramo = props.params?.ramo;
  const searchParams = props?.searchParams;
  const query = new URLSearchParams();

  if (ramo) {
    query.set("ramo", ramo);
  }

  if (searchParams) {
    for (const [key, val] of Object.entries(searchParams)) {
      if (key !== "ramo") {
        if (typeof val === "string") {
          query.set(key, val);
        } else if (Array.isArray(val) && val[0]) {
          query.set(key, val[0]);
        }
      }
    }
  }

  const qs = query.toString();
  redirect(`/comecar${qs ? `?${qs}` : ""}`);
}
