"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ConfiguracaoNexa, TelaConfiguracaoNexa } from "@/lib/atendente/configuracao-schema";

export type PedidoAutosaveConfiguracao = Pick<TelaConfiguracaoNexa, "revisao" | "rascunho" | "etapa">;
export type FalhaAutosaveConfiguracao = Error & { status?: number; pendencias?: TelaConfiguracaoNexa["pendencias"] };
export type EstadoAutosaveConfiguracao = "aguardando" | "salvando" | "salvo" | "erro";
export type EstadoConfiguracaoAutosave = {
  tela: TelaConfiguracaoNexa | null;
  rascunho: ConfiguracaoNexa | null;
  etapa: number;
  estado: EstadoAutosaveConfiguracao;
  pendente: boolean;
  erro: FalhaAutosaveConfiguracao | null;
};
type OpcoesAutosave = {
  salvar: (pedido: PedidoAutosaveConfiguracao) => Promise<TelaConfiguracaoNexa>;
  debounceMs?: number;
};
type EdicaoConfiguracao = ConfiguracaoNexa | ((atual: ConfiguracaoNexa) => ConfiguracaoNexa);
const copiar = <T,>(valor: T): T => JSON.parse(JSON.stringify(valor)) as T;
const assinatura = (valor: unknown) => JSON.stringify(valor);

/** Fila única: uma resposta atrasada atualiza a revisão, nunca substitui uma edição mais nova. */
export class ControladorConfiguracaoAutosave {
  private tela: TelaConfiguracaoNexa | null = null;
  private rascunho: ConfiguracaoNexa | null = null;
  private etapa = 0;
  private versaoRascunho = 0;
  private versaoEtapa = 0;
  private ultimoAjuste = 0;
  private erro: FalhaAutosaveConfiguracao | null = null;
  // Uma falha de transporte pode ocorrer depois da gravação no servidor.
  private precisaRevalidar = false;
  private emVoo: Promise<TelaConfiguracaoNexa> | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private ativo = true;
  private ouvintes = new Set<() => void>();
  private snapshot: EstadoConfiguracaoAutosave = { tela: null, rascunho: null, etapa: 0, estado: "salvo", pendente: false, erro: null };
  private readonly debounceMs: number;

  constructor(private readonly opcoes: OpcoesAutosave) {
    this.debounceMs = Math.max(0, opcoes.debounceMs ?? 650);
  }

  obterEstado = () => this.snapshot;
  assinar = (ouvinte: () => void) => { this.ouvintes.add(ouvinte); return () => { this.ouvintes.delete(ouvinte); }; };

  private temAlteracoes() {
    return !!this.tela && !!this.rascunho && (this.precisaRevalidar || this.etapa !== this.tela.etapa || assinatura(this.rascunho) !== assinatura(this.tela.rascunho));
  }

  private emitir() {
    const alteracoes = this.temAlteracoes();
    this.snapshot = {
      tela: this.tela, rascunho: this.rascunho, etapa: this.etapa,
      estado: this.erro ? "erro" : this.emVoo ? "salvando" : alteracoes ? "aguardando" : "salvo",
      pendente: !!this.erro || !!this.emVoo || alteracoes, erro: this.erro,
    };
    this.ouvintes.forEach(ouvinte => ouvinte());
  }

  private cancelarEspera() {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  private agendar() {
    this.cancelarEspera();
    if (!this.ativo || this.emVoo || this.erro || !this.temAlteracoes()) return;
    const restante = Math.max(0, this.ultimoAjuste + this.debounceMs - Date.now());
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.gravar().catch(() => { /* A falha é exibida pelo estado; o rascunho continua local. */ });
    }, restante);
  }

  /** Inicialização ou recarga sem alterações locais; nunca descarta uma fila pendente. */
  iniciar = (nova: TelaConfiguracaoNexa): boolean => this.sincronizar(nova);

  /** Use após operações externas serializadas por garantirSalvo(). */
  sincronizar = (nova: TelaConfiguracaoNexa): boolean => {
    if (this.emVoo || this.erro || this.temAlteracoes() || (this.tela && nova.revisao < this.tela.revisao)) return false;
    return this.descartarAlteracoes(nova);
  };

  /** Exclusivo da ação explícita de recarregar e descartar, após confirmação na interface. */
  descartarAlteracoes = (nova: TelaConfiguracaoNexa): boolean => {
    if (this.emVoo) return false;
    this.cancelarEspera();
    this.tela = copiar(nova);
    this.rascunho = copiar(nova.rascunho);
    this.etapa = nova.etapa;
    this.erro = null;
    this.precisaRevalidar = false;
    this.emitir();
    return true;
  };

  editar = (edicao: EdicaoConfiguracao) => {
    if (!this.rascunho) return;
    const nova = typeof edicao === "function" ? edicao(copiar(this.rascunho)) : edicao;
    if (assinatura(nova) === assinatura(this.rascunho)) return;
    this.rascunho = copiar(nova);
    this.versaoRascunho += 1;
    this.ultimoAjuste = Date.now();
    this.emitir();
    this.agendar();
  };

  definirEtapa = (etapa: number) => {
    if (!this.tela || !Number.isInteger(etapa) || etapa < 0 || etapa > 5 || this.etapa === etapa) return;
    this.etapa = etapa;
    this.versaoEtapa += 1;
    this.ultimoAjuste = Date.now();
    this.emitir();
    this.agendar();
  };

  private gravar = (): Promise<TelaConfiguracaoNexa> => {
    this.cancelarEspera();
    if (this.emVoo) return this.emVoo;
    if (this.erro) return Promise.reject(this.erro);
    if (!this.tela || !this.rascunho) return Promise.reject(new Error("A configuração ainda está carregando."));
    if (!this.temAlteracoes()) return Promise.resolve(this.tela);
    const versaoRascunho = this.versaoRascunho;
    const versaoEtapa = this.versaoEtapa;
    const pedido = copiar({ revisao: this.tela.revisao, rascunho: this.rascunho, etapa: this.etapa });
    const operacao = Promise.resolve().then(() => this.opcoes.salvar(pedido)).then(nova => {
      this.tela = copiar(nova);
      if (this.versaoRascunho === versaoRascunho) this.rascunho = copiar(nova.rascunho);
      if (this.versaoEtapa === versaoEtapa) this.etapa = nova.etapa;
      this.precisaRevalidar = false;
      return this.tela;
    }).catch((falha: unknown) => {
      this.erro = falha instanceof Error ? falha as FalhaAutosaveConfiguracao : new Error("Não foi possível salvar. Suas alterações continuam nesta tela.");
      this.precisaRevalidar = true;
      throw this.erro;
    }).finally(() => {
      this.emVoo = null;
      this.emitir();
      this.agendar();
    });
    this.emVoo = operacao;
    this.emitir();
    return operacao;
  };

  /** Testes e publicação só devem começar depois desta promessa resolver. */
  garantirSalvo = async (): Promise<TelaConfiguracaoNexa> => {
    this.cancelarEspera();
    if (this.erro) throw this.erro;
    do {
      await this.gravar();
      this.cancelarEspera();
      if (this.erro) throw this.erro;
    } while (this.emVoo || this.temAlteracoes());
    return this.tela!;
  };

  /** A edição não repete uma falha silenciosamente; a repetição é uma ação explícita. */
  tentarNovamente = async (): Promise<TelaConfiguracaoNexa> => {
    this.erro = null;
    this.emitir();
    return this.garantirSalvo();
  };

  suspender = () => {
    this.ativo = false;
    this.cancelarEspera();
    // A navegação do SPA pode desmontar a tela antes do debounce. A promessa
    // continua fora do React e drena a fila, sem repetir falhas ou abortar PUTs.
    if (this.tela && !this.erro && (this.emVoo || this.temAlteracoes())) {
      void this.garantirSalvo().catch(() => { /* Melhor esforço; a falha continua preservada no controlador. */ });
    }
  };
  retomar = () => { this.ativo = true; this.agendar(); };
}

export function useConfiguracaoAutosave({ salvar, debounceMs, protegerSaida = true }: OpcoesAutosave & { protegerSaida?: boolean }) {
  const salvarRef = useRef(salvar);
  salvarRef.current = salvar;
  const controleRef = useRef<ControladorConfiguracaoAutosave | null>(null);
  if (!controleRef.current) controleRef.current = new ControladorConfiguracaoAutosave({ salvar: pedido => salvarRef.current(pedido), debounceMs });
  const controle = controleRef.current;
  const snapshot = useSyncExternalStore(controle.assinar, controle.obterEstado, controle.obterEstado);

  useEffect(() => { controle.retomar(); return controle.suspender; }, [controle]);
  useEffect(() => {
    if (!protegerSaida) return;
    const antesDeSair = (evento: BeforeUnloadEvent) => {
      if (!controle.obterEstado().pendente) return;
      evento.preventDefault(); evento.returnValue = "";
    };
    const navegar = (evento: MouseEvent) => {
      if (!controle.obterEstado().pendente || evento.defaultPrevented || evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey) return;
      const link = (evento.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(link.href, window.location.href);
      if (!["http:", "https:"].includes(url.protocol) || url.href === window.location.href) return;
      evento.preventDefault(); evento.stopPropagation();
      void controle.garantirSalvo().then(() => window.location.assign(url.href)).catch(() => { /* Permanece na tela para corrigir a falha. */ });
    };
    window.addEventListener("beforeunload", antesDeSair);
    document.addEventListener("click", navegar, true);
    return () => { window.removeEventListener("beforeunload", antesDeSair); document.removeEventListener("click", navegar, true); };
  }, [controle, protegerSaida]);

  return {
    ...snapshot,
    iniciar: controle.iniciar, editar: controle.editar, definirEtapa: controle.definirEtapa,
    sincronizar: controle.sincronizar, garantirSalvo: controle.garantirSalvo, tentarNovamente: controle.tentarNovamente,
    descartarAlteracoes: controle.descartarAlteracoes, obterEstado: controle.obterEstado,
  };
}
