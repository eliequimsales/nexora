import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");

describe("Fase 2: Conexão Direta do WhatsApp & Disparo com 1 Clique", () => {
  it("a tela da Onda contém o botão de envio direto de recuperação", () => {
    const onda = readFileSync(join(RAIZ, "app/painel/onda/page.tsx"), "utf8");
    expect(onda).toContain("Enviar mensagem de recuperação");
    expect(onda).toContain("ModalConectarWhatsApp");
    expect(onda).toContain("/api/onda/enviar");
  });

  it("o modal de conexão explica os passos sem usar termos técnicos proibidos", () => {
    const modal = readFileSync(
      join(RAIZ, "components/painel/modal-conectar-whatsapp.tsx"),
      "utf8",
    );
    expect(modal).toContain("Ligar meu WhatsApp");
    expect(modal).toContain("Aparelhos conectados");
    expect(modal).toContain("Conectar um aparelho");
    // Não pode conter termos técnicos
    expect(modal).not.toContain("webhook");
    expect(modal).not.toContain("instância");
  });

  it("a rota /api/onda/enviar valida parâmetros e auto-registra AGUARDANDO", () => {
    const rota = readFileSync(join(RAIZ, "app/api/onda/enviar/route.ts"), "utf8");
    expect(rota).toContain("sendWhatsAppText");
    expect(rota).toContain('outcome: "AGUARDANDO"');
    expect(rota).toContain("exigirAcesso");
    expect(rota).toContain("ENVIAR_TOQUE");
    expect(rota).toContain("variantesDeTelefone");
  });
});
