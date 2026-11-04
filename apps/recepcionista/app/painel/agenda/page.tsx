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

function obterDiasDaSemana(dataIso: string) {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  const hojeStr = dataHojeIso();

  const diaDaSemana = d.getDay();
  const diferencaParaSegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana;

  const segunda = new Date(ano, mes - 1, dia);
  segunda.setDate(d.getDate() + diferencaParaSegunda);

  const dias: {
    dataIso: string;
    diaSemana: string;
    diaNumero: number;
    isPassado: boolean;
    isHoje: boolean;
  }[] = [];
  const nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(segunda);
    cur.setDate(segunda.getDate() + i);
    const anoCur = cur.getFullYear();
    const mesCur = String(cur.getMonth() + 1).padStart(2, "0");
    const diaCur = String(cur.getDate()).padStart(2, "0");
    const iso = `${anoCur}-${mesCur}-${diaCur}`;

    dias.push({
      dataIso: iso,
      diaSemana: nomes[i],
      diaNumero: cur.getDate(),
      isPassado: iso < hojeStr,
      isHoje: iso === hojeStr,
    });
  }

  return dias;
}

function IconeAgenda({
  nome,
  className = "h-4 w-4",
}: {
  nome:
    | "calendario"
    | "relogio"
    | "usuario"
    | "equipe"
    | "link"
    | "whatsapp"
    | "check"
    | "fechar"
    | "seta"
    | "alerta"
    | "cadeado"
    | "cadeadoAberto"
    | "sino"
    | "cifrao"
    | "mais"
    | "lixeira"
    | "raio";
  className?: string;
}) {
  const icones: Record<typeof nome, React.ReactNode> = {
    calendario: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </>
    ),
    relogio: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    usuario: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    equipe: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
    whatsapp: (
      <>
        <path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.6-4.5A9 9 0 1 1 21 11.5Z" />
        <path d="M8.1 7.3c-.8 2.9 2.7 6.4 5.6 5.6l1.3-1.3 2 1.3c-.4 2.3-2.1 2.5-4.3 1.6-2.1-.8-4.3-3-5.1-5.1-.9-2.2-.7-3.9 1.6-4.3l1.3 2-1.3 1.3" transform="translate(0 1) scale(.95)" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    fechar: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    seta: <path d="M5 12h14m-5-5 5 5-5 5" />,
    alerta: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    cadeado: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    cadeadoAberto: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </>
    ),
    sino: (
      <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    cifrao: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    mais: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    lixeira: (
      <>
        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </>
    ),
    raio: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icones[nome]}
    </svg>
  );
}

export default function PaginaAgenda() {
  const hoje = dataHojeIso();
  const [dataSelecionada, setDataSelecionada] = useState<string>(dataHojeIso());
  const [grade, setGrade] = useState<GradeDoDia | null>(null);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoItem[]>([]);
  const [resumo, setResumo] = useState<ResumoAgenda | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [diasComAgendamentos, setDiasComAgendamentos] = useState<string[]>([]);
  const [proximoAgendamento, setProximoAgendamento] = useState<{
    data: string;
    hora: string;
    clienteNome: string;
    servicoNome: string;
    profissional: string;
  } | null>(null);
  const [linkPublico, setLinkPublico] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string>("");
  const [feedbackAcao, setFeedbackAcao] = useState<string>("");
  const [modoVisualizacao, setModoVisualizacao] = useState<"grade" | "lista">("grade");
  const [enviandoLembreteId, setEnviandoLembreteId] = useState<string | null>(null);
  const [disparandoLote, setDisparandoLote] = useState<boolean>(false);

  const diasDaSemana = useMemo(() => obterDiasDaSemana(dataSelecionada), [dataSelecionada]);

  // Não permite navegar para semanas anteriores se todos os dias da semana anterior estiverem no passado
  const podeVoltarSemana = useMemo(() => {
    const primeiroDia = diasDaSemana[0]?.dataIso;
    if (!primeiroDia) return false;
    const domingoAnteriorIso = somarDiasIso(primeiroDia, -1);
    return domingoAnteriorIso >= hoje;
  }, [diasDaSemana, hoje]);

  const voltarSemana = () => {
    if (!podeVoltarSemana) return;
    const nova = somarDiasIso(dataSelecionada, -7);
    setDataSelecionada(nova < hoje ? hoje : nova);
  };

  const avancarSemana = () => {
    setDataSelecionada(somarDiasIso(dataSelecionada, 7));
  };

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

  // Feriados e Dias Fechados
  const [diasFechados, setDiasFechados] = useState<string[]>([]);
  const [bloqueandoDia, setBloqueandoDia] = useState<boolean>(false);

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
      setDiasComAgendamentos(data.diasComAgendamentos || []);
      setDiasFechados(data.diasFechados || []);
      setProximoAgendamento(data.proximoAgendamento || null);
      setLinkPublico(data.linkPublico || null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar a agenda";
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  const diaEstaBloqueado = diasFechados.includes(dataSelecionada);

  const handleAlternarBloqueioDia = async () => {
    setBloqueandoDia(true);
    try {
      const acao = diaEstaBloqueado ? "desbloquear_dia" : "bloquear_dia";
      const res = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, data: dataSelecionada }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não consegui alterar o bloqueio deste dia.");
        return;
      }
      setDiasFechados(data.diasFechados || []);
      setFeedbackAcao(data.mensagem || (diaEstaBloqueado ? "Dia reaberto!" : "Dia bloqueado!"));
      setTimeout(() => setFeedbackAcao(""), 4500);
    } catch {
      alert("Erro ao alterar bloqueio do dia.");
    } finally {
      setBloqueandoDia(false);
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
    if (dataSelecionada < hoje) {
      alert("Não é possível agendar para um dia que já passou.");
      return;
    }
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
    if (dataSelecionada < hoje) {
      alert("Não é possível agendar para um dia que já passou.");
      return;
    }
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
          jaAtendido: false,
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

      let slotAlvo = ag.horaInicio;
      if (!slotsHorario.includes(slotAlvo)) {
        const [h, m] = slotAlvo.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          const mArredondado = Math.round(m / 15) * 15;
          const hFinal = mArredondado === 60 ? h + 1 : h;
          const mFinal = mArredondado === 60 ? 0 : mArredondado;
          slotAlvo = `${String(hFinal).padStart(2, "0")}:${String(mFinal).padStart(2, "0")}`;
        }
      }

      if (!mapa[slotAlvo]) mapa[slotAlvo] = {};
      const prof = nomesValidos.has(ag.profissional) ? ag.profissional : padraoNome;
      mapa[slotAlvo][prof] = ag;
    }
    return mapa;
  }, [agendamentos, profissionaisExibidos, slotsHorario]);

  // Contagem de atendimentos pendentes de lembrete
  const pendentesLembrete = useMemo(() => {
    return agendamentos.filter(
      (a) => (a.status === "MARCADO" || a.status === "CONFIRMADO") && !a.lembreteEnviado,
    ).length;
  }, [agendamentos]);

  return (
    <div className="mx-auto max-w-7xl pb-16 space-y-6">
      {/* Toast Flutuante de Notificação */}
      {feedbackAcao && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-white p-4 text-sm font-semibold text-emerald-900 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs font-bold">
            <IconeAgenda nome="check" className="h-4 w-4" />
          </div>
          <span>{feedbackAcao}</span>
        </div>
      )}

      {/* Topo da Agenda: Cabeçalho com Título e Ações Rápidas */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-bold tracking-tight text-panel-ink sm:text-3xl flex items-center gap-2">
              Nex • Agenda de Atendimentos
            </h1>
            {diaEstaBloqueado && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                Fechado / Feriado
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-panel-sub font-medium flex items-center gap-2">
            <IconeAgenda nome="calendario" className="h-3.5 w-3.5 text-panel-sub" />
            <span>{formatarDataExtenso(dataSelecionada)}</span>
          </p>
        </div>

        {/* Barra de Ações Rápidas do Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botão Gerenciar Equipe */}
          <button
            type="button"
            onClick={abrirModalProfissionais}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-panel-line bg-white px-3.5 py-2 text-xs font-semibold text-panel-ink shadow-2xs hover:border-amber transition"
            title="Gerenciar membros da equipe de profissionais"
          >
            <IconeAgenda nome="equipe" className="h-4 w-4 text-panel-sub" />
            <span>Equipe ({profissionaisExibidos.length})</span>
          </button>

          {/* Botão Link do Cliente */}
          <button
            type="button"
            onClick={() => setModalLinkAberto(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-amber/40 bg-amber/15 px-3.5 py-2 text-xs font-bold text-amber-deep shadow-2xs hover:bg-amber/25 transition"
            title="Copiar ou compartilhar link de agendamento do cliente"
          >
            <IconeAgenda nome="link" className="h-4 w-4 text-amber-deep" />
            <span>Link do Cliente</span>
          </button>

          {/* Botão Bloquear / Reabrir Dia (Feriado ou Recesso) */}
          <button
            type="button"
            disabled={bloqueandoDia}
            onClick={handleAlternarBloqueioDia}
            className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold shadow-2xs transition disabled:opacity-50 ${
              diaEstaBloqueado
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-panel-line bg-white text-panel-sub hover:border-red-300 hover:text-red-700 hover:bg-red-50/50"
            }`}
            title={
              diaEstaBloqueado
                ? "Reabrir esta data para agendamentos"
                : "Bloquear agendamentos nesta data (feriado, folga ou recesso)"
            }
          >
            <IconeAgenda
              nome={diaEstaBloqueado ? "cadeadoAberto" : "cadeado"}
              className="h-4 w-4"
            />
            <span>{diaEstaBloqueado ? "Reabrir este dia" : "Bloquear dia (Feriado)"}</span>
          </button>

          {/* Botão Novo Agendamento */}
          <button
            type="button"
            onClick={() => {
              setFormHora("09:00");
              setFormProfissional(profissionaisExibidos[0]?.nome || "Profissional");
              setModalAberto(true);
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-amber px-4 py-2 text-xs sm:text-sm font-bold text-night shadow-xs transition hover:brightness-110 active:scale-98"
          >
            <IconeAgenda nome="mais" className="h-4 w-4" />
            <span>Novo agendamento</span>
          </button>
        </div>
      </header>

      {/* Apresentação Visual Marcante do Nex (Idêntica ao Atendente e Treinamento) */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 rounded-3xl border border-amber/30 bg-gradient-to-r from-amber/15 via-white to-emerald-500/10 p-5 sm:p-6 shadow-xs">
        <div className="relative shrink-0">
          <img
            src="/nex/nex-avatar.png"
            alt="Nex - Atendente Oficial"
            className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover shrink-0 drop-shadow-md border-2 border-emerald-500/30 shadow-md ring-2 ring-emerald-500/15 bg-white"
          />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </span>
        </div>
        <div className="min-w-0 text-center sm:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Nex ⚡ Agenda Inteligente no WhatsApp
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              ✓ Sincronização em Tempo Real
            </span>
          </div>
          <h2 className="mt-1.5 text-base sm:text-lg font-bold text-panel-ink">
            Organização completa dos seus atendimentos e horários.
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-panel-sub leading-relaxed max-w-3xl">
            Eu agendo novos clientes automaticamente pela conversa no WhatsApp, envio lembretes de confirmação antes do horário e mantenho sua grade sempre atualizada sem sobreposição!
          </p>
        </div>
      </div>

      {/* Alerta de Dia Bloqueado na Agenda */}
      {diaEstaBloqueado && (
        <div className="flex items-start gap-3.5 rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5 text-sm text-red-950 shadow-xs animate-in fade-in">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 shadow-2xs">
            <IconeAgenda nome="cadeado" className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-950">
              Esta data está bloqueada na sua agenda ({formatarDataExtenso(dataSelecionada)})
            </p>
            <p className="mt-1 text-xs text-red-800 leading-relaxed">
              O Atendente Virtual no WhatsApp e a página pública de agendamento não aceitam novos horários para este dia. Para liberar agendamentos normalmente, clique no botão <strong>Reabrir este dia</strong> acima.
            </p>
          </div>
        </div>
      )}

      {/* Cartões de Métricas Executivas (Resumo da Agenda) */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Métrica 1: Atendimentos Hoje */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-panel-sub">Atendimentos no Dia</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-800">
                <IconeAgenda nome="calendario" className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-panel-ink">{resumo.totalGeral}</p>
            <p className="mt-1 text-[11px] font-medium text-panel-sub">
              {resumo.totalConcluidos > 0
                ? `${resumo.totalConcluidos} concluídos • ${resumo.totalGeral - resumo.totalConcluidos} pendentes`
                : "Nenhum concluído ainda"}
            </p>
          </div>

          {/* Métrica 2: Confirmados no WhatsApp */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-panel-sub">Confirmados</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber/20 text-amber-deep">
                <IconeAgenda nome="whatsapp" className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-deep">
              {resumo.totalConfirmados}
            </p>
            <p className="mt-1 text-[11px] font-medium text-panel-sub">Confirmados com clientes</p>
          </div>

          {/* Métrica 3: Faturamento Realizado */}
          <div className="rounded-2xl border border-panel-line bg-panel-card p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-panel-sub">Faturamento Realizado</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800">
                <IconeAgenda nome="cifrao" className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">
              {formatarEmReais(resumo.receitaRealizadaCents)}
            </p>
            <p className="mt-1 text-[11px] font-medium text-panel-sub">
              Previsto: {formatarEmReais(resumo.receitaPrevistaCents)}
            </p>
          </div>

          {/* Métrica 4: Lembretes Pendentes */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 shadow-2xs transition ${
              pendentesLembrete > 0 ? "border-amber/50 bg-amber/10" : "border-panel-line bg-panel-card"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-panel-sub">Lembretes WhatsApp</span>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  pendentesLembrete > 0 ? "bg-amber text-night" : "bg-panel-bg text-panel-sub"
                }`}
              >
                <IconeAgenda nome="sino" className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-2">
              <p className="text-2xl sm:text-3xl font-extrabold text-panel-ink">
                {pendentesLembrete}
              </p>
              {pendentesLembrete > 0 && (
                <button
                  type="button"
                  onClick={() => handleEnviarLembrete(undefined, true)}
                  disabled={disparandoLote}
                  className="rounded-xl bg-amber px-2.5 py-1 text-[11px] font-bold text-night shadow-xs hover:brightness-110 disabled:opacity-50 transition"
                  title="Enviar lembretes para todos os atendimentos marcados do dia"
                >
                  {disparandoLote ? "Enviando..." : "Lembrar todos"}
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] font-medium text-panel-sub">
              {pendentesLembrete === 0 ? "Todos lembrados ✓" : "Clientes aguardando lembrete"}
            </p>
          </div>
        </div>
      )}

      {/* Seletor Semanal de Calendário Estilo Google Calendar / SaaS */}
      <div className="overflow-hidden rounded-3xl border border-panel-line bg-panel-card shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-panel-line bg-white/70 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-panel-ink uppercase tracking-wider">
              Navegar pela semana
            </span>
            <button
              type="button"
              onClick={() => setDataSelecionada(hoje)}
              className="rounded-xl border border-panel-line bg-white px-3 py-1 text-xs font-semibold text-panel-ink shadow-2xs hover:border-amber transition"
            >
              Hoje
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              min={hoje}
              value={dataSelecionada}
              onChange={(e) => e.target.value && e.target.value >= hoje && setDataSelecionada(e.target.value)}
              className="rounded-xl border border-panel-line bg-white px-3 py-1.5 text-xs font-semibold text-panel-ink shadow-2xs focus:border-amber focus:outline-none"
              title="Escolher data futura no calendário"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={voltarSemana}
                disabled={!podeVoltarSemana}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-panel-line bg-white text-panel-sub shadow-2xs transition hover:bg-panel-bg hover:text-panel-ink disabled:opacity-30 disabled:cursor-not-allowed"
                title="Semana anterior"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={avancarSemana}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-panel-line bg-white text-panel-sub shadow-2xs transition hover:bg-panel-bg hover:text-panel-ink"
                title="Próxima semana"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Faixa dos 7 dias da semana */}
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
            {diasDaSemana.map((d) => {
              const isSelecionado = d.dataIso === dataSelecionada;
              const temAgendamentos = diasComAgendamentos.includes(d.dataIso);
              const isFechado = diasFechados.includes(d.dataIso);

              if (d.isPassado) {
                return (
                  <div
                    key={d.dataIso}
                    className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-panel-line/60 bg-panel-bg/30 p-2 sm:p-3 text-center opacity-35 cursor-not-allowed select-none"
                    title="Data no passado"
                  >
                    <span className="text-[10px] sm:text-xs font-semibold text-panel-sub uppercase">
                      {d.diaSemana}
                    </span>
                    <span className="font-display text-base sm:text-xl font-bold text-panel-sub mt-0.5">
                      {d.diaNumero}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={d.dataIso}
                  type="button"
                  onClick={() => setDataSelecionada(d.dataIso)}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border p-2 sm:p-3 text-center transition ${
                    isSelecionado
                      ? "border-amber bg-amber text-night font-bold shadow-sm ring-2 ring-amber/20"
                      : "border-panel-line bg-white text-panel-sub hover:border-amber/50 hover:text-panel-ink hover:bg-amber/5"
                  }`}
                >
                  <span
                    className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                      isSelecionado ? "text-night/80" : "text-panel-sub"
                    }`}
                  >
                    {d.diaSemana}
                  </span>
                  <span className="font-display text-base sm:text-2xl font-black mt-0.5">
                    {d.diaNumero}
                  </span>

                  {/* Badges de Status do Dia */}
                  <div className="mt-1 flex items-center gap-1">
                    {d.isHoje && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[9px] font-black uppercase ${
                          isSelecionado ? "bg-night text-amber" : "bg-amber text-night"
                        }`}
                      >
                        Hoje
                      </span>
                    )}
                    {temAgendamentos && !d.isHoje && (
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isSelecionado ? "bg-night" : "bg-amber"
                        }`}
                        title="Atendimentos marcados"
                      />
                    )}
                    {isFechado && (
                      <span
                        className="h-2 w-2 rounded-full bg-red-500"
                        title="Dia bloqueado (feriado)"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cartão Informativo de Próximo Agendamento se o dia atual estiver vazio */}
      {proximoAgendamento && dataSelecionada !== proximoAgendamento.data && agendamentos.length === 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border border-amber/40 bg-amber/10 p-5 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber text-night font-bold shadow-2xs">
              <IconeAgenda nome="calendario" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-panel-ink">
                Você tem agendamento marcado para {proximoAgendamento.data === hoje ? "hoje" : formatarDataExtenso(proximoAgendamento.data)} às {proximoAgendamento.hora}
              </p>
              <p className="text-xs text-panel-sub mt-0.5">
                Cliente: <strong className="text-panel-ink font-semibold">{proximoAgendamento.clienteNome}</strong> · Atendimento: {proximoAgendamento.servicoNome} · Com: {proximoAgendamento.profissional}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDataSelecionada(proximoAgendamento.data)}
            className="shrink-0 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night shadow-2xs transition hover:brightness-110 active:scale-98"
          >
            Ver este dia →
          </button>
        </div>
      )}

      {/* Faixa / Card do Link de Agendamento do Cliente */}
      <div className="overflow-hidden rounded-3xl border border-amber/30 bg-gradient-to-r from-amber/10 via-white to-amber/5 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber text-night text-xs font-bold shadow-2xs">
                <IconeAgenda nome="link" className="h-4 w-4" />
              </span>
              <h2 className="font-display text-sm sm:text-base font-bold text-panel-ink">
                Link de Agendamento do seu Cliente
              </h2>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Página Exclusiva do Cliente
              </span>
            </div>
            <p className="text-xs sm:text-sm text-panel-sub max-w-2xl leading-relaxed">
              Envie este link para seus clientes no WhatsApp ou Instagram. O cliente vê apenas os horários vagos para marcar sozinho — ele <strong className="text-panel-ink font-semibold">não</strong> tem acesso ao seu painel nem aos seus outros atendimentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-panel-line bg-white px-3 py-2 text-xs font-mono text-panel-ink max-w-xs truncate shadow-2xs">
              {linkPublico || "Gerando link..."}
            </div>

            <button
              type="button"
              onClick={copiarLinkPublico}
              disabled={!linkPublico}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night shadow-2xs transition hover:brightness-110 active:scale-98 disabled:opacity-50"
            >
              <IconeAgenda nome="check" className="h-3.5 w-3.5" />
              <span>{linkCopiado ? "Copiado!" : "Copiar link"}</span>
            </button>

            {linkPublico && (
              <a
                href={linkPublico}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-panel-line bg-white px-3.5 py-2 text-xs font-semibold text-panel-ink shadow-2xs transition hover:border-amber"
                title="Abrir a página como o cliente enxerga"
              >
                <span>Ver página ↗</span>
              </a>
            )}

            {linkPublico && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Olá! Você pode agendar seu horário online com facilidade pelo nosso link: ${linkPublico}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs transition hover:bg-emerald-500/20"
                title="Compartilhar no WhatsApp"
              >
                <IconeAgenda nome="whatsapp" className="h-4 w-4 text-emerald-600" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Controles: Alternador de Visualização (Grade vs Lista) */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-2xl border border-panel-line bg-panel-card p-1 text-xs font-semibold shadow-xs">
          <button
            type="button"
            onClick={() => setModoVisualizacao("grade")}
            className={`rounded-xl px-4 py-2 transition ${
              modoVisualizacao === "grade"
                ? "bg-amber text-night font-bold shadow-2xs"
                : "text-panel-sub hover:text-panel-ink hover:bg-white"
            }`}
          >
            Grade por Profissional
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("lista")}
            className={`rounded-xl px-4 py-2 transition ${
              modoVisualizacao === "lista"
                ? "bg-amber text-night font-bold shadow-2xs"
                : "text-panel-sub hover:text-panel-ink hover:bg-white"
            }`}
          >
            Lista Cronológica {agendamentos.length > 0 ? `(${agendamentos.length})` : ""}
          </button>
        </div>

        <div className="text-xs text-panel-sub font-medium">
          {agendamentos.length === 1
            ? "1 atendimento marcado"
            : `${agendamentos.length} atendimentos marcados`}
        </div>
      </div>

      {/* Área Central da Agenda: Grade ou Lista */}
      {carregando ? (
        <div className="rounded-3xl border border-panel-line bg-panel-card p-16 text-center text-xs text-panel-sub shadow-xs">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-amber border-t-transparent" />
          <p className="font-semibold text-panel-ink">Sincronizando atendimentos com o WhatsApp...</p>
        </div>
      ) : erro ? (
        <div className="rounded-3xl border border-red-500/30 bg-red-50 p-6 text-center text-xs text-red-700 shadow-xs">
          {erro}
        </div>
      ) : modoVisualizacao === "grade" ? (
        /* ========================================================================= */
        /* GRADE HORÁRIA POR PROFISSIONAL (DESIGN EXECUTIVO MODERNO)                 */
        /* ========================================================================= */
        <div className="overflow-hidden rounded-3xl border border-panel-line bg-panel-card shadow-[0_12px_44px_-24px_rgba(17,27,33,0.28)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-panel-line bg-white/70">
                  {/* Coluna Horário */}
                  <th className="sticky left-0 z-20 w-24 min-w-[88px] border-r border-panel-line bg-panel-card px-3 py-3.5 text-center text-[11px] font-bold text-panel-sub uppercase tracking-wider">
                    Horário
                  </th>

                  {/* Colunas de Profissionais */}
                  {profissionaisExibidos.map((prof) => (
                    <th
                      key={prof.nome}
                      className="min-w-[240px] px-5 py-3.5 border-r border-panel-line/60 last:border-r-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-display text-xs sm:text-sm font-bold text-panel-ink">
                            {prof.nome}
                          </div>
                          <div className="text-[11px] text-panel-sub font-medium">
                            {prof.cargo}
                          </div>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-panel-bg text-panel-sub shadow-2xs">
                          <IconeAgenda nome="usuario" className="h-4 w-4" />
                        </div>
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
                      className={`group/row transition-colors hover:bg-panel-bg/25 h-[52px] ${
                        isHoraCheia ? "bg-panel-bg/15" : ""
                      }`}
                    >
                      {/* Célula de Horário Fixa */}
                      <td
                        className={`sticky left-0 z-10 border-r border-panel-line bg-panel-card px-3 py-2 text-center font-mono text-xs ${
                          isHoraCheia
                            ? "font-extrabold text-panel-ink"
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
                            className="p-1.5 border-r border-panel-line/30 last:border-r-0 align-middle"
                          >
                            {ag ? (
                              /* CARD DE AGENDAMENTO */
                              <div
                                onClick={() => setAgendamentoSelecionado(ag)}
                                className={`group relative cursor-pointer rounded-2xl border p-2.5 transition shadow-2xs hover:scale-[1.01] hover:shadow-md ${
                                  ag.status === "ATENDIDO"
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-950"
                                    : ag.status === "CONFIRMADO"
                                    ? "border-amber/50 bg-amber/15 text-panel-ink"
                                    : "border-sky-500/30 bg-sky-500/10 text-panel-ink"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span className="truncate font-display text-xs font-bold text-panel-ink">
                                    {ag.nome}
                                  </span>
                                  <span className="shrink-0 font-mono text-[10px] font-semibold text-panel-sub bg-white/70 px-1.5 py-0.5 rounded-md">
                                    {ag.horaInicio}
                                  </span>
                                </div>

                                <div className="mt-0.5 truncate text-[11px] text-panel-sub font-medium">
                                  {ag.servicoNome}
                                </div>

                                <div className="mt-1.5 flex items-center justify-between">
                                  <span className="font-bold text-xs text-panel-ink">
                                    {ag.valorCents > 0 ? formatarEmReais(ag.valorCents) : "A combinar"}
                                  </span>

                                  {ag.status === "ATENDIDO" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                      <IconeAgenda nome="check" className="h-2.5 w-2.5" />
                                      Concluído
                                    </span>
                                  )}
                                  {ag.status === "CONFIRMADO" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-deep bg-amber/20 px-1.5 py-0.5 rounded-full">
                                      Confirmado
                                    </span>
                                  )}
                                  {ag.status === "MARCADO" && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-200">
                                      Marcado
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : dataSelecionada < hoje ? (
                              /* SLOT NO PASSADO: DESATIVADO */
                              <div
                                className="h-[42px] w-full cursor-not-allowed rounded-xl select-none"
                                title="Data no passado (indisponível para agendamento)"
                              />
                            ) : (
                              /* SLOT LIVRE: VAZIO POR PADRÃO (HOVER COM RELEVO SUAVE) */
                              <div
                                onClick={() => abrirNovoParaSlot(slot, prof.nome)}
                                className="group flex h-[42px] w-full cursor-pointer items-center justify-center rounded-xl border border-transparent transition duration-150 hover:border-dashed hover:border-amber/60 hover:bg-amber/10"
                                title={`Agendar às ${slot} com ${prof.nome}`}
                              >
                                <span className="opacity-0 transition duration-150 group-hover:opacity-100 text-amber-deep font-bold text-xs flex items-center gap-1">
                                  <span>+</span>
                                  <span className="text-[11px] font-semibold hidden sm:inline">Agendar</span>
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
        <div className="space-y-3">
          {agendamentos.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-panel-line bg-white/70 p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-bg text-panel-sub mb-3">
                <IconeAgenda nome="calendario" className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-panel-ink">
                Nenhum atendimento marcado para este dia.
              </p>
              <p className="mt-1 text-xs text-panel-sub max-w-sm mx-auto">
                Você pode registrar um agendamento manual ou compartilhar o link para clientes marcarem sozinhos.
              </p>
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="mt-4 rounded-xl bg-amber px-5 py-2.5 text-xs font-bold text-night hover:brightness-110 transition shadow-xs"
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
                  className={`flex flex-col gap-3.5 rounded-3xl border p-4 sm:p-5 transition shadow-2xs sm:flex-row sm:items-center sm:justify-between ${
                    isConcluido
                      ? "border-emerald-500/30 bg-emerald-50/40"
                      : isCancelado
                      ? "border-panel-line bg-panel-card opacity-50"
                      : "border-panel-line bg-white hover:border-amber/50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-panel-bg px-3.5 py-2 text-center border border-panel-line min-w-[76px] shadow-2xs">
                      <span className="font-mono text-sm font-extrabold text-panel-ink">
                        {ag.horaInicio}
                      </span>
                      <span className="font-mono text-[10px] text-panel-sub">
                        até {ag.horaFim}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-sm text-panel-ink">
                          {ag.nome}
                        </span>

                        {profissionais.length > 0 && (
                          <span className="rounded-lg border border-panel-line bg-panel-bg px-2.5 py-0.5 text-[11px] font-semibold text-panel-sub">
                            {ag.profissional}
                          </span>
                        )}

                        {isConcluido ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            Concluído ✓
                          </span>
                        ) : isConfirmado ? (
                          <span className="rounded-full border border-amber/30 bg-amber/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-deep">
                            Confirmado
                          </span>
                        ) : isCancelado ? (
                          <span className="rounded-full border border-red-500/30 bg-red-50 px-2.5 py-0.5 text-[11px] font-medium text-red-600">
                            Cancelado
                          </span>
                        ) : (
                          <span className="rounded-full border border-sky-500/30 bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">
                            Marcado
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-panel-sub">
                        <span className="font-medium text-panel-ink">{ag.servicoNome}</span>
                        {ag.valorCents > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-panel-ink">
                              {formatarEmReais(ag.valorCents)}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-emerald-700 hover:underline flex items-center gap-1 font-mono"
                        >
                          <IconeAgenda nome="whatsapp" className="h-3 w-3 text-emerald-600" />
                          <span>{formatarTelefone(ag.telefone)}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {!isConcluido && !isCancelado && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleMudarStatus(ag.id, "ATENDIDO", ag.valorCents, ag.servicoNome)
                          }
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
                        >
                          ✓ Concluir
                        </button>

                        {!isConfirmado && (
                          <button
                            type="button"
                            onClick={() => handleMudarStatus(ag.id, "CONFIRMADO")}
                            className="rounded-xl border border-panel-line bg-white px-3 py-2 text-xs font-semibold text-panel-ink hover:border-amber transition"
                          >
                            Confirmar
                          </button>
                        )}

                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-panel-line bg-white px-3 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink transition"
                        >
                          Lembrar WhatsApp
                        </a>

                        <button
                          type="button"
                          onClick={() => handleMudarStatus(ag.id, "CANCELADO")}
                          className="rounded-xl px-2.5 py-2 text-xs text-panel-sub hover:text-red-700 hover:bg-red-50 transition"
                          title="Cancelar horário"
                        >
                          ✕
                        </button>
                      </>
                    )}

                    {isCancelado && (
                      <button
                        type="button"
                        onClick={() => handleRemover(ag.id)}
                        className="text-xs text-panel-sub hover:text-red-600 transition"
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

      {/* ========================================================================= */}
      {/* MODAL: DETALHES DO AGENDAMENTO (DESIGN SYSTEM LIGHT MODERNO)              */}
      {/* ========================================================================= */}
      {agendamentoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-panel-line bg-panel-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-deep uppercase tracking-wider">
                  Detalhes do Atendimento
                </span>
                <h3 className="font-display text-lg font-bold text-panel-ink">
                  {agendamentoSelecionado.nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAgendamentoSelecionado(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                <IconeAgenda nome="fechar" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`grid gap-3 ${profissionais.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
                <div className="rounded-2xl border border-panel-line bg-white p-3.5 shadow-2xs">
                  <span className="text-panel-sub block text-[10px] uppercase font-bold">Horário</span>
                  <strong className="text-panel-ink font-mono text-sm block mt-0.5">
                    {agendamentoSelecionado.horaInicio} até {agendamentoSelecionado.horaFim}
                  </strong>
                </div>

                {profissionais.length > 0 && (
                  <div className="rounded-2xl border border-panel-line bg-white p-3.5 shadow-2xs">
                    <span className="text-panel-sub block text-[10px] uppercase font-bold">Profissional</span>
                    <strong className="text-panel-ink text-sm block mt-0.5">
                      {agendamentoSelecionado.profissional}
                    </strong>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-panel-line bg-white p-4 space-y-2.5 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="text-panel-sub font-medium">Serviço:</span>
                  <strong className="text-panel-ink font-semibold">{agendamentoSelecionado.servicoNome}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-panel-sub font-medium">Valor:</span>
                  <strong className="text-emerald-700 font-bold">
                    {agendamentoSelecionado.valorCents > 0
                      ? formatarEmReais(agendamentoSelecionado.valorCents)
                      : "A combinar"}
                  </strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-panel-sub font-medium">WhatsApp:</span>
                  <a
                    href={`https://wa.me/55${agendamentoSelecionado.telefone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline font-mono font-bold flex items-center gap-1"
                  >
                    <IconeAgenda nome="whatsapp" className="h-3.5 w-3.5" />
                    <span>{formatarTelefone(agendamentoSelecionado.telefone)}</span>
                  </a>
                </div>
                {agendamentoSelecionado.observacoes && (
                  <div className="border-t border-panel-line/60 pt-2 text-panel-sub italic">
                    Obs: &ldquo;{agendamentoSelecionado.observacoes}&rdquo;
                  </div>
                )}
              </div>

              {/* Botões de Ação do Atendimento */}
              <div className="space-y-2 pt-2">
                {agendamentoSelecionado.status !== "ATENDIDO" && (
                  <button
                    type="button"
                    onClick={() =>
                      handleMudarStatus(
                        agendamentoSelecionado.id,
                        "ATENDIDO",
                        agendamentoSelecionado.valorCents,
                        agendamentoSelecionado.servicoNome,
                      )
                    }
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                  >
                    <IconeAgenda nome="check" className="h-4 w-4" />
                    <span>Concluir atendimento</span>
                  </button>
                )}

                {agendamentoSelecionado.status === "MARCADO" && (
                  <button
                    type="button"
                    onClick={() => handleMudarStatus(agendamentoSelecionado.id, "CONFIRMADO")}
                    className="w-full rounded-2xl border border-panel-line bg-white px-4 py-2.5 text-xs font-bold text-panel-ink hover:border-amber transition shadow-2xs"
                  >
                    Confirmar horário
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleEnviarLembrete(agendamentoSelecionado.id)}
                  disabled={enviandoLembreteId === agendamentoSelecionado.id}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-amber/40 bg-amber/15 px-4 py-2.5 text-xs font-bold text-amber-deep hover:bg-amber/25 transition shadow-2xs"
                >
                  <IconeAgenda nome="whatsapp" className="h-4 w-4" />
                  <span>
                    {enviandoLembreteId === agendamentoSelecionado.id
                      ? "Enviando lembrete..."
                      : agendamentoSelecionado.lembreteEnviado
                      ? "Reenviar lembrete no WhatsApp"
                      : "Enviar lembrete no WhatsApp"}
                  </span>
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-panel-line">
                  <button
                    type="button"
                    onClick={() => handleRemover(agendamentoSelecionado.id)}
                    className="text-xs text-red-600 hover:underline font-semibold"
                  >
                    Excluir horário
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgendamentoSelecionado(null)}
                    className="text-xs text-panel-sub hover:text-panel-ink font-semibold"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO AGENDAMENTO (DESIGN SYSTEM LIGHT MODERNO)                     */}
      {/* ========================================================================= */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-panel-line bg-panel-card p-6 shadow-2xl space-y-4">
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
                type="button"
                onClick={() => setModalAberto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                <IconeAgenda nome="fechar" className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarAgendamento} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-panel-ink mb-1">
                  Nome do cliente *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-panel-ink mb-1">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: (11) 98888-7777"
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs outline-none font-mono"
                />
              </div>

              {profissionais.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-panel-ink mb-1">
                    Profissional da equipe *
                  </label>
                  <select
                    value={formProfissional}
                    onChange={(e) => setFormProfissional(e.target.value)}
                    className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-xs text-panel-ink focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs outline-none"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-panel-ink">
                    Serviço (opcional)
                  </label>
                  {formServicoNome && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormServicoId("");
                        setFormServicoNome("");
                      }}
                      className="text-[11px] text-panel-sub hover:text-amber transition font-medium"
                    >
                      Limpar seleção
                    </button>
                  )}
                </div>

                {servicos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {servicos.map((s) => {
                      const selecionado =
                        formServicoNome.toLowerCase().trim() === s.name.toLowerCase().trim();
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setFormServicoId(s.id);
                            setFormServicoNome(s.name);
                          }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${
                            selecionado
                              ? "bg-amber text-night border-amber shadow-2xs font-bold"
                              : "bg-panel-bg text-panel-ink border-panel-line hover:border-amber/60 hover:bg-amber-soft/20"
                          }`}
                        >
                          {s.name} {s.priceCents > 0 ? `(${formatarEmReais(s.priceCents)})` : ""}
                        </button>
                      );
                    })}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Nome do serviço (ou clique em um dos serviços acima)..."
                  value={formServicoNome}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormServicoNome(val);
                    const correspondente = servicos.find(
                      (s) => s.name.toLowerCase().trim() === val.toLowerCase().trim()
                    );
                    if (correspondente) {
                      setFormServicoId(correspondente.id);
                    } else {
                      setFormServicoId("");
                    }
                  }}
                  className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs outline-none"
                />
              </div>

              {/* Seletor de Horário com Ajustadores */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-panel-ink">
                    Horário do atendimento *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFormHora((prev) => ajustarHorario(prev, -15))}
                      className="rounded-lg border border-panel-line bg-white px-2 py-0.5 text-xs font-bold text-panel-ink hover:border-amber transition shadow-2xs"
                      title="Voltar 15 minutos"
                    >
                      -15m
                    </button>
                    <span className="rounded-lg bg-amber px-2.5 py-0.5 font-mono text-xs font-extrabold text-night shadow-xs">
                      {formHora}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormHora((prev) => ajustarHorario(prev, 15))}
                      className="rounded-lg border border-panel-line bg-white px-2 py-0.5 text-xs font-bold text-panel-ink hover:border-amber transition shadow-2xs"
                      title="Avançar 15 minutos"
                    >
                      +15m
                    </button>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 gap-1 max-h-24 overflow-y-auto p-2 rounded-2xl border border-panel-line bg-white shadow-2xs">
                  {HORARIOS_SELECAO.map((h) => {
                    const ativo = formHora === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setFormHora(h)}
                        className={`rounded-lg py-1 text-center font-mono text-xs transition ${
                          ativo
                            ? "bg-amber text-night font-bold shadow-2xs"
                            : "bg-panel-bg text-panel-sub hover:border-amber hover:text-panel-ink"
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-panel-ink mb-1">
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Alguma anotação sobre o atendimento"
                  value={formObservacoes}
                  onChange={(e) => setFormObservacoes(e.target.value)}
                  className="w-full rounded-xl border border-panel-line bg-white px-3.5 py-2.5 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:ring-1 focus:ring-amber shadow-2xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-panel-line">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-xl border border-panel-line bg-white px-4 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night shadow-xs hover:brightness-110 active:scale-98 transition disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Salvar agendamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GERENCIAR EQUIPE DE PROFISSIONAIS (DESIGN SYSTEM LIGHT MODERNO)    */}
      {/* ========================================================================= */}
      {modalProfissionaisAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-panel-line bg-panel-card p-6 shadow-2xl space-y-4">
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
                type="button"
                onClick={() => setModalProfissionaisAberto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                <IconeAgenda nome="fechar" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Lista de profissionais */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {listaEditavelProf.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-panel-line bg-white p-4 text-center text-xs text-panel-sub">
                    Nenhum profissional cadastrado. A agenda funcionará com atendimento geral.
                  </div>
                ) : (
                  listaEditavelProf.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl border border-panel-line bg-white px-4 py-3 shadow-2xs"
                    >
                      <div>
                        <span className="font-bold text-xs text-panel-ink">{p.nome}</span>
                        {p.cargo && p.cargo !== "Profissional" && (
                          <span className="block text-[11px] text-panel-sub">{p.cargo}</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoverProfissional(p.id)}
                        className="text-xs text-red-600 hover:underline font-semibold p-1"
                        title="Remover profissional"
                      >
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Formulário para adicionar */}
              <div className="rounded-2xl border border-panel-line bg-white p-3.5 space-y-2 shadow-2xs">
                <span className="block text-xs font-bold text-panel-ink">
                  + Adicionar membro da equipe
                </span>
                <input
                  type="text"
                  placeholder="Nome (ex: Carlos Silva)"
                  value={novoProfNome}
                  onChange={(e) => setNovoProfNome(e.target.value)}
                  className="w-full rounded-xl border border-panel-line bg-white px-3 py-2 text-xs text-panel-ink placeholder:text-panel-sub/50 focus:border-amber focus:ring-1 focus:ring-amber outline-none shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleAdicionarProfissional}
                  className="w-full rounded-xl bg-panel-bg border border-panel-line py-2 text-xs font-bold text-panel-ink hover:border-amber transition"
                >
                  Adicionar à lista
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-panel-line">
                <button
                  type="button"
                  onClick={() => setModalProfissionaisAberto(false)}
                  className="rounded-xl border border-panel-line bg-white px-4 py-2 text-xs font-semibold text-panel-sub hover:text-panel-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarProfissionais}
                  disabled={salvandoProf}
                  className="rounded-xl bg-amber px-5 py-2 text-xs font-bold text-night shadow-xs hover:brightness-110 active:scale-98 transition disabled:opacity-50"
                >
                  {salvandoProf ? "Salvando..." : "Salvar equipe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LINK PÚBLICO DE AGENDAMENTO (DESIGN SYSTEM LIGHT MODERNO)          */}
      {/* ========================================================================= */}
      {modalLinkAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-panel-line bg-panel-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-panel-line pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber text-night text-xs font-bold shadow-2xs">
                  <IconeAgenda nome="link" className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-panel-ink">
                    Link de Agendamento do Cliente
                  </h3>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    Página exclusiva para seus clientes
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalLinkAberto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-panel-sub hover:bg-panel-bg hover:text-panel-ink"
              >
                <IconeAgenda nome="fechar" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-panel-line bg-white p-4 space-y-2 shadow-2xs">
                <span className="block text-xs font-bold text-panel-ink">
                  Como funciona para o seu cliente?
                </span>
                <p className="text-xs text-panel-sub leading-relaxed">
                  Ao abrir este link, seu cliente acessa uma página moderna e exclusiva com o nome do seu negócio. Ele escolhe o serviço, profissional e horário vago, e informa o nome e WhatsApp.
                </p>
                <p className="text-[11px] text-amber-deep font-bold bg-amber/10 p-2.5 rounded-xl border border-amber/20">
                  ✓ O cliente <strong>nunca</strong> vê seu painel, seus valores de faturamento ou outros clientes agendados.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-panel-ink">
                  Endereço do seu link:
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-panel-line bg-white p-2 shadow-2xs">
                  <input
                    type="text"
                    readOnly
                    value={linkPublico || "Carregando..."}
                    className="w-full bg-transparent px-2 text-xs font-mono text-panel-ink focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copiarLinkPublico}
                    disabled={!linkPublico}
                    className="whitespace-nowrap rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night shadow-xs hover:brightness-110 active:scale-98 transition disabled:opacity-50"
                  >
                    {linkCopiado ? "✓ Copiado!" : "Copiar"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-panel-line">
                {linkPublico && (
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Olá! Você pode agendar seu horário online com facilidade pelo nosso link: ${linkPublico}`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/20 transition shadow-2xs"
                  >
                    <IconeAgenda nome="whatsapp" className="h-4 w-4 text-emerald-600" />
                    <span>Enviar no WhatsApp</span>
                  </a>
                )}
                {linkPublico && (
                  <a
                    href={linkPublico}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-panel-line bg-white px-4 py-2 text-xs font-semibold text-panel-ink hover:border-amber transition shadow-2xs"
                  >
                    Ver página como cliente ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
