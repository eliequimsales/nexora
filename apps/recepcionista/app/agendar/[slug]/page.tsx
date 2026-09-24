"use client";

import { useCallback, useEffect, useState } from "react";
import { gerarIcsConteudo } from "@/lib/agenda/disponibilidade";
import { trackSchedule } from "@/lib/analytics/pixel";

type Servico = { id: string; name: string; durationMin: number; priceCents: number };
type Profissional = { id: string; nome: string; cargo: string };
type DiaComHoras = { dia: string; horas: string[]; turnos?: { manha: string[]; tarde: string[]; noite: string[] } };

type Dados = {
  negocio: { nome: string; endereco: string };
  servicos: Servico[];
  servicoSelecionado?: string;
  profissionais?: Profissional[];
  dias: DiaComHoras[];
};

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rotuloDiaCompleto = (iso: string) => {
  const d = new Date(`${iso}T12:00:00.000Z`);
  const semana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getUTCDay()];
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][d.getUTCMonth()];
  return { semana, dia, mes, textoCurto: `${semana.slice(0, 3)}, ${dia} ${mes}` };
};

const mascararTelefone = (v: string) => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 2) return n;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
};

function agruparPorPeriodo(horas: string[]) {
  const manha = horas.filter((h) => {
    const num = parseInt(h.split(":")[0], 10);
    return num < 12;
  });
  const tarde = horas.filter((h) => {
    const num = parseInt(h.split(":")[0], 10);
    return num >= 12 && num < 18;
  });
  const noite = horas.filter((h) => {
    const num = parseInt(h.split(":")[0], 10);
    return num >= 18;
  });
  return { manha, tarde, noite };
}

export default function PaginaAgendar({ params }: { params: { slug: string } }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  // Serviço é opcional: pode ser vazio (atendimento geral), um serviço específico, ou um nome customizado
  const [servicoId, setServicoId] = useState<string>("");
  const [servicoPersonalizado, setServicoPersonalizado] = useState("");
  const [mostrarCampoCustomizado, setMostrarCampoCustomizado] = useState(false);

  const [profissionalNome, setProfissionalNome] = useState("Primeiro disponível");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [confirmado, setConfirmado] = useState<{
    nomeNegocio: string;
    endereco: string;
    servico: string;
    profissional: string;
    dia: string;
    hora: string;
    googleCalendarUrl?: string;
    mensagemWhatsApp?: string;
  } | null>(null);

  const carregar = useCallback(
    async (idServico?: string, nomeProf?: string) => {
      setCarregando(true);
      setErro("");
      try {
        const queryParams = new URLSearchParams();
        if (idServico) queryParams.set("serviceId", idServico);
        if (nomeProf && nomeProf !== "Primeiro disponível") {
          queryParams.set("profissional", nomeProf);
        }

        const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
        const res = await fetch(`/api/agendar/${params.slug}${qs}`);
        if (!res.ok) throw new Error("nao-encontrado");
        const json: Dados = await res.json();
        if (json.servicos) {
          json.servicos = json.servicos.filter(
            (s) => !s.name.toLowerCase().includes("lavagem de cabelo"),
          );
        }
        setDados(json);

        if (json.dias.length > 0 && !dia) {
          setDia(json.dias[0].dia);
        }
      } catch {
        setErro("Não consegui carregar os horários disponíveis. Tente novamente em instantes.");
      } finally {
        setCarregando(false);
      }
    },
    [params.slug, dia],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const selecionarServico = (id: string) => {
    if (servicoId === id) {
      // Clicar no mesmo serviço desmarca (volta para atendimento geral opcional)
      setServicoId("");
      setHora("");
      void carregar(undefined, profissionalNome);
    } else {
      setServicoId(id);
      setHora("");
      void carregar(id, profissionalNome);
    }
  };

  const trocarProfissional = (nomeProf: string) => {
    setProfissionalNome(nomeProf);
    setHora("");
    void carregar(servicoId || undefined, nomeProf);
  };

  const marcar = async () => {
    if (!nome.trim() || telefone.replace(/\D/g, "").length < 10) {
      setErro("Informe seu nome completo e WhatsApp.");
      return;
    }
    if (!dia || !hora) {
      setErro("Por favor, escolha uma data e um horário disponível.");
      return;
    }

    setEnviando(true);
    setErro("");
    try {
      const res = await fetch(`/api/agendar/${params.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          telefone,
          serviceId: servicoId || undefined,
          servicoNome: servicoPersonalizado.trim() || undefined,
          dia,
          hora,
          profissional: profissionalNome === "Primeiro disponível" ? undefined : profissionalNome,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Não consegui marcar o horário agora.");
        if (res.status === 409) {
          setHora("");
          void carregar(servicoId || undefined, profissionalNome);
        }
        return;
      }

      setConfirmado({
        nomeNegocio: json.confirmacao?.negocio || dados?.negocio.nome || "Estabelecimento",
        endereco: dados?.negocio.endereco ?? "",
        servico: json.confirmacao?.servico || (servicoId ? dados?.servicos.find((s) => s.id === servicoId)?.name : null) || servicoPersonalizado.trim() || "Atendimento Geral",
        profissional: json.confirmacao?.profissional || profissionalNome,
        dia: json.confirmacao?.dia || dia,
        hora: json.confirmacao?.hora || hora,
        googleCalendarUrl: json.confirmacao?.googleCalendarUrl,
        mensagemWhatsApp: json.confirmacao?.mensagemWhatsApp,
      });
      trackSchedule(json.confirmacao?.servico || "Atendimento Geral");
    } catch {
      setErro("Erro de conexão ao marcar horário. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#07090E] flex items-center justify-center p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.08),transparent_70%)] pointer-events-none" />
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-amber-400/20 border-t-amber-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-xs text-amber-400 font-mono">
              ✦
            </div>
          </div>
          <p className="text-sm font-medium text-neutral-400 tracking-wide">
            Carregando horários em tempo real...
          </p>
        </div>
      </main>
    );
  }

  if (!dados) {
    return (
      <main className="min-h-screen bg-[#07090E] flex items-center justify-center p-6 text-white relative">
        <div className="max-w-md w-full rounded-3xl border border-neutral-800 bg-[#0E131E] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl text-red-400 border border-red-500/20">
            ✕
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Página não encontrada</h1>
          <p className="text-sm text-neutral-400">
            Este link de agendamento não existe ou foi modificado pelo estabelecimento.
          </p>
        </div>
      </main>
    );
  }

  // TELA DE SUCESSO / CONFIRMAÇÃO COM LEMBRETES INTEGRADOS
  if (confirmado) {
    const dataObj = new Date(`${confirmado.dia}T${confirmado.hora}:00`);
    const dataFim = new Date(dataObj.getTime() + 45 * 60000);

    const formatGoogleDate = (d: Date) =>
      d.toISOString().replace(/-|:|\.\d\d\d/g, "");

    const googleCalendarUrl =
      confirmado.googleCalendarUrl ||
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        `${confirmado.servico} - ${confirmado.nomeNegocio}`,
      )}&dates=${formatGoogleDate(dataObj)}/${formatGoogleDate(dataFim)}&details=${encodeURIComponent(
        `Agendamento confirmado com ${confirmado.profissional} no ${confirmado.nomeNegocio}.`,
      )}&location=${encodeURIComponent(confirmado.endereco)}`;

    const baixarArquivoIcs = () => {
      const conteudo = gerarIcsConteudo({
        titulo: `${confirmado.servico} - ${confirmado.nomeNegocio}`,
        descricao: `Agendamento confirmado com ${confirmado.profissional}.\nLocal: ${confirmado.nomeNegocio}`,
        localizacao: confirmado.endereco,
        startsAt: dataObj,
        endsAt: dataFim,
      });
      const blob = new Blob([conteudo], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `agendamento-${confirmado.dia}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const zapUrl =
      confirmado.mensagemWhatsApp
        ? `https://wa.me/?text=${encodeURIComponent(confirmado.mensagemWhatsApp)}`
        : `https://wa.me/?text=${encodeURIComponent(
            `Meu agendamento está confirmado na ${confirmado.nomeNegocio} para ${confirmado.dia} às ${confirmado.hora}!`,
          )}`;

    return (
      <main className="min-h-screen bg-[#07090E] flex items-center justify-center p-4 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_60%)] pointer-events-none" />
        
        <div className="w-full max-w-lg rounded-3xl border border-neutral-800/80 bg-[#0E131E]/95 backdrop-blur-xl p-6 sm:p-8 text-center shadow-2xl relative z-10 animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-3xl text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            ✓
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Horário Agendado com Sucesso!
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            Te esperamos no horário marcado. Seu agendamento já está confirmado.
          </p>

          <div className="rounded-2xl border border-neutral-800 bg-[#141A26] p-5 text-left space-y-3 mb-6 shadow-inner">
            <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Atendimento</span>
                <p className="text-base font-bold text-white">{confirmado.servico}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Profissional</span>
                <p className="text-sm font-semibold text-amber-400">{confirmado.profissional}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div>
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Data e Horário</span>
                <p className="text-sm font-semibold text-white">
                  {rotuloDiaCompleto(confirmado.dia).textoCurto} às {confirmado.hora}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Local</span>
                <p className="text-xs text-neutral-300 max-w-[180px] truncate" title={confirmado.nomeNegocio}>
                  {confirmado.nomeNegocio}
                </p>
              </div>
            </div>
          </div>

          {/* Destaque de Lembretes Anti-Esquecimento */}
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-left mb-6 space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <span>🔔</span>
              <span>Lembrete no seu Calendário</span>
            </span>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Adicione à sua agenda para receber notificação no celular antes do horário e não esquecer seu atendimento:
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-3.5 text-sm font-bold text-neutral-950 transition hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 active:scale-[0.99]"
            >
              <span>📅</span>
              <span>Adicionar ao Google Agenda</span>
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={baixarArquivoIcs}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-800/80 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 transition"
                title="Compatível com iPhone (Apple Calendar), Mac e Outlook"
              >
                <span>🍏</span>
                <span>Apple / Outlook</span>
              </button>

              <a
                href={zapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <span>💬</span>
                <span>Salvar no WhatsApp</span>
              </a>
            </div>

            <button
              onClick={() => {
                setConfirmado(null);
                setNome("");
                setTelefone("");
                setHora("");
                setServicoId("");
                setServicoPersonalizado("");
              }}
              className="rounded-xl border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white transition mt-2"
            >
              Fazer outro agendamento
            </button>
          </div>
        </div>
      </main>
    );
  }

  const diaSelecionado = dados.dias.find((d) => d.dia === dia) ?? dados.dias[0];
  const periodos = diaSelecionado ? agruparPorPeriodo(diaSelecionado.horas) : { manha: [], tarde: [], noite: [] };

  const profissionaisDisponiveis = [
    { id: "qualquer", nome: "Primeiro disponível", cargo: "Atendimento mais rápido" },
    ...(dados.profissionais && dados.profissionais.length > 0
      ? dados.profissionais
      : []),
  ];

  // A escolha do serviço NÃO é obrigatória para poder confirmar!
  const podeConfirmar =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    dia &&
    hora;

  const inicialNegocio = dados.negocio.nome ? dados.negocio.nome.charAt(0).toUpperCase() : "N";

  const servicoSelecionadoObj = dados.servicos.find((s) => s.id === servicoId);

  return (
    <main className="min-h-screen bg-[#07090E] text-white py-10 px-4 sm:px-6 relative overflow-hidden">
      {/* Luz ambiente de fundo sutil e luxuosa */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_70%)] pointer-events-none" />

      <div className="mx-auto max-w-2xl space-y-6 relative z-10">
        {/* Cabeçalho do Estabelecimento */}
        <header className="rounded-3xl border border-neutral-800/80 bg-[#0E131E]/90 backdrop-blur-xl p-6 sm:p-7 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left">
            <div className="flex h-16 w-16 sm:h-18 sm:w-18 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 text-2xl sm:text-3xl font-bold text-amber-300 shadow-inner">
              {inicialNegocio}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                  {dados.negocio.nome}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Aberto para agendamento
                </span>
              </div>
              
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed flex items-center justify-center sm:justify-start gap-1.5">
                <span>📍</span>
                <span>{dados.negocio.endereco || "Atendimento presencial no estabelecimento"}</span>
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs mt-2.5">
                <div className="flex text-amber-400 text-sm">★★★★★</div>
                <span className="text-neutral-400 text-xs font-medium">5.0 · Atendimento com horário reservado</span>
              </div>
            </div>
          </div>
        </header>

        {/* PASSO 1: Escolha o Serviço (OPCIONAL) */}
        <section className="rounded-3xl border border-neutral-800/80 bg-[#0E131E]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                1
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Qual serviço você gostaria?
              </h2>
            </div>
            <span className="rounded-full bg-neutral-800/80 border border-neutral-700/60 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400">
              Opcional
            </span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Selecione um dos serviços abaixo se desejar, ou apenas escolha o horário para um atendimento geral.
          </p>

          {/* Opção Rápida: Atendimento Geral / Apenas Agendar Horário */}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setServicoId("");
                setServicoPersonalizado("");
                setHora("");
                void carregar(undefined, profissionalNome);
              }}
              className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                !servicoId && !servicoPersonalizado
                  ? "border-amber-400 bg-amber-400/10 shadow-md ring-1 ring-amber-400/40"
                  : "border-neutral-800 bg-[#131926] hover:border-neutral-700 hover:bg-[#182030]"
              }`}
            >
              <div>
                <span className="font-semibold text-sm text-white block">Apenas agendar horário</span>
                <span className="text-[11px] text-neutral-400">Atendimento geral · 30 min</span>
              </div>
              {!servicoId && !servicoPersonalizado ? (
                <span className="text-xs font-bold text-amber-400">Selecionado ✓</span>
              ) : null}
            </button>

            {dados.servicos
              .filter((s) => !s.name.toLowerCase().includes("lavagem de cabelo"))
              .map((s) => {
                const selecionado = servicoId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selecionarServico(s.id)}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 text-left transition ${
                      selecionado
                        ? "border-amber-400 bg-amber-400/10 shadow-md ring-1 ring-amber-400/40"
                        : "border-neutral-800 bg-[#131926] hover:border-neutral-700 hover:bg-[#182030]"
                    }`}
                  >
                    <div className="flex-1 pr-2">
                      <span className="font-semibold text-sm text-white block truncate">{s.name}</span>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {s.durationMin} min {s.priceCents > 0 ? `· ${reais(s.priceCents)}` : ""}
                      </span>
                    </div>
                    {selecionado ? (
                      <span className="text-xs font-bold text-amber-400 shrink-0">Selecionado ✓</span>
                    ) : null}
                  </button>
                );
              })}
          </div>

          {/* Opção para escrever o serviço se quiser */}
          <div className="pt-1">
            {!mostrarCampoCustomizado && !servicoPersonalizado ? (
              <button
                type="button"
                onClick={() => setMostrarCampoCustomizado(true)}
                className="text-xs text-amber-400/90 hover:text-amber-300 underline font-medium transition"
              >
                + Deseja escrever o que você precisa fazer?
              </button>
            ) : (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-xs font-medium text-neutral-300">
                  Descreva o que você precisa (opcional):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: Manutenção, corte degradê, avaliação..."
                    value={servicoPersonalizado}
                    onChange={(e) => setServicoPersonalizado(e.target.value)}
                    className="flex-1 rounded-xl border border-neutral-800 bg-[#131926] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none"
                  />
                  {servicoPersonalizado && (
                    <button
                      type="button"
                      onClick={() => setServicoPersonalizado("")}
                      className="text-xs text-neutral-400 hover:text-white px-2"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PASSO 2: Escolha o Profissional */}
        {profissionaisDisponiveis.length > 1 && (
          <section className="rounded-3xl border border-neutral-800/80 bg-[#0E131E]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                  2
                </span>
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Com quem você quer agendar?
                </h2>
              </div>
              <span className="rounded-full bg-neutral-800/80 border border-neutral-700/60 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400">
                Opcional
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              {profissionaisDisponiveis.map((prof) => {
                const isAtivo = profissionalNome === prof.nome;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => trocarProfissional(prof.nome)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition ${
                      isAtivo
                        ? "border-amber-400 bg-amber-400/15 font-semibold text-white shadow-md ring-1 ring-amber-400/40"
                        : "border-neutral-800 bg-[#131926] text-neutral-300 hover:border-neutral-700 hover:text-white"
                    }`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold text-amber-400">
                      {prof.nome.charAt(0)}
                    </span>
                    <div>
                      <span className="block font-medium text-xs text-white">{prof.nome}</span>
                      <span className="text-[10px] text-neutral-400">{prof.cargo}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* PASSO 3: Escolha a Data */}
        <section className="rounded-3xl border border-neutral-800/80 bg-[#0E131E]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
              {profissionaisDisponiveis.length > 1 ? "3" : "2"}
            </span>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Escolha a data
            </h2>
          </div>

          {dados.dias.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4 text-center">
              Sem horários livres nos próximos dias para este serviço ou profissional.
            </p>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {dados.dias.map((d) => {
                const info = rotuloDiaCompleto(d.dia);
                const isSelected = dia === d.dia;
                return (
                  <button
                    key={d.dia}
                    type="button"
                    onClick={() => {
                      setDia(d.dia);
                      setHora("");
                    }}
                    className={`flex flex-col items-center justify-center min-w-[76px] sm:min-w-[84px] py-3.5 px-2 rounded-2xl border text-center transition shrink-0 ${
                      isSelected
                        ? "border-amber-400 bg-amber-400 text-neutral-950 font-bold shadow-lg shadow-amber-400/20 scale-[1.02]"
                        : "border-neutral-800 bg-[#131926] text-neutral-300 hover:border-neutral-700 hover:bg-[#182030]"
                    }`}
                  >
                    <span className={`text-[11px] uppercase tracking-wider font-semibold ${isSelected ? "text-neutral-900" : "text-neutral-400"}`}>
                      {info.semana.slice(0, 3)}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold leading-tight my-1">
                      {info.dia}
                    </span>
                    <span className={`text-[11px] capitalize ${isSelected ? "text-neutral-900" : "text-neutral-400"}`}>
                      {info.mes}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* PASSO 4: Escolha o Horário Disponível com Divisão por Turnos */}
        {diaSelecionado && (
          <section className="rounded-3xl border border-neutral-800/80 bg-[#0E131E]/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                {profissionaisDisponiveis.length > 1 ? "4" : "3"}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Horários disponíveis ({rotuloDiaCompleto(diaSelecionado.dia).textoCurto})
              </h2>
            </div>

            {diaSelecionado.horas.length === 0 ? (
              <p className="text-sm text-neutral-400 py-6 text-center">
                Todos os horários deste dia foram ocupados. Por favor, escolha outra data acima.
              </p>
            ) : (
              <div className="space-y-4">
                {periodos.manha.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2.5">
                      <span>☀️</span>
                      <span>Manhã</span>
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {periodos.manha.map((h) => {
                        const isAtivo = hora === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setHora(h)}
                            className={`rounded-xl border py-2.5 text-xs sm:text-sm font-mono font-semibold transition ${
                              isAtivo
                                ? "border-amber-400 bg-amber-400 text-neutral-950 shadow-md font-bold scale-105"
                                : "border-neutral-800 bg-[#131926] text-neutral-200 hover:border-amber-400/40 hover:bg-[#182030]"
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {periodos.tarde.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2.5">
                      <span>🌤️</span>
                      <span>Tarde</span>
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {periodos.tarde.map((h) => {
                        const isAtivo = hora === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setHora(h)}
                            className={`rounded-xl border py-2.5 text-xs sm:text-sm font-mono font-semibold transition ${
                              isAtivo
                                ? "border-amber-400 bg-amber-400 text-neutral-950 shadow-md font-bold scale-105"
                                : "border-neutral-800 bg-[#131926] text-neutral-200 hover:border-amber-400/40 hover:bg-[#182030]"
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {periodos.noite.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5 mb-2.5">
                      <span>🌙</span>
                      <span>Noite</span>
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {periodos.noite.map((h) => {
                        const isAtivo = hora === h;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setHora(h)}
                            className={`rounded-xl border py-2.5 text-xs sm:text-sm font-mono font-semibold transition ${
                              isAtivo
                                ? "border-amber-400 bg-amber-400 text-neutral-950 shadow-md font-bold scale-105"
                                : "border-neutral-800 bg-[#131926] text-neutral-200 hover:border-amber-400/40 hover:bg-[#182030]"
                            }`}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* PASSO 5: Seus Dados de Contato e Botão de Confirmação */}
        {hora && (
          <section className="rounded-3xl border border-neutral-800/80 bg-[#0E131E]/90 backdrop-blur-xl p-5 sm:p-7 shadow-2xl animate-fade-in space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                {profissionaisDisponiveis.length > 1 ? "5" : "4"}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Seus dados de contato
              </h2>
            </div>

            <p className="text-xs text-neutral-400">
              Informe seu nome e WhatsApp para garantirmos a reserva do seu horário e enviarmos o lembrete.
            </p>

            <div className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Seu Nome Completo *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-500 text-sm">
                    👤
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-800 bg-[#131926] pl-10 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Seu WhatsApp / Celular *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-neutral-500 text-sm">
                    📱
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="(11) 98888-7777"
                    value={telefone}
                    onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                    className="w-full rounded-2xl border border-neutral-800 bg-[#131926] pl-10 pr-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/50 transition"
                  />
                </div>
              </div>
            </div>

            {erro && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {erro}
              </p>
            )}

            <div className="pt-2">
              <button
                type="button"
                disabled={!podeConfirmar || enviando}
                onClick={marcar}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 py-4 text-sm sm:text-base font-bold text-neutral-950 shadow-xl shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-amber-400 disabled:hover:to-amber-500"
              >
                {enviando ? "Confirmando seu horário..." : "Confirmar Agendamento"}
              </button>
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-neutral-500 py-4">
          Agendamento seguro proporcionado pela plataforma Nexora.
        </footer>
      </div>
    </main>
  );
}
