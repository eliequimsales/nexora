"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";
import { ModalSalvarConta } from "@/components/painel/modal-salvar-conta";
import { CENARIOS_NEXA, ETAPAS_NEXA, type CenarioNexa, type ConfiguracaoNexa, type TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, PRINCIPAL_NEXA as PRINCIPAL, CartaoNexa as Cartao, CampoNexa as Campo, PendenciasNexaContext } from "./configuracao-campos";
import { FormularioConfiguracaoNexa } from "./configuracao-formulario";
import { requisitarConfiguracaoNexa as requisitar, type FalhaConfiguracaoNexa } from "./configuracao-requisicao";
import { SimuladorConfiguracaoNexa, type PedidoTesteNexa } from "./configuracao-simulador";

type MetaConta = { isGuest?: boolean; empresaTelefone?: string; acesso?: string };
type Destino = number | { href: string } | "RECARREGAR";

export function ConfiguracaoDaNexa() {
  const router = useRouter();
  const [tela, setTela] = useState<TelaConfiguracaoNexa | null>(null);
  const [rascunho, setRascunho] = useState<ConfiguracaoNexa | null>(null);
  const [etapa, setEtapa] = useState(0);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [mobileTeste, setMobileTeste] = useState(false);
  const [telaLarga, setTelaLarga] = useState(false);
  const [pedidoTeste, setPedidoTeste] = useState<PedidoTesteNexa | null>(null);
  const [conectar, setConectar] = useState(false);
  const [salvarConta, setSalvarConta] = useState(false);
  const [importacaoAberta, setImportacaoAberta] = useState(false);
  const [metaConta, setMetaConta] = useState<MetaConta>({});
  const [assistente, setAssistente] = useState("");
  const emOperacao = useRef(false);
  const proximoPedido = useRef(0);
  const testeRef = useRef<HTMLElement>(null);
  const saidaRef = useRef<HTMLDivElement>(null);
  const importacaoRef = useRef<HTMLDivElement>(null);
  const tituloEtapaRef = useRef<HTMLHeadingElement>(null);
  const etapaAnterior = useRef<number | null>(null);
  const sujo = !!tela && !!rascunho && JSON.stringify(tela.rascunho) !== JSON.stringify(rascunho);

  const aplicar = useCallback((nova: TelaConfiguracaoNexa) => { setTela(nova); setRascunho(nova.rascunho); }, []);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { const nova = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao"); aplicar(nova); setEtapa(nova.etapa); }
    catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }, [aplicar]);
  useEffect(() => { void carregar(); void requisitar<MetaConta>("/api/atendente").then(setMetaConta).catch(() => {}); }, [carregar]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const atualizar = () => setTelaLarga(media.matches); atualizar();
    media.addEventListener("change", atualizar); return () => media.removeEventListener("change", atualizar);
  }, []);
  useEffect(() => {
    const sair = (e: BeforeUnloadEvent) => { if (sujo || ocupado) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", sair); return () => window.removeEventListener("beforeunload", sair);
  }, [sujo, ocupado]);
  useEffect(() => {
    const navegar = (e: MouseEvent) => {
      if ((!sujo && !ocupado) || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.href === window.location.href || link.getAttribute("href")?.startsWith("#")) return;
      e.preventDefault(); e.stopPropagation();
      if (!ocupado) setDestino({ href: link.href });
    };
    document.addEventListener("click", navegar, true); return () => document.removeEventListener("click", navegar, true);
  }, [sujo, ocupado]);
  useEffect(() => {
    if (!mobileTeste && destino === null && !importacaoAberta) return;
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape" && !ocupado) { setMobileTeste(false); setDestino(null); setImportacaoAberta(false); } };
    window.addEventListener("keydown", fechar); return () => window.removeEventListener("keydown", fechar);
  }, [mobileTeste, destino, importacaoAberta, ocupado]);
  useEffect(() => {
    const modal = importacaoAberta ? importacaoRef.current : destino !== null ? saidaRef.current : mobileTeste && !telaLarga ? testeRef.current : null;
    if (!modal) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const interativos = () => Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')).filter(e => e.getClientRects().length > 0);
    interativos()[0]?.focus();
    const manterFoco = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const itens = interativos(); const primeiro = itens[0]; const ultimo = itens[itens.length - 1];
      if (!primeiro) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === primeiro || !modal.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !modal.contains(document.activeElement))) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", manterFoco);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", manterFoco); anterior?.focus(); };
  }, [destino !== null, importacaoAberta, mobileTeste, telaLarga]);
  useEffect(() => {
    const titulo = tituloEtapaRef.current;
    if (!titulo) return;
    if (etapaAnterior.current === null) { etapaAnterior.current = etapa; return; }
    if (etapaAnterior.current === etapa) return;
    etapaAnterior.current = etapa;
    titulo.focus({ preventScroll: true });
    titulo.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [etapa, !!tela]);

  async function operar<T>(acao: () => Promise<T>): Promise<T | null> {
    if (emOperacao.current) return null;
    emOperacao.current = true; setOcupado(true); setErro(""); setAviso("");
    try { return await acao(); }
    catch (e) {
      const falha = e as FalhaConfiguracaoNexa; setErro(falha.message);
      if (falha.pendencias) setTela(atual => atual ? { ...atual, pendencias: falha.pendencias! } : atual);
      return null;
    } finally { emOperacao.current = false; setOcupado(false); }
  }
  async function salvar(concluir = false): Promise<boolean> {
    if (!tela || !rascunho) return false;
    const dados = { ...rascunho, atendimento: { ...rascunho.atendimento, handoffKeywords: rascunho.atendimento.handoffKeywords.map(v => v.trim()).filter(Boolean) } };
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "PUT", { revisao: tela.revisao, rascunho: dados, etapa, concluirEtapa: concluir }));
    if (!nova) return false;
    aplicar(nova); if (concluir) setEtapa(nova.etapa);
    setAviso("Rascunho salvo. As alterações entram no atendimento depois da publicação."); return true;
  }
  async function irPara(proximo: Destino) {
    if (typeof proximo === "number") { setEtapa(proximo); setErro(""); setAviso(""); }
    else if (proximo === "RECARREGAR") await carregar();
    else { const url = new URL(proximo.href, window.location.href); if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`); else window.location.href = url.href; }
  }
  function navegar(proximo: Destino) { if (ocupado) return; if (sujo) setDestino(proximo); else void irPara(proximo); }
  function editar<K extends keyof ConfiguracaoNexa>(secao: K, dados: Partial<ConfiguracaoNexa[K]>) {
    setRascunho(atual => atual ? { ...atual, [secao]: { ...atual[secao], ...dados } } : atual); setAviso("");
  }
  async function preencher() {
    if (!tela || sujo || !assistente.trim()) return;
    const resposta = await operar(() => requisitar<{ tela: TelaConfiguracaoNexa; mensagem: string }>("/api/atendente/preencher", "POST", { revisao: tela.revisao, mensagem: assistente.trim() }));
    if (resposta) { aplicar(resposta.tela); setAssistente(""); setAviso(resposta.mensagem || "Organizei uma proposta. Confira as informações marcadas para revisão."); }
  }
  async function publicar() {
    if (!tela || sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "PUBLICAR", revisao: tela.revisao }));
    if (nova) { aplicar(nova); setAviso("Configuração publicada. Confira a conexão para ativar o atendimento."); }
  }
  async function importarCadastro() {
    if (!tela) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "IMPORTAR_CADASTRO", revisao: tela.revisao }));
    if (nova) { aplicar(nova); setEtapa(nova.etapa); setImportacaoAberta(false); setAviso("Dados atuais importados para o rascunho. Confira as informações marcadas para revisão e faça novos testes antes de publicar."); }
  }
  async function ligar(ligar: boolean) {
    if (ligar && sujo) return;
    const nova = await operar(async () => { await requisitar("/api/atendente/ligar", "POST", { ligar }); return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao"); });
    if (nova) { if (!ligar && sujo) setTela(nova); else aplicar(nova); setAviso(ligar ? "Atendimento ativado conforme os horários e as regras publicados." : "Atendimento pausado."); }
  }
  function corrigir(cenario: CenarioNexa) { setEtapa(cenario === "HUMANO" ? 2 : cenario === "CANCELAMENTO" || cenario === "DESCONHECIDA" ? 3 : 1); setMobileTeste(false); setAviso("A resposta foi marcada para correção. Confira as informações desta seção e salve antes de testar novamente."); }
  async function revisar(testeId: string, cenario: CenarioNexa, correto: boolean) {
    if (!tela || sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "REVISAR_TESTE", revisao: tela.revisao, testeId, correto }));
    if (nova) { aplicar(nova); if (correto) setAviso("Revisão do teste salva."); else corrigir(cenario); }
  }
  function solicitarTeste(cenario: CenarioNexa) { if (ocupado || sujo) return; setMobileTeste(true); setPedidoTeste({ cenario, seq: ++proximoPedido.current }); }
  async function atualizar() {
    if (sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao"));
    if (nova) { aplicar(nova); setAviso("Situação da configuração atualizada."); }
  }

  if (!tela || !rascunho) return <div className="mx-auto max-w-4xl space-y-5 py-4"><h1 className="font-display text-3xl text-panel-ink">Configure sua Nexa</h1>{carregando ? <div role="status" className="rounded-2xl border border-panel-line bg-panel-card p-8 text-panel-sub">Abrindo sua configuração…</div> : <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-sm text-red-800"><p>{erro || "Não foi possível abrir sua configuração."}</p><button className={`${BOTAO} mt-4`} type="button" onClick={() => void carregar()}>Tentar novamente</button></div>}</div>;

  const pendenciasEtapa = tela.pendencias.filter(p => p.etapa === etapa);
  const atuais = tela.testes.filter(t => t.revisao === tela.revisao);
  const bloqueantes = tela.pendencias.filter(p => p.bloqueia);
  const publicado = !!tela.publicadoEm && !tela.haAlteracoes && !sujo;
  const pendenciaCadastro = tela.pendencias.find(p => p.campo === "cadastro");
  const etapaRevisada = (numero: number) => tela.revisadas.includes(numero) && !tela.pendencias.some(p => p.etapa === numero && p.bloqueia);

  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-panel-ink">Atendente virtual</span><span className="text-xs text-panel-sub">{tela.publicadoEm ? publicado ? "Configuração publicada" : "Há alterações para publicar" : "Preparação inicial"}</span></div><h1 className="font-display text-2xl text-panel-ink sm:text-3xl">Configure sua Nexa</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-panel-sub">Organize o que ela sabe, escolha como atende e confira as respostas antes de ativar.</p></div><button type="button" className={`${BOTAO} xl:hidden`} onClick={() => setMobileTeste(true)}>Testar conversa</button></header>
    {metaConta.isGuest && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4"><div><p className="text-sm font-semibold text-panel-ink">Guarde seu acesso</p><p className="mt-1 text-xs text-panel-sub">Crie seu acesso para continuar a configuração depois.</p></div><button type="button" className={BOTAO} onClick={() => setSalvarConta(true)}>Salvar meu acesso</button></div>}
    {metaConta.acesso === "SEMANA_ACABOU" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-panel-line bg-panel-card p-4 text-sm"><p>Seu período de teste terminou. Você pode revisar a configuração e consultar as opções de plano.</p><Link href="/painel/assinatura" className={BOTAO}>Ver planos</Link></div>}



    <div className="grid items-start gap-5 xl:grid-cols-[190px_minmax(0,1fr)_340px] 2xl:grid-cols-[210px_minmax(0,1fr)_370px]">
      <nav aria-label="Etapas de configuração" className="xl:sticky xl:top-5"><ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">{ETAPAS_NEXA.map((e, i) => <li key={e.titulo}><button type="button" disabled={ocupado} onClick={() => navegar(i)} aria-current={etapa === i ? "step" : undefined} className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50 ${etapa === i ? "border-amber bg-amber/15" : "border-transparent hover:bg-panel-card"}`}><span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${etapa === i ? "bg-amber text-night" : etapaRevisada(i) ? "bg-emerald-500/15 text-emerald-700" : "bg-panel-card text-panel-sub"}`}>{etapaRevisada(i) ? "✓" : i + 1}</span><span><span className="block text-xs font-semibold text-panel-ink sm:text-sm">{e.titulo}</span><span className="mt-1 hidden text-xs leading-relaxed text-panel-sub xl:block">{e.descricao}</span></span></button></li>)}</ol><p className="mt-3 hidden px-3 text-xs leading-relaxed text-panel-sub xl:block">O progresso é salvo ao escolher “Salvar rascunho” ou “Salvar e continuar”.</p></nav>

      <div className="min-w-0 space-y-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-panel-sub">Etapa {etapa + 1} de {ETAPAS_NEXA.length}</p><h2 ref={tituloEtapaRef} tabIndex={-1} className="mt-1 scroll-mt-5 text-xl font-semibold text-panel-ink outline-none">{ETAPAS_NEXA[etapa].titulo}</h2></div>{sujo && <span className="rounded-full bg-amber/15 px-2.5 py-1 text-xs text-panel-ink">Ainda não salvo</span>}</div>
    {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"><p>{erro}</p><button className={BOTAO} type="button" disabled={ocupado} onClick={() => navegar("RECARREGAR")}>Recarregar configuração</button></div>}
    {aviso && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">{aviso}</div>}
        {pendenciaCadastro && <aside aria-label="Cadastro alterado em outra tela" className="space-y-3 rounded-2xl border border-amber/50 bg-amber/10 p-4"><p className="text-sm font-semibold text-panel-ink">O cadastro mudou em outra tela</p><p className="text-sm leading-relaxed text-panel-sub">{pendenciaCadastro.mensagem}</p><p className="text-xs leading-relaxed text-panel-sub">Importar substitui as informações do rascunho pelos dados atuais do cadastro. Você precisará revisar e testar a nova versão antes de publicar.</p><button type="button" className={BOTAO} disabled={ocupado} onClick={() => { setErro(""); setImportacaoAberta(true); }}>Importar dados atuais do cadastro</button></aside>}
        <PendenciasNexaContext.Provider value={tela.pendencias}><fieldset disabled={ocupado} className="min-w-0 space-y-4"><legend className="sr-only">Dados da etapa {ETAPAS_NEXA[etapa].titulo}</legend><FormularioConfiguracaoNexa etapa={etapa} dados={rascunho} editar={editar} />
        {etapa === 0 && <Cartao titulo="Prefere explicar com suas palavras?" descricao="A Nexa organiza uma proposta no rascunho. Tudo o que ela interpretar fica aguardando sua revisão."><Campo titulo="Explique seu negócio" dica="Não inclua senhas nem dados de clientes."><textarea rows={5} maxLength={6000} className={CAMPO} placeholder={"Endereço: Rua das Flores, 10\nCorte R$ 50,00 — 40 minutos\nAceitamos Pix e cartão\nSeg a sex das 9h às 18h"} value={assistente} onChange={e => setAssistente(e.target.value)} /></Campo><p className="text-xs leading-relaxed text-panel-sub">Use informações específicas. Se algo não puder ser interpretado, você pode preencher os campos diretamente.</p>{sujo && <p className="text-xs text-panel-sub">Salve as alterações acima antes de pedir o preenchimento.</p>}<button className={BOTAO} type="button" disabled={ocupado || sujo || !assistente.trim()} onClick={() => void preencher()}>Organizar uma proposta</button></Cartao>}

        {etapa === 4 && <><Cartao titulo="Confira como a Nexa atende" descricao="Teste respostas conhecidas, dúvidas sem resposta cadastrada e pedidos que dependem de você."><p className="text-sm leading-relaxed text-panel-sub">Use o simulador para perguntar como um cliente. Cada cenário começa uma nova conversa. Você pode continuar o diálogo escrevendo outras mensagens.</p><p className="rounded-xl bg-amber/10 p-3 text-xs leading-relaxed text-panel-ink">Antes de publicar, confira os cenários de informações, atendimento humano e informação não cadastrada. Para agendamentos, confira também a consulta de horário.</p><div className="space-y-2">{CENARIOS_NEXA.map(c => { const realizados = atuais.filter(t => t.cenario === c.id); const ultimo = realizados[realizados.length - 1]; return <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-line p-3"><div><p className="text-sm font-medium text-panel-ink">{c.titulo}</p><p className="mt-1 text-xs text-panel-sub">{ultimo ? ultimo.correto === true ? "Você conferiu a resposta desta revisão" : ultimo.correto === false ? "Precisa de correção" : "Teste realizado · aguardando sua revisão" : "Ainda não testado nesta revisão"}</p></div><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => solicitarTeste(c.id)}>Testar</button></div>; })}</div><p className="text-xs leading-relaxed text-panel-sub">Alterar informações invalida os testes anteriores. Depois de salvar mudanças, confira novamente os cenários relevantes.</p></Cartao>
          {atuais.length > 0 && <Cartao titulo="Seus testes desta revisão">{atuais.slice().reverse().map(t => <div key={t.id} className="space-y-2 rounded-xl border border-panel-line p-3"><p className="text-xs font-medium text-panel-sub">{CENARIOS_NEXA.find(c => c.id === t.cenario)?.titulo || "Conversa de teste"}</p><p className="text-sm font-medium text-panel-ink">{t.pergunta || "Mídia recebida"}</p>{t.respostas.map((r, i) => <p className="whitespace-pre-wrap text-sm leading-relaxed text-panel-sub" key={i}>{r}</p>)}<div className="flex flex-wrap gap-2"><button type="button" className={`${BOTAO} ${t.correto === true ? "!border-emerald-500 !bg-emerald-500/10" : ""}`} disabled={ocupado || sujo} onClick={() => void revisar(t.id, t.cenario, true)}>Está correta</button><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => void revisar(t.id, t.cenario, false)}>Preciso corrigir</button></div></div>)}</Cartao>}
        </>}

        {etapa === 5 && <>
          <Cartao titulo="Resumo do atendimento" descricao="Confira o que você está autorizando antes de publicar."><dl className="space-y-4 text-sm"><div><dt className="text-xs text-panel-sub">Negócio</dt><dd className="mt-1 font-medium text-panel-ink">{rascunho.negocio.nome || "Nome não informado"} · {rascunho.negocio.segmento || "Segmento não informado"}</dd></div><div><dt className="text-xs text-panel-sub">Atendente e linguagem</dt><dd className="mt-1 font-medium text-panel-ink">{rascunho.atendimento.nome || "Nome não informado"} · {rascunho.atendimento.jeito === "ACOLHEDOR" ? "Acolhedora" : rascunho.atendimento.jeito === "DIRETO" ? "Direta" : "Descontraída"}</dd></div><div><dt className="text-xs text-panel-sub">Quando responde</dt><dd className="mt-1 text-panel-ink">{rascunho.atendimento.quando === "FORA_EXPEDIENTE" ? "Fora do expediente cadastrado" : "Fora do expediente e após cinco minutos sem resposta da equipe durante o expediente"}</dd></div><div><dt className="text-xs text-panel-sub">Agendamentos</dt><dd className="mt-1 text-panel-ink">{rascunho.atendimento.agendamento === "DIRETO" ? "Consulta disponibilidade e confirma após registrar a reserva" : rascunho.atendimento.agendamento === "LINK" ? "Oferece o link para o cliente concluir" : "Responde sem confirmar agendamentos"}</dd></div><div><dt className="text-xs text-panel-sub">Conteúdo conferido</dt><dd className="mt-1 text-panel-ink">{rascunho.informacoes.servicos.filter(s => s.situacao === "CONFIRMADO").length} serviços e {rascunho.conhecimento.itens.filter(p => p.situacao === "CONFIRMADO").length} perguntas ou regras confirmadas por você.</dd></div></dl><p className="rounded-xl bg-panel-bg p-3 text-xs leading-relaxed text-panel-sub">Quando não souber ou depender de uma ação da equipe, a Nexa deve explicar o limite. Uma pessoa pode assumir a conversa e reativar a automação depois.</p></Cartao>
          <Cartao titulo="Publicar configuração" descricao="Salvar guarda o rascunho. Publicar aplica as informações revisadas ao atendimento.">{sujo && <p className="rounded-xl bg-amber/10 p-3 text-sm">Salve o rascunho antes de publicar.</p>}<p className="text-sm text-panel-sub">{bloqueantes.length ? "Resolva as pendências abaixo para publicar esta revisão." : "As verificações são conferidas novamente ao publicar."}</p><button type="button" className={PRINCIPAL} disabled={ocupado || sujo || bloqueantes.length > 0 || publicado} onClick={() => void publicar()}>{publicado ? "Configuração publicada" : "Publicar configuração revisada"}</button></Cartao>
          <Cartao titulo="Conexão e atendimento" descricao="Conectar o WhatsApp e ativar o atendimento são ações diferentes.">{tela.conexao.ligado && !publicado && !pendenciaCadastro && <p className="rounded-xl bg-amber/10 p-3 text-xs leading-relaxed text-panel-ink">O atendimento usa a configuração anterior até você publicar este rascunho.</p>}<div className="grid gap-3"><div className="flex items-center justify-between gap-3 rounded-xl border border-panel-line p-3"><div><p className="text-sm font-medium">Dados</p><p className="mt-1 text-xs text-panel-sub">{publicado ? "Revisão atual publicada" : "Rascunho aguardando publicação"}</p></div><span className="text-lg" aria-hidden="true">{publicado ? "✓" : "○"}</span></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-line p-3"><div><p className="text-sm font-medium">WhatsApp</p><p className="mt-1 text-xs text-panel-sub">{tela.conexao.conectado ? "Conectado" : "Desconectado"}</p></div><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => setConectar(true)}>{tela.conexao.conectado ? "Ver conexão" : "Conectar WhatsApp"}</button></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-line p-3"><div><p className="text-sm font-medium">Atendimento</p><p className="mt-1 text-xs text-panel-sub">{pendenciaCadastro ? "Aguardando revisão do cadastro; respostas automáticas bloqueadas" : tela.conexao.ligado ? tela.conexao.conectado ? "Ativado, conforme os horários e regras em uso" : "Aguardando reconexão; não está respondendo pelo WhatsApp" : "Pausado"}</p></div><button type="button" className={tela.conexao.ligado ? BOTAO : PRINCIPAL} disabled={ocupado || (!tela.conexao.ligado && (!publicado || !tela.conexao.conectado))} onClick={() => void ligar(!tela.conexao.ligado)}>{tela.conexao.ligado ? "Pausar atendimento" : "Ativar atendimento"}</button></div></div><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => void atualizar()}>Atualizar situação</button></Cartao>
        </>}
        </fieldset></PendenciasNexaContext.Provider>

        {pendenciasEtapa.length > 0 && <aside aria-label="Pendências desta etapa" className="rounded-2xl border border-amber/40 bg-amber/10 p-4"><h3 className="text-sm font-semibold text-panel-ink">O que precisa da sua atenção</h3><ul className="mt-3 space-y-2">{pendenciasEtapa.map((p, i) => <li key={`${p.campo}-${i}`} className="text-sm leading-relaxed text-panel-ink">{p.mensagem}<span className="ml-1 text-xs text-panel-sub">{p.bloqueia ? "· Necessário para publicar" : "· Informação opcional"}</span></li>)}</ul></aside>}
        {etapa === 5 && tela.pendencias.some(p => p.etapa !== 5) && <Cartao titulo="Pendências da configuração">{tela.pendencias.filter(p => p.etapa !== 5).map((p, i) => <button type="button" key={`${p.campo}-${i}`} disabled={ocupado} className="flex w-full items-start justify-between gap-3 rounded-xl border border-panel-line p-3 text-left hover:border-amber" onClick={() => navegar(p.etapa)}><span><span className="block text-sm text-panel-ink">{p.mensagem}</span><span className="mt-1 block text-xs text-panel-sub">{ETAPAS_NEXA[p.etapa]?.titulo} · {p.bloqueia ? "Necessário para publicar" : "Opcional"}</span></span><span aria-hidden="true">→</span></button>)}</Cartao>}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-panel-line bg-panel-card p-4"><button type="button" className={BOTAO} disabled={ocupado || etapa === 0} onClick={() => navegar(etapa - 1)}>Voltar</button><div className="flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado} onClick={() => void salvar()}>{ocupado ? "Aguarde…" : "Salvar rascunho"}</button>{etapa < 5 && <button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => void salvar(true)}>Salvar e continuar</button>}</div></div>
      </div>

      <aside ref={testeRef} role={mobileTeste && !telaLarga ? "dialog" : undefined} aria-modal={mobileTeste && !telaLarga ? true : undefined} aria-label="Teste de conversa" className={mobileTeste ? "fixed inset-0 z-[80] flex min-h-0 flex-col bg-panel-bg xl:sticky xl:inset-auto xl:top-5 xl:z-auto xl:block" : "hidden min-w-0 xl:sticky xl:top-5 xl:block"}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-line bg-panel-card px-4 py-3 xl:hidden"><h2 className="font-semibold">Simulação de atendimento</h2><button type="button" className={BOTAO} onClick={() => setMobileTeste(false)}>Voltar à configuração</button></div>
        <div className={mobileTeste ? "min-h-0 flex-1 overflow-y-auto p-3 xl:overflow-visible xl:p-0" : ""}><SimuladorConfiguracaoNexa tela={tela} ocupado={ocupado} sujo={sujo} erro={erro} pedido={pedidoTeste} operar={operar} aplicar={aplicar} corrigir={corrigir} /></div>
      </aside>
    </div>

    {destino !== null && <div ref={saidaRef} role="dialog" aria-modal="true" aria-labelledby="nexa-saida-titulo" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md space-y-4 rounded-2xl border border-panel-line bg-panel-card p-6"><h2 id="nexa-saida-titulo" className="text-lg font-semibold">Você tem alterações não salvas</h2><p className="text-sm leading-relaxed text-panel-sub">Salve o rascunho para continuar com as informações que acabou de editar.</p>{erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}<div className="flex flex-wrap gap-2"><button type="button" className={PRINCIPAL} disabled={ocupado} onClick={async () => { const proximo = destino; if (await salvar()) { setDestino(null); void irPara(proximo); } }}>Salvar e continuar</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => { setRascunho(tela.rascunho); const proximo = destino; setDestino(null); void irPara(proximo); }}>Descartar alterações</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setDestino(null)}>Continuar editando</button></div></div></div>}
    {importacaoAberta && <div ref={importacaoRef} role="dialog" aria-modal="true" aria-labelledby="nexa-importacao-titulo" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-panel-line bg-panel-card p-6"><h2 id="nexa-importacao-titulo" className="text-lg font-semibold">Importar os dados atuais do cadastro?</h2><p className="text-sm leading-relaxed text-panel-sub">Esta ação substitui as informações do rascunho pelos dados atuais do cadastro. As informações importadas precisarão da sua revisão e os testes anteriores serão invalidados.</p>{sujo && <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm leading-relaxed text-panel-ink">Há alterações não salvas nesta tela. Ao substituir o rascunho, essas alterações também serão descartadas. Para guardá-las primeiro, escolha “Salvar rascunho e voltar”.</p>}<p className="text-xs leading-relaxed text-panel-sub">A importação prepara uma nova revisão. Ela não publica a configuração nem ativa o atendimento.</p>{erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}<div className="flex flex-wrap gap-2">{sujo && <button type="button" className={BOTAO} disabled={ocupado} onClick={async () => { if (await salvar()) setImportacaoAberta(false); }}>Salvar rascunho e voltar</button>}<button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => void importarCadastro()}>{ocupado ? "Aguarde…" : "Substituir rascunho e importar"}</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setImportacaoAberta(false)}>Cancelar</button></div></div></div>}
    <ModalConectarWhatsApp aberto={conectar} telefonePadrao={tela.conexao.telefone || metaConta.empresaTelefone} aoFechar={() => setConectar(false)} aoConectar={() => { setConectar(false); void atualizar(); }} />
    <ModalSalvarConta aberto={salvarConta} aoFechar={() => setSalvarConta(false)} nomePadrao={rascunho.negocio.nome} telefonePadrao={metaConta.empresaTelefone} aoSalvarSucesso={() => { setMetaConta({ ...metaConta, isGuest: false }); setAviso("Seu acesso foi salvo."); }} />
  </div>;
}







