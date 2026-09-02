import { mensagemDoToque } from "./toques";
import { variantesDeTelefone } from "./telefone";

/**
 * CONVITE DE VOLTA — a ação que faltava no fim do Diagnóstico.
 *
 * O Diagnóstico terminava em "Criar minha conta". Isso é ação para a NEXORA,
 * não para o dinheiro do dono. Regra Zero: a tela termina em ação executável,
 * e a ação que ele quer fazer olhando "Maria, sumida há 214 dias" é mandar
 * mensagem para a Maria — agora, com o telefone que ele mesmo acabou de colar.
 *
 * Por que entregar isso DE GRAÇA, antes de cobrar:
 * ele manda três mensagens, uma pessoa volta, e ele fatura antes de pagar
 * qualquer coisa. Aí R$ 97 deixa de ser custo e vira conta de padaria — ele já
 * viu funcionar com o dinheiro dele, não com o nosso argumento. É a diferença
 * entre acreditar numa promessa e ter visto acontecer.
 *
 * A mensagem sai do MESMO gerador do Toque 1 da Onda, de propósito. Se as duas
 * telas tivessem textos próprios, uma seria melhorada e a outra apodreceria —
 * e o dono veria a Nexora piorar depois que assinou.
 */

export type Convite = {
  /** O texto exato, para pré-visualizar e para copiar. */
  texto: string;
  /**
   * wa.me já com país e mensagem embutida — abre a conversa pronta.
   *
   * NULO quando não há telefone legível, e isso não é falha: no fluxo de Três
   * Nomes o dono digita o nome de cabeça e o telefone é opcional. Antes, a
   * função inteira devolvia null nesse caso e a ação sumia — transformando
   * "quase pronto" em "não dá". Sem número ele copia o texto e escolhe o
   * contato na agenda dele, que é gesto que ele faz cinquenta vezes por dia.
   */
  href: string | null;
};

/**
 * Primeiro nome, em caixa de gente.
 *
 * "MARIA SILVA SANTOS" numa mensagem grita. E planilha de barbearia guarda
 * telefone na coluna de nome com frequência — nesse caso é melhor não ter nome
 * nenhum do que abrir com "Oi, 11988881234!".
 */
export function primeiroNome(nome: string): string {
  const bruto = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!bruto || /\d/.test(bruto)) return "";
  return bruto.charAt(0).toLocaleUpperCase("pt-BR") + bruto.slice(1).toLocaleLowerCase("pt-BR");
}

/** Forma internacional (55 + DDD + número) que o wa.me exige. */
function paraWaMe(telefone: string): string | null {
  const comPais = variantesDeTelefone(telefone)
    .filter((v) => v.startsWith("55") && v.length >= 12)
    // O número COM o nono dígito é o que o WhatsApp usa hoje.
    .sort((a, b) => b.length - a.length);
  return comPais[0] ?? null;
}

export function conviteDeVolta(cliente: {
  nome: string;
  telefone: string;
  negocio: string;
}): Convite {
  // O TEXTO SAI SEMPRE. Só o link depende do telefone.
  const numero = paraWaMe(cliente.telefone);

  const texto = mensagemDoToque(1, {
    primeiroNome: primeiroNome(cliente.nome),
    negocio: (cliente.negocio ?? "").trim(),
    // O Toque 1 não usa link de agenda de propósito: quem sumiu ainda não deve
    // nada, e pedir clique antes de dizer "senti sua falta" é cobrança disfarçada.
    link: "",
  });

  return {
    texto,
    href: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null,
  };
}
