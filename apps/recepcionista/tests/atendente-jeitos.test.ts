import { describe, expect, it } from "vitest";
import * as C from "@/lib/atendente/constantes";
import {
  apresentacao,
  conversaDeExemplo,
  cumprimento,
  JEITOS,
  lerJeito,
  NOME_DO_JEITO,
  primeiroNomeDoCliente,
  textosDoJeito,
  URGENCIA,
  URGENCIA_CVV,
  type Jeito,
} from "@/lib/atendente/jeitos";

/**
 * OS TRÊS JEITOS DE FALAR.
 *
 * O dono escolhe lendo a mesma conversa escrita nos três jeitos, nunca
 * descrevendo um tom num campo vazio. Cada jeito tem os próprios textos prontos,
 * e nenhum deles finge ser gente ou fala de tecnologia.
 */

const EMOJI = /\p{Extended_Pictographic}/gu;
const emBrasilia = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 22, h + 3, m));

function amostras(jeito: Jeito): string[] {
  const t = textosDoJeito(jeito);
  const ap = apresentacao({ nome: "Bia", empresa: "Barbearia do Léo" });
  const valores: string[] = [
    t.saudacao({ cumprimento: "Boa noite", cliente: "Marina", apresentacao: ap }),
    t.saudacao({ cumprimento: "Bom dia", cliente: null, apresentacao: ap }),
    t.contextoFechado("amanhã às 9h"),
    t.contextoFechado(null),
    t.contextoExpediente,
    t.convite,
    t.ofertaLead({ servico: "Corte", detalhe: "R$ 45,00 · 40 min", quando: "amanhã" }),
    t.ofertaLead({ servico: "Corte", detalhe: null, quando: null }),
    t.respondaComNumero,
    t.respondaParaAnotar,
    t.anoteiHorario({ quando: "quarta, 23/09, às 11h", volta: "amanhã às 9h" }),
    t.anoteiHorario({ quando: "quarta, 23/09, às 11h", volta: null }),
    t.escolherServico,
    t.confirmacao({ quando: "quarta, 23/09, às 11h", servico: "Corte", profissional: "Léo" }),
    t.confirmacao({ quando: "quarta, 23/09, às 11h", servico: "Corte", profissional: null }),
    t.ocupado,
    t.semHorario("amanhã"),
    t.semHorario(null),
    t.semAgenda,
    t.linkAgenda("https://exemplo.app/agendar/barbearia"),
    t.pessoa("amanhã às 9h"),
    t.pessoa(null),
    t.reclamacao("amanhã às 9h"),
    t.reclamacao(null),
    t.naoSei("amanhã às 9h"),
    t.naoSei(null),
    t.preco({ servico: "Corte", preco: "R$ 45,00", duracao: "40 min" }),
    t.preco({ servico: "Corte", preco: "R$ 45,00", duracao: null }),
    t.semPreco("Luzes"),
    t.agradecimento,
    t.teto({ apresentacao: ap, volta: "amanhã às 9h" }),
    t.teto({ apresentacao: ap, volta: null }),
    t.limiteDoDia("amanhã às 9h"),
    t.limiteDoDia(null),
  ];
  return valores;
}

describe("as constantes do Atendente", () => {
  it("são os números que o fundador aprovou", () => {
    expect(C.TETO_CONVERSAS_MES).toBe(200);
    expect(C.SEMANA_GRATIS_DIAS).toBe(7);
    expect(C.SEMANA_GRATIS_CONVERSAS).toBe(50);
    expect(C.MINUTOS_SEM_RESPOSTA).toBe(5);
    expect(C.MAX_RESPOSTAS_POR_DIA).toBe(8);
    expect(C.JANELA_DO_DONO_MS).toBe(12 * 60 * 60 * 1000);
    expect(C.VALIDADE_DA_OFERTA_MS).toBe(2 * 60 * 60 * 1000);
  });
});

describe("apresentacao — nunca finge ser gente", () => {
  it("com nome: atendente virtual, sem artigo que suponha gênero", () => {
    expect(apresentacao({ nome: "Bia", empresa: "Barbearia do Léo" })).toBe(
      "Eu sou Bia, atendente virtual da Barbearia do Léo",
    );
  });

  it("sem nome: o atendimento virtual do negócio", () => {
    expect(apresentacao({ nome: "  ", empresa: "Studio X" })).toBe(
      "Aqui é o atendimento virtual da Studio X",
    );
  });
});

describe("cumprimento — pela hora de Brasília", () => {
  it("bom dia, boa tarde e boa noite", () => {
    expect(cumprimento(emBrasilia(8))).toBe("Bom dia");
    expect(cumprimento(emBrasilia(14))).toBe("Boa tarde");
    expect(cumprimento(emBrasilia(22))).toBe("Boa noite");
    expect(cumprimento(emBrasilia(2))).toBe("Boa noite");
  });
});

describe("os três jeitos", () => {
  for (const jeito of JEITOS) {
    it(`${NOME_DO_JEITO[jeito]}: nenhum texto finge ser gente nem fala de tecnologia`, () => {
      for (const texto of amostras(jeito)) {
        expect(texto, texto).not.toMatch(/robô|inteligência artificial|\bIA\b|sou humana|sou uma pessoa/i);
      }
    });

    // "Prontinho! quarta, 23/09" era o que o cliente lia em toda marcação.
    it(`${NOME_DO_JEITO[jeito]}: depois de exclamação, a frase começa com maiúscula`, () => {
      for (const texto of amostras(jeito)) {
        expect(texto, texto).not.toMatch(/[!?] [a-zà-ÿ]/);
      }
    });

    it(`${NOME_DO_JEITO[jeito]}: no máximo um emoji por texto`, () => {
      for (const texto of amostras(jeito)) {
        expect((texto.match(EMOJI) ?? []).length, texto).toBeLessThanOrEqual(1);
      }
    });

    // Sem saber quando a equipe volta, o texto não inventa hora.
    it(`${NOME_DO_JEITO[jeito]}: sem volta conhecida, nenhum número aparece`, () => {
      const t = textosDoJeito(jeito);
      for (const texto of [t.pessoa(null), t.reclamacao(null), t.naoSei(null), t.limiteDoDia(null)]) {
        expect(texto, texto).not.toMatch(/\d/);
      }
    });

    it(`${NOME_DO_JEITO[jeito]}: a volta e o serviço entram onde precisam`, () => {
      const t = textosDoJeito(jeito);
      expect(t.pessoa("amanhã às 9h")).toContain("amanhã às 9h");
      expect(t.confirmacao({ quando: "quarta, 23/09, às 11h", servico: "Corte", profissional: "Léo" })).toMatch(
        /quarta, 23\/09, às 11h[\s\S]*Corte[\s\S]*Léo/i,
      );
      expect(t.semPreco("Luzes")).toContain("Luzes");
    });
  }

  it("a mesma saudação soa diferente em cada jeito", () => {
    const ap = apresentacao({ nome: "Bia", empresa: "Barbearia do Léo" });
    const saudacoes = JEITOS.map((j) =>
      textosDoJeito(j).saudacao({ cumprimento: "Boa noite", cliente: "Marina", apresentacao: ap }),
    );
    expect(new Set(saudacoes).size).toBe(3);
    for (const s of saudacoes) expect(s).toContain("Marina");
  });

  it("a urgência é séria e igual nos três: manda para o 192", () => {
    const texto = URGENCIA("Clínica Sorriso");
    expect(texto).toContain("192");
    expect(texto).toContain("Clínica Sorriso");
    expect(texto.match(EMOJI)).toBeNull();
  });

  it("risco à própria vida aponta para o CVV, sem emoji", () => {
    const texto = URGENCIA_CVV("Clínica Sorriso");
    expect(texto).toContain("188");
    expect(texto.match(EMOJI)).toBeNull();
  });
});

describe("lerJeito", () => {
  it("aceita os três e cai no acolhedor com qualquer outra coisa", () => {
    expect(lerJeito("DIRETO")).toBe("DIRETO");
    expect(lerJeito("DESCONTRAIDO")).toBe("DESCONTRAIDO");
    expect(lerJeito("gritando")).toBe("ACOLHEDOR");
    expect(lerJeito(null)).toBe("ACOLHEDOR");
  });
});

describe("primeiroNomeDoCliente — o nome do WhatsApp, só quando parece nome", () => {
  it("pega o primeiro nome, com a inicial maiúscula", () => {
    expect(primeiroNomeDoCliente("Marina Souza")).toBe("Marina");
    expect(primeiroNomeDoCliente("joão")).toBe("João");
  });

  it("emoji, número ou apelido estranho não viram nome", () => {
    expect(primeiroNomeDoCliente("🔥🔥")).toBeNull();
    expect(primeiroNomeDoCliente("123456")).toBeNull();
    expect(primeiroNomeDoCliente("")).toBeNull();
    expect(primeiroNomeDoCliente(null)).toBeNull();
    expect(primeiroNomeDoCliente("Aaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
  });
});

describe("conversaDeExemplo — a mesma conversa nos três jeitos", () => {
  const dados = {
    empresa: "Barbearia do Léo",
    nome: "Bia",
    cliente: "Rafael",
    servico: "Corte",
    detalhe: "R$ 45,00 · 40 min",
    opcoes: ["1 · qua 23/09, 9h30 com Léo", "2 · qua 23/09, 11h com Léo", "3 · qua 23/09, 16h40 com Diego"],
    escolhida: { quando: "quarta, 23/09, às 11h", profissional: "Léo" },
    volta: "amanhã às 9h",
    cumprimento: "Boa noite",
  };

  it("o cliente pergunta, o Atendente se apresenta, oferece, e confirma a escolha", () => {
    for (const jeito of JEITOS) {
      const bolhas = conversaDeExemplo(jeito, dados);
      expect(bolhas[0].de).toBe("cliente");
      expect(bolhas.some((b) => b.de === "atendente" && b.texto.includes("Eu sou Bia"))).toBe(true);
      expect(bolhas.some((b) => b.texto.includes("2 · qua 23/09, 11h com Léo"))).toBe(true);
      expect(bolhas.at(-1)?.texto).toMatch(/quarta, 23\/09, às 11h/i);
    }
  });
});
