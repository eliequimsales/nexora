import { describe, expect, it, vi } from "vitest";
import { responder, type DependenciasDoMotor, type EntradaDoMotor } from "@/lib/atendente/motor";
import { identificarRamo, identificarRamoNoHistorico, montarPromptComercial } from "@/lib/atendente/comercial";
import { ID_CONTA_MESTRE_PADRAO, ehContaComercialNexora } from "@/lib/atendente/comercial-config";
import type { Fatos } from "@/lib/atendente/fatos";
import type { ReceptionistReply } from "@/lib/ai/provider";
import { aplicarConfiguracaoAosFatos } from "@/lib/atendente/configuracao-fatos";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";
import type { ServicoNexa } from "@/lib/atendente/configuracao-schema";

const FATOS: Fatos = {
  empresa: "Nexora", nome: "Sofia", jeito: "ACOLHEDOR", marcaDireto: false, expediente: true,
  servicos: [], profissionais: [], horarios: [], diasFechados: [], endereco: "", pagamento: "",
  descricao: "Plataforma de atendimento virtual para empresas.", perguntas: [], linkAgenda: null, comercial: true,
};
function entrada(texto: string, extras: Partial<EntradaDoMotor> = {}): EntradaDoMotor {
  return { texto, historico: [{ role: "CUSTOMER", content: texto }], estado: null, primeiraDoDia: false,
    clienteNome: "Visitante", telefone: "5511999999999", fatos: FATOS,
    agora: new Date("2026-10-10T23:00:00Z"), contexto: "EXPEDIENTE", palavrasDoDono: [], ...extras };
}
function dependencias(extra: Partial<ReceptionistReply> = {}) {
  return {
    livres: vi.fn<Parameters<DependenciasDoMotor["livres"]>, ReturnType<DependenciasDoMotor["livres"]>>(async () => []),
    marcar: vi.fn<Parameters<DependenciasDoMotor["marcar"]>, ReturnType<DependenciasDoMotor["marcar"]>>(async () => ({ ok: false, motivo: "OCUPADO" })),
    ia: vi.fn<Parameters<DependenciasDoMotor["ia"]>, ReturnType<DependenciasDoMotor["ia"]>>(async () => ({
      resposta: "Texto livre que não deve ser publicado", transferir_humano: false,
      motivo_transferencia: "", nome_cliente: "", interesse: "", fontes_ids: [], duvida_pendente: true, ...extra,
    })),
  };
}
const texto = (s: Awaited<ReturnType<typeof responder>>) => s.mensagens.join("\n");
const promessas = /40%|100%|perfeitamente|blindad[oa]|j[aá] notifiquei|j[aá] deixei|em instantes|compra confirmada|pagamento confirmado|conta ativada|sem risco/i;

describe("Atendimento comercial sustentado em fatos", () => {
  it("reconhece a conta comercial configurada", () => {
    expect(ehContaComercialNexora(ID_CONTA_MESTRE_PADRAO)).toBe(true);
    expect(ehContaComercialNexora("outra-empresa")).toBe(false);
  });
  it("apresenta identidade virtual sem alegação de velocidade ou resultados", async () => {
    const d = dependencias();
    const r = await responder(entrada("Olá", { primeiraDoDia: true }), d);
    expect(texto(r)).toContain("Sofia, atendente virtual da Nexora");
    expect(texto(r)).toContain("Como posso ajudar?");
    expect(texto(r)).not.toMatch(/velocidade|23h|concorrente|100%/);
    expect(d.ia).not.toHaveBeenCalled();
  });
  it("não repete apresentação na mesma conversa", async () => {
    const r = await responder(entrada("Oi", { historico: [
      { role: "AI", content: "Sou Sofia, atendente virtual da Nexora." }, { role: "CUSTOMER", content: "Oi" },
    ] }), dependencias());
    expect(texto(r)).not.toContain("atendente virtual");
  });
  it.each([
    ["Clínica médica", "clinica"], ["Consultório odontológico", "odonto"], ["Barbearia", "barbearia"],
    ["Salão de beleza e manicure", "salao"], ["Clínica de estética", "estetica"], ["Pet shop e banho e tosa", "pet"],
    ["Oficina mecânica", "automotivo"], ["Sou personal trainer", "fitness"], ["Escritório de advocacia", "advocacia"],
    ["Imobiliária", "imobiliaria"], ["Escritório de contabilidade", "contabilidade"], ["Estúdio de tattoo", "tattoo"],
    ["Estúdio de fotografia", "eventos"], ["Trabalho com ar condicionado", "manutencao"],
    ["Escola de idiomas", "educacao"], ["Restaurante e pizzaria", "gastronomia"], ["Agência de marketing", "consultoria"],
    ["Tenho uma floricultura", "floricultura"], ["Sou relojoeiro", "relojoeiro"],
  ])("mantém o ramo %s sem métricas ou configuração fictícia", async (mensagem, slug) => {
    const d = dependencias();
    const r = await responder(entrada(mensagem), d);
    expect(texto(r)).toContain("meunexora.com.br/ativar/" + slug);
    expect(texto(r)).toContain("demonstração");
    expect(texto(r)).toContain("antes de conectar");
    expect(texto(r)).toContain("Revise as informações");
    expect(texto(r)).not.toMatch(promessas);
    expect(d.ia).not.toHaveBeenCalled();
    expect(d.marcar).not.toHaveBeenCalled();
  });
  it("interpreta ramo curto somente após pergunta da equipe", () => {
    expect(identificarRamo("Ótica", [{ role: "AI", content: "Qual é o ramo do seu negócio?" }])?.slug).toBe("otica");
    expect(identificarRamo("Ótica", [{ role: "CUSTOMER", content: "Qual é o ramo do seu negócio?" }])).toBeNull();
  });
  it("não usa o ramo inventado pela IA como fala do cliente", async () => {
    const historico = [{ role: "AI" as const, content: "Você tem uma clínica." }, { role: "CUSTOMER" as const, content: "Quero testar" }];
    expect(identificarRamoNoHistorico(historico)).toBeNull();
    const r = await responder(entrada("Quero testar", { historico }), dependencias());
    expect(texto(r)).not.toContain("/clinica");
  });
  it("usa a correção mais recente do cliente", async () => {
    const historico = [{ role: "CUSTOMER" as const, content: "Tenho uma barbearia" }, { role: "CUSTOMER" as const, content: "Na verdade sou dentista" }];
    const r = await responder(entrada("Quero testar", { historico }), dependencias());
    expect(texto(r)).toContain("/odonto");
    expect(texto(r)).not.toContain("/barbearia");
  });
  it("declaração de compra não confirma pagamento ou ativação", async () => {
    const r = await responder(entrada("Acabei de comprar e quero ativar meu atendente para minha barbearia"), dependencias());
    expect(texto(r)).toContain("/barbearia");
    expect(texto(r)).not.toMatch(promessas);
    expect(r.marcou).toBeUndefined();
  });
  it.each(["Você é humano?", "Você é uma IA?", "Sou veterinária. Você é uma pessoa?"])("esclarece identidade: %s", async (m) => {
    const r = await responder(entrada(m), dependencias());
    expect(texto(r)).toContain("atendente virtual");
    expect(r.equipe).toBeUndefined();
    expect(texto(r)).not.toContain("/ativar");
  });
  it.each(["atendente?", "suporte", "humano"])("esclarece menção isolada %s sem transferência", async (m) => {
    const r = await responder(entrada(m), dependencias());
    expect(r.equipe).toBeUndefined();
    expect(texto(r)).toContain("Você quer falar");
  });
  it("prioriza pedido explícito de pessoa sem notificação fictícia", async () => {
    const r = await responder(entrada("Tenho uma clínica e quero falar com uma pessoa"), dependencias());
    expect(r.equipe).toBe(true);
    expect(r.anotar).toBeDefined();
    expect(texto(r)).not.toMatch(promessas);
    expect(texto(r)).not.toContain("/ativar");
  });
  it("não transfere pedido negado", async () => {
    const r = await responder(entrada("Não quero falar com atendente. Quanto custa?"), dependencias());
    expect(r.equipe).toBeUndefined();
  });
  it("prioriza emergência sobre oportunidade comercial", async () => {
    const r = await responder(entrada("Tenho uma clínica e estou com falta de ar"), dependencias());
    expect(r.urgente).toBe(true);
    expect(r.equipe).toBe(true);
    expect(texto(r)).not.toContain("/ativar");
  });
  it("encaminha suporte de conta sem alegar notificação", async () => {
    const r = await responder(entrada("Já sou cliente e tenho um problema no painel"), dependencias());
    expect(r.equipe).toBe(true);
    expect(texto(r)).toContain("meunexora.com.br/painel");
    expect(texto(r)).not.toMatch(promessas);
  });
  it.each([
    "Ele entende áudio?", "Vocês emitem nota fiscal para CNPJ?", "Tem integração com Google Agenda?",
    "É seguro e sem risco de banimento?", "Preciso de chip novo ou WhatsApp Business?",
    "Como funciona o teste grátis? Pede cartão?", "Como cancelo a assinatura?", "Precisa de computador ligado?",
    "E se a inteligência errar ou inventar resposta?",
  ])("não promete capacidade sem fonte: %s", async (m) => {
    const r = await responder(entrada(m), dependencias({ resposta: "Sim! Tudo garantido 100% e já notifiquei a equipe!" }));
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(texto(r)).not.toMatch(promessas);
    expect(r.anotar?.pergunta).toBe(m);
    expect(r.equipe).toBeUndefined();
  });
  it("usa preço cadastrado sem fixar oferta no código", async () => {
    const d = dependencias();
    const r = await responder(entrada("Quanto custa?", { fatos: { ...FATOS, pricingInfo: "Plano de teste interno: R$ 123 por mês." } }), d);
    expect(texto(r)).toBe("Plano de teste interno: R$ 123 por mês.");
    expect(d.ia).not.toHaveBeenCalled();
  });
  it("responde FAQ exata sem gerar complemento", async () => {
    const d = dependencias();
    const r = await responder(entrada("Vocês emitem nota fiscal?", { fatos: {
      ...FATOS, perguntas: [{ question: "Vocês emitem nota fiscal?", answer: "A equipe precisa confirmar as condições de emissão." }],
    } }), d);
    expect(texto(r)).toBe("A equipe precisa confirmar as condições de emissão.");
    expect(d.ia).not.toHaveBeenCalled();
  });
  it("publica fontes aprovadas e ignora texto livre e transferência sugeridos pela IA", async () => {
    const d = dependencias({ fontes_ids: ["faq:0"], duvida_pendente: false,
      resposta: "Integração completa e 100% segura.", transferir_humano: true });
    const r = await responder(entrada("Conecta com outras agendas?", { fatos: {
      ...FATOS, perguntas: [{ question: "Integrações", answer: "Integrações externas precisam de avaliação da equipe." }],
    } }), d);
    expect(texto(r)).toBe("Integrações externas precisam de avaliação da equipe.");
    expect(r.equipe).toBeUndefined();
    expect(r.usouIa).toBe(true);
  });
  it("responde parte conhecida e sinaliza pendência em pergunta composta com ramo", async () => {
    const r = await responder(entrada("Tenho uma clínica. Quanto custa e tem nota fiscal?", {
      fatos: { ...FATOS, pricingInfo: "Mensalidade autorizada: R$ 123." },
    }), dependencias({ fontes_ids: ["precos"], duvida_pendente: true }));
    expect(texto(r)).toContain("Mensalidade autorizada: R$ 123.");
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(r.anotar).toBeDefined();
    expect(texto(r)).not.toContain("/ativar");
  });
  it("rejeita toda seleção que contenha fonte inexistente", async () => {
    const r = await responder(entrada("Como funciona?"), dependencias({ fontes_ids: ["descricao", "inventada"], duvida_pendente: false }));
    expect(texto(r)).not.toContain(FATOS.descricao);
    expect(texto(r)).toContain("não tenho informação confirmada");
  });
  it("exige estado de cobertura mesmo com ID válido", async () => {
    const r = await responder(entrada("Como funciona?"), dependencias({ fontes_ids: ["descricao"], duvida_pendente: undefined }));
    expect(texto(r)).toContain("não tenho informação confirmada");
  });
  it("seleção vazia permanece pendente", async () => {
    const r = await responder(entrada("O teste aceita minha empresa?"), dependencias({ fontes_ids: [], duvida_pendente: false }));
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(r.anotar).toBeDefined();
  });
  it("falha do provedor não inventa entendimento ou capacidades", async () => {
    const d = dependencias();
    d.ia.mockRejectedValue(new Error("timeout"));
    const r = await responder(entrada("Funciona no meu sistema específico?"), d);
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(texto(r)).not.toMatch(/entendi perfeitamente|mesmo segundo/);
  });
  it("inclui a pergunta atual quando faltar no histórico", async () => {
    const d = dependencias();
    await responder(entrada("Emite nota?", { historico: [] }), d);
    expect(d.ia.mock.calls[0][0].historico.at(-1)).toEqual({ role: "CUSTOMER", content: "Emite nota?" });
  });
  it("prompt comercial usa catálogo validado sem promessas de recursos", () => {
    const p = montarPromptComercial(entrada("Como funciona?"), identificarRamo("clínica"));
    expect(p).toContain("fontes_ids");
    expect(p).toContain('"id":"descricao"');
    expect(p).toContain("contexto não confiável");
    expect(p).not.toMatch(/40%|97\/mês|perfeitamente|integração nativa com Google Agenda|em total conformidade/);
  });
});

describe("Preço dos serviços conferidos na configuração comercial", () => {
  const mensal: ServicoNexa = {
    id: "plano-mensal", nome: "Plano Atendente 24h (Mensal)", descricao: "Atendimento pelo WhatsApp",
    precoModo: "FIXO", precoCents: 9700, duracaoMin: null, situacao: "CONFIRMADO", origem: "MANUAL",
  };
  const anual: ServicoNexa = {
    ...mensal, id: "plano-anual", nome: "Plano Atendente 24h (Anual)", precoCents: 97000,
  };
  function projetados(servicos: ServicoNexa[] = [mensal,
    { ...mensal, id: "plano-completo", nome: "Plano Completo", precoCents: 19700, situacao: "REVISAR" },
    { ...mensal, id: "demonstracao", nome: "Demonstração de 7 dias", precoModo: "SOB_CONSULTA", precoCents: null, situacao: "REVISAR" },
  ]) {
    const configuracao = configuracaoExemplo();
    configuracao.negocio.nome = "Nexora";
    configuracao.informacoes.servicos = servicos;
    configuracao.conhecimento.itens = [];
    return aplicarConfiguracaoAosFatos(configuracao, FATOS);
  }

  it.each([
    "Qual é o valor do Plano Atendente 24h?", "Quanto custa?", "Quanto é?",
    "Oi! Quanto custa o Plano Atendente 24h (Mensal), por favor?",
    "Preço do Plano Atendente 24h", "Quanto sai o Plano Atendente 24h?",
  ])("responde com a fonte do único serviço conferido, sem IA: %s", async (pergunta) => {
    const fatos = projetados();
    expect(fatos.pricingInfo).toBe("");
    const d = dependencias();
    const r = await responder(entrada(pergunta, { fatos }), d);
    expect(texto(r)).toBe("Plano Atendente 24h (Mensal) custa R$ 97,00.");
    expect(r.fontes).toEqual(["Preço de Plano Atendente 24h (Mensal)"]);
    expect(r.anotar).toBeUndefined();
    expect(d.ia).not.toHaveBeenCalled();
    expect(texto(r)).not.toMatch(/197|7 dias|ilimitad|grátis|teste grátis/i);
  });

  it("conserva a prioridade das condições comerciais cadastradas", async () => {
    const d = dependencias();
    const r = await responder(entrada("Quanto custa?", { fatos: { ...projetados(), pricingInfo: "A equipe confirma condições para contratos anuais." } }), d);
    expect(texto(r)).toBe("A equipe confirma condições para contratos anuais.");
    expect(d.ia).not.toHaveBeenCalled();
  });

  it.each(["Quanto custa?", "Qual é o valor do Plano Atendente 24h?"])("esclarece mensal ou anual sem escolher o primeiro: %s", async (pergunta) => {
    const d = dependencias();
    const r = await responder(entrada(pergunta, { fatos: projetados([mensal, anual]) }), d);
    expect(texto(r)).toContain(mensal.nome);
    expect(texto(r)).toContain(anual.nome);
    expect(texto(r)).toMatch(/De qual opção.*\?$/);
    expect(texto(r)).not.toContain("R$");
    expect(d.ia).not.toHaveBeenCalled();
  });

  it.each([[mensal, "R$ 97,00"], [anual, "R$ 970,00"]] as const)("usa o qualificador explícito de %j", async (servico, preco) => {
    const d = dependencias();
    const r = await responder(entrada(`Qual é o valor do ${servico.nome}?`, { fatos: projetados([mensal, anual]) }), d);
    expect(texto(r)).toBe(`${servico.nome} custa ${preco}.`);
    expect(d.ia).not.toHaveBeenCalled();
  });

  it("mantém o valor sob consulta sem converter a falta de valor em zero", async () => {
    const d = dependencias();
    const r = await responder(entrada("Quanto custa?", { fatos: projetados([{ ...mensal, precoModo: "SOB_CONSULTA", precoCents: null }]) }), d);
    expect(texto(r)).toBe("O valor de Plano Atendente 24h (Mensal) é sob consulta com a equipe.");
    expect(texto(r)).not.toContain("R$");
    expect(d.ia).not.toHaveBeenCalled();
  });

  it("não usa zero legado sem preço fixo explicitamente cadastrado", async () => {
    const d = dependencias();
    const fatos = { ...FATOS, servicos: [{ id: "legado", nome: "Plano", precoCents: 0, duracaoMin: 0 }] };
    const r = await responder(entrada("Quanto custa?", { fatos }), d);
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(texto(r)).not.toMatch(/R\$|grátis|gratuito/);
  });

  it("não substitui um serviço desconhecido pelo único preço conhecido", async () => {
    const r = await responder(entrada("Qual é o valor do Plano Empresarial?", { fatos: projetados() }), dependencias());
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(texto(r)).not.toContain("R$");
  });

  it.each([
    "Qual é o valor do Plano Atendente 24h e tem garantia?",
    "Qual é o valor do Plano Atendente 24h com desconto?",
    "Qual é o valor do Plano Atendente 24h por mês?",
    "Quanto custa depois?", "Qual é a mensalidade?",
  ])("não cobre outra condição só com o preço: %s", async (pergunta) => {
    const d = dependencias();
    const r = await responder(entrada(pergunta, { fatos: projetados() }), d);
    expect(texto(r)).toContain("não tenho informação confirmada");
    expect(d.ia).toHaveBeenCalledTimes(1);
    expect(r.anotar).toBeDefined();
  });

  it("preserva o encaminhamento de reembolso antes de consultar um preço", async () => {
    const d = dependencias();
    const r = await responder(entrada("Quanto custa o Plano Atendente 24h e como funciona o reembolso?", { fatos: projetados() }), d);
    expect(r.equipe).toBe(true);
    expect(r.anotar).toBeDefined();
    expect(texto(r)).not.toContain("R$");
    expect(d.ia).not.toHaveBeenCalled();
  });

  it("considera também o serviço sem preço ao esclarecer uma pergunta genérica", async () => {
    const fatos = projetados([mensal]);
    fatos.servicos.push({ id: "consultoria", nome: "Consultoria", precoCents: 0, duracaoMin: 0 });
    const d = dependencias();
    const r = await responder(entrada("Quanto custa?", { fatos }), d);
    expect(texto(r)).toContain("Consultoria");
    expect(texto(r)).toContain(mensal.nome);
    expect(texto(r)).not.toContain("R$");
    expect(d.ia).not.toHaveBeenCalled();
  });

  it("nomes duplicados não selecionam um dos valores por ordem de cadastro", async () => {
    const fatos = projetados([mensal, { ...mensal, id: "outro-mensal", precoCents: 19700 }]);
    const d = dependencias();
    const r = await responder(entrada("Qual é o valor do Plano Atendente 24h?", { fatos }), d);
    expect(texto(r)).toBe("De qual serviço você quer saber o valor?");
    expect(texto(r)).not.toContain("R$");
    expect(d.ia).not.toHaveBeenCalled();
  });
});

