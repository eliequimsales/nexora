import { describe, expect, it } from "vitest";
import {
  ENVIOS_POR_ONDA,
  GARANTIA_DIAS,
  ONDAS_MINIMAS,
  PRAZO_PEDIDO_DIAS,
} from "@/lib/billing/garantia";
import { emReais, PRECO_ANUAL_CENTS, PRECO_MENSAL_CENTS } from "@/lib/billing/preco";
import { prometeuTesteGratis, TERMOS_SEM_TESTE_A_PARTIR_DE } from "@/lib/billing/relogio";
import { tipoDoDocumento, VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { PRIVACIDADE } from "@/lib/legal/privacidade";
import { TERMOS } from "@/lib/legal/termos";
import { MIN_RECUPERAVEL_CENTS, MIN_SUMIDOS } from "@/lib/recuperacao/estimativa";

/**
 * OS TERMOS DA OFERTA NOVA.
 *
 * Em 15/09/2026 a conta nova deixou de ter mês grátis: a Nexora é grátis para
 * descobrir e paga para recuperar, com três planos e a Garantia Dinheiro
 * Recuperado no lugar do teste. O contrato precisa dizer exatamente isso, com os
 * números que o código usa — garantia escrita com uma regra e aplicada com outra
 * é a devolução negada que vira reclamação no Procon.
 */

const textoDe = (d: { secoes: { titulo: string; paragrafos: string[]; itens?: string[] }[] }) =>
  d.secoes.flatMap((s) => [s.titulo, ...s.paragrafos, ...(s.itens ?? [])]).join("\n");

const termos = textoDe(TERMOS);

describe("a versão dos documentos é a da oferta nova", () => {
  it("conta nova aceita os Termos sem mês grátis", () => {
    expect(VERSAO_DOCUMENTOS >= TERMOS_SEM_TESTE_A_PARTIR_DE).toBe(true);
    expect(prometeuTesteGratis(VERSAO_DOCUMENTOS)).toBe(false);
  });
});

describe("os Termos dizem o que a conta nova compra", () => {
  it("não prometem mais os primeiros dias gratuitos para conta nova", () => {
    expect(termos).not.toContain("são gratuitos e não pedimos cartão para começar");
  });

  it("dizem o que continua grátis sem plano", () => {
    expect(termos.toLowerCase()).toContain("sem plano");
    expect(termos.toLowerCase()).toContain("exportar");
  });

  it("trazem os três planos com os valores das constantes", () => {
    expect(termos).toContain(emReais(PRECO_MENSAL_CENTS));
    expect(termos).toContain(emReais(PRECO_ANUAL_CENTS));
    expect(termos).toContain("Pix");
    expect(termos.toLowerCase()).toContain("não há cobrança automática");
  });

  it("contas antigas mantêm o período gratuito que aceitaram", () => {
    expect(termos.toLowerCase()).toContain("versões anteriores");
  });
});

describe("a Garantia Dinheiro Recuperado está escrita com as regras do código", () => {
  it("nomeia a garantia e cada condição com o número que o painel confere", () => {
    expect(termos).toContain("Garantia Dinheiro Recuperado");
    expect(termos).toContain(`${GARANTIA_DIAS} dias`);
    expect(termos).toContain(`${ONDAS_MINIMAS} ondas`);
    expect(termos).toContain(`${ENVIOS_POR_ONDA} mensagens`);
    expect(termos).toContain(`${MIN_SUMIDOS} clientes sumidos`);
    expect(termos).toContain(emReais(MIN_RECUPERAVEL_CENTS));
    expect(termos).toContain(`${GARANTIA_DIAS + PRAZO_PEDIDO_DIAS}º dia`);
  });

  it("vale uma vez por negócio e não substitui o arrependimento", () => {
    expect(termos.toLowerCase()).toContain("uma vez por negócio");
    expect(termos).toContain("art. 49");
  });

  // Garantir a devolução não é garantir o cliente. A seção 2 continua verdadeira.
  it("não contradiz a seção que diz que ninguém garante o cliente de volta", () => {
    expect(termos).toContain("A Nexora NÃO garante que algum cliente vá voltar");
  });
});

describe("quem presta o serviço: CPF ou CNPJ, pelo documento", () => {
  it("reconhece o tipo pelo número de dígitos", () => {
    expect(tipoDoDocumento("000.000.000-00")).toBe("CPF");
    expect(tipoDoDocumento("00.000.000/0000-00")).toBe("CNPJ");
    expect(tipoDoDocumento("[DEFINIR]")).toBeNull();
  });

  it("os Termos não chamam de CPF o documento de uma empresa", () => {
    expect(termos).not.toContain("inscrito no CPF");
  });
});

describe("a Política declara os e-mails novos", () => {
  const priv = textoDe(PRIVACIDADE).toLowerCase();

  it("os avisos de relacionamento incluem o fim dos dias pagos", () => {
    expect(priv).toContain("dias pagos");
  });

  it("o comprovante da devolução é transacional", () => {
    expect(priv).toContain("devolução pela garantia");
  });
});
