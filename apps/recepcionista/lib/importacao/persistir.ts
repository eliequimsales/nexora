/**
 * RESGATE DO CADERNO — a parte que grava.
 *
 * O parser lê a planilha torta; este módulo decide o que vira banco. A decisão
 * mora numa função PURA de propósito: gravação de base de clientes é onde o
 * número do dono se corrompe em silêncio, e silêncio é o que a Constituição
 * proíbe. Testar a decisão sem banco é o que permite garantir as duas regras
 * que realmente importam aqui:
 *
 *   IDEMPOTÊNCIA — o dono VAI importar a mesma planilha duas vezes. Se a
 *   segunda importação duplicar visitas, o ciclo pessoal encolhe artificialmente,
 *   clientes em dia viram "sumidos", e o dono manda mensagem de saudade para
 *   quem esteve lá ontem. Uma mensagem dessas queima a confiança para sempre.
 *
 *   OPT-OUT É DEFINITIVO — quem pediu para sair não volta por reimportação de
 *   planilha antiga. Exigência do CDC e da LGPD, e a única postura defensável.
 */

import { lerTelefone, type ClienteImportado } from "./parsers";

/** O que já está no banco, no formato mínimo para decidir. */
export type ClienteExistente = {
  id: string;
  phone: string;
  name: string;
  optOut: boolean;
  visitas: { occurredAt: Date; valueCents: number }[];
};

export type AcaoCliente = "CRIAR" | "ATUALIZAR" | "IGNORAR_OPT_OUT";

export type PlanoCliente = {
  phone: string;
  nome: string;
  acao: AcaoCliente;
  /** null quando o cliente ainda não existe. */
  clienteId: string | null;
  /** Preenchido só quando o nome novo é melhor que o gravado. */
  renomearPara: string | null;
  visitasNovas: { occurredAt: Date; valueCents: number }[];
  visitasDuplicadas: number;
};

export type SemTelefone = { nome: string; motivo: string };

export type Plano = {
  clientes: PlanoCliente[];
  /** Recusados por não ter telefone utilizável — ditos em português ao dono. */
  semTelefone: SemTelefone[];
  resumo: {
    criar: number;
    atualizar: number;
    ignoradosPorOptOut: number;
    visitasNovas: number;
    visitasDuplicadas: number;
  };
};

/** O nome que o parser usa quando a linha não tinha nome legível. */
export const SEM_NOME = "Sem nome";

const DIA_MS = 86_400_000;

/**
 * Identidade de uma visita para efeito de duplicata: o DIA e o VALOR.
 *
 * Por que o dia e não o instante: planilha de barbearia não guarda hora, e
 * reimportar a mesma linha gera timestamps diferentes (meio-dia UTC do parser
 * vs. o que já estava no banco). Comparar instante exato faria toda reimportação
 * duplicar tudo.
 *
 * Por que o valor entra na chave: pet shop atende banho de manhã e tosa à tarde,
 * no mesmo dia, por valores diferentes. Colapsar por dia apagaria a segunda.
 * Duas visitas no mesmo dia pelo MESMO valor são indistinguíveis de uma
 * reimportação — e aí colapsar é a escolha honesta, porque inflar o North Star
 * é pior do que perder um registro raro.
 */
function chaveDaVisita(quando: Date, valorCents: number): string {
  return `${Math.floor(quando.getTime() / DIA_MS)}|${valorCents}`;
}

/** Nome que veio de verdade da planilha, e não o placeholder do parser. */
function nomeReal(nome: string): boolean {
  const limpo = (nome ?? "").trim();
  return limpo.length > 0 && limpo.toLowerCase() !== SEM_NOME.toLowerCase();
}

export function planejarImportacao(
  importados: ClienteImportado[],
  existentes: ClienteExistente[],
): Plano {
  const porTelefone = new Map<string, ClienteExistente>();
  for (const e of existentes) {
    const tel = lerTelefone(e.phone);
    if (tel) porTelefone.set(tel, e);
  }

  // Uma linha por cliente: o arquivo do dono repete o mesmo telefone em cada
  // atendimento, e cada repetição é uma visita, não um cliente novo.
  const agrupados = new Map<
    string,
    { nome: string; visitas: { data: Date; valorCents: number }[] }
  >();
  const semTelefone: SemTelefone[] = [];

  for (const bruto of importados) {
    const tel = lerTelefone(bruto.telefone);
    if (!tel) {
      semTelefone.push({
        nome: nomeReal(bruto.nome) ? bruto.nome.trim() : SEM_NOME,
        motivo:
          "Sem telefone válido — não dá para mandar mensagem nem juntar com quem já está na base. " +
          "Complete o telefone e importe de novo.",
      });
      continue;
    }

    const atual = agrupados.get(tel);
    if (atual) {
      atual.visitas.push(...bruto.visitas);
      if (!nomeReal(atual.nome) && nomeReal(bruto.nome)) atual.nome = bruto.nome.trim();
    } else {
      agrupados.set(tel, {
        nome: nomeReal(bruto.nome) ? bruto.nome.trim() : SEM_NOME,
        visitas: [...bruto.visitas],
      });
    }
  }

  const clientes: PlanoCliente[] = [];

  for (const [phone, junto] of agrupados) {
    const existente = porTelefone.get(phone);

    // Opt-out vence tudo. Nem nome, nem visita, nem ressurreição.
    if (existente?.optOut) {
      clientes.push({
        phone,
        nome: existente.name,
        acao: "IGNORAR_OPT_OUT",
        clienteId: existente.id,
        renomearPara: null,
        visitasNovas: [],
        visitasDuplicadas: 0,
      });
      continue;
    }

    // Chaves já gravadas + as desta mesma importação, para que o arquivo com a
    // linha repetida não crie a visita duas vezes na primeira rodada.
    const vistas = new Set(
      (existente?.visitas ?? []).map((v) => chaveDaVisita(v.occurredAt, v.valueCents)),
    );

    const visitasNovas: { occurredAt: Date; valueCents: number }[] = [];
    let visitasDuplicadas = 0;

    for (const v of junto.visitas) {
      const chave = chaveDaVisita(v.data, v.valorCents);
      if (vistas.has(chave)) {
        visitasDuplicadas += 1;
        continue;
      }
      vistas.add(chave);
      visitasNovas.push({ occurredAt: v.data, valueCents: v.valorCents });
    }

    const renomearPara =
      existente && nomeReal(junto.nome) && !nomeReal(existente.name) ? junto.nome : null;

    clientes.push({
      phone,
      nome: existente?.name && nomeReal(existente.name) ? existente.name : junto.nome,
      acao: existente ? "ATUALIZAR" : "CRIAR",
      clienteId: existente?.id ?? null,
      renomearPara,
      visitasNovas,
      visitasDuplicadas,
    });
  }

  return {
    clientes,
    semTelefone,
    resumo: {
      criar: clientes.filter((c) => c.acao === "CRIAR").length,
      atualizar: clientes.filter((c) => c.acao === "ATUALIZAR").length,
      ignoradosPorOptOut: clientes.filter((c) => c.acao === "IGNORAR_OPT_OUT").length,
      visitasNovas: clientes.reduce((s, c) => s + c.visitasNovas.length, 0),
      visitasDuplicadas: clientes.reduce((s, c) => s + c.visitasDuplicadas, 0),
    },
  };
}
