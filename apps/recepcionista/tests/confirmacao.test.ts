import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deveConfirmar, montarConfirmacao, type DadosConfirmacao } from "@/lib/billing/confirmacao";
import { PRECO_MENSAL_CENTS, emReais } from "@/lib/billing/preco";
import { FORNECEDOR, VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";

/**
 * CONFIRMAÇÃO DA CONTRATAÇÃO — Decreto 7.962/2013, art. 4º, V.
 *
 * "O fornecedor deve confirmar imediatamente o recebimento da aceitação da
 * oferta." Não é cortesia de onboarding: é obrigação, e é a única prova que o
 * consumidor tem do que contratou e por quanto.
 *
 * O art. 2º manda junto a identificação do fornecedor — nome, CPF ou CNPJ,
 * endereço físico e eletrônico. Faltando isso, o e-mail existe mas não cumpre
 * o decreto.
 *
 * Este e-mail é TRANSACIONAL. Não passa pelo motor de reengajamento, não
 * respeita o intervalo mínimo entre envios e não leva link de descadastro:
 * ninguém pode optar por não receber a confirmação daquilo que contratou.
 */

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function dados(over: Partial<DadosConfirmacao> = {}): DadosConfirmacao {
  return {
    nome: over.nome ?? "Barbearia do Zé",
    emTeste: over.emTeste ?? false,
    proximaCobranca: over.proximaCobranca ?? d("2026-10-01"),
    ...over,
  };
}

const textoDe = (m: { assunto: string; corpo: string }) => `${m.assunto}\n${m.corpo}`;

describe("o que o consumidor precisa conseguir ler", () => {
  it("diz o preço que foi contratado, vindo do produto e não digitado", () => {
    expect(textoDe(montarConfirmacao(dados()))).toContain(emReais(PRECO_MENSAL_CENTS));
  });

  it("diz que é mensal e recorrente, não uma compra avulsa", () => {
    const t = textoDe(montarConfirmacao(dados())).toLowerCase();
    expect(t).toContain("todo mês");
  });

  it("diz a data da próxima cobrança", () => {
    expect(textoDe(montarConfirmacao(dados({ proximaCobranca: d("2026-10-01") })))).toContain(
      "01/10/2026",
    );
  });

  it("traz o direito de arrependimento do CDC com o prazo", () => {
    const t = textoDe(montarConfirmacao(dados())).toLowerCase();
    expect(t).toContain("7 dias");
    expect(t).toContain("art. 49");
  });

  it("termina numa ação: onde cancelar", () => {
    const m = montarConfirmacao(dados());
    expect(m.acao.href).toBe("/painel/assinatura");
    expect(m.acao.texto.toLowerCase()).toContain("assinatura");
  });

  it("registra a versão dos documentos que valia na contratação", () => {
    expect(textoDe(montarConfirmacao(dados()))).toContain(VERSAO_DOCUMENTOS);
  });
});

describe("identificação do fornecedor — Decreto 7.962/2013, art. 2º", () => {
  it("o e-mail carrega nome, documento, endereço e contato de quem cobrou", () => {
    const t = textoDe(montarConfirmacao(dados()));
    for (const campo of [FORNECEDOR.nome, FORNECEDOR.documento, FORNECEDOR.endereco, FORNECEDOR.email]) {
      expect(t).toContain(campo);
    }
  });
});

describe("teste grátis e cobrança são fatos diferentes", () => {
  it("em teste, diz com todas as letras que nada foi cobrado", () => {
    const t = textoDe(montarConfirmacao(dados({ emTeste: true }))).toLowerCase();
    expect(t).toContain("nada foi cobrado");
  });

  it("fora do teste, não afirma que nada foi cobrado", () => {
    const t = textoDe(montarConfirmacao(dados({ emTeste: false }))).toLowerCase();
    expect(t).not.toContain("nada foi cobrado");
  });

  it("sem data de próxima cobrança, não inventa uma", () => {
    const t = textoDe(montarConfirmacao(dados({ proximaCobranca: null })));
    expect(t).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("é o nome do assinante, não um 'Olá,' vazio", () => {
  it("usa o nome quando existe", () => {
    expect(montarConfirmacao(dados({ nome: "Salão da Ana" })).corpo).toContain("Salão da Ana");
  });

  it("nome vazio não produz saudação quebrada", () => {
    const corpo = montarConfirmacao(dados({ nome: "   " })).corpo;
    expect(corpo).not.toContain("Olá, ,");
    expect(corpo).not.toMatch(/^\s*,/);
  });
});

describe("confirmação é enviada uma vez, e só quando há contrato", () => {
  it("assinatura ativa e nunca confirmada: envia", () => {
    expect(deveConfirmar("active", null)).toBe(true);
  });

  it("período de teste também é contrato: envia", () => {
    // O art. 4º fala em confirmar a ACEITAÇÃO da oferta, não o pagamento. Quem
    // entrou no teste já contratou — inclusive a cobrança que vem depois.
    expect(deveConfirmar("trialing", null)).toBe(true);
  });

  it("já confirmada: não envia de novo", () => {
    // aplicarAssinatura roda a cada evento da Stripe, e reentrega de evento é
    // rotina. Sem a marca, o dono receberia a mesma confirmação várias vezes.
    expect(deveConfirmar("active", new Date())).toBe(false);
  });

  for (const status of ["incomplete", "incomplete_expired", "canceled", "past_due", "unpaid"]) {
    it(`status "${status}" não gera confirmação`, () => {
      expect(deveConfirmar(status, null)).toBe(false);
    });
  }

  it("sem status nenhum, não envia", () => {
    expect(deveConfirmar(null, null)).toBe(false);
  });
});

describe("não dá para cobrar antes de dizer quem está cobrando", () => {
  const rota = readFileSync(
    join(__dirname, "..", "app/api/billing/checkout/route.ts"),
    "utf8",
  );

  it("o checkout consulta a identificação do fornecedor", () => {
    // Sem isto, a primeira venda sairia com "[DEFINIR]" no lugar do nome de
    // quem cobrou — irregular pelo Decreto 7.962/2013, art. 2º, e com o
    // agravante de ficar por escrito no e-mail de confirmação.
    expect(rota).toContain("identificacaoCompleta()");
  });

  it("a checagem vem antes de qualquer chamada à Stripe", () => {
    expect(rota.indexOf("identificacaoCompleta()")).toBeLessThan(rota.indexOf("stripe()"));
  });
});

describe("a convergência da assinatura dispara a confirmação", () => {
  const converger = readFileSync(join(__dirname, "..", "lib/billing/converger.ts"), "utf8");

  it("aplicarAssinatura chama a confirmação", () => {
    expect(converger).toContain("confirmarContratacao");
    expect(converger).toContain("montarConfirmacao");
  });

  it("o envio não leva link de descadastro", () => {
    // enviarEmail com o terceiro argumento acrescentaria "Não quero mais
    // receber" na confirmação de um contrato — saída que não existe.
    expect(converger).not.toMatch(/montarConfirmacao\([\s\S]{0,400}\),\s*urlDescadastro/);
  });
});
