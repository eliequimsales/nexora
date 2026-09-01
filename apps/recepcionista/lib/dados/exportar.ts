/**
 * EXPORTAÇÃO DA BASE — portabilidade (LGPD art. 18, V) e acesso (art. 18, II).
 *
 * Duas frases dos Termos dependiam disto para serem verdade: "seus dados
 * continuam acessíveis para leitura e exportação" e "você tem 15 dias para
 * exportar seus dados". Contrato que promete função inexistente é prova contra
 * quem escreveu, então a função passou a existir.
 *
 * Formato: CSV, não JSON. O titular do direito aqui é um dono de barbearia, e
 * portabilidade que ele não consegue abrir não é portabilidade — a LGPD pede
 * formato "de uso comum", e no Brasil isso é a planilha.
 */

export type VisitaExportada = { data: Date; valorCents: number; servico: string };

export type ClienteExportado = {
  nome: string;
  telefone: string;
  origem: string;
  optOut: boolean;
  optOutAt: Date | null;
  observacoes: string;
  criadoEm: Date;
  visitas: VisitaExportada[];
};

const COLUNAS = [
  "Nome",
  "Telefone",
  "Visitas",
  "Última visita",
  "Total gasto",
  "Pediu para parar",
  "Data do pedido",
  "Como entrou",
  "Cliente desde",
  "Observações",
] as const;

// O Excel brasileiro lê ponto-e-vírgula. Com vírgula ele joga a linha inteira
// numa célula só, e o dono conclui que a exportação está quebrada.
const SEP = ";";

// Sem BOM o Excel abre em Latin-1 e "João" vira "JoÃ£o". É o detalhe que
// decide se o arquivo parece profissional ou amador.
const BOM = "﻿";

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const emData = (d: Date | null): string => (d ? dataBR.format(d) : "");

// Sem "R$" e com vírgula decimal: assim a coluna entra como número e o dono
// consegue somar. Com o símbolo, o Excel trata tudo como texto.
const emNumero = (cents: number): string => (cents / 100).toFixed(2).replace(".", ",");

/**
 * CSV injection. Excel e Google Sheets EXECUTAM a célula que começa com
 * = + - @ (e tab ou CR) como fórmula. Os nomes aqui vêm de uma lista colada
 * pelo dono, que veio da agenda dele — texto de terceiro. Sem isto, abrir o
 * próprio backup é o vetor de ataque. Aspa simples à frente é a defesa que a
 * OWASP recomenda e que mantém o texto legível na tela.
 */
function neutralizarFormula(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function celula(valor: string | number): string {
  const texto = neutralizarFormula(String(valor ?? ""));
  if (!/[;"\n\r]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function clientesParaCsv(clientes: ClienteExportado[]): string {
  const linhas = [COLUNAS.join(SEP)];

  for (const c of clientes) {
    const ultima = c.visitas.reduce<Date | null>(
      (maior, v) => (maior === null || v.data > maior ? v.data : maior),
      null,
    );
    const total = c.visitas.reduce((soma, v) => soma + v.valorCents, 0);

    linhas.push(
      [
        c.nome,
        c.telefone,
        c.visitas.length,
        emData(ultima),
        emNumero(total),
        c.optOut ? "sim" : "não",
        emData(c.optOutAt),
        c.origem,
        emData(c.criadoEm),
        c.observacoes,
      ]
        .map(celula)
        .join(SEP),
    );
  }

  return BOM + linhas.join("\n") + "\n";
}
