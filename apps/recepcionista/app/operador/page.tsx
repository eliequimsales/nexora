import type { Metadata } from "next";
import { DocumentoLegal } from "../legal";
import { OPERADOR } from "@/lib/legal/operador";

export const metadata: Metadata = {
  title: "Contrato de Operador — Nexora",
  description: "O contrato exigido pelo art. 39 da LGPD entre você, controlador da sua base, e a Nexora, operadora.",
};

// A identificação do fornecedor vem das variáveis do servidor (lib/legal/identidade.ts).
// Gerada no build, esta página sairia com "[DEFINIR]" mesmo com o Railway preenchido.
export const dynamic = "force-dynamic";

export default function Operador() {
  return (
    <DocumentoLegal
      titulo="Contrato de Operador"
      resumo="Os clientes que você sobe são seus, não nossos. Este documento é o que a LGPD exige para deixar claro quem decide o quê — e é parte dos Termos de Uso."
      atualizadoEm={OPERADOR.atualizadoEm}
      secoes={OPERADOR.secoes}
    />
  );
}
