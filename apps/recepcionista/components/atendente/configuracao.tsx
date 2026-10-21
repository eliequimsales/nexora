"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";
import { ModalSalvarConta } from "@/components/painel/modal-salvar-conta";
import { CENARIOS_NEXA, type CenarioNexa, type ConfiguracaoNexa, type TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { BOTAO_NEXA as BOTAO, CAMPO_NEXA as CAMPO, PRINCIPAL_NEXA as PRINCIPAL, CampoNexa as Campo, PendenciasNexaContext } from "./configuracao-campos";
import { FormularioConfiguracaoNexa } from "./configuracao-formulario";
import { useConfiguracaoAutosave } from "./configuracao-autosalvar";
import { requisitarConfiguracaoNexa as requisitar, type FalhaConfiguracaoNexa } from "./configuracao-requisicao";
import { SimuladorConfiguracaoNexa, type PedidoTesteNexa } from "./configuracao-simulador";

const SECOES = [
  { titulo: "Sua empresa", descricao: "Nome, apresentação e onde você atende" },
  { titulo: "Serviços, horários e pagamento", descricao: "O que oferece e como funciona" },
  { titulo: "Como atender", descricao: "Linguagem, agendamentos e ajuda da equipe" },
  { titulo: "Perguntas e regras", descricao: "Respostas específicas do seu negócio" },
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
  const [secao, setSecao] = useState<number | null>(0);
  const [mostrarPendencias, setMostrarPendencias] = useState(false);
  const [mobileTeste, setMobileTeste] = useState(false);
  const [telaLarga, setTelaLarga] = useState(false);
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
  const dialogoRef = useRef<HTMLDivElement>(null);
  const secoesRef = useRef<(HTMLButtonElement | null)[]>([]);
  const revisaoRef = useRef<HTMLElement>(null);

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
    const media = window.matchMedia("(min-width: 1280px)");
    const mudar = () => setTelaLarga(media.matches); mudar();
    media.addEventListener("change", mudar); return () => media.removeEventListener("change", mudar);
  }, []);
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
    const modal = dialogo ? dialogoRef.current : mobileTeste && !telaLarga ? testeRef.current : null;
    if (!modal) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const interativos = () => Array.from(modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')).filter(e => e.getClientRects().length > 0);
    interativos()[0]?.focus();
    const teclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !emOperacao.current) { setDialogo(null); setMobileTeste(false); }
      if (evento.key !== "Tab") return;
      const itens = interativos(); const primeiro = itens[0]; const ultimo = itens[itens.length - 1];
      if (!primeiro) { evento.preventDefault(); return; }
      if (evento.shiftKey && (document.activeElement === primeiro || !modal.contains(document.activeElement))) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && (document.activeElement === ultimo || !modal.contains(document.activeElement))) { evento.preventDefault(); primeiro.focus(); }
    };
    window.addEventListener("keydown", teclado);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", teclado); anterior?.focus(); };
  }, [!!dialogo, mobileTeste, telaLarga]);
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
      if (e.pendencias && base && !atual.current.pendente) atual.current.sincronizar({ ...base, pendencias: e.pendencias });
      return null;
    } finally { emOperacao.current = false; setOcupado(false); }
  }
  function editar<K extends keyof ConfiguracaoNexa>(bloco: K, dados: Partial<ConfiguracaoNexa[K]>) {
    atual.current.editar(c => ({ ...c, [bloco]: { ...c[bloco], ...dados } })); setAviso(""); setErro("");
  }
  function abrirSecao(numero: number) {
    const destino = Math.min(3, Math.max(0, numero));
    setSecao(destino);
    requestAnimationFrame(() => { const alvo = secoesRef.current[destino]; alvo?.focus({ preventScroll: true }); alvo?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
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
    setMobileTeste(true); setPedidoTeste({ cenario, seq: ++proximoPedido.current });
  }
  function corrigir(cenario: CenarioNexa) {
    setMobileTeste(false); setMostrarPendencias(true);
    abrirSecao(cenario === "HUMANO" ? 2 : cenario === "DESCONHECIDA" || cenario === "CANCELAMENTO" ? 3 : 1);
    setAviso("Ajuste a informação. Ela será salva automaticamente para você testar novamente.");
  }
  async function revisar(testeId: string, cenario: CenarioNexa, correto: boolean) {
    const nova = await operar(async () => {
      const base = await atual.current.garantirSalvo();
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "REVISAR_TESTE", revisao: base.revisao, testeId, correto });
    });
    if (nova) { aplicar(nova); if (correto) setAviso("Resposta conferida."); else corrigir(cenario); }
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
  const faltasDados = tela.pendencias.filter(p => p.bloqueia && !p.campo.startsWith("etapa:") && !p.campo.startsWith("teste:"));
  const precisaAgenda = rascunho.negocio.objetivo === "AGENDAMENTOS" || rascunho.atendimento.agendamento !== "DESLIGADO";
  const obrigatorios = CENARIOS_NEXA.filter(c => ["INFORMACOES", "HUMANO", "DESCONHECIDA", ...(precisaAgenda ? ["HORARIO"] : [])].includes(c.id));
  const atuais = pendente ? [] : tela.testes.filter(t => t.revisao === tela.revisao);
  const ultimoTeste = (cenario: CenarioNexa) => [...atuais].reverse().find(t => t.cenario === cenario);
  const aprovados = obrigatorios.filter(c => ultimoTeste(c.id)?.correto === true).length;
  const proximoTeste = obrigatorios.find(c => ultimoTeste(c.id)?.correto !== true) ?? obrigatorios[0];
  const pronto = !pendente && !tela.pendencias.some(p => p.bloqueia);
  const publicado = !!tela.publicadoEm && !tela.haAlteracoes && !pendente;
  const mensagemErro = erro || autosave.erro?.message;
  const resumo = [rascunho.negocio.nome || "Apresente sua empresa", `${rascunho.informacoes.servicos.length} itens · ${rascunho.informacoes.horariosSituacao === "CONFIRMADO" ? "horários informados" : "definir horários"}`, `${rascunho.atendimento.jeito === "ACOLHEDOR" ? "Acolhedor" : rascunho.atendimento.jeito === "DIRETO" ? "Direto" : "Descontraído"} · ${rascunho.atendimento.agendamento === "DESLIGADO" ? "sem agendar" : "com agendamento"}`, rascunho.conhecimento.itens.length ? `${rascunho.conhecimento.itens.length} ${rascunho.conhecimento.itens.length === 1 ? "resposta cadastrada" : "respostas cadastradas"}` : "Inclua as dúvidas mais comuns"];

  return <div className="space-y-5 pb-8">
    <header><h1 className="font-display text-2xl text-panel-ink sm:text-3xl">Seu atendente</h1><p className="mt-1 text-sm text-panel-sub">Configure sua empresa, teste as respostas e conecte o WhatsApp.</p></header>
    <div className="sticky top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border border-panel-line bg-panel-card px-4 py-3 shadow-sm">
      <p role="status" aria-live="polite" className={`flex min-w-0 items-center gap-2 text-xs font-medium ${autosave.estado === "erro" ? "text-red-700" : "text-panel-sub"}`}><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${autosave.estado === "erro" ? "bg-red-500" : pendente ? "bg-amber" : "bg-emerald-500"}`} />{autosave.estado === "erro" ? "Alterações ainda não salvas" : pendente ? "Salvando automaticamente…" : "Tudo salvo"}</p>
      <button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => solicitarTeste(proximoTeste.id)}>Testar atendente</button>
    </div>
    {metaConta.isGuest && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4"><p className="text-xs text-panel-sub">Guarde seu acesso para continuar depois.</p><button type="button" className={BOTAO} onClick={() => setSalvarConta(true)}>Salvar meu acesso</button></div>}
    {metaConta.acesso === "SEMANA_ACABOU" && <p className="rounded-xl border border-panel-line bg-panel-card p-4 text-sm text-panel-sub">Você pode configurar e testar. Para ativar o atendimento, <Link href="/painel/assinatura" className="font-semibold text-panel-ink underline">consulte seu plano</Link>.</p>}

    <section aria-labelledby="whatsapp-empresa" className="overflow-hidden rounded-2xl border border-emerald-600/25 bg-panel-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-emerald-500/5 p-4 sm:p-5"><div className="flex items-start gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">↗</span><div><h2 id="whatsapp-empresa" className="font-semibold text-panel-ink">WhatsApp da empresa</h2><p className="mt-1 max-w-xl text-sm leading-relaxed text-panel-sub">{canal.conectado ? "Conectado. É por aqui que seu atendente responde aos clientes." : "Conecte o número em que seus clientes já falam com você."}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${canal.conectado ? "bg-emerald-500/15 text-emerald-800" : "bg-panel-bg text-panel-sub"}`}>{canal.conectado ? "WhatsApp conectado" : "WhatsApp não conectado"}</span></div></div><button type="button" className={canal.conectado ? BOTAO : "inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"} disabled={ocupado} onClick={() => setConectar(true)}>{canal.conectado ? "Conferir conexão" : "Conectar WhatsApp"}</button></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-line p-4 sm:px-5"><div><p className="text-sm font-semibold text-panel-ink">{pendenciaCadastro ? "Cadastro precisa de revisão" : canal.ligado && canal.conectado ? "Atendente ativado" : canal.ligado ? "Atendente sem conexão" : "Atendente ainda não ativado"}</p><p className="mt-1 max-w-2xl text-xs leading-relaxed text-panel-sub">{pendenciaCadastro ? "As respostas automáticas aguardam a revisão das informações alteradas em outra tela." : canal.ligado && !canal.conectado ? "Reconecte o WhatsApp para voltar a responder." : canal.ligado && !publicado ? "Usa as informações publicadas anteriormente até você aplicar as alterações." : canal.ligado ? "Responde nos horários e condições que você definiu." : "Conectar o número não ativa respostas. Confira as informações e os testes abaixo."}</p></div>{canal.ligado && <button type="button" className={BOTAO} disabled={ocupado} onClick={() => void pausar()}>Pausar atendente</button>}</div>
    </section>

    {mensagemErro && <div role="alert" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"><p>{mensagemErro}</p><p className="text-xs">Suas alterações continuam nesta tela.</p><div className="flex flex-wrap gap-2">{autosave.erro && autosave.erro.status !== 409 && <button type="button" className={BOTAO} disabled={ocupado} onClick={() => void operar(async () => { await atual.current.tentarNovamente(); setErro(""); return true; }, false)}>Tentar salvar novamente</button>}<button type="button" className={BOTAO} disabled={ocupado || autosave.estado === "salvando"} onClick={() => setDialogo({ tipo: "RECARREGAR" })}>Recarregar dados</button></div></div>}
    {aviso && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">{aviso}</p>}
    {pendenciaCadastro && <aside className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 p-4"><p className="max-w-2xl text-sm text-panel-sub">O cadastro foi atualizado em outra tela. Importe os dados atuais para conferir antes de ativar.</p><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setDialogo({ tipo: "IMPORTAR" })}>Revisar cadastro atual</button></aside>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0 space-y-4">
        <PendenciasNexaContext.Provider value={mostrarPendencias ? tela.pendencias : []}>
          {SECOES.map((s, i) => { const faltas = faltasDados.filter(p => p.etapa === i); return <section key={s.titulo} aria-label={s.titulo} className="min-w-0"><button ref={el => { secoesRef.current[i] = el; }} type="button" aria-expanded={secao === i} aria-controls={`secao-atendente-${i}`} disabled={ocupado} onClick={() => secao === i ? setSecao(null) : abrirSecao(i)} className={`flex w-full scroll-mt-24 items-center justify-between gap-3 rounded-2xl border bg-panel-card p-4 text-left transition sm:p-5 ${secao === i ? "border-amber/70" : "border-panel-line hover:border-amber/40"}`}><span className="min-w-0"><span className="block text-sm font-semibold text-panel-ink sm:text-base">{s.titulo}</span><span className="mt-1 block text-xs leading-relaxed text-panel-sub">{resumo[i] || s.descricao}</span></span><span className="flex shrink-0 items-center gap-2">{faltas.length > 0 && <span className="rounded-full bg-amber/15 px-2 py-1 text-xs text-panel-ink">Conferir</span>}<span aria-hidden="true" className="text-lg text-panel-sub">{secao === i ? "−" : "+"}</span></span></button><div id={`secao-atendente-${i}`} hidden={secao !== i} className="mt-3 space-y-4"><fieldset disabled={ocupado} className="min-w-0 space-y-4"><legend className="sr-only">Configuração: {s.titulo}</legend><FormularioConfiguracaoNexa etapa={i} dados={rascunho} editar={editar} />{i === 0 && <details className="rounded-xl border border-panel-line bg-panel-card p-4"><summary className="cursor-pointer text-sm font-medium text-panel-ink">Prefere colar um texto sobre a empresa?</summary><div className="mt-4 space-y-3"><p className="text-xs leading-relaxed text-panel-sub">Organizamos uma proposta. Você confere as informações antes de usar.</p><Campo titulo="Texto sobre a empresa" dica="Não inclua senhas nem dados de clientes."><textarea rows={4} maxLength={6000} className={CAMPO} value={assistente} onChange={e => setAssistente(e.target.value)} placeholder={"Endereço: Rua das Flores, 10\nCorte R$ 50 — 40 minutos\nAceitamos Pix e cartão\nSeg a sex das 9h às 18h"} /></Campo><button type="button" className={BOTAO} disabled={ocupado || !assistente.trim()} onClick={() => void preencher()}>Organizar informações</button></div></details>}</fieldset></div></section>; })}
        </PendenciasNexaContext.Provider>

        <section ref={revisaoRef} aria-labelledby="conferir-atendente" className="scroll-mt-24 space-y-4 rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5">
          <div><h2 id="conferir-atendente" className="font-semibold text-panel-ink">Pronto para atender?</h2><p className="mt-1 text-sm text-panel-sub">Confira as respostas com seus dados antes de começar.</p></div>
          {faltasDados.length > 0 && <div className="space-y-2 rounded-xl bg-amber/10 p-3"><p className="text-xs font-semibold text-panel-ink">O que falta nas informações</p>{faltasDados.map((p, i) => <button key={`${p.campo}-${i}`} type="button" disabled={ocupado} className="flex w-full items-start justify-between gap-3 py-1 text-left text-xs leading-relaxed text-panel-ink underline-offset-4 hover:underline" onClick={() => { setMostrarPendencias(true); p.campo === "cadastro" ? setDialogo({ tipo: "IMPORTAR" }) : abrirSecao(p.etapa); }}><span>{p.mensagem}</span><span aria-hidden="true">→</span></button>)}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-panel-sub">{aprovados} de {obrigatorios.length} respostas conferidas</p><button type="button" className={BOTAO} disabled={ocupado} onClick={() => solicitarTeste(proximoTeste.id)}>{aprovados === obrigatorios.length ? "Testar de novo" : "Testar próxima resposta"}</button></div>
          <div className="space-y-2">{obrigatorios.map(c => { const ultimo = ultimoTeste(c.id); return <div key={c.id} className="rounded-xl border border-panel-line p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-panel-ink">{c.titulo}</p><p className="mt-1 text-xs text-panel-sub">{ultimo?.correto === true ? "Conferida por você" : ultimo?.correto === false ? "Precisa de ajuste" : ultimo ? "Confira a resposta" : "Aguardando teste"}</p></div><button type="button" className="min-h-10 rounded-lg px-3 py-2 text-xs font-semibold text-panel-ink hover:bg-panel-bg disabled:opacity-50" disabled={ocupado} onClick={() => solicitarTeste(c.id)}>Testar</button></div>{ultimo && <details open={ultimo.correto !== true} className="mt-3"><summary className="cursor-pointer text-xs text-panel-sub">Ver resposta</summary><div className="mt-3 space-y-3">{ultimo.respostas.map((r, n) => <p key={n} className="whitespace-pre-wrap text-sm leading-relaxed text-panel-ink">{r}</p>)}<div className="flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado || pendente} onClick={() => void revisar(ultimo.id, c.id, true)}>Resposta correta</button><button type="button" className={BOTAO} disabled={ocupado || pendente} onClick={() => void revisar(ultimo.id, c.id, false)}>Corrigir informação</button></div></div></details>}</div>; })}</div>
          <div className="space-y-3 border-t border-panel-line pt-4"><p className="text-xs leading-relaxed text-panel-sub">{pendente ? "Terminando de guardar suas alterações. Você já pode pedir um teste." : !canal.conectado ? "Conecte o WhatsApp no início desta página para começar a atender." : !pronto ? "Complete os itens indicados e confirme as respostas dos testes." : canal.ligado && publicado ? "Seu atendente está usando as informações conferidas." : "Tudo conferido. Ao ativar, essas informações passam a ser usadas no atendimento."}</p>{!canal.conectado ? <button type="button" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" disabled={ocupado} onClick={() => setConectar(true)}>Conectar WhatsApp para atender</button> : <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || !pronto || canal.ligado && publicado} onClick={() => void ativar()}>{canal.ligado && publicado ? "Atendente ativado" : canal.ligado ? "Aplicar alterações no atendimento" : "Ativar atendente"}</button>}<p className="text-xs leading-relaxed text-panel-sub">As alterações são salvas automaticamente para os testes. O atendimento real só muda quando você aplica a configuração conferida.</p></div>
        </section>
      </div>

      <aside ref={testeRef} role={mobileTeste && !telaLarga ? "dialog" : undefined} aria-modal={mobileTeste && !telaLarga ? true : undefined} aria-label="Teste do atendente" className={mobileTeste ? "fixed inset-0 z-[80] flex min-h-0 flex-col bg-panel-bg xl:sticky xl:inset-auto xl:top-24 xl:z-auto xl:block" : "hidden min-w-0 xl:sticky xl:top-24 xl:block"}><div className="flex shrink-0 items-center justify-between gap-3 border-b border-panel-line bg-panel-card px-4 py-3 xl:hidden"><h2 className="font-semibold">Teste do atendente</h2><button type="button" className={BOTAO} onClick={() => setMobileTeste(false)}>Voltar à configuração</button></div><div className={mobileTeste ? "min-h-0 flex-1 overflow-y-auto p-3 xl:overflow-visible xl:p-0" : ""}><SimuladorConfiguracaoNexa tela={tela} ocupado={ocupado} sujo={pendente} erro={mensagemErro || ""} pedido={pedidoTeste} operar={operar} prepararTeste={prepararTeste} aplicar={aplicar} corrigir={corrigir} /></div></aside>
    </div>

    {dialogo && <div ref={dialogoRef} role="dialog" aria-modal="true" aria-labelledby="confirmar-dados-atendente" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"><div className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-panel-line bg-panel-card p-6"><h2 id="confirmar-dados-atendente" className="text-lg font-semibold text-panel-ink">{dialogo.tipo === "SAIR" ? "Sair sem guardar as alterações?" : dialogo.tipo === "IMPORTAR" ? "Usar o cadastro atualizado?" : "Recarregar a configuração?"}</h2><p className="text-sm leading-relaxed text-panel-sub">{dialogo.tipo === "SAIR" ? "Não conseguimos salvar. Se sair agora, as alterações que só estão nesta tela serão descartadas." : dialogo.tipo === "IMPORTAR" ? "O rascunho será substituído pelos dados do cadastro. Você precisará conferir as informações e testar novamente." : "Alterações ainda não salvas nesta tela serão descartadas. Os dados serão carregados novamente do servidor."}</p><div className="flex flex-wrap gap-2"><button type="button" className={PRINCIPAL} disabled={ocupado || autosave.estado === "salvando"} onClick={() => void resolverDialogo()}>{dialogo.tipo === "SAIR" ? "Descartar e sair" : dialogo.tipo === "IMPORTAR" ? "Importar e revisar" : "Recarregar e descartar alterações locais"}</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setDialogo(null)}>Continuar aqui</button></div>{erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}</div></div>}
    <ModalConectarWhatsApp aberto={conectar} telefonePadrao={canal.telefone || metaConta.empresaTelefone} aoFechar={() => setConectar(false)} aoConectar={() => { setConectar(false); void atualizar(); }} />
    <ModalSalvarConta aberto={salvarConta} aoFechar={() => setSalvarConta(false)} nomePadrao={rascunho.negocio.nome} telefonePadrao={metaConta.empresaTelefone} aoSalvarSucesso={() => { setMetaConta(m => ({ ...m, isGuest: false })); setAviso("Seu acesso foi salvo."); }} />
  </div>;
}
