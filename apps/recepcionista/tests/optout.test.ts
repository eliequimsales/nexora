import { describe, expect, it } from "vitest";
import { pediuParaParar } from "@/lib/recuperacao/optout";

/**
 * OPT-OUT POR TEXTO.
 *
 * A assimetria que rege este arquivo: um FALSO POSITIVO silencia para sempre um
 * cliente do dono, sem que o dono saiba por quê — e ele nunca mais aparece em
 * onda nenhuma. Um FALSO NEGATIVO só significa que o dono marca na mão, no
 * botão que existe na tela. Por isso, na dúvida, NÃO marcar.
 */

describe("pedidos claros de parar", () => {
  const claros = [
    "PARAR",
    "parar",
    "Parar.",
    "  PARAR  ",
    "PARE",
    "pare",
    "sair",
    "SAIR",
    "descadastrar",
    "me descadastra",
    "não quero mais receber",
    "nao quero mais receber essas mensagens",
    "pare de me mandar mensagem",
    "para de me mandar msg",
    "me tira dessa lista",
    "me tire da lista",
    "remover meu número",
    "não me mande mais mensagens",
  ];

  for (const texto of claros) {
    it(`reconhece: ${JSON.stringify(texto)}`, () => {
      expect(pediuParaParar(texto)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// O CAMPO MINADO DO PORTUGUÊS BRASILEIRO. Em barbearia e salão, "parar" quase
// nunca quer dizer "pare de falar comigo" — quer dizer PASSAR LÁ. E "cancelar"
// quase sempre é o HORÁRIO, não o cadastro. Marcar opt-out nesses casos é
// silenciar justamente o cliente que estava voltando.
// ---------------------------------------------------------------------------
describe("armadilhas que NÃO podem virar opt-out", () => {
  const inocentes = [
    "vou parar aí amanhã",
    "posso parar aí sábado?",
    "dou uma parada aí depois do almoço",
    "vou parar aí pra cortar",
    "quero cancelar meu horário",
    "preciso cancelar de sexta",
    "cancela pra mim o de terça",
    "pode remarcar? não vou conseguir sair do trabalho",
    "só saindo daqui 19h",
    "vou sair de férias, volto dia 20",
    "parabéns pelo trabalho",
    "não quero mais aquele corte, quero outro",
    "quero mais um horário",
  ];

  for (const texto of inocentes) {
    it(`ignora: ${JSON.stringify(texto)}`, () => {
      expect(pediuParaParar(texto)).toBe(false);
    });
  }
});

describe("entradas degeneradas", () => {
  it("texto vazio ou lixo não marca ninguém", () => {
    expect(pediuParaParar("")).toBe(false);
    expect(pediuParaParar("   ")).toBe(false);
    expect(pediuParaParar("👍")).toBe(false);
    expect(pediuParaParar(null as unknown as string)).toBe(false);
    expect(pediuParaParar(undefined as unknown as string)).toBe(false);
  });
});
