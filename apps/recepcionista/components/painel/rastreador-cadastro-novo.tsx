"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trackCompleteRegistration } from "@/lib/analytics/pixel";
import { registrar } from "@/components/funil";

function RastreadorInterno() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const isNovo = searchParams.get("novo") === "1";
    const isInstantaneo = searchParams.get("origem") === "instantaneo";

    if (isNovo || isInstantaneo) {
      const tipo = isInstantaneo ? "instantaneo" : "google";
      const CHAVE = isInstantaneo ? "nx_cad_instant_ok" : "nx_cad_google_ok";
      try {
        if (!sessionStorage.getItem(CHAVE)) {
          sessionStorage.setItem(CHAVE, "1");
          trackCompleteRegistration(tipo);
          registrar("criou_conta");
        }
        // Remove ?novo=1 ou ?origem=instantaneo da barra de endereço de forma transparente sem recarregar a tela
        const url = new URL(window.location.href);
        url.searchParams.delete("novo");
        url.searchParams.delete("origem");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      } catch {
        trackCompleteRegistration(tipo);
        registrar("criou_conta");
      }
    }
  }, [searchParams]);

  return null;
}

export function RastreadorCadastroNovo() {
  return (
    <Suspense fallback={null}>
      <RastreadorInterno />
    </Suspense>
  );
}
