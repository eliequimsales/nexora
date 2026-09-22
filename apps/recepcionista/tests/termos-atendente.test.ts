import { describe, expect, it } from "vitest";
import {
  MAX_RESPOSTAS_POR_DIA,
  MINUTOS_SEM_RESPOSTA,
  SEMANA_GRATIS_CONVERSAS,
  SEMANA_GRATIS_DIAS,
  TETO_CONVERSAS_MES,
} from "@/lib/atendente/constantes";
import { VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { PRIVACIDADE } from "@/lib/legal/privacidade";
import { TERMOS } from "@/lib/legal/termos";

/**
 * OS TERMOS DE 22/09/2026: O ATENDENTE VIRTUAL ENTRA NO CONTRATO.
 *
 * O que o Atendente faz, com os números do código: incluído no plano até o
 * teto de conversas, a primeira semana por nossa conta, a identidade honesta, o
 * risco do número e a urgência. E a frase "a Nexora não envia mensagem no seu
 * lugar" passa a valer só para a recuperação — senão o contrato mentiria no
 * minuto em que o dono liga o Atendente.
 */

const textoDe = (d: { secoes: { titulo: string; paragrafos: string[]; itens?: string[] }[] }) =>
  d.secoes.flatMap((s) => [s.titulo, ...s.paragrafos, ...(s.itens ?? [])]).join("\n");

const termos = textoDe(TERMOS);
const privacidade = textoDe(PRIVACIDADE);

describe("a versão dos documentos", () => {
  it("é a de 22/09/2026, a do Atendente Virtual", () => {
    expect(VERSAO_DOCUMENTOS).toBe("2026-09-22");
  });
});

describe("os Termos e o Atendente Virtual", () => {
  it("\"não envia mensagem no seu lugar\" vale só para a recuperação de clientes", () => {
    expect(termos).toContain("Na recuperação de clientes, a Nexora NÃO envia mensagem no seu lugar");
    expect(termos).not.toMatch(/(^|\n)A Nexora NÃO envia mensagem no seu lugar/);
  });

  it("dizem o que ele faz e quando, com os números do código", () => {
    expect(termos).toContain("Atendente Virtual");
    expect(termos).toContain(`${MINUTOS_SEM_RESPOSTA} minutos`);
    expect(termos).toContain(`${MAX_RESPOSTAS_POR_DIA} respostas por conversa por dia`);
    expect(termos).toMatch(/nunca começa conversa/i);
  });

  it("ele se apresenta como atendente virtual e nunca diz ser uma pessoa", () => {
    expect(termos).toMatch(/atendente virtual/);
    expect(termos).toMatch(/nunca diz ser uma pessoa/);
  });

  it("preço, horário e marcação saem do cadastro e da agenda; a IA só escreve a resposta livre", () => {
    expect(termos).toMatch(/respostas livres/);
    expect(termos).toMatch(/verificador/);
  });

  it("incluído no plano até o teto do mês; sem plano, a primeira semana por nossa conta", () => {
    expect(termos).toContain(`${TETO_CONVERSAS_MES} conversas por mês`);
    expect(termos).toContain(`${SEMANA_GRATIS_DIAS} dias ou ${SEMANA_GRATIS_CONVERSAS} conversas`);
    expect(termos).toMatch(/uma vez por negócio/);
  });

  it("é honesto sobre o risco do número e sobre urgência", () => {
    expect(termos).toMatch(/não é a oficial do WhatsApp/);
    expect(termos).toMatch(/não é serviço de emergência/);
    expect(termos).toContain("192");
  });

  it("não sobrou a descrição do atendimento automático antigo", () => {
    expect(termos).not.toContain("Existe um recurso opcional de atendimento automático");
  });
});

describe("a Política de Privacidade e o Atendente Virtual", () => {
  it("diz que a conversa vai ao provedor de IA só nas respostas livres", () => {
    expect(privacidade).toMatch(/Atendente Virtual/);
    expect(privacidade).toMatch(/só quando a pergunta não tem resposta pronta/i);
  });

  it("lista o resumo da manhã e o aviso de urgência entre os e-mails", () => {
    expect(privacidade).toMatch(/resumo da manhã/);
    expect(privacidade).toMatch(/aviso de urgência/);
  });
});
