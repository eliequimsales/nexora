/**
 * RESGATE DO CADERNO
 *
 * "Manda a lista do jeito que ela estiver." A fricção de importar é problema
 * NOSSO, não do dono — e é exatamente onde a adoção morre em todo concorrente:
 * pede-se um CSV com colunas certas, o dono não sabe exportar, e o produto
 * morre no primeiro passo.
 *
 * Então este módulo engole planilha torta, exportação de conversa do WhatsApp
 * e colagem do Excel. E quando não consegue ler uma linha, DIZ o motivo em
 * português, em vez de sumir com ela em silêncio.
 */

export type VisitaImportada = { data: Date; valorCents: number };

export type ClienteImportado = {
  nome: string;
  telefone: string;
  ultimaVisita: Date | null;
  valorCents: number;
  visitas: VisitaImportada[];
};

export type LinhaIgnorada = { linha: number; conteudo: string; motivo: string };

export type Importacao = {
  clientes: ClienteImportado[];
  ignoradas: LinhaIgnorada[];
  origem: "tabular" | "whatsapp";
  aviso: string | null;
};

// --- normalização -----------------------------------------------------------

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const SINONIMOS: Record<string, string[]> = {
  nome: ["nome", "name", "cliente", "nome do cliente", "contato", "paciente", "aluno", "tutor"],
  telefone: ["telefone", "phone", "celular", "whatsapp", "whats", "fone", "tel", "numero", "número"],
  data: [
    "data", "date", "ultima visita", "ultimo atendimento", "ultima compra",
    "dia", "atendimento", "visita", "quando",
  ],
  valor: ["valor", "value", "ticket", "preco", "total", "gasto", "valor gasto", "receita"],
};

function classificarCabecalho(campo: string): string | null {
  const c = semAcento(campo);
  for (const [chave, nomes] of Object.entries(SINONIMOS)) {
    if (nomes.some((n) => c === n || c.includes(n))) return chave;
  }
  return null;
}

// --- leitores de valor ------------------------------------------------------

export function lerTelefone(bruto: string): string | null {
  const d = (bruto ?? "").replace(/\D/g, "");
  // Menos de 10 dígitos não é telefone brasileiro válido.
  return d.length >= 10 && d.length <= 13 ? d : null;
}

const RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const RE_BR = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/;

export function lerData(bruto: string): Date | null {
  const s = (bruto ?? "").trim();
  if (!s) return null;

  const iso = RE_ISO.exec(s);
  if (iso) {
    const [, a, m, d] = iso;
    return montar(+a, +m, +d);
  }

  const br = RE_BR.exec(s);
  if (br) {
    let [, d, m, a] = br;
    let ano = +a;
    if (ano < 100) ano += ano < 70 ? 2000 : 1900;
    return montar(ano, +m, +d);
  }

  return null;
}

function montar(ano: number, mes: number, dia: number): Date | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const dt = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Dinheiro no formato brasileiro. "R$ 1.234,56" -> 123456.
 * Ponto é separador de milhar; vírgula é decimal.
 */
export function lerValorCents(bruto: string): number {
  const s = (bruto ?? "").replace(/[R$\s]/gi, "").trim();
  if (!s) return 0;

  if (s.includes(",")) {
    const limpo = s.replace(/\./g, "").replace(",", ".");
    const n = Number.parseFloat(limpo);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  // Sem vírgula: ponto com exatamente 3 dígitos depois é milhar, não decimal.
  const pontoMilhar = /^\d{1,3}(\.\d{3})+$/.test(s);
  const n = Number.parseFloat(pontoMilhar ? s.replace(/\./g, "") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// --- CSV --------------------------------------------------------------------

function detectarSeparador(linha: string): string {
  const cands = [",", ";", "\t", "|"];
  return cands.reduce((a, b) =>
    (linha.split(b).length > linha.split(a).length ? b : a), ",");
}

/** Divisor que respeita aspas — "R$ 1.234,56" tem vírgula dentro. */
function dividir(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let dentro = false;
  for (let i = 0; i < linha.length; i += 1) {
    const ch = linha[i];
    if (ch === '"') {
      if (dentro && linha[i + 1] === '"') { atual += '"'; i += 1; }
      else dentro = !dentro;
    } else if (ch === sep && !dentro) {
      out.push(atual); atual = "";
    } else {
      atual += ch;
    }
  }
  out.push(atual);
  return out.map((c) => c.trim());
}

// --- WhatsApp ---------------------------------------------------------------

// "01/02/2026 14:22 - Nome: texto"  e  "[01/02/2026 14:22] Nome: texto"
const RE_WA =
  /^\[?(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})[,\s]+\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–]?\s*([^:]{1,60}):\s/;

export function detectarFormato(texto: string): "whatsapp" | "tabular" {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 12);
  const wa = linhas.filter((l) => RE_WA.test(l)).length;
  return wa >= Math.max(2, Math.ceil(linhas.length * 0.4)) ? "whatsapp" : "tabular";
}

function importarWhatsApp(texto: string, meuNome?: string): Importacao {
  const porContato = new Map<string, { nome: string; ultima: Date }>();
  const ignoradas: LinhaIgnorada[] = [];
  const meu = meuNome ? semAcento(meuNome) : null;

  texto.split(/\r?\n/).forEach((linha, i) => {
    const m = RE_WA.exec(linha);
    if (!m) return;
    const [, dataTxt, nomeBruto] = m;
    const nome = nomeBruto.trim();
    if (!nome) return;
    if (meu && semAcento(nome) === meu) return;

    const data = lerData(dataTxt);
    if (!data) {
      ignoradas.push({ linha: i + 1, conteudo: linha.slice(0, 60), motivo: "Data ilegível" });
      return;
    }
    const chave = semAcento(nome);
    const atual = porContato.get(chave);
    if (!atual || data > atual.ultima) porContato.set(chave, { nome, ultima: data });
  });

  const clientes: ClienteImportado[] = [...porContato.values()].map((c) => ({
    nome: c.nome,
    // Exportação de conversa não traz telefone; o dono completa depois.
    telefone: "",
    ultimaVisita: c.ultima,
    valorCents: 0,
    visitas: [{ data: c.ultima, valorCents: 0 }],
  }));

  return {
    clientes,
    ignoradas,
    origem: "whatsapp",
    aviso:
      "Estas datas são de CONVERSA, não de atendimento. A pessoa pode ter falado com você sem ter ido. " +
      "Use como ponto de partida e confirme antes de tratar como visita — tratar conversa como visita infla o cálculo.",
  };
}

// --- entrada única ----------------------------------------------------------

export function importar(
  texto: string,
  opcoes: { meuNome?: string } = {},
): Importacao {
  if (detectarFormato(texto) === "whatsapp") {
    return importarWhatsApp(texto, opcoes.meuNome);
  }

  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) {
    return { clientes: [], ignoradas: [], origem: "tabular", aviso: null };
  }

  const sep = detectarSeparador(linhas[0]);
  const primeira = dividir(linhas[0], sep);
  const mapa = primeira.map(classificarCabecalho);
  const temCabecalho = mapa.filter(Boolean).length >= 2;

  // Sem cabeçalho reconhecível, adivinha pela cara do conteúdo.
  const colunas = temCabecalho ? mapa : inferirColunas(dividir(linhas[0], sep));
  const corpo = temCabecalho ? linhas.slice(1) : linhas;

  const porTelefone = new Map<string, ClienteImportado>();
  const ignoradas: LinhaIgnorada[] = [];

  corpo.forEach((linha, i) => {
    const campos = dividir(linha, sep);
    const pega = (chave: string) => {
      const idx = colunas.indexOf(chave);
      return idx >= 0 ? (campos[idx] ?? "") : "";
    };

    const nome = pega("nome").trim();
    const telefone = lerTelefone(pega("telefone"));

    if (!telefone) {
      ignoradas.push({
        linha: i + (temCabecalho ? 2 : 1),
        conteudo: linha.slice(0, 60),
        motivo: "Sem telefone válido (precisa de 10 a 13 dígitos)",
      });
      return;
    }

    const data = lerData(pega("data"));
    const valor = lerValorCents(pega("valor"));

    const existente = porTelefone.get(telefone);
    if (existente) {
      if (data) existente.visitas.push({ data, valorCents: valor });
      if (data && (!existente.ultimaVisita || data > existente.ultimaVisita)) {
        existente.ultimaVisita = data;
      }
      if (valor > existente.valorCents) existente.valorCents = valor;
      if (!existente.nome && nome) existente.nome = nome;
    } else {
      porTelefone.set(telefone, {
        nome: nome || "Sem nome",
        telefone,
        ultimaVisita: data,
        valorCents: valor,
        visitas: data ? [{ data, valorCents: valor }] : [],
      });
    }
  });

  return { clientes: [...porTelefone.values()], ignoradas, origem: "tabular", aviso: null };
}

/** Sem cabeçalho: telefone é o campo só de dígitos, data tem cara de data. */
function inferirColunas(campos: string[]): (string | null)[] {
  return campos.map((c) => {
    if (lerTelefone(c)) return "telefone";
    if (lerData(c)) return "data";
    if (/^[R$\s]*[\d.,]+$/.test(c.trim()) && c.trim()) return "valor";
    return /[a-zA-ZÀ-ÿ]/.test(c) ? "nome" : null;
  });
}
