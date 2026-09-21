import { describe, expect, it } from "vitest";
import {
  idDoEnvio,
  parseConnectionUpdate,
  parseMensagemDoDono,
  parseQrUpdate,
  parseWebhookPayload,
} from "@/lib/whatsapp/evolution";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "messages.upsert",
    instance: "clinica-sorriso",
    data: {
      key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: false, id: "MSG123" },
      pushName: "Carla",
      message: { conversation: "Oi, vocês atendem sábado?" },
      ...overrides,
    },
  };
}

describe("parseWebhookPayload", () => {
  it("extrai mensagem de texto válida", () => {
    const result = parseWebhookPayload(basePayload());
    expect(result).toEqual({
      instance: "clinica-sorriso",
      phone: "5511999998888",
      text: "Oi, vocês atendem sábado?",
      senderName: "Carla",
      messageId: "MSG123",
    });
  });

  it("aceita o formato de evento com underscore (MESSAGES_UPSERT)", () => {
    const payload = { ...basePayload(), event: "MESSAGES_UPSERT" };
    expect(parseWebhookPayload(payload)).not.toBeNull();
  });

  it("lê texto de extendedTextMessage", () => {
    const payload = basePayload({ message: { extendedTextMessage: { text: "olá!" } } });
    expect(parseWebhookPayload(payload)?.text).toBe("olá!");
  });

  it("ignora mensagens enviadas por nós (fromMe)", () => {
    const payload = basePayload({
      key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true, id: "X" },
    });
    expect(parseWebhookPayload(payload)).toBeNull();
  });

  it("ignora grupos", () => {
    const payload = basePayload({
      key: { remoteJid: "123456789@g.us", fromMe: false, id: "X" },
    });
    expect(parseWebhookPayload(payload)).toBeNull();
  });

  it("ignora eventos que não são messages.upsert", () => {
    expect(parseWebhookPayload({ ...basePayload(), event: "connection.update" })).toBeNull();
  });

  it("ignora mensagens sem texto (mídia)", () => {
    const payload = basePayload({ message: { imageMessage: { url: "..." } } });
    expect(parseWebhookPayload(payload)).toBeNull();
  });

  it("trunca mensagens muito longas em 4000 caracteres", () => {
    const payload = basePayload({ message: { conversation: "a".repeat(6000) } });
    expect(parseWebhookPayload(payload)?.text).toHaveLength(4000);
  });

  it("preserva emojis e acentuação", () => {
    const payload = basePayload({ message: { conversation: "Olá!! 😀👍 Vocês têm horário amanhã?" } });
    expect(parseWebhookPayload(payload)?.text).toBe("Olá!! 😀👍 Vocês têm horário amanhã?");
  });

  it("ignora mensagens só com espaços", () => {
    const payload = basePayload({ message: { conversation: "   " } });
    expect(parseWebhookPayload(payload)).toBeNull();
  });

  it("rejeita payload malformado sem lançar", () => {
    expect(parseWebhookPayload(null)).toBeNull();
    expect(parseWebhookPayload({ foo: "bar" })).toBeNull();
    expect(parseWebhookPayload("string")).toBeNull();
  });
});

describe("parseConnectionUpdate", () => {
  it("extrai instância e estado do evento connection.update", () => {
    const result = parseConnectionUpdate({
      event: "connection.update",
      instance: "nexora-abc",
      data: { state: "open" },
    });
    expect(result).toEqual({ instance: "nexora-abc", state: "open" });
  });

  it("aceita o formato CONNECTION_UPDATE e o campo connection", () => {
    const result = parseConnectionUpdate({
      event: "CONNECTION_UPDATE",
      instance: "nexora-abc",
      data: { connection: "close" },
    });
    expect(result).toEqual({ instance: "nexora-abc", state: "close" });
  });

  it("retorna null para outros eventos e payloads inválidos", () => {
    expect(
      parseConnectionUpdate({ event: "messages.upsert", instance: "x", data: { state: "open" } }),
    ).toBeNull();
    expect(parseConnectionUpdate(null)).toBeNull();
    expect(parseConnectionUpdate({ event: "connection.update", instance: "x", data: {} })).toBeNull();
  });
});

describe("parseQrUpdate", () => {
  it("extrai o QR base64 aninhado do evento qrcode.updated", () => {
    const result = parseQrUpdate({
      event: "qrcode.updated",
      instance: "nexora-abc",
      data: { qrcode: { base64: "data:image/png;base64,AAA" } },
    });
    expect(result).toEqual({ instance: "nexora-abc", qrCode: "data:image/png;base64,AAA" });
  });

  it("aceita QRCODE_UPDATED com base64 direto", () => {
    const result = parseQrUpdate({
      event: "QRCODE_UPDATED",
      instance: "nexora-abc",
      data: { base64: "data:image/png;base64,BBB" },
    });
    expect(result?.qrCode).toBe("data:image/png;base64,BBB");
  });

  it("retorna null para outros eventos e payloads sem QR", () => {
    expect(parseQrUpdate({ event: "connection.update", instance: "x", data: {} })).toBeNull();
    expect(parseQrUpdate({ event: "qrcode.updated", instance: "x", data: {} })).toBeNull();
    expect(parseQrUpdate("lixo")).toBeNull();
  });
});

/**
 * O ID DE CADA ENVIO.
 *
 * O webhook devolve o eco de cada mensagem que a Nexora envia pelo número do
 * dono, e ele chega igual a uma mensagem que o dono digitou. O id que a
 * Evolution devolve no envio é o que permite separar as duas coisas.
 */
describe("idDoEnvio", () => {
  it("lê o id que a Evolution devolve no envio", () => {
    expect(
      idDoEnvio({
        key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true, id: "3EB0C431C26A1916E1" },
        status: "PENDING",
      }),
    ).toBe("3EB0C431C26A1916E1");
  });

  it("sem id reconhecível, devolve null em vez de inventar", () => {
    expect(idDoEnvio({})).toBeNull();
    expect(idDoEnvio(null)).toBeNull();
    expect(idDoEnvio({ key: { id: "" } })).toBeNull();
    expect(idDoEnvio({ key: { id: 42 } })).toBeNull();
  });
});

/**
 * A MENSAGEM QUE SAI DO NÚMERO DO DONO.
 *
 * O leitor das mensagens do cliente descarta tudo que é `fromMe`, e por isso o
 * sistema não via quando o dono respondia pelo celular. Este leitor pega essas
 * mensagens — sem decidir se é o dono ou o eco de um envio da Nexora.
 */
describe("parseMensagemDoDono", () => {
  const doDono = (overrides: Record<string, unknown> = {}) =>
    basePayload({
      key: { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true, id: "3EB0DONO" },
      messageTimestamp: 1790000000,
      ...overrides,
    });

  it("lê a mensagem que saiu do número do dono", () => {
    expect(parseMensagemDoDono(doDono())).toEqual({
      instance: "clinica-sorriso",
      phone: "5511999998888",
      messageId: "3EB0DONO",
      enviadaEm: new Date(1790000000 * 1000),
    });
  });

  it("foto e áudio também valem: o dono respondeu do mesmo jeito", () => {
    expect(parseMensagemDoDono(doDono({ message: { audioMessage: { seconds: 12 } } }))).not.toBeNull();
  });

  it("aceita o horário como texto e fica sem horário quando ele não vem", () => {
    expect(parseMensagemDoDono(doDono({ messageTimestamp: "1790000000" }))?.enviadaEm).toEqual(
      new Date(1790000000 * 1000),
    );
    expect(parseMensagemDoDono(doDono({ messageTimestamp: undefined }))?.enviadaEm).toBeNull();
  });

  it("mensagem do cliente não é do dono", () => {
    expect(parseMensagemDoDono(basePayload())).toBeNull();
  });

  it("ignora grupos, outros eventos e lixo", () => {
    expect(
      parseMensagemDoDono(doDono({ key: { remoteJid: "123@g.us", fromMe: true, id: "X" } })),
    ).toBeNull();
    expect(parseMensagemDoDono({ ...doDono(), event: "connection.update" })).toBeNull();
    expect(parseMensagemDoDono(null)).toBeNull();
  });

  it("o leitor das mensagens do cliente continua ignorando as do dono", () => {
    expect(parseWebhookPayload(doDono())).toBeNull();
  });
});
