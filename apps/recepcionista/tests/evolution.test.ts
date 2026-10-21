import { describe, expect, it } from "vitest";
import {
  formatarNumeroWhatsApp,
  idDoEnvio,
  isPairingCode,
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

  it.each([
    ["audioMessage", "áudio"], ["imageMessage", "imagem"], ["documentMessage", "documento"],
    ["videoMessage", "vídeo"], ["stickerMessage", "figurinha"],
  ])("registra %s como mídia não interpretada", (campo, rotulo) => {
    const payload = basePayload({ message: { [campo]: { url: "https://arquivo.example/privado", fileName: "diagnóstico inventado.pdf" } } });
    const recebida = parseWebhookPayload(payload);
    expect(recebida?.text).toBe(`[Mídia recebida: ${rotulo}; conteúdo não interpretado]`);
    expect(recebida?.messageId).toBe("MSG123");
    expect(recebida?.text).not.toMatch(/https:|diagnóstico/i);
  });

  it("preserva legenda escrita sem confundi-la com leitura da imagem", () => {
    const recebida = parseWebhookPayload(basePayload({
      message: { imageMessage: { caption: " Quero falar com uma pessoa ", url: "https://arquivo.example" } },
    }));
    expect(recebida?.text).toBe("[Mídia recebida: imagem; conteúdo não interpretado]\nQuero falar com uma pessoa");
  });

  it("normaliza documento com legenda e áudio em mensagem temporária", () => {
    const documento = parseWebhookPayload(basePayload({ message: {
      documentWithCaptionMessage: { message: { documentMessage: { caption: "Segue o comprovante" } } },
    } }));
    expect(documento?.text).toBe("[Mídia recebida: documento; conteúdo não interpretado]\nSegue o comprovante");
    const audio = parseWebhookPayload(basePayload({ message: {
      ephemeralMessage: { message: { viewOnceMessageV2: { message: { audioMessage: { seconds: 12 } } } } },
    } }));
    expect(audio?.text).toBe("[Mídia recebida: áudio; conteúdo não interpretado]");
  });

  it("limita a legenda longa sem cortar o aviso de conteúdo não interpretado", () => {
    const recebida = parseWebhookPayload(basePayload({ message: {
      imageMessage: { caption: "a".repeat(6000) },
    } }));
    expect(recebida?.text).toHaveLength(4000);
    expect(recebida?.text).toMatch(/^\[Mídia recebida: imagem; conteúdo não interpretado\]\na+$/);
  });

  it("não transforma metadados e legendas inválidas em descrição do arquivo", () => {
    const recebida = parseWebhookPayload(basePayload({ message: {
      documentMessage: { caption: { text: "pago" }, fileName: "pago.pdf", title: "Pagamento confirmado" },
    } }));
    expect(recebida?.text).toBe("[Mídia recebida: documento; conteúdo não interpretado]");
  });

  it("encerra envelopes excessivamente aninhados sem inventar conteúdo", () => {
    let message: Record<string, unknown> = { audioMessage: { seconds: 12 } };
    for (let i = 0; i < 5; i++) message = { ephemeralMessage: { message } };
    expect(parseWebhookPayload(basePayload({ message }))).toBeNull();
  });

  it("ignora reação, evento de protocolo e objeto de mídia inválido", () => {
    for (const message of [{ reactionMessage: { text: "👍" } }, { protocolMessage: { type: 0 } }, { audioMessage: "inválido" }]) {
      expect(parseWebhookPayload(basePayload({ message }))).toBeNull();
    }
  });

  it("mídia continua respeitando grupos e remetente dono", () => {
    for (const key of [
      { remoteJid: "123456789@g.us", fromMe: false, id: "X" },
      { remoteJid: "5511999998888@s.whatsapp.net", fromMe: true, id: "X" },
    ]) {
      expect(parseWebhookPayload(basePayload({ key, message: { audioMessage: { seconds: 12 } } }))).toBeNull();
    }
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
      text: "Oi, vocês atendem sábado?",
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

describe("isPairingCode", () => {
  it("aceita código de pareamento padrão de 8 caracteres alfanuméricos", () => {
    expect(isPairingCode("ABC123XY")).toBe(true);
    expect(isPairingCode("7H8K9P2M")).toBe(true);
  });

  it("aceita código com traço intermediário", () => {
    expect(isPairingCode("ABCD-1234")).toBe(true);
  });

  it("rejeita a string interna de QR Code bruto da Baileys/Evolution", () => {
    const rawQr =
      "2@j3y17BsNhLer3ENp3cPgY9amZsrZe/rbe2f6eC4jKpAc1mqmj7I3lHyv04D1Hw3JjHkcVwsWrNTIqpCU9Z1mdAcJ47NM9QpEBo=,tr+1ub5JaF6qsbbdyUo0jmm/pqlePV057Xw=";
    expect(isPairingCode(rawQr)).toBe(false);
  });

  it("rejeita strings com arroba, vírgula, barra ou mais", () => {
    expect(isPairingCode("2@j3y17B")).toBe(false);
    expect(isPairingCode("ABC/1234")).toBe(false);
    expect(isPairingCode("ABC+1234")).toBe(false);
  });

  it("rejeita códigos com comprimento fora da faixa válida (6 a 12 caracteres)", () => {
    expect(isPairingCode("12345")).toBe(false); // curto demais
    expect(isPairingCode("1234567890123")).toBe(false); // longo demais (13)
  });

  it("rejeita valores nulos, vazios ou de outros tipos", () => {
    expect(isPairingCode(null)).toBe(false);
    expect(isPairingCode(undefined)).toBe(false);
    expect(isPairingCode("")).toBe(false);
    expect(isPairingCode(12345678)).toBe(false);
    expect(isPairingCode({})).toBe(false);
  });
});

describe("formatarNumeroWhatsApp", () => {
  it("adiciona prefixo 55 para telefones com 10 dígitos (DDD + fixo)", () => {
    expect(formatarNumeroWhatsApp("1133334444")).toBe("551133334444");
    expect(formatarNumeroWhatsApp("(11) 3333-4444")).toBe("551133334444");
  });

  it("adiciona prefixo 55 para celulares com 11 dígitos (DDD + 9 dígitos)", () => {
    expect(formatarNumeroWhatsApp("11988887777")).toBe("5511988887777");
    expect(formatarNumeroWhatsApp("(21) 97777-6666")).toBe("5521977776666");
  });

  it("preserva números que já possuem DDI 55", () => {
    expect(formatarNumeroWhatsApp("5511988887777")).toBe("5511988887777");
    expect(formatarNumeroWhatsApp("+55 (11) 98888-7777")).toBe("5511988887777");
  });

  it("retorna string vazia se não houver dígitos", () => {
    expect(formatarNumeroWhatsApp("")).toBe("");
    expect(formatarNumeroWhatsApp("   ")).toBe("");
    expect(formatarNumeroWhatsApp("abc")).toBe("");
  });
});
