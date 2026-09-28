import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  limparNumeroWhatsApp,
  obterLinkWhatsAppDemo,
  WHATSAPP_DEMO_DEFAULT_NUMBER,
  WHATSAPP_DEMO_DEFAULT_TEXT,
} from "@/lib/whatsapp/demo";

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));
const semQuebras = (s: string) => s.replace(/\s+/g, " ");

describe("Canal de Demonstração no WhatsApp", () => {
  it("limpa número mantendo apenas dígitos válidos (55 + 10 ou 11 dígitos)", () => {
    expect(limparNumeroWhatsApp("55 (21) 97943-5139")).toBe("5521979435139");
    expect(limparNumeroWhatsApp("5521979435139")).toBe("5521979435139");
    expect(limparNumeroWhatsApp("12345")).toBeNull();
    expect(limparNumeroWhatsApp("")).toBeNull();
    expect(limparNumeroWhatsApp(null)).toBeNull();
  });

  it("gera o link wa.me com número padrão quando variável não está definida", () => {
    const link = obterLinkWhatsAppDemo();
    expect(link).toContain(`https://wa.me/${WHATSAPP_DEMO_DEFAULT_NUMBER}`);
    expect(link).toContain(encodeURIComponent(WHATSAPP_DEMO_DEFAULT_TEXT));
  });

  it("aceita texto customizado para o link de WhatsApp", () => {
    const link = obterLinkWhatsAppDemo("Olá! Quero testar para minha barbearia");
    expect(link).toContain(encodeURIComponent("Olá! Quero testar para minha barbearia"));
  });

  it("o card de demonstração traz a chamada 'Prefere ver funcionando antes de criar conta?'", () => {
    const card = semQuebras(leia("components/whatsapp-demo-card.tsx"));
    expect(card).toContain("Prefere ver funcionando antes de criar conta?");
    expect(card).toContain("obterLinkWhatsAppDemo");

    const home = semQuebras(leia("app/page.tsx"));
    expect(home).toContain("WhatsAppDemoCard");
    expect(home).toContain("<DemoAtendente");
  });

  it("a página de cadastro traz a opção de teste direto no WhatsApp para evitar desistência", () => {
    const cadastro = semQuebras(leia("app/cadastro/page.tsx"));
    expect(cadastro).toContain("Prefere ver funcionando antes de criar conta?");
    expect(cadastro).toContain("obterLinkWhatsAppDemo");
  });

  it("a página de preços traz o WhatsAppDemoCard", () => {
    const precos = semQuebras(leia("app/precos/page.tsx"));
    expect(precos).toContain("WhatsAppDemoCard");
  });

  it("o componente DemoAtendente possui o modo interativo de teste ao vivo por seleção", () => {
    const demo = semQuebras(leia("components/demo-atendente.tsx"));
    expect(demo).toContain("Simulação interativa");
    expect(demo).toContain("/api/demo/chat");
    expect(demo).toContain("Começar teste grátis");
  });

  it("a nova página de clínica (/clinica) existe e está pronta para anúncios nichados", () => {
    const clinica = semQuebras(leia("app/clinica/page.tsx"));
    expect(clinica).toContain("Para clínicas de estética, spas e salões de beleza");
    expect(clinica).toContain("WhatsAppDemoCard");
  });
});
