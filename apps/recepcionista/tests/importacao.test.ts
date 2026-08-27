import { describe, expect, it } from "vitest";
import { detectarFormato, importar } from "@/lib/importacao/parsers";
import { gerarDiagnostico } from "@/lib/importacao/diagnostico";

// ---------------------------------------------------------------------------
// RESGATE DO CADERNO
//
// A promessa é "manda a lista do jeito que ela estiver". Isso significa que a
// fricção de importar é problema NOSSO, não do dono — é exatamente onde a
// adoção morre em todo concorrente. Então o parser tem que engolir planilha
// torta, exportação de conversa do WhatsApp e cola do Excel, e dizer em
// português o que não conseguiu ler, em vez de falhar em silêncio.
// ---------------------------------------------------------------------------
describe("detectarFormato", () => {
  it("reconhece exportação de conversa do WhatsApp", () => {
    const txt = `01/03/2026 14:22 - Marcos Vinicius: bom dia, tem horário hoje?
02/03/2026 09:10 - Denise Araújo: oi`;
    expect(detectarFormato(txt)).toBe("whatsapp");
  });

  it("reconhece CSV com cabeçalho", () => {
    expect(detectarFormato("nome,telefone,ultima_visita\nAna,11999998888,01/03/2026")).toBe("tabular");
  });

  it("reconhece colagem do Excel (separada por tabulação)", () => {
    expect(detectarFormato("Nome\tTelefone\nAna\t11999998888")).toBe("tabular");
  });
});

describe("importar — planilha", () => {
  it("aceita vírgula, ponto-e-vírgula, tabulação e barra vertical", () => {
    for (const sep of [",", ";", "\t", "|"]) {
      const r = importar(`nome${sep}telefone\nAna Paula${sep}(11) 99999-8888`);
      expect(r.clientes).toHaveLength(1);
      expect(r.clientes[0].nome).toBe("Ana Paula");
    }
  });

  it("reconhece cabeçalhos em qualquer variação, com ou sem acento", () => {
    const variantes = [
      "nome,telefone",
      "NOME,TELEFONE",
      "Cliente,Celular",
      "nome do cliente,whatsapp",
      "Nome;Fone",
    ];
    for (const cab of variantes) {
      const r = importar(`${cab}\nAna,11999998888`.replace(",", cab.includes(";") ? ";" : ","));
      expect(r.clientes.length, cab).toBe(1);
    }
  });

  it("limpa o telefone e mantém só dígitos", () => {
    const r = importar("nome,telefone\nAna,+55 (11) 9 9999-8888");
    expect(r.clientes[0].telefone).toBe("5511999998888");
  });

  it("entende data brasileira, com barra ou traço, ano de 2 ou 4 dígitos", () => {
    const r = importar(
      "nome,telefone,ultima visita\n" +
        "A,11911111111,05/03/2026\n" +
        "B,11922222222,05-03-2026\n" +
        "C,11933333333,05/03/26",
    );
    const datas = r.clientes.map((c) => c.ultimaVisita?.toISOString().slice(0, 10));
    expect(datas).toEqual(["2026-03-05", "2026-03-05", "2026-03-05"]);
  });

  it("entende também o formato ISO, sem confundir dia com mês", () => {
    const r = importar("nome,telefone,data\nA,11911111111,2026-03-05");
    expect(r.clientes[0].ultimaVisita?.toISOString().slice(0, 10)).toBe("2026-03-05");
  });

  it("lê dinheiro no formato brasileiro", () => {
    const r = importar(
      "nome,telefone,valor\n" +
        "A,11911111111,\"R$ 1.234,56\"\n" +
        "B,11922222222,55\n" +
        "C,11933333333,\"89,90\"",
    );
    expect(r.clientes.map((c) => c.valorCents)).toEqual([123456, 5500, 8990]);
  });

  it("exige apenas nome e telefone — o resto é opcional", () => {
    const r = importar("nome,telefone\nAna,11999998888");
    expect(r.clientes[0].ultimaVisita).toBeNull();
    expect(r.clientes[0].valorCents).toBe(0);
  });

  it("junta visitas repetidas do mesmo telefone em um cliente só", () => {
    const r = importar(
      "nome,telefone,data,valor\n" +
        "Ana,11999998888,01/02/2026,50\n" +
        "Ana,11999998888,01/03/2026,60\n" +
        "Ana,(11) 99999-8888,01/04/2026,70",
    );
    expect(r.clientes).toHaveLength(1);
    expect(r.clientes[0].visitas).toHaveLength(3);
    // A última visita é a mais recente das três.
    expect(r.clientes[0].ultimaVisita?.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("descarta linha sem telefone e DIZ o motivo, em vez de falhar calado", () => {
    const r = importar("nome,telefone\nAna,11999998888\nSem Telefone,\nBeto,119");
    expect(r.clientes).toHaveLength(1);
    expect(r.ignoradas).toHaveLength(2);
    expect(r.ignoradas[0].motivo).toMatch(/telefone/i);
  });

  it("sobrevive a arquivo sem cabeçalho, adivinhando pelas colunas", () => {
    const r = importar("Ana Paula,11999998888,01/03/2026");
    expect(r.clientes).toHaveLength(1);
    expect(r.clientes[0].nome).toBe("Ana Paula");
    expect(r.clientes[0].telefone).toBe("11999998888");
  });

  it("ignora linhas vazias e espaços sobrando", () => {
    const r = importar("nome,telefone\n\n  Ana  ,  11999998888  \n\n");
    expect(r.clientes).toHaveLength(1);
    expect(r.clientes[0].nome).toBe("Ana");
  });
});

describe("importar — exportação de conversa do WhatsApp", () => {
  const conversa = `01/02/2026 14:22 - Marcos Vinicius: bom dia, tem horário hoje?
01/02/2026 14:25 - Barbearia do Zé: tenho sim, às 15h
15/03/2026 10:02 - Denise Araújo: oi, quero marcar
20/04/2026 08:00 - Marcos Vinicius: consigo amanhã?`;

  it("extrai os contatos e a última interação de cada um", () => {
    const r = importar(conversa, { meuNome: "Barbearia do Zé" });
    const nomes = r.clientes.map((c) => c.nome).sort();
    expect(nomes).toEqual(["Denise Araújo", "Marcos Vinicius"]);
    const marcos = r.clientes.find((c) => c.nome === "Marcos Vinicius")!;
    expect(marcos.ultimaVisita?.toISOString().slice(0, 10)).toBe("2026-04-20");
  });

  it("não transforma o próprio dono em cliente", () => {
    const r = importar(conversa, { meuNome: "Barbearia do Zé" });
    expect(r.clientes.some((c) => c.nome === "Barbearia do Zé")).toBe(false);
  });

  it("marca a origem para o produto avisar que a data é de CONVERSA, não de visita", () => {
    // Conversa não é atendimento. Tratar como visita infla o ciclo e o R$ —
    // e inflar o número é a forma mais rápida de perder o cliente.
    const r = importar(conversa, { meuNome: "Barbearia do Zé" });
    expect(r.origem).toBe("whatsapp");
    expect(r.aviso).toMatch(/conversa/i);
  });
});

// ---------------------------------------------------------------------------
// O DIAGNÓSTICO DE RECEITA PARADA — a peça de venda.
// Nunca mostra número solto: sempre faixa, método e selo de confiança. Número
// solto vira publicidade enganosa pelo CDC, mesmo sem intenção.
// ---------------------------------------------------------------------------
describe("gerarDiagnostico", () => {
  const hoje = new Date("2026-06-01T12:00:00.000Z");
  const dias = (n: number) => new Date(hoje.getTime() - n * 86400000);

  const base = [
    // Sumido há muito, regular, ticket bom → o melhor candidato.
    { nome: "Marcos Vinicius", telefone: "11911111111", visitas: [
      { data: dias(96), valorCents: 5500 }, { data: dias(117), valorCents: 5500 },
      { data: dias(138), valorCents: 5500 }, { data: dias(159), valorCents: 5500 },
    ]},
    // Alto valor, quebra recente.
    { nome: "Denise Araújo", telefone: "11922222222", visitas: [
      { data: dias(74), valorCents: 12000 }, { data: dias(110), valorCents: 12000 },
      { data: dias(148), valorCents: 12000 },
    ]},
    // Em dia — não pode aparecer como sumido.
    { nome: "Carla Em Dia", telefone: "11933333333", visitas: [
      { data: dias(5), valorCents: 6000 }, { data: dias(30), valorCents: 6000 },
      { data: dias(56), valorCents: 6000 },
    ]},
    // Só uma visita → confiança baixa.
    { nome: "Pedro Uma Visita", telefone: "11944444444", visitas: [
      { data: dias(200), valorCents: 4000 },
    ]},
  ];

  it("conta a base e separa quem sumiu de quem está em dia", () => {
    const d = gerarDiagnostico(base, { hoje, medianaSegmentoDias: 26 });
    expect(d.totalClientes).toBe(4);
    expect(d.sumidos).toBe(3);
    expect(d.nomes.some((n) => n.nome === "Carla Em Dia")).toBe(false);
  });

  it("nunca devolve um número solto — sempre faixa mínima e máxima", () => {
    const d = gerarDiagnostico(base, { hoje, medianaSegmentoDias: 26 });
    expect(d.recuperavelCents.min).toBeGreaterThan(0);
    expect(d.recuperavelCents.max).toBeGreaterThan(d.recuperavelCents.min);
    expect(d.recuperavelCents.central).toBeGreaterThanOrEqual(d.recuperavelCents.min);
    expect(d.recuperavelCents.central).toBeLessThanOrEqual(d.recuperavelCents.max);
  });

  it("a faixa sai de 15% a 25% sobre o que o cliente gastaria RETOMANDO o ciclo", () => {
    // O cliente recuperado não volta uma vez e some: ele retoma a rotina dele.
    // Ciclo de 30 dias numa janela de 90 = 3 visitas. Contar só uma subestima
    // em 3x — e subestimar também é impreciso, não só inflar.
    const um = [{ nome: "Só Um", telefone: "11955555555", visitas: [
      { data: dias(200), valorCents: 10000 }, { data: dias(230), valorCents: 10000 },
      { data: dias(260), valorCents: 10000 },
    ]}];
    const d = gerarDiagnostico(um, { hoje, medianaSegmentoDias: 26 });
    expect(d.visitasEsperadasNoPeriodo).toBe(3);
    expect(d.recuperavelCents.min).toBe(4500);
    expect(d.recuperavelCents.max).toBe(7500);
  });

  it("limita as visitas esperadas a 4, para não inflar ciclo curto", () => {
    // Academia com ciclo de 7 dias daria 13 visitas em 90 dias. Projetar isso
    // é fantasia: ninguém recupera alguém e mantém 13 idas seguidas.
    const semanal = [{ nome: "Semanal", telefone: "11988888888", visitas: [
      { data: dias(60), valorCents: 5000 }, { data: dias(67), valorCents: 5000 },
      { data: dias(74), valorCents: 5000 },
    ]}];
    const d = gerarDiagnostico(semanal, { hoje, medianaSegmentoDias: 26 });
    expect(d.visitasEsperadasNoPeriodo).toBeLessThanOrEqual(4);
  });

  it("entrega no máximo 3 nomes — o resto é o produto pago", () => {
    const d = gerarDiagnostico(base, { hoje, medianaSegmentoDias: 26 });
    expect(d.nomes.length).toBeLessThanOrEqual(3);
  });

  it("ordena os 3 por chance de voltar, não só por valor", () => {
    const d = gerarDiagnostico(base, { hoje, medianaSegmentoDias: 26 });
    // Marcos tem ticket menor que Denise mas é o mais regular da lista.
    expect(d.nomes[0].nome).toBe("Marcos Vinicius");
  });

  it("cada nome vem com o porquê auditável, em português", () => {
    const d = gerarDiagnostico(base, { hoje, medianaSegmentoDias: 26 });
    expect(d.nomes[0].porque).toMatch(/\d+ dias/);
    expect(d.nomes[0].porque.length).toBeGreaterThan(20);
  });

  it("admite confiança baixa quando a base tem pouco histórico", () => {
    const magra = [{ nome: "Uma Visita", telefone: "11966666666", visitas: [
      { data: dias(200), valorCents: 4000 },
    ]}];
    const d = gerarDiagnostico(magra, { hoje, medianaSegmentoDias: 26 });
    expect(d.confianca).toBe("baixa");
    expect(d.motivoConfianca).toMatch(/histórico|visita/i);
  });

  it("aplica o Corte Honesto: base pequena demais é recusada, com o motivo", () => {
    // Recusar a venda na frente do comprador prova a Constituição em ato — e
    // filtra o churn do mês 2, porque base pequena não tem o que recuperar.
    const magra = [{ nome: "Único", telefone: "11977777777", visitas: [
      { data: dias(200), valorCents: 1000 },
    ]}];
    const d = gerarDiagnostico(magra, { hoje, medianaSegmentoDias: 26 });
    expect(d.corteHonesto).toBe(true);
    expect(d.recomendacao).toMatch(/não/i);
  });

  it("base robusta passa no Corte Honesto", () => {
    const grande = Array.from({ length: 60 }, (_, i) => ({
      nome: `Cliente ${i}`,
      telefone: `1190000${String(i).padStart(4, "0")}`,
      visitas: [
        { data: dias(100 + i), valorCents: 8000 },
        { data: dias(130 + i), valorCents: 8000 },
        { data: dias(160 + i), valorCents: 8000 },
      ],
    }));
    const d = gerarDiagnostico(grande, { hoje, medianaSegmentoDias: 26 });
    expect(d.corteHonesto).toBe(false);
    // 60 sumidos x R$80 x 3 visitas em 90 dias x 15% = R$2.160
    expect(d.recuperavelCents.min).toBe(216000);
  });

  it("base vazia não explode — devolve diagnóstico honesto de base vazia", () => {
    const d = gerarDiagnostico([], { hoje, medianaSegmentoDias: 26 });
    expect(d.totalClientes).toBe(0);
    expect(d.corteHonesto).toBe(true);
    expect(d.nomes).toEqual([]);
  });
});
