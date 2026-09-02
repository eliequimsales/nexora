import { describe, expect, it } from "vitest";
import { diagnosticarTresNomes, QUANDO, type NomeLembrado } from "@/lib/recuperacao/tres-nomes";

/**
 * DIAGNÓSTICO DE TRÊS NOMES.
 *
 * O gargalo do funil não é copy: é que a primeira interação da empresa é uma
 * tarefa de MESA feita por um público de CELULAR. Os três caminhos de entrada
 * eram um textarea com dica de "Ctrl+C do Excel" (gesto que não existe no
 * iPhone), um seletor de arquivo, e a exportação de conversa do WhatsApp — que
 * exporta UMA conversa, ou seja, um cliente, sem telefone.
 *
 * Mas o dono não precisa de arquivo nenhum para lembrar de três clientes que
 * sumiram. Ele pensa neles no chuveiro.
 *
 * Esta tela troca "vá buscar um arquivo" por "digite três nomes que você já
 * sabe", e termina em três mensagens prontas para mandar hoje à noite. Se uma
 * pessoa responder, os R$ 97 deixam de ser promessa e viram conta de padaria —
 * antes de qualquer pagamento.
 */

const nome = (over: Partial<NomeLembrado> = {}): NomeLembrado => ({
  nome: over.nome ?? "Maria Silva",
  diasSumido: over.diasSumido ?? 180,
  telefone: over.telefone ?? "",
});

describe("as opções de tempo são botões, não campo de data", () => {
  it("existem faixas prontas, porque memória não tem dia exato", () => {
    expect(QUANDO.length).toBeGreaterThanOrEqual(4);
    for (const q of QUANDO) {
      expect(q.dias).toBeGreaterThan(0);
      expect(q.rotulo.length).toBeGreaterThan(2);
    }
  });

  it("vão do mês até mais de um ano", () => {
    const dias = QUANDO.map((q) => q.dias);
    expect(Math.min(...dias)).toBeLessThanOrEqual(30);
    expect(Math.max(...dias)).toBeGreaterThanOrEqual(365);
  });
});

describe("cada nome vira uma mensagem pronta", () => {
  it("três nomes, três convites", () => {
    const d = diagnosticarTresNomes(
      [nome({ nome: "Ana" }), nome({ nome: "Bruno" }), nome({ nome: "Carla" })],
      { negocio: "Barbearia do Zé", segmento: "barbearia" },
    );
    expect(d.cartoes).toHaveLength(3);
    for (const c of d.cartoes) expect(c.convite.texto.length).toBeGreaterThan(20);
  });

  it("sem telefone o texto sai igual, só o link fica nulo", () => {
    const d = diagnosticarTresNomes([nome({ telefone: "" })], { negocio: "Zé", segmento: "barbearia" });
    expect(d.cartoes[0].convite.texto).toBeTruthy();
    expect(d.cartoes[0].convite.href).toBeNull();
  });

  it("com telefone, o link abre a conversa pronta", () => {
    const d = diagnosticarTresNomes([nome({ telefone: "11988887777" })], {
      negocio: "Zé",
      segmento: "barbearia",
    });
    expect(d.cartoes[0].convite.href).toContain("wa.me/5511988887777");
  });

  it("nome vazio é descartado, não vira cartão sem nome", () => {
    const d = diagnosticarTresNomes([nome({ nome: "  " }), nome({ nome: "Ana" })], {
      negocio: "Zé",
      segmento: "barbearia",
    });
    expect(d.cartoes).toHaveLength(1);
  });

  it("lista vazia devolve zero cartões e não explode", () => {
    const d = diagnosticarTresNomes([], { negocio: "Zé", segmento: "barbearia" });
    expect(d.cartoes).toEqual([]);
  });
});

describe("o porquê é auditável — o dono confere de cabeça", () => {
  it("diz quantos dias faz, com o número que ele mesmo escolheu", () => {
    const d = diagnosticarTresNomes([nome({ nome: "Ana", diasSumido: 180 })], {
      negocio: "Zé",
      segmento: "barbearia",
    });
    expect(d.cartoes[0].porque).toContain("180");
  });

  it("compara com o ritmo do segmento, e diz que é do segmento", () => {
    const d = diagnosticarTresNomes([nome({ diasSumido: 180 })], {
      negocio: "Zé",
      segmento: "barbearia",
    });
    const p = d.cartoes[0].porque.toLowerCase();
    expect(p).toMatch(/barbearia|segmento|costuma/);
  });

  it("nunca afirma que é registro — é memória, e o texto diz isso", () => {
    const d = diagnosticarTresNomes([nome()], { negocio: "Zé", segmento: "barbearia" });
    expect(d.ressalva.toLowerCase()).toContain("você me contou");
  });

  it("a confiança é sempre baixa: três nomes de memória não são uma base", () => {
    const d = diagnosticarTresNomes([nome(), nome({ nome: "B" }), nome({ nome: "C" })], {
      negocio: "Zé",
      segmento: "barbearia",
    });
    expect(d.confianca).toBe("baixa");
  });
});

describe("não promete dinheiro que não sabe", () => {
  it("sem ticket informado, não devolve valor nenhum", () => {
    // Inventar "R$ X parados" a partir de três nomes seria número com cara de
    // dado. A Constituição proíbe: número nunca sai sem dizer de onde veio.
    const d = diagnosticarTresNomes([nome()], { negocio: "Zé", segmento: "barbearia" });
    expect(d.valorCents).toBeNull();
  });

  it("com ticket informado, o valor é dos três, e só dos três", () => {
    const d = diagnosticarTresNomes([nome(), nome({ nome: "B" })], {
      negocio: "Zé",
      segmento: "barbearia",
      ticketCents: 5_000,
    });
    // Dois clientes x R$50. Nada de extrapolar para a base inteira.
    expect(d.valorCents).toBe(10_000);
  });

  it("o texto do valor deixa claro que é só dos nomes citados", () => {
    const d = diagnosticarTresNomes([nome()], {
      negocio: "Zé",
      segmento: "barbearia",
      ticketCents: 5_000,
    });
    expect(d.textoDoValor?.toLowerCase()).toContain("só");
  });
});

describe("o convite não vaza o nome errado", () => {
  it("usa o primeiro nome, em caixa de gente", () => {
    const d = diagnosticarTresNomes([nome({ nome: "MARIA SILVA SANTOS" })], {
      negocio: "Barbearia do Zé",
      segmento: "barbearia",
    });
    expect(d.cartoes[0].convite.texto).toContain("Maria");
    expect(d.cartoes[0].convite.texto).not.toContain("SILVA SANTOS");
  });

  it("nome do negócio vazio não produz frase quebrada", () => {
    const d = diagnosticarTresNomes([nome()], { negocio: "   ", segmento: "barbearia" });
    expect(d.cartoes[0].convite.texto).not.toContain("da .");
    expect(d.cartoes[0].convite.texto).not.toContain("  ");
  });
});
