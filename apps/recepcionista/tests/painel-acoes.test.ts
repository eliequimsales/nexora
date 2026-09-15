import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TODA RECUSA DEVOLVE UMA AÇÃO — E TODO NÚMERO EM DESTAQUE TEM QUE ESTAR CERTO.
 *
 * Três defeitos que o mapeamento de 12/09/2026 encontrou e que este teste
 * impede de voltar:
 *
 * 1. O servidor recusa com `{ motivo, acao: { texto, href } }` (lib/billing/
 *    acesso.ts) e TRÊS telas liam só `error`, jogando o botão fora. No botão de
 *    conectar o WhatsApp era pior: a resposta 402 não traz `state`, então o
 *    clique não fazia absolutamente nada — nem erro, nem caminho para pagar.
 *
 * 2. O Livro-Caixa somava em memória as últimas 200 linhas. Passando disso, o
 *    total parava de crescer e divergia de /painel/assinatura, que soma no
 *    banco. Dois números para o mesmo dinheiro destroem exatamente a confiança
 *    que a tela existe para construir — e agora esse número é o destaque.
 *
 * 3. O botão de exemplo é novo e traz um risco novo: se o dono salvar o
 *    exemplo, clientes inventados entram na lista real, aparecem na Onda e
 *    recebem mensagem. Base suja não tem desfazer.
 */

const RAIZ = join(__dirname, "..");
// O `[^:]` antes do `//` impede que `https://wa.me/…` seja confundido com
// comentário e apagado — o link estava lá e a varredura é que não via.
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
// Espaço normalizado: no JSX uma frase quebra em várias linhas com indentação,
// e a busca por ela falharia por causa da formatação, não do conteúdo.
const leia = (rel: string) =>
  semComentarios(readFileSync(join(RAIZ, rel), "utf8")).replace(/\s+/g, " ");

describe("a recusa de assinatura vira botão, não beco", () => {
  const TELAS = [
    "app/painel/onda/page.tsx",
    "app/painel/clientes/importar/page.tsx",
    "app/painel/configuracoes/page.tsx",
  ];

  for (const tela of TELAS) {
    it(`${tela} mostra o motivo e o botão que o servidor mandou`, () => {
      const fonte = leia(tela);
      // Preso ao `recusa` de propósito, e não a um `acao.href` qualquer: a Onda
      // tem OUTRA ação na tela (a do estado vazio), e ela sozinha satisfazia o
      // guarda — dava verde com o caminho do 402 quebrado. Provado plantando a
      // quebra em 12/09/2026.
      expect(fonte, "precisa guardar a recusa 402 que o servidor mandou").toContain("setRecusa");

      // Desde 15/09/2026 a Onda entrega a recusa ao cartão da oferta, que desenha
      // o botão. Continua preso ao `recusa`: é `acao={recusa.acao}` que precisa
      // chegar ao cartão, e o cartão que precisa usar o href e o texto recebidos.
      const peloCartao = /<CartaoDaOferta[^>]*acao=\{recusa\.acao\}/.test(fonte);
      if (peloCartao) {
        const cartao = leia("components/cobranca/cartao-da-oferta.tsx");
        expect(fonte, "o motivo da recusa precisa chegar ao cartão").toContain(
          "motivo={recusa.motivo}",
        );
        expect(cartao, "o cartão precisa levar o dono para onde ele resolve").toContain(
          "href={acao.href}",
        );
        expect(cartao, "o cartão precisa mostrar o texto do botão que veio do servidor").toContain(
          "{acao.texto}",
        );
        return;
      }

      expect(fonte, "precisa levar o dono para onde ele resolve").toContain("recusa.acao.href");
      expect(fonte, "precisa mostrar o texto do botão que veio do servidor").toContain(
        "recusa.acao.texto",
      );
    });
  }

  it("a Onda para de achatar todo erro numa frase só", () => {
    expect(leia("app/painel/onda/page.tsx")).not.toContain("Não consegui montar a onda agora.");
  });

  it("o botão de ligar o WhatsApp não falha mais em silêncio", () => {
    const fonte = leia("app/painel/configuracoes/page.tsx");
    // Antes: `if (data.state) setWa(data.state)` e mais nada — 402 sumia.
    expect(fonte).toMatch(/res\.status === 402|!res\.ok/);
  });
});

describe("o erro cru do servidor não chega na tela", () => {
  it("a caixa vermelha do WhatsApp não imprime wa.error direto", () => {
    const fonte = leia("app/painel/configuracoes/page.tsx");
    expect(fonte).not.toMatch(/\{\s*wa\.error\s*\}/);
  });
});

describe("o Livro-Caixa soma no banco, não na memória", () => {
  const fonte = leia("app/painel/livro-caixa/page.tsx");

  it("usa agregação do Prisma para os totais", () => {
    expect(fonte).toContain("recoveryEntry.aggregate");
  });

  it("não soma mais a lista paginada", () => {
    expect(fonte).not.toMatch(/const\s+comprovadas\s*=/);
    expect(fonte).not.toMatch(/reduce\(\(s, e\) => s \+ e\.valueCents/);
  });

  it("continua limitando a LISTA, que é só exibição", () => {
    expect(fonte).toMatch(/take:\s*(\d+|[A-Z_]+)/);
  });

  it("decide o estado vazio pelo que existe no banco, não pelas 200 linhas", () => {
    expect(fonte).toMatch(/_count|totalDeEntradas/);
  });
});

describe("o botão de exemplo não suja a lista de verdade", () => {
  const fonte = leia("app/painel/clientes/importar/page.tsx");

  it("existe o atalho que preenche com o exemplo", () => {
    expect(fonte).toContain("EXEMPLO");
    expect(fonte).toMatch(/Preencher com exemplo|Ver um exemplo|exemplo de teste/i);
  });

  it("a tela sabe quando o conteúdo ainda é o exemplo", () => {
    expect(fonte).toContain("aindaEhOExemplo");
  });

  it("e nesse caso não deixa salvar", () => {
    expect(fonte).toMatch(/Apaga e cola a sua lista de verdade/i);
  });

  it("oferece campos estruturados (Nome, Telefone, Última visita, Valor) para o lojista", () => {
    expect(fonte).toContain("Cadastrar cliente");
    expect(fonte).toContain("Adicionar lista de clientes");
    expect(fonte).toContain("Adicionar outro cliente");
    expect(fonte).toContain("Última visita");
    expect(fonte).toContain("gerarTextoDeLinhas");
  });

  it("permite subir clientes em risco ao topo e exibe clientes cadastrados ordenados", () => {
    expect(fonte).toContain("Subir clientes em risco ao topo");
    expect(fonte).toContain("ordenarLinhasPorRisco");
    expect(fonte).toContain("Meus clientes cadastrados");
    expect(fonte).toContain("RISCO_CRITICO");
  });
});

describe("a Onda entrega o gesto em um clique e avisa o que é definitivo", () => {
  const fonte = leia("app/painel/onda/page.tsx");

  it("abre a conversa no WhatsApp com a mensagem pronta", () => {
    expect(fonte).toContain("wa.me");
    expect(fonte).toContain("variantesDeTelefone");
  });

  it("continua oferecendo copiar, para quem manda de outro aparelho", () => {
    expect(fonte).toMatch(/Copiar mensagem/);
  });

  it("avisa que o motivo escolhido silencia o cliente para sempre", () => {
    expect(fonte).toMatch(/nunca mais|para sempre/i);
    expect(fonte).toContain("deveSilenciar");
  });

  it("não volta a gravar SEM_RESPOSTA no clique de enviar", () => {
    // Mesma invariante de tests/desfecho.test.ts, repetida aqui de propósito:
    // é o bug que esvaziava o Livro-Caixa.
    expect(fonte).not.toMatch(/marcar\(card,\s*"SEM_RESPOSTA"\)/);
    expect(fonte).toContain("AGUARDANDO");
  });
});

describe("as instruções não apontam para telas fora do menu", () => {
  it("a tela do WhatsApp não manda o dono procurar abas que não existem", () => {
    const fonte = leia("app/painel/configuracoes/page.tsx");
    expect(fonte).not.toMatch(/aba\s+<?strong>?Conversas/i);
    expect(fonte).not.toMatch(/no Treinamento/i);
  });
});
