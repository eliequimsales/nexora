"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { trackCompleteRegistration } from "@/lib/analytics/pixel";
import { registrar } from "@/components/funil";

function RastreadorInterno() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      const CHAVE = "nx_cad_google_ok";
      try {
        if (!sessionStorage.getItem(CHAVE)) {
          sessionStorage.setItem(CHAVE, "1");
          trackCompleteRegistration("google");
          registrar("criou_conta");
        }
        // Remove ?novo=1 da barra de endereço de forma transparente sem recarregar a tela
        const url = new URL(window.location.href);
        url.searchParams.delete("novo");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      } catch {
        trackCompleteRegistration("google");
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
