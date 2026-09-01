import type { Metadata } from "next";
import { DocumentoLegal } from "../legal";
import { TERMOS } from "@/lib/legal/termos";

export const metadata: Metadata = {
  title: "Termos de Uso — Nexora",
  description: "As condições do serviço, o preço total, como cancelar e de que cada lado é responsável.",
};

export default function Termos() {
  return (
    <DocumentoLegal
      titulo="Termos de Uso"
      resumo="O que a Nexora faz, o que ela não faz, quanto custa e como você sai quando quiser. Escrito para ser lido em dez minutos, sem advogado do lado."
      atualizadoEm={TERMOS.atualizadoEm}
      secoes={TERMOS.secoes}
    />
  );
}
