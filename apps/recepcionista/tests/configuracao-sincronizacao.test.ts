import { describe, expect, it } from "vitest";
import { projetarAlteracoesDaConfiguracao } from "@/lib/atendente/configuracao-sincronizacao";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

describe("sincronização das alterações da configuração já publicada", () => {
  it("não cria serviços falsamente confirmados enquanto o nome está vazio ou incompleto", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada); const atual = structuredClone(anterior);
    atual.informacoes.servicos.push({ ...atual.informacoes.servicos[0], id: "novo:vazio", nome: " " });
    atual.informacoes.servicos.push({ ...atual.informacoes.servicos[0], id: "novo:parcial", nome: "R" });
    atual.informacoes.servicos.push({ ...atual.informacoes.servicos[0], id: "novo:sem-preco", nome: "Corte", precoCents: null });
    atual.informacoes.servicos[0].nome = "";
    expect(projetarAlteracoesDaConfiguracao(anterior, atual, publicada).informacoes.servicos).toEqual(publicada.informacoes.servicos);
  });

  it("preserva nome da empresa, segmento e nome do atendente durante digitação incompleta", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada); const atual = structuredClone(anterior);
    atual.negocio.nome = " "; atual.negocio.segmento = "E"; atual.atendimento.nome = "";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.negocio.nome).toBe(publicada.negocio.nome);
    expect(resultado.negocio.segmento).toBe(publicada.negocio.segmento);
    expect(resultado.atendimento.nome).toBe(publicada.atendimento.nome);
  });

  it("não confirma expediente com horário parcial nem com dias incompletos", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada); const atual = structuredClone(anterior);
    atual.informacoes.horarios[1].open = "09:";
    expect(projetarAlteracoesDaConfiguracao(anterior, atual, publicada).informacoes).toMatchObject({ horarios: publicada.informacoes.horarios, horariosSituacao: "CONFIRMADO" });
    atual.informacoes.horarios = [];
    expect(projetarAlteracoesDaConfiguracao(anterior, atual, publicada).informacoes.horarios).toEqual(publicada.informacoes.horarios);
    atual.informacoes.horariosSituacao = "NAO_INFORMADO";
    expect(projetarAlteracoesDaConfiguracao(anterior, atual, publicada).informacoes.horariosSituacao).toBe("NAO_INFORMADO");
  });

  it("não publica pergunta, resposta ou informação confirmada vazia no meio da edição", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada); const atual = structuredClone(anterior);
    atual.conhecimento.itens[0].resposta = " ";
    atual.conhecimento.itens.push({ ...anterior.conhecimento.itens[0], id: "vazia", pergunta: "" });
    atual.informacoes.endereco.valor = " ";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.conhecimento.itens).toEqual(publicada.conhecimento.itens);
    expect(resultado.informacoes.endereco).toEqual(publicada.informacoes.endereco);
  });

  it("atualiza o preço e a modalidade sem publicar outras diferenças anteriores do serviço", () => {
    const publicada = configuracaoExemplo();
    publicada.informacoes.servicos[0].precoModo = "SOB_CONSULTA";
    publicada.informacoes.servicos[0].precoCents = null;
    const anterior = structuredClone(publicada);
    Object.assign(anterior.informacoes.servicos[0], { nome: "Nome ainda no rascunho", descricao: "Descrição ainda no rascunho", precoCents: 8000, precoModo: "FIXO", duracaoMin: 90 });
    const atual = structuredClone(anterior); atual.informacoes.servicos[0].precoCents = 9500;
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.informacoes.servicos[0]).toEqual({ ...publicada.informacoes.servicos[0], precoModo: "FIXO", precoCents: 9500 });
  });

  it("não publica endereço e regra divergentes que já estavam no rascunho", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.informacoes.endereco = { valor: "Endereço ainda em revisão", situacao: "REVISAR", origem: "ASSISTENTE" };
    anterior.conhecimento.itens[0].resposta = "Resposta antiga do rascunho";
    const atual = structuredClone(anterior); atual.atendimento.nome = "Marina";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.atendimento.nome).toBe("Marina");
    expect(resultado.informacoes.endereco).toEqual(publicada.informacoes.endereco);
    expect(resultado.conhecimento).toEqual(publicada.conhecimento);
  });

  it("acrescenta somente itens confirmados e remove somente IDs explicitamente retirados", () => {
    const publicada = configuracaoExemplo();
    publicada.informacoes.servicos.push({ ...publicada.informacoes.servicos[0], id: "apenas-publicado", nome: "Pintura" });
    const anterior = configuracaoExemplo(); const atual = structuredClone(anterior);
    atual.informacoes.servicos = [
      { ...anterior.informacoes.servicos[0], id: "novo:lavagem", nome: "Lavagem" },
      { ...anterior.informacoes.servicos[0], id: "novo:pendente", nome: "A conferir", situacao: "REVISAR" },
    ];
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.informacoes.servicos.map(s => s.id)).toEqual(["apenas-publicado", "novo:lavagem"]);
  });

  it.each(["REVISAR", "NAO_INFORMADO", "NAO_APLICA"] as const)("um serviço alterado em %s deixa de ser um fato ativo", situacao => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.informacoes.servicos[0].situacao = situacao;
    const atual = structuredClone(anterior); atual.informacoes.servicos[0].precoCents = 9500;
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.informacoes.servicos[0].situacao).toBe(situacao);
    expect(resultado.informacoes.servicos.filter(s => s.situacao === "CONFIRMADO")).toHaveLength(0);
  });

  it("um endereço novo ainda em revisão não herda a confirmação do endereço publicado", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.informacoes.endereco.situacao = "REVISAR";
    const atual = structuredClone(anterior); atual.informacoes.endereco.valor = "Novo local ainda não confirmado";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.informacoes.endereco.situacao).toBe("REVISAR");
    expect(resultado.informacoes.endereco.valor).toBe("Novo local ainda não confirmado");
  });

  it("confirmar explicitamente um item revisado publica o conteúdo que foi confirmado", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    Object.assign(anterior.informacoes.servicos[0], { nome: "Serviço revisado", precoCents: 14000, situacao: "REVISAR" });
    anterior.informacoes.endereco = { valor: "Rua Confirmada, 20", situacao: "REVISAR", origem: "MANUAL" };
    const atual = structuredClone(anterior);
    atual.informacoes.servicos[0].situacao = "CONFIRMADO"; atual.informacoes.endereco.situacao = "CONFIRMADO";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.informacoes.servicos[0]).toEqual(atual.informacoes.servicos[0]);
    expect(resultado.informacoes.endereco).toEqual(atual.informacoes.endereco);
  });

  it("preserva permissões e outras preferências antigas quando só uma regra é alterada", () => {
    const publicada = configuracaoExemplo(); publicada.atendimento.agendamento = "DESLIGADO";
    const anterior = structuredClone(publicada);
    anterior.atendimento.agendamento = "DIRETO"; anterior.atendimento.gestaoReservas = { cancelar: true, remarcar: true, antecedenciaHoras: 48 };
    const atual = structuredClone(anterior); atual.conhecimento.itens[0].resposta = "Há estacionamento pago ao lado.";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.atendimento).toEqual(publicada.atendimento);
    expect(resultado.conhecimento.itens[0].resposta).toBe("Há estacionamento pago ao lado.");
  });

  it("projeta somente a permissão realmente modificada dentro de gestão de reservas", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.atendimento.gestaoReservas!.remarcar = true;
    anterior.atendimento.gestaoReservas!.antecedenciaHoras = 48;
    const atual = structuredClone(anterior); atual.atendimento.gestaoReservas!.cancelar = true;
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.atendimento.gestaoReservas).toEqual({ cancelar: true, remarcar: false, antecedenciaHoras: null });
  });

  it("projeta uma mudança de dia sem publicar alterações anteriores em outro dia", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.informacoes.horarios[2].open = "11:00";
    const atual = structuredClone(anterior); atual.informacoes.horarios[1].close = "17:00";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.informacoes.horarios[1].close).toBe("17:00");
    expect(resultado.informacoes.horarios[2]).toEqual(publicada.informacoes.horarios[2]);
  });

  it("um horário alterado ainda não confirmado não fica ativo pelo status anterior", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.informacoes.horariosSituacao = "REVISAR";
    const atual = structuredClone(anterior); atual.informacoes.horarios[1].open = "10:00";
    expect(projetarAlteracoesDaConfiguracao(anterior, atual, publicada).informacoes.horariosSituacao).toBe("REVISAR");
  });

  it("adiciona e remove regras por ID sem trazer outras respostas do rascunho", () => {
    const publicada = configuracaoExemplo();
    publicada.conhecimento.itens.push({ ...publicada.conhecimento.itens[0], id: "so-publicada", pergunta: "Regra publicada" });
    const anterior = configuracaoExemplo();
    anterior.conhecimento.itens.push({ ...anterior.conhecimento.itens[0], id: "rascunho-antigo", resposta: "Nunca publicada" });
    const atual = structuredClone(anterior);
    atual.conhecimento.itens = atual.conhecimento.itens.filter(f => f.id !== "novo:estacionamento");
    atual.conhecimento.itens.push({ ...anterior.conhecimento.itens[0], id: "nova-confirmada", pergunta: "Como funciona?" });
    atual.conhecimento.itens.push({ ...anterior.conhecimento.itens[0], id: "nova-pendente", situacao: "NAO_INFORMADO" });
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.conhecimento.itens.map(f => f.id)).toEqual(["so-publicada", "nova-confirmada"]);
  });

  it("uma resposta editada ainda em revisão não fica disponível como resposta aprovada", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.conhecimento.itens[0].situacao = "REVISAR";
    const atual = structuredClone(anterior); atual.conhecimento.itens[0].resposta = "Resposta que precisa de conferência";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.conhecimento.itens[0].resposta).toBe("Resposta que precisa de conferência");
    expect(resultado.conhecimento.itens.filter(f => f.situacao === "CONFIRMADO")).toEqual([]);
  });

  it("aplica diferenças de listas sem publicar adições anteriores", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.atendimento.handoffKeywords.push("pendente"); anterior.informacoes.diasFechados.push("2026-12-24");
    const atual = structuredClone(anterior);
    atual.atendimento.handoffKeywords.push("financeiro"); atual.informacoes.diasFechados.push("2026-12-25");
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.atendimento.handoffKeywords).toEqual(["gerente", "financeiro"]);
    expect(resultado.informacoes.diasFechados).toEqual(["2026-12-25"]);
  });

  it("material alterado continua bruto e não aprova regras nem conteúdo antigo do rascunho", () => {
    const publicada = configuracaoExemplo();
    publicada.materiais = [{ id: "m1", nome: "Original", texto: "Texto publicado", sha256: "a", tipo: "TEXTO", importadoEm: "2026-10-20", validoAte: null }];
    const anterior = structuredClone(publicada); anterior.materiais![0].texto = "Conteúdo ainda não revisado";
    anterior.conhecimento.itens[0].situacao = "REVISAR";
    const atual = structuredClone(anterior); atual.materiais![0].nome = "Novo nome";
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado.materiais![0]).toEqual({ ...publicada.materiais[0], nome: "Novo nome" });
    expect(resultado.conhecimento).toEqual(publicada.conhecimento);
  });

  it("sem edição retorna a publicação, e nenhuma entrada é modificada", () => {
    const publicada = configuracaoExemplo(); const anterior = structuredClone(publicada);
    anterior.negocio.nome = "Nome ainda no rascunho";
    const atual = structuredClone(anterior); const entradas = JSON.stringify([anterior, atual, publicada]);
    const resultado = projetarAlteracoesDaConfiguracao(anterior, atual, publicada);
    expect(resultado).toEqual(publicada);
    expect(JSON.stringify([anterior, atual, publicada])).toBe(entradas);
    resultado.informacoes.servicos[0].nome = "Não vaza para as entradas";
    expect(publicada.informacoes.servicos[0].nome).toBe("Revisão");
  });
});
