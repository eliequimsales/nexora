import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..");

describe("Fase 2: Conexão Direta do WhatsApp & Disparo com 1 Clique", () => {
  it("a tela da Onda contém o botão de envio direto de recuperação", () => {
    const onda = readFileSync(join(RAIZ, "app/painel/onda/page.tsx"), "utf8");
    expect(onda).toContain("Enviar mensagem de recuperação");
    expect(onda).toContain("ModalConectarWhatsApp");
    expect(onda).toContain("/api/onda/enviar");
    expect(onda).toContain("/painel/configuracoes");
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
    // O envio passa pelo registro (lib/whatsapp/envio.ts): sem ele, o eco da
    // mensagem da Onda pareceria o dono respondendo pelo celular.
    expect(rota).toContain("enviarWhatsApp");
    expect(rota).toContain('outcome: "AGUARDANDO"');
    expect(rota).toContain("exigirAcesso");
    expect(rota).toContain("ENVIAR_TOQUE");
    expect(rota).toContain("variantesDeTelefone");
  });

  it("a tela de configurações (/painel/configuracoes) está ativa para conexão via QR Code sem redirecionamento artificial", () => {
    const configuracoes = readFileSync(join(RAIZ, "app/painel/configuracoes/page.tsx"), "utf8");
    expect(configuracoes).not.toContain("router.replace(\"/painel/clientes/importar\")");
    expect(configuracoes).not.toContain("redirecionando");
    expect(configuracoes).toContain("Passo");
    expect(configuracoes).toContain("Ligar meu WhatsApp");
  });

  it("a tela de Minha Conta possui o link para ligar o WhatsApp", () => {
    const assinatura = readFileSync(join(RAIZ, "app/painel/assinatura/page.tsx"), "utf8");
    expect(assinatura).toContain("Conexão do WhatsApp");
    expect(assinatura).toContain("/painel/configuracoes");
  });
});
