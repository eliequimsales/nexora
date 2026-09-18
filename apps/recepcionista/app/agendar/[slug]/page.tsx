"use client";

import { useCallback, useEffect, useState } from "react";
import { gerarIcsConteudo } from "@/lib/agenda/disponibilidade";

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

  const [servicoId, setServicoId] = useState("");
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
        setDados(json);

        const selServico = json.servicoSelecionado ?? json.servicos[0]?.id ?? "";
        setServicoId(selServico);

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

  const trocarServico = (id: string) => {
    setServicoId(id);
    setHora("");
    void carregar(id, profissionalNome);
  };

  const trocarProfissional = (nomeProf: string) => {
    setProfissionalNome(nomeProf);
    setHora("");
    void carregar(servicoId, nomeProf);
  };

  const marcar = async () => {
    if (!nome.trim() || telefone.replace(/\D/g, "").length < 10) {
      setErro("Informe seu nome completo e WhatsApp.");
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
          serviceId: servicoId,
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
          void carregar(servicoId, profissionalNome);
        }
        return;
      }

      setConfirmado({
        nomeNegocio: json.confirmacao?.negocio || dados?.negocio.nome || "Estabelecimento",
        endereco: dados?.negocio.endereco ?? "",
        servico: json.confirmacao?.servico || "Atendimento",
        profissional: json.confirmacao?.profissional || profissionalNome,
        dia: json.confirmacao?.dia || dia,
        hora: json.confirmacao?.hora || hora,
        googleCalendarUrl: json.confirmacao?.googleCalendarUrl,
        mensagemWhatsApp: json.confirmacao?.mensagemWhatsApp,
      });
    } catch {
      setErro("Erro de conexão ao marcar horário. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-amber-400 border-t-transparent" />
          <p className="text-sm text-neutral-400">Carregando horários em tempo real...</p>
        </div>
      </main>
    );
  }

  if (!dados) {
    return (
      <main className="min-h-screen bg-[#0d1117] flex items-center justify-center p-6 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-white mb-2">Página não encontrada</h1>
          <p className="text-sm text-neutral-400">
            Este link de agendamento não existe ou foi modificado.
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
      <main className="min-h-screen bg-[#0B0F17] flex items-center justify-center p-4 text-white">
        <div className="w-full max-w-lg rounded-3xl border border-neutral-800 bg-[#161C26] p-6 sm:p-8 text-center shadow-2xl animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-3xl text-emerald-400 border border-emerald-500/30">
            ✓
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">
            Horário Agendado com Sucesso!
          </h1>
          <p className="text-sm text-neutral-400 mb-6">
            Te esperamos no horário marcado. Seu agendamento já está confirmado.
          </p>

          <div className="rounded-2xl border border-neutral-800 bg-[#0E131D] p-5 text-left space-y-3 mb-6">
            <div className="flex justify-between items-start border-b border-neutral-800/80 pb-3">
              <div>
                <span className="text-xs text-neutral-400 uppercase tracking-wider">Atendimento</span>
                <p className="text-base font-bold text-white">{confirmado.servico}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400 uppercase tracking-wider">Profissional</span>
                <p className="text-sm font-semibold text-amber-400">{confirmado.profissional}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div>
                <span className="text-xs text-neutral-400 uppercase tracking-wider">Data e Horário</span>
                <p className="text-sm font-semibold text-white">
                  {rotuloDiaCompleto(confirmado.dia).textoCurto} às {confirmado.hora}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400 uppercase tracking-wider">Local</span>
                <p className="text-xs text-neutral-300 max-w-[180px] truncate">
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300 shadow-md"
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
              }}
              className="rounded-xl border border-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 hover:text-white transition mt-1"
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
    { id: "qualquer", nome: "Primeiro disponível", cargo: "Qualquer profissional" },
    ...(dados.profissionais && dados.profissionais.length > 0
      ? dados.profissionais
      : [{ id: "prof_1", nome: "Atendimento Principal", cargo: "Especialista" }]),
  ];

  const podeConfirmar =
    nome.trim().length >= 2 &&
    telefone.replace(/\D/g, "").length >= 10 &&
    servicoId &&
    dia &&
    hora;

  const inicialNegocio = dados.negocio.nome ? dados.negocio.nome.charAt(0).toUpperCase() : "N";

  return (
    <main className="min-h-screen bg-[#0B0F17] text-white py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-xl space-y-6">
        {/* Header Universal do Estabelecimento */}
        <header className="rounded-3xl border border-neutral-800 bg-[#161C26] p-6 shadow-xl text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/30 text-2xl font-bold text-amber-400">
              {inicialNegocio}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {dados.negocio.nome}
                </h1>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  ● Aberto para agendamento
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {dados.negocio.endereco || "Agendamento online em tempo real"}
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-1 text-xs text-amber-400 mt-2">
                <span>★★★★★</span>
                <span className="text-neutral-400 text-[11px] ml-1">(5.0 · Atendimento de excelência)</span>
              </div>
            </div>
          </div>
        </header>

        {/* Passo 1: Escolha o Serviço */}
        <section className="rounded-3xl border border-neutral-800 bg-[#161C26] p-5 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                1
              </span>
              <span>Escolha o Serviço</span>
            </h2>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {dados.servicos.map((s) => {
              const selecionado = servicoId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => trocarServico(s.id)}
                  className={`flex flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition ${
                    selecionado
                      ? "border-amber-400 bg-amber-400/10 shadow-md ring-1 ring-amber-400/50"
                      : "border-neutral-800 bg-[#0E131D] hover:border-neutral-700 hover:bg-[#131924]"
                  }`}
                >
                  <div className="w-full flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">{s.name}</span>
                    {selecionado ? (
                      <span className="text-[11px] font-bold text-amber-400">
                        Selecionado ✓
                      </span>
                    ) : null}
                  </div>
                  {s.priceCents > 0 && (
                    <span className="text-xs font-mono font-semibold text-amber-400/90 mt-1.5">
                      {reais(s.priceCents)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Passo 2: Escolha o Profissional */}
        <section className="rounded-3xl border border-neutral-800 bg-[#161C26] p-5 sm:p-6 shadow-lg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2 mb-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
              2
            </span>
            <span>Com quem você quer agendar?</span>
          </h2>

          <div className="flex flex-wrap gap-2">
            {profissionaisDisponiveis.map((prof) => {
              const isAtivo = profissionalNome === prof.nome;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => trocarProfissional(prof.nome)}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-xs transition ${
                    isAtivo
                      ? "border-amber-400 bg-amber-400/15 font-semibold text-white shadow"
                      : "border-neutral-800 bg-[#0E131D] text-neutral-400 hover:border-neutral-700 hover:text-white"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-bold text-amber-400">
                    {prof.nome.charAt(0)}
                  </span>
                  <div>
                    <span className="block font-medium text-white">{prof.nome}</span>
                    <span className="text-[10px] text-neutral-400">{prof.cargo}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Passo 3: Escolha a Data */}
        <section className="rounded-3xl border border-neutral-800 bg-[#161C26] p-5 sm:p-6 shadow-lg">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2 mb-3">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
              3
            </span>
            <span>Escolha a Data</span>
          </h2>

          {dados.dias.length === 0 ? (
            <p className="text-sm text-neutral-400">Sem horários livres nos próximos dias.</p>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
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
                    className={`flex flex-col items-center justify-center min-w-[70px] rounded-2xl border p-2.5 text-center transition shrink-0 ${
                      isSelected
                        ? "border-amber-400 bg-amber-400 text-neutral-950 font-bold shadow-lg"
                        : "border-neutral-800 bg-[#0E131D] text-neutral-300 hover:border-neutral-700 hover:bg-[#131924]"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold opacity-80">
                      {info.semana.slice(0, 3)}
                    </span>
                    <span className="text-lg font-bold leading-tight my-0.5">
                      {info.dia}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {info.mes}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Passo 4: Escolha o Horário Disponível com Divisão por Turnos */}
        {diaSelecionado && (
          <section className="rounded-3xl border border-neutral-800 bg-[#161C26] p-5 sm:p-6 shadow-lg animate-fade-in">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2 mb-4">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                4
              </span>
              <span>Horários Disponíveis</span>
            </h2>

            {diaSelecionado.horas.length === 0 ? (
              <p className="text-sm text-neutral-400 py-4 text-center">
                Todos os horários deste dia foram ocupados. Escolha outra data.
              </p>
            ) : (
              <div className="space-y-4">
                {periodos.manha.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1 mb-2">
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
                            className={`rounded-xl border py-2.5 text-xs font-mono font-semibold transition ${
                              isAtivo
                                ? "border-amber-400 bg-amber-400 text-neutral-950 shadow-md font-bold"
                                : "border-neutral-800 bg-[#0E131D] text-neutral-200 hover:border-amber-400/40 hover:bg-[#131924]"
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
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1 mb-2">
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
                            className={`rounded-xl border py-2.5 text-xs font-mono font-semibold transition ${
                              isAtivo
                                ? "border-amber-400 bg-amber-400 text-neutral-950 shadow-md font-bold"
                                : "border-neutral-800 bg-[#0E131D] text-neutral-200 hover:border-amber-400/40 hover:bg-[#131924]"
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
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1 mb-2">
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
                            className={`rounded-xl border py-2.5 text-xs font-mono font-semibold transition ${
                              isAtivo
                                ? "border-amber-400 bg-amber-400 text-neutral-950 shadow-md font-bold"
                                : "border-neutral-800 bg-[#0E131D] text-neutral-200 hover:border-amber-400/40 hover:bg-[#131924]"
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

        {/* Passo 5: Seus Dados */}
        {hora && (
          <section className="rounded-3xl border border-neutral-800 bg-[#161C26] p-5 sm:p-6 shadow-lg animate-fade-in space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-neutral-950">
                5
              </span>
              <span>Seus Dados de Contato</span>
            </h2>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Seu Nome Completo *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-2xl border border-neutral-800 bg-[#0E131D] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">
                Seu WhatsApp / Celular *
              </label>
              <input
                type="tel"
                required
                placeholder="(11) 98888-7777"
                value={telefone}
                onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
                className="w-full rounded-2xl border border-neutral-800 bg-[#0E131D] px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:border-amber-400 focus:outline-none"
              />
              <span className="block text-[11px] text-neutral-500 mt-1">
                Usamos seu WhatsApp para enviar a confirmação do agendamento.
              </span>
            </div>

            {erro && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                {erro}
              </p>
            )}

            <button
              type="button"
              disabled={!podeConfirmar || enviando}
              onClick={marcar}
              className="w-full rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-neutral-950 shadow-xl transition hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enviando ? "Confirmando seu horário..." : "Confirmar Agendamento"}
            </button>
          </section>
        )}

        <footer className="text-center text-xs text-neutral-500 py-4">
          Agendamento seguro proporcionado pela plataforma Nexora.
        </footer>
      </div>
    </main>
  );
}
