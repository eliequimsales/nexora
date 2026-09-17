import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  passosDaAtivacao,
  progressoDaAtivacao,
  type SinaisDaAtivacao,
} from "@/lib/painel/ativacao";

/**
 * OS TRÊS PASSOS ATÉ A PRIMEIRA MENSAGEM.
 *
 * Quem chega de anúncio não conhece a Nexora e não vai explorar menu: ou ele
 * entende o que fazer nos primeiros minutos, ou fecha a aba e o dinheiro do
 * anúncio vira nada. O checklist existe para esse trecho — lista, quem sumiu,
 * primeira mensagem — e para nada além dele.
 *
 * O CHECK É UM FATO, NÃO UM ELOGIO. Cada passo só fecha com dado no banco:
 * cliente cadastrado, gente fora do ritmo encontrada, mensagem registrada.
 * Marcar passo por "o dono clicou aqui" seria o produto se parabenizando por
 * navegação — e o primeiro lugar onde a tela começaria a mentir.
 */

const RAIZ = join(__dirname, "..");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const leia = (rel: string) => semComentarios(readFileSync(join(RAIZ, rel), "utf8"));

const sinais = (p: Partial<SinaisDaAtivacao> = {}): SinaisDaAtivacao => ({
  clientes: 0,
  atrasados: 0,
  mensagensEnviadas: 0,
  ...p,
});

describe("os três passos da ativação", () => {
  it("são três, na ordem em que o dono ganha dinheiro", () => {
    const passos = passosDaAtivacao(sinais());
    expect(passos).toHaveLength(3);
    expect(passos.map((p) => p.numero)).toEqual([1, 2, 3]);
    expect(passos[0].acao.href).toBe("/painel/clientes/importar");
    expect(passos[1].acao.href).toBe("/painel/onda");
    expect(passos[2].acao.href).toBe("/painel/onda");
  });

  it("conta recém-criada: nada feito e só o primeiro passo liberado", () => {
    const passos = passosDaAtivacao(sinais());
    expect(passos.map((p) => p.feito)).toEqual([false, false, false]);
    expect(passos.map((p) => p.liberado)).toEqual([true, false, false]);
    expect(progressoDaAtivacao(sinais()).concluida).toBe(false);
  });

  it("a lista subiu: o primeiro passo fecha e o segundo abre", () => {
    const passos = passosDaAtivacao(sinais({ clientes: 40 }));
    expect(passos[0].feito).toBe(true);
    expect(passos[1].liberado).toBe(true);
  });

  it("o segundo passo mostra quantos clientes já passaram do tempo deles", () => {
    const passo = passosDaAtivacao(sinais({ clientes: 40, atrasados: 7 }))[1];
    expect(passo.feito).toBe(true);
    expect(passo.detalhe).toContain("7");
  });

  // Lista em dia é boa notícia, não pendência eterna. O passo fecha dizendo a
  // verdade — "hoje não tem ninguém fora do ritmo" —, e não fica piscando
  // vermelho cobrando uma ação que a própria Nexora diz não existir.
  it("lista inteira em dia fecha o passo sem inventar atrasado", () => {
    const passo = passosDaAtivacao(sinais({ clientes: 40, atrasados: 0 }))[1];
    expect(passo.feito).toBe(true);
    expect(passo.detalhe).not.toMatch(/\b0 clientes\b/);
  });

  it("a primeira mensagem registrada fecha o terceiro passo", () => {
    const antes = passosDaAtivacao(sinais({ clientes: 40, atrasados: 7 }))[2];
    const depois = passosDaAtivacao(
      sinais({ clientes: 40, atrasados: 7, mensagensEnviadas: 1 }),
    )[2];
    expect(antes.feito).toBe(false);
    expect(depois.feito).toBe(true);
  });

  /**
   * A mensagem pronta é a ação que a assinatura cobre (ENVIAR_TOQUE). Se o
   * checklist montasse um link de wa.me com o texto já escrito, ele seria uma
   * segunda porta lateral para a mesma recuperação que a onda trava — o defeito
   * que tests/porta-lateral.test.ts fechou. O passo leva para a tela que tem a
   * parede; quem não tem plano encontra a oferta lá, com o botão de resolver.
   */
  it("o terceiro passo leva para a tela que tem a parede, nunca para uma conversa pronta", () => {
    const passos = passosDaAtivacao(sinais({ clientes: 40, atrasados: 7 }));
    expect(passos[2].acao.href).toBe("/painel/onda");
    expect(JSON.stringify(passos)).not.toContain("wa.me");
  });

  it("o progresso conta o que fechou, e a ativação exige a primeira mensagem", () => {
    expect(progressoDaAtivacao(sinais())).toEqual({ feitos: 0, total: 3, concluida: false });
    expect(progressoDaAtivacao(sinais({ clientes: 40, atrasados: 7 })).feitos).toBe(2);
    expect(
      progressoDaAtivacao(sinais({ clientes: 40, atrasados: 7, mensagensEnviadas: 1 })),
    ).toEqual({ feitos: 3, total: 3, concluida: true });
  });
});

describe("o checklist na tela do painel", () => {
  const componente = () => leia("components/painel/checklist-ativacao.tsx");
  const painel = () => leia("app/painel/clientes/importar/page.tsx");

  it("aparece na tela em que o painel abre", () => {
    expect(painel()).toContain("<ChecklistAtivacao");
  });

  it("sai da frente quando os três passos fecham", () => {
    expect(componente()).toContain("concluida");
  });

  // A fronteira de tema: nx-* é do funil público. Dentro do painel, a mesma
  // marca vive em amber/panel-* (tests/tema-funil.test.ts é quem reprova).
  it("usa a paleta do painel, não a do funil", () => {
    expect(componente()).not.toMatch(/-nx-/);
  });

  it("o servidor manda os sinais da ativação junto da lista", () => {
    const rota = leia("app/api/clientes/route.ts");
    expect(rota).toContain("recoveryTouch.count");
    expect(rota).toContain("ativacao:");
  });
});
