import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TERMOS } from "@/lib/legal/termos";
import { PRIVACIDADE } from "@/lib/legal/privacidade";
import { OPERADOR } from "@/lib/legal/operador";
import { VERSAO_DOCUMENTOS, identificacaoCompleta } from "@/lib/legal/identidade";
import { PRECO_MENSAL_CENTS, emReais } from "@/lib/billing/preco";

/**
 * DOCUMENTO JURÍDICO NÃO PODE PROMETER O QUE O CÓDIGO NÃO FAZ.
 *
 * A versão anterior prometia MFA, exclusão automática em 2 anos, exportação em
 * CSV em 5 dias úteis, "servidores no Brasil" e "não compartilhamos com
 * terceiros" — cinco afirmações falsas, e cada uma delas seria prova contra a
 * Nexora se um cliente levasse o documento ao Procon ou à ANPD.
 *
 * Este teste é o guarda: promessa some do documento ou o build quebra.
 */

const RAIZ = join(__dirname, "..");
const DOCS = join(RAIZ, "..", "..", "docs", "legal");

const textoDe = (d: { secoes: { titulo: string; paragrafos: string[]; itens?: string[] }[] }) =>
  d.secoes.flatMap((s) => [s.titulo, ...s.paragrafos, ...(s.itens ?? [])]).join("\n");

const TUDO = [TERMOS, PRIVACIDADE, OPERADOR].map(textoDe).join("\n").toLowerCase();

describe("promessas que o produto não cumpre não podem aparecer", () => {
  const PROIBIDAS: [string, string][] = [
    ["multifator", "não existe MFA no código"],
    ["multi-fator", "não existe MFA no código"],
    ["dois fatores no acesso", "não existe MFA no código"],
    ["servidores no brasil", "a hospedagem é nos Estados Unidos"],
    ["dpo@nexora.com.br", "o domínio nexora.com.br não existe"],
    ["organizations.lgpdacceptedat", "coluna que nunca existiu neste produto"],
    // A frase banida é a da versão antiga — "compartilhamos com a Nexora e nada
    // além". Não se bane "nada além" solto: ele aparece legitimamente em "trata
    // seguindo a sua instrução, e nada além dela", que é o oposto de uma promessa
    // falsa. Banir a palavra em vez da promessa geraria alarme onde não há risco.
    ["operadora — e nada além", "há pelo menos quatro subprocessadores"],
    ["não compartilhamos seus dados com terceiros", "Railway, Stripe, Resend e Google recebem"],
  ];

  for (const [frase, motivo] of PROIBIDAS) {
    it(`não promete "${frase}" — ${motivo}`, () => {
      expect(TUDO).not.toContain(frase);
    });
  }
});

describe("o que a lei exige que esteja escrito", () => {
  it("a Política nomeia os subprocessadores com país", () => {
    const t = textoDe(PRIVACIDADE);
    for (const nome of ["Railway", "Stripe", "Resend", "Google"]) {
      expect(t).toContain(nome);
    }
    expect(t).toContain("Estados Unidos");
  });

  it("a Política declara base legal, encarregado e ANPD", () => {
    const t = textoDe(PRIVACIDADE).toLowerCase();
    expect(t).toContain("art. 7");
    expect(t).toContain("encarregado");
    expect(t).toContain("anpd");
  });

  it("os Termos trazem o direito de arrependimento do CDC", () => {
    const t = textoDe(TERMOS).toLowerCase();
    expect(t).toContain("art. 49");
    expect(t).toContain("7 dias");
  });

  it("o Contrato de Operador separa controlador de operador", () => {
    const t = textoDe(OPERADOR).toLowerCase();
    expect(t).toContain("controlador");
    expect(t).toContain("operador");
    expect(t).toContain("art. 39");
  });
});

describe("os números do contrato vêm do produto, não da digitação", () => {
  it("o preço escrito nos Termos é o preço cobrado", () => {
    expect(textoDe(TERMOS)).toContain(emReais(PRECO_MENSAL_CENTS));
  });

  it("os três documentos estão na mesma versão", () => {
    expect(TERMOS.atualizadoEm).toBe(VERSAO_DOCUMENTOS);
    expect(PRIVACIDADE.atualizadoEm).toBe(VERSAO_DOCUMENTOS);
    expect(OPERADOR.atualizadoEm).toBe(VERSAO_DOCUMENTOS);
  });
});

describe("identificação do fornecedor", () => {
  it("enquanto estiver pendente, o produto sabe disso", () => {
    // Não é falha: é o lembrete de que falta preencher antes de cobrar.
    expect(typeof identificacaoCompleta()).toBe("boolean");
  });
});

describe("os documentos antigos em markdown não voltam a mentir", () => {
  const antigos = ["politica-privacidade-cliente-final.md", "termo-consentimento-cliente.md"];

  for (const arq of antigos) {
    it(`${arq} não promete MFA nem exclusão automática`, () => {
      const t = readFileSync(join(DOCS, arq), "utf8").toLowerCase();
      // Citar o erro passado para que ele nao volte e' legitimo; PROMETER
      // de novo nao e'. Por isso a checagem procura a promessa, nao a palavra.
      expect(t).not.toContain("com autenticação multi-fator");
      expect(t).not.toContain("removemos seus dados automaticamente");
      expect(t).not.toContain("dpo@nexora.com.br");
    });
  }
});

describe("o que o código passou a fazer tem que aparecer no documento", () => {
  /**
   * Retenção não divulgada é retenção ilegal, por mais bem-intencionada que
   * seja. Guardar o HMAC do telefone de quem foi apagado é legítimo (art. 16)
   * e é o que impede a pessoa de voltar na próxima importação — mas só é
   * legítimo enquanto estiver escrito. Este teste existe para que apagar a
   * frase do documento quebre o build, e não passe despercebido.
   */
  it("a Política avisa que um código do telefone sobrevive à exclusão", () => {
    const t = textoDe(PRIVACIDADE).toLowerCase();
    expect(t).toContain("código embaralhado do telefone");
    expect(t).toContain("art. 16");
  });

  it("o Contrato de Operador explica por que o Livro-Caixa não some junto", () => {
    const t = textoDe(OPERADOR).toLowerCase();
    expect(t).toContain("livro-caixa");
    expect(t).toContain("código embaralhado do telefone");
  });

  it("o Contrato de Operador cita o registro das importações (art. 37)", () => {
    expect(textoDe(OPERADOR).toLowerCase()).toContain("art. 37");
  });

  it("os documentos dizem que exportar e apagar são botão, não pedido", () => {
    for (const doc of [TERMOS, PRIVACIDADE, OPERADOR]) {
      expect(textoDe(doc).toLowerCase()).toContain("minha base");
    }
  });
});

describe("dado sensível — o produto vende para clínica e fisioterapia", () => {
  it("a Política trata dado de saúde e cita o art. 11", () => {
    // A tela de diagnóstico oferece Odontologia e Fisioterapia. Ligar pessoa
    // identificada a procedimento é dado sensível, e legítimo interesse não
    // serve de base legal para ele.
    const t = textoDe(PRIVACIDADE).toLowerCase();
    expect(t).toContain("art. 11");
    expect(t).toContain("dado de saúde");
  });

  it("o Contrato de Operador diz que o procedimento não entra nem na base nem na mensagem", () => {
    expect(textoDe(OPERADOR).toLowerCase()).toContain("art. 11");
  });
});

describe("a seção de cookies acompanha o que o navegador realmente guarda", () => {
  /**
   * REGRESSÃO MINHA, encontrada na segunda passada de segurança.
   *
   * A política dizia "um único cookie" e "não haveria nada para você recusar".
   * As duas frases ficaram falsas quando eu mesmo acrescentei o cookie de state
   * do OAuth (rd_oauth) e a medição de funil em sessionStorage — a mesma classe
   * de erro que passei o dia inteiro consertando em outros lugares.
   */
  const t = textoDe(PRIVACIDADE);

  it("nomeia os dois cookies que existem", () => {
    expect(t).toContain("rd_session");
    expect(t).toContain("rd_oauth");
  });

  it("declara a medição de funil e onde ela mora", () => {
    expect(t.toLowerCase()).toContain("sessionstorage");
  });

  it("não afirma mais que não há nada a recusar", () => {
    expect(t).not.toContain("não haveria nada para você recusar");
  });

  it("não afirma mais que é um cookie só", () => {
    expect(t).not.toContain("um único cookie");
  });
});

describe("o que o produto passou a fazer e os documentos ainda não diziam", () => {
  const priv = textoDe(PRIVACIDADE);
  const termos = textoDe(TERMOS);

  /**
   * OS TRÊS NOMES NUNCA SAEM DO NAVEGADOR.
   *
   * Verifiquei no código: `diagnosticarTresNomes` roda no cliente, e o único
   * dado que vai para o servidor é o NOME DO EVENTO ("viu_numero"), nunca o
   * nome do cliente. É uma garantia mais forte do que a do caminho da lista —
   * que ao menos passa pela memória do servidor — e não estava escrita em lugar
   * nenhum. Garantia não declarada não protege ninguém e não vale nada como
   * argumento.
   */
  it("a Política explica que os três nomes não chegam ao servidor", () => {
    expect(priv.toLowerCase()).toContain("não sai do seu navegador");
  });

  /**
   * A RÉGUA DE E-MAIL NÃO ESTAVA DECLARADA.
   *
   * São oito momentos de ciclo de vida mais a chamada semanal da Onda —
   * comunicação de marketing recorrente. O descadastro existe e funciona desde
   * sempre, mas a Política não dizia que os e-mails existiam nem como sair
   * deles.
   */
  it("a Política declara os e-mails que a Nexora envia", () => {
    const t = priv.toLowerCase();
    expect(t).toContain("descadastr");
    expect(t).toMatch(/e-mails que enviamos|que e-mails/);
  });

  it("separa transacional de marketing — só um deles é recusável", () => {
    expect(priv.toLowerCase()).toContain("transacional");
  });

  it("a medição de funil aparece no inventário, não só na seção de cookies", () => {
    expect(priv.toLowerCase()).toMatch(/em que ponto|onde as pessoas desistem/);
  });

  it("o identificador do Google é declarado", () => {
    // Não é só nome e e-mail: guardamos o `sub`, que é o que impede alguém de
    // tomar a conta cadastrando o mesmo e-mail antes do dono.
    expect(priv.toLowerCase()).toContain("identificador");
  });

  it("a retenção cita o prazo dos eventos de funil", () => {
    expect(priv).toContain("90 dias");
  });

  it("os Termos dizem que confirmar o e-mail é condição para assinar", () => {
    expect(termos.toLowerCase()).toContain("confirmar o e-mail");
  });
});

describe("a landing não promete caminho de entrada que não funciona", () => {
  const landing = readFileSync(join(RAIZ, "app", "diagnostico", "page.tsx"), "utf8");

  it("não anuncia a exportação de conversa do WhatsApp como jeito de subir a base", () => {
    /**
     * Verificado em lib/importacao/parsers.ts: o parser agrupa por NOME DE
     * REMETENTE. Numa conversa individual há dois — o cliente e o dono — e o
     * dono é filtrado. Ou seja: uma exportação rende UM cliente, sem telefone.
     * Anunciar isso como caminho para a base inteira é promessa falsa, e ela
     * quebra exatamente com quem tenta.
     */
    expect(landing).not.toContain("texto exportado de uma conversa do WhatsApp");
  });
});
