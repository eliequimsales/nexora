"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Profissional = {
  id: string;
  nome: string;
  cargo: string;
};

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
  profissional: string;
  status: "MARCADO" | "CONFIRMADO" | "ATENDIDO" | "CANCELADO" | "FALTOU";
  source: string;
  observacoes: string;
  historicoVisitas: number;
  cicloDias: number;
  cicloConfianca: string;
  proximoRetornoEsperado: string | null;
  lembreteEnviado?: boolean;
  lembreteEnviadoEm?: string | null;
  lembreteStatus?: string;
  mensagemPronta?: string;
  whatsappUrl?: string;
};

type GradeDoDia = {
  data: string;
  profissionais: Profissional[];
  slotsHorario: string[];
  mapaGrade: Record<string, Record<string, AgendamentoItem>>;
  agendamentos: AgendamentoItem[];
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

const HORARIOS_SELECAO = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00",
];

function ajustarHorario(horaAtual: string, deltaMinutos: number): string {
  const [h, m] = (horaAtual || "09:00").split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m) + deltaMinutos));
  const novoH = String(Math.floor(total / 60)).padStart(2, "0");
  const novoM = String(total % 60).padStart(2, "0");
  return `${novoH}:${novoM}`;
}

export default function PaginaAgenda() {
  const [dataSelecionada, setDataSelecionada] = useState<string>(dataHojeIso());
  const [grade, setGrade] = useState<GradeDoDia | null>(null);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [resumo, setResumo] = useState<ResumoAgenda | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [linkPublico, setLinkPublico] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string>("");
  const [feedbackAcao, setFeedbackAcao] = useState<string>("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"grade" | "lista" | "lembretes">("grade");
  const [enviandoLembreteId, setEnviandoLembreteId] = useState<string | null>(null);
  const [disparandoLote, setDisparandoLote] = useState<boolean>(false);

  // Modal Novo Agendamento
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [formNome, setFormNome] = useState<string>("");
  const [formTelefone, setFormTelefone] = useState<string>("");
  const [formProfissional, setFormProfissional] = useState<string>("");
  const [formServicoId, setFormServicoId] = useState<string>("");
  const [formServicoNome, setFormServicoNome] = useState<string>("");
  const [formHora, setFormHora] = useState<string>("09:00");
  const [formObservacoes, setFormObservacoes] = useState<string>("");

  // Modal Detalhes do Agendamento
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<AgendamentoItem | null>(null);

  // Modal Link Público
  const [modalLinkAberto, setModalLinkAberto] = useState<boolean>(false);
  const [linkCopiado, setLinkCopiado] = useState<boolean>(false);

  // Modal Gerenciar Profissionais da Equipe
  const [modalProfissionaisAberto, setModalProfissionaisAberto] = useState<boolean>(false);
  const [listaEditavelProf, setListaEditavelProf] = useState<Profissional[]>([]);
  const [novoProfNome, setNovoProfNome] = useState<string>("");
  const [novoProfCargo, setNovoProfCargo] = useState<string>("Especialista");
  const [salvandoProf, setSalvandoProf] = useState<boolean>(false);

  const carregarAgenda = async (dataAlvo: string) => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/agenda?data=${dataAlvo}`);
      if (!res.ok) {
        throw new Error("Erro ao carregar os atendimentos");
      }
      const data = await res.json();
      setGrade(data.grade || null);
      setProfissionais(data.profissionais || data.grade?.profissionais || []);
      setAgendamentos(data.agendamentos || data.grade?.agendamentos || []);
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

  // Lista consolidada de profissionais para exibição em colunas
  const profissionaisExibidos = useMemo(() => {
    const list: { nome: string; cargo: string }[] = [];
    const nomesAdicionados = new Set<string>();

    for (const p of profissionais) {
      if (!nomesAdicionados.has(p.nome)) {
        nomesAdicionados.add(p.nome);
        list.push({ nome: p.nome, cargo: p.cargo || "Profissional" });
      }
    }

    // Se houver algum agendamento com profissional que não esteja cadastrado na lista
    for (const ag of agendamentos) {
      if (ag.profissional && !nomesAdicionados.has(ag.profissional)) {
        nomesAdicionados.add(ag.profissional);
        list.push({ nome: ag.profissional, cargo: "Equipe" });
      }
    }

    if (list.length === 0) {
      return [
        { nome: "Atendimento Principal", cargo: "Especialista" },
        { nome: "Equipe de Atendimento", cargo: "Profissional" },
      ];
    }

    return list;
  }, [profissionais, agendamentos]);

  // Abrir modal de novo agendamento para um slot específico
  const abrirNovoParaSlot = (horario: string, profissionalNome: string) => {
    setFormHora(horario);
    setFormProfissional(profissionalNome);
    setFormNome("");
    setFormTelefone("");
    setFormServicoId("");
    setFormServicoNome("");
    setFormObservacoes("");
    setModalAberto(true);
  };

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
      setFeedbackAcao(data.mensagem || "Status atualizado com sucesso!");
      setTimeout(() => setFeedbackAcao(""), 4000);
      if (agendamentoSelecionado && agendamentoSelecionado.id === id) {
        setAgendamentoSelecionado(null);
      }
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
        if (agendamentoSelecionado?.id === id) {
          setAgendamentoSelecionado(null);
        }
        carregarAgenda(dataSelecionada);
      }
    } catch {
      alert("Erro ao excluir agendamento.");
    }
  };

  const handleEnviarLembrete = async (agendamentoId?: string, emLote = false) => {
    if (emLote) {
      setDisparandoLote(true);
    } else if (agendamentoId) {
      setEnviandoLembreteId(agendamentoId);
    }

    try {
      const res = await fetch("/api/agenda/lembrete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendamentoId,
          emLote,
          data: dataSelecionada,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não consegui enviar o lembrete agora.");
        return;
      }

      setFeedbackAcao(data.mensagem || "Lembrete processado com sucesso!");
      setTimeout(() => setFeedbackAcao(""), 4500);

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
      }

      carregarAgenda(dataSelecionada);
    } catch {
      alert("Erro de conexão ao enviar lembrete.");
    } finally {
      setEnviandoLembreteId(null);
      setDisparandoLote(false);
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
      let duracaoMin = 30;
      if (formServicoId) {
        const s = servicos.find((item) => item.id === formServicoId);
        if (s) {
          valorCents = s.priceCents;
          duracaoMin = s.durationMin || 30;
        }
      }

      const profNome = formProfissional.trim() || profissionaisExibidos[0]?.nome || "Breno Silva";

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
          duracaoMin,
          profissionalNome: profNome,
          observacoes: formObservacoes.trim() || undefined,
          jaAtendido: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não consegui criar o agendamento");
        return;
      }

      setFeedbackAcao(data.mensagem || "Atendimento registrado e cliente sob radar!");
      setTimeout(() => setFeedbackAcao(""), 4500);

      // Reset form
      setFormNome("");
      setFormTelefone("");
      setFormServicoId("");
      setFormServicoNome("");
      setFormHora("09:00");
      setFormObservacoes("");
      setModalAberto(false);

      carregarAgenda(dataSelecionada);
    } catch {
      alert("Erro ao salvar agendamento.");
    } finally {
      setSalvando(false);
    }
  };

  const abrirModalProfissionais = () => {
    setListaEditavelProf(
      profissionais.length > 0
        ? [...profissionais]
        : [
            { id: "prof_1", nome: "Atendimento Principal", cargo: "Especialista" },
            { id: "prof_2", nome: "Equipe de Atendimento", cargo: "Profissional" },
          ],
    );
    setModalProfissionaisAberto(true);
  };

  const handleAdicionarProfissional = () => {
    if (!novoProfNome.trim()) return;
    const novo: Profissional = {
      id: `prof_${Date.now()}`,
      nome: novoProfNome.trim(),
      cargo: novoProfCargo.trim() || "Profissional",
    };
    setListaEditavelProf([...listaEditavelProf, novo]);
    setNovoProfNome("");
  };

  const handleRemoverProfissional = (id: string) => {
    if (listaEditavelProf.length <= 1) {
      alert("Mantenha ao menos um profissional na equipe.");
      return;
    }
    setListaEditavelProf(listaEditavelProf.filter((p) => p.id !== id));
  };

  const handleSalvarProfissionais = async () => {
    setSalvandoProf(true);
    try {
      const res = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "salvar_profissionais",
          profissionais: listaEditavelProf,
        }),
      });
      if (!res.ok) {
        alert("Erro ao salvar a equipe.");
        return;
      }
      setFeedbackAcao("Equipe de profissionais atualizada!");
      setTimeout(() => setFeedbackAcao(""), 3500);
      setModalProfissionaisAberto(false);
      carregarAgenda(dataSelecionada);
    } catch {
      alert("Erro ao salvar profissionais.");
    } finally {
      setSalvandoProf(false);
    }
  };

  const copiarLinkPublico = () => {
    if (!linkPublico) return;
    navigator.clipboard.writeText(linkPublico);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 3000);
  };

  const hoje = dataHojeIso();

  // Slots de horário para a grade (das 08:00 às 20:00 de 15 em 15 min)
  const slotsHorario = useMemo(() => {
    if (grade?.slotsHorario && grade.slotsHorario.length > 0) {
      return grade.slotsHorario;
    }
    const slots: string[] = [];
    for (let h = 8; h <= 20; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === 20 && m > 0) break;
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
      }
    }
    return slots;
  }, [grade]);

  // Mapa rápido de agendamentos: [horario][profissional]
  const mapaGrade = useMemo(() => {
    const mapa: Record<string, Record<string, AgendamentoItem>> = {};
    for (const ag of agendamentos) {
      if (ag.status === "CANCELADO") continue;
      if (!mapa[ag.horaInicio]) mapa[ag.horaInicio] = {};
      const prof = ag.profissional || "Breno Silva";
      mapa[ag.horaInicio][prof] = ag;
    }
    return mapa;
  }, [agendamentos]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Toast de Confirmação */}
      {feedbackAcao && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-night p-4 text-sm font-medium text-emerald-300 shadow-2xl animate-fade-in">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            ✓
          </span>
          <span>{feedbackAcao}</span>
        </div>
      )}

      {/* Topo da Agenda (Idêntico ao design de sistemas líderes) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-panel-ink sm:text-4xl">
            Agenda
          </h1>
          <p className="mt-1 text-sm font-medium text-panel-sub capitalize">
            {formatarDataExtenso(dataSelecionada)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Navegação Rápida entre Dias: < Hoje > */}
          <div className="flex items-center rounded-xl border border-panel-line bg-panel-card p-1 shadow-sm">
            <button
              onClick={() => setDataSelecionada(somarDiasIso(dataSelecionada, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
              title="Dia anterior"
            >
              ‹
            </button>
            <button
              onClick={() => setDataSelecionada(hoje)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                dataSelecionada === hoje
                  ? "bg-amber text-night"
                  : "text-panel-sub hover:text-panel-ink"
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDataSelecionada(somarDiasIso(dataSelecionada, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
              title="Próximo dia"
            >
              ›
            </button>
          </div>

          {/* Seletor de Data Direto */}
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => e.target.value && setDataSelecionada(e.target.value)}
            className="rounded-xl border border-panel-line bg-panel-card px-3 py-2 text-xs font-medium text-panel-ink shadow-sm focus:border-amber focus:outline-none"
          />

          {/* Botão de Link Público */}
          {linkPublico && (
            <button
              onClick={() => setModalLinkAberto(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-panel-line bg-panel-card px-3.5 py-2.5 text-xs font-semibold text-panel-ink shadow-sm transition hover:border-amber/40 hover:text-amber"
              title="Link para clientes agendarem sozinhos"
            >
              <span>🔗</span>
              <span className="hidden sm:inline">Link de agendamento</span>
            </button>
          )}

          {/* Botão de Profissionais */}
          <button
            onClick={abrirModalProfissionais}
            className="inline-flex items-center gap-2 rounded-xl border border-panel-line bg-panel-card px-3.5 py-2.5 text-xs font-semibold text-panel-ink shadow-sm transition hover:border-amber/40 hover:text-amber"
            title="Adicionar ou editar profissionais"
          >
            <span>👥</span>
            <span className="hidden sm:inline">Equipe</span>
          </button>

          {/* Botão Novo Agendamento */}
          <button
            onClick={() => {
              setFormHora("09:00");
              setFormProfissional(profissionaisExibidos[0]?.nome || "Breno Silva");
              setModalAberto(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-night shadow-md transition hover:bg-amber-hover"
          >
            <span>+</span>
            <span>Novo agendamento</span>
          </button>
        </div>
      </div>

      {/* Faixa de Métricas e Indicadores do Dia */}
      {resumo && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-panel-line bg-panel-card p-3.5 shadow-sm">
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

          <div className="rounded-2xl border border-panel-line bg-panel-card p-3.5 shadow-sm">
            <span className="text-xs font-medium text-panel-sub">Confirmados</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-amber">
                {resumo.totalConfirmados}
              </span>
              <span className="text-xs text-panel-sub">horários</span>
            </div>
          </div>

          <div className="rounded-2xl border border-panel-line bg-panel-card p-3.5 shadow-sm">
            <span className="text-xs font-medium text-panel-sub">Receita concluída</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-emerald-400">
                {formatarEmReais(resumo.receitaRealizadaCents)}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-panel-line bg-panel-card p-3.5 shadow-sm">
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

      {/* Alternador de visualização: Grade por Profissional vs Lista corrida */}
      <div className="mt-5 flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-panel-line bg-panel-card p-1 text-xs font-semibold">
          <button
            onClick={() => setModoVisualizacao("grade")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              modoVisualizacao === "grade"
                ? "bg-amber text-night font-bold shadow-sm"
                : "text-panel-sub hover:text-panel-ink"
            }`}
          >
            <span>📊</span>
            <span>Grade por profissional</span>
          </button>
          <button
            onClick={() => setModoVisualizacao("lista")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              modoVisualizacao === "lista"
                ? "bg-amber text-night font-bold shadow-sm"
                : "text-panel-sub hover:text-panel-ink"
            }`}
          >
            <span>📋</span>
            <span>Lista ({agendamentos.length})</span>
          </button>
          <button
            onClick={() => setModoVisualizacao("lembretes")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              modoVisualizacao === "lembretes"
                ? "bg-amber text-night font-bold shadow-sm"
                : "text-panel-sub hover:text-panel-ink"
            }`}
          >
            <span>🔔</span>
            <span>Lembretes anti-faltas</span>
          </button>
        </div>

        <span className="hidden text-xs text-panel-sub sm:inline">
          Clique em qualquer horário livre com <strong>+</strong> para agendar
        </span>
      </div>

      {/* Estado de Carregamento / Erro */}
      {carregando ? (
        <div className="mt-6 rounded-2xl border border-panel-line bg-panel-card p-16 text-center text-sm text-panel-sub">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          Carregando a grade da agenda...
        </div>
      ) : erro ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-400">
          {erro}
        </div>
      ) : modoVisualizacao === "grade" ? (
        /* ========================================================================= */
        /* GRADE MULTI-COLUNAS (EXATAMENTE COMO NA IMAGEM DE REFERÊNCIA)            */
        /* ========================================================================= */
        <div className="mt-4 overflow-hidden rounded-2xl border border-panel-line bg-panel-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-panel-line bg-panel-bg/60">
                  {/* Coluna de Horário fixa */}
                  <th className="sticky left-0 z-20 w-24 min-w-[90px] border-r border-panel-line bg-panel-card px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-panel-sub">
                    Horário
                  </th>

                  {/* Colunas dos Profissionais */}
                  {profissionaisExibidos.map((prof) => (
                    <th
                      key={prof.nome}
                      className="min-w-[240px] px-6 py-3.5 border-r border-panel-line/60 last:border-r-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display text-sm font-bold text-panel-ink">
                            {prof.nome}
                          </div>
                          <div className="text-xs text-panel-sub">{prof.cargo}</div>
                        </div>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel-bg text-xs text-panel-sub">
                          👤
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-panel-line/40">
                {slotsHorario.map((slot) => {
                  return (
                    <tr
                      key={slot}
                      className="group/row transition-colors hover:bg-panel-bg/30 h-[58px]"
                    >
                      {/* Célula de Horário (Sticky na esquerda) */}
                      <td className="sticky left-0 z-10 border-r border-panel-line bg-panel-card px-4 py-2 text-center font-mono text-xs font-medium text-panel-sub">
                        {slot}
                      </td>

                      {/* Células de cada Profissional */}
                      {profissionaisExibidos.map((prof) => {
                        const ag = mapaGrade[slot]?.[prof.nome];

                        return (
                          <td
                            key={`${slot}-${prof.nome}`}
                            className="p-1.5 border-r border-panel-line/40 last:border-r-0 align-middle"
                          >
                            {ag ? (
                              /* CARD DE ATENDIMENTO AGENDADO (IDÊNTICO À IMAGEM) */
                              <div
                                onClick={() => setAgendamentoSelecionado(ag)}
                                className={`group relative cursor-pointer rounded-xl border p-2.5 transition shadow-sm hover:scale-[1.01] hover:shadow-md ${
                                  ag.status === "ATENDIDO"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                    : ag.status === "CONFIRMADO"
                                      ? "border-amber/50 bg-amber/10 text-panel-ink"
                                      : "border-sky-500/30 bg-sky-500/10 text-panel-ink"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="truncate font-display text-xs font-bold text-panel-ink">
                                    {ag.nome}
                                  </span>
                                  <span className="shrink-0 font-mono text-[11px] font-medium text-panel-sub">
                                    {ag.horaInicio}
                                  </span>
                                </div>

                                <div className="mt-0.5 truncate text-[11px] text-panel-sub">
                                  {ag.servicoNome}
                                </div>

                                <div className="mt-1 flex items-center justify-between">
                                  <span className="font-semibold text-xs text-sky-400">
                                    {ag.valorCents > 0 ? formatarEmReais(ag.valorCents) : "A combinar"}
                                  </span>

                                  {ag.status === "ATENDIDO" && (
                                    <span className="text-[10px] font-bold text-emerald-400">
                                      Concluído ✓
                                    </span>
                                  )}
                                  {ag.status === "CONFIRMADO" && (
                                    <span className="text-[10px] font-semibold text-amber">
                                      Confirmado
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* SLOT LIVRE: BOTÃO "+" COM HOVER EM BOX TRACEJADO (EXATAMENTE COMO NA IMAGEM) */
                              <div
                                onClick={() => abrirNovoParaSlot(slot, prof.nome)}
                                className="group flex h-[46px] w-full cursor-pointer items-center justify-center rounded-xl border border-transparent transition-all duration-150 hover:border-dashed hover:border-sky-400/60 hover:bg-sky-500/5"
                                title={`Agendar horário às ${slot} com ${prof.nome}`}
                              >
                                <span className="text-panel-sub/40 transition group-hover:scale-125 group-hover:text-sky-400 font-bold text-sm">
                                  +
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : modoVisualizacao === "lista" ? (
        /* ========================================================================= */
        /* MODO LISTA CRONOLÓGICA DE ATENDIMENTOS DO DIA                             */
        /* ========================================================================= */
        <div className="mt-4 space-y-3">
          {agendamentos.length === 0 ? (
            <div className="rounded-2xl border border-panel-line bg-panel-card p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 text-2xl text-amber">
                🗓️
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-panel-ink">
                Nenhum atendimento marcado para este dia
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-panel-sub">
                Clique no botão abaixo para adicionar um atendimento ou compartilhe seu link de agendamento.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setModalAberto(true)}
                  className="rounded-xl bg-amber px-4 py-2.5 text-sm font-bold text-night hover:bg-amber-hover"
                >
                  + Novo agendamento
                </button>
              </div>
            </div>
          ) : (
            agendamentos.map((ag) => {
              const isConcluido = ag.status === "ATENDIDO";
              const isConfirmado = ag.status === "CONFIRMADO";
              const isCancelado = ag.status === "CANCELADO" || ag.status === "FALTOU";

              const whatsappUrl = `https://wa.me/55${ag.telefone}?text=${encodeURIComponent(
                `Oi ${ag.nome.split(" ")[0]}, tudo bem? Passando para confirmar seu horário agendado para ${
                  ag.data === hoje ? "hoje" : "o dia " + ag.data
                } às ${ag.horaInicio} com ${ag.profissional || "nossa equipe"}. Podemos confirmar?`,
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

                        <span className="rounded-md border border-panel-line bg-panel-bg px-2 py-0.5 text-[11px] font-medium text-panel-sub">
                          {ag.profissional}
                        </span>

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
                        >
                          <span>💬</span>
                          <span>{formatarTelefone(ag.telefone)}</span>
                        </a>

                        <span>•</span>
                        <span className="font-medium text-panel-ink">{ag.servicoNome}</span>

                        {ag.valorCents > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-amber">
                              {formatarEmReais(ag.valorCents)}
                            </span>
                          </>
                        )}
                      </div>

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
                            <span>Novo cliente salvo pela agenda</span>
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

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {!isConcluido && !isCancelado && (
                      <>
                        <button
                          onClick={() =>
                            handleMudarStatus(ag.id, "ATENDIDO", ag.valorCents, ag.servicoNome)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30 transition"
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
                          className="rounded-xl border border-panel-line bg-panel-bg px-2.5 py-1.5 text-xs font-medium text-panel-sub hover:text-panel-ink"
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
                        Valor no caixa · Monitorado pela Nexora
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
            })
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* CENTRAL DE LEMBRETES ANTI-FALTAS                                          */
        /* ========================================================================= */
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-amber/30 bg-amber/5 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber/20 px-2.5 py-0.5 text-xs font-bold text-amber">
                  <span>🔔</span>
                  <span>Proteção contra Faltas</span>
                </span>
                <h3 className="mt-2 font-display text-base font-bold text-panel-ink">
                  Lembretes de horários para clientes com atendimento marcado
                </h3>
                <p className="mt-0.5 text-xs text-panel-sub max-w-xl leading-relaxed">
                  Lembretes reduzem o esquecimento em até 70%. Envie a mensagem personalizada com os detalhes do atendimento para o WhatsApp do cliente com 1 clique.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEnviarLembrete(undefined, true)}
                  disabled={
                    disparandoLote ||
                    agendamentos.filter(
                      (a) => (a.status === "MARCADO" || a.status === "CONFIRMADO") && !a.lembreteEnviado,
                    ).length === 0
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-night shadow hover:bg-amber-hover transition disabled:opacity-40"
                >
                  <span>⚡</span>
                  <span>{disparandoLote ? "Enviando lembretes..." : "Lembrar todos do dia"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {agendamentos.filter((a) => a.status === "MARCADO" || a.status === "CONFIRMADO").length === 0 ? (
              <div className="rounded-2xl border border-panel-line bg-panel-card p-12 text-center text-xs text-panel-sub">
                Nenhum horário marcado ou confirmado para esta data.
              </div>
            ) : (
              agendamentos
                .filter((a) => a.status === "MARCADO" || a.status === "CONFIRMADO")
                .map((ag) => {
                  const isEnviando = enviandoLembreteId === ag.id;
                  const isJaEnviado = ag.lembreteEnviado;

                  return (
                    <div
                      key={ag.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-panel-line bg-panel-card p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl border border-panel-line bg-panel-bg px-2.5 py-1.5 text-center shrink-0">
                          <span className="font-mono text-xs font-bold text-panel-ink block">
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
                            <span className="rounded-md border border-panel-line bg-panel-bg px-2 py-0.5 text-[11px] text-panel-sub">
                              {ag.profissional}
                            </span>
                            {isJaEnviado ? (
                              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                                ✓ Lembrete enviado
                              </span>
                            ) : (
                              <span className="rounded-md border border-amber/30 bg-amber/10 px-2 py-0.5 text-[11px] font-semibold text-amber">
                                Pendente
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-panel-sub">
                            <span>{ag.servicoNome}</span>
                            <span>•</span>
                            <span className="font-mono">{formatarTelefone(ag.telefone)}</span>
                            {ag.valorCents > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-amber">
                                  {formatarEmReais(ag.valorCents)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEnviarLembrete(ag.id)}
                          disabled={isEnviando}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                            isJaEnviado
                              ? "border border-panel-line bg-panel-bg text-panel-sub hover:text-panel-ink"
                              : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                          }`}
                        >
                          <span>💬</span>
                          <span>
                            {isEnviando
                              ? "Enviando..."
                              : isJaEnviado
                              ? "Reenviar lembrete"
                              : "Lembrar no WhatsApp"}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Banner de Auto-Agendamento Online */}
      {linkPublico && (
        <div className="mt-8 rounded-2xl border border-amber/20 bg-gradient-to-br from-panel-card to-amber/5 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="rounded-md bg-amber/10 px-2 py-1 text-xs font-bold text-amber">
                Agendamento Online Ativo
              </span>
              <h3 className="mt-2 font-display text-lg font-bold text-panel-ink">
                Seus clientes escolhem o serviço e marcam direto no celular
              </h3>
              <p className="mt-1 max-w-xl text-xs text-panel-sub">
                Coloque o link na sua bio do Instagram ou envie no WhatsApp. O cliente vê os horários disponíveis
                em tempo real e agenda sozinho sem você precisar responder na hora.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <button
                onClick={copiarLinkPublico}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-night hover:bg-amber-hover transition shadow-sm"
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

      {/* Modal: Detalhes do Agendamento ao Clicar no Card da Grade */}
      {agendamentoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-panel-line bg-night p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <div>
                <span className="text-[11px] font-semibold text-amber uppercase tracking-wide">
                  Atendimento
                </span>
                <h3 className="font-display text-lg font-bold text-panel-ink">
                  {agendamentoSelecionado.nome}
                </h3>
              </div>
              <button
                onClick={() => setAgendamentoSelecionado(null)}
                className="rounded-lg p-1.5 text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-panel-line bg-panel-card p-3">
                  <span className="text-panel-sub block text-[10px] uppercase">Horário</span>
                  <strong className="text-panel-ink font-mono text-sm">
                    {agendamentoSelecionado.horaInicio} até {agendamentoSelecionado.horaFim}
                  </strong>
                </div>

                <div className="rounded-xl border border-panel-line bg-panel-card p-3">
                  <span className="text-panel-sub block text-[10px] uppercase">Profissional</span>
                  <strong className="text-panel-ink text-sm">
                    {agendamentoSelecionado.profissional}
                  </strong>
                </div>
              </div>

              <div className="rounded-xl border border-panel-line bg-panel-card p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-panel-sub">Serviço:</span>
                  <strong className="text-panel-ink">{agendamentoSelecionado.servicoNome}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-panel-sub">Valor:</span>
                  <strong className="text-amber font-semibold">
                    {agendamentoSelecionado.valorCents > 0
                      ? formatarEmReais(agendamentoSelecionado.valorCents)
                      : "A combinar"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-panel-sub">WhatsApp:</span>
                  <a
                    href={`https://wa.me/55${agendamentoSelecionado.telefone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline font-mono"
                  >
                    {formatarTelefone(agendamentoSelecionado.telefone)} ↗
                  </a>
                </div>
                {agendamentoSelecionado.observacoes && (
                  <div className="border-t border-panel-line/60 pt-2 text-panel-sub italic">
                    Obs: &quot;{agendamentoSelecionado.observacoes}&quot;
                  </div>
                )}
              </div>

              {/* Ações Rápidas */}
              <div className="space-y-2 pt-2">
                {agendamentoSelecionado.status !== "ATENDIDO" && (
                  <button
                    onClick={() =>
                      handleMudarStatus(
                        agendamentoSelecionado.id,
                        "ATENDIDO",
                        agendamentoSelecionado.valorCents,
                        agendamentoSelecionado.servicoNome,
                      )
                    }
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-night hover:bg-emerald-400 transition"
                  >
                    <span>✓</span>
                    <span>Concluir atendimento e registrar no caixa</span>
                  </button>
                )}

                {agendamentoSelecionado.status === "MARCADO" && (
                  <button
                    onClick={() => handleMudarStatus(agendamentoSelecionado.id, "CONFIRMADO")}
                    className="w-full rounded-xl border border-panel-line bg-panel-card px-4 py-2.5 text-xs font-semibold text-panel-ink hover:border-amber/40 hover:text-amber transition"
                  >
                    Confirmar horário
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleEnviarLembrete(agendamentoSelecionado.id)}
                  disabled={enviandoLembreteId === agendamentoSelecionado.id}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber/40 bg-amber/10 px-4 py-2 text-xs font-semibold text-amber hover:bg-amber/20 transition"
                >
                  <span>🔔</span>
                  <span>
                    {enviandoLembreteId === agendamentoSelecionado.id
                      ? "Enviando lembrete..."
                      : agendamentoSelecionado.lembreteEnviado
                      ? "Reenviar lembrete no WhatsApp"
                      : "Enviar lembrete no WhatsApp"}
                  </span>
                </button>

                <a
                  href={`https://wa.me/55${agendamentoSelecionado.telefone}?text=${encodeURIComponent(
                    `Oi ${agendamentoSelecionado.nome.split(" ")[0]}, tudo bem? Passando para confirmar seu horário agendado para ${
                      agendamentoSelecionado.data === hoje ? "hoje" : "o dia " + agendamentoSelecionado.data
                    } às ${agendamentoSelecionado.horaInicio} com ${agendamentoSelecionado.profissional}.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <span>💬</span>
                  <span>Conversar no WhatsApp</span>
                </a>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => handleRemover(agendamentoSelecionado.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Excluir horário
                  </button>
                  <button
                    onClick={() => setAgendamentoSelecionado(null)}
                    className="text-xs text-panel-sub hover:text-panel-ink"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Agendamento */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
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

              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  Profissional da equipe *
                </label>
                <select
                  value={formProfissional}
                  onChange={(e) => setFormProfissional(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs text-panel-ink focus:border-amber focus:outline-none"
                >
                  {profissionaisExibidos.map((p) => (
                    <option key={p.nome} value={p.nome}>
                      {p.nome} ({p.cargo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  Serviço (opcional)
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
                      }
                    }}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-xs text-panel-ink focus:border-amber focus:outline-none"
                  >
                    <option value="">Selecionar serviço (opcional)...</option>
                    {servicos.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Nome do serviço"
                    value={formServicoNome}
                    onChange={(e) => setFormServicoNome(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                  />
                )}
              </div>

              {/* Seletor de Horário Clicável Mobile-First */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-panel-sub">
                    Horário do atendimento *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormHora((prev) => ajustarHorario(prev, -15))}
                      className="rounded-lg border border-panel-line bg-panel-bg px-2 py-0.5 text-xs font-bold text-panel-ink hover:border-amber/40 hover:text-amber transition"
                      title="Voltar 15 minutos"
                    >
                      -15m
                    </button>
                    <span className="rounded-lg bg-amber px-2.5 py-0.5 font-mono text-xs font-bold text-night shadow-sm">
                      {formHora}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormHora((prev) => ajustarHorario(prev, 15))}
                      className="rounded-lg border border-panel-line bg-panel-bg px-2 py-0.5 text-xs font-bold text-panel-ink hover:border-amber/40 hover:text-amber transition"
                      title="Avançar 15 minutos"
                    >
                      +15m
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-xl border border-panel-line bg-panel-bg">
                  {HORARIOS_SELECAO.map((h) => {
                    const ativo = formHora === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setFormHora(h)}
                        className={`rounded-lg py-1.5 text-center font-mono text-xs transition ${
                          ativo
                            ? "bg-amber text-night font-bold shadow-sm"
                            : "bg-panel-card border border-panel-line/60 text-panel-sub hover:border-amber/40 hover:text-panel-ink"
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Alguma anotação sobre o atendimento"
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>

              {/* Registro Automático e Monitoramento Ativo (Sem Checkbox) */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] mt-0.5">
                  ✓
                </span>
                <span className="leading-snug">
                  <strong>Atendimento ativo e monitorado:</strong> a visita é registrada automaticamente no seu caixa e a Nexora acompanha o retorno deste cliente.
                </span>
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

      {/* Modal: Gerenciar Equipe de Profissionais */}
      {modalProfissionaisAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-panel-line bg-night p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-panel-ink">
                  Profissionais da Equipe
                </h3>
                <p className="text-xs text-panel-sub">
                  Adicione quem atende no seu negócio para organizar as colunas da agenda.
                </p>
              </div>
              <button
                onClick={() => setModalProfissionaisAberto(false)}
                className="rounded-lg p-1 text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Lista dos profissionais atuais */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {listaEditavelProf.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-panel-line bg-panel-card px-3.5 py-2.5"
                  >
                    <div>
                      <span className="font-semibold text-xs text-panel-ink">{p.nome}</span>
                      <span className="block text-[11px] text-panel-sub">{p.cargo}</span>
                    </div>

                    <button
                      onClick={() => handleRemoverProfissional(p.id)}
                      className="text-xs text-red-400 hover:text-red-300 p-1"
                      title="Remover profissional"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>

              {/* Formulário para adicionar novo profissional */}
              <div className="rounded-xl border border-panel-line bg-panel-bg p-3 space-y-2">
                <span className="block text-xs font-semibold text-panel-ink">
                  + Adicionar membro da equipe
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nome do profissional"
                    value={novoProfNome}
                    onChange={(e) => setNovoProfNome(e.target.value)}
                    className="rounded-lg border border-panel-line bg-panel-card px-3 py-1.5 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Especialidade ou cargo"
                    value={novoProfCargo}
                    onChange={(e) => setNovoProfCargo(e.target.value)}
                    className="rounded-lg border border-panel-line bg-panel-card px-3 py-1.5 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdicionarProfissional}
                  className="w-full rounded-lg bg-panel-card border border-panel-line py-1.5 text-xs font-medium text-panel-ink hover:border-amber/40 hover:text-amber transition"
                >
                  + Inserir na lista
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-panel-line">
                <button
                  type="button"
                  onClick={() => setModalProfissionaisAberto(false)}
                  className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarProfissionais}
                  disabled={salvandoProf}
                  className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night hover:bg-amber-hover transition disabled:opacity-50"
                >
                  {salvandoProf ? "Salvando..." : "Salvar equipe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link Público de Agendamento */}
      {modalLinkAberto && linkPublico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
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
