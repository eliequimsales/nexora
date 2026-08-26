import { describe, expect, it } from "vitest";
import {
  MAX_HISTORY_MESSAGES,
  MAX_REPLY_LENGTH,
  parseReceptionistReply,
  toChatMessages,
  type HistoryMessage,
} from "@/lib/ai/provider";

describe("parseReceptionistReply", () => {
  it("valida JSON limpo com todos os campos", () => {
    const reply = parseReceptionistReply(
      '{"resposta":"Olá! Como posso ajudar?","transferir_humano":false,"motivo_transferencia":"","nome_cliente":"Ana","interesse":"orçamento"}',
    );
    expect(reply.resposta).toBe("Olá! Como posso ajudar?");
    expect(reply.transferir_humano).toBe(false);
    expect(reply.nome_cliente).toBe("Ana");
    expect(reply.interesse).toBe("orçamento");
  });

  it("aceita JSON dentro de cerca de código (comum em modelos abertos)", () => {
    const raw = '```json\n{"resposta":"Oi!","transferir_humano":true,"motivo_transferencia":"pediu humano"}\n```';
    const reply = parseReceptionistReply(raw);
    expect(reply.transferir_humano).toBe(true);
    expect(reply.motivo_transferencia).toBe("pediu humano");
  });

  it("aceita texto extra ao redor do JSON", () => {
    const raw = 'Aqui está a resposta: {"resposta":"Oi!","transferir_humano":false} espero ter ajudado';
    expect(parseReceptionistReply(raw).resposta).toBe("Oi!");
  });

  it("coage booleanos enviados como string", () => {
    const reply = parseReceptionistReply('{"resposta":"Oi","transferir_humano":"true"}');
    expect(reply.transferir_humano).toBe(true);
  });

  it("preenche campos opcionais ausentes com string vazia", () => {
    const reply = parseReceptionistReply('{"resposta":"Oi","transferir_humano":false}');
    expect(reply.nome_cliente).toBe("");
    expect(reply.interesse).toBe("");
    expect(reply.motivo_transferencia).toBe("");
  });

  it("rejeita resposta sem JSON", () => {
    expect(() => parseReceptionistReply("desculpe, não entendi")).toThrow();
  });

  it("rejeita JSON sem o campo resposta", () => {
    expect(() => parseReceptionistReply('{"transferir_humano":false}')).toThrow();
  });

  it("rejeita resposta vazia", () => {
    expect(() => parseReceptionistReply('{"resposta":"","transferir_humano":false}')).toThrow();
  });

  it("corta respostas longas no limite (Atendente responde curto)", () => {
    const long = `${"Esta é uma frase de teste. ".repeat(60)}`;
    const reply = parseReceptionistReply(
      JSON.stringify({ resposta: long, transferir_humano: false }),
    );
    expect(reply.resposta.length).toBeLessThanOrEqual(MAX_REPLY_LENGTH + 1);
  });
});

describe("toChatMessages — contexto enviado ao modelo", () => {
  it("limita o histórico às últimas mensagens", () => {
    const history: HistoryMessage[] = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? "CUSTOMER" : "AI",
      content: `mensagem ${i}`,
    }));
    const messages = toChatMessages(history);
    expect(messages.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(messages[0].role).toBe("user");
    expect(messages[messages.length - 1].content).toBe("mensagem 39");
  });

  it("trunca mensagens individuais muito longas", () => {
    const messages = toChatMessages([{ role: "CUSTOMER", content: "x".repeat(5000) }]);
    expect(messages[0].content.length).toBeLessThanOrEqual(600);
  });
});
