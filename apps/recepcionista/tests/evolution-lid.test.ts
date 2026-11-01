import { describe, expect, it } from "vitest";
import { parseMensagemDoDono, parseWebhookPayload } from "@/lib/whatsapp/evolution";

const PN = "5511999990000@s.whatsapp.net";
const LID = "123456789012345@lid";
function payload(key: Record<string, unknown>, message: Record<string, unknown> = { conversation: "Quero saber os horários." }) {
  return {
    event: "MESSAGES_UPSERT",
    instance: "nexora-empresa-ficticia",
    data: {
      key: { fromMe: false, id: "MENSAGEM-FICTICIA-1", ...key },
      message,
      pushName: "Cliente de teste",
      messageTimestamp: 1790000000,
    },
  };
}

describe("conversa individual por LID com PN alternativo comprovado", () => {
  it("LID e PN normal geram o mesmo contato, conteúdo e identidade da mensagem", () => {
    const normal = parseWebhookPayload(payload({ remoteJid: PN }));
    const lid = parseWebhookPayload(payload({ remoteJid: LID, remoteJidAlt: PN, addressingMode: "lid" }));
    expect(lid).toEqual(normal);
    expect(lid).toMatchObject({ phone: "5511999990000", messageId: "MENSAGEM-FICTICIA-1", text: "Quero saber os horários." });
  });

  it("não mistura o identificador do aparelho com o telefone", () => {
    for (const key of [
      { remoteJid: "5511999990000:12@s.whatsapp.net" },
      { remoteJid: "123456789012345:12@lid", remoteJidAlt: "5511999990000:12@s.whatsapp.net" },
    ]) {
      expect(parseWebhookPayload(payload(key))?.phone).toBe("5511999990000");
    }
  });

  it.each([undefined, null, LID, "5511999990000", "5511999990000@s.whatsapp.net.evil", "abc5511999990000@s.whatsapp.net"])(
    "não converte LID ou alternativa inválida em telefone: %s", (remoteJidAlt) => {
      expect(parseWebhookPayload(payload({ remoteJid: LID, remoteJidAlt }))).toBeNull();
    },
  );

  it.each(["123456@g.us", "status@broadcast", "123456@broadcast", "123456@newsletter", "123456@unknown"])(
    "PN alternativo não resgata grupo ou evento não individual: %s", (remoteJid) => {
      expect(parseWebhookPayload(payload({ remoteJid, remoteJidAlt: PN }))).toBeNull();
      expect(parseMensagemDoDono(payload({ remoteJid, remoteJidAlt: PN, fromMe: true }))).toBeNull();
    },
  );

  it("ignora alternativas PN conflitantes e conserva o PN quando a alternativa é LID", () => {
    expect(parseWebhookPayload(payload({ remoteJid: PN, remoteJidAlt: "5511888880000@s.whatsapp.net" }))).toBeNull();
    expect(parseWebhookPayload(payload({ remoteJid: PN, remoteJidAlt: LID }))?.phone).toBe("5511999990000");
  });

  it("mensagem do dono com LID continua separada do cliente e usa o PN do interlocutor", () => {
    const own = payload({ remoteJid: LID, remoteJidAlt: PN, fromMe: true });
    expect(parseWebhookPayload(own)).toBeNull();
    expect(parseMensagemDoDono(own)).toMatchObject({ phone: "5511999990000", messageId: "MENSAGEM-FICTICIA-1", text: "Quero saber os horários." });
    expect(parseMensagemDoDono(payload({ remoteJid: LID, fromMe: true, senderPn: PN }))).toBeNull();
    expect(parseMensagemDoDono(payload({ remoteJid: LID, remoteJidAlt: PN }))).toBeNull();
  });

  it("mantém o tratamento explícito de mídia sem interpretar o arquivo", () => {
    const result = parseWebhookPayload(payload({ remoteJid: LID, remoteJidAlt: PN }, { audioMessage: { seconds: 5 } }));
    expect(result).toMatchObject({ phone: "5511999990000", messageId: "MENSAGEM-FICTICIA-1", text: "[Mídia recebida: áudio; conteúdo não interpretado]" });
  });
});
