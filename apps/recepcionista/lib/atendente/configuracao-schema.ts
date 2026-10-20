/** Contrato compartilhado da configuração guiada. Não importa banco ou código do servidor. */
export const ETAPAS_NEXA = [
  { titulo: "Seu negócio", descricao: "O contexto de quem você atende" },
  { titulo: "Informações", descricao: "Serviços, horários e pagamentos" },
  { titulo: "Como atender", descricao: "Linguagem, horários e autonomia" },
  { titulo: "Perguntas e regras", descricao: "O que só o seu negócio sabe" },
  { titulo: "Teste e revisão", descricao: "Confira as respostas antes de usar" },
  { titulo: "Conexão e ativação", descricao: "Revise e coloque para atender" },
] as const;

export type SituacaoInformacao = "CONFIRMADO" | "REVISAR" | "NAO_INFORMADO" | "NAO_APLICA";
export type OrigemInformacao = "CADASTRO" | "MANUAL" | "ASSISTENTE";
export type InformacaoNexa = { valor: string; situacao: SituacaoInformacao; origem: OrigemInformacao };
export type HorarioNexa = { day: number; open: string; close: string; closed: boolean };
export type ServicoNexa = {
  id: string;
  nome: string;
  descricao: string;
  precoModo: "FIXO" | "SOB_CONSULTA";
  precoCents: number | null;
  duracaoMin: number | null;
  situacao: SituacaoInformacao;
  origem: OrigemInformacao;
};
export type PerguntaNexa = {
  id: string; pergunta: string; resposta: string;
  situacao: SituacaoInformacao; origem: OrigemInformacao;
};
export type ConfiguracaoNexa = {
  negocio: {
    nome: string;
    segmento: string;
    modalidade: "PRESENCIAL" | "ONLINE" | "DOMICILIO" | "HIBRIDO";
    objetivo: "DUVIDAS" | "SOLICITACOES" | "AGENDAMENTOS";
    regiao: InformacaoNexa;
    descricao: InformacaoNexa;
  };
  informacoes: {
    endereco: InformacaoNexa;
    pagamento: InformacaoNexa;
    horarios: HorarioNexa[];
    horariosSituacao: SituacaoInformacao;
    diasFechados: string[];
    servicos: ServicoNexa[];
  };
  atendimento: {
    nome: string;
    jeito: "ACOLHEDOR" | "DIRETO" | "DESCONTRAIDO";
    quando: "FORA_EXPEDIENTE" | "APOIO_EXPEDIENTE";
    agendamento: "DESLIGADO" | "LINK" | "DIRETO";
    handoffKeywords: string[];
  };
  conhecimento: { itens: PerguntaNexa[] };
};

export type CenarioNexa = "INFORMACOES" | "HORARIO" | "HUMANO" | "DESCONHECIDA" | "MULTIPLA" | "CANCELAMENTO" | "MIDIA";
export type TesteNexa = {
  id: string; cenario: CenarioNexa; revisao: number; em: string;
  pergunta: string; respostas: string[]; correto: boolean | null;
};
export type PendenciaNexa = { campo: string; mensagem: string; etapa: number; bloqueia: boolean };
export type TelaConfiguracaoNexa = {
  rascunho: ConfiguracaoNexa;
  revisao: number;
  etapa: number;
  revisadas: number[];
  testes: TesteNexa[];
  pendencias: PendenciaNexa[];
  publicadoEm: string | null;
  haAlteracoes: boolean;
  conexao: { conectado: boolean; telefone: string; ligado: boolean };
};

export const CENARIOS_NEXA: { id: CenarioNexa; titulo: string; pergunta: string }[] = [
  { id: "INFORMACOES", titulo: "Informações do negócio", pergunta: "Como funciona o atendimento de vocês?" },
  { id: "HORARIO", titulo: "Consultar um horário", pergunta: "Gostaria de agendar um horário para amanhã." },
  { id: "HUMANO", titulo: "Pedir uma pessoa", pergunta: "Quero falar com uma pessoa da equipe, por favor." },
  { id: "DESCONHECIDA", titulo: "Informação não cadastrada", pergunta: "Vocês oferecem serviço de manobrista?" },
  { id: "MULTIPLA", titulo: "Duas perguntas juntas", pergunta: "Qual é o endereço e quais formas de pagamento vocês aceitam?" },
  { id: "CANCELAMENTO", titulo: "Solicitar cancelamento", pergunta: "Preciso cancelar meu agendamento." },
  { id: "MIDIA", titulo: "Mídia não interpretada", pergunta: "" },
];
