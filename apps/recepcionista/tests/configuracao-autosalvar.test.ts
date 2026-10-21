import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControladorConfiguracaoAutosave, type PedidoAutosaveConfiguracao } from "@/components/atendente/configuracao-autosalvar";
import type { TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { configuracaoExemplo } from "./fixtures/configuracao-nexa";

function tela(revisao = 1): TelaConfiguracaoNexa {
  return { rascunho: configuracaoExemplo(), revisao, etapa: 0, revisadas: [], testes: [], pendencias: [], publicadoEm: null, haAlteracoes: true, conexao: { conectado: false, telefone: "", ligado: false } };
}
function resposta(pedido: PedidoAutosaveConfiguracao): TelaConfiguracaoNexa {
  return { ...tela(pedido.revisao + 1), rascunho: pedido.rascunho, etapa: pedido.etapa };
}
function promessaControlada<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (falha: unknown) => void;
  const promessa = new Promise<T>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promessa, resolver, rejeitar };
}
const editarNome = (controle: ControladorConfiguracaoAutosave, nome: string) => controle.editar(atual => ({ ...atual, negocio: { ...atual.negocio, nome } }));

describe("salvamento automático da configuração", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("agrupa digitação no intervalo e só informa salvo após a confirmação do servidor", async () => {
    const pendente = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>(() => pendente.promessa);
    const controle = new ControladorConfiguracaoAutosave({ salvar });
    controle.iniciar(tela());
    editarNome(controle, "Oficina H");
    await vi.advanceTimersByTimeAsync(400);
    editarNome(controle, "Oficina Horizonte");
    await vi.advanceTimersByTimeAsync(649);
    expect(salvar).not.toHaveBeenCalled();
    expect(controle.obterEstado()).toMatchObject({ estado: "aguardando", pendente: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(controle.obterEstado()).toMatchObject({ estado: "salvando", pendente: true });
    pendente.resolver(resposta(salvar.mock.calls[0]![0]));
    await controle.garantirSalvo();
    expect(controle.obterEstado()).toMatchObject({ estado: "salvo", pendente: false, tela: { revisao: 2 } });
  });

  it("não deixa a resposta antiga apagar digitação nova e usa a revisão atualizada no próximo PUT", async () => {
    const primeira = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockImplementationOnce(() => primeira.promessa)
      .mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela(7));
    editarNome(controle, "Primeira versão");
    await vi.advanceTimersByTimeAsync(650);
    editarNome(controle, "Texto mais recente");
    await vi.advanceTimersByTimeAsync(3000);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(controle.obterEstado().rascunho?.negocio.nome).toBe("Texto mais recente");
    primeira.resolver(resposta(salvar.mock.calls[0]![0]));
    const atual = await controle.garantirSalvo();
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(salvar.mock.calls[1]![0]).toMatchObject({ revisao: 8, rascunho: { negocio: { nome: "Texto mais recente" } } });
    expect(atual.revisao).toBe(9);
    expect(atual.rascunho.negocio.nome).toBe("Texto mais recente");
  });

  it("drena edições que chegaram durante um flush e compartilha o mesmo PUT entre chamadas concorrentes", async () => {
    const primeira = promessaControlada<TelaConfiguracaoNexa>();
    const segunda = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockImplementationOnce(() => primeira.promessa).mockImplementationOnce(() => segunda.promessa);
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela());
    editarNome(controle, "Uma edição");
    const flush1 = controle.garantirSalvo(); const flush2 = controle.garantirSalvo();
    await Promise.resolve();
    expect(salvar).toHaveBeenCalledTimes(1);
    editarNome(controle, "Outra edição");
    primeira.resolver(resposta(salvar.mock.calls[0]![0]));
    await vi.advanceTimersByTimeAsync(0);
    expect(salvar).toHaveBeenCalledTimes(2);
    segunda.resolver(resposta(salvar.mock.calls[1]![0]));
    const [a, b] = await Promise.all([flush1, flush2]);
    expect(a.revisao).toBe(3); expect(b.revisao).toBe(3);
    expect(a.rascunho.negocio.nome).toBe("Outra edição");
  });

  it("salva a volta ao valor original quando o valor intermediário já estava sendo gravado", async () => {
    const primeira = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockImplementationOnce(() => primeira.promessa).mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); const original = tela(); controle.iniciar(original);
    editarNome(controle, "Valor intermediário"); await vi.advanceTimersByTimeAsync(650);
    editarNome(controle, original.rascunho.negocio.nome);
    expect(controle.obterEstado()).toMatchObject({ estado: "salvando", pendente: true });
    primeira.resolver(resposta(salvar.mock.calls[0]![0]));
    await controle.garantirSalvo();
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(salvar.mock.calls[1]![0].rascunho.negocio.nome).toBe(original.rascunho.negocio.nome);
  });

  it("cancela a gravação se o usuário desfaz tudo antes de começar o pedido", async () => {
    const salvar = vi.fn(async (pedido: PedidoAutosaveConfiguracao) => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); const original = tela(); controle.iniciar(original);
    editarNome(controle, "Temporário"); editarNome(controle, original.rascunho.negocio.nome);
    await vi.advanceTimersByTimeAsync(1000);
    expect(salvar).not.toHaveBeenCalled();
    expect(controle.obterEstado()).toMatchObject({ estado: "salvo", pendente: false });
  });

  it("mantém o texto local na falha e só repete quando a pessoa pede", async () => {
    const falha = new Error("Conexão interrompida");
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockRejectedValueOnce(falha).mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela());
    editarNome(controle, "Não perder"); await vi.advanceTimersByTimeAsync(650);
    expect(controle.obterEstado()).toMatchObject({ estado: "erro", pendente: true, erro: falha, rascunho: { negocio: { nome: "Não perder" } } });
    editarNome(controle, "Não perder também esta edição"); await vi.advanceTimersByTimeAsync(2000);
    await expect(controle.garantirSalvo()).rejects.toBe(falha);
    expect(salvar).toHaveBeenCalledTimes(1);
    await controle.tentarNovamente();
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(controle.obterEstado()).toMatchObject({ estado: "salvo", pendente: false, rascunho: { negocio: { nome: "Não perder também esta edição" } } });
  });

  it("não declara salvo se a rede falhou depois de o usuário voltar ao valor anterior", async () => {
    const primeira = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockImplementationOnce(() => primeira.promessa).mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); const original = tela(); controle.iniciar(original);
    editarNome(controle, "Valor que pode ter chegado ao servidor"); await vi.advanceTimersByTimeAsync(650);
    editarNome(controle, original.rascunho.negocio.nome);
    primeira.rejeitar(new Error("Resposta perdida")); await vi.advanceTimersByTimeAsync(0);
    expect(controle.obterEstado()).toMatchObject({ estado: "erro", pendente: true });
    await controle.tentarNovamente();
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(salvar.mock.calls[1]![0].rascunho.negocio.nome).toBe(original.rascunho.negocio.nome);
  });

  it("expõe conflito 409 sem importar ou sobrescrever silenciosamente os dados de outra aba", async () => {
    const conflito = Object.assign(new Error("A configuração foi alterada em outra aba."), { status: 409 });
    const salvar = vi.fn(async (_pedido: PedidoAutosaveConfiguracao) => { throw conflito; });
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela(4));
    editarNome(controle, "Minha edição");
    await expect(controle.garantirSalvo()).rejects.toMatchObject({ status: 409 });
    expect(controle.sincronizar(tela(9))).toBe(false);
    expect(controle.obterEstado().rascunho?.negocio.nome).toBe("Minha edição");
    expect(controle.obterEstado().tela?.revisao).toBe(4);
    await vi.advanceTimersByTimeAsync(10000);
    expect(salvar).toHaveBeenCalledTimes(1);
  });

  it("só descarta um conflito por ação explícita e usa a revisão carregada nas edições seguintes", async () => {
    const conflito = Object.assign(new Error("Alterado em outra aba"), { status: 409 });
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockRejectedValueOnce(conflito).mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela(3));
    editarNome(controle, "Alteração local");
    await expect(controle.garantirSalvo()).rejects.toBe(conflito);
    const remota = tela(10); remota.rascunho.negocio.nome = "Alteração da outra aba";
    expect(controle.sincronizar(remota)).toBe(false);
    expect(controle.descartarAlteracoes(remota)).toBe(true);
    expect(controle.obterEstado()).toMatchObject({ estado: "salvo", pendente: false, erro: null, rascunho: { negocio: { nome: "Alteração da outra aba" } } });
    editarNome(controle, "Nova alteração local"); await controle.garantirSalvo();
    expect(salvar.mock.calls[1]![0].revisao).toBe(10);
  });

  it("não permite descartar nem recarregar enquanto uma gravação ainda pode voltar", async () => {
    const pendente = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>(() => pendente.promessa);
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela());
    editarNome(controle, "Gravando"); await vi.advanceTimersByTimeAsync(650);
    expect(controle.descartarAlteracoes(tela(10))).toBe(false);
    expect(controle.iniciar(tela(10))).toBe(false);
    pendente.resolver(resposta(salvar.mock.calls[0]![0])); await controle.garantirSalvo();
    expect(controle.obterEstado().tela?.revisao).toBe(2);
  });

  it("aceita normalização do servidor somente quando não houve nova edição e nunca aprova REVISAR", async () => {
    const salvar = vi.fn(async (pedido: PedidoAutosaveConfiguracao) => {
      const nova = resposta(pedido); nova.rascunho.negocio.nome = nova.rascunho.negocio.nome.trim(); return nova;
    });
    const controle = new ControladorConfiguracaoAutosave({ salvar }); const original = tela();
    original.rascunho.informacoes.pagamento.situacao = "REVISAR"; controle.iniciar(original);
    editarNome(controle, "  Nome com espaços  "); await controle.garantirSalvo();
    expect(controle.obterEstado().rascunho?.negocio.nome).toBe("Nome com espaços");
    expect(salvar.mock.calls[0]![0].rascunho.informacoes.pagamento.situacao).toBe("REVISAR");
    expect(salvar.mock.calls[0]![0]).not.toHaveProperty("concluirEtapas");
  });

  it("recusa recargas e respostas antigas enquanto há texto pendente; depois aceita metadados atuais", async () => {
    const salvar = vi.fn(async (pedido: PedidoAutosaveConfiguracao) => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela(10));
    editarNome(controle, "Local");
    expect(controle.iniciar(tela(11))).toBe(false);
    await controle.garantirSalvo();
    expect(controle.sincronizar(tela(9))).toBe(false);
    const revisada = { ...controle.obterEstado().tela!, revisadas: [0, 1], conexao: { conectado: true, telefone: "", ligado: false } };
    expect(controle.sincronizar(revisada)).toBe(true);
    expect(controle.obterEstado().tela?.revisadas).toEqual([0, 1]);
    expect(controle.obterEstado().rascunho?.negocio.nome).toBe("Local");
  });

  it("a troca de seção persiste junto da edição mais recente sem abrir um pedido paralelo", async () => {
    const primeira = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockImplementationOnce(() => primeira.promessa).mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela());
    editarNome(controle, "Nova empresa"); await vi.advanceTimersByTimeAsync(650);
    controle.definirEtapa(3);
    primeira.resolver(resposta(salvar.mock.calls[0]![0]));
    const atual = await controle.garantirSalvo();
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(atual.etapa).toBe(3);
    expect(salvar.mock.calls[1]![0]).toMatchObject({ revisao: 2, etapa: 3 });
  });

  it("o cleanup salva imediatamente a edição que ainda estava no debounce", async () => {
    const pendente = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>(() => pendente.promessa);
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela());
    editarNome(controle, "Preservado"); controle.suspender(); await vi.advanceTimersByTimeAsync(0);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(controle.obterEstado().rascunho?.negocio.nome).toBe("Preservado");
    controle.retomar(); controle.suspender(); expect(salvar).toHaveBeenCalledTimes(1);
    pendente.resolver(resposta(salvar.mock.calls[0]![0]));
    await controle.garantirSalvo();
    expect(controle.obterEstado()).toMatchObject({ estado: "salvo", pendente: false });
  });

  it("o cleanup conclui a fila editada durante um pedido em voo, sem abrir pedidos paralelos", async () => {
    const primeira = promessaControlada<TelaConfiguracaoNexa>();
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>()
      .mockImplementationOnce(() => primeira.promessa).mockImplementation(async pedido => resposta(pedido));
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela(5));
    editarNome(controle, "Intermediário"); await vi.advanceTimersByTimeAsync(650);
    editarNome(controle, "Última edição antes de voltar"); controle.suspender();
    await vi.advanceTimersByTimeAsync(1000);
    expect(salvar).toHaveBeenCalledTimes(1);
    primeira.resolver(resposta(salvar.mock.calls[0]![0]));
    await vi.advanceTimersByTimeAsync(0);
    expect(salvar).toHaveBeenCalledTimes(2);
    expect(salvar.mock.calls[1]![0]).toMatchObject({ revisao: 6, rascunho: { negocio: { nome: "Última edição antes de voltar" } } });
    expect(controle.obterEstado()).toMatchObject({ estado: "salvo", pendente: false });
    await vi.advanceTimersByTimeAsync(5000);
    expect(salvar).toHaveBeenCalledTimes(2);
  });

  it("o cleanup não repete uma falha anterior nem tenta rebasear conflito de outra aba", async () => {
    const conflito = Object.assign(new Error("Outra aba alterou estes dados"), { status: 409 });
    const salvar = vi.fn<[PedidoAutosaveConfiguracao], Promise<TelaConfiguracaoNexa>>().mockRejectedValue(conflito);
    const controle = new ControladorConfiguracaoAutosave({ salvar }); controle.iniciar(tela(4));
    editarNome(controle, "Precisa de revisão"); await vi.advanceTimersByTimeAsync(650);
    controle.suspender(); controle.retomar(); controle.suspender();
    await vi.advanceTimersByTimeAsync(3000);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(controle.obterEstado()).toMatchObject({ estado: "erro", pendente: true, erro: { status: 409 }, tela: { revisao: 4 } });
    expect(controle.obterEstado().rascunho?.negocio.nome).toBe("Precisa de revisão");
  });
});
