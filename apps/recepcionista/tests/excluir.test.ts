import { describe, expect, it } from "vitest";
import {
  filtrarSuprimidos,
  hashTelefone,
  planejarExclusaoDeCliente,
  telefoneCanonico,
  type ClienteParaExcluir,
} from "@/lib/dados/excluir";

/**
 * ELIMINAÇÃO (LGPD art. 18, VI) — o direito que o Contrato de Operador promete
 * cumprir "dentro de 15 dias" e que até agora dependia de alguém rodar SQL na
 * mão.
 *
 * Apagar cliente tem duas armadilhas que nenhum DELETE resolve sozinho:
 *
 *   1. O Livro-Caixa da Recuperação é registro FINANCEIRO do dono. Apagar as
 *      entradas junto com a pessoa reescreve o faturamento do passado — e o
 *      North Star do produto é justamente Receita Recuperada comprovada.
 *
 *   2. Quem pediu PARAR e foi apagado volta na próxima importação da mesma
 *      planilha, e é contatado outra vez. A exclusão, feita ingenuamente,
 *      DESFAZ o opt-out.
 */

function cliente(over: Partial<ClienteParaExcluir> = {}): ClienteParaExcluir {
  return {
    id: over.id ?? "cus_1",
    telefone: over.telefone ?? "11988887777",
    optOut: over.optOut ?? false,
    visitas: over.visitas ?? 0,
    toques: over.toques ?? 0,
    agendamentosFuturos: over.agendamentosFuturos ?? 0,
    recuperacoes: over.recuperacoes ?? [],
  };
}

describe("o que sai e o que fica", () => {
  it("apaga o cliente e tudo que só existe por causa dele", () => {
    const plano = planejarExclusaoDeCliente(
      cliente({ id: "cus_9", visitas: 12, toques: 4, agendamentosFuturos: 1 }),
    );
    expect(plano.apagar.customerId).toBe("cus_9");
    expect(plano.apagar.visitas).toBe(12);
    expect(plano.apagar.toques).toBe(4);
    expect(plano.apagar.agendamentos).toBe(1);
  });

  it("o dinheiro do Livro-Caixa é anonimizado, nunca apagado", () => {
    const plano = planejarExclusaoDeCliente(
      cliente({
        recuperacoes: [
          { id: "rec_1", valorCents: 5000 },
          { id: "rec_2", valorCents: 8000 },
        ],
      }),
    );
    expect(plano.anonimizar).toEqual(["rec_1", "rec_2"]);
    expect(plano.valorPreservadoCents).toBe(13000);
  });

  it("cliente sem retorno registrado não tem nada a anonimizar", () => {
    expect(planejarExclusaoDeCliente(cliente()).anonimizar).toEqual([]);
  });
});

describe("apagar não pode desfazer o PARAR", () => {
  it("quem pediu para parar entra na lista de supressão", () => {
    const plano = planejarExclusaoDeCliente(cliente({ optOut: true, telefone: "11988887777" }));
    expect(plano.suprimir).toBe(hashTelefone("11988887777"));
  });

  it("quem nunca pediu para parar não vira lista de gente marcada", () => {
    // Guardar hash de todo mundo que já foi apagado seria construir, em nome
    // da privacidade, exatamente o cadastro sombra que a LGPD quer evitar.
    expect(planejarExclusaoDeCliente(cliente({ optOut: false })).suprimir).toBeNull();
  });

  it("telefone ilegível não gera hash de lixo", () => {
    expect(planejarExclusaoDeCliente(cliente({ optOut: true, telefone: "123" })).suprimir).toBeNull();
  });
});

describe("o telefone precisa cair sempre no mesmo hash", () => {
  it("as três grafias do mesmo número dão o mesmo canônico", () => {
    const esperado = telefoneCanonico("11988881234");
    expect(esperado).toBeTruthy();
    expect(telefoneCanonico("5511988881234")).toBe(esperado);
    expect(telefoneCanonico("1188881234")).toBe(esperado);
    expect(telefoneCanonico("(11) 98888-1234")).toBe(esperado);
  });

  it("números diferentes não colidem", () => {
    expect(hashTelefone("11988881234")).not.toBe(hashTelefone("11988881235"));
  });

  it("o hash não carrega os dígitos do telefone dentro dele", () => {
    // Se desse para ler o número no hash, a lista de supressão seria um
    // cadastro de telefones com passo extra — e não uma proteção.
    const h = hashTelefone("11988881234");
    expect(h).not.toContain("988881234");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o mesmo número hasheado duas vezes dá o mesmo resultado", () => {
    expect(hashTelefone("11988881234")).toBe(hashTelefone("11988881234"));
  });

  it("telefone inválido não vira hash", () => {
    expect(hashTelefone("abc")).toBeNull();
    expect(telefoneCanonico("abc")).toBeNull();
  });
});

describe("a lista de supressão barra o retorno pela planilha", () => {
  const suprimido = hashTelefone("11988887777")!;

  it("cliente na lista não entra de novo, mesmo com outra grafia", () => {
    const r = filtrarSuprimidos(
      [{ telefone: "5511988887777" }, { telefone: "11999996666" }],
      new Set([suprimido]),
    );
    expect(r.permitidos.map((c) => c.telefone)).toEqual(["11999996666"]);
    expect(r.suprimidos).toBe(1);
  });

  it("sem lista de supressão, ninguém é barrado", () => {
    const clientes = [{ telefone: "11988887777" }, { telefone: "11999996666" }];
    const r = filtrarSuprimidos(clientes, new Set());
    expect(r.permitidos).toHaveLength(2);
    expect(r.suprimidos).toBe(0);
  });

  it("telefone ilegível passa: quem decide se serve é o parser, não a supressão", () => {
    const r = filtrarSuprimidos([{ telefone: "123" }], new Set([suprimido]));
    expect(r.permitidos).toHaveLength(1);
  });
});
