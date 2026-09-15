/**
 * FILA JUSTA PARA ROTINAS EM LOTE.
 *
 * A régua lia sempre as mesmas 40 contas: `take` fixo, ordem fixa e nenhuma
 * marca de quem já tinha sido avaliado. Da 41ª conta em diante, ninguém recebia
 * e-mail nenhum.
 *
 * Aqui a ordem é "quem esperou mais vem primeiro", e quem é avaliado sai da
 * busca desta execução. A rotina para quando o orçamento de tempo acaba — ela
 * roda dentro de uma requisição, junto com a chamada de segunda — e a próxima
 * execução começa exatamente por quem ficou de fora.
 *
 * Genérica e sem banco: a consulta, a avaliação e a marca chegam como funções,
 * e o laço inteiro é testável sem Prisma.
 */

export type FilaDeContas<T extends { id: string }> = {
  /**
   * Próximo lote: contas ainda não avaliadas NESTA execução (marca anterior a
   * `inicio`, ou nenhuma), primeiro as nunca avaliadas, depois as mais antigas.
   */
  buscarLote: (inicio: Date, tamanho: number) => Promise<T[]>;
  avaliar: (conta: T) => Promise<void>;
  /** Erro de uma conta vira registro; nunca interrompe as outras. */
  aoFalhar: (conta: T, erro: unknown) => Promise<void>;
  /** Roda mesmo quando `avaliar` falha: sem a marca, a conta voltaria no próximo lote. */
  marcarAvaliada: (conta: T, inicio: Date) => Promise<void>;
};

export type OpcoesDaFila = {
  inicio: Date;
  tamanhoDoLote: number;
  orcamentoMs: number;
  /** Injetável para teste; em produção é `Date.now`. */
  relogio?: () => number;
};

export type ResultadoDaFila = { processadas: number; esgotouOrcamento: boolean };

export async function percorrerFila<T extends { id: string }>(
  fila: FilaDeContas<T>,
  opcoes: OpcoesDaFila,
): Promise<ResultadoDaFila> {
  const relogio = opcoes.relogio ?? Date.now;
  const comeco = relogio();
  const vistas = new Set<string>();
  let processadas = 0;

  for (;;) {
    const lote = await fila.buscarLote(opcoes.inicio, opcoes.tamanhoDoLote);

    for (const conta of lote) {
      // O orçamento é conferido antes de cada conta. Quem ficar de fora continua
      // sem marca desta execução e encabeça a próxima.
      if (relogio() - comeco >= opcoes.orcamentoMs) {
        return { processadas, esgotouOrcamento: true };
      }

      // Conta que volta na mesma execução quer dizer que a marca não pegou.
      // Seguir em frente seria rodar para sempre avaliando as mesmas contas.
      if (vistas.has(conta.id)) {
        throw new Error(`A fila não avançou: a conta ${conta.id} voltou na mesma execução.`);
      }
      vistas.add(conta.id);

      try {
        await fila.avaliar(conta);
      } catch (erro) {
        await fila.aoFalhar(conta, erro);
      } finally {
        await fila.marcarAvaliada(conta, opcoes.inicio);
      }
      processadas += 1;
    }

    // Lote incompleto: não sobrou ninguém para esta execução.
    if (lote.length < opcoes.tamanhoDoLote) {
      return { processadas, esgotouOrcamento: false };
    }
  }
}
