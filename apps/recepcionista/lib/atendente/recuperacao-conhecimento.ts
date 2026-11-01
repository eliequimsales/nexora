import type { Faq } from "@/lib/validation";

const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const VAZIAS = new Set("a o as os de da do das dos e em no na nos nas um uma uns umas eu voce voces me meu minha para por com qual quais quanto como que tem pode voces ai aqui gostaria saber sobre isso essa esse esta este sao se ao ou faz fazer".split(" "));
const GRUPOS = [
  ["preco", "valor", "custa", "custo", "quanto"], ["pagamento", "pagar", "pix", "cartao", "dinheiro"],
  ["endereco", "local", "localizacao", "onde", "ficam"], ["horario", "expediente", "abre", "abrem", "fecha", "funciona"],
  ["estacionamento", "estacionar", "vaga", "carro"], ["cancelamento", "cancelar", "desmarcar"],
  ["remarcar", "remarcacao", "reagendar", "alterar"], ["duracao", "dura", "demora", "tempo"],
];
function tokens(v: string): Set<string> {
  const t = new Set(normalizar(v).split(" ").filter(p => p.length > 2 && !VAZIAS.has(p)));
  for (const grupo of GRUPOS) if (grupo.some(p => t.has(p))) for (const p of grupo) t.add(p);
  return t;
}

/** Seleciona fontes aprovadas; não gera nem reescreve fatos. Empates conservam a ordem recebida. */
export function selecionarConhecimentoRelevante(itens: Faq[], pergunta: string | undefined, limite = 50): Faq[] {
  const teto = Math.max(1, Math.min(150, Math.floor(limite) || 50));
  const unicos = new Map<string, Faq>();
  const conflitos = new Set<string>();
  for (const i of itens) {
    if (!i.question?.trim() || !i.answer?.trim()) continue;
    const chave = normalizar(i.question); const anterior = unicos.get(chave);
    if (anterior && normalizar(anterior.answer) !== normalizar(i.answer)) conflitos.add(chave);
    else if (!anterior) unicos.set(chave, i);
  }
  const validos = [...unicos].filter(([chave]) => !conflitos.has(chave)).map(([, item]) => item);
  if (!pergunta?.trim()) return validos.slice(0, teto);
  const consulta = tokens(pergunta); const literal = normalizar(pergunta);
  return validos.map((item, posicao) => {
    const q = tokens(item.question); const a = tokens(item.answer);
    const score = (normalizar(item.question) === literal ? 1000 : 0)
      + [...consulta].reduce((s, termo) => s + (q.has(termo) ? 4 : 0) + (a.has(termo) ? 1 : 0), 0);
    return { item, posicao, score };
  }).filter(i => i.score > 0).sort((a, b) => b.score - a.score || a.posicao - b.posicao).slice(0, teto).map(i => i.item);
}
