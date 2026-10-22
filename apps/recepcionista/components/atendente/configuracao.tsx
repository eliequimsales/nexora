"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";
import { ModalSalvarConta } from "@/components/painel/modal-salvar-conta";
import { CENARIOS_NEXA, type CenarioNexa, type ConfiguracaoNexa, type PendenciaNexa, type TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, PRINCIPAL_NEXA as PRINCIPAL, CampoNexa as Campo, PendenciasNexaContext } from "./configuracao-campos";
import { FormularioConfiguracaoNexa } from "./configuracao-formulario";
import { useConfiguracaoAutosave } from "./configuracao-autosalvar";
import { requisitarConfiguracaoNexa as requisitar, type FalhaConfiguracaoNexa } from "./configuracao-requisicao";
import { SimuladorConfiguracaoNexa, type PedidoTesteNexa } from "./configuracao-simulador";

const SECOES = [
  { titulo: "Empresa", descricao: "Nome, apresentação e onde você atende" },
  { titulo: "Serviços", descricao: "Serviços, horários e pagamento" },
  { titulo: "Atendimento", descricao: "Como seu atendente conversa e age" },
  { titulo: "Perguntas", descricao: "Respostas e regras do negócio" },
] as const;
type MetaConta = { isGuest?: boolean; empresaTelefone?: string; acesso?: string };
type Dialogo = { tipo: "RECARREGAR" | "IMPORTAR" } | { tipo: "SAIR"; href: string };

export function ConfiguracaoDaNexa() {
  const router = useRouter();
  const autosave = useConfiguracaoAutosave({
    salvar: pedido => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "PUT", pedido),
    protegerSaida: false,
  });
  const atual = useRef(autosave); atual.current = autosave;
  const { tela, rascunho, pendente } = autosave;
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [secao, setSecao] = useState(0);
  const [mostrarPendencias, setMostrarPendencias] = useState(false);
  const [mobileTeste, setMobileTeste] = useState(false);
  const [pedidoTeste, setPedidoTeste] = useState<PedidoTesteNexa | null>(null);
  const [conectar, setConectar] = useState(false);
  const [salvarConta, setSalvarConta] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [metaConta, setMetaConta] = useState<MetaConta>({});
  const [conexao, setConexao] = useState<TelaConfiguracaoNexa["conexao"] | null>(null);
  const [assistente, setAssistente] = useState("");
  const emOperacao = useRef(false);
  const versaoStatus = useRef(0);
  const proximoPedido = useRef(0);
  const testeRef = useRef<HTMLElement>(null);
  const focoAntesTeste = useRef<HTMLElement | null>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const secoesRef = useRef<(HTMLButtonElement | null)[]>([]);

  const aplicar = useCallback((nova: TelaConfiguracaoNexa) => {
    atual.current.sincronizar(nova);
    setConexao(nova.conexao);
  }, []);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const nova = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
      if (atual.current.iniciar(nova)) {
        setConexao(nova.conexao);
        setSecao(nova.pendencias.find(p => p.bloqueia && p.etapa < 4 && !p.campo.startsWith("etapa:"))?.etapa ?? 0);
      }
    } catch (falha) { setErro((falha as Error).message); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); void requisitar<MetaConta>("/api/atendente").then(setMetaConta).catch(() => {}); }, [carregar]);
  useEffect(() => {
    const sair = (evento: BeforeUnloadEvent) => { if (atual.current.pendente || emOperacao.current) { evento.preventDefault(); evento.returnValue = ""; } };
    const navegar = (evento: MouseEvent) => {
      if ((!atual.current.pendente && !emOperacao.current) || evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey) return;
      const link = (evento.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#") || link.href === window.location.href) return;
      const url = new URL(link.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      evento.preventDefault(); evento.stopPropagation();
      if (emOperacao.current) return;
      void atual.current.garantirSalvo().then(() => {
        if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);
        else window.location.assign(url.href);
      }).catch(() => setDialogo({ tipo: "SAIR", href: url.href }));
    };
    window.addEventListener("beforeunload", sair); document.addEventListener("click", navegar, true);
    return () => { window.removeEventListener("beforeunload", sair); document.removeEventListener("click", navegar, true); };
  }, [router]);
  useEffect(() => {
    const modal = dialogo ? dialogoRef.current : mobileTeste ? testeRef.current : null;
    if (!modal) return;
    const anterior = !dialogo && mobileTeste ? focoAntesTeste.current : document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const interativos = () => Array.from(modal.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]')).filter(e => e.getClientRects().length > 0);
    (modal.querySelector<HTMLElement>("[data-foco-inicial]") ?? interativos()[0])?.focus();
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !emOperacao.current) { setDialogo(null); setMobileTeste(false); }
      if (evento.key !== "Tab") return;
      const itens = interativos(); const primeiro = itens[0]; const ultimo = itens[itens.length - 1];
      if (!primeiro) { evento.preventDefault(); return; }
      const foraDaOrdem = !itens.includes(document.activeElement as HTMLElement);
      if (evento.shiftKey && (document.activeElement === primeiro || foraDaOrdem)) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && (document.activeElement === ultimo || foraDaOrdem)) { evento.preventDefault(); primeiro.focus(); }
    };
    window.addEventListener("keydown", teclado);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", teclado); anterior?.focus(); };
  }, [!!dialogo, mobileTeste]);
  useEffect(() => {
    const atualizarSemInterromper = async () => {
      if (document.visibilityState !== "visible" || emOperacao.current || atual.current.pendente || !atual.current.tela) return;
      const seq = ++versaoStatus.current;
      try {
        const nova = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
        if (seq === versaoStatus.current && !emOperacao.current) aplicar(nova);
      } catch { /* A atualização não declara desconexão quando uma consulta falha. */ }
    };
    const timer = setInterval(() => void atualizarSemInterromper(), 20000);
    window.addEventListener("focus", atualizarSemInterromper);
    return () => { clearInterval(timer); window.removeEventListener("focus", atualizarSemInterromper); };
  }, [aplicar]);
  useEffect(() => {
    const reconectou = () => {
      if (atual.current.erro && atual.current.erro.status !== 409) void atual.current.tentarNovamente().catch(() => {});
    };
    window.addEventListener("online", reconectou); return () => window.removeEventListener("online", reconectou);
  }, []);

  async function operar<T>(acao: () => Promise<T>, salvarAntes = true): Promise<T | null> {
    if (emOperacao.current) return null;
    emOperacao.current = true; versaoStatus.current++; setOcupado(true); setErro(""); setAviso("");
    try { if (salvarAntes) await atual.current.garantirSalvo(); return await acao(); }
    catch (falha) {
      const e = falha as FalhaConfiguracaoNexa; setErro(e.message); setMostrarPendencias(true);
      const base = atual.current.tela;
      if (e.pendencias && base && !atual.current.pendente) {
        try { aplicar(await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao")); }
        catch { atual.current.sincronizar({ ...base, pendencias: e.pendencias }); }
      }
      return null;
    } finally { emOperacao.current = false; setOcupado(false); }
  }
  function editar<K extends keyof ConfiguracaoNexa>(bloco: K, dados: Partial<ConfiguracaoNexa[K]>) {
    atual.current.editar(c => ({ ...c, [bloco]: { ...c[bloco], ...dados } })); setAviso(""); setErro("");
  }
  function abrirSecao(numero: number) {
    const destino = Math.min(3, Math.max(0, numero));
    setSecao(destino);
    requestAnimationFrame(() => { const alvo = secoesRef.current[destino]; alvo?.focus({ preventScroll: true }); alvo?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
  }
  function abrirPendencia(pendencia: PendenciaNexa) {
    if (pendencia.campo === "cadastro") { setDialogo({ tipo: "IMPORTAR" }); return; }
    setMostrarPendencias(true); abrirSecao(pendencia.etapa);
    requestAnimationFrame(() => {
      const painel = document.getElementById(`secao-atendente-${Math.min(3, Math.max(0, pendencia.etapa))}`);
      const problema = painel?.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
      let detalhe = problema?.closest("details");
      while (detalhe) { detalhe.open = true; detalhe = detalhe.parentElement?.closest("details") ?? null; }
      const alvo = painel?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? problema?.closest("details")?.querySelector<HTMLElement>("summary") ?? painel;
      alvo?.focus({ preventScroll: true }); alvo?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  async function conferirDados(base: TelaConfiguracaoNexa) {
    if ([0, 1, 2, 3].every(i => base.revisadas.includes(i))) return base;
    const nova = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "PUT", { revisao: base.revisao, rascunho: base.rascunho, etapa: base.etapa, concluirEtapas: [0, 1, 2, 3] });
    aplicar(nova); return nova;
  }
  async function prepararTeste() {
    return operar(async () => conferirDados(await atual.current.garantirSalvo()));
  }
  function solicitarTeste(cenario: CenarioNexa) {
    if (emOperacao.current) return;
    if (!mobileTeste) focoAntesTeste.current = document.activeElement as HTMLElement | null;
    setMobileTeste(true); setPedidoTeste({ cenario, seq: ++proximoPedido.current });
  }
  function corrigir(cenario: CenarioNexa) {
    setMobileTeste(false); setMostrarPendencias(true);
    abrirSecao(cenario === "HUMANO" ? 2 : cenario === "DESCONHECIDA" || cenario === "CANCELAMENTO" ? 3 : 1);
    setAviso("Ajuste a informação. Ela será salva automaticamente para você testar novamente.");
  }
  async function preencher() {
    if (!assistente.trim()) return;
    const resultado = await operar(async () => {
      const base = await atual.current.garantirSalvo();
      return requisitar<{ tela: TelaConfiguracaoNexa; mensagem: string }>("/api/atendente/preencher", "POST", { revisao: base.revisao, mensagem: assistente.trim() });
    });
    if (resultado) { aplicar(resultado.tela); setAssistente(""); setAviso(resultado.mensagem); }
  }
  async function atualizar() {
    const nova = await operar(() => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao"), false);
    if (nova) aplicar(nova);
  }
  async function ativar() {
    const nova = await operar(async () => {
      let base = await conferirDados(await atual.current.garantirSalvo());
      if (base.pendencias.some(p => p.bloqueia)) throw Object.assign(new Error("Confira as informações e as respostas indicadas antes de ativar."), { pendencias: base.pendencias });
      if (!base.conexao.conectado) throw new Error("Conecte o WhatsApp da empresa antes de ativar.");
      if (base.haAlteracoes || !base.publicadoEm) {
        base = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "PUBLICAR", revisao: base.revisao });
        aplicar(base);
      }
      await requisitar("/api/atendente/ligar", "POST", { ligar: true });
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
    });
    if (nova) { aplicar(nova); setAviso("Atendente ativado. Ele responde conforme os horários e as regras que você definiu."); }
  }
  async function pausar() {
    const nova = await operar(async () => {
      await requisitar("/api/atendente/ligar", "POST", { ligar: false });
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
    }, false);
    if (nova) { aplicar(nova); setAviso("Atendimento pausado. Suas configurações continuam guardadas."); }
  }
  async function resolverDialogo() {
    if (!dialogo) return;
    if (dialogo.tipo === "SAIR") {
      const salvo = atual.current.tela;
      if (!salvo || !atual.current.descartarAlteracoes(salvo)) return;
      const url = new URL(dialogo.href); setDialogo(null);
      if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`); else window.location.assign(url.href);
      return;
    }
    const tipo = dialogo.tipo;
    const nova = await operar(async () => {
      if (tipo === "IMPORTAR") {
        const base = await atual.current.garantirSalvo();
        return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "IMPORTAR_CADASTRO", revisao: base.revisao });
      }
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
    }, tipo === "IMPORTAR");
    if (nova && atual.current.descartarAlteracoes(nova)) { setConexao(nova.conexao); setDialogo(null); setMostrarPendencias(false); abrirSecao(0); setAviso(tipo === "IMPORTAR" ? "Dados importados. Confira as informações antes de testar e ativar." : "Configuração recarregada."); }
  }

  if (!tela || !rascunho) return <div className="mx-auto max-w-4xl space-y-5 py-4"><h1 className="font-display text-3xl text-panel-ink">Seu atendente</h1>{carregando ? <p role="status" className="rounded-2xl border border-panel-line bg-panel-card p-8 text-panel-sub">Abrindo a configuração…</p> : <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-6 text-sm text-red-800"><p>{erro || "Não foi possível abrir a configuração."}</p><button type="button" className={`${BOTAO} mt-4`} onClick={() => void carregar()}>Tentar novamente</button></div>}</div>;

  const canal = conexao ?? tela.conexao;
  const pendenciaCadastro = tela.pendencias.find(p => p.campo === "cadastro");
  const faltasDados = tela.pendencias.filter(p => p.bloqueia && (p.etapa < 4 || p.campo === "cadastro") && !p.campo.startsWith("etapa:"));
  const precisaAgenda = rascunho.negocio.objetivo === "AGENDAMENTOS" || rascunho.atendimento.agendamento !== "DESLIGADO";
  const obrigatorios = CENARIOS_NEXA.filter(c => ["INFORMACOES", "HUMANO", "DESCONHECIDA", ...(precisaAgenda ? ["HORARIO"] : [])].includes(c.id));
  const atuais = pendente ? [] : tela.testes.filter(t => t.revisao === tela.revisao);
  const ultimoTeste = (cenario: CenarioNexa) => [...atuais].reverse().find(t => t.cenario === cenario);
  const aprovados = obrigatorios.filter(c => ultimoTeste(c.id)?.correto === true).length;
  const proximoTeste = obrigatorios.find(c => ultimoTeste(c.id)?.correto !== true) ?? obrigatorios[0];
  const pronto = !pendente && !tela.pendencias.some(p => p.bloqueia);
  const publicado = !!tela.publicadoEm && !tela.haAlteracoes && !pendente;
  const mensagemErro = erro || autosave.erro?.message;

  const primeiraFalta = faltasDados[0];
  const faltamTestes = aprovados < obrigatorios.length;
  const conferirEstado = !primeiraFalta && !faltamTestes && canal.conectado && !pronto;
  const emAtendimento = canal.ligado && canal.conectado && !pendenciaCadastro;
  const tituloAcao = primeiraFalta ? "Complete esta informação" : faltamTestes ? "Confira as respostas do seu atendente" : !canal.conectado ? "Conecte o WhatsApp para começar" : conferirEstado ? "Confira a configuração atual" : canal.ligado && publicado ? "Seu atendente está em funcionamento" : "Tudo pronto para atender";
  const descricaoAcao = primeiraFalta ? primeiraFalta.mensagem : faltamTestes ? `${aprovados} de ${obrigatorios.length} respostas conferidas por você.` : !canal.conectado ? "Use o número em que seus clientes falam com a empresa." : conferirEstado ? "Os dados mudaram. Atualize a tela antes de continuar." : canal.ligado && publicado ? "Ele segue os horários e as regras que você definiu." : "Ao ativar, ele passa a usar as informações que você conferiu.";
  const textoAcao = primeiraFalta ? primeiraFalta.campo === "cadastro" ? "Revisar cadastro" : `Completar ${SECOES[Math.min(3, Math.max(0, primeiraFalta.etapa))].titulo.toLocaleLowerCase("pt-BR")}` : faltamTestes ? aprovados ? "Continuar testes" : "Conferir respostas" : !canal.conectado ? "Conectar WhatsApp" : conferirEstado ? "Atualizar configuração" : canal.ligado && publicado ? "Atendente ativado" : canal.ligado ? "Aplicar alterações" : "Ativar atendente";
  const executarProximaAcao = () => {
    if (primeiraFalta) abrirPendencia(primeiraFalta);
    else if (faltamTestes) solicitarTeste(proximoTeste.id);
    else if (!canal.conectado) setConectar(true);
    else if (conferirEstado) void atualizar();
    else void ativar();
  };

  return <div className="mx-auto max-w-4xl space-y-5 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
      <div><h1 className="font-display text-2xl text-panel-ink sm:text-3xl">Seu atendente</h1><p className="mt-1 text-sm text-panel-sub">Ensine como a sua empresa atende.</p></div>
      <div className="flex shrink-0 flex-col-reverse items-end gap-2">
        <p role="status" aria-live="polite" className={`flex items-center gap-2 text-xs ${autosave.estado === "erro" ? "text-red-700" : "text-panel-sub"}`}><span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${autosave.estado === "erro" ? "bg-red-500" : pendente ? "bg-amber" : "bg-emerald-500"}`} />{autosave.estado === "erro" ? "Não salvo" : pendente ? "Salvando…" : "Tudo salvo"}</p>
        <button type="button" aria-label="Testar atendente" className={BOTAO} disabled={ocupado} onClick={() => solicitarTeste(proximoTeste.id)}>Testar</button>
      </div>
    </header>

    <section aria-label="WhatsApp da empresa" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-panel-line bg-panel-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${canal.conectado ? "bg-emerald-500" : "bg-panel-sub/40"}`} /><div><h2 className="text-sm font-semibold text-panel-ink">WhatsApp da empresa</h2><p className="mt-0.5 text-xs text-panel-sub">{!canal.conectado ? canal.ligado ? "Sem conexão · atendimento interrompido" : "Ainda não conectado" : pendenciaCadastro ? "Conectado · revise o cadastro" : emAtendimento ? "Conectado · atendente ativado" : tela.publicadoEm ? "Conectado · atendimento desativado" : "Conectado · aguardando ativação"}</p></div></div>
      <div className="flex flex-wrap items-center gap-2">{canal.ligado && <button type="button" className="min-h-10 rounded-lg px-3 text-xs font-medium text-panel-sub hover:bg-panel-bg disabled:opacity-50" disabled={ocupado} onClick={() => void pausar()}>Pausar atendente</button>}<button type="button" aria-label={canal.conectado ? "Ver conexão" : "Conectar WhatsApp"} className={`${BOTAO} !px-3 ${!canal.conectado ? "!border-emerald-600/30 !text-emerald-800" : ""}`} disabled={ocupado} onClick={() => setConectar(true)}><span className="sm:hidden">{canal.conectado ? "Ver conexão" : "Conectar"}</span><span className="hidden sm:inline">{canal.conectado ? "Ver conexão" : "Conectar WhatsApp"}</span></button></div>
    </section>

    {metaConta.isGuest && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-panel-sub"><p>Guarde seu acesso para continuar depois.</p><button type="button" className="min-h-10 font-semibold text-panel-ink underline underline-offset-4" onClick={() => setSalvarConta(true)}>Salvar meu acesso</button></div>}
    {metaConta.acesso === "SEMANA_ACABOU" && <p className="text-sm text-panel-sub">Você pode configurar e testar. Para ativar, <Link href="/painel/assinatura" className="font-semibold text-panel-ink underline">consulte seu plano</Link>.</p>}
    {mensagemErro && <div role="alert" className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><p>{mensagemErro}</p><p className="text-xs">Mantenha esta tela aberta até salvar suas alterações.</p><div className="flex flex-wrap gap-2">{autosave.erro && autosave.erro.status !== 409 && <button type="button" className={BOTAO} disabled={ocupado} onClick={() => void operar(async () => { await atual.current.tentarNovamente(); setErro(""); return true; }, false)}>Tentar salvar novamente</button>}<button type="button" className={BOTAO} disabled={ocupado || autosave.estado === "salvando"} onClick={() => setDialogo({ tipo: "RECARREGAR" })}>Recarregar dados</button></div></div>}
    {aviso && <p role="status" className="text-sm leading-relaxed text-emerald-800">{aviso}</p>}

    <div className="overflow-hidden rounded-2xl border border-panel-line bg-panel-card">
      <div role="tablist" aria-label="Configuração do atendente" className="grid grid-cols-4 border-b border-panel-line px-1 sm:px-5">
        {SECOES.map((s, i) => <button ref={el => { secoesRef.current[i] = el; }} id={`aba-atendente-${i}`} key={s.titulo} type="button" role="tab" aria-selected={secao === i} aria-controls={`secao-atendente-${i}`} tabIndex={secao === i ? 0 : -1} disabled={ocupado} onClick={() => setSecao(i)} onKeyDown={e => {
          const destino = e.key === "ArrowRight" ? (i + 1) % 4 : e.key === "ArrowLeft" ? (i + 3) % 4 : e.key === "Home" ? 0 : e.key === "End" ? 3 : null;
          if (destino !== null) { e.preventDefault(); abrirSecao(destino); }
        }} className={`relative min-h-14 min-w-0 px-1 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber disabled:opacity-50 sm:px-3 sm:text-sm ${secao === i ? "text-panel-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-amber sm:after:inset-x-5" : "text-panel-sub hover:text-panel-ink"}`}>{s.titulo}{faltasDados.some(p => p.etapa === i && p.campo !== "cadastro") && <span className="ml-1 inline-block h-1 w-1 rounded-full bg-amber align-middle" aria-label="Informação pendente" />}</button>)}
      </div>
      <PendenciasNexaContext.Provider value={mostrarPendencias ? tela.pendencias : []}>
        {SECOES.map((s, i) => <div key={s.titulo} role="tabpanel" id={`secao-atendente-${i}`} aria-labelledby={`aba-atendente-${i}`} tabIndex={-1} hidden={secao !== i} className="min-w-0 px-4 py-5 outline-none sm:px-7 sm:py-6"><fieldset disabled={ocupado} className="min-w-0 space-y-6"><legend className="sr-only">{s.descricao}</legend><FormularioConfiguracaoNexa etapa={i} dados={rascunho} editar={editar} />{i === 0 && <details className="border-t border-panel-line pt-4"><summary className="min-h-7 cursor-pointer text-xs font-medium text-panel-sub">Já tem um texto sobre a empresa?</summary><div className="mt-3 space-y-3"><p className="text-xs text-panel-sub">Cole aqui. Nós organizamos uma proposta para você conferir.</p><Campo titulo="Texto sobre a empresa"><textarea rows={4} maxLength={6000} className={CAMPO} value={assistente} onChange={e => setAssistente(e.target.value)} placeholder="Descreva seus serviços, preços e como funciona o atendimento…" /></Campo><button type="button" className={BOTAO} disabled={ocupado || !assistente.trim()} onClick={() => void preencher()}>Organizar informações</button></div></details>}</fieldset></div>)}
      </PendenciasNexaContext.Provider>

      <section aria-label="Próximo passo" className="border-t border-panel-line bg-panel-bg/40 px-4 py-4 sm:px-7 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0 flex-1 basis-56"><h2 className="text-sm font-semibold text-panel-ink">{tituloAcao}</h2><p className="mt-1 text-xs leading-relaxed text-panel-sub">{descricaoAcao}</p></div><button type="button" className={`${PRINCIPAL} w-full sm:w-auto`} disabled={ocupado || !primeiraFalta && !faltamTestes && canal.conectado && !conferirEstado && (pendente || !pronto || canal.ligado && publicado)} onClick={executarProximaAcao}>{textoAcao}</button></div>
        {faltasDados.length > 1 && <details className="mt-3"><summary className="min-h-7 cursor-pointer text-xs text-panel-sub">Ver o que falta ({faltasDados.length})</summary><ul className="mt-2 space-y-1">{faltasDados.map((p, i) => <li key={`${p.campo}-${i}`}><button type="button" disabled={ocupado} className="min-h-9 text-left text-xs text-panel-ink underline underline-offset-4 disabled:opacity-50" onClick={() => abrirPendencia(p)}>{p.mensagem}</button></li>)}</ul></details>}
        {canal.ligado && !publicado && <p className="mt-3 text-xs leading-relaxed text-panel-sub">O atendimento continua com a versão anterior até você aplicar as alterações.</p>}
        {!canal.ligado && !canal.conectado && <p className="mt-3 text-xs text-panel-sub">Conectar o WhatsApp não ativa o atendimento.</p>}
      </section>
    </div>

    <div hidden={!mobileTeste} className="fixed inset-0 z-[80] bg-black/40 sm:flex sm:items-center sm:justify-center sm:p-6" style={!mobileTeste ? { display: "none" } : undefined}>
      <aside ref={testeRef} role="dialog" aria-modal="true" aria-labelledby="titulo-teste-atendente" className="flex h-full min-h-0 w-full flex-col bg-panel-card shadow-xl sm:max-h-[90dvh] sm:max-w-xl sm:overflow-hidden sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-line px-4 py-3 sm:px-5"><div><h2 id="titulo-teste-atendente" data-foco-inicial tabIndex={-1} className="font-semibold text-panel-ink outline-none">Teste do atendente</h2><p className="mt-1 text-xs text-panel-sub">{aprovados} de {obrigatorios.length} respostas conferidas</p></div><button type="button" className={BOTAO} onClick={() => setMobileTeste(false)}>Voltar à configuração</button></header>
        <div className="min-h-0 flex-1 overflow-y-auto"><SimuladorConfiguracaoNexa tela={tela} ocupado={ocupado} sujo={pendente} erro={mensagemErro || ""} pedido={pedidoTeste} operar={operar} prepararTeste={prepararTeste} aplicar={aplicar} corrigir={corrigir} proximoCenario={faltamTestes ? proximoTeste.id : null} concluirTeste={() => setMobileTeste(false)} /></div>
      </aside>
    </div>

    {dialogo && <div ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby="confirmar-dados-atendente" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-panel-line bg-panel-card p-6"><h2 id="confirmar-dados-atendente" className="text-lg font-semibold text-panel-ink">{dialogo.tipo === "SAIR" ? "Sair sem guardar as alterações?" : dialogo.tipo === "IMPORTAR" ? "Usar o cadastro atualizado?" : "Recarregar a configuração?"}</h2><p className="text-sm leading-relaxed text-panel-sub">{dialogo.tipo === "SAIR" ? "Não conseguimos salvar. Se sair agora, as alterações que só estão nesta tela serão descartadas." : dialogo.tipo === "IMPORTAR" ? "O rascunho será substituído pelos dados do cadastro. Você precisará conferir as informações e testar novamente." : "Alterações ainda não salvas nesta tela serão descartadas. Os dados serão carregados novamente do servidor."}</p><div className="flex flex-wrap gap-2"><button type="button" className={PRINCIPAL} disabled={ocupado || autosave.estado === "salvando"} onClick={() => void resolverDialogo()}>{dialogo.tipo === "SAIR" ? "Descartar e sair" : dialogo.tipo === "IMPORTAR" ? "Importar e revisar" : "Recarregar e descartar alterações locais"}</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setDialogo(null)}>Continuar aqui</button></div>{erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}</div></div>}
    <ModalConectarWhatsApp aberto={conectar} telefonePadrao={canal.telefone || metaConta.empresaTelefone} aoFechar={() => setConectar(false)} aoConectar={() => { setConectar(false); void atualizar(); }} />
    <ModalSalvarConta aberto={salvarConta} aoFechar={() => setSalvarConta(false)} nomePadrao={rascunho.negocio.nome} telefonePadrao={metaConta.empresaTelefone} aoSalvarSucesso={() => { setMetaConta(m => ({ ...m, isGuest: false })); setAviso("Seu acesso foi salvo."); }} />
  </div>;
}
