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
  const str = d.toLocaleDateString("pt-BR", opcoes);
  return str.charAt(0).toUpperCase() + str.slice(1);
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
  const [linkPublico, setLinkPublico] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string>("");
  const [feedbackAcao, setFeedbackAcao] = useState<string>("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"grade" | "lista">("grade");
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
  const [salvandoProf, setSalvandoProf] = useState<boolean>(false);

  const carregarAgenda = async (dataAlvo: string) => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/agenda?data=${dataAlvo}`);
      if (!res.ok) {
        throw new Error("Não consegui carregar os atendimentos");
      }
      const data = await res.json();
      setGrade(data.grade || null);
      setProfissionais(data.profissionais || data.grade?.profissionais || []);
      setAgendamentos(data.agendamentos || data.grade?.agendamentos || []);
      setResumo(data.resumo || null);
      setServicos(data.servicos || []);
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
    if (profissionais.length === 0) {
      return [{ nome: "Atendimento Geral", cargo: "Profissional" }];
    }

    const list: { nome: string; cargo: string }[] = [];
    const nomesAdicionados = new Set<string>();

    for (const p of profissionais) {
      const nomeTrim = p.nome.trim();
      if (nomeTrim && !nomesAdicionados.has(nomeTrim)) {
        nomesAdicionados.add(nomeTrim);
        list.push({ nome: nomeTrim, cargo: p.cargo || "Profissional" });
      }
    }

    return list.length > 0
      ? list
      : [{ nome: "Atendimento Geral", cargo: "Profissional" }];
  }, [profissionais]);

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
      const dataAlvoEnvio = agendamentoSelecionado?.data || dataSelecionada;
      const res = await fetch("/api/agenda/lembrete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agendamentoId,
          emLote,
          data: dataAlvoEnvio,
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
      if (formServicoNome.trim()) {
        const s = servicos.find(
          (item) => item.name.toLowerCase() === formServicoNome.trim().toLowerCase(),
        );
        if (s) {
          valorCents = s.priceCents;
          duracaoMin = s.durationMin || 30;
        }
      }

      const profNome = formProfissional.trim() || profissionaisExibidos[0]?.nome || "Profissional";

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

      setFeedbackAcao(data.mensagem || "Atendimento registrado com sucesso!");
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
    setListaEditavelProf([...profissionais]);
    setModalProfissionaisAberto(true);
  };

  const handleAdicionarProfissional = () => {
    if (!novoProfNome.trim()) return;
    const novo: Profissional = {
      id: `prof_${Date.now()}`,
      nome: novoProfNome.trim(),
      cargo: "Profissional",
    };
    setListaEditavelProf([...listaEditavelProf, novo]);
    setNovoProfNome("");
  };

  const handleRemoverProfissional = (id: string) => {
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
    const nomesValidos = new Set(profissionaisExibidos.map((p) => p.nome));
    const padraoNome = profissionaisExibidos[0]?.nome || "Atendimento Geral";

    for (const ag of agendamentos) {
      if (ag.status === "CANCELADO") continue;
      if (!mapa[ag.horaInicio]) mapa[ag.horaInicio] = {};
      const prof = nomesValidos.has(ag.profissional) ? ag.profissional : padraoNome;
      mapa[ag.horaInicio][prof] = ag;
    }
    return mapa;
  }, [agendamentos, profissionaisExibidos]);

  // Contagem de atendimentos pendentes de lembrete
  const pendentesLembrete = useMemo(() => {
    return agendamentos.filter(
      (a) => (a.status === "MARCADO" || a.status === "CONFIRMADO") && !a.lembreteEnviado,
    ).length;
  }, [agendamentos]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Toast de Confirmação */}
      {feedbackAcao && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-night p-4 text-sm font-medium text-emerald-300 shadow-2xl animate-fade-in">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
            ✓
          </span>
          <span>{feedbackAcao}</span>
        </div>
      )}

      {/* Topo da Agenda: Título e Ações Principais */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-panel-ink sm:text-3xl">
            Agenda
          </h1>
          <p className="mt-0.5 text-xs text-panel-sub font-medium">
            {formatarDataExtenso(dataSelecionada)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navegação de Data: < Hoje > */}
          <div className="flex items-center rounded-xl border border-panel-line bg-panel-card p-1 shadow-sm">
            <button
              onClick={() => setDataSelecionada(somarDiasIso(dataSelecionada, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
              title="Dia anterior"
            >
              ‹
            </button>
            <button
              onClick={() => setDataSelecionada(hoje)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                dataSelecionada === hoje
                  ? "bg-amber text-night font-bold"
                  : "text-panel-sub hover:text-panel-ink"
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDataSelecionada(somarDiasIso(dataSelecionada, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-panel-sub transition hover:bg-panel-bg hover:text-panel-ink"
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
            className="rounded-xl border border-panel-line bg-panel-card px-2.5 py-1.5 text-xs font-medium text-panel-ink shadow-sm focus:border-amber focus:outline-none"
          />

          {/* Botão de Equipe */}
          <button
            onClick={abrirModalProfissionais}
            className="inline-flex items-center gap-1.5 rounded-xl border border-panel-line bg-panel-card px-3 py-1.5 text-xs font-medium text-panel-ink shadow-sm transition hover:border-amber/40 hover:text-amber"
            title="Gerenciar profissionais"
          >
            <span>👥</span>
            <span>Equipe</span>
          </button>

          {/* Botão Link Público */}
          {linkPublico && (
            <button
              onClick={() => setModalLinkAberto(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-panel-line bg-panel-card px-3 py-1.5 text-xs font-medium text-panel-ink shadow-sm transition hover:border-amber/40 hover:text-amber"
              title="Copiar link para clientes agendarem"
            >
              <span>🔗</span>
              <span className="hidden sm:inline">Link de agendamento</span>
            </button>
          )}

          {/* Botão Novo Agendamento */}
          <button
            onClick={() => {
              setFormHora("09:00");
              setFormProfissional(profissionaisExibidos[0]?.nome || "Profissional");
              setModalAberto(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber px-3.5 py-1.5 text-xs font-bold text-night shadow-sm transition hover:bg-amber-hover"
          >
            <span>+</span>
            <span>Novo agendamento</span>
          </button>
        </div>
      </div>

      {/* Faixa Resumo do Dia (Limpa, Direta e Sem Contaminação) */}
      {resumo && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-panel-line bg-panel-card px-5 py-3 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-panel-sub">Atendimentos hoje:</span>
            <strong className="font-bold text-panel-ink text-sm">
              {resumo.totalGeral}
            </strong>
            {resumo.totalConcluidos > 0 && (
              <span className="text-panel-sub">
                ({resumo.totalConcluidos} concluídos)
              </span>
            )}
          </div>

          <span className="text-panel-line font-light">|</span>

          <div className="flex items-center gap-2">
            <span className="text-panel-sub">Confirmados:</span>
            <strong className="font-bold text-amber text-sm">
              {resumo.totalConfirmados}
            </strong>
          </div>

          <span className="text-panel-line font-light">|</span>

          <div className="flex items-center gap-2">
            <span className="text-panel-sub">Receita concluída:</span>
            <strong className="font-bold text-emerald-600 text-sm">
              {formatarEmReais(resumo.receitaRealizadaCents)}
            </strong>
          </div>

          {/* Ação rápida de lembrete em lote se houver pendências */}
          {pendentesLembrete > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleEnviarLembrete(undefined, true)}
                disabled={disparandoLote}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold text-amber transition hover:bg-amber/20 disabled:opacity-50"
              >
                <span>🔔</span>
                <span>{disparandoLote ? "Enviando..." : `Lembrar clientes (${pendentesLembrete})`}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Alternador de Visualização: Grade vs Lista */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-xl border border-panel-line bg-panel-card p-1 text-xs font-semibold shadow-sm">
          <button
            onClick={() => setModoVisualizacao("grade")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              modoVisualizacao === "grade"
                ? "bg-amber text-night font-bold shadow-sm"
                : "text-panel-sub hover:text-panel-ink"
            }`}
          >
            Grade
          </button>
          <button
            onClick={() => setModoVisualizacao("lista")}
            className={`rounded-lg px-3.5 py-1.5 transition ${
              modoVisualizacao === "lista"
                ? "bg-amber text-night font-bold shadow-sm"
                : "text-panel-sub hover:text-panel-ink"
            }`}
          >
            Lista {agendamentos.length > 0 ? `(${agendamentos.length})` : ""}
          </button>
        </div>
      </div>

      {/* Estado de Carregamento / Erro */}
      {carregando ? (
        <div className="rounded-2xl border border-panel-line bg-panel-card p-16 text-center text-xs text-panel-sub">
          <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          Carregando atendimentos...
        </div>
      ) : erro ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-xs text-red-400">
          {erro}
        </div>
      ) : modoVisualizacao === "grade" ? (
        /* ========================================================================= */
        /* GRADE HORÁRIA POR PROFISSIONAL (DESPOLUÍDA E SILENCIOSA)                  */
        /* ========================================================================= */
        <div className="overflow-hidden rounded-2xl border border-panel-line bg-panel-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-panel-line bg-panel-bg/40">
                  {/* Coluna Horário */}
                  <th className="sticky left-0 z-20 w-20 min-w-[76px] border-r border-panel-line bg-panel-card px-3 py-3 text-center text-xs font-semibold text-panel-sub uppercase tracking-wider">
                    Horário
                  </th>

                  {/* Colunas de Profissionais */}
                  {profissionaisExibidos.map((prof) => (
                    <th
                      key={prof.nome}
                      className="min-w-[220px] px-5 py-3 border-r border-panel-line/60 last:border-r-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-display text-xs font-bold text-panel-ink">
                            {prof.nome}
                          </div>
                          <div className="text-[11px] text-panel-sub font-normal">
                            {prof.cargo}
                          </div>
                        </div>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel-bg text-[11px] text-panel-sub">
                          👤
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-panel-line/30">
                {slotsHorario.map((slot) => {
                  const isHoraCheia = slot.endsWith(":00");

                  return (
                    <tr
                      key={slot}
                      className={`group/row transition-colors hover:bg-panel-bg/20 h-[48px] ${
                        isHoraCheia ? "bg-panel-bg/10" : ""
                      }`}
                    >
                      {/* Célula de Horário */}
                      <td
                        className={`sticky left-0 z-10 border-r border-panel-line bg-panel-card px-3 py-1.5 text-center font-mono text-xs ${
                          isHoraCheia
                            ? "font-bold text-panel-ink"
                            : "font-normal text-panel-sub/70"
                        }`}
                      >
                        {slot}
                      </td>

                      {/* Células de Atendimento / Slot Livre */}
                      {profissionaisExibidos.map((prof) => {
                        const ag = mapaGrade[slot]?.[prof.nome];

                        return (
                          <td
                            key={`${slot}-${prof.nome}`}
                            className="p-1 border-r border-panel-line/30 last:border-r-0 align-middle"
                          >
                            {ag ? (
                              /* CARD DE AGENDAMENTO */
                              <div
                                onClick={() => setAgendamentoSelecionado(ag)}
                                className={`group relative cursor-pointer rounded-xl border p-2 transition shadow-sm hover:scale-[1.01] hover:shadow-md ${
                                  ag.status === "ATENDIDO"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-panel-ink"
                                    : ag.status === "CONFIRMADO"
                                    ? "border-amber/50 bg-amber/10 text-panel-ink"
                                    : "border-sky-500/30 bg-sky-500/10 text-panel-ink"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="truncate font-display text-xs font-bold text-panel-ink">
                                    {ag.nome}
                                  </span>
                                  <span className="shrink-0 font-mono text-[10px] text-panel-sub">
                                    {ag.horaInicio}
                                  </span>
                                </div>

                                <div className="mt-0.5 truncate text-[11px] text-panel-sub">
                                  {ag.servicoNome}
                                </div>

                                <div className="mt-1 flex items-center justify-between">
                                  <span className="font-semibold text-xs text-panel-ink">
                                    {ag.valorCents > 0 ? formatarEmReais(ag.valorCents) : "A combinar"}
                                  </span>

                                  {ag.status === "ATENDIDO" && (
                                    <span className="text-[10px] font-bold text-emerald-600">
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
                              /* SLOT LIVRE: VAZIO POR PADRÃO (SEM POLUIÇÃO VISUAL DE + PERMANENTE) */
                              <div
                                onClick={() => abrirNovoParaSlot(slot, prof.nome)}
                                className="group flex h-[40px] w-full cursor-pointer items-center justify-center rounded-xl border border-transparent transition duration-150 hover:border-dashed hover:border-amber/50 hover:bg-amber/5"
                                title={`Agendar às ${slot} com ${prof.nome}`}
                              >
                                <span className="opacity-0 transition duration-150 group-hover:opacity-100 text-amber font-semibold text-xs flex items-center gap-1">
                                  <span>+</span>
                                  <span className="text-[11px] font-medium hidden sm:inline">Agendar</span>
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
      ) : (
        /* ========================================================================= */
        /* MODO LISTA CRONOLÓGICA DE ATENDIMENTOS DO DIA                             */
        /* ========================================================================= */
        <div className="space-y-2.5">
          {agendamentos.length === 0 ? (
            <div className="rounded-2xl border border-panel-line bg-panel-card p-12 text-center">
              <p className="text-xs text-panel-sub">
                Nenhum atendimento marcado para este dia.
              </p>
              <button
                onClick={() => setModalAberto(true)}
                className="mt-3 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night hover:bg-amber-hover transition shadow-sm"
              >
                + Novo agendamento
              </button>
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
                  className={`flex flex-col gap-3 rounded-2xl border p-3.5 transition sm:flex-row sm:items-center sm:justify-between ${
                    isConcluido
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : isCancelado
                      ? "border-panel-line bg-panel-card opacity-50"
                      : "border-panel-line bg-panel-card hover:border-amber/30"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-panel-bg px-2.5 py-1.5 text-center border border-panel-line min-w-[70px]">
                      <span className="font-mono text-xs font-bold text-panel-ink">
                        {ag.horaInicio}
                      </span>
                      <span className="font-mono text-[10px] text-panel-sub">
                        até {ag.horaFim}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold text-xs text-panel-ink">
                          {ag.nome}
                        </span>

                        {profissionais.length > 0 && (
                          <span className="rounded-md border border-panel-line bg-panel-bg px-2 py-0.5 text-[10px] text-panel-sub">
                            {ag.profissional}
                          </span>
                        )}

                        {isConcluido ? (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                            Concluído ✓
                          </span>
                        ) : isConfirmado ? (
                          <span className="rounded-md border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-semibold text-amber">
                            Confirmado
                          </span>
                        ) : isCancelado ? (
                          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400">
                            Cancelado
                          </span>
                        ) : (
                          <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-600">
                            Marcado
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-panel-sub">
                        <span>{ag.servicoNome}</span>
                        {ag.valorCents > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-panel-ink">
                              {formatarEmReais(ag.valorCents)}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {formatarTelefone(ag.telefone)}
                        </a>
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
                          className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-500/30 transition"
                        >
                          ✓ Concluir
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
                          className="rounded-xl border border-panel-line bg-panel-bg px-2.5 py-1.5 text-xs font-medium text-panel-sub hover:text-panel-ink transition"
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
      )}

      {/* Modal: Detalhes do Agendamento ao Clicar na Grade */}
      {agendamentoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-panel-line bg-night p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <div>
                <span className="text-[10px] font-semibold text-amber uppercase tracking-wide">
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

            <div className="mt-4 space-y-3">
              <div className={`grid gap-3 text-xs ${profissionais.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="rounded-xl border border-panel-line bg-panel-card p-3">
                  <span className="text-panel-sub block text-[10px] uppercase">Horário</span>
                  <strong className="text-panel-ink font-mono text-sm">
                    {agendamentoSelecionado.horaInicio} até {agendamentoSelecionado.horaFim}
                  </strong>
                </div>

                {profissionais.length > 0 && (
                  <div className="rounded-xl border border-panel-line bg-panel-card p-3">
                    <span className="text-panel-sub block text-[10px] uppercase">Profissional</span>
                    <strong className="text-panel-ink text-sm">
                      {agendamentoSelecionado.profissional}
                    </strong>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-panel-line bg-panel-card p-3 space-y-2 text-xs">
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

              {/* Ações */}
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
                    <span>Concluir atendimento</span>
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

            <form onSubmit={handleSalvarAgendamento} className="mt-4 space-y-3">
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
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
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
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>

              {profissionais.length > 1 && (
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
                        {p.nome} {p.cargo && p.cargo !== "Profissional" ? `(${p.cargo})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-panel-sub">
                  Serviço (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Nome do serviço (ex: Corte, Consulta...)"
                  value={formServicoNome}
                  onChange={(e) => setFormServicoNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-panel-line bg-panel-bg px-3.5 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
              </div>

              {/* Seletor de Horário */}
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

                <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-24 overflow-y-auto p-1.5 rounded-xl border border-panel-line bg-panel-bg">
                  {HORARIOS_SELECAO.map((h) => {
                    const ativo = formHora === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setFormHora(h)}
                        className={`rounded-lg py-1 text-center font-mono text-xs transition ${
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

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night hover:bg-amber-hover transition disabled:opacity-50"
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
              {/* Lista de profissionais */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {listaEditavelProf.length === 0 ? (
                  <div className="rounded-xl border border-panel-line bg-panel-card p-4 text-center text-xs text-panel-sub">
                    Nenhum profissional cadastrado. A agenda funcionará com atendimento geral.
                  </div>
                ) : (
                  listaEditavelProf.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-panel-line bg-panel-card px-3.5 py-2.5"
                    >
                      <div>
                        <span className="font-semibold text-xs text-panel-ink">{p.nome}</span>
                        {p.cargo && p.cargo !== "Profissional" && (
                          <span className="block text-[11px] text-panel-sub">{p.cargo}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoverProfissional(p.id)}
                        className="text-xs text-red-400 hover:text-red-300 p-1"
                        title="Remover profissional"
                      >
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Formulário para adicionar */}
              <div className="rounded-xl border border-panel-line bg-panel-bg p-3 space-y-2">
                <span className="block text-xs font-semibold text-panel-ink">
                  + Adicionar membro da equipe
                </span>
                <input
                  type="text"
                  placeholder="Nome (ex: Carlos)"
                  value={novoProfNome}
                  onChange={(e) => setNovoProfNome(e.target.value)}
                  className="w-full rounded-lg border border-panel-line bg-panel-card px-3 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAdicionarProfissional}
                  className="w-full rounded-lg bg-panel-card border border-panel-line py-2 text-xs font-bold text-panel-ink hover:border-amber/40 hover:text-amber transition"
                >
                  Adicionar à lista
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
                Link de Agendamento
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
                O cliente escolhe o serviço e o horário, e entra automaticamente na sua agenda.
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
                  {linkCopiado ? "Copiado! ✓" : "Copiar"}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <a
                  href={linkPublico}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-panel-line px-4 py-2 text-xs font-semibold text-panel-ink hover:border-amber/40 hover:text-amber transition"
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
