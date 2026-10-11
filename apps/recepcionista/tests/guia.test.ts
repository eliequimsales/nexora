import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const leia = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

describe("Página do Guia Oficial — Leitura e Entrega Imediata", () => {
  const guia = leia("app/guia/page.tsx");

  it("contém o título oficial do guia", () => {
    expect(guia).toContain("Como Nunca Mais Perder um Cliente pro Concorrente no WhatsApp");
  });

  it("contém a explicação dos 3 pilares e a regra dos 3 segundos", () => {
    expect(guia).toContain("A Regra dos 3 Segundos: Por Que Velocidade Bate Preço");
    expect(guia).toContain("Como Passar Preço Sem Assustar");
    expect(guia).toContain("A Blindagem Noturna e de Finais de Semana");
  });

  it("contém o módulo de resgate de clientes sumidos (order bump)", () => {
    expect(guia).toContain("O Resgate Rápido de Clientes que Sumiram");
    expect(guia).toContain("Mensagem 1: O \"Esqueci de te perguntar\"");
    expect(guia).toContain("Mensagem 2: A Vaga de Encaixe");
    expect(guia).toContain("Mensagem 3: A Limpeza Elegante");
  });

  it("direciona o leitor para conectar o Atendente Nexora em /ativar", () => {
    expect(guia).toContain("/ativar");
    expect(guia).toContain("Conectar Meu WhatsApp Agora");
  });
});
