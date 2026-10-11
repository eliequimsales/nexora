import React from "react";
import type { Metadata, Viewport } from "next";
import { ContinuarComSofia } from "./continuar-com-sofia";

export const metadata: Metadata = {
  title: "Continue com a Sofia | Nexora",
  description: "Converse com a Sofia sobre seu acesso ao guia Anti-Vácuo.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  alternates: { canonical: "/obrigado" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#09090b",
};

// Esta rota pública não recebe uma confirmação confiável do pagamento.
// Parâmetros na URL nunca são prova de compra nem liberam um produto.
export default function PaginaObrigado() {
  return <ContinuarComSofia />;
}
