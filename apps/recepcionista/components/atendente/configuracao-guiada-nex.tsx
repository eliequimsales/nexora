"use client";

import { SimuladorWhatsAppCelular } from "./simulador-whatsapp-celular";

import { useState } from "react";
import type {
  ConfiguracaoNexa,
  HorarioNexa,
  TelaConfiguracaoNexa,
  CenarioNexa,
} from "@/lib/atendente/configuracao-schema";
import {
  BOTAO_NEXA as BOTAO,
  CAMPO_NEXA as CAMPO,
  PRINCIPAL_NEXA as PRINCIPAL,
} from "./configuracao-campos";

const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

const PASSOS = [
  { id: 1, nome: "Sua Empresa", icone: "🏢", descricao: "Nome, ramo e endereço" },
  { id: 2, nome: "Serviços & Preços", icone: "💼", descricao: "O que você oferece" },
  { id: 3, nome: "Dias & Horários", icone: "⏰", descricao: "Quando está aberto" },
  { id: 4, nome: "Jeito de Atender", icone: "💬", descricao: "Personalidade e regras" },
  { id: 5, nome: "Teste & WhatsApp", icone: "🚀", descricao: "Testar e colocar no ar" },
] as const;

const MENTOR_NEX = {
  1: {
    pose: "/nex/nex_boas_vindas.png",
    fala: "Olá! Sou o Nex, seu atendente virtual. Vamos começar: qual é o nome da sua empresa e o que vocês oferecem? Assim eu me apresento com autoridade aos seus clientes no WhatsApp.",
    dica: "Dica: Você pode preencher de forma simples. Suas alterações são salvas automaticamente.",
  },
  2: {
    pose: "/nex/nex_checklist.png",
    fala: "Aqui nós cadastramos o que você oferece aos seus clientes. Quando alguém perguntar 'quanto custa?' ou 'vocês fazem tal serviço?' no WhatsApp, eu respondo na hora!",
    dica: "Dica: Se o preço varia, escolha 'Sob consulta'. Se usa agendamentos, informe a duração em minutos.",
  },
  3: {
    pose: "/nex/nex_agendamento.png",
    fala: "Quais são os dias e horários em que você atende? Assim eu sei quando sua empresa está aberta e marco horários de agendamento apenas nos momentos certos.",
    dica: "Dica: Use o botão de horário comercial para preencher a semana inteira com apenas um clique!",
  },
  4: {
    pose: "/nex/nex_headset_atendimento.png",
    fala: "Como você prefere que eu converse com seu público? Escolha o tom de voz e como vamos lidar com formas de pagamento e pedidos de agendamento.",
    dica: "Dica: Você pode mudar o tom de conversa a qualquer momento depois.",
  },
  5: {
    pose: "/nex/nex_whatsapp.png",
    fala: "Sensacional! Suas informações estão salvas. Mande uma mensagem de teste para ver como eu respondo no WhatsApp e, em seguida, conecte o número da sua empresa!",
    dica: "Dica: Quando o WhatsApp for conectado, eu já posso começar a atender seus clientes conforme as suas regras.",
  },
} as const;

type Props = {
  tela: TelaConfiguracaoNexa;
  rascunho: ConfiguracaoNexa;
  pendente: boolean;
  ocupado: boolean;
  erro: string;
  aviso: string;
  canal: TelaConfiguracaoNexa["conexao"];
  publicado: boolean;
  pronto: boolean;
  editar: <K extends keyof ConfiguracaoNexa>(
    bloco: K,
    dados: Partial<ConfiguracaoNexa[K]>
  ) => void;
  abrirConexao: () => void;
  abrirTeste: (cenario?: CenarioNexa) => void;
  abrirResumo: () => void;
  ativar: () => Promise<void>;
  pausar: () => Promise<void>;
};

export function ConfiguracaoGuiadaNex({
  tela,
  rascunho: d,
  pendente,
  ocupado,
  erro,
  aviso,
  canal,
  publicado,
  pronto,
  editar,
  abrirConexao,
  abrirTeste,
  abrirResumo,
  ativar,
  pausar,
}: Props) {
  const [passoAtivo, setPassoAtivo] = useState<number>(1);
  const [novaData, setNovaData] = useState("");
  const [visaoCompleta, setVisaoCompleta] = useState(false);

  const usaAgenda =
    d.negocio.objetivo === "AGENDAMENTOS" ||
    d.atendimento.agendamento !== "DESLIGADO";

  const mentor = MENTOR_NEX[passoAtivo as keyof typeof MENTOR_NEX] || MENTOR_NEX[1];

  // Helpers de Horário
  function mudarHorarios(horarios: HorarioNexa[]) {
    editar("informacoes", {
      horarios,
      horariosSituacao:
        d.informacoes.horariosSituacao === "REVISAR" ? "REVISAR" : "CONFIRMADO",
    });
  }

  function preencherHorarioComercial() {
    const padrao: HorarioNexa[] = [
      { day: 0, open: "", close: "", closed: true },
      { day: 1, open: "09:00", close: "18:00", closed: false },
      { day: 2, open: "09:00", close: "18:00", closed: false },
      { day: 3, open: "09:00", close: "18:00", closed: false },
      { day: 4, open: "09:00", close: "18:00", closed: false },
      { day: 5, open: "09:00", close: "18:00", closed: false },
      { day: 6, open: "09:00", close: "13:00", closed: false },
    ];
    mudarHorarios(padrao);
  }

  function adicionarServico() {
    editar("informacoes", {
      servicos: [
        ...d.informacoes.servicos,
        {
          id: `novo:${crypto.randomUUID()}`,
          nome: "",
          descricao: "",
          precoModo: "FIXO",
          precoCents: 5000,
          duracaoMin: usaAgenda ? 30 : null,
          situacao: "CONFIRMADO",
          origem: "MANUAL",
        },
      ],
    });
  }

  function removerServico(id: string) {
    editar("informacoes", {
      servicos: d.informacoes.servicos.filter((s) => s.id !== id),
    });
  }

  function atualizarServico(
    id: string,
    novo: Partial<ConfiguracaoNexa["informacoes"]["servicos"][number]>
  ) {
    editar("informacoes", {
      servicos: d.informacoes.servicos.map((s) =>
        s.id === id ? { ...s, ...novo, origem: "MANUAL" } : s
      ),
    });
  }

  function adicionarPergunta() {
    editar("conhecimento", {
      itens: [
        ...d.conhecimento.itens,
        {
          id: `novo:${crypto.randomUUID()}`,
          pergunta: "",
          resposta: "",
          situacao: "CONFIRMADO",
          origem: "MANUAL",
        },
      ],
    });
  }

  function removerPergunta(id: string) {
    editar("conhecimento", {
      itens: d.conhecimento.itens.filter((p) => p.id !== id),
    });
  }

  function atualizarPergunta(
    id: string,
    novo: Partial<ConfiguracaoNexa["conhecimento"]["itens"][number]>
  ) {
    editar("conhecimento", {
      itens: d.conhecimento.itens.map((p) =>
        p.id === id ? { ...p, ...novo, origem: "MANUAL" } : p
      ),
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header com Status e Ações Rápidas */}
      <header className="flex flex-col gap-3 rounded-3xl border border-panel-line bg-panel-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src="/nex/nex-avatar.png"
              alt="Nex"
              className="h-12 w-12 rounded-2xl border-2 border-emerald-500/30 bg-white object-cover shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-white">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-panel-ink sm:text-lg">
                Configuração do Nex
              </h1>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                Atendente Virtual
              </span>
            </div>
            <p className="flex items-center gap-2 text-xs text-panel-sub">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  pendente
                    ? "bg-amber animate-ping"
                    : erro
                    ? "bg-red-500"
                    : "bg-emerald-500"
                }`}
              />
              {pendente
                ? "Salvando alterações automaticamente…"
                : erro
                ? "Erro ao salvar"
                : "Tudo salvo com segurança"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs font-semibold text-panel-ink hover:bg-white"
            onClick={abrirResumo}
          >
            📋 O que já sabe
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-panel-line bg-panel-bg px-3 py-2 text-xs font-semibold text-panel-ink hover:bg-white"
            onClick={() => abrirTeste()}
          >
            ▶️ Testar atendimento
          </button>
          <button
            type="button"
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              canal.conectado
                ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
            }`}
            onClick={abrirConexao}
          >
            <span>💬</span>
            <span>
              {canal.conectado ? "WhatsApp conectado" : "Conectar WhatsApp"}
            </span>
          </button>
        </div>
      </header>

      {/* Avisos e Erros */}
      {erro && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-semibold">Aviso de salvamento</p>
          <p className="mt-0.5 text-xs">{erro}</p>
        </div>
      )}
      {aviso && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {aviso}
        </div>
      )}

      {/* Barra de Progresso e Seleção dos 5 Passos (Stepper) */}
      <nav
        aria-label="Passos da configuração"
        className="rounded-2xl border border-panel-line bg-panel-card p-3 shadow-xs"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PASSOS.map((p) => {
            const isAtivo = passoAtivo === p.id;
            const isConcluido = passoAtivo > p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPassoAtivo(p.id);
                  setVisaoCompleta(false);
                }}
                className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition sm:p-3 ${
                  isAtivo
                    ? "border-amber bg-amber/15 shadow-xs ring-1 ring-amber/50"
                    : isConcluido
                    ? "border-emerald-600/25 bg-emerald-50/50 hover:bg-emerald-50"
                    : "border-panel-line bg-panel-bg/40 hover:bg-panel-bg text-panel-sub"
                }`}
              >
                <div className="flex w-full items-center justify-between text-xs">
                  <span className="font-bold">Passo {p.id}</span>
                  <span>{isConcluido ? "✓" : p.icone}</span>
                </div>
                <span className="text-xs font-bold leading-tight text-panel-ink sm:text-sm">
                  {p.nome}
                </span>
                <span className="hidden text-[10px] text-panel-sub sm:block">
                  {p.descricao}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-panel-line pt-2 text-[11px] text-panel-sub">
          <span>Passo {passoAtivo} de 5 selecionado</span>
          <button
            type="button"
            className="text-amber-900 underline underline-offset-2 hover:text-amber"
            onClick={() => setVisaoCompleta(!visaoCompleta)}
          >
            {visaoCompleta ? "Voltar ao modo passo a passo" : "Ver todas as seções juntas"}
          </button>
        </div>
      </nav>

      {/* Banner de Orientação do Nex Mentor */}
      <div className="relative overflow-hidden rounded-3xl border border-amber/30 bg-gradient-to-r from-amber/15 via-white to-emerald-500/10 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <img
              src={mentor.pose}
              alt="Nex Guia"
              className="h-24 w-24 rounded-2xl object-contain drop-shadow-md sm:h-28 sm:w-28"
            />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Nex orienta você no Passo {passoAtivo}
            </div>
            <h2 className="mt-2 text-base font-bold text-panel-ink sm:text-lg">
              &ldquo;{mentor.fala}&rdquo;
            </h2>
            <p className="mt-1 text-xs text-panel-sub">{mentor.dica}</p>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL: Renderiza o Passo Ativo (ou Todos se visaoCompleta) */}
      <div className="space-y-6">
        {/* ==================== PASSO 1: SUA EMPRESA ==================== */}
        {(passoAtivo === 1 || visaoCompleta) && (
          <section
            aria-labelledby="titulo-passo-1"
            className="rounded-3xl border border-panel-line bg-panel-card p-5 shadow-xs sm:p-6"
          >
            <div className="mb-4 border-b border-panel-line pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                Passo 1
              </span>
              <h3
                id="titulo-passo-1"
                className="text-lg font-bold text-panel-ink"
              >
                🏢 Sobre a sua Empresa
              </h3>
              <p className="text-xs text-panel-sub">
                Esses dados são usados pelo Nex para se apresentar e orientar seus clientes.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-panel-ink">
                    Nome da Empresa
                  </span>
                  <input
                    type="text"
                    className={CAMPO}
                    placeholder="Ex: Barbearia Imperial, Clínica Sorriso"
                    maxLength={120}
                    value={d.negocio.nome}
                    onChange={(e) => editar("negocio", { nome: e.target.value })}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold text-panel-ink">
                    Área de Atuação / Segmento
                  </span>
                  <input
                    type="text"
                    className={CAMPO}
                    placeholder="Ex: Barbearia, Dentista, Assistência Técnica"
                    maxLength={120}
                    value={d.negocio.segmento}
                    onChange={(e) =>
                      editar("negocio", { segmento: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-panel-ink">
                    Como você atende seus clientes?
                  </span>
                  <select
                    className={CAMPO}
                    value={d.negocio.modalidade}
                    onChange={(e) =>
                      editar("negocio", {
                        modalidade: e.target
                          .value as typeof d.negocio.modalidade,
                      })
                    }
                  >
                    <option value="PRESENCIAL">Em um endereço fixo (presencial)</option>
                    <option value="ONLINE">Online / Remoto</option>
                    <option value="DOMICILIO">No local do cliente (a domicílio)</option>
                    <option value="HIBRIDO">Presencial e Online (Híbrido)</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold text-panel-ink">
                    Principal objetivo do Nex
                  </span>
                  <select
                    className={CAMPO}
                    value={d.negocio.objetivo}
                    onChange={(e) => {
                      const objetivo = e.target
                        .value as typeof d.negocio.objetivo;
                      editar("negocio", { objetivo });
                      if (
                        objetivo !== "AGENDAMENTOS" &&
                        d.atendimento.agendamento !== "DESLIGADO"
                      ) {
                        editar("atendimento", { agendamento: "DESLIGADO" });
                      }
                    }}
                  >
                    <option value="DUVIDAS">Tirar dúvidas e informar sobre a empresa</option>
                    <option value="AGENDAMENTOS">Ajudar clientes a marcar horários</option>
                    <option value="SOLICITACOES">Receber pedidos e orçamentos</option>
                  </select>
                </label>
              </div>

              {(d.negocio.modalidade === "PRESENCIAL" ||
                d.negocio.modalidade === "HIBRIDO") && (
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-panel-ink">
                    Endereço completo de atendimento
                  </span>
                  <input
                    type="text"
                    className={CAMPO}
                    placeholder="Ex: Rua das Flores, 120, Sala 4 - Centro, São Paulo"
                    maxLength={300}
                    value={d.informacoes.endereco.valor}
                    onChange={(e) =>
                      editar("informacoes", {
                        endereco: {
                          ...d.informacoes.endereco,
                          valor: e.target.value,
                          situacao: e.target.value.trim()
                            ? "CONFIRMADO"
                            : "NAO_INFORMADO",
                        },
                      })
                    }
                  />
                  <span className="text-[11px] text-panel-sub">
                    Quando o cliente perguntar onde fica ou pedir a localização, o Nex informa este endereço.
                  </span>
                </label>
              )}

              {(d.negocio.modalidade === "DOMICILIO" ||
                d.negocio.modalidade === "HIBRIDO") && (
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-panel-ink">
                    Região atendida (bairros ou cidades)
                  </span>
                  <input
                    type="text"
                    className={CAMPO}
                    placeholder="Ex: Zona Sul de São Paulo, raio de 15km"
                    maxLength={300}
                    value={d.negocio.regiao.valor}
                    onChange={(e) =>
                      editar("negocio", {
                        regiao: {
                          ...d.negocio.regiao,
                          valor: e.target.value,
                          situacao: e.target.value.trim()
                            ? "CONFIRMADO"
                            : "NAO_INFORMADO",
                        },
                      })
                    }
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-xs font-bold text-panel-ink">
                  Apresentação rápida da empresa (opcional)
                </span>
                <textarea
                  rows={3}
                  className={CAMPO}
                  placeholder="Ex: Somos especialistas em cortes clássicos e cuidados com a barba há mais de 10 anos, com café expresso e estacionamento próprio."
                  maxLength={1000}
                  value={d.negocio.descricao.valor}
                  onChange={(e) =>
                    editar("negocio", {
                      descricao: {
                        ...d.negocio.descricao,
                        valor: e.target.value,
                        situacao: e.target.value.trim()
                          ? "CONFIRMADO"
                          : "NAO_INFORMADO",
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>
        )}

        {/* ==================== PASSO 2: SERVIÇOS & PREÇOS ==================== */}
        {(passoAtivo === 2 || visaoCompleta) && (
          <section
            aria-labelledby="titulo-passo-2"
            className="rounded-3xl border border-panel-line bg-panel-card p-5 shadow-xs sm:p-6"
          >
            <div className="mb-4 flex flex-col justify-between gap-2 border-b border-panel-line pb-3 sm:flex-row sm:items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                  Passo 2
                </span>
                <h3
                  id="titulo-passo-2"
                  className="text-lg font-bold text-panel-ink"
                >
                  💼 Serviços e Preços
                </h3>
                <p className="text-xs text-panel-sub">
                  Cadastre o que você oferece para o Nex passar orçamentos e agendar.
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night hover:bg-amber/90"
                onClick={adicionarServico}
              >
                + Adicionar Serviço
              </button>
            </div>

            {d.informacoes.servicos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-panel-line p-8 text-center">
                <p className="text-sm font-semibold text-panel-ink">
                  Nenhum serviço cadastrado ainda.
                </p>
                <p className="mt-1 text-xs text-panel-sub">
                  Clique no botão abaixo para adicionar seus serviços, preços e durações.
                </p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber px-4 py-2 text-xs font-bold text-night"
                  onClick={adicionarServico}
                >
                  + Adicionar Primeiro Serviço
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {d.informacoes.servicos.map((servico, idx) => (
                  <div
                    key={servico.id}
                    className="rounded-2xl border border-panel-line bg-panel-bg/40 p-4 transition hover:border-amber/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-line pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber/20 text-xs font-bold text-amber-900">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-panel-ink">
                          {servico.nome.trim() || `Serviço ${idx + 1}`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                        onClick={() => removerServico(servico.id)}
                      >
                        Excluir item
                      </button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-5">
                        <label className="block space-y-1">
                          <span className="text-[11px] font-bold text-panel-sub">
                            Nome do Serviço
                          </span>
                          <input
                            type="text"
                            className={CAMPO}
                            placeholder="Ex: Corte Masculino, Consulta, Limpeza"
                            maxLength={140}
                            value={servico.nome}
                            onChange={(e) =>
                              atualizarServico(servico.id, {
                                nome: e.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block space-y-1">
                          <span className="text-[11px] font-bold text-panel-sub">
                            Tipo de Preço
                          </span>
                          <select
                            className={CAMPO}
                            value={servico.precoModo}
                            onChange={(e) =>
                              atualizarServico(servico.id, {
                                precoModo: e.target
                                  .value as typeof servico.precoModo,
                                ...(e.target.value === "SOB_CONSULTA"
                                  ? { precoCents: null }
                                  : { precoCents: servico.precoCents || 5000 }),
                              })
                            }
                          >
                            <option value="FIXO">Valor Fixo (R$)</option>
                            <option value="SOB_CONSULTA">Sob Consulta</option>
                          </select>
                        </label>
                      </div>

                      {servico.precoModo === "FIXO" && (
                        <div className="sm:col-span-2">
                          <label className="block space-y-1">
                            <span className="text-[11px] font-bold text-panel-sub">
                              Valor (R$)
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className={CAMPO}
                              placeholder="0,00"
                              value={
                                servico.precoCents != null
                                  ? (servico.precoCents / 100).toFixed(2)
                                  : ""
                              }
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                atualizarServico(servico.id, {
                                  precoCents: isNaN(val)
                                    ? null
                                    : Math.round(val * 100),
                                });
                              }}
                            />
                          </label>
                        </div>
                      )}

                      <div
                        className={
                          servico.precoModo === "FIXO"
                            ? "sm:col-span-2"
                            : "sm:col-span-4"
                        }
                      >
                        <label className="block space-y-1">
                          <span className="text-[11px] font-bold text-panel-sub">
                            Duração (minutos)
                          </span>
                          <input
                            type="number"
                            min="5"
                            max="720"
                            step="5"
                            className={CAMPO}
                            placeholder="Ex: 30"
                            value={servico.duracaoMin ?? ""}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              atualizarServico(servico.id, {
                                duracaoMin: isNaN(val) ? null : val,
                              });
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ==================== PASSO 3: DIAS & HORÁRIOS ==================== */}
        {(passoAtivo === 3 || visaoCompleta) && (
          <section
            aria-labelledby="titulo-passo-3"
            className="rounded-3xl border border-panel-line bg-panel-card p-5 shadow-xs sm:p-6"
          >
            <div className="mb-4 flex flex-col justify-between gap-2 border-b border-panel-line pb-3 sm:flex-row sm:items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                  Passo 3
                </span>
                <h3
                  id="titulo-passo-3"
                  className="text-lg font-bold text-panel-ink"
                >
                  ⏰ Dias e Horários de Atendimento
                </h3>
                <p className="text-xs text-panel-sub">
                  Defina o expediente da sua empresa para o Nex responder no momento certo.
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber bg-amber/20 px-3.5 py-2 text-xs font-bold text-night hover:bg-amber/30"
                onClick={preencherHorarioComercial}
              >
                ⚡ Preencher Horário Comercial Padrão
              </button>
            </div>

            <div className="divide-y divide-panel-line rounded-2xl border border-panel-line bg-panel-bg/30">
              {ORDEM_DIAS.map((diaIndex) => {
                const diaNome = DIAS[diaIndex];
                const horario = d.informacoes.horarios.find(
                  (h) => h.day === diaIndex
                ) || {
                  day: diaIndex,
                  open: "09:00",
                  close: "18:00",
                  closed: diaIndex === 0,
                };

                const mudar = (novo: Partial<typeof horario>) => {
                  mudarHorarios([
                    ...d.informacoes.horarios.filter((h) => h.day !== diaIndex),
                    { ...horario, ...novo },
                  ]);
                };

                return (
                  <div
                    key={diaIndex}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3 sm:w-44">
                      <span className="text-xs font-bold text-panel-ink">
                        {diaNome}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-panel-sub cursor-pointer">
                        <input
                          type="checkbox"
                          checked={horario.closed}
                          onChange={(e) =>
                            mudar({
                              closed: e.target.checked,
                              ...(e.target.checked
                                ? { open: "", close: "" }
                                : { open: "09:00", close: "18:00" }),
                            })
                          }
                          className="h-4 w-4 rounded-md accent-amber"
                        />
                        <span>Fechado</span>
                      </label>

                      {!horario.closed && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            className="rounded-lg border border-panel-line bg-panel-card px-2 py-1 text-xs text-panel-ink"
                            value={horario.open}
                            onChange={(e) => mudar({ open: e.target.value })}
                          />
                          <span className="text-xs text-panel-sub">às</span>
                          <input
                            type="time"
                            className="rounded-lg border border-panel-line bg-panel-card px-2 py-1 text-xs text-panel-ink"
                            value={horario.close}
                            onChange={(e) => mudar({ close: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Feriados e Datas Sem Atendimento */}
            <div className="mt-5 rounded-2xl border border-panel-line bg-panel-bg/20 p-4">
              <h4 className="text-xs font-bold text-panel-ink">
                Feriados e datas específicas sem atendimento (opcional)
              </h4>
              <p className="mt-0.5 text-[11px] text-panel-sub">
                Nessas datas, o Nex informa que a empresa está fechada e não agenda horários.
              </p>

              {d.informacoes.diasFechados.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {d.informacoes.diasFechados.map((dia) => (
                    <span
                      key={dia}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-panel-card px-2.5 py-1 text-xs border border-panel-line text-panel-ink"
                    >
                      {dia.split("-").reverse().join("/")}
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800 text-[10px]"
                        onClick={() =>
                          editar("informacoes", {
                            diasFechados: d.informacoes.diasFechados.filter(
                              (item) => item !== dia
                            ),
                          })
                        }
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="date"
                  className="rounded-xl border border-panel-line bg-panel-card px-3 py-1.5 text-xs text-panel-ink"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                />
                <button
                  type="button"
                  className={BOTAO}
                  disabled={!novaData}
                  onClick={() => {
                    if (
                      novaData &&
                      !d.informacoes.diasFechados.includes(novaData)
                    ) {
                      editar("informacoes", {
                        diasFechados: [
                          ...d.informacoes.diasFechados,
                          novaData,
                        ].sort(),
                      });
                      setNovaData("");
                    }
                  }}
                >
                  Adicionar Data Fechada
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ==================== PASSO 4: JEITO DE ATENDER & REGRAS ==================== */}
        {(passoAtivo === 4 || visaoCompleta) && (
          <section
            aria-labelledby="titulo-passo-4"
            className="rounded-3xl border border-panel-line bg-panel-card p-5 shadow-xs sm:p-6"
          >
            <div className="mb-4 border-b border-panel-line pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                Passo 4
              </span>
              <h3
                id="titulo-passo-4"
                className="text-lg font-bold text-panel-ink"
              >
                💬 Jeito de Atender e Regras do Negócio
              </h3>
              <p className="text-xs text-panel-sub">
                Escolha o tom de voz do Nex e defina como ele lida com pagamentos e agendamentos.
              </p>
            </div>

            <div className="space-y-6">
              {/* Estilo / Tom de Voz */}
              <div>
                <label className="block text-xs font-bold text-panel-ink mb-2">
                  Personalidade e Estilo de Conversa do Nex
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      id: "ACOLHEDOR",
                      titulo: "🌟 Acolhedor",
                      descricao: "Atencioso, caloroso e próximo, sem perder a agilidade.",
                    },
                    {
                      id: "DIRETO",
                      titulo: "🎯 Direto",
                      descricao: "Claro, objetivo e rápido, sempre cordial e educado.",
                    },
                    {
                      id: "DESCONTRAIDO",
                      titulo: "😄 Descontraído",
                      descricao: "Leve, moderno e informal, mantendo o profissionalismo.",
                    },
                  ].map((estilo) => (
                    <button
                      key={estilo.id}
                      type="button"
                      onClick={() =>
                        editar("atendimento", {
                          jeito: estilo.id as typeof d.atendimento.jeito,
                        })
                      }
                      className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                        d.atendimento.jeito === estilo.id
                          ? "border-amber bg-amber/15 shadow-xs ring-1 ring-amber/50"
                          : "border-panel-line bg-panel-bg/30 hover:bg-panel-bg"
                      }`}
                    >
                      <span className="text-sm font-bold text-panel-ink">
                        {estilo.titulo}
                      </span>
                      <span className="mt-1 text-xs text-panel-sub">
                        {estilo.descricao}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quando o Nex Responde */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-panel-ink mb-1">
                    Quando o Nex deve responder?
                  </label>
                  <select
                    className={CAMPO}
                    value={d.atendimento.quando}
                    onChange={(e) =>
                      editar("atendimento", {
                        quando: e.target
                          .value as typeof d.atendimento.quando,
                      })
                    }
                  >
                    <option value="APOIO_EXPEDIENTE">
                      Sempre ativo (fora do horário e apoiando a equipe)
                    </option>
                    <option value="FORA_EXPEDIENTE">
                      Apenas quando a empresa estiver fechada
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-panel-ink mb-1">
                    Como lidar com agendamentos?
                  </label>
                  <select
                    className={CAMPO}
                    value={d.atendimento.agendamento}
                    onChange={(e) => {
                      const modo = e.target
                        .value as typeof d.atendimento.agendamento;
                      editar("atendimento", { agendamento: modo });
                      if (
                        modo !== "DESLIGADO" &&
                        d.negocio.objetivo !== "AGENDAMENTOS"
                      ) {
                        editar("negocio", { objetivo: "AGENDAMENTOS" });
                      }
                    }}
                  >
                    <option value="DIRETO">
                      Agendar diretamente pela conversa no WhatsApp
                    </option>
                    <option value="LINK">
                      Enviar o link da agenda online
                    </option>
                    <option value="DESLIGADO">
                      Encaminhar o pedido para a equipe humana
                    </option>
                  </select>
                </div>
              </div>

              {/* Formas de Pagamento */}
              <div>
                <label className="block text-xs font-bold text-panel-ink mb-1">
                  Formas de pagamento aceitas
                </label>
                <input
                  type="text"
                  className={CAMPO}
                  placeholder="Ex: Pix, Cartão de Crédito e Débito, Dinheiro"
                  maxLength={300}
                  value={d.informacoes.pagamento.valor}
                  onChange={(e) =>
                    editar("informacoes", {
                      pagamento: {
                        ...d.informacoes.pagamento,
                        valor: e.target.value,
                        situacao: e.target.value.trim()
                          ? "CONFIRMADO"
                          : "NAO_INFORMADO",
                      },
                    })
                  }
                />
              </div>

              {/* Dúvidas Frequentes e Regras */}
              <div className="border-t border-panel-line pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-panel-ink">
                      Perguntas Frequentes & Regras Específicas (opcional)
                    </h4>
                    <p className="text-[11px] text-panel-sub">
                      Ensine regras específicas como atrasos, estacionamento ou cancelamentos.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold text-amber-deep hover:underline"
                    onClick={adicionarPergunta}
                  >
                    + Adicionar Pergunta
                  </button>
                </div>

                {d.conhecimento.itens.length === 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      "Vocês têm estacionamento próprio?",
                      "Qual a tolerância de atraso?",
                      "Precisa pagar algum sinal?",
                    ].map((sugestao) => (
                      <button
                        key={sugestao}
                        type="button"
                        className="rounded-full border border-panel-line bg-panel-bg px-3 py-1.5 text-xs text-panel-ink hover:border-amber"
                        onClick={() =>
                          editar("conhecimento", {
                            itens: [
                              ...d.conhecimento.itens,
                              {
                                id: `novo:${crypto.randomUUID()}`,
                                pergunta: sugestao,
                                resposta: "",
                                situacao: "CONFIRMADO",
                                origem: "MANUAL",
                              },
                            ],
                          })
                        }
                      >
                        + {sugestao}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {d.conhecimento.itens.map((item, i) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-panel-line bg-panel-bg/30 p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-panel-ink">
                            Pergunta {i + 1}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 hover:text-red-800"
                            onClick={() => removerPergunta(item.id)}
                          >
                            Excluir
                          </button>
                        </div>
                        <input
                          type="text"
                          className={CAMPO}
                          placeholder="O que o cliente pergunta?"
                          value={item.pergunta}
                          onChange={(e) =>
                            atualizarPergunta(item.id, {
                              pergunta: e.target.value,
                            })
                          }
                        />
                        <textarea
                          rows={2}
                          className={CAMPO}
                          placeholder="Qual a resposta oficial que o Nex deve dar?"
                          value={item.resposta}
                          onChange={(e) =>
                            atualizarPergunta(item.id, {
                              resposta: e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ==================== PASSO 5: TESTE AO VIVO & WHATSAPP ==================== */}
        {(passoAtivo === 5 || visaoCompleta) && (
          <section
            aria-labelledby="titulo-passo-5"
            className="rounded-3xl border border-panel-line bg-panel-card p-5 shadow-xs sm:p-6"
          >
            <div className="mb-4 border-b border-panel-line pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-deep">
                Passo 5
              </span>
              <h3
                id="titulo-passo-5"
                className="text-lg font-bold text-panel-ink"
              >
                🚀 Teste ao Vivo e Ativação no WhatsApp
              </h3>
              <p className="text-xs text-panel-sub">
                Tudo configurado! Teste como o Nex responde aos seus clientes e conecte o WhatsApp.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-12 items-start">
              {/* Card 1: Simulador do WhatsApp em Smartphone Realista */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full mb-3 text-center sm:text-left">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-900">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Simulador do WhatsApp em Tempo Real
                  </span>
                  <p className="mt-1 text-xs text-panel-sub">
                    Experimente uma conversa real no WhatsApp para ver o Nex atendendo seus clientes com base no que você acabou de configurar.
                  </p>
                </div>

                <SimuladorWhatsAppCelular
                  nomeEmpresa={d.negocio.nome || "Minha Empresa"}
                  nomeAtendente={d.atendimento.nome || "Nex"}
                  tela={tela}
                  ocupado={ocupado}
                  sujo={pendente}
                  erro={erro}
                  mostrarControlesExternos={true}
                />
              </div>

              {/* Card 2: Conexão do WhatsApp & Ativação */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-panel-ink">
                      <span>🟢</span>
                      <span>WhatsApp da Empresa</span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        canal.conectado
                          ? "bg-emerald-600 text-white"
                          : "bg-amber/20 text-amber-900"
                      }`}
                    >
                      {canal.conectado ? "Conectado" : "Aguardando Conexão"}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-panel-sub">
                    {canal.conectado
                      ? `Conectado ao número ${canal.telefone || "da empresa"}. O Nex está pronto para atender seus clientes com segurança.`
                      : "Conecte o WhatsApp escaneando o QR Code pelo seu celular. Leva menos de 1 minuto."}
                  </p>

                  <div className="mt-4 rounded-xl bg-white/80 p-3 text-xs border border-panel-line text-panel-ink">
                    <span className="font-bold">Status do Atendente: </span>
                    <span>
                      {canal.ligado
                        ? "Atendente ativado no WhatsApp"
                        : "Pausado (aguardando você ativar)"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2">
                    <button
                      type="button"
                      className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                      onClick={abrirConexao}
                    >
                      💬 {canal.conectado ? "Conferir Conexão WhatsApp" : "Conectar WhatsApp via QR Code"}
                    </button>

                    {canal.conectado && (
                      <button
                        type="button"
                        className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-panel-line bg-panel-card px-4 py-2 text-xs font-bold text-panel-ink hover:bg-panel-bg transition"
                        onClick={() => (canal.ligado ? pausar() : ativar())}
                        disabled={ocupado}
                      >
                        {canal.ligado ? "Pausar Atendente" : "Ativar Atendente no WhatsApp"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-panel-line bg-panel-card p-4 text-xs text-panel-sub space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-panel-ink">
                    <span>💡</span>
                    <span>Como funciona a simulação:</span>
                  </div>
                  <p className="leading-relaxed">
                    O simulador ao lado é 100% seguro: nenhuma mensagem é enviada para clientes reais. Ele utiliza em tempo real seus serviços, horários e jeito de atender cadastrados.
                  </p>
                </div>

                <button
                  type="button"
                  className={`${BOTAO} w-full text-center`}
                  onClick={() => abrirTeste()}
                >
                  🔍 Abrir Teste em Janela Cheia
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* RODAPÉ DE NAVEGAÇÃO DOS PASSOS */}
      {!visaoCompleta && (
        <footer className="flex items-center justify-between border-t border-panel-line pt-4">
          <button
            type="button"
            disabled={passoAtivo === 1}
            onClick={() => setPassoAtivo(Math.max(1, passoAtivo - 1))}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-panel-line bg-panel-card px-5 py-2.5 text-xs font-bold text-panel-ink hover:bg-panel-bg disabled:opacity-40"
          >
            ← Voltar
          </button>

          <div className="flex items-center gap-2">
            {passoAtivo < 5 ? (
              <button
                type="button"
                onClick={() => setPassoAtivo(Math.min(5, passoAtivo + 1))}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber px-6 py-2.5 text-xs font-bold text-night hover:bg-amber/90 shadow-sm"
              >
                <span>Avançar para {PASSOS[passoAtivo]?.nome}</span>
                <span>→</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={abrirConexao}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                <span>Conectar WhatsApp da Empresa</span>
                <span>💬</span>
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
