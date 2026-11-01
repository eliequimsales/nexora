import { describe, expect, it } from "vitest";
import { extrairTextoDeArquivo, lerTabelaCsv, prepararMaterialNoRascunho, materialEntradaSchema } from "@/lib/atendente/materiais";
import { configuracaoExemplo, fatosExemplo } from "./fixtures/configuracao-nexa";
import { aplicarConfiguracaoAosFatos } from "@/lib/atendente/configuracao-fatos";
const bytes = (s: string) => new TextEncoder().encode(s);
const entrada = { revisao: 1, nome: "Serviços", tipo: "ARQUIVO" as const, texto: "Revisão R$ 120,00, 60 minutos" };
const agora = new Date("2026-10-26T12:00:00Z");
describe("captação de materiais do responsável", () => {
  it("uma tabela de respostas exige uma única revisão por resposta e mantém a origem", () => {
    const atual = configuracaoExemplo(); atual.conhecimento.itens = [];
    const r = prepararMaterialNoRascunho(atual, { ...entrada, texto: "Quando perguntarem sobre estacionamento, responda Não temos estacionamento próprio." }, agora);
    expect(r.rascunho.conhecimento.itens).toHaveLength(1);
    expect(r.rascunho.conhecimento.itens[0]).toMatchObject({ pergunta: "estacionamento", resposta: "Não temos estacionamento próprio.", situacao: "REVISAR" });
    expect(r.rascunho.conhecimento.itens[0].id.startsWith(`${r.materialId}:`)).toBe(true);
    expect(r.rascunho.materiais?.[0].texto).toContain("Quando perguntarem");
  });
  it("extrai tabela brasileira com preço decimal e duração explícita", () => {
    const texto = extrairTextoDeArquivo("servicos.csv", bytes('nome;preco;duracao_minutos\nMassagem relaxante;150,50;60\nEsportiva;180;45'));
    expect(texto).toBe("Massagem relaxante R$ 150,50, 60 minutos\nEsportiva R$ 180, 45 minutos");
    const r = prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, texto }, agora);
    expect(r.rascunho.informacoes.servicos.find(s => s.nome === "Massagem relaxante")).toMatchObject({ precoCents: 15050, duracaoMin: 60, situacao: "REVISAR" });
  });
  it("preserva campos CSV com separador, aspas e quebra de linha", () => {
    expect(lerTabelaCsv('pergunta;resposta\n"Onde?";"Rua A; sala \"\"2\"\"\nCentro"')).toEqual([["pergunta", "resposta"], ["Onde?", 'Rua A; sala "2"\nCentro']]);
  });
  it("recusa CSV com aspas abertas", () => expect(() => lerTabelaCsv('nome;preco\n"A;100')).toThrow("aspas"));
  it("aceita JSON explícito de serviços e preços em reais", () => {
    expect(extrairTextoDeArquivo("lista.json", bytes('[{"nome":"Corte","preco":49.5,"duracao_minutos":30}]'))).toBe("Corte R$ 49,5, 30 minutos");
  });
  it("aceita JSON de perguntas sem remover negação", () => {
    expect(extrairTextoDeArquivo("duvidas.json", bytes('[{"pergunta":"Aceitam Pix?","resposta":"Não aceitamos Pix."}]'))).toContain("Não aceitamos Pix.");
  });
  it.each(["arquivo.pdf", "arquivo.xlsx", "arquivo.png"])("informa formato ainda não suportado: %s", nome => expect(() => extrairTextoDeArquivo(nome, bytes("texto"))).toThrow("TXT"));
  it("recusa arquivo maior que o limite antes de analisar", () => expect(() => extrairTextoDeArquivo("texto.txt", new Uint8Array(65537))).toThrow("64 KB"));
  it("recusa UTF-8 inválido e conteúdo binário", () => {
    expect(() => extrairTextoDeArquivo("texto.txt", new Uint8Array([0xff]))).toThrow("UTF-8");
    expect(() => extrairTextoDeArquivo("texto.txt", bytes("nome\0valor"))).toThrow("legível");
  });
  it("não trunca silenciosamente um material longo", () => expect(() => extrairTextoDeArquivo("texto.md", bytes("a".repeat(6001)))).toThrow("6.000"));
  it("não trata chaves JSON desconhecidas como fatos", () => expect(() => extrairTextoDeArquivo("a.json", bytes('[{"nome":"A","preco":10,"confirmar_agendamento":true}]'))).toThrow("lista JSON"));
  it("não adivinha colunas da tabela", () => expect(() => extrairTextoDeArquivo("a.csv", bytes("produto;dinheiro\nCorte;10"))).toThrow("colunas"));
  it("guarda evidência integral, origem, hash, data e revisão das fontes", () => {
    const atual = configuracaoExemplo(); const antes = structuredClone(atual);
    const r = prepararMaterialNoRascunho(atual, entrada, agora);
    expect(atual).toEqual(antes);
    expect(r.rascunho.materiais?.[0]).toMatchObject({ nome: "Serviços", tipo: "ARQUIVO", texto: entrada.texto, importadoEm: agora.toISOString(), validoAte: null });
    expect(r.rascunho.materiais?.[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(r.rascunho.informacoes.servicos[0]).toMatchObject({ id: "servico1", precoCents: 12000, duracaoMin: 60, situacao: "REVISAR" });
    expect(r.rascunho.conhecimento.itens.at(-1)).toMatchObject({ situacao: "REVISAR", resposta: entrada.texto });
    expect(r.rascunho.conhecimento.itens.at(-1)?.id).toMatch(/^novo:material:/);
  });
  it("importar o mesmo conteúdo novamente é idempotente", () => {
    const primeiro = prepararMaterialNoRascunho(configuracaoExemplo(), entrada, agora);
    const repetido = prepararMaterialNoRascunho(primeiro.rascunho, entrada, agora);
    expect(repetido.rascunho).toBe(primeiro.rascunho); expect(repetido.materialId).toBe(primeiro.materialId);
  });
  it("não mistura duas versões de mesmo nome silenciosamente", () => {
    const primeiro = prepararMaterialNoRascunho(configuracaoExemplo(), entrada, agora);
    expect(() => prepararMaterialNoRascunho(primeiro.rascunho, { ...entrada, texto: "Revisão R$ 180,00, 60 minutos" }, agora)).toThrow("versão anterior");
  });
  it("texto livre sem extração permanece como fonte para conferência", () => {
    const r = prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, texto: "Não temos estacionamento próprio. Há uma vaga pública na rua." }, agora);
    expect(r.rascunho.conhecimento.itens.at(-1)?.resposta).toContain("Não temos estacionamento próprio");
    expect(r.rascunho.conhecimento.itens.at(-1)?.situacao).toBe("REVISAR");
  });
  it("não transforma promoção com validade em preço permanente", () => {
    const atual = configuracaoExemplo(); const r = prepararMaterialNoRascunho(atual, { ...entrada, validoAte: "2026-11-01T00:00:00Z" }, agora);
    expect(r.rascunho.informacoes.servicos).toEqual(atual.informacoes.servicos);
    expect(r.rascunho.materiais?.[0].validoAte).toBe("2026-11-01T00:00:00Z");
  });
  it("rejeita informação já vencida", () => expect(() => prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, validoAte: "2026-10-25T12:00:00Z" }, agora)).toThrow("terminou"));
  it("mantém todas as partes dentro do tamanho aceito e sem perder texto", () => {
    const texto = "Regras do atendimento. ".repeat(260).trim();
    const r = prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, texto }, agora);
    const fontes = r.rascunho.conhecimento.itens.filter(i => i.id.startsWith(r.materialId));
    expect(fontes).toHaveLength(2); expect(fontes.every(i => i.resposta.length <= 3000)).toBe(true);
    expect(fontes.map(i => i.resposta).join(" ")).toBe(texto);
  });
  it("entrada não aceita companyId e nunca autoriza publicar", () => {
    expect(materialEntradaSchema.safeParse({ ...entrada, companyId: "outra" }).success).toBe(false);
    expect(materialEntradaSchema.safeParse({ ...entrada, publicar: true }).success).toBe(false);
  });
  it("texto importado não é fonte de resposta enquanto aguarda revisão", () => {
    const r = prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, texto:"O estacionamento conveniado custa R$ 20." }, agora);
    expect(aplicarConfiguracaoAosFatos(r.rascunho, fatosExemplo).perguntas.some(p => p.answer.includes("conveniado custa"))).toBe(false);
  });
  it("fonte conferida aparece sem ser reescrita", () => {
    const r = prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, texto:"Não temos estacionamento próprio." }, agora);
    r.rascunho.conhecimento.itens.forEach(i => { if(i.id.startsWith(r.materialId)) i.situacao="CONFIRMADO"; });
    expect(aplicarConfiguracaoAosFatos(r.rascunho, fatosExemplo).perguntas).toContainEqual(expect.objectContaining({answer:"Não temos estacionamento próprio."}));
  });
  it("fonte vencida sai do contexto mesmo se tinha sido conferida", () => {
    const atual = new Date(); const importacao = new Date(atual.getTime()-3*86400000); const validade = new Date(atual.getTime()-86400000).toISOString();
    const r = prepararMaterialNoRascunho(configuracaoExemplo(), { ...entrada, texto:"Promoção vigente de estacionamento: R$ 10.", validoAte:validade }, importacao);
    r.rascunho.conhecimento.itens.forEach(i => { if(i.id.startsWith(r.materialId)) i.situacao="CONFIRMADO"; });
    const fatos = aplicarConfiguracaoAosFatos(r.rascunho, fatosExemplo);
    expect(fatos.perguntas.some(p => p.answer.includes("Promoção vigente"))).toBe(false);
    expect(fatos.perguntas.some(p => p.answer.includes("Não há estacionamento próprio"))).toBe(true);
  });
});
