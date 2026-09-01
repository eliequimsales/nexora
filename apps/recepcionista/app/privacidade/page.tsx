import type { Metadata } from "next";
import { DocumentoLegal } from "../legal";
import { PRIVACIDADE } from "@/lib/legal/privacidade";

export const metadata: Metadata = {
  title: "Política de Privacidade — Nexora",
  description: "Que dados a Nexora trata, com base em quê, quem mais recebe, em que país, e como exercer seus direitos.",
};

export default function Privacidade() {
  return (
    <DocumentoLegal
      titulo="Política de Privacidade"
      resumo="Que dados tratamos, por quê, quem mais recebe e em que país. Inclui uma seção sobre o que ainda não temos — porque a versão anterior deste documento prometia coisas que o sistema não fazia."
      atualizadoEm={PRIVACIDADE.atualizadoEm}
      secoes={PRIVACIDADE.secoes}
    />
  );
}
