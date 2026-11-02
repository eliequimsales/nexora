"use client";

import { ConfiguracaoGuiadaNex } from "./configuracao-guiada-nex";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ModalConectarWhatsApp } from "@/components/painel/modal-conectar-whatsapp";
import { ModalSalvarConta } from "@/components/painel/modal-salvar-conta";
import type { MensagemDeConfiguracao, RespostaConversaConfiguracao } from "@/lib/atendente/conversa-schema";
import { CENARIOS_NEXA, type CenarioNexa, type ConfiguracaoNexa, type TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";
import { resumirTopicosConfiguracao, type TopicoConfiguracao } from "@/lib/atendente/configuracao-topicos";
import { BOTAO_NEXA as BOTAO, PRINCIPAL_NEXA as PRINCIPAL, PendenciasNexaContext } from "./configuracao-campos";
import { useConfiguracaoAutosave } from "./configuracao-autosalvar";
import { FormularioConfiguracaoNexa } from "./configuracao-formulario";
import { requisitarConfiguracaoNexa as requisitar, type FalhaConfiguracaoNexa } from "./configuracao-requisicao";
import { SimuladorConfiguracaoNexa, type PedidoTesteNexa } from "./configuracao-simulador";
import { VersoesDoAtendente } from "./configuracao-versoes";
import { ImportarMaterialDoAtendente } from "./importar-material";
import { EditorDoTopico, TopicosDaConfiguracao } from "./configuracao-por-topicos";

const ENDPOINT = "/api/atendente/configuracao/conversa";
const endpointConversa = (topico: TopicoConfiguracao | null) => topico ? `${ENDPOINT}?topico=${encodeURIComponent(topico)}` : ENDPOINT;
const SECOES = ["Sua empresa", "Serviços e funcionamento", "Jeito de atender", "Perguntas e regras"];
const INICIO_DO_ASSUNTO: Record<TopicoConfiguracao, string> = {
  EMPRESA: "Vamos começar pela sua empresa! Me conta o nome e o que vocês fazem.",
  SERVICOS: "Agora vamos falar um pouco do que você vende! Quais são os seus serviços e preços?",
  FUNCIONAMENTO: "Agora vamos ver seus horários de atendimento e onde vocês ficam.",
  ATENDIMENTO: "Agora vamos definir como eu devo falar e atender seus clientes no WhatsApp.",
  REGRAS: "Agora vamos cuidar das dúvidas e regras mais comuns dos seus clientes.",
};
const EXEMPLO_DO_TOPICO: Record<TopicoConfiguracao, string> = {
  EMPRESA: "Barbearia Silva, especializada em cortes modernos e barba tradicional",
  SERVICOS: "Corte masculino R$ 40, Barba R$ 30 e Prancha varia conforme o tamanho",
  FUNCIONAMENTO: "De segunda a sábado das 9h às 19h na Rua das Flores, 123",
  ATENDIMENTO: "Quero um jeito acolhedor e atencioso, tirando dúvidas 24 horas",
  REGRAS: "Tolerância de 15 minutos para atrasos e aceitamos Pix e cartão",
};
type AberturaDeAssunto = { id: string; topico: TopicoConfiguracao; aposMensagemId: string | null };
type Painel = "RESUMO" | "TESTE" | "REVISAO" | null;
type MetaConta = { isGuest?: boolean; empresaTelefone?: string; acesso?: string };

function Icone({ nome, className = "h-5 w-5" }: { nome: "conversa" | "enviar" | "check" | "fechar" | "livro" | "teste" | "seta" | "whatsapp"; className?: string }) {
  const formas: Record<typeof nome, ReactNode> = {
    conversa: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /><path d="M8 10h8M8 14h5" /></>,
    enviar: <><path d="m22 2-7 20-4-9-9-4L22 2Z" /><path d="M22 2 11 13" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    fechar: <><path d="m6 6 12 12M18 6 6 18" /></>,
    livro: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z" /><path d="M8 7h8M8 11h6" /></>,
    teste: <><path d="m9 5 10 7-10 7V5Z" /><path d="M4 5v14" /></>,
    seta: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
    whatsapp: <><path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.5A9 9 0 1 1 21 11.5Z" /><path d="M8.1 7.3c-.8 2.9 2.7 6.4 5.6 5.6l1.3-1.3 2 1.3c-.4 2.3-2.1 2.5-4.3 1.6-2.1-.8-4.3-3-5.1-5.1-.9-2.2-.7-3.9 1.6-4.3l1.3 2-1.3 1.3" transform="translate(0 1) scale(.95)" /></>,
  };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{formas[nome]}</svg>;
}

function PainelDaConversa({ titulo, descricao, aoFechar, children, largo = false }: { titulo: string; descricao?: string; aoFechar: () => void; children: ReactNode; largo?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const descricaoId = useId();
  const fecharRef = useRef(aoFechar); fecharRef.current = aoFechar;
  useEffect(() => {
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("[data-foco-inicial]")?.focus({ preventScroll: true });
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); fecharRef.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const elementos = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')).filter(v => v.getClientRects().length > 0);
      const primeiro = elementos[0]; const ultimo = elementos.at(-1);
      if (!primeiro || !ultimo) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === primeiro || !elementos.includes(document.activeElement as HTMLElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !elementos.includes(document.activeElement as HTMLElement))) { e.preventDefault(); primeiro.focus(); }
    };
    window.addEventListener("keydown", teclado);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", teclado); anterior?.focus({ preventScroll: true }); };
  }, []);
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center sm:p-5" onMouseDown={e => { if (e.target === e.currentTarget) aoFechar(); }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={descricao ? descricaoId : undefined} className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-panel-line bg-panel-card shadow-2xl sm:rounded-3xl ${largo ? "sm:max-w-3xl" : "sm:max-w-xl"}`}>
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-panel-line px-5 py-4 sm:px-6"><div className="min-w-0"><h2 id={tituloId} className="text-lg font-semibold tracking-tight text-panel-ink">{titulo}</h2>{descricao && <p id={descricaoId} className="mt-1 text-sm leading-relaxed text-panel-sub">{descricao}</p>}</div><button data-foco-inicial type="button" aria-label="Fechar painel" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-panel-sub transition hover:bg-panel-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber" onClick={aoFechar}><Icone nome="fechar" /></button></div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
    </div>
  </div>;
}

function ResumoDoAtendente({ dados }: { dados: ConfiguracaoNexa }) {
  const horario = dados.informacoes.horarios.filter(v => !v.closed);
  const confirmado = (i: ConfiguracaoNexa["informacoes"]["endereco"]) => i.situacao === "NAO_APLICA" ? "Não se aplica" : i.valor || "Ainda não informado";
  return <dl className="divide-y divide-panel-line text-sm">
    {[
      ["Empresa", dados.negocio.nome || "Ainda não informado"],
      ["Serviços", dados.informacoes.servicos.length ? dados.informacoes.servicos.map(s => `${s.nome}${s.precoModo === "FIXO" && s.precoCents !== null ? ` · ${(s.precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : s.precoModo === "SOB_CONSULTA" ? " · valor sob consulta" : " · valor ainda não informado"}${s.duracaoMin ? ` · ${s.duracaoMin} min` : ""}${s.situacao !== "CONFIRMADO" ? " (falta conferir)" : ""}`).join("\n") : "Ainda não informado"],
      ["Funcionamento", dados.informacoes.horariosSituacao === "CONFIRMADO" ? horario.map(h => `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][h.day]} ${h.open}–${h.close}`).join(" · ") || "Sem dias de atendimento" : "Falta conferir os dias e horários"],
      ["Onde atende", dados.negocio.modalidade === "ONLINE" ? "Atendimento online" : dados.negocio.modalidade === "DOMICILIO" ? confirmado(dados.negocio.regiao) : confirmado(dados.informacoes.endereco)],
      ["Pagamento", confirmado(dados.informacoes.pagamento)],
      ["Agendamentos", dados.atendimento.agendamento === "DIRETO" ? "Pode registrar reservas pela conversa" : dados.atendimento.agendamento === "LINK" ? "Envia o link da agenda" : "A equipe confirma os pedidos"],
      ["Alterações de reservas", dados.atendimento.gestaoReservas?.cancelar || dados.atendimento.gestaoReservas?.remarcar ? `${[dados.atendimento.gestaoReservas.remarcar ? "Pode remarcar" : "", dados.atendimento.gestaoReservas.cancelar ? "pode cancelar" : ""].filter(Boolean).join(" e ")}. ${dados.atendimento.gestaoReservas.antecedenciaHoras === null ? "Falta definir a antecedência mínima." : `Antecedência mínima: ${dados.atendimento.gestaoReservas.antecedenciaHoras} horas.`}` : "A equipe confirma remarcações e cancelamentos"],
      ["Perguntas e regras", dados.conhecimento.itens.length ? dados.conhecimento.itens.map(v => `${v.pergunta}\n${v.resposta}${v.situacao !== "CONFIRMADO" ? " (falta conferir)" : ""}`).join("\n\n") : "Nenhuma resposta adicional cadastrada"],
    ].map(([titulo, valor]) => <div key={titulo} className="py-3.5 first:pt-0"><dt className="mb-1.5 text-xs font-semibold text-panel-sub">{titulo}</dt><dd className="whitespace-pre-wrap break-words leading-relaxed text-panel-ink">{valor}</dd></div>)}
  </dl>;
}

function MensagemDaConfiguracao({ mensagem: m }: { mensagem: MensagemDeConfiguracao }) {
  if (m.de === "dono") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[91%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm border border-amber/20 bg-[#FFF8E7] px-4 py-3.5 text-sm leading-[1.7] text-panel-ink shadow-sm sm:max-w-[78%]">
          <p className="mb-1 text-[10px] font-semibold text-amber-900/70">Você (Dono da Empresa)</p>
          {m.texto}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 justify-start">
      <img
        src="/nex/nex-avatar.png"
        alt="Nex"
        className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-panel-line object-cover shadow-sm bg-white"
      />
      <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-panel-line bg-panel-card px-4 py-3.5 text-sm leading-[1.7] text-panel-ink shadow-sm sm:max-w-[78%]">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[11px] font-bold tracking-tight text-panel-ink">Nex</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-panel-sub">Atendente Oficial</span>
        </div>
        {m.texto}
      </div>
    </div>
  );
}

export function ConversaConfiguracaoDoAtendente() {
  const router = useRouter();
  const autosave = useConfiguracaoAutosave({ salvar: pedido => requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "PUT", pedido), protegerSaida: false });
  const autosaveRef = useRef(autosave); autosaveRef.current = autosave;
  const [conversa, setConversa] = useState<RespostaConversaConfiguracao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [materialEstado, setMaterialEstado] = useState({ pendente: false, ocupado: false });
  const materialRef = useRef(materialEstado);
  const atualizarMaterial = useCallback((estado: { pendente: boolean; ocupado: boolean }) => { materialRef.current = estado; setMaterialEstado(estado); }, []);
  const operacaoRef = useRef(false);
  const [texto, setTexto] = useState("");
  const textoAtual = useRef(texto); textoAtual.current = texto;
  const [painel, setPainel] = useState<Painel>(null);
  const [editando, setEditando] = useState(false);
  const [confirmarRecarga, setConfirmarRecarga] = useState(false);
  const [copiaLocal, setCopiaLocal] = useState("");
  const [pedidoSaida, setPedidoSaida] = useState<string | null>(null);
  const [secao, setSecao] = useState(0);
  const [topicoAtivo, setTopicoAtivo] = useState<TopicoConfiguracao | null>(null);
  const [topicoAberto, setTopicoAberto] = useState(false);
  const [indiceAberto, setIndiceAberto] = useState(false);
  const [aberturas, setAberturas] = useState<AberturaDeAssunto[]>([]);
  const sequenciaAbertura = useRef(0);
  const topicoRef = useRef<TopicoConfiguracao | null>(null);
  const cargaConversa = useRef(0);
  const atualizarAposSalvar = useRef(false);
  const carregouInicial = useRef(false);
  const ultimaMensagemVista = useRef<string | null>(null);
  const [conectar, setConectar] = useState(false);
  const [salvarConta, setSalvarConta] = useState(false);
  const [metaConta, setMetaConta] = useState<MetaConta>({});
  const [pedidoTeste, setPedidoTeste] = useState<PedidoTesteNexa | null>(null);
  const sequenciaTeste = useRef(0);
  const tentativa = useRef<{ id: string; texto: string; perguntaChave: string | null; topico: TopicoConfiguracao | null } | null>(null);
  const [enviando, setEnviando] = useState<{ id: string; texto: string } | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const mensagensRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const pertoDoFim = useRef(false);

  const registrarAbertura = useCallback((topico: TopicoConfiguracao, aposMensagemId: string | null) => {
    const abertura: AberturaDeAssunto = { id: `assunto:${++sequenciaAbertura.current}`, topico, aposMensagemId };
    // Trocar de assunto antes de escrever não precisa empilhar várias apresentações.
    setAberturas(anteriores => [...anteriores.filter(a => a.aposMensagemId !== aposMensagemId), abertura].slice(-20));
  }, []);

  const aplicar = useCallback((nova: TelaConfiguracaoNexa) => {
    if (autosaveRef.current.sincronizar(nova)) setConversa(anterior => anterior ? { ...anterior, tela: nova, topicos: undefined } : anterior);
  }, []);
  const atualizarConversa = useCallback(async () => {
    const alvo = topicoRef.current;
    const carga = ++cargaConversa.current;
    const nova = await requisitar<RespostaConversaConfiguracao>(endpointConversa(alvo));
    if (carga === cargaConversa.current && alvo === topicoRef.current && autosaveRef.current.sincronizar(nova.tela)) {
      const primeiraCarga = !carregouInicial.current;
      if (primeiraCarga) carregouInicial.current = true;
      const efetivo = nova.topicoAtual !== undefined ? nova.topicoAtual : alvo;
      if (efetivo && (primeiraCarga || efetivo !== topicoRef.current)) registrarAbertura(efetivo, nova.mensagens.at(-1)?.id ?? null);
      topicoRef.current = efetivo; setTopicoAtivo(efetivo);
      setConversa(nova);
      if (nova.tela.haAlteracoes) setAviso(anterior => anterior === "Informações aplicadas ao seu atendente." ? "" : anterior);
    }
    return nova;
  }, [registrarAbertura]);
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try {
      const telaInicial = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
      autosaveRef.current.iniciar(telaInicial);
      void atualizarConversa().catch(() => {});
    }
    catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  }, [atualizarConversa]);
  useEffect(() => { void carregar(); void requisitar<MetaConta>("/api/atendente").then(setMetaConta).catch(() => {}); }, [carregar]);
  useEffect(() => {
    if (autosave.pendente) { atualizarAposSalvar.current = true; return; }
    if (!atualizarAposSalvar.current || operacaoRef.current || textoAtual.current.trim() || tentativa.current) return;
    atualizarAposSalvar.current = false;
    void atualizarConversa().catch(() => { atualizarAposSalvar.current = true; });
  }, [autosave.pendente, ocupado, atualizarConversa, texto]);
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible" && !operacaoRef.current && !autosaveRef.current.pendente && !materialRef.current.pendente && !materialRef.current.ocupado && !textoAtual.current.trim() && !tentativa.current) void atualizarConversa().catch(() => {});
    };
    const timer = setInterval(atualizar, 30000); window.addEventListener("focus", atualizar);
    return () => { clearInterval(timer); window.removeEventListener("focus", atualizar); };
  }, [atualizarConversa]);
  useEffect(() => {
    const sair = (e: BeforeUnloadEvent) => { if (operacaoRef.current || autosaveRef.current.pendente || materialRef.current.pendente || materialRef.current.ocupado || tentativa.current || textoAtual.current.trim()) { e.preventDefault(); e.returnValue = ""; } };
    const navegar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (!operacaoRef.current && !autosaveRef.current.pendente && !materialRef.current.pendente && !materialRef.current.ocupado && !tentativa.current && !textoAtual.current.trim()) return;
      const link = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.getAttribute("href")?.startsWith("#") || link.href === window.location.href) return;
      const url = new URL(link.href);
      if (!["http:", "https:"].includes(url.protocol)) return;
      e.preventDefault(); e.stopPropagation();
      if (materialRef.current.pendente || materialRef.current.ocupado) { setErro("Guarde o material para revisão ou descarte o texto preparado antes de sair."); return; }
      if (!operacaoRef.current && !tentativa.current && !textoAtual.current.trim() && !autosaveRef.current.erro) {
        void autosaveRef.current.garantirSalvo().then(() => {
          if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`); else window.location.assign(url.href);
        }).catch(() => setPedidoSaida(url.href));
      } else setPedidoSaida(url.href);
    };
    window.addEventListener("beforeunload", sair); document.addEventListener("click", navegar, true);
    return () => { window.removeEventListener("beforeunload", sair); document.removeEventListener("click", navegar, true); };
  }, [router]);
  useEffect(() => {
    const ultima = conversa?.mensagens.at(-1)?.id ?? null;
    const mudou = ultima !== ultimaMensagemVista.current;
    ultimaMensagemVista.current = ultima;
    if (!mudou || !pertoDoFim.current || topicoAberto || !ultima) return;
    campo.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [conversa?.mensagens, conversa?.pergunta?.texto, enviando, topicoAberto]);
  useEffect(() => {
    const el = campo.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [texto]);
  useEffect(() => {
    if (pedidoSaida && !ocupado && !autosave.pendente && !tentativa.current && !texto.trim()) navegarPara(pedidoSaida);
    // O destino já foi escolhido pelo usuário; navegar só após a confirmação do salvamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoSaida, ocupado, autosave.pendente, texto]);

  async function operar<T>(acao: () => Promise<T>): Promise<T | null> {
    if (materialRef.current.pendente || materialRef.current.ocupado) { setErro("Guarde o material para revisão ou descarte o texto preparado antes de continuar."); return null; }
    if (operacaoRef.current) return null;
    // Uma leitura antiga não pode substituir a pergunta/histórico depois de uma ação.
    cargaConversa.current += 1;
    operacaoRef.current = true; setOcupado(true); setErro("");
    try { await autosaveRef.current.garantirSalvo(); return await acao(); }
    catch (e) {
      const falha = e as FalhaConfiguracaoNexa; setErro(falha.message);
      const base = autosaveRef.current.tela;
      if (base && falha.pendencias && !autosaveRef.current.pendente) aplicar({ ...base, pendencias: falha.pendencias });
      return null;
    } finally { operacaoRef.current = false; setOcupado(false); }
  }

  function chavePerguntaVisivel(estado: RespostaConversaConfiguracao | null) {
    const pergunta = estado?.pergunta;
    if (!pergunta) return null;
    return pergunta.chave;
  }

  async function enviar(mensagem = texto) {
    const conteudo = mensagem.trim();
    if (!conteudo || operacaoRef.current || !autosaveRef.current.tela) return;
    if (tentativa.current?.texto !== conteudo) tentativa.current = { id: crypto.randomUUID(), texto: conteudo, perguntaChave: chavePerguntaVisivel(conversa), topico: topicoRef.current };
    const envio = tentativa.current;
    setTexto(conteudo); setEnviando(envio); setAviso(""); pertoDoFim.current = true;
    const resultado = await operar(async () => {
      const base = autosaveRef.current.tela!;
      try { return await requisitar<RespostaConversaConfiguracao>(ENDPOINT, "POST", { revisao: base.revisao, mensagemId: envio.id, texto: conteudo, perguntaChave: envio.perguntaChave, ...(envio.topico ? { topico: envio.topico } : {}) }); }
      catch (e) {
        if ((e as FalhaConfiguracaoNexa).status === 409) {
          const nova = await atualizarConversa();
          if (tentativa.current?.id === envio.id) tentativa.current = { ...envio, perguntaChave: chavePerguntaVisivel(nova) };
          throw new Error("A conversa foi atualizada. Confira a pergunta atual antes de reenviar sua mensagem, que continua aqui.");
        }
        throw e;
      }
    });
    if (resultado) {
      const efetivo = resultado.topicoAtual !== undefined ? resultado.topicoAtual : topicoRef.current;
      if (efetivo && efetivo !== topicoRef.current) registrarAbertura(efetivo, envio.id);
      topicoRef.current = efetivo; setTopicoAtivo(efetivo);
      aplicar(resultado.tela); setConversa(resultado); setTexto(""); tentativa.current = null;
      if (resultado.aviso) setAviso(resultado.aviso);
    }
    setEnviando(null);
    requestAnimationFrame(() => campo.current?.focus({ preventScroll: true }));
  }

  function editar<K extends keyof ConfiguracaoNexa>(bloco: K, dados: Partial<ConfiguracaoNexa[K]>) {
    autosaveRef.current.editar(c => ({ ...c, [bloco]: { ...c[bloco], ...dados } })); setErro(""); setAviso("");
  }
  async function escolherTopico(topico: TopicoConfiguracao | null, editarDados = false) {
    if (operacaoRef.current) return;
    if (topico !== topicoRef.current && (textoAtual.current.trim() || tentativa.current)) {
      setErro("Envie ou apague a mensagem antes de trocar de tópico. O texto continua aqui."); return;
    }
    const anterior = topicoRef.current;
    pertoDoFim.current = false;
    const nova = await operar(async () => {
      if (topico === topicoRef.current && (textoAtual.current.trim() || tentativa.current)) {
        setTopicoAberto(editarDados && topico !== null); setIndiceAberto(false); setPainel(null); setEditando(false);
        return autosaveRef.current.garantirSalvo();
      }
      topicoRef.current = topico;
      try {
        const resposta = await atualizarConversa();
        const efetivo = resposta.topicoAtual !== undefined ? resposta.topicoAtual : topico;
        topicoRef.current = efetivo; setTopicoAtivo(efetivo);
        if (efetivo && efetivo !== anterior) registrarAbertura(efetivo, resposta.mensagens.at(-1)?.id ?? null);
        setTopicoAberto(editarDados && efetivo !== null); setIndiceAberto(false); setPainel(null); setEditando(false);
        return resposta;
      } catch (e) { topicoRef.current = anterior; throw e; }
    });
    if (nova) requestAnimationFrame(() => {
      if (editarDados && topico) editorRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      else { campo.current?.focus({ preventScroll: true }); campo.current?.scrollIntoView({ behavior: "auto", block: "nearest" }); }
    });
  }
  async function concluirTopico() {
    const nova = await operar(async () => textoAtual.current.trim() || tentativa.current ? autosaveRef.current.garantirSalvo() : atualizarConversa());
    if (!nova) return;
    setTopicoAberto(false); pertoDoFim.current = true;
    requestAnimationFrame(() => { campo.current?.focus({ preventScroll: true }); campo.current?.scrollIntoView({ block: "nearest" }); });
  }
  async function voltarAosTopicos() {
    if (operacaoRef.current) return;
    setIndiceAberto(aberto => !aberto);
  }
  async function fecharPainel() {
    if (materialRef.current.pendente || materialRef.current.ocupado) { setErro("Guarde o material para revisão ou descarte o texto preparado antes de fechar."); return; }
    if (operacaoRef.current) return;
    if (autosaveRef.current.pendente) {
      const salvo = await operar(() => atualizarConversa());
      if (!salvo) return;
    } else if (editando) { await atualizarConversa().catch(() => {}); }
    setPainel(null); setEditando(false);
  }
  async function conferirDados() {
    const base = await autosaveRef.current.garantirSalvo();
    const nova = await requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "PUT", { revisao: base.revisao, rascunho: base.rascunho, etapa: base.etapa, concluirEtapas: [0, 1, 2, 3] });
    aplicar(nova); return nova;
  }
  async function prepararTeste() {
    // A pessoa confere e testa o rascunho; esta operação não publica nem ativa.
    return operar(() => autosaveRef.current.garantirSalvo());
  }
  function abrirTeste(cenario?: CenarioNexa) {
    if (operacaoRef.current) return;
    setErro(""); setPainel("TESTE"); setEditando(false); setTopicoAberto(false);
    setPedidoTeste(cenario ? { cenario, seq: ++sequenciaTeste.current } : null);
  }
  async function publicar() {
    const nova = await operar(async () => {
      const base = autosaveRef.current.tela!;
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "PUBLICAR", revisao: base.revisao });
    });
    if (nova) { aplicar(nova); setAviso("Informações aplicadas ao seu atendente."); await atualizarConversa().catch(() => {}); }
  }
  async function ligar(ligado: boolean) {
    const nova = await operar(async () => {
      await requisitar("/api/atendente/ligar", "POST", { ligar: ligado });
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao");
    });
    if (nova) { aplicar(nova); setAviso(ligado ? "Atendente ativado conforme os horários e as regras da sua empresa." : "Atendimento pausado. Suas informações continuam salvas."); }
  }
  async function tentarSalvar() {
    setErro("");
    try { const nova = await autosaveRef.current.tentarNovamente(); aplicar(nova); await atualizarConversa(); }
    catch (e) { setErro((e as Error).message); }
  }
  async function recarregarSalvo() {
    if (operacaoRef.current) return;
    cargaConversa.current += 1;
    operacaoRef.current = true; setOcupado(true);
    try {
      const nova = await requisitar<RespostaConversaConfiguracao>(endpointConversa(topicoRef.current));
      if (autosaveRef.current.descartarAlteracoes(nova.tela)) {
        setConversa(nova); setErro(""); setConfirmarRecarga(false);
        setAviso("Versão salva recarregada. A mensagem que você estava escrevendo continua aqui.");
      }
    } catch (e) { setErro((e as Error).message); }
    finally { operacaoRef.current = false; setOcupado(false); }
  }
  async function importarCadastro() {
    const nova = await operar(async () => {
      const base = autosaveRef.current.tela!;
      return requisitar<TelaConfiguracaoNexa>("/api/atendente/configuracao", "POST", { acao: "IMPORTAR_CADASTRO", revisao: base.revisao });
    });
    if (nova) { aplicar(nova); await atualizarConversa().catch(() => {}); setAviso("Cadastro importado. Confira as informações antes de usá-las no atendimento."); }
  }
  async function copiarInformacoes() {
    const c = autosaveRef.current.rascunho;
    if (!c) return;
    const conteudo = [
      `Empresa: ${c.negocio.nome}`, `Área de atuação: ${c.negocio.segmento}`, `Descrição: ${c.negocio.descricao.valor}`,
      `Modalidade: ${c.negocio.modalidade}`, `Região atendida: ${c.negocio.regiao.valor}`, `Endereço: ${c.informacoes.endereco.valor}`,
      `Serviços:\n${c.informacoes.servicos.map(s => `${s.nome} — ${s.precoModo === "FIXO" && s.precoCents !== null ? (s.precoCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : s.precoModo === "SOB_CONSULTA" ? "Valor sob consulta" : "Valor ainda não informado"}${s.duracaoMin ? `; ${s.duracaoMin} minutos` : ""}${s.descricao ? `; ${s.descricao}` : ""}`).join("\n")}`,
      `Funcionamento:\n${c.informacoes.horarios.map(h => `${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][h.day]}: ${h.closed ? "Fechado" : `${h.open} às ${h.close}`}`).join("\n")}`,
      `Datas sem atendimento: ${c.informacoes.diasFechados.join(", ")}`, `Formas de pagamento: ${c.informacoes.pagamento.valor}`,
      `Nome do atendente: ${c.atendimento.nome}`, `Estilo: ${c.atendimento.jeito}`, `Quando responde: ${c.atendimento.quando}`,
      `Agendamentos: ${c.atendimento.agendamento}`, `Assuntos da equipe: ${c.atendimento.handoffKeywords.join(", ")}`,
      `Perguntas e regras:\n${c.conhecimento.itens.map(i => `${i.pergunta}\n${i.resposta}`).join("\n\n")}`,
      ...(textoAtual.current.trim() ? [`Mensagem ainda nesta tela:\n${textoAtual.current}`] : []),
    ].join("\n\n");
    setCopiaLocal(conteudo);
    try { await navigator.clipboard.writeText(conteudo); setAviso("Suas informações foram copiadas."); }
    catch { setAviso("A cópia está disponível no campo abaixo para você selecionar e guardar."); }
  }
  function navegarPara(href: string, descartar = false) {
    if (descartar) {
      const salvo = autosaveRef.current.tela;
      if (salvo) autosaveRef.current.descartarAlteracoes(salvo);
    }
    tentativa.current = null; textoAtual.current = ""; setTexto(""); setPedidoSaida(null);
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);
    else window.location.assign(url.href);
  }
  async function salvarESair() {
    if (!pedidoSaida || operacaoRef.current) return;
    try {
      if (autosaveRef.current.erro) await autosaveRef.current.tentarNovamente();
      else await autosaveRef.current.garantirSalvo();
      if (textoAtual.current.trim()) {
        await enviar(textoAtual.current);
        if (tentativa.current) return;
      }
      navegarPara(pedidoSaida);
    } catch (e) { setErro((e as Error).message); }
  }

  const tela = autosave.tela;
  const dados = autosave.rascunho;
  if (!tela || !dados) return <div className="mx-auto max-w-5xl py-4"><h1 className="font-display text-2xl text-panel-ink">Seu atendente</h1><div className="mt-6 rounded-3xl border border-panel-line bg-panel-card p-8 sm:p-12">{carregando ? <p role="status" className="text-sm text-panel-sub">Preparando seu atendente…</p> : <div role="alert"><p className="text-sm text-panel-ink">{erro || "Não consegui abrir a configuração agora."}</p><button type="button" className={`${BOTAO} mt-4`} onClick={() => void carregar()}>Tentar novamente</button></div>}</div></div>;

  const canal = tela.conexao;
  const topicos = resumirTopicosConfiguracao(dados, tela.pendencias).map(topico =>
    !autosave.pendente && conversa && conversa.tela.revisao === tela.revisao
      ? conversa.topicos?.find(salvo => salvo.id === topico.id) ?? topico
      : topico);
  const topicoSelecionado = topicos.find(t => t.id === topicoAtivo);
  const indiceDoTopico = topicos.findIndex(t => t.id === topicoAtivo);
  const topicoAnterior = indiceDoTopico > 0 ? topicos[indiceDoTopico - 1] : null;
  const proximoTopico = indiceDoTopico >= 0 ? topicos[indiceDoTopico + 1] : topicos.find(t => t.estado !== "PREENCHIDO") ?? topicos[0];
  const exigeAgenda = dados.negocio.objetivo === "AGENDAMENTOS" || dados.atendimento.agendamento !== "DESLIGADO";
  const cenariosObrigatorios = CENARIOS_NEXA.filter(c => ["INFORMACOES", "HUMANO", "DESCONHECIDA", ...(exigeAgenda ? ["HORARIO"] : [])].includes(c.id));
  const testesAtuais = autosave.pendente ? [] : tela.testes.filter(t => t.revisao === tela.revisao);
  const pendenteTeste = cenariosObrigatorios.find(c => [...testesAtuais].reverse().find(t => t.cenario === c.id)?.correto !== true);
  const faltaDados = tela.pendencias.filter(p => p.bloqueia && p.etapa < 4 && !p.campo.startsWith("etapa:"));
  const conferido = [0, 1, 2, 3].every(i => tela.revisadas.includes(i));
  const prontoPublicar = !autosave.pendente && !tela.pendencias.some(p => p.bloqueia);
  const temInformacoesEmUso = Boolean(tela.publicadoEm);
  const publicado = Boolean(tela.publicadoEm && !tela.haAlteracoes && !autosave.pendente);
  const erroVisivel = erro || autosave.erro?.message;
  const aberturasIniciais = aberturas.filter(a => !a.aposMensagemId);
  const ultimoAtendente = conversa?.mensagens ? [...conversa.mensagens].reverse().find(m => m.de === "atendente") : null;
  const mostrarPergunta = Boolean(conversa?.pergunta && chavePerguntaVisivel(conversa) !== null && !ultimoAtendente?.texto.includes(conversa.pergunta.texto));
  const preparando = Boolean(enviando);
  const mostrarEnvio = Boolean(enviando && !(conversa?.mensagens ?? []).some(m => m.id === enviando.id));
  const estadoSalvo = autosave.erro ? "Há alterações sem salvar" : ocupado || autosave.pendente ? "Salvando…" : tentativa.current && erroVisivel ? "Mensagem ainda não confirmada" : "Configuração salva";
  const usoDasInformacoes = temInformacoesEmUso
    ? "Informações confirmadas atualizam seu atendente. O que falta esclarecer continua para revisão."
    : "Suas informações ficam salvas para revisão. Confira e teste antes de ativar o atendimento.";
  const proximoPasso = faltaDados.length ? "Complete as informações pela conversa. Você pode testar a qualquer momento." : !conferido ? "Confira o que seu atendente aprendeu e experimente as respostas." : pendenteTeste ? temInformacoesEmUso ? "Teste as respostas com suas informações atualizadas." : "Experimente e confira as respostas antes de colocar para atender." : !publicado ? "Confira os pontos em revisão antes de aplicar a configuração completa." : !canal.conectado ? "Seu atendente está preparado. Conecte o WhatsApp da empresa quando quiser ativar." : !canal.ligado ? "Tudo preparado. Você já pode ativar o atendimento no WhatsApp." : "Seu atendente está ativo. Continue por aqui sempre que algo mudar na empresa.";

  function abrirConexao() { if (operacaoRef.current || autosaveRef.current.pendente) return; setPainel(null); if (metaConta.isGuest) setSalvarConta(true); else setConectar(true); }
  function aberturaDoAssunto(abertura: AberturaDeAssunto) {
    return (
      <div key={abertura.id} className="flex items-start gap-2.5 justify-start">
        <img
          src="/nex/nex-avatar.png"
          alt="Nex"
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full border border-panel-line object-cover shadow-sm bg-white"
        />
        <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-panel-line bg-panel-card px-4 py-3.5 text-sm leading-[1.7] text-panel-ink shadow-sm sm:max-w-[78%]">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-tight text-panel-ink">Nex</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-panel-sub">Atendente Oficial</span>
          </div>
          <p>{INICIO_DO_ASSUNTO[abertura.topico]}</p>
        </div>
      </div>
    );
  }

  return <div className="mx-auto max-w-5xl pb-5">
    {metaConta.isGuest && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber/25 bg-amber/10 px-4 py-3 text-xs text-panel-sub">
        <p>Guarde seu acesso para continuar depois.</p>
        <button
          type="button"
          className="min-h-9 font-semibold text-panel-ink underline underline-offset-4"
          onClick={() => setSalvarConta(true)}
        >
          Salvar meu acesso
        </button>
      </div>
    )}

    {/* Atalhos de compatibilidade e acessibilidade */}
    <div className="sr-only">
      <button onClick={() => setPainel("RESUMO")}>O que já sabe</button>
      <button onClick={() => abrirTeste()}>Testar atendimento</button>
    </div>

    <ConfiguracaoGuiadaNex
      tela={tela}
      rascunho={dados}
      pendente={autosave.pendente}
      ocupado={ocupado}
      erro={erroVisivel || erro}
      aviso={aviso}
      canal={canal}
      publicado={publicado}
      pronto={!faltaDados.length}
      editar={editar}
      abrirConexao={abrirConexao}
      abrirTeste={(cenario) => abrirTeste(cenario)}
      abrirResumo={() => {
        setPainel("RESUMO");
        setEditando(false);
      }}
      ativar={async () => {
        await ligar(true);
      }}
      pausar={async () => {
        await ligar(false);
      }}
    />

    {canal.ligado && (
      <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-panel-sub">
        <span className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              canal.conectado ? "bg-emerald-500" : "bg-amber"
            }`}
          />
          {canal.conectado
            ? "Atendimento ativo no WhatsApp"
            : "Atendimento ativado. Reconecte o WhatsApp para receber mensagens."}
        </span>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void ligar(false)}
          className="min-h-9 shrink-0 rounded-lg px-2 font-medium underline underline-offset-4 disabled:opacity-50"
        >
          Pausar atendimento
        </button>
      </div>
    )}

    {metaConta.acesso === "SEMANA_ACABOU" && (
      <p className="mt-4 text-xs leading-relaxed text-panel-sub">
        Você pode configurar e testar. Para ativar o atendimento,{" "}
        <Link className="font-semibold underline" href="/painel/assinatura">
          consulte seu plano
        </Link>
        .
      </p>
    )}

    {painel === "RESUMO" && !pedidoSaida && <PainelDaConversa titulo="O que seu atendente já sabe" descricao="Confira as informações que ele usará para atender seus clientes." aoFechar={() => void fecharPainel()} largo={editando}>
      {erroVisivel && !editando && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">{erroVisivel}</p>}
      {autosave.erro && <div className="mb-4 rounded-xl border border-panel-line p-3"><p className="text-xs leading-relaxed text-panel-sub">Você pode guardar uma cópia antes de recarregar a versão salva.</p><button type="button" className={`${BOTAO} mt-2`} onClick={() => void copiarInformacoes()}>Copiar minhas informações</button></div>}
      {copiaLocal && <label className="mb-5 block space-y-2"><span className="text-xs font-medium text-panel-sub">Cópia das suas informações</span><textarea readOnly rows={5} aria-label="Cópia das suas informações" value={copiaLocal} onFocus={e => e.currentTarget.select()} className="w-full min-w-0 rounded-xl border border-panel-line bg-panel-bg p-3 text-xs leading-relaxed text-panel-ink" /></label>}
      {tela.pendencias.some(p => p.campo === "cadastro") && <div className="mb-5 rounded-2xl border border-amber/25 bg-amber/10 p-4"><p className="text-sm font-semibold text-panel-ink">O cadastro mudou em outra área</p><p className="mt-1 text-xs leading-relaxed text-panel-sub">Você pode trazer o cadastro atualizado. Isso substitui o rascunho desta conversa e pede uma nova conferência.</p><button type="button" className={`${BOTAO} mt-3`} disabled={ocupado || autosave.pendente} onClick={() => void importarCadastro()}>Importar e revisar cadastro</button></div>}
      {!editando ? <><ResumoDoAtendente dados={dados} /><div className="mt-5 flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado || materialEstado.pendente || materialEstado.ocupado} onClick={() => void escolherTopico("EMPRESA", true)}>Editar informações</button><button type="button" className={PRINCIPAL} disabled={ocupado || autosave.pendente} onClick={() => void operar(conferirDados).then(nova => { if (nova) { setPainel("TESTE"); setPedidoTeste(null); } })}>Conferi. Quero testar</button></div></> : <div className="space-y-5"><p className="rounded-xl bg-panel-bg p-3 text-xs leading-relaxed text-panel-sub">As alterações são salvas automaticamente. Você também pode pedir qualquer ajuste pela conversa.</p><div className="flex flex-wrap gap-2">{SECOES.map((s, i) => <button key={s} type="button" aria-pressed={secao === i} className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold ${secao === i ? "border-amber bg-amber/10 text-panel-ink" : "border-panel-line text-panel-sub"}`} onClick={() => setSecao(i)}>{s}</button>)}</div><fieldset disabled={ocupado} className="min-w-0"><PendenciasNexaContext.Provider value={tela.pendencias.filter(p => !p.campo.startsWith("teste:") && !p.campo.startsWith("etapa:"))}><FormularioConfiguracaoNexa etapa={secao} dados={dados} editar={editar} /></PendenciasNexaContext.Provider></fieldset>{erroVisivel && <p role="alert" className="text-sm text-red-700">{erroVisivel}</p>}{autosave.erro && <div className="flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado} onClick={() => void tentarSalvar()}>Tentar salvar novamente</button><button type="button" className={BOTAO} disabled={ocupado} onClick={() => setConfirmarRecarga(true)}>Recarregar versão salva</button></div>}{confirmarRecarga && <div className="rounded-xl border border-amber/30 bg-amber/10 p-4"><p className="text-sm font-semibold text-panel-ink">Substituir as alterações deste painel?</p><p className="mt-1 text-xs leading-relaxed text-panel-sub">As alterações ainda não salvas serão descartadas. A mensagem digitada na conversa será preservada.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={BOTAO} disabled={ocupado} onClick={() => void recarregarSalvo()}>Recarregar e descartar alterações locais</button><button type="button" className={BOTAO} onClick={() => setConfirmarRecarga(false)}>Continuar editando</button></div></div>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-panel-line pt-4"><span role="status" className="text-xs text-panel-sub">{estadoSalvo}</span><button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => void operar(() => atualizarConversa()).then(nova => { if (nova) setEditando(false); })}>Concluir edição</button></div></div>}
      {!editando && <div className="mt-5"><ImportarMaterialDoAtendente revisao={tela.revisao} materiais={dados.materiais} desabilitado={ocupado || autosave.pendente} aoEstado={atualizarMaterial} aoImportar={nova => { aplicar(nova); setErro(""); setAviso("Material guardado para revisão. Confira as informações e teste as respostas antes de aplicar."); void atualizarConversa().catch(e => setErro((e as Error).message)); }} /></div>}
      {!editando && <VersoesDoAtendente operar={operar} revisao={tela.revisao} desabilitado={ocupado || autosave.pendente || materialEstado.pendente || materialEstado.ocupado || !!texto.trim() || !!tentativa.current} aoRestaurar={async nova => { aplicar(nova); await atualizarConversa(); setAviso("Versão recuperada para revisão. Confira e teste antes de aplicar."); }} />}
    </PainelDaConversa>}

    {painel === "TESTE" && !pedidoSaida && <PainelDaConversa titulo="Veja como seu atendente responde" descricao="Escreva como um cliente. O teste usa suas informações salvas." aoFechar={() => void fecharPainel()}><div className="space-y-4">
      <SimuladorConfiguracaoNexa tela={tela} ocupado={ocupado} sujo={autosave.pendente} erro={erroVisivel || ""} pedido={pedidoTeste} operar={operar} prepararTeste={prepararTeste} aplicar={aplicar} corrigir={() => { setPainel(null); setAviso("Conte na conversa o que precisa mudar. Depois, teste a resposta novamente."); requestAnimationFrame(() => campo.current?.focus({ preventScroll: true })); }} proximoCenario={pendenteTeste?.id ?? null} concluirTeste={() => setPainel("REVISAO")} />
      {!conferido && <div className="rounded-2xl border border-panel-line p-4"><p className="text-xs leading-relaxed text-panel-sub">Antes de usar com clientes, confira também as informações da sua empresa.</p><button type="button" className={`${BOTAO} mt-3 w-full`} disabled={ocupado} onClick={() => { setPainel("RESUMO"); setEditando(false); }}>Conferir informações</button></div>}
      {pendenteTeste && <button type="button" className={`${BOTAO} w-full`} disabled={ocupado} onClick={() => abrirTeste(pendenteTeste.id)}>Conferir: {pendenteTeste.titulo.toLocaleLowerCase("pt-BR")}</button>}
    </div></PainelDaConversa>}

    {painel === "REVISAO" && !pedidoSaida && <PainelDaConversa titulo="Pronto para atender seus clientes?" descricao="Confira o que será usado no atendimento da sua empresa." aoFechar={() => void fecharPainel()}><div className="space-y-5"><ResumoDoAtendente dados={dados} />
      {erroVisivel && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">{erroVisivel}</p>}
      {aviso && <p role="status" className="text-xs leading-relaxed text-panel-sub">{aviso}</p>}
      {faltaDados.length > 0 && <div className="rounded-2xl bg-amber/10 p-4"><p className="text-sm font-semibold text-panel-ink">Ainda falta conferir</p><ul className="mt-2 space-y-2 text-xs leading-relaxed text-panel-sub">{faltaDados.slice(0, 5).map(p => <li key={p.campo}>{p.mensagem}</li>)}</ul><button type="button" className={`${BOTAO} mt-3`} onClick={() => void escolherTopico(topicos.find(t => t.estado !== "PREENCHIDO")?.id ?? "EMPRESA")}>Conferir informações</button></div>}
      {!faltaDados.length && !conferido ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || autosave.pendente} onClick={() => void operar(conferirDados)}>Conferi estas informações</button> : pendenteTeste ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado} onClick={() => abrirTeste(pendenteTeste.id)}>Conferir as respostas no teste</button> : !publicado ? <><p className="text-xs leading-relaxed text-panel-sub">Ao aplicar, estas informações substituem a versão anterior usada pelo seu atendente.</p><button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado || !prontoPublicar} onClick={() => void publicar()}>Usar estas informações</button></> : !canal.conectado ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado} onClick={abrirConexao}><Icone nome="whatsapp" />Conectar WhatsApp da empresa</button> : !canal.ligado ? <button type="button" className={`${PRINCIPAL} w-full`} disabled={ocupado} onClick={() => void ligar(true)}><Icone nome="whatsapp" />Ativar atendimento no WhatsApp</button> : <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-800"><Icone nome="check" />Seu atendente está ativo.</div>}
      <p className="text-[11px] leading-relaxed text-panel-sub">O atendente segue suas regras e encaminha situações que precisam de uma pessoa.</p>
    </div></PainelDaConversa>}

    {pedidoSaida && <PainelDaConversa titulo={ocupado ? "Guardando suas informações" : "Antes de sair"} descricao="Suas informações salvas continuam guardadas." aoFechar={() => setPedidoSaida(null)}><div className="space-y-4">
      <p className="text-sm leading-relaxed text-panel-ink">{ocupado ? "Aguarde a resposta antes de sair para conferirmos o salvamento." : texto.trim() ? "Há uma mensagem nesta tela que ainda não teve o envio confirmado. Você pode enviar e guardar antes de sair." : "Há alterações ainda não salvas. Você pode tentar guardar ou voltar para conferir."}</p>
      {erroVisivel && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">{erroVisivel}</p>}
      <button type="button" className={BOTAO} onClick={() => void copiarInformacoes()}>Copiar minhas informações</button>
      {copiaLocal && <textarea aria-label="Cópia das suas informações" readOnly rows={5} value={copiaLocal} onFocus={e => e.currentTarget.select()} className="w-full min-w-0 rounded-xl border border-panel-line bg-panel-bg p-3 text-xs leading-relaxed text-panel-ink" />}
      <div className="flex flex-wrap gap-2"><button type="button" className={PRINCIPAL} disabled={ocupado} onClick={() => void salvarESair()}>{texto.trim() ? "Enviar e sair" : "Guardar e sair"}</button><button type="button" className={BOTAO} onClick={() => setPedidoSaida(null)}>Continuar aqui</button><button type="button" className="min-h-11 rounded-xl px-3 py-2 text-xs font-medium text-red-700 underline underline-offset-4 disabled:opacity-50" disabled={ocupado} onClick={() => navegarPara(pedidoSaida, true)}>Sair sem guardar o que falta</button></div>
    </div></PainelDaConversa>}

    <ModalConectarWhatsApp aberto={conectar} telefonePadrao={canal.telefone || metaConta.empresaTelefone} aoFechar={() => { setConectar(false); void atualizarConversa().catch(() => {}); }} aoConectar={() => { setConectar(false); void atualizarConversa().catch(() => {}); }} />
    <ModalSalvarConta aberto={salvarConta} aoFechar={() => setSalvarConta(false)} nomePadrao={dados.negocio.nome} telefonePadrao={metaConta.empresaTelefone} aoSalvarSucesso={() => { setMetaConta(m => ({ ...m, isGuest: false })); void atualizarConversa().catch(e => setErro((e as Error).message)); setAviso("Seu acesso foi salvo. Você pode continuar esta conversa depois."); }} />
  </div>;
}
