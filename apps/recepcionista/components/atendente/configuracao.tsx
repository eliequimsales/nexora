"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";
import { ModalSalvarConta } from "@/components/painel/modal-salvar-conta";
import { CENARIOS_NEXA, type CenarioNexa, type ConfiguracaoNexa, type TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, PRINCIPAL_NEXA as PRINCIPAL, CartaoNexa as Cartao, CampoNexa as Campo, PendenciasNexaContext } from "./configuracao-campos";
import { FormularioConfiguracaoNexa } from "./configuracao-formulario";
import { requisitarConfiguracaoNexa as requisitar, type FalhaConfiguracaoNexa } from "./configuracao-requisicao";
import { SimuladorConfiguracaoNexa, type PedidoTesteNexa } from "./configuracao-simulador";

const PASSOS = [
  { titulo: "Seu negócio", descricao: "O que seus clientes precisam saber", etapas: [0, 1] },
  { titulo: "Atendimento", descricao: "Como seu atendente deve agir", etapas: [2, 3] },
  { titulo: "Testar e ativar", descricao: "Confira as respostas e comece", etapas: [4, 5] },
] as const;
const passoDaEtapa = (etapa: number) => Math.min(2, Math.max(0, Math.floor(etapa / 2)));
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
  const [mostrarPendencias, setMostrarPendencias] = useState(false);
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
  const tituloPassoRef = useRef<HTMLHeadingElement>(null);
  const passoAnterior = useRef<number | null>(null);
  const passo = passoDaEtapa(etapa);
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
    if (!tituloPassoRef.current) return;
    if (passoAnterior.current === null) { passoAnterior.current = passo; return; }
    if (passoAnterior.current === passo) return;
    passoAnterior.current = passo;
    tituloPassoRef.current.focus({ preventScroll: true });
    tituloPassoRef.current.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [passo, !!tela]);

  async function operar<T>(acao: () => Promise<T>): Promise<T | null> {
    if (emOperacao.current) return null;
    emOperacao.current = true; setOcupado(true); setErro(""); setAviso("");
    try { return await acao(); }
    catch (e) {
      const falha = e as FalhaConfiguracaoNexa; setErro(falha.message);
      if (falha.pendencias) { setMostrarPendencias(true); setTela(atual => atual ? { ...atual, pendencias: falha.pendencias! } : atual); }
      return null;
    } finally { emOperacao.current = false; setOcupado(false); }
  }
  async function salvar(concluir = false, destinoEtapa?: number): Promise<TelaConfiguracaoNexa | null> {
    if (!tela || !rascunho) return null;
    const dados = { ...rascunho, atendimento: { ...rascunho.atendimento, handoffKeywords: rascunho.atendimento.handoffKeywords.map(v => v.trim()).filter(Boolean) } };
    const etapaParaSalvar = destinoEtapa ?? (concluir && passo < 2 ? (passo + 1) * 2 : etapa);
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "PUT", {
      revisao: tela.revisao, rascunho: dados, etapa: etapaParaSalvar,
      ...(concluir && passo < 2 ? { concluirEtapas: [...PASSOS[passo].etapas] } : {}),
    }));
    if (!nova) return null;
    aplicar(nova);
    const faltas = nova.pendencias.filter(p => p.bloqueia && passoDaEtapa(p.etapa) === passo && !p.campo.startsWith("etapa:"));
    if (concluir && faltas.length) { setEtapa(nova.etapa); setMostrarPendencias(true); setAviso("Dados salvos. Confira os itens destacados antes de continuar."); }
    else { if (concluir) { setEtapa(nova.etapa); setMostrarPendencias(false); } setAviso(concluir ? "Dados salvos. Vamos ao próximo passo." : "Alterações salvas. O atendimento só muda depois de publicar."); }
    return nova;
  }
  async function irPara(proximo: Destino) {
    if (typeof proximo === "number") { setEtapa(proximo); setErro(""); setAviso(""); setMostrarPendencias(false); }
    else if (proximo === "RECARREGAR") await carregar();
    else { const url = new URL(proximo.href, window.location.href); if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`); else window.location.href = url.href; }
  }
  async function navegar(proximo: Destino) {
    if (emOperacao.current) return false;
    // A etapa de destino também é salva para a retomada abrir o mesmo passo.
    if (typeof proximo === "number") { const nova = await salvar(false, proximo); if (!nova) return false; }
    else if (sujo) { setDestino(proximo); return false; }
    await irPara(proximo);
    return true;
  }
  function editar<K extends keyof ConfiguracaoNexa>(secao: K, dados: Partial<ConfiguracaoNexa[K]>) {
    setRascunho(atual => atual ? { ...atual, [secao]: { ...atual[secao], ...dados } } : atual); setAviso("");
  }
  async function preencher() {
    if (!tela || emOperacao.current || !assistente.trim()) return;
    const base = sujo ? await salvar() : tela;
    if (!base) return;
    const resposta = await operar(() => requisitar<{ tela: TelaConfiguracaoNexa; mensagem: string }>("/api/atendente/preencher", "POST", { revisao: base.revisao, mensagem: assistente.trim() }));
    if (resposta) { aplicar(resposta.tela); setAssistente(""); setAviso(resposta.mensagem || "Confira a proposta nos campos marcados para revisão."); }
  }
  async function publicar() {
    if (!tela || sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "PUBLICAR", revisao: tela.revisao }));
    if (nova) { aplicar(nova); setAviso("Informações publicadas. Agora confira a conexão e ative o atendimento."); }
  }
  async function importarCadastro() {
    if (!tela) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "IMPORTAR_CADASTRO", revisao: tela.revisao }));
    if (nova) { aplicar(nova); setEtapa(nova.etapa); setImportacaoAberta(false); setMostrarPendencias(false); setAviso("Dados importados. Confira as informações destacadas e teste novamente antes de publicar."); }
  }
  async function ligar(ligar: boolean) {
    if (ligar && sujo) return;
    const nova = await operar(async () => { await requisitar("/api/atendente/ligar", "POST", { ligar }); return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao"); });
    if (nova) { if (!ligar && sujo) setTela(nova); else aplicar(nova); setAviso(ligar ? "Atendimento ativado nos horários e condições que você definiu." : "Atendimento pausado."); }
  }
  async function corrigir(cenario: CenarioNexa) {
    setMobileTeste(false);
    if (await navegar(cenario === "HUMANO" ? 2 : cenario === "CANCELAMENTO" || cenario === "DESCONHECIDA" ? 3 : 1)) {
      setMostrarPendencias(true); setAviso("Ajuste as informações desta tela. Depois, salve e teste a resposta novamente.");
    }
  }
  async function revisar(testeId: string, cenario: CenarioNexa, correto: boolean) {
    if (!tela || sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "REVISAR_TESTE", revisao: tela.revisao, testeId, correto }));
    if (nova) { aplicar(nova); if (correto) setAviso("Resposta conferida."); else await corrigir(cenario); }
  }
  async function solicitarTeste(cenario?: CenarioNexa) {
    if (emOperacao.current) return;
    if (sujo && !(await salvar())) return;
    setMobileTeste(true);
    if (cenario) setPedidoTeste({ cenario, seq: ++proximoPedido.current });
  }
  async function atualizar() {
    if (sujo) return;
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao"));
    if (nova) { aplicar(nova); setAviso("Situação atualizada."); }
  }

  if (!tela || !rascunho) return <div className="mx-auto max-w-4xl space-y-5 py-4"><h1 className="font-display text-3xl text-panel-ink">Configure seu atendente</h1>{carregando ? <div role="status" className="rounded-2xl border border-panel-line bg-panel-card p-8 text-panel-sub">Abrindo sua configuração…</div> : <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-sm text-red-800"><p>{erro || "Não foi possível abrir sua configuração."}</p><button className={`${BOTAO} mt-4`} type="button" onClick={() => void carregar()}>Tentar novamente</button></div>}</div>;

  const atuais = tela.testes.filter(t => t.revisao === tela.revisao);
  const bloqueantes = tela.pendencias.filter(p => p.bloqueia);
  const publicado = !!tela.publicadoEm && !tela.haAlteracoes && !sujo;
  const pendenciaCadastro = tela.pendencias.find(p => p.campo === "cadastro");
  const pendenciasPasso = tela.pendencias.filter(p => p.bloqueia && passoDaEtapa(p.etapa) === passo && !p.campo.startsWith("etapa:") && p.campo !== "cadastro");
  const passoRevisado = (numero: number) => numero === 2 ? publicado : PASSOS[numero].etapas.every(e => tela.revisadas.includes(e)) && !bloqueantes.some(p => passoDaEtapa(p.etapa) === numero);
  const precisaAgenda = rascunho.negocio.objetivo === "AGENDAMENTOS" || rascunho.atendimento.agendamento !== "DESLIGADO";
  const obrigatorios = CENARIOS_NEXA.filter(c => ["INFORMACOES", "HUMANO", "DESCONHECIDA", ...(precisaAgenda ? ["HORARIO"] : [])].includes(c.id));
  const ultimoTeste = (cenario: CenarioNexa) => [...atuais].reverse().find(t => t.cenario === cenario);
  const aprovados = obrigatorios.filter(c => ultimoTeste(c.id)?.correto === true).length;
  const proximoTeste = obrigatorios.find(c => ultimoTeste(c.id)?.correto !== true);

  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber/15 px-3 py-1 text-xs font-semibold text-panel-ink">Atendente da empresa</span><span aria-live="polite" className="text-xs text-panel-sub">{sujo ? "Alterações ainda não salvas" : publicado ? "Informações publicadas" : "Em preparação"}</span></div><h1 className="font-display text-2xl text-panel-ink sm:text-3xl">Configure seu atendente</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-panel-sub">Prepare o atendimento da sua empresa.</p></div>
      {passo === 2 && <button type="button" className={`${BOTAO} xl:hidden`} disabled={ocupado} onClick={() => void solicitarTeste()}>{sujo ? "Salvar e testar conversa" : "Conversa livre de teste"}</button>}
    </header>
    {metaConta.isGuest && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber/10 p-4"><div><p className="text-sm font-semibold text-panel-ink">Continue depois de onde parou</p><p className="mt-1 text-xs text-panel-sub">Salve seu acesso para voltar à configuração.</p></div><button type="button" className={BOTAO} onClick={() => setSalvarConta(true)}>Salvar meu acesso</button></div>}
    {metaConta.acesso === "SEMANA_ACABOU" && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-panel-line bg-panel-card p-4 text-sm"><p>Seu teste terminou. Você ainda pode revisar as informações do atendente.</p><Link href="/painel/assinatura" className={BOTAO}>Ver planos</Link></div>}

    <div className="grid items-start gap-5 xl:grid-cols-[180px_minmax(0,1fr)_320px] 2xl:grid-cols-[200px_minmax(0,1fr)_350px]">
      <nav aria-label="Etapas de configuração" className="xl:sticky xl:top-5"><ol className="grid grid-cols-3 gap-2 xl:grid-cols-1">{PASSOS.map((p, i) => <li key={p.titulo}><button type="button" aria-label={p.titulo} disabled={ocupado} onClick={() => void navegar(i * 2)} aria-current={passo === i ? "step" : undefined} className={`flex h-full w-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50 xl:flex-row ${passo === i ? "border-amber bg-amber/15" : "border-panel-line/60 hover:bg-panel-card"}`}><span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${passo === i ? "bg-amber text-night" : passoRevisado(i) ? "bg-emerald-500/15 text-emerald-700" : "bg-panel-card text-panel-sub"}`}>{passoRevisado(i) ? "✓" : i + 1}</span><span><span className="block text-xs font-semibold text-panel-ink sm:text-sm">{p.titulo}</span><span className="mt-1 hidden text-xs leading-relaxed text-panel-sub xl:block">{p.descricao}</span></span></button></li>)}</ol><p className="mt-3 hidden px-1 text-xs leading-relaxed text-panel-sub xl:block">Ao continuar ou trocar de passo, suas alterações são salvas.</p></nav>

      <div className="min-w-0 space-y-4">
        <div><p className="text-xs font-medium text-panel-sub">Passo {passo + 1} de 3</p><h2 ref={tituloPassoRef} tabIndex={-1} className="mt-1 scroll-mt-5 text-xl font-semibold text-panel-ink outline-none">{PASSOS[passo].titulo}</h2><p className="mt-1 text-sm text-panel-sub">{passo === 0 ? "Informe o essencial sobre a empresa." : passo === 1 ? "Escolha como ele deve atender." : "Teste as respostas antes de ativar."}</p></div>
        {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"><p>{erro}</p><button className={BOTAO} type="button" disabled={ocupado} onClick={() => void navegar("RECARREGAR")}>Recarregar configuração</button></div>}
        {aviso && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">{aviso}</div>}
        {pendenciaCadastro && <aside aria-label="Cadastro alterado em outra tela" className="space-y-3 rounded-2xl border border-amber/50 bg-amber/10 p-4"><p className="text-sm font-semibold text-panel-ink">Há informações mais recentes no cadastro</p><p className="text-sm leading-relaxed text-panel-sub">Importe os dados atuais para conferir. Isso substitui o rascunho e exige novos testes antes de publicar.</p><button type="button" className={BOTAO} disabled={ocupado} onClick={() => { setErro(""); setImportacaoAberta(true); }}>Revisar dados atuais</button></aside>}

        <PendenciasNexaContext.Provider value={mostrarPendencias ? tela.pendencias : []}>
          <fieldset disabled={ocupado} className="min-w-0 space-y-4"><legend className="sr-only">Dados de {PASSOS[passo].titulo}</legend>
            {passo === 0 && <>
              <details className="group rounded-2xl border border-amber/30 bg-amber/5 p-4"><summary className="cursor-pointer text-sm font-semibold text-panel-ink">Já tem um texto sobre sua empresa? Cole aqui</summary><div className="mt-4 space-y-3"><p className="text-xs leading-relaxed text-panel-sub">Organizamos uma proposta nos campos abaixo. Você confere antes de usar.</p><Campo titulo="Sobre sua empresa" dica="Use apenas informações do negócio, sem senhas ou dados de clientes."><textarea rows={4} maxLength={6000} className={CAMPO} placeholder={"Endereço: Rua das Flores, 10\nCorte R$ 50 — 40 minutos\nAceitamos Pix e cartão\nSeg a sex das 9h às 18h"} value={assistente} onChange={e => setAssistente(e.target.value)} /></Campo><button className={BOTAO} type="button" disabled={ocupado || !assistente.trim()} onClick={() => void preencher()}>Preencher a partir do texto</button></div></details>
              <FormularioConfiguracaoNexa etapa={0} dados={rascunho} editar={editar} />
              <FormularioConfiguracaoNexa etapa={1} dados={rascunho} editar={editar} />
            </>}
            {passo === 1 && <><FormularioConfiguracaoNexa etapa={2} dados={rascunho} editar={editar} /><FormularioConfiguracaoNexa etapa={3} dados={rascunho} editar={editar} /></>}
            {passo === 2 && <>
              {[0, 1].filter(i => !passoRevisado(i)).length > 0 && <Cartao titulo="Antes de colocar para atender" descricao="Volte aos itens abaixo para concluir a conferência.">{[0, 1].filter(i => !passoRevisado(i)).map(i => <button type="button" key={i} className={`${BOTAO} w-full !justify-between`} onClick={() => void navegar(i * 2)}><span>Revisar {i === 0 ? "dados do negócio" : "forma de atender"}</span><span aria-hidden="true">→</span></button>)}</Cartao>}
              <Cartao titulo="1. Confira as respostas" descricao="Teste as situações abaixo e confirme se as respostas estão certas para sua empresa.">
                <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-panel-ink">{aprovados} de {obrigatorios.length} situações conferidas</p>{proximoTeste && <button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => void solicitarTeste(proximoTeste.id)}>{sujo ? "Salvar e testar" : aprovados ? "Testar próxima situação" : "Começar teste"}</button>}</div>
                <div className="space-y-3">{obrigatorios.map(c => { const ultimo = ultimoTeste(c.id); return <div key={c.id} className="space-y-3 rounded-xl border border-panel-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-panel-ink">{c.titulo}</p><p className="mt-1 text-xs text-panel-sub">{ultimo?.correto === true ? "Resposta conferida" : ultimo?.correto === false ? "Ajuste as informações e teste novamente" : ultimo ? "Confira a resposta abaixo" : "Ainda não testado"}</p></div><button type="button" className={BOTAO} disabled={ocupado} onClick={() => void solicitarTeste(c.id)}>{ultimo ? "Testar de novo" : "Testar"}</button></div>{ultimo && <details open={ultimo.correto !== true}><summary className="cursor-pointer text-xs font-medium text-panel-sub">Ver resposta do atendente</summary><div className="mt-3 space-y-3"><p className="text-xs text-panel-sub">Cliente: {ultimo.pergunta || "Mídia recebida"}</p>{ultimo.respostas.map((r, i) => <p className="whitespace-pre-wrap text-sm leading-relaxed text-panel-ink" key={i}>{r}</p>)}<div className="flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => void revisar(ultimo.id, c.id, true)}>Resposta correta</button><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => void revisar(ultimo.id, c.id, false)}>Corrigir resposta</button></div></div></details>}</div>; })}</div>
                <p className="text-xs leading-relaxed text-panel-sub">Se mudar as informações, será preciso conferir as respostas novamente.</p>
              </Cartao>

              <Cartao titulo="2. Coloque para atender" descricao="Publicar aplica as informações conferidas. Ativar permite responder no WhatsApp.">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line pb-4"><div><p className="text-sm font-semibold">Informações do atendente</p><p className="mt-1 text-xs text-panel-sub">{publicado ? "Publicadas e prontas para uso" : sujo ? "Salve as alterações para continuar" : bloqueantes.length ? "Conclua as revisões e os testes acima" : "Tudo conferido. Você pode publicar."}</p></div><button type="button" className={PRINCIPAL} disabled={ocupado || sujo || bloqueantes.length > 0 || publicado} onClick={() => void publicar()}>{publicado ? "Publicado" : "Publicar informações"}</button></div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line pb-4"><div><p className="text-sm font-semibold">WhatsApp da empresa</p><p className="mt-1 text-xs text-panel-sub">{tela.conexao.conectado ? "Conectado" : "Conecte o número que seus clientes usam"}</p></div><button type="button" className={BOTAO} disabled={ocupado || sujo} onClick={() => setConectar(true)}>{tela.conexao.conectado ? "Ver conexão" : "Conectar WhatsApp"}</button></div>
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Atendimento automático</p><p className="mt-1 max-w-sm text-xs leading-relaxed text-panel-sub">{pendenciaCadastro ? "Pausado até revisar o cadastro atualizado" : tela.conexao.ligado ? tela.conexao.conectado ? "Ativado nos horários e condições definidos" : "Sem conexão. Não está respondendo pelo WhatsApp." : !publicado ? "Publique as informações antes de ativar" : !tela.conexao.conectado ? "Conecte o WhatsApp antes de ativar" : "Pronto para você ativar"}</p></div><button type="button" className={tela.conexao.ligado ? BOTAO : PRINCIPAL} disabled={ocupado || (!tela.conexao.ligado && (!publicado || !tela.conexao.conectado))} onClick={() => void ligar(!tela.conexao.ligado)}>{tela.conexao.ligado ? "Pausar atendimento" : "Ativar atendimento"}</button></div>
                </div>
                {tela.conexao.ligado && !publicado && !pendenciaCadastro && <p className="rounded-xl bg-amber/10 p-3 text-xs leading-relaxed text-panel-ink">O atendente continua usando as informações publicadas anteriormente até você publicar estas alterações.</p>}
                <button type="button" className="text-xs font-medium text-panel-sub underline underline-offset-4" disabled={ocupado || sujo} onClick={() => void atualizar()}>Atualizar conexão e situação</button>
              </Cartao>
              <details className="rounded-2xl border border-panel-line bg-panel-card p-4"><summary className="cursor-pointer text-sm font-semibold text-panel-ink">Resumo do que seu atendente vai fazer</summary><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-xs text-panel-sub">Empresa</dt><dd className="mt-1 text-panel-ink">{rascunho.negocio.nome || "Nome não informado"}</dd></div><div><dt className="text-xs text-panel-sub">Linguagem</dt><dd className="mt-1 text-panel-ink">{rascunho.atendimento.jeito === "ACOLHEDOR" ? "Acolhedora" : rascunho.atendimento.jeito === "DIRETO" ? "Direta" : "Descontraída"}</dd></div><div><dt className="text-xs text-panel-sub">Quando responde</dt><dd className="mt-1 text-panel-ink">{rascunho.atendimento.quando === "FORA_EXPEDIENTE" ? "Quando a empresa está fechada" : "Quando a empresa está fechada e após cinco minutos sem resposta da equipe durante o expediente"}</dd></div><div><dt className="text-xs text-panel-sub">Agendamentos</dt><dd className="mt-1 text-panel-ink">{rascunho.atendimento.agendamento === "DIRETO" ? "Consulta horários e confirma depois de registrar a reserva" : rascunho.atendimento.agendamento === "LINK" ? "Oferece o link para o cliente concluir" : "Responde dúvidas sem confirmar agendamentos"}</dd></div></dl></details>
            </>}
          </fieldset>
        </PendenciasNexaContext.Provider>

        {mostrarPendencias && passo < 2 && pendenciasPasso.length > 0 && <aside aria-label="O que falta neste passo" className="rounded-2xl border border-amber/40 bg-amber/10 p-4"><h3 className="text-sm font-semibold text-panel-ink">Confira antes de continuar</h3><ul className="mt-3 space-y-2">{pendenciasPasso.map((p, i) => <li key={`${p.campo}-${i}`} className="text-sm leading-relaxed text-panel-ink">{p.mensagem}</li>)}</ul></aside>}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 grid grid-cols-2 items-center gap-2 rounded-2xl border border-panel-line bg-panel-card p-3 shadow-lg sm:bottom-3 sm:flex sm:p-4">
          <button type="button" className={`${BOTAO} order-2 !min-h-9 justify-self-start !py-1.5 sm:order-none sm:!min-h-11`} disabled={ocupado || passo === 0} onClick={() => void navegar((passo - 1) * 2)}>Voltar</button>
          <button type="button" className="order-3 min-h-9 justify-self-end rounded-xl px-2 py-1.5 text-xs font-semibold text-panel-sub hover:bg-panel-bg disabled:opacity-50 sm:order-none sm:ml-auto sm:min-h-11 sm:px-3" disabled={ocupado || !sujo} onClick={() => void salvar()}>{ocupado ? "Salvando…" : "Salvar para depois"}</button>
          {passo < 2 && <button type="button" className={`${PRINCIPAL} order-1 col-span-2 w-full sm:order-none sm:w-auto`} disabled={ocupado} onClick={() => void salvar(true)}>{passo === 0 ? "Continuar para atendimento" : "Continuar para os testes"}<span aria-hidden="true">→</span></button>}
        </div>
      </div>

      <aside ref={testeRef} role={mobileTeste && !telaLarga ? "dialog" : undefined} aria-modal={mobileTeste && !telaLarga ? true : undefined} aria-label="Teste de conversa" className={mobileTeste ? "fixed inset-0 z-[80] flex min-h-0 flex-col bg-panel-bg xl:sticky xl:inset-auto xl:top-5 xl:z-auto xl:block" : "hidden min-w-0 xl:sticky xl:top-5 xl:block"}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-line bg-panel-card px-4 py-3 xl:hidden"><h2 className="font-semibold">Teste do seu atendente</h2><button type="button" className={BOTAO} onClick={() => setMobileTeste(false)}>Voltar à configuração</button></div>
        <div className={mobileTeste ? "min-h-0 flex-1 overflow-y-auto p-3 xl:overflow-visible xl:p-0" : ""}><SimuladorConfiguracaoNexa tela={tela} ocupado={ocupado} sujo={sujo} erro={erro} pedido={pedidoTeste} operar={operar} aplicar={aplicar} corrigir={corrigir} /></div>
      </aside>
    </div>

    {destino !== null && <div ref={saidaRef} role="dialog" aria-modal="true" aria-labelledby="atendente-saida-titulo" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-md space-y-4 rounded-2xl border border-panel-line bg-panel-card p-6"><h2 id="atendente-saida-titulo" className="text-lg font-semibold">Guardar as alterações antes de sair?</h2><p className="text-sm leading-relaxed text-panel-sub">Elas ficam no rascunho para você continuar depois.</p>{erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}<div className="flex flex-wrap gap-2"><button type="button" className={PRINCIPAL} disabled={ocupado} onClick={async () => { const proximo = destino; if (await salvar()) { setDestino(null); void irPara(proximo); } }}>Salvar e continuar</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => { setRascunho(tela.rascunho); const proximo = destino; setDestino(null); void irPara(proximo); }}>Sair sem salvar</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setDestino(null)}>Continuar editando</button></div></div></div>}
    {importacaoAberta && <div ref={importacaoRef} role="dialog" aria-modal="true" aria-labelledby="atendente-importacao-titulo" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-panel-line bg-panel-card p-6"><h2 id="atendente-importacao-titulo" className="text-lg font-semibold">Usar os dados atuais do cadastro?</h2><p className="text-sm leading-relaxed text-panel-sub">Isso substitui o rascunho. Você precisará conferir as informações importadas e testar novamente.</p>{sujo && <p className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm leading-relaxed text-panel-ink">Há alterações não salvas. Para guardá-las primeiro, escolha “Salvar rascunho e voltar”.</p>}<p className="text-xs text-panel-sub">Importar não publica os dados nem ativa o atendimento.</p>{erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{erro}</p>}<div className="flex flex-wrap gap-2">{sujo && <button type="button" className={BOTAO} disabled={ocupado} onClick={async () => { if (await salvar()) setImportacaoAberta(false); }}>Salvar rascunho e voltar</button>}<button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => void importarCadastro()}>Substituir rascunho e importar</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setImportacaoAberta(false)}>Cancelar</button></div></div></div>}
    <ModalConectarWhatsApp aberto={conectar} telefonePadrao={tela.conexao.telefone || metaConta.empresaTelefone} aoFechar={() => setConectar(false)} aoConectar={() => { setConectar(false); void atualizar(); }} />
    <ModalSalvarConta aberto={salvarConta} aoFechar={() => setSalvarConta(false)} nomePadrao={rascunho.negocio.nome} telefonePadrao={metaConta.empresaTelefone} aoSalvarSucesso={() => { setMetaConta({ ...metaConta, isGuest: false }); setAviso("Seu acesso foi salvo."); }} />
  </div>;
}
