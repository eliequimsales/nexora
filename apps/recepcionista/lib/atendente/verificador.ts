/**
 * O VERIFICADOR DE FATOS.
 *
 * Todo número que importa na resposta da IA — dinheiro, porcentagem, hora,
 * data e duração — precisa existir nos fatos que ela recebeu do banco. O que
 * não existir derruba a mensagem inteira, e sai a resposta segura com anotação
 * para o dono. Na dúvida, o cliente recebe "não tenho confirmado", nunca um
 * preço inventado.
 *
 * Compara valores, não texto: "R$ 45" e "R$ 45,00" são o mesmo preço, "9h" e
 * "09:00" a mesma hora.
 */

const DINHEIRO = /R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\b\d+(?:,\d{1,2})?\s?reais\b/gi;
const PORCENTAGEM = /\b\d{1,3}(?:,\d+)?\s?%/g;
const HORA = /\b([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))(?![\d/])/gi;
const DATA = /\b(\d{1,2})\/(\d{1,2})\b/g;
const DURACAO = /\b(\d{1,3})\s?(?:min|minutos)\b/gi;

function centavos(texto: string): number {
  const numero = texto.replace(/R\$|reais/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(numero) * 100);
}

function valoresDeDinheiro(texto: string): Set<number> {
  return new Set([...texto.matchAll(DINHEIRO)].map((m) => centavos(m[0])));
}

function valoresDePorcentagem(texto: string): Set<number> {
  return new Set([...texto.matchAll(PORCENTAGEM)].map((m) => Number(m[0].replace("%", "").replace(",", ".").trim())));
}

function minutosDaHora(m: RegExpMatchArray): number {
  return Number(m[1]) * 60 + Number(m[2] ?? m[3] ?? 0);
}

function valoresDeHora(texto: string): Set<number> {
  return new Set([...texto.matchAll(HORA)].map(minutosDaHora));
}

function valoresDeData(texto: string): Set<string> {
  return new Set([...texto.matchAll(DATA)].map((m) => `${Number(m[1])}/${Number(m[2])}`));
}

function valoresDeDuracao(texto: string): Set<number> {
  return new Set([...texto.matchAll(DURACAO)].map((m) => Number(m[1])));
}

/** Os trechos da resposta com número que não veio dos fatos. Vazio quando está tudo certo. */
export function numerosSemFonte(resposta: string, textoDosFatos: string): string[] {
  const achados: string[] = [];

  const dinheiro = valoresDeDinheiro(textoDosFatos);
  for (const m of resposta.matchAll(DINHEIRO)) if (!dinheiro.has(centavos(m[0]))) achados.push(m[0].trim());

  const porcentagem = valoresDePorcentagem(textoDosFatos);
  for (const m of resposta.matchAll(PORCENTAGEM)) {
    const valor = Number(m[0].replace("%", "").replace(",", ".").trim());
    if (!porcentagem.has(valor)) achados.push(m[0].replace(/\s/g, ""));
  }

  const horas = valoresDeHora(textoDosFatos);
  for (const m of resposta.matchAll(HORA)) if (!horas.has(minutosDaHora(m))) achados.push(m[0]);

  const datas = valoresDeData(textoDosFatos);
  for (const m of resposta.matchAll(DATA)) if (!datas.has(`${Number(m[1])}/${Number(m[2])}`)) achados.push(m[0]);

  const duracoes = valoresDeDuracao(textoDosFatos);
  for (const m of resposta.matchAll(DURACAO)) if (!duracoes.has(Number(m[1]))) achados.push(m[0]);

  return achados;
}
