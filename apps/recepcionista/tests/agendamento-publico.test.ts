import { describe, expect, it } from "vitest";
import { entradaPorLink } from "@/lib/agenda/entrada-publica";

/**
 * A ROTA DE AGENDAMENTO É PÚBLICA E ESCREVE NA BASE DE OUTRA PESSOA.
 *
 * /api/agendar/[slug] não tem sessão — é o link que o dono manda no Instagram.
 * Ela cria e atualiza Customer, que é dado de terceiro na base do assinante.
 * Duas coisas estavam erradas ali:
 *
 * 1. Quem tinha pedido PARAR e voltava pelo link renascia com optOut falso, e
 *    voltava a receber onda. O agendamento é escolha dele; receber marketing
 *    de novo não é. São dois consentimentos diferentes, e um não ressuscita o
 *    outro.
 *
 * 2. `update: { name }` deixava qualquer pessoa que soubesse um telefone
 *    reescrever o nome daquele cliente na agenda do dono, sem autenticação
 *    nenhuma. A caderneta do dono é a fonte da verdade sobre quem é o cliente;
 *    um formulário público não reescreve.
 */

describe("cliente novo pelo link", () => {
  it("entra na base com o nome que ele mesmo informou", () => {
    const e = entradaPorLink({ existe: false, nomeInformado: "Ana Paula", suprimido: false });
    expect(e.criar).toEqual({ name: "Ana Paula", optOut: false });
  });

  it("quem está na lista de supressão consegue marcar, mas não volta para a onda", () => {
    // Ele pediu para parar e depois marcou horário. As duas coisas convivem:
    // atender é o serviço que ele procurou; mandar mensagem é o que ele
    // recusou. Criar com optOut falso desfaria o PARAR pela porta dos fundos.
    const e = entradaPorLink({ existe: false, nomeInformado: "Ana", suprimido: true });
    expect(e.criar).toEqual({ name: "Ana", optOut: true });
  });
});

describe("cliente que já existe", () => {
  it("não tem o nome reescrito por quem preencheu o formulário", () => {
    const e = entradaPorLink({ existe: true, nomeInformado: "OUTRO NOME", suprimido: false });
    expect(e.atualizar).toEqual({});
  });

  it("marcar horário também não reativa quem tinha pedido para parar", () => {
    const e = entradaPorLink({ existe: true, nomeInformado: "Ana", suprimido: true });
    expect(e.atualizar).toEqual({});
  });

  it("nunca devolve dados de criação para quem já existe", () => {
    expect(entradaPorLink({ existe: true, nomeInformado: "Ana", suprimido: false }).criar).toBeNull();
  });
});

describe("o nome informado é sanitizado antes de entrar na base", () => {
  it("espaço em volta não vira parte do nome", () => {
    const e = entradaPorLink({ existe: false, nomeInformado: "  Ana  ", suprimido: false });
    expect(e.criar?.name).toBe("Ana");
  });

  it("nome vazio não cria cliente sem nome nenhum", () => {
    const e = entradaPorLink({ existe: false, nomeInformado: "   ", suprimido: false });
    expect(e.criar?.name).toBe("Cliente");
  });
});
