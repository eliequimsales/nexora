import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A PORTA LATERAL.
 *
 * A onda trava sem plano (GERAR_ONDA). Mas "Meus clientes" devolvia a mensagem
 * pronta de cada cliente, e a tela transformava isso em "Chamar no WhatsApp":
 * a mesma recuperação, sem passar por trava nenhuma. ENVIAR_TOQUE existia em
 * lib/billing/acesso.ts e nenhuma rota exigia.
 *
 * A LISTA continua saindo sempre, porque é dado do dono. O que trava é a
 * mensagem pronta, que é a ação que se vende.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

describe("a rota de clientes", () => {
  const rota = leia("app/api/clientes/route.ts");

  it("confere ENVIAR_TOQUE contra o estado da conta", () => {
    expect(rota).toContain("estadoDaEmpresa(");
    expect(rota).toContain("podeExecutar(");
    expect(rota).toContain('"ENVIAR_TOQUE"');
  });

  it("só devolve a mensagem pronta com permissão, e nunca para quem pediu para parar", () => {
    expect(rota).toMatch(/mensagemReativacao:\s*permissao\.pode\s*&&\s*!c\.optOut\s*\?/);
  });

  it("sem permissão, devolve a recusa com a ação de resolver", () => {
    expect(rota).toMatch(/trava:\s*permissao\.pode\s*\?\s*null/);
  });

  // Nada de 402 aqui: a trava vira campo da resposta. Recusar a rota inteira
  // sequestraria a lista, que é dado do dono.
  it("a lista em si não depende de plano", () => {
    expect(rota).not.toContain("exigirAcesso(");
  });
});

describe("a tela de clientes", () => {
  const pagina = leia("app/painel/clientes/importar/page.tsx");

  it("guarda a trava que a rota devolve", () => {
    expect(pagina).toContain("data.trava");
  });

  it("sem mensagem, troca o WhatsApp pelo botão de liberar", () => {
    expect(pagina).toContain("Liberar mensagem pronta");
    expect(pagina).toMatch(/c\.mensagemReativacao\s*\?\s*linkDoWhatsApp\(/);
  });
});
