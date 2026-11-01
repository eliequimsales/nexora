import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { prepararTurnoDeConfiguracao, perguntaAtual } from "@/lib/atendente/conversa";
import type { EstadoConversaConfiguracao } from "@/lib/atendente/conversa-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

const extracaoVazia = {
  nome: null, segmento: null, descricao: null, endereco: null, regiao: null,
  pagamento: null, nomeAtendente: null, modalidade: null, objetivo: null,
  jeito: null, quando: null, agendamento: null, horarios: [], servicos: [],
  perguntas: [], esclarecimento: null, continuacao: null,
  dialogo: { intencao: "PERGUNTAR", resposta: null, fontesIds: [] },
};
const conversa = () => ({ mensagens: [], ignoradas: [], ultimaPergunta: null, topicoAtual: "EMPRESA" as const });
const pedido = (texto: string) => ({ revisao: 0, mensagemId: "25110d83-33c2-4573-84e9-27bfbc9b6d9d", texto, perguntaChave: null, topico: "EMPRESA" as const });

describe("conferência simples no cadastro atual", () => {
  it("explica as duas condições de atualização sem depender de uma nova chamada de IA", async () => {
    const c = configuracaoExemplo();
    const interpretar = vi.fn().mockRejectedValue(new Error("não deve chamar"));
    const r = await prepararTurnoDeConfiguracao(c, conversa(), pedido("se eu trocar um preço aqui, quando meu atendente passa a usar? nn quero alterar nada agora"), {
      interpretar, iaDisponivel: () => true, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(interpretar).not.toHaveBeenCalled();
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    const resposta = r.conversa.mensagens.at(-1)?.texto;
    expect(resposta).toContain("já tem uma configuração em uso");
    expect(resposta).toContain("assim que são salvas");
    expect(resposta).toContain("Na primeira configuração, revise e teste antes de ativar");
    expect(resposta).not.toContain("novamente");
  });
  it.each([true, false])("confere somente o nome sem chamada externa (IA disponível: %s)", async disponivel => {
    const c = configuracaoExemplo();
    const interpretar = vi.fn().mockRejectedValue(new Error("não deve chamar"));
    const r = await prepararTurnoDeConfiguracao(c, conversa(), pedido("Qual é o nome da minha empresa?"), {
      interpretar, iaDisponivel: () => disponivel, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(interpretar).not.toHaveBeenCalled();
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    expect(r.conversa.mensagens.at(-1)?.texto).toBe("O nome informado para a empresa é Oficina Exemplo.");
    expect(r.conversa.perguntaSuspensa).toBe(true);
  });

  it.each([
    "Qual é o nome da empresa? Agora vendemos bolos.",
    "Qual é o nome da empresa, vendemos bolos também?",
    "Qual é o nome da empresa e esse teste manda mensagem?",
  ])("mantém a interpretação completa para uma mensagem combinada: %s", async texto => {
    const interpretar = vi.fn().mockResolvedValue(JSON.stringify(extracaoVazia));
    await prepararTurnoDeConfiguracao(configuracaoExemplo(), conversa(), pedido(texto), {
      interpretar, iaDisponivel: () => true, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(interpretar).toHaveBeenCalledTimes(1);
  });

  it("preserva a dúvida sobre alterar um serviço mesmo depois de encerrar a lista", async () => {
    const c = configuracaoExemplo();
    c.informacoes.endereco = { valor: "", situacao: "NAO_INFORMADO", origem: "MANUAL" };
    const estado: EstadoConversaConfiguracao = { ...conversa(), topicoAtual: "FUNCIONAMENTO", ignoradas: ["informacoes.servicos"] };
    const texto = "muda o preço dele pra 90, mas não lembro qual dos dois eu falei";
    const interpretar = vi.fn().mockResolvedValue(JSON.stringify({ ...extracaoVazia,
      esclarecimento: { campo: "informacoes.servicos", evidencia: texto, pergunta: "Qual serviço você quer mudar o preço para R$90?", sugestoes: [] },
    }));
    const q = perguntaAtual(c, estado, "FUNCIONAMENTO")!;
    const r = await prepararTurnoDeConfiguracao(c, estado, { ...pedido(texto), topico: "FUNCIONAMENTO", perguntaChave: q.chave }, {
      interpretar, iaDisponivel: () => true, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(r.rascunho).toEqual(c);
    expect(r.alteracoes).toEqual([]);
    expect(r.conversa.mensagens.at(-1)?.texto).not.toContain("Atualizei");
    expect(perguntaAtual(r.rascunho, r.conversa, r.conversa.topicoAtual)?.chave).toBe("esclarecimento:informacoes.servicos");
  });

  it("permite deixar uma dúvida visível para depois sem prendê-la na conversa", async () => {
    const c = configuracaoExemplo();
    const q = { chave: "esclarecimento:informacoes.servicos", texto: "Qual serviço você quer alterar?", sugestoes: [] };
    const estado: EstadoConversaConfiguracao = { ...conversa(), topicoAtual: "SERVICOS", ignoradas: ["informacoes.servicos"], perguntaPendente: q };
    const interpretar = vi.fn().mockRejectedValue(new Error("não deve chamar"));
    const r = await prepararTurnoDeConfiguracao(c, estado, { ...pedido("Pular"), topico: "SERVICOS", perguntaChave: q.chave }, {
      interpretar, iaDisponivel: () => true, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(interpretar).not.toHaveBeenCalled();
    expect(r.rascunho).toEqual(c);
    expect(r.conversa.perguntaPendente).toBeNull();
  });

  it.each([
    ["PERGUNTAR", "Qual serviço você quer atualizar, manicure ou pedicure?"],
    ["PERGUNTAR", "Qual deles você quer mudar para R$90?"],
    ["INFORMAR", "Você está falando da manicure ou da pedicure?"],
    ["MISTO", "Qual dos dois deve ter o preço alterado?"],
  ])("mantém a escolha de serviço quando a IA formulou a dúvida no diálogo (%s): %s", async (intencao, perguntaDaIa) => {
    const c = configuracaoExemplo();
    c.informacoes.servicos = ["manicure", "pedicure"].map((nome, i) => ({ ...c.informacoes.servicos[0], id: `s${i}`, nome }));
    const estado: EstadoConversaConfiguracao = { ...conversa(), topicoAtual: "SERVICOS", ignoradas: ["informacoes.servicos"] };
    const interpretar = vi.fn().mockResolvedValue(JSON.stringify({ ...extracaoVazia,
      dialogo: { intencao, resposta: perguntaDaIa, fontesIds: ["produto:servicos"] },
    }));
    const r = await prepararTurnoDeConfiguracao(c, estado, { ...pedido("muda o preço dele pra 90, mas não lembro qual dos dois eu falei"), topico: "SERVICOS" }, {
      interpretar, iaDisponivel: () => true, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(r.rascunho).toEqual(c);
    expect(r.conversa.perguntaPendente).toEqual({ chave: "esclarecimento:informacoes.servicos", texto: "Qual serviço você quer alterar?", sugestoes: ["manicure", "pedicure"] });
    expect(r.conversa.mensagens.at(-1)?.texto).not.toMatch(/Informe os serviços|Atualizei/);
    expect(perguntaAtual(c, r.conversa, "SERVICOS")?.chave).toBe("esclarecimento:informacoes.servicos");
  });

  it("não confunde uma dúvida sobre configurar com uma ordem para alterar serviço", async () => {
    const interpretar = vi.fn().mockResolvedValue(JSON.stringify({ ...extracaoVazia,
      dialogo: { intencao: "PERGUNTAR", resposta: "Qual serviço você quer atualizar?", fontesIds: ["produto:servicos"] },
    }));
    const c = configuracaoExemplo();
    const r = await prepararTurnoDeConfiguracao(c, conversa(), pedido("Como configuro serviços?"), {
      interpretar, iaDisponivel: () => true, agora: () => new Date("2026-10-29T12:00:00Z"),
    });
    expect(r.rascunho).toEqual(c);
    expect(r.conversa.perguntaPendente?.chave).not.toBe("esclarecimento:informacoes.servicos");
  });
});
