"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Servico = {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
};

type AgendamentoItem = {
  id: string;
  clienteId: string;
  nome: string;
  telefone: string;
  servicoId: string | null;
  servicoNome: string;
  valorCents: number;
  duracaoMin: number;
  data: string;
  horaInicio: string;
  horaFim: string;
  horarioFormatado: string;
  status: "MARCADO" | "CONFIRMADO" | "ATENDIDO" | "CANCELADO" | "FALTOU";
  source: string;
  observacoes: string;
  historicoVisitas: number;
  cicloDias: number;
  cicloConfianca: string;
  proximoRetornoEsperado: string | null;
};

type ResumoAgenda = {
  totalGeral: number;
  totalMarcados: number;
  totalConfirmados: number;
  totalConcluidos: number;
  totalCancelados: number;
  receitaRealizadaCents: number;
  receitaPrevistaCents: number;
  totalClientesNaBase: number;
};

function dataHojeIso(): string {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function somarDiasIso(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  d.setDate(d.getDate() + dias);
  const novoAno = d.getFullYear();
  const novoMes = String(d.getMonth() + 1).padStart(2, "0");
  const novoDia = String(d.getDate()).padStart(2, "0");
  return `${novoAno}-${novoMes}-${novoDia}`;
}

function formatarDataExtenso(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  const opcoes: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return d.toLocaleDateString("pt-BR", opcoes);
}

function formatarEmReais(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarTelefone(telefone: string): string {
  const limpo = telefone.replace(/\D/g, "");
  if (limpo.length === 11) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
  }
  if (limpo.length === 10) {
    return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  }
  return telefone;
}

export default function PaginaAgenda() {
  const [dataSelecionada, setDataSelecionada] = useState<string>(dataHojeIso());
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [resumo, setResumo] = useState<ResumoAgenda | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [linkPublico, setLinkPublico] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string>("");
  const [feedbackAcao, setFeedbackAcao] = useState<string>("");

  // Modal Novo Agendamento
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [formNome, setFormNome] = useState<string>("");
  const [formTelefone, setFormTelefone] = useState<string>("");
  const [formServicoId, setFormServicoId] = useState<string>("");
  const [formServicoNome, setFormServicoNome] = useState<string>("");
  const [formValor, setFormValor] = useState<string>("");
  const [formHora, setFormHora] = useState<string>("09:00");
  const [formDuracaoMin, setFormDuracaoMin] = useState<number>(30);
  const [formJaAtendido, setFormJaAtendido] = useState<boolean>(false);
  const [formObservacoes, setFormObservacoes] = useState<string>("");

  // Modal Link Público
  const [modalLinkAberto, setModalLinkAberto] = useState<boolean>(false);
  const [linkCopiado, setLinkCopiado] = useState<boolean>(false);

  const carregarAgenda = async (dataAlvo: string) => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/agenda?data=${dataAlvo}`);
      if (!res.ok) {
        throw new Error("Erro ao carregar os atendimentos");
      }
      const data = await res.json();
      setAgendamentos(data.agendamentos || []);
      setResumo(data.resumo || null);
      setServicos(data.servicos || []);
      setEmpresaNome(data.empresaNome || "");
      setLinkPublico(data.linkPublico || null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar a agenda";
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarAgenda(dataSelecionada);
  }, [dataSelecionada]);

  const handleMudarStatus = async (
    id: string,
    novoStatus: "CONFIRMADO" | "ATENDIDO" | "CANCELADO" | "FALTOU",
    valorCents?: number,
    servicoNome?: string,
  ) => {
    try {
      const res = await fetch(`/api/agenda/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: novoStatus,
          valorCents,
          servicoNome,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não consegui atualizar o atendimento");
        return;
      }
      setFeedbackAcao(data.mensagem || "Status atualizado!");
      setTimeout(() => setFeedbackAcao(""), 4000);
      carregarAgenda(dataSelecionada);
    } catch {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Deseja realmente remover este agendamento?")) return;
    try {
      const res = await fetch(`/api/agenda/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFeedbackAcao("Agendamento removido.");
        setTimeout(() => setFeedbackAcao(""), 3000);
        carregarAgenda(dataSelecionada);
      }
    } catch {
      alert("Erro ao excluir agendamento.");
    }
  };

  const handleSalvarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formTelefone.trim() || !formHora.trim()) {
      alert("Preencha nome, WhatsApp e horário.");
      return;
    }

    setSalvando(true);
    try {
      let valorCents = 0;
      if (formValor.trim()) {
        const limpo = formValor.replace(/[^\d,.]/g, "").replace(",", ".");
        valorCents = Math.round(parseFloat(limpo) * 100) || 0;
      }

      const res = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formNome.trim(),
          telefone: formTelefone.trim(),
          serviceId: formServicoId || undefined,
          servicoNome: formServicoNome.trim() || undefined,
          valorCents,
          data: dataSelecionada,
          hora: formHora,
          duracaoMin: formDuracaoMin,
          observacoes: formObservacoes.trim() || undefined,
          jaAtendido: formJaAtendido,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não consegui criar o agendamento");
        return;
      }

      setFeedbackAcao(data.mensagem || "Atendimento agendado com sucesso!");
      setTimeout(() => setFeedbackAcao(""), 4500);

      // Reset form
      setFormNome("");
      setFormTelefone("");
      setFormServicoId("");
      setFormServicoNome("");
      setFormValor("");
      setFormHora("09:00");
      setFormDuracaoMin(30);
      setFormJaAtendido(false);
      setFormObservacoes("");
      setModalAberto(false);

      carregarAgenda(dataSelecionada);
    } catch {
      alert("Erro ao salvar agendamento.");
    } finally {
      setSalvando(false);
    }
  };

  const copiarLinkPublico = () => {
    if (!linkPublico) return;
    navigator.clipboard.writeText(linkPublico);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  const hoje = dataHojeIso();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Feedback Toast */}
      {feedbackAcao && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-night p-4 text-sm font-medium text-emerald-300 shadow-2xl animate-fade-in">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            ✓
          </span>
          <span>{feedbackAcao}</span>
        </div>
      )}

      {/* Topo da Agenda */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-panel-ink sm:text-3xl">
              Agenda Inteligente
            </h1>
            <span className="rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-semibold text-amber">
              Auto-cadastro ativo
            </span>
          </div>
          <p className="mt-1 text-sm text-panel-sub">
            Cadastre os atendimentos do seu negócio. A Nexora salva seus clientes sozinhos e
            avisa quando eles sumirem.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {linkPublico && (
            <button
              onClick={() => setModalLinkAberto(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-panel-line bg-panel-card px-3.5 py-2.5 text-xs font-semibold text-panel-ink transition hover:border-amber/40 hover:text-amber"
            >
              <span>🔗</span>
              <span>Meu link de agendamento</span>
            </button>
          )}

          <button
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-night shadow-md transition hover:bg-amber-hover"
          >
            <span>+</span>
            <span>Novo agendamento</span>
          </button>
        </div>
      </div>

      {/* Barra de Seleção de Data */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-panel-line bg-panel-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDataSelecionada(somarDiasIso(dataSelecionada, -1))}
            className="rounded-lg border border-panel-line px-3 py-1.5 text-xs font-medium text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
          >
            ← Dia anterior
          </button>
          <button
            onClick={() => setDataSelecionada(hoje)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              dataSelecionada === hoje
                ? "bg-amber text-night"
                : "border border-panel-line bg-panel-bg text-panel-ink hover:border-amber/30"
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setDataSelecionada(somarDiasIso(hoje, 1))}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
              dataSelecionada === somarDiasIso(hoje, 1)
                ? "bg-amber text-night font-bold"
                : "border border-panel-line bg-panel-bg text-panel-sub hover:text-panel-ink"
            }`}
          >
            Amanhã
          </button>
          <button
            onClick={() => setDataSelecionada(somarDiasIso(dataSelecionada, 1))}
            className="rounded-lg border border-panel-line px-3 py-1.5 text-xs font-medium text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
          >
            Próximo dia →
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs font-medium text-panel-sub sm:inline capitalize">
            {formatarDataExtenso(dataSelecionada)}
          </span>
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => e.target.value && setDataSelecionada(e.target.value)}
            className="rounded-lg border border-panel-line bg-panel-bg px-3 py-1.5 text-xs font-medium text-panel-ink focus:border-amber focus:outline-none"
          />
        </div>
      </div>

      {/* Resumo do Dia em Cards Rápidos */}
      {resumo && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-panel-line bg-panel-card p-3.5">
            <span className="text-xs font-medium text-panel-sub">Atendimentos no dia</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-panel-ink">
                {resumo.totalGeral}
              </span>
              <span className="text-xs text-panel-sub">
                ({resumo.totalConcluidos} concluídos)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-panel-line bg-panel-card p-3.5">
            <span className="text-xs font-medium text-panel-sub">Confirmados</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-amber">
                {resumo.totalConfirmados}
              </span>
              <span className="text-xs text-panel-sub">horários</span>
            </div>
          </div>

          <div className="rounded-xl border border-panel-line bg-panel-card p-3.5">
            <span className="text-xs font-medium text-panel-sub">Receita concluída</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-emerald-400">
                {formatarEmReais(resumo.receitaRealizadaCents)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-panel-line bg-panel-card p-3.5">
            <span className="text-xs font-medium text-panel-sub">Clientes na sua lista</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-panel-ink">
                {resumo.totalClientesNaBase}
              </span>
              <span className="text-xs text-panel-sub">sob radar</span>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Atendimentos */}
      <div className="mt-6">
        {carregando ? (
          <div className="rounded-2xl border border-panel-line bg-panel-card p-12 text-center text-sm text-panel-sub">
            Carregando agenda...
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-400">
            {erro}
          </div>
        ) : agendamentos.length === 0 ? (
          <div className="rounded-2xl border border-panel-line bg-panel-card p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-2xl text-amber">
              🗓️
            </div>
            <h3 className="mt-4 font-display text-lg font-bold text-panel-ink">
              Nenhum atendimento agendado para este dia
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-panel-sub">
              Você pode marcar um atendimento agora em poucos segundos ou compartilhar seu link
              de agendamento para seus clientes marcarem sozinhos.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setModalAberto(true)}
                className="rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-night hover:bg-amber-hover"
              >
                + Novo agendamento
              </button>
              {linkPublico && (
                <button
                  onClick={() => setModalLinkAberto(true)}
                  className="rounded-xl border border-panel-line bg-panel-bg px-4 py-2.5 text-sm font-semibold text-panel-ink hover:border-amber/40"
                >
                  Ver link de agendamento
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentos.map((ag) => {
              const isConcluido = ag.status === "ATENDIDO";
              const isConfirmado = ag.status === "CONFIRMADO";
              const isCancelado = ag.status === "CANCELADO" || ag.status === "FALTOU";

              const whatsappUrl = `https://wa.me/55${ag.telefone}?text=${encodeURIComponent(
                `Oi ${ag.nome.split(" ")[0]}, tudo bem? Passando para confirmar seu horário agendado para ${ag.data === hoje ? "hoje" : "o dia " + ag.data} às ${ag.horaInicio} aqui na ${empresaNome || "nossa unidade"}. Podemos confirmar?`,
              )}`;

              return (
                <div
                  key={ag.id}
                  className={`flex flex-col gap-4 rounded-2xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                    isConcluido
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : isCancelado
                        ? "border-panel-line bg-panel-card opacity-60"
                        : "border-panel-line bg-panel-card hover:border-amber/30"
                  }`}
                >
                  {/* Horário e Identificação */}
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-panel-bg px-3 py-2 text-center border border-panel-line min-w-[75px]">
                      <span className="font-mono text-sm font-bold text-panel-ink">
                        {ag.horaInicio}
                      </span>
                      <span className="font-mono text-[10px] text-panel-sub">
                        até {ag.horaFim}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold text-panel-ink">
                          {ag.nome}
                        </span>

                        {/* Badges de Status */}
                        {isConcluido ? (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                            Concluído ✓
                          </span>
                        ) : isConfirmado ? (
                          <span className="rounded-md border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber">
                            Confirmado
                          </span>
                        ) : isCancelado ? (
                          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400">
                            {ag.status === "FALTOU" ? "Faltou" : "Cancelado"}
                          </span>
                        ) : (
                          <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                            Marcado
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-panel-sub">
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-panel-sub hover:text-emerald-400 hover:underline"
                          title="Conversar no WhatsApp"
                        >
                          <span>💬</span>
                          <span>{formatarTelefone(ag.telefone)}</span>
                        </a>

                        <span>•</span>
                        <span className="font-medium text-panel-ink">
                          {ag.servicoNome}
                        </span>

                        {ag.valorCents > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-amber">
                              {formatarEmReais(ag.valorCents)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Tag de Monitoramento Inteligente */}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {ag.historicoVisitas > 1 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-panel-bg px-2 py-0.5 text-panel-sub border border-panel-line">
                            <span>🔁</span>
                            <span>Cliente assíduo · costuma voltar a cada {ag.cicloDias} dias</span>
                          </span>
                        ) : ag.historicoVisitas === 1 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-panel-bg px-2 py-0.5 text-panel-sub border border-panel-line">
                            <span>✨</span>
                            <span>1 visita anterior registrada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-panel-bg px-2 py-0.5 text-panel-sub border border-panel-line">
                            <span>🌱</span>
                            <span>Novo cliente cadastrado pela agenda</span>
                          </span>
                        )}

                        {ag.observacoes && (
                          <span className="text-panel-sub italic">
                            Obs: &quot;{ag.observacoes}&quot;
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas com 1 Toque */}
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {!isConcluido && !isCancelado && (
                      <>
                        <button
                          onClick={() =>
                            handleMudarStatus(ag.id, "ATENDIDO", ag.valorCents, ag.servicoNome)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
                          title="Concluir e registrar valor no caixa"
                        >
                          <span>✓</span>
                          <span>Concluir atendimento</span>
                        </button>

                        {!isConfirmado && (
                          <button
                            onClick={() => handleMudarStatus(ag.id, "CONFIRMADO")}
                            className="rounded-xl border border-panel-line bg-panel-bg px-2.5 py-1.5 text-xs font-medium text-panel-ink hover:border-amber/40 hover:text-amber transition"
                          >
                            Confirmar
                          </button>
                        )}

                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-panel-line bg-panel-bg px-2.5 py-1.5 text-xs font-medium text-panel-sub hover:text-panel-ink hover:border-panel-line transition"
                        >
                          Lembrar WhatsApp
                        </a>

                        <button
                          onClick={() => handleMudarStatus(ag.id, "CANCELADO")}
                          className="rounded-xl px-2 py-1.5 text-xs text-panel-sub hover:text-red-400 transition"
                          title="Cancelar horário"
                        >
                          ✕
                        </button>
                      </>
                    )}

                    {isConcluido && (
                      <span className="text-xs text-emerald-400/80 font-medium">
                        Valor registrado no caixa · Monitorado pela Nexora
                      </span>
                    )}

                    {isCancelado && (
                      <button
                        onClick={() => handleRemover(ag.id)}
                        className="text-xs text-panel-sub hover:text-red-400 transition"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Banner / Card de Agendamento Online (Link Público) */}
      {linkPublico && (
        <div className="mt-10 rounded-2xl border border-amber/20 bg-gradient-to-br from-panel-card to-amber/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="rounded-md bg-amber/10 px-2 py-1 text-xs font-bold text-amber">
                Agendamento Online
              </span>
              <h3 className="mt-2 font-display text-lg font-bold text-panel-ink">
                Seus clientes agendam sozinhos pelo seu link público
              </h3>
              <p className="mt-1 max-w-xl text-xs text-panel-sub">
                Coloque o link na bio do seu Instagram ou mande no WhatsApp. O próprio cliente escolhe
                o horário, coloca o nome e já entra na sua lista monitorada sem você digitar nada.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <button
                onClick={copiarLinkPublico}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-night hover:bg-amber-hover transition"
              >
                <span>{linkCopiado ? "Link copiado! ✓" : "Copiar link de agendamento"}</span>
              </button>
              <a
                href={linkPublico}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center text-xs font-semibold text-panel-sub hover:text-amber underline"
              >
                Abrir página como cliente ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Agendamento */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-panel-line bg-night p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-panel-ink">
                  Novo Agendamento
                </h3>
                <p className="text-xs text-panel-sub">
                  O cliente é salvo automaticamente na sua lista.
                </p>
              </div>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-1 text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarAgendamento} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  Nome do cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: (11) 98888-7777"
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-sm text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-panel-sub">
                    Serviço
                  </label>
                  {servicos.length > 0 ? (
                    <select
                      value={formServicoId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setFormServicoId(id);
                        const s = servicos.find((item) => item.id === id);
                        if (s) {
                          setFormServicoNome(s.name);
                          setFormValor((s.priceCents / 100).toFixed(2));
                          setFormDuracaoMin(s.durationMin);
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink focus:border-amber focus:outline-none"
                    >
                      <option value="">Selecionar serviço...</option>
                      {servicos.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatarEmReais(s.priceCents)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ex: Corte e Barba"
                      value={formServicoNome}
                      onChange={(e) => setFormServicoNome(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-panel-sub">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 60,00"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-panel-sub">
                    Horário de início *
                  </label>
                  <input
                    type="time"
                    required
                    value={formHora}
                    onChange={(e) => setFormHora(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink focus:border-amber focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-panel-sub">
                    Duração (minutos)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={360}
                    step={5}
                    value={formDuracaoMin}
                    onChange={(e) => setFormDuracaoMin(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink focus:border-amber focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Preferência com tesoura"
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>

              {/* Checkbox Atendimento Já Realizado */}
              <div className="rounded-xl border border-panel-line bg-panel-card p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formJaAtendido}
                    onChange={(e) => setFormJaAtendido(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-panel-line bg-panel-bg text-amber focus:ring-amber"
                  />
                  <span className="text-xs text-panel-ink">
                    <strong>Atendimento já realizado?</strong>
                    <span className="block text-[11px] text-panel-sub mt-0.5">
                      Registra a visita e o valor imediatamente no seu caixa, e coloca o cliente sob
                      monitoramento de retorno da Nexora.
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-panel-line px-4 py-2.5 text-xs font-semibold text-panel-sub hover:text-panel-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-amber px-5 py-2.5 text-xs font-bold text-night hover:bg-amber-hover transition disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar agendamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Link Público */}
      {modalLinkAberto && linkPublico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-panel-line bg-night p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <h3 className="font-display text-lg font-bold text-panel-ink">
                Seu Link Público de Agendamento
              </h3>
              <button
                onClick={() => setModalLinkAberto(false)}
                className="rounded-lg p-1 text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-panel-sub leading-relaxed">
                Envie este link para seus clientes no WhatsApp ou cole no perfil do Instagram.
                Quem agendar por ele escolhe o serviço e o horário, e entra automaticamente na sua lista.
              </p>

              <div className="flex items-center gap-2 rounded-xl border border-panel-line bg-panel-bg p-2">
                <input
                  type="text"
                  readOnly
                  value={linkPublico}
                  className="w-full bg-transparent px-2 text-xs font-mono text-panel-ink focus:outline-none"
                />
                <button
                  onClick={copiarLinkPublico}
                  className="whitespace-nowrap rounded-lg bg-amber px-3 py-1.5 text-xs font-bold text-night hover:bg-amber-hover"
                >
                  {linkCopiado ? "Copiado!" : "Copiar"}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <a
                  href={linkPublico}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-ink hover:border-amber/40 hover:text-amber"
                >
                  Abrir página como cliente ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
