/**
 * Aplica um Plano de importação no banco.
 *
 * Deliberadamente SEM transação única. A decisão vem de `planejarImportacao`,
 * que é idempotente: se este processo morrer no meio de uma base de 4.000
 * clientes, o dono aperta importar de novo e o que já entrou não entra
 * duas vezes. Uma transação gigante daria o efeito oposto — timeout no Postgres
 * gerenciado, tudo desfeito, e o dono sem saber por quê.
 */

import { prisma } from "@/lib/db";
import { planejarImportacao, type ClienteExistente, type Plano } from "./persistir";
import type { ClienteImportado } from "./parsers";

/** Lotes pequenos: o Postgres do Railway é compartilhado e não gosta de rajada. */
const LOTE = 25;

export type ResultadoGravacao = Plano["resumo"] & {
  semTelefone: Plano["semTelefone"];
  baseTotalDepois: number;
  /** true quando nada foi gravado — o dono só viu o que aconteceria. */
  simulado: boolean;
};

function lotes<T>(itens: T[], tamanho: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho));
  return out;
}

export async function gravarImportacao(
  companyId: string,
  importados: ClienteImportado[],
  opcoes: { simular?: boolean } = {},
): Promise<ResultadoGravacao> {
  const telefones = [...new Set(importados.map((c) => c.telefone).filter(Boolean))];

  // Só os clientes que o arquivo menciona. Carregar a base inteira para
  // importar 30 linhas é o que faz a importação estourar memória num plano
  // de 512 MB.
  const existentes: ClienteExistente[] = [];
  for (const parte of lotes(telefones, 500)) {
    const achados = await prisma.customer.findMany({
      where: { companyId, phone: { in: parte } },
      select: {
        id: true,
        phone: true,
        name: true,
        optOut: true,
        visits: { select: { occurredAt: true, valueCents: true } },
      },
    });
    for (const a of achados) {
      existentes.push({
        id: a.id,
        phone: a.phone,
        name: a.name,
        optOut: a.optOut,
        visitas: a.visits,
      });
    }
  }

  const plano = planejarImportacao(importados, existentes);

  // Simulação: o dono vê exatamente o que entraria ANTES de qualquer escrita.
  // Importação é irreversível na prática (ninguém desfaz 4.000 linhas), então
  // ver antes não é conforto de UI — é a diferença entre erro corrigível e
  // base contaminada.
  if (opcoes.simular) {
    const baseAtual = await prisma.customer.count({ where: { companyId } });
    return {
      ...plano.resumo,
      semTelefone: plano.semTelefone,
      baseTotalDepois: baseAtual + plano.resumo.criar,
      simulado: true,
    };
  }

  const criar = plano.clientes.filter((c) => c.acao === "CRIAR");
  for (const lote of lotes(criar, LOTE)) {
    await Promise.all(
      lote.map((c) =>
        prisma.customer.create({
          data: {
            companyId,
            name: c.nome,
            phone: c.phone,
            source: "IMPORT",
            visits: { create: c.visitasNovas },
          },
          select: { id: true },
        }),
      ),
    );
  }

  const atualizar = plano.clientes.filter((c) => c.acao === "ATUALIZAR");
  for (const lote of lotes(atualizar, LOTE)) {
    await Promise.all(
      lote.map(async (c) => {
        if (c.renomearPara) {
          await prisma.customer.update({
            where: { id: c.clienteId! },
            data: { name: c.renomearPara },
          });
        }
        if (c.visitasNovas.length > 0) {
          await prisma.visit.createMany({
            data: c.visitasNovas.map((v) => ({ customerId: c.clienteId!, ...v })),
          });
        }
      }),
    );
  }

  const baseTotalDepois = await prisma.customer.count({ where: { companyId } });

  return {
    ...plano.resumo,
    semTelefone: plano.semTelefone,
    baseTotalDepois,
    simulado: false,
  };
}
