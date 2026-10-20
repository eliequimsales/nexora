import { describe, expect, it } from "vitest";
import { pedidoDeSimulacao } from "@/lib/atendente/entrada";
import { midiasNaoInterpretadas, textoDeMidiaNaoInterpretada, textoSemMarcadoresDeMidia } from "@/lib/whatsapp/midia";

describe("mídias não interpretadas: contrato comum do WhatsApp e simulador", () => {
  it("identifica mídias de uma rajada sem perder perguntas textuais", () => {
    const texto = [
      textoDeMidiaNaoInterpretada("audio"),
      "Quanto custa o corte?",
      textoDeMidiaNaoInterpretada("imagem", "Essa é a referência"),
      textoDeMidiaNaoInterpretada("audio"),
    ].join("\n");
    expect(midiasNaoInterpretadas(texto)).toEqual(["audio", "imagem"]);
    expect(textoSemMarcadoresDeMidia(texto)).toBe("Quanto custa o corte?\nEssa é a referência");
  });

  it("perguntas sobre suporte a áudio não viram mídia recebida", () => {
    const texto = "Vocês respondem áudio e analisam imagem?";
    expect(midiasNaoInterpretadas(texto)).toEqual([]);
    expect(textoSemMarcadoresDeMidia(texto)).toBe(texto);
  });

  it("legenda explícita de urgência ou pedido de pessoa permanece disponível", () => {
    const texto = textoDeMidiaNaoInterpretada("video", "Meu filho está sangrando. Preciso falar com uma pessoa.");
    expect(textoSemMarcadoresDeMidia(texto)).toBe("Meu filho está sangrando. Preciso falar com uma pessoa.");
  });

  it.each(["audio", "imagem", "documento", "video", "figurinha"] as const)("permite simular %s sem anexar arquivo", (midia) => {
    const resultado = pedidoDeSimulacao.parse({ mensagens: [{ de: "cliente", midia }] });
    expect(resultado.mensagens[0].texto).toBe(textoDeMidiaNaoInterpretada(midia));
  });

  it("a legenda simulada vira texto, e nunca transcrição ou diagnóstico", () => {
    const resultado = pedidoDeSimulacao.parse({ mensagens: [{ de: "cliente", midia: "imagem", texto: "  Pode conferir?  " }] });
    expect(resultado.mensagens[0].texto).toBe("[Mídia recebida: imagem; conteúdo não interpretado]\nPode conferir?");
  });

  it("continua recusando mensagem vazia, tipo desconhecido e mídia atribuída ao atendente", () => {
    for (const mensagens of [
      [{ de: "cliente", texto: " " }],
      [{ de: "cliente", midia: "executavel" }],
      [{ de: "atendente", midia: "audio" }, { de: "cliente", texto: "oi" }],
    ]) expect(pedidoDeSimulacao.safeParse({ mensagens }).success).toBe(false);
  });
});
