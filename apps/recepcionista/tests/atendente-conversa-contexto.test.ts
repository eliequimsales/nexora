import { describe, expect, it } from "vitest";
import { contextoParaDialogoConfiguracao } from "@/lib/atendente/conversa-contexto";
import { fontesDoDialogoConfiguracao } from "@/lib/atendente/conversa-dialogo";
import type { EstadoConversaConfiguracao } from "@/lib/atendente/conversa-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

const conversaVazia = (): EstadoConversaConfiguracao => ({ mensagens: [], ignoradas: [], ultimaPergunta: null });
const fontesIds = (c: ReturnType<typeof contextoParaDialogoConfiguracao>) => c.FONTES_DIALOGO.map(f => f.id);

describe("contexto compacto e fundamentado da configuração", () => {
  it("prioriza a diferença entre pedidos e agenda em conta com 27 FAQs e três serviços", () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos = Array.from({ length: 3 }, (_, i) => ({ ...c.informacoes.servicos[0], id: `servico${i}`, nome: `Serviço fictício ${i}` }));
    c.conhecimento.itens = Array.from({ length: 27 }, (_, i) => ({ id: `regra${i}`, pergunta: `Orientação fictícia ${i}`, resposta: `CONTEUDO_EXTENSO_${i} `.repeat(100), situacao: "CONFIRMADO", origem: "MANUAL" }));
    const contexto = contextoParaDialogoConfiguracao(c, conversaVazia(), "Qual é a diferença entre receber pedidos e fazer agendamentos?", null, "ATENDIMENTO");
    expect(fontesIds(contexto)).toEqual(expect.arrayContaining(["produto:objetivo", "produto:agenda"]));
    expect(JSON.stringify(contexto).length).toBeLessThanOrEqual(8000);
    expect(contexto.CADASTRO.negocio.nome).toBe(c.negocio.nome);
    expect(contexto.CADASTRO.servicos).toHaveLength(3);
    expect(contexto.CADASTRO.regras.length).toBeLessThanOrEqual(8);
    expect(JSON.stringify(contexto.CADASTRO.regras)).not.toContain("CONTEUDO_EXTENSO");
    expect(contexto.FONTES_DIALOGO.some(f => f.id.startsWith("regra:"))).toBe(false);
  });

  it.each([
    ["O teste manda mensagens reais?", "produto:teste"],
    ["Como conecto meu WhatsApp pelo código?", "produto:conexao"],
    ["Não entendi, pode me ajudar a configurar?", "produto:topicos"],
  ])("seleciona ajuda do produto para a dúvida %s", (mensagem, fonte) => {
    const contexto = contextoParaDialogoConfiguracao(configuracaoExemplo(), conversaVazia(), mensagem, null);
    expect(fontesIds(contexto)).toContain(fonte);
  });

  it("não dá prioridade a fontes sem serviço quando também não existe serviço em foco", () => {
    const contexto = contextoParaDialogoConfiguracao(configuracaoExemplo(), conversaVazia(), "O teste manda mensagens reais?", null);
    expect(fontesIds(contexto)).toEqual(["produto:teste"]);
  });

  it("recupera FAQ relevante mesmo no fim da base, preservando a proibição inteira", () => {
    const c = configuracaoExemplo();
    c.conhecimento.itens = Array.from({ length: 149 }, (_, i) => ({ id: `outra${i}`, pergunta: `Orientação interna ${i}`, resposta: "Informação sem relação com a pergunta.", situacao: "CONFIRMADO", origem: "MANUAL" }));
    c.conhecimento.itens.push({ id: "reembolso", pergunta: "Como funciona o reembolso?", resposta: "O reembolso é analisado pela equipe. Não prometemos devolução automática, nem crédito sem análise.", situacao: "CONFIRMADO", origem: "MANUAL" });
    const contexto = contextoParaDialogoConfiguracao(c, conversaVazia(), "Como funciona o reembolso?", null, "REGRAS");
    const fonte = contexto.FONTES_DIALOGO.find(f => f.id === "regra:reembolso");
    expect(fonte).toEqual(fontesDoDialogoConfiguracao(c).find(f => f.id === "regra:reembolso"));
    expect(fonte?.texto.endsWith("nem crédito sem análise.")).toBe(true);
    expect(contexto.CADASTRO.regras[0].id).toBe("reembolso");
    expect(JSON.stringify(contexto).split("Não prometemos devolução automática")).toHaveLength(2);
  });

  it("prioriza o serviço alvo ou citado, mesmo depois dos primeiros 12 itens", () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos = Array.from({ length: 100 }, (_, i) => ({ ...c.informacoes.servicos[0], id: `id${i}`, nome: `Procedimento fictício ${i}`, precoCents: 1000 + i }));
    const pergunta = { chave: "esclarecimento:servico:id99:preco", texto: "Qual valor devo usar neste procedimento?", sugestoes: [] };
    const contexto = contextoParaDialogoConfiguracao(c, conversaVazia(), "O valor continua o mesmo.", pergunta, "SERVICOS");
    expect(contexto.CADASTRO.servicos[0]).toMatchObject({ id: "id99", nome: "Procedimento fictício 99", precoCents: 1099 });
    expect(fontesIds(contexto)).toContain("servico:id99");
    expect(contexto.CADASTRO.servicos.length).toBeLessThanOrEqual(12);
    const citado = contextoParaDialogoConfiguracao(c, conversaVazia(), "Quanto custa Procedimento fictício 99?", null);
    expect(citado.CADASTRO.servicos[0].id).toBe("id99");
  });

  it("não envia materiais brutos e mantém fontes confirmadas inteiras ou ausentes", () => {
    const c = configuracaoExemplo();
    c.materiais = [{ id: "material", nome: "Manual", tipo: "TEXTO", texto: "MATERIAL_NAO_DEVE_SER_ENVIADO", sha256: "0".repeat(64), importadoEm: "2026-10-28T00:00:00Z", validoAte: null }];
    c.informacoes.servicos[0].descricao = `${"Descrição extensa. ".repeat(70)}Não executar o serviço sem autorização do responsável.`;
    const contexto = contextoParaDialogoConfiguracao(c, conversaVazia(), "Como funciona Revisão?", null, "SERVICOS");
    const fontes = new Map(fontesDoDialogoConfiguracao(c).map(f => [f.id, f.texto]));
    for (const fonte of contexto.FONTES_DIALOGO) expect(fonte.texto).toBe(fontes.get(fonte.id));
    expect(contexto.CADASTRO.servicos[0].descricao).toBeUndefined();
    expect(JSON.stringify(contexto)).not.toContain("MATERIAL_NAO_DEVE_SER_ENVIADO");
  });

  it("respeita 10 mil caracteres com base máxima e preserva os 6 mil da mensagem", () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos = Array.from({ length: 100 }, (_, i) => ({ ...c.informacoes.servicos[0], id: `servico${i}`, nome: `Procedimento fictício ${i}`, descricao: "Descrição completa sem cortes. ".repeat(40) }));
    c.conhecimento.itens = Array.from({ length: 150 }, (_, i) => ({ id: `regra${i}`, pergunta: `Regra ${i} para procedimentos`, resposta: `${"Orientação completa. ".repeat(100)}Não executar sem autorização.`, situacao: "CONFIRMADO", origem: "MANUAL" }));
    const conversa: EstadoConversaConfiguracao = { ignoradas: [], ultimaPergunta: null, mensagens: Array.from({ length: 80 }, (_, i) => ({ id: `mensagem${i}`, de: i % 2 ? "atendente" : "dono", texto: `Mensagem anterior ${i}. ${"Contexto anterior. ".repeat(100)}`, em: "2026-10-28T00:00:00Z" })) };
    const pergunta = { chave: "servico:servico99:duracao", texto: "Quanto tempo dura esse procedimento?", sugestoes: [] };
    const prefixo = "Procedimento fictício 99. ";
    const mensagem = `${prefixo}${"x".repeat(6000 - prefixo.length)}`;
    expect(mensagem).toHaveLength(6000);
    const original = structuredClone({ c, conversa, pergunta });
    const contexto = contextoParaDialogoConfiguracao(c, conversa, mensagem, pergunta, "SERVICOS");
    expect(JSON.stringify(contexto).length).toBeLessThanOrEqual(10000);
    expect(contexto.MENSAGEM_ATUAL).toBe(mensagem);
    expect(contexto.PERGUNTA_ATUAL).toEqual(pergunta);
    expect(contexto.CADASTRO.negocio.nome).toBe(c.negocio.nome);
    expect(contexto.CADASTRO.negocio.segmento).toBe(c.negocio.segmento);
    expect(contexto.CADASTRO.servicos[0].id).toBe("servico99");
    expect(contexto.CADASTRO.servicos.length).toBeLessThanOrEqual(12);
    expect(contexto.CADASTRO.regras.length).toBeLessThanOrEqual(8);
    expect(contexto.HISTORICO_RECENTE.length).toBeLessThanOrEqual(10);
    expect(contexto.HISTORICO_RECENTE.every(m => conversa.mensagens.some(original => original.de === m.de && original.texto === m.texto))).toBe(true);
    expect({ c, conversa, pergunta }).toEqual(original);
    const fontes = new Map(fontesDoDialogoConfiguracao(c).map(f => [f.id, f.texto]));
    for (const fonte of contexto.FONTES_DIALOGO) expect(fonte.texto).toBe(fontes.get(fonte.id));
  });

  it("mantém o histórico curto em ordem e nunca inventa IDs de serviços ou regras", () => {
    const c = configuracaoExemplo();
    const conversa = conversaVazia();
    conversa.mensagens = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, de: i % 2 ? "atendente" : "dono", texto: `Mensagem ${i}: ${"horários ".repeat(80)}`, em: "2026-10-28T00:00:00Z" }));
    const contexto = contextoParaDialogoConfiguracao(c, conversa, "Quero ajustar os horários.", null, "FUNCIONAMENTO");
    expect(contexto.HISTORICO_RECENTE.length).toBeLessThanOrEqual(10);
    const indices = contexto.HISTORICO_RECENTE.map(m => Number(m.texto.match(/^Mensagem (\d+)/)?.[1]));
    expect(indices).toEqual(indices.slice().sort((a, b) => a - b));
    expect(contexto.CADASTRO.servicos.every(s => c.informacoes.servicos.some(original => original.id === s.id))).toBe(true);
    expect(contexto.CADASTRO.regras.every(s => c.conhecimento.itens.some(original => original.id === s.id))).toBe(true);
  });

  it("falha explicitamente quando escapes tornam só a mensagem maior que o orçamento", () => {
    expect(() => contextoParaDialogoConfiguracao(configuracaoExemplo(), conversaVazia(), "\n".repeat(6000), null)).toThrow(RangeError);
  });

  it("leva foco, categorias e lista concluída para uma resposta curta sem depender de palavras-chave", () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos = ["manicure", "prancha"].map((nome, i) => ({ ...c.informacoes.servicos[0], nome, id: `s${i}` }));
    const conversa = { ...conversaVazia(), memoriaSemantica: { servicoEmFocoId: "s1", categorias: ["cabelos", "unhas"], listaServicosConcluida: true } };
    const contexto = contextoParaDialogoConfiguracao(c, conversa, "depende do tamanho", null, "SERVICOS");
    expect(contexto.CADASTRO.servicos[0]).toMatchObject({ id: "s1", nome: "prancha" });
    expect(contexto.MEMORIA_CONVERSA).toMatchObject({ servicoEmFocoId: "s1", categorias: ["cabelos", "unhas"], listaServicosConcluida: true });
    expect(fontesIds(contexto)).toContain("servico:s1");
    expect(fontesIds(contexto).some(id => id.startsWith("produto:"))).toBe(false);
    expect(contexto.MENSAGEM_ATUAL).toBe("depende do tamanho");
  });

  it("usa a entidade da pergunta atual e descarta foco de memória que não pertence ao cadastro", () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "outro", nome: "Outro serviço" });
    const pergunta = { chave: "servico:servico1:preco", texto: "Como você calcula o valor?", sugestoes: [] };
    const conversa = { ...conversaVazia(), memoriaSemantica: { servicoEmFocoId: "outro", categorias: [], listaServicosConcluida: false } };
    expect(contextoParaDialogoConfiguracao(c, conversa, "depende", pergunta).MEMORIA_CONVERSA.servicoEmFocoId).toBe("servico1");
    conversa.memoriaSemantica.servicoEmFocoId = "id-de-outra-empresa";
    const semPergunta = contextoParaDialogoConfiguracao(c, conversa, "depende", null);
    expect(semPergunta.MEMORIA_CONVERSA.servicoEmFocoId).toBeNull();
    expect(JSON.stringify(semPergunta)).not.toContain("id-de-outra-empresa");
  });

  it("uma referência explícita atual prevalece sobre o foco de memória anterior", () => {
    const c = configuracaoExemplo();
    c.informacoes.servicos.push({ ...c.informacoes.servicos[0], id: "pedicure", nome: "Pedicure" });
    const conversa = { ...conversaVazia(), memoriaSemantica: { servicoEmFocoId: "servico1", categorias: [], listaServicosConcluida: false } };
    const contexto = contextoParaDialogoConfiguracao(c, conversa, "Agora a pedicure é diferente.", null, "SERVICOS");
    expect(contexto.CADASTRO.servicos[0].id).toBe("pedicure");
    expect(contexto.MEMORIA_CONVERSA.servicoEmFocoId).toBe("pedicure");
  });

  it("reserva os dez turnos curtos recentes antes de documentos extensos sem cortar suas ressalvas", () => {
    const c = configuracaoExemplo();
    c.conhecimento.itens = [{ id: "reembolso", pergunta: "Como funciona o reembolso?", resposta: `${"Reembolso depende de análise. ".repeat(150)}Não é automático.`, situacao: "CONFIRMADO", origem: "MANUAL" }];
    const conversa = conversaVazia();
    conversa.mensagens = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, de: i % 2 ? "atendente" : "dono", texto: `Mensagem ${i}. ${"Detalhe de contexto. ".repeat(27)} Não mudar o preço sem perguntar.`, em: "2026-10-29T00:00:00Z" }));
    const contexto = contextoParaDialogoConfiguracao(c, conversa, "Como funciona o reembolso?", null, "REGRAS");
    expect(contexto.HISTORICO_RECENTE).toEqual(conversa.mensagens.map(({ de, texto }) => ({ de, texto })));
    expect(contexto.HISTORICO_RECENTE.every(m => m.texto.endsWith("Não mudar o preço sem perguntar."))).toBe(true);
    expect(contexto.FONTES_DIALOGO).not.toContainEqual(expect.objectContaining({ id: "regra:reembolso" }));
    expect(JSON.stringify(contexto).length).toBeLessThanOrEqual(10000);
  });

  it("recupera um par antigo pertinente sem separar a resposta da declaração", () => {
    const conversa = conversaVazia();
    conversa.mensagens = Array.from({ length: 18 }, (_, i) => ({ id: `m${i}`, de: i % 2 ? "atendente" : "dono", texto: i === 2 ? "De cabelos, oferecemos prancha e escova." : i === 3 ? "Anotei esses dois serviços de cabelo." : `Outro assunto ${i}.`, em: "2026-10-29T00:00:00Z" }));
    const contexto = contextoParaDialogoConfiguracao(configuracaoExemplo(), conversa, "E o serviço de cabelo que eu falei?", null, "SERVICOS");
    expect(contexto.HISTORICO_RECENTE).toEqual(expect.arrayContaining([
      { de: "dono", texto: conversa.mensagens[2].texto }, { de: "atendente", texto: conversa.mensagens[3].texto },
    ]));
    expect(contexto.HISTORICO_RECENTE.slice(-4)).toEqual(conversa.mensagens.slice(-4).map(({ de, texto }) => ({ de, texto })));
    expect(contexto.HISTORICO_RECENTE.length).toBeLessThanOrEqual(10);
  });
});
