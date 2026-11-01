import { describe, expect, it } from "vitest";
import { extracaoDeConversaSchema, lacunasDoDialogoConfiguracao, preencherPorConversa, proximaPerguntaDaConfiguracao } from "@/lib/atendente/conversa-motor";
import type { EstadoConversaConfiguracao } from "@/lib/atendente/conversa-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

function base() {
  const c = configuracaoExemplo(); c.negocio.nome = "Empresa Exemplo"; c.negocio.segmento = "Serviços";
  c.informacoes.servicos = []; c.conhecimento.itens = []; return c;
}
function extracao(patch: Record<string, unknown> = {}) {
  return { nome: null, segmento: null, descricao: null, endereco: null, regiao: null, pagamento: null, nomeAtendente: null,
    modalidade: null, objetivo: null, jeito: null, quando: null, agendamento: null, servicos: [], perguntas: [], esclarecimento: null, ...patch };
}
const item = (nome: string, evidencia = nome, patch: Record<string, unknown> = {}) => ({
  nome, evidencia, precoCents: null, duracaoMin: null, sobConsulta: false, descricao: null, ...patch,
});
function aplicar(texto: string, x?: unknown, c = base(), estado: EstadoConversaConfiguracao = { ignoradas: [], mensagens: [], ultimaPergunta: null }) {
  let id = 0; return preencherPorConversa(c, texto, estado, x, () => `novo:${++id}`);
}

describe("entendimento de serviços e categorias na configuração", () => {
  it("não descarta um fato porque o modelo normalizou maiúsculas, acentos ou espaços", () => {
    const texto = "nos somos Espaco Aurora. fazemos estetica com cabelo, unhas e cilios";
    const r = aplicar(texto, extracao({ nome: { valor: "Espaço Aurora", evidencia: "Nos somos Espaço Aurora" }, segmento: { valor: "Estética", evidencia: "Fazemos estética com cabelo, unhas e cílios" } }));
    expect(r.rascunho.negocio.nome).toBe("Espaço Aurora");
    expect(r.rascunho.negocio.segmento).toBe("Estética");
    expect(r.rascunho.informacoes.servicos).toEqual([]);
  });
  it("reproduz a frase ampla de estética sem transformá-la em serviço nem perguntar preço", () => {
    const texto = "oferecemos serviços em estética geral com cabelos unhas cílios etc";
    const r = aplicar(texto);
    expect(r.rascunho.informacoes.servicos).toEqual([]);
    expect(r.esclarecimento).toMatchObject({ chave: "esclarecimento:informacoes.servicos", sugestoes: [] });
    expect(r.esclarecimento?.texto).not.toContain(texto);
    expect(r.esclarecimento?.texto).toBe("Quais serviços vocês fazem nessa área?");
    expect(r.esclarecimento?.texto).not.toMatch(/preço|valor|corte|manicure/i);
  });

  it.each([
    "Oferecemos serviços de saúde em geral para adultos e crianças",
    "Temos diversos serviços de contabilidade para empresas",
    "Trabalhamos com soluções em tecnologia e segurança etc",
    "Temos produtos variados para animais",
  ])("o fallback pede detalhes em qualquer segmento: %s", texto => {
    const r = aplicar(texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.esclarecimento?.chave).toBe("esclarecimento:informacoes.servicos");
  });

  it.each([
    ["Oferecemos corte masculino, manicure e extensão de cílios", ["corte masculino", "manicure", "extensão de cílios"]],
    ["Fazemos troca de óleo, alinhamento e balanceamento", ["troca de óleo", "alinhamento", "balanceamento"]],
    ["Temos consulta clínica, vacinação e ultrassonografia", ["consulta clínica", "vacinação", "ultrassonografia"]],
    ["Vendemos ração, coleira e brinquedos", ["ração", "coleira", "brinquedos"]],
  ] as Array<[string, string[]]>)("a interpretação válida separa os itens sem catálogo paralelo: %s", (texto, nomes) => {
    const r = aplicar(texto, extracao({ servicos: nomes.map(nome => item(nome)) }));
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(nomes);
    expect(r.rascunho.informacoes.servicos.every(s => s.precoCents === null && s.duracaoMin === null)).toBe(true);
    expect(r.esclarecimento).toBeUndefined();
  });

  it.each(["Banho e tosa", "Design e desenvolvimento de sites", "Compra e venda de veículos"])("preserva uma oferta composta declarada pela interpretação: %s", nome => {
    const r = aplicar(nome, extracao({ servicos: [item(nome)] }));
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual([nome]);
    expect(r.esclarecimento).toBeUndefined();
  });

  it("sem interpretação, esclarece se a conjunção indica um pacote ou itens separados", () => {
    const r = aplicar("Banho e tosa");
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.esclarecimento?.chave).toBe("esclarecimento:informacoes.servicos");
  });

  it("não dá preço a categorias reconhecidas pela IA nem perde um pagamento explícito", () => {
    const texto = "Cabelos, unhas e cílios. Aceitamos Pix.";
    const r = aplicar(texto, extracao({
      pagamento: { valor: "Pix", evidencia: "Aceitamos Pix." },
      servicos: [item("Cabelos"), item("unhas"), item("cílios")],
      esclarecimento: { campo: "informacoes.servicos", evidencia: "Cabelos, unhas e cílios.", pergunta: "Quais serviços específicos vocês oferecem nessas áreas?" },
    }));
    expect(r.rascunho.informacoes.servicos).toEqual([]);
    expect(r.rascunho.informacoes.pagamento.valor).toBe("Pix");
    expect(r.esclarecimento?.texto).toBe("Quais serviços específicos vocês oferecem nessas áreas?");
  });

  it("mantém preços e durações distintos com evidência própria por serviço", () => {
    const texto = "Consulta custa R$150 e dura 30 minutos; Vacinação custa R$80 e dura 15 minutos";
    const r = aplicar(texto, extracao({ servicos: [
      item("Consulta", "Consulta custa R$150 e dura 30 minutos", { precoCents: 15000, duracaoMin: 30 }),
      item("Vacinação", "Vacinação custa R$80 e dura 15 minutos", { precoCents: 8000, duracaoMin: 15 }),
    ] }));
    expect(r.rascunho.informacoes.servicos.map(s => [s.nome, s.precoCents, s.duracaoMin])).toEqual([
      ["Consulta", 15000, 30], ["Vacinação", 8000, 15],
    ]);
  });

  it("não inventa procedimentos concretos a partir de uma categoria", () => {
    const r = aplicar("cabelos", extracao({ servicos: [item("corte masculino", "cabelos", { precoCents: 5000, duracaoMin: 30 })] }));
    expect(r.rascunho.informacoes.servicos.some(s => s.nome === "corte masculino")).toBe(false);
    expect(r.rascunho.informacoes.servicos.every(s => s.precoCents === null && s.duracaoMin === null)).toBe(true);
  });

  it("não registra a frase de correção ou negação como um serviço", () => {
    const r = aplicar("Não fazemos massagem, na verdade trabalhamos com outra área");
    expect(r.rascunho.informacoes.servicos).toEqual([]);
    expect(r.esclarecimento).toBeDefined();
  });

  it("detecta um cadastro amplo antigo antes de pedir seu preço e preserva-o para revisão", () => {
    const c = base(); const anterior = { ...configuracaoExemplo().informacoes.servicos[0], nome: "serviços em estética geral com cabelos unhas cílios etc", precoCents: null };
    c.informacoes.servicos = [anterior];
    expect(proximaPerguntaDaConfiguracao(c)?.chave).toBe("esclarecimento:informacoes.servicos");
    const r = aplicar("corte masculino e extensão de cílios", extracao({ servicos: [item("corte masculino"), item("extensão de cílios")] }), c);
    expect(r.rascunho.informacoes.servicos.find(s => s.id === anterior.id)).toMatchObject({ nome: anterior.nome, situacao: "REVISAR" });
    expect(r.rascunho.informacoes.servicos).toHaveLength(3);
    expect(r.aviso).toContain("preservado");
    expect(proximaPerguntaDaConfiguracao(r.rascunho, r)?.texto).toContain("valor de corte masculino");
  });

  it("um JSON de extração incompleto mantém o fallback conservador", () => {
    const r = aplicar("oferecemos serviços em estética geral com cabelos unhas cílios etc", { servicos: [item("cabelos")] });
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.esclarecimento).toBeDefined();
  });

  it.each(["cabelos unhas cílios", "carros motos caminhões"])("sem IA, uma enumeração solta não vira um nome de serviço: %s", texto => {
    const r = aplicar(texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.esclarecimento?.chave).toBe("esclarecimento:informacoes.servicos");
  });

  it.each(["cabelos unhas cílios", "Corte masculino", "Massagem relaxante e esportiva"])("um contrato válido vazio não é substituído pelo catálogo local: %s", texto => {
    const r = aplicar(texto, extracao());
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.esclarecimento).toBeUndefined();
  });

  it("uma apresentação reconhecida não vira um serviço adicional", () => {
    const texto = "Sou uma clínica de massagens";
    const r = aplicar(texto, extracao({ descricao: { valor: texto, evidencia: texto } }));
    expect(r.rascunho.negocio.descricao.valor).toBe(texto);
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
  });

  it.each([
    ["Massagem relaxante de uma hora e meia por R$150", "Massagem relaxante", 15000, 90],
    ["Corte e barba por R$80", "Corte e barba", 8000, null],
  ])("sem contrato de IA, um preço explícito permite recuperar a declaração objetiva: %s", (texto, nome, precoCents, duracaoMin) => {
    const r = aplicar(String(texto));
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ nome, precoCents, duracaoMin });
    expect(r.esclarecimento).toBeUndefined();
  });

  it.each(["Massagem relaxante de uma hora e meia por R$150", "Corte e barba por R$80", "Meu aluguel custa R$1000, o preço da revisão eu ainda não sei."])("não cria serviços por regex quando a interpretação válida não declarou uma oferta: %s", texto => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const estado = { mensagens: [], ignoradas: [], ultimaPergunta: "servico:servico1:preco", perguntaPendente: { chave: "servico:servico1:preco", texto: "Qual o valor da Revisão?", sugestoes: [] } };
    const r = aplicar(texto, extracao(), c, estado);
    expect(r.rascunho.informacoes.servicos).toEqual(c.informacoes.servicos);
    expect(r.alteracoes.some(a => /Serviço:|Preço:/.test(a))).toBe(false);
  });

  it.each(["Não tenho outros serviços, são só esses.", "Esses são os serviços.", "Já passei todos os serviços."])("encerra a lista declarada sem perguntar os mesmos serviços novamente: %s", texto => {
    const c = configuracaoExemplo();
    const r = aplicar(texto, extracao(), c, { mensagens: [], ignoradas: [], ultimaPergunta: "informacoes.servicos",
      perguntaPendente: { chave: "informacoes.servicos", texto: "Quais outros serviços você quer incluir na lista?", sugestoes: [] } });
    expect(r.ignoradas).toContain("informacoes.servicos");
    expect(r.esclarecimento).toBeUndefined(); expect(r.rascunho).toEqual(c);
    expect(lacunasDoDialogoConfiguracao(r.rascunho, { ignoradas: r.ignoradas }, "SERVICOS").some(q => q.chave === "informacoes.servicos")).toBe(false);
  });

  it("não encerra cedo nem descarta um serviço acrescentado depois da vírgula", () => {
    const c = configuracaoExemplo(); const texto = "Não tenho outros serviços, mas também ofereço Escova.";
    const r = aplicar(texto, extracao({ servicos: [item("Escova", "também ofereço Escova")] }), c,
      { mensagens: [], ignoradas: [], ultimaPergunta: "informacoes.servicos", perguntaPendente: { chave: "informacoes.servicos", texto: "Quais outros serviços?", sugestoes: [] } });
    expect(r.rascunho.informacoes.servicos.some(s => s.nome === "Escova")).toBe(true);
    expect(r.ignoradas).not.toContain("informacoes.servicos");
  });

  it.each(["Prefiro falar disso depois.", "Agora quero mudar para os horários."])("uma preferência sem fatos extraídos não vira FAQ confirmada: %s", texto => {
    const c = base();
    const r = aplicar(texto, extracao(), c, { mensagens: [], ignoradas: [], ultimaPergunta: "conhecimento",
      perguntaPendente: { chave: "conhecimento", texto: "Tem alguma regra importante?", sugestoes: [] } });
    expect(r.rascunho.conhecimento.itens).toEqual([]); expect(r.alteracoes).not.toContain("Regra de atendimento");
  });

  it("a regra legada sem IA continua sendo recebida em sua pergunta visível", () => {
    const r = aplicar("A tolerância de atraso é de dez minutos.", undefined, base(), { mensagens: [], ignoradas: [], ultimaPergunta: "conhecimento",
      perguntaPendente: { chave: "conhecimento", texto: "Tem alguma regra importante?", sugestoes: [] } });
    expect(r.rascunho.conhecimento.itens[0]?.resposta).toBe("A tolerância de atraso é de dez minutos.");
  });

  it.each([
    "Os dois de cabelo custam R$80 cada. O corte dura 30 minutos e a escova 45 minutos.",
    "Os dois de cabelo custam R$80 cada. A escova dura 45 minutos e o corte 30 minutos.",
  ])("liga a duração ao serviço correto mesmo quando o modelo usa toda a evidência: %s", texto => {
    const c = base(); const servico = configuracaoExemplo().informacoes.servicos[0];
    c.informacoes.servicos = [
      { ...servico, id: "corte", nome: "Corte feminino", precoCents: null, duracaoMin: null },
      { ...servico, id: "escova", nome: "Escova", precoCents: null, duracaoMin: null },
    ];
    const r = aplicar(texto, extracao({ servicos: [
      item("Corte feminino", texto, { precoCents: 8000, duracaoMin: 30 }),
      item("Escova", texto, { precoCents: 8000, duracaoMin: 45 }),
    ] }), c);
    expect(r.rascunho.informacoes.servicos.map(s => [s.nome, s.precoCents, s.duracaoMin])).toEqual([
      ["Corte feminino", 8000, 30], ["Escova", 8000, 45],
    ]);
  });

  it("uma referência de grupo com duas durações sem associação não atribui a primeira a todos", () => {
    const c = base(); const servico = configuracaoExemplo().informacoes.servicos[0];
    c.informacoes.servicos = [{ ...servico, id: "corte", nome: "Corte feminino", duracaoMin: null }, { ...servico, id: "escova", nome: "Escova", duracaoMin: null }];
    const texto = "Os dois duram 30 minutos e 45 minutos.";
    const r = aplicar(texto, extracao({ servicos: [item("Corte feminino", texto, { duracaoMin: 30 }), item("Escova", texto, { duracaoMin: 45 })] }), c);
    expect(r.rascunho.informacoes.servicos.every(s => s.duracaoMin === null)).toBe(true);
  });

  it("preserva dois preços distintos e uma duração explicitamente comum na mesma evidência ampla", () => {
    const c = base(); const servico = configuracaoExemplo().informacoes.servicos[0];
    c.informacoes.servicos = [{ ...servico, id: "manicure", nome: "Manicure", precoCents: null, duracaoMin: null },
      { ...servico, id: "pedicure", nome: "Pedicure", precoCents: null, duracaoMin: null }];
    const texto = "Na manicure nois cobra 35 reais. Na pedicure eh 40 reais. As duas leva 45 minutos.";
    const r = aplicar(texto, extracao({ servicos: [item("Manicure", texto, { precoCents: 3500, duracaoMin: 45 }),
      item("Pedicure", texto, { precoCents: 4000, duracaoMin: 45 })] }), c);
    expect(r.rascunho.informacoes.servicos.map(s => [s.nome, s.precoCents, s.duracaoMin])).toEqual([
      ["Manicure", 3500, 45], ["Pedicure", 4000, 45],
    ]);
  });

  it("não interpreta uma referência de preço comum como duração comum", () => {
    const c = base(); const servico = configuracaoExemplo().informacoes.servicos[0];
    c.informacoes.servicos = [{ ...servico, id: "manicure", nome: "Manicure", duracaoMin: null }, { ...servico, id: "pedicure", nome: "Pedicure", duracaoMin: null }];
    const texto = "As duas custam R$80 cada. A manicure dura 30 minutos. A pedicure ainda está sem duração definida.";
    const r = aplicar(texto, extracao({ servicos: [item("Manicure", texto, { precoCents: 8000, duracaoMin: 30 }),
      item("Pedicure", texto, { precoCents: 8000, duracaoMin: 30 })] }), c);
    expect(r.rascunho.informacoes.servicos.map(s => s.duracaoMin)).toEqual([30, null]);
  });
});

describe("esclarecimentos seguros e continuidade", () => {
  it("aceita o contrato anterior sem o campo novo", () => {
    const { esclarecimento: _esclarecimento, ...anterior } = extracao();
    expect(extracaoDeConversaSchema.parse(anterior).esclarecimento).toBeNull();
  });

  it("responde uma dúvida administrativa sem gravá-la como regra ou mandar para o simulador", () => {
    const texto = "O que quer dizer com serviços?";
    const r = aplicar(texto, extracao({ esclarecimento: { campo: "informacoes.servicos", evidencia: texto, pergunta: "Quais atendimentos ou produtos sua empresa oferece?" } }));
    expect(r.esclarecimento?.texto).toBe("Quais atendimentos ou produtos sua empresa oferece?");
    expect(r.rascunho.conhecimento.itens).toEqual([]);
    expect(r.rascunho.informacoes.servicos).toEqual([]);
    expect(r.resposta).not.toMatch(/simulador|Testar atendimento/);
  });

  it("bloqueia apenas o campo ambíguo e mantém fatos independentes", () => {
    const texto = "Atendo no Centro e aceito Pix.";
    const r = aplicar(texto, extracao({
      endereco: { valor: "Centro", evidencia: "Atendo no Centro" }, pagamento: { valor: "Pix", evidencia: "aceito Pix." },
      esclarecimento: { campo: "informacoes.endereco", evidencia: "Atendo no Centro", pergunta: "Qual é o endereço completo que posso informar?" },
    }));
    expect(r.rascunho.informacoes.endereco.valor).toBe("Rua Exemplo, 10");
    expect(r.rascunho.informacoes.pagamento.valor).toBe("Pix");
    expect(r.esclarecimento?.chave).toBe("esclarecimento:informacoes.endereco");
  });

  it.each([
    { evidencia: "Não foi dito", pergunta: "Qual é o serviço específico?" },
    { evidencia: "Massagem relaxante", pergunta: "Qual é a senha da sua conta?" },
    { evidencia: "Massagem relaxante", pergunta: "Qual serviço? E qual valor?" },
    { evidencia: "Massagem relaxante", pergunta: "O atendimento custa R$99?" },
  ])("ignora esclarecimento sem evidência ou pergunta segura: %j", pedido => {
    const r = aplicar("Massagem relaxante", extracao({ esclarecimento: { campo: "informacoes.servicos", ...pedido } }));
    expect(r.esclarecimento?.texto).not.toBe(pedido.pergunta);
    expect(r.esclarecimento).toBeUndefined();
  });

  it("não oferece sugestões inventadas", () => {
    const r = aplicar("Tenho várias áreas", extracao({ esclarecimento: { campo: "informacoes.servicos", evidencia: "várias áreas", pergunta: "Quais serviços específicos devo registrar?", sugestoes: ["Corte masculino", "várias áreas"] } }));
    expect(r.esclarecimento?.sugestoes).toEqual(["várias áreas"]);
  });

  it("preserva a referência do serviço ao esclarecer seu preço", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const texto = "O valor depende";
    const r = aplicar(texto, extracao({ esclarecimento: { campo: "informacoes.servicos", evidencia: texto, pergunta: "Como o valor desse serviço é definido?" } }), c);
    expect(r.esclarecimento?.chave).toBe("esclarecimento:servico:servico1:preco");
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBeNull();
  });

  it("usa a resposta curta na pergunta pendente, sem perder seu campo original", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const estado = { ignoradas: [], mensagens: [], ultimaPergunta: null, perguntaPendente: { chave: "esclarecimento:servico:servico1:preco", texto: "Qual é o valor fixo desse serviço?", sugestoes: [] } };
    const r = aplicar("150", undefined, c, estado);
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBe(15000);
  });

  it.each([true, false])("uma informação de pagamento não vira nome do atendente (IA: %s)", comIa => {
    const c = configuracaoExemplo(); c.atendimento.nome = "";
    expect(proximaPerguntaDaConfiguracao(c)?.chave).toBe("atendimento.nome");
    const r = aplicar("Aceitamos Pix", comIa ? extracao({ pagamento: { valor: "Pix", evidencia: "Aceitamos Pix" } }) : undefined, c);
    expect(r.rascunho.atendimento.nome).toBe("");
    expect(r.rascunho.informacoes.pagamento.valor).toContain("Pix");
  });

  it("entende o objetivo explícito em linguagem natural sem conceder permissão para reservar", () => {
    const c = base(); c.negocio.objetivo = "DUVIDAS"; c.atendimento.agendamento = "DESLIGADO";
    const texto = "É pra agendar sim";
    const r = aplicar(texto, extracao({ objetivo: { valor: "AGENDAMENTOS", evidencia: texto }, agendamento: { valor: "DIRETO", evidencia: texto } }), c);
    expect(r.rascunho.negocio.objetivo).toBe("AGENDAMENTOS");
    expect(r.rascunho.atendimento.agendamento).toBe("DESLIGADO");
  });

  it.each(["Não é para agendar", "Talvez eu queira agendar", "Atendemos clientes"])("não transforma negação ou intenção não comprovada em objetivo: %s", texto => {
    const c = base(); c.negocio.objetivo = "DUVIDAS"; c.atendimento.agendamento = "DESLIGADO";
    const r = aplicar(texto, extracao({ objetivo: { valor: "AGENDAMENTOS", evidencia: texto } }), c);
    expect(r.rascunho.negocio.objetivo).toBe("DUVIDAS");
    expect(r.rascunho.atendimento.agendamento).toBe("DESLIGADO");
  });
});

describe("diálogo contextual e atos mistos", () => {
  it("mantém compatibilidade com extrações sem o novo diálogo", () => {
    expect(extracaoDeConversaSchema.parse(extracao()).dialogo).toBeNull();
  });

  it.each(["Posso cobrar R$80?", "Quanto seria, R$80?"])("uma pergunta não autoriza preço mesmo com evidência literal extraída: %s", texto => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const r = aplicar(texto, extracao({ servicos: [item("Revisão", "R$80", { precoCents: 8000 })] }), c);
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBeNull();
  });

  it("salva o fato declarado e mantém a dúvida separada na mesma mensagem", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const texto = "Revisão custa R$80. Como funciona a agenda?";
    const r = aplicar(texto, extracao({ servicos: [item("Revisão", "Revisão custa R$80", { precoCents: 8000 })],
      dialogo: { intencao: "MISTO", resposta: "A agenda segue a opção configurada para o atendente.", fontesIds: ["produto:agenda"] },
    }), c);
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBe(8000);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
  });

  it("não usa a pergunta junto do fato como evidência de uma declaração", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const texto = "Revisão custa R$80. Posso cobrar isso?";
    const r = aplicar(texto, extracao({ servicos: [item("Revisão", texto, { precoCents: 8000 })] }), c);
    expect(r.rascunho.informacoes.servicos[0].precoCents).toBeNull();
  });

  it("uma declaração antes da pergunta com vírgula continua sendo informação válida", () => {
    const c = configuracaoExemplo(); c.negocio.nome = "";
    const texto = "Minha empresa se chama Horizonte, pode salvar?";
    const r = aplicar(texto, extracao({ nome: { valor: "Horizonte", evidencia: "Minha empresa se chama Horizonte" } }), c);
    expect(r.rascunho.negocio.nome).toBe("Horizonte");
    expect(aplicar(texto, undefined, c).rascunho.negocio.nome).toBe("");
  });

  it.each([true, false])("uma descrição do negócio não vira nome da empresa (IA: %s)", comIa => {
    const c = configuracaoExemplo(); c.negocio.nome = "";
    const texto = "Somos uma clínica de massagens";
    const r = aplicar(texto, comIa ? extracao({ nome: { valor: "clínica de massagens", evidencia: texto }, descricao: { valor: texto, evidencia: texto } }) : undefined, c);
    expect(r.rascunho.negocio.nome).toBe("");
  });

  it("o fallback não armazena uma instrução inteira no nome do atendente", () => {
    const c = configuracaoExemplo(); c.atendimento.nome = "";
    const r = aplicar("Pode chamar ela de Marina", undefined, c);
    expect(r.rascunho.atendimento.nome).toBe("");
  });

  it("entende a escolha e a correção do nome em dois turnos sem preservar a instrução", () => {
    const c = configuracaoExemplo(); c.atendimento.nome = "";
    const primeiro = aplicar("Pode chamar ela de Marina", extracao({ nomeAtendente: { valor: "Marina", evidencia: "Pode chamar ela de Marina" } }), c);
    const segundo = aplicar("Não, só Marina.", extracao({ nomeAtendente: { valor: "Marina", evidencia: "Não, só Marina." },
      dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] },
    }), primeiro.rascunho);
    expect(primeiro.rascunho.atendimento.nome).toBe("Marina");
    expect(segundo.rascunho.atendimento.nome).toBe("Marina");
  });

  it("complementa e corrige o complemento sem apagar o endereço nos turnos seguintes", () => {
    const c = configuracaoExemplo();
    const primeiro = aplicar("Nosso endereço é Rua das Flores, 20.", extracao({ endereco: { valor: "Rua das Flores, 20", evidencia: "Nosso endereço é Rua das Flores, 20." } }), c);
    const segundo = aplicar("O complemento é sala 5.", extracao({ endereco: { valor: "sala 5", evidencia: "O complemento é sala 5." } }), primeiro.rascunho);
    const terceiro = aplicar("O complemento agora é sala 6.", extracao({ endereco: { valor: "sala 6", evidencia: "O complemento agora é sala 6." } }), segundo.rascunho);
    expect(segundo.rascunho.informacoes.endereco.valor).toBe("Rua das Flores, 20, sala 5");
    expect(terceiro.rascunho.informacoes.endereco.valor).toBe("Rua das Flores, 20, sala 6");
  });

  it("pede o endereço principal antes de salvar somente um complemento", () => {
    const c = configuracaoExemplo(); c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
    const r = aplicar("O complemento é sala 5.", extracao({ endereco: { valor: "sala 5", evidencia: "O complemento é sala 5." } }), c);
    expect(r.rascunho.informacoes.endereco.valor).toBe("");
    expect(r.esclarecimento?.chave).toBe("esclarecimento:informacoes.endereco");
  });

  it("renomeia o mesmo serviço preservando identidade, preço e duração", () => {
    const c = configuracaoExemplo();
    const texto = "Esse serviço agora se chama Diagnóstico.";
    const r = aplicar(texto, extracao({ servicos: [item("Diagnóstico", texto)], dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] } }), c);
    expect(r.rascunho.informacoes.servicos).toHaveLength(1);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "servico1", nome: "Diagnóstico", precoCents: 9900, duracaoMin: 45 });
  });

  it("uma correção sem alvo inequívoco pede o item em vez de criar outra entidade", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "s2", nome: "Instalação" });
    const texto = "Esse serviço agora se chama Diagnóstico.";
    const r = aplicar(texto, extracao({ servicos: [item("Diagnóstico", texto)], dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] } }), c);
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["Revisão", "Instalação"]);
    expect(r.esclarecimento?.texto).toContain("Qual serviço");
  });

  it("remove somente um item explicitamente nomeado", () => {
    const c = configuracaoExemplo();
    const r = aplicar("Remova Revisão da lista de serviços.", extracao({ dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] } }), c);
    expect(r.rascunho.informacoes.servicos).toHaveLength(0);
    expect(r.alteracoes).toContain("Serviço removido: Revisão");
  });

  it.each(["Não remova Revisão", "Devo remover Revisão?", "Remova esse serviço"])("não remove serviço por negação, pergunta ou referência ambígua: %s", texto => {
    const c = configuracaoExemplo(); c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "s2", nome: "Instalação" });
    const r = aplicar(texto, extracao({ dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] } }), c);
    expect(r.rascunho.informacoes.servicos).toHaveLength(2);
  });

  it.each([
    ["EMPRESA", "negocio.nome"], ["SERVICOS", "informacoes.servicos"], ["FUNCIONAMENTO", "informacoes.endereco"],
    ["ATENDIMENTO", "atendimento.nome"], ["REGRAS", "conhecimento"],
  ] as const)("busca lacunas somente no tópico %s", (topico, chave) => {
    const c = base(); c.negocio.nome = ""; c.negocio.segmento = ""; c.atendimento.nome = "";
    c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
    expect(proximaPerguntaDaConfiguracao(c, { ignoradas: [] }, topico)?.chave).toBe(chave);
  });

  it("não usa uma pergunta oculta para associar uma resposta curta", () => {
    const c = configuracaoExemplo(); c.informacoes.servicos[0].precoCents = null;
    const estado = { mensagens: [], ignoradas: [], ultimaPergunta: null, perguntaSuspensa: true,
      perguntaPendente: { chave: "esclarecimento:servico:servico1:preco", texto: "Qual é o valor?", sugestoes: [] } };
    expect(proximaPerguntaDaConfiguracao(c, estado, "SERVICOS")).toBeNull();
    expect(aplicar("80", undefined, c, estado).rascunho.informacoes.servicos[0].precoCents).toBeNull();
    expect(proximaPerguntaDaConfiguracao(c, { ...estado, perguntaSuspensa: false }, "SERVICOS")?.chave).toContain("servico:servico1:preco");
  });
});

describe("referências contextuais a serviços conhecidos", () => {
  function doisServicos() {
    const c = configuracaoExemplo();
    c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "s2", nome: "Instalação", precoCents: 12000, duracaoMin: 60 });
    return c;
  }

  it("atualiza os dois preços quando o dono diz que todos custam o mesmo valor", () => {
    const c = doisServicos(); const texto = "Todos custam 80";
    const r = aplicar(texto, extracao({ servicos: c.informacoes.servicos.map(s => item(s.nome, texto, { precoCents: 8000 })) }), c);
    expect(r.rascunho.informacoes.servicos.map(s => [s.id, s.precoCents])).toEqual([["servico1", 8000], ["s2", 8000]]);
  });

  it("associa duração coletiva aos dois serviços existentes", () => {
    const c = doisServicos(); const texto = "Os dois duram 30 minutos";
    const r = aplicar(texto, extracao({ servicos: c.informacoes.servicos.map(s => item(s.nome, texto, { duracaoMin: 30 })) }), c);
    expect(r.rascunho.informacoes.servicos.map(s => [s.id, s.duracaoMin])).toEqual([["servico1", 30], ["s2", 30]]);
    expect(r.rascunho.informacoes.servicos.map(s => s.precoCents)).toEqual([9900, 12000]);
  });

  it("uma referência coletiva não autoriza nome novo inventado pela IA", () => {
    const c = doisServicos(); const texto = "Todos custam R$80";
    const r = aplicar(texto, extracao({ servicos: [...c.informacoes.servicos.map(s => item(s.nome, texto, { precoCents: 8000 })), item("Serviço inventado", texto, { precoCents: 8000 })] }), c);
    expect(r.rascunho.informacoes.servicos.map(s => s.nome)).toEqual(["Revisão", "Instalação"]);
    expect(r.rascunho.informacoes.servicos.map(s => s.precoCents)).toEqual([8000, 8000]);
  });

  it("perguntar se todos devem custar um valor não modifica os preços", () => {
    const c = doisServicos(); const texto = "Todos devem custar R$80?";
    const r = aplicar(texto, extracao({ servicos: c.informacoes.servicos.map(s => item(s.nome, texto, { precoCents: 8000 })) }), c);
    expect(r.rascunho.informacoes.servicos.map(s => s.precoCents)).toEqual([9900, 12000]);
  });

  it("a interpretação de uma referência ordinal atualiza somente o serviço resolvido", () => {
    const c = doisServicos(); const texto = "O primeiro custa R$80";
    const r = aplicar(texto, extracao({ servicos: [item("Revisão", texto, { precoCents: 8000 })] }), c);
    expect(r.rascunho.informacoes.servicos.map(s => s.precoCents)).toEqual([8000, 12000]);
  });
});

describe("prova de preço separada da duração na fala atual", () => {
  function cadastro() {
    const c = base();
    c.informacoes.servicos = ["manicure", "pedicure"].map((nome, i) => ({ id: `s${i}`, nome, descricao: "Nas unhas", precoModo: "FIXO", precoCents: null, duracaoMin: null, situacao: "CONFIRMADO", origem: "ASSISTENTE" }));
    return c;
  }
  const proposta = (precos: Array<number | null> = [3500, 4000]) => extracao({ servicos: ["manicure", "pedicure"].map((nome, i) => item(nome, "as duas leva 45 minutos", { precoCents: precos[i], duracaoMin: 45 })) });
  const propostaPelosPrecos = (duracoes: Array<number | null> = [45, 45]) => extracao({ servicos: [item("manicure", "na manicure nois cobra 35 reais", { precoCents: 3500, duracaoMin: duracoes[0] }), item("pedicure", "na pedicure eh 40 reais", { precoCents: 4000, duracaoMin: duracoes[1] })] });
  const precos = "na manicure nois cobra 35 reais. na pedicure eh 40 reais.";

  it("salva preços e durações da escrita informal mesmo com evidência citada só para duração", () => {
    const texto = "na manicure nois cobra 35 reais. na pedicure eh 40 reais. as duas leva 45 minutos";
    const r = aplicar(texto, proposta(), cadastro());
    expect(r.rascunho.informacoes.servicos.map(s => [s.nome, s.precoCents, s.duracaoMin])).toEqual([["manicure", 3500, 45], ["pedicure", 4000, 45]]);
  });

  it("não troca os preços quando a proposta associa o valor ao serviço errado", () => {
    const texto = "na manicure nois cobra 35 reais. na pedicure eh 40 reais. as duas leva 45 minutos";
    const r = aplicar(texto, proposta([4000, 3500]), cadastro());
    expect(r.rascunho.informacoes.servicos.map(s => s.precoCents)).toEqual([null, null]);
  });

  it("não completa preço que a IA não propôs", () => {
    const texto = "na manicure nois cobra 35 reais. na pedicure eh 40 reais. as duas leva 45 minutos";
    const r = aplicar(texto, proposta([null, null]), cadastro());
    expect(r.rascunho.informacoes.servicos.map(s => s.precoCents)).toEqual([null, null]);
  });

  it.each([
    "na manicure não cobra 35 reais",
    "se for manicure cobra 35 reais",
    "na manicure cobra a partir de 35 reais",
    "na manicure talvez cobre 35 reais",
    "a concorrente cobra manicure por 35 reais",
    "manicure por 35 reais?",
    "a cliente disse que manicure custa 35 reais",
  ])("não usa declaração não autorizada para completar o preço: %s", trecho => {
    const r = aplicar(`${trecho}. as duas leva 45 minutos`, proposta(), cadastro());
    expect(r.rascunho.informacoes.servicos.every(s => s.precoCents === null)).toBe(true);
  });

  it("não escolhe a oração favorável quando a fala atual dá dois preços conflitantes", () => {
    const r = aplicar("manicure custa 35 reais. manicure custa 50 reais. as duas leva 45 minutos", proposta(), cadastro());
    expect(r.rascunho.informacoes.servicos.every(s => s.precoCents === null)).toBe(true);
  });

  it("não recupera preço do histórico para preencher o que falta na fala atual", () => {
    const estado: EstadoConversaConfiguracao = { ignoradas: [], ultimaPergunta: null, mensagens: [{ id: "antiga", de: "dono", texto: "manicure custa 35 reais", em: "2026-10-29T00:00:00Z" }] };
    const r = aplicar("as duas leva 45 minutos", proposta(), cadastro(), estado);
    expect(r.rascunho.informacoes.servicos.every(s => s.precoCents === null)).toBe(true);
  });

  it("salva a duração comum dos dois serviços quando o modelo cita apenas as provas dos preços", () => {
    const c = cadastro();
    c.informacoes.servicos.push(...["corte", "escova", "cílios"].map((nome, i) => ({ ...c.informacoes.servicos[0], id: `extra${i}`, nome })));
    const r = aplicar(`${precos} as duas leva 45 minutos`, propostaPelosPrecos(), c);
    expect(r.rascunho.informacoes.servicos.map(s => [s.precoCents, s.duracaoMin])).toEqual([[3500, 45], [4000, 45], [null, null], [null, null], [null, null]]);
  });

  it("não completa duração que o modelo não propôs", () => {
    const r = aplicar(`${precos} as duas leva 45 minutos`, propostaPelosPrecos([null, null]), cadastro());
    expect(r.rascunho.informacoes.servicos.map(s => s.duracaoMin)).toEqual([null, null]);
  });

  it("o grupo de duas não valida propostas de durações diferentes", () => {
    const r = aplicar(`${precos} as duas leva 45 minutos`, propostaPelosPrecos([45, 60]), cadastro());
    expect(r.rascunho.informacoes.servicos.map(s => s.duracaoMin)).toEqual([null, null]);
  });

  it("valida durações individuais em orações separadas sem cruzar os serviços", () => {
    const texto = `${precos} manicure leva 30 minutos. pedicure leva 60 minutos`;
    const r = aplicar(texto, propostaPelosPrecos([30, 60]), cadastro());
    expect(r.rascunho.informacoes.servicos.map(s => s.duracaoMin)).toEqual([30, 60]);
    const cruzado = aplicar(texto, propostaPelosPrecos([60, 30]), cadastro());
    expect(cruzado.rascunho.informacoes.servicos.map(s => s.duracaoMin)).toEqual([null, null]);
  });

  it("não inclui um terceiro serviço proposto pela IA no grupo de duas", () => {
    const c = cadastro(); c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "extra", nome: "escova" });
    const original = propostaPelosPrecos();
    const proposta = { ...original, servicos: [...original.servicos, item("escova", "as duas leva 45 minutos", { duracaoMin: 45 })] };
    const r = aplicar(`${precos} as duas leva 45 minutos`, proposta, c);
    expect(r.rascunho.informacoes.servicos.map(s => s.duracaoMin)).toEqual([45, 45, null]);
  });

  it("não resolve duas a partir de três serviços citados na fala", () => {
    const c = cadastro(); c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "extra", nome: "escova" });
    const r = aplicar(`${precos} escova custa 50 reais. as duas leva 45 minutos`, propostaPelosPrecos(), c);
    expect(r.rascunho.informacoes.servicos.every(s => s.duracaoMin === null)).toBe(true);
  });

  it.each([
    "as duas não leva 45 minutos",
    "se for as duas leva 45 minutos",
    "as duas talvez leve 45 minutos",
    "a concorrente diz que as duas leva 45 minutos",
    "as duas leva 45 minutos?",
    "as duas leva 45 minutos. as duas leva 60 minutos",
    "manicure leva 30 minutos. as duas leva 45 minutos",
  ])("não complementa duração com prova inválida ou conflitante: %s", trecho => {
    const r = aplicar(`${precos} ${trecho}`, propostaPelosPrecos(), cadastro());
    expect(r.rascunho.informacoes.servicos.every(s => s.duracaoMin === null)).toBe(true);
  });

  it("não resolve duas usando nomes apenas do histórico nem citados depois do grupo", () => {
    const estado: EstadoConversaConfiguracao = { ignoradas: [], ultimaPergunta: null, mensagens: [{ id: "antiga", de: "dono", texto: precos, em: "2026-10-29T00:00:00Z" }] };
    expect(aplicar("as duas leva 45 minutos", propostaPelosPrecos(), cadastro(), estado).rascunho.informacoes.servicos.every(s => s.duracaoMin === null)).toBe(true);
    expect(aplicar(`as duas leva 45 minutos. ${precos}`, propostaPelosPrecos(), cadastro()).rascunho.informacoes.servicos.every(s => s.duracaoMin === null)).toBe(true);
  });
});

describe("interpretação válida não é substituída por preenchimento genérico", () => {
  it("não salva uma alteração ambígua de preço como resposta à pergunta de endereço", () => {
    const c = configuracaoExemplo();
    c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
    const estado: EstadoConversaConfiguracao = { mensagens: [], ignoradas: ["informacoes.servicos"], ultimaPergunta: "informacoes.endereco", topicoAtual: "FUNCIONAMENTO", perguntaPendente: { chave: "informacoes.endereco", texto: "Qual endereço devo informar aos clientes?", sugestoes: [] } };
    const texto = "muda o preço dele pra 90, mas não lembro qual dos dois eu falei";
    const r = aplicar(texto, extracao({ esclarecimento: { campo: "informacoes.servicos", evidencia: texto, pergunta: "Qual serviço você quer mudar o preço para R$90?", sugestoes: [] }, dialogo: { intencao: "CORRIGIR", resposta: null, fontesIds: [] } }), c, estado);
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    expect(r.esclarecimento?.texto).toBe("Qual serviço você quer mudar o preço para R$90?");
  });

  it.each(["negocio.descricao", "informacoes.endereco", "informacoes.pagamento", "negocio.regiao"])("não grava a fala crua no campo pendente %s se o contrato não o informou", chave => {
    const c = configuracaoExemplo();
    const texto = chave === "informacoes.pagamento" ? "Pix só se eu confirmar depois" : "Agora eu queria falar do preço dele";
    const estado: EstadoConversaConfiguracao = { mensagens: [], ignoradas: [], ultimaPergunta: chave, perguntaPendente: { chave, texto: "Qual é a informação?", sugestoes: [] } };
    const r = aplicar(texto, extracao({}), c, estado);
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
  });

  it("não aplica o parser de apresentação, endereço e pagamento quando a IA devolve esses campos vazios", () => {
    const c = base();
    const r = aplicar("Minha empresa trabalha com bolos. Meu endereço é Rua das Flores, 10. Aceitamos Pix.", extracao({}), c);
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
  });

  it.each([
    ["Atendo online", "ONLINE"],
    ["Em um endereço", "PRESENCIAL"],
    ["Vou até o cliente", "DOMICILIO"],
  ] as const)("preserva a escolha explícita sem IA: %s", (texto, modalidade) => {
    const c = base();
    const r = aplicar(texto, undefined, c);
    expect(r.rascunho.negocio.modalidade).toBe(modalidade);
  });
});
