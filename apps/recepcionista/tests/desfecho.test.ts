import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DESFECHOS,
  MIN_DIAS_PARA_COBRAR,
  MAX_DIAS_PARA_COBRAR,
  vencidosParaPerguntar,
  type ToquePendente,
} from "@/lib/recuperacao/desfecho";

/**
 * O DESFECHO ESTAVA SENDO PERDIDO NA ORIGEM.
 *
 * O botão "Enviei" gravava `SEM_RESPOSTA` — um desfecho FINAL, no exato
 * instante em que o dono copia a mensagem. O cliente ainda nem recebeu.
 *
 * Na prática: o dono manda na segunda, marca "Enviei", o cliente aparece na
 * quinta, e esse retorno NUNCA entra no Livro-Caixa. A North Star do produto
 * estava sendo sistematicamente subestimada pelo próprio produto — e o número
 * que prova que a Nexora vale R$ 97 é justamente esse.
 *
 * Dois consertos: "Enviei" passa a significar AGUARDANDO, e a Onda pergunta na
 * semana seguinte quem apareceu.
 */

const d = (dias: number) => new Date(Date.now() - dias * 86_400_000);

const toque = (over: Partial<ToquePendente> = {}): ToquePendente => ({
  id: over.id ?? "t1",
  clienteId: over.clienteId ?? "c1",
  nome: over.nome ?? "Maria",
  toqueNumero: over.toqueNumero ?? 1,
  esteira: over.esteira ?? "RESGATE",
  ticketMedioCents: over.ticketMedioCents ?? 5_000,
  enviadoEm: over.enviadoEm ?? d(7),
});

describe("os desfechos possíveis", () => {
  it("AGUARDANDO é o estado inicial, não um desfecho", () => {
    // Ele existe no banco como default. O que NÃO pode é ser escrito como se
    // fosse resposta: "enviei" não é "não respondeu".
    expect(DESFECHOS).not.toContain("AGUARDANDO");
  });

  it("os finais cobrem responder, voltar e não responder", () => {
    for (const d of ["VOLTOU", "MARCOU", "RESPONDEU", "SEM_RESPOSTA", "PULADO"]) {
      expect(DESFECHOS).toContain(d);
    }
  });
});

describe("quando perguntar 'quem apareceu?'", () => {
  it("não pergunta no mesmo dia — o cliente nem leu ainda", () => {
    expect(vencidosParaPerguntar([toque({ enviadoEm: d(0) })])).toEqual([]);
  });

  it("não pergunta antes do prazo mínimo", () => {
    expect(vencidosParaPerguntar([toque({ enviadoEm: d(MIN_DIAS_PARA_COBRAR - 1) })])).toEqual([]);
  });

  it("pergunta a partir do prazo mínimo", () => {
    const r = vencidosParaPerguntar([toque({ enviadoEm: d(MIN_DIAS_PARA_COBRAR) })]);
    expect(r).toHaveLength(1);
  });

  it("para de perguntar depois da janela de atribuição", () => {
    // Passou de 21 dias, a resposta já não muda o Livro-Caixa — e continuar
    // cobrando vira lista de tarefa que nunca esvazia.
    expect(vencidosParaPerguntar([toque({ enviadoEm: d(MAX_DIAS_PARA_COBRAR + 1) })])).toEqual([]);
  });

  it("o mais antigo vem primeiro — é o que está mais perto de vencer", () => {
    const r = vencidosParaPerguntar([
      toque({ id: "novo", enviadoEm: d(4) }),
      toque({ id: "velho", enviadoEm: d(18) }),
    ]);
    expect(r.map((t) => t.id)).toEqual(["velho", "novo"]);
  });

  it("limita a lista: cobrança sem fim vira ruído", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => toque({ id: `t${i}`, enviadoEm: d(10) }));
    expect(vencidosParaPerguntar(muitos).length).toBeLessThanOrEqual(10);
  });

  it("lista vazia não explode", () => {
    expect(vencidosParaPerguntar([])).toEqual([]);
  });
});

describe("a tela não mente mais sobre o envio", () => {
  const onda = readFileSync(join(__dirname, "..", "app/painel/onda/page.tsx"), "utf8");

  it('"Enviei" não grava mais SEM_RESPOSTA', () => {
    expect(onda).not.toMatch(/marcar\(card,\s*"SEM_RESPOSTA"\)/);
  });

  it("existe um caminho para AGUARDANDO", () => {
    expect(onda).toContain("AGUARDANDO");
  });
});

describe("marcar um pendente resolve o toque, não cria outro", () => {
  const rota = readFileSync(join(__dirname, "..", "app/api/onda/route.ts"), "utf8");

  it("procura um AGUARDANDO antes de criar", () => {
    // Sem isto, marcar "voltou" numa pessoa da lista de pendentes criaria um
    // SEGUNDO toque: o primeiro ficaria AGUARDANDO para sempre na pergunta, e
    // o contador de toques andaria sozinho — o cliente receberia o toque 3 sem
    // nunca ter recebido o 2.
    expect(rota).toMatch(/outcome:\s*"AGUARDANDO"/);
    expect(rota).toContain("recoveryTouch.update");
  });

  it("AGUARDANDO não ganha data de desfecho", () => {
    // outcomeAt marca quando a história acabou. Ela não acabou.
    expect(rota).toMatch(/outcomeAt:\s*resultado === "AGUARDANDO" \? null : new Date\(\)/);
  });
});
