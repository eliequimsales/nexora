/**
 * DISPONIBILIDADE DA AGENDA PÚBLICA (a Base Viva)
 *
 * O cliente final abre o link, escolhe um horário e digita o próprio nome. O
 * dono nunca digita cliente nenhum — e é assim que a base de clientes, que é o
 * ativo da Nexora, se forma sozinha e para sempre.
 *
 * Todo cálculo aqui é feito em hora local do negócio, informada como offset
 * explícito em minutos (Brasília = -180). Agenda que trata fuso por acidente é
 * agenda que marca cliente no horário errado, e isso queima o produto na
 * primeira semana.
 */

export type Horario = {
  /** 0 = domingo ... 6 = sábado */
  day: number;
  /** "09:00" */
  open: string;
  /** "18:00" */
  close: string;
  closed?: boolean;
};

export type Ocupado = { startsAt: Date; endsAt: Date };

const MIN_MS = 60 * 1000;

/** Offset padrão: horário de Brasília. */
export const OFFSET_BRASILIA = -180;

function minutosDoTexto(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function textoDosMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * O instante UTC correspondente a uma hora local do dia informado.
 * `dia` é lido pelos componentes UTC, então o chamador deve passar a data do
 * dia-alvo à meia-noite UTC.
 */
function instanteLocal(dia: Date, minutosNoDia: number, offsetMinutos: number): Date {
  const base = Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate());
  return new Date(base + (minutosNoDia - offsetMinutos) * MIN_MS);
}

/** Dia da semana local (0-6) do dia informado. */
function diaDaSemanaLocal(dia: Date): number {
  return dia.getUTCDay();
}

export type EntradaSlots = {
  dia: Date;
  horarios: Horario[];
  duracaoMin: number;
  ocupados: Ocupado[];
  agora: Date;
  offsetMinutos?: number;
  /** De quanto em quanto tempo os horários são oferecidos. */
  passoMin?: number;
  /** Antecedência mínima para marcar — ninguém marca para daqui a 5 minutos. */
  antecedenciaMinutos?: number;
};

export function calcularSlots(entrada: EntradaSlots): string[] {
  const {
    dia,
    horarios,
    duracaoMin,
    ocupados,
    agora,
    offsetMinutos = OFFSET_BRASILIA,
    passoMin = 30,
    antecedenciaMinutos = 0,
  } = entrada;

  const diaSemana = diaDaSemanaLocal(dia);
  const config = horarios.find((h) => h.day === diaSemana);

  // Sem configuração para o dia, ou dia fechado: não existe horário.
  if (!config || config.closed) return [];

  const abre = minutosDoTexto(config.open);
  const fecha = minutosDoTexto(config.close);
  const limiteAgora = agora.getTime() + antecedenciaMinutos * MIN_MS;

  const slots: string[] = [];

  for (let m = abre; m + duracaoMin <= fecha; m += passoMin) {
    const inicio = instanteLocal(dia, m, offsetMinutos);
    const fim = new Date(inicio.getTime() + duracaoMin * MIN_MS);

    // Passado ou dentro da antecedência mínima.
    if (inicio.getTime() < limiteAgora) continue;

    // Sobreposição, inclusive parcial. Dupla marcação é o pior bug de uma
    // agenda: o cliente aparece e não tem cadeira.
    const colide = ocupados.some(
      (o) => inicio.getTime() < o.endsAt.getTime() && fim.getTime() > o.startsAt.getTime(),
    );
    if (colide) continue;

    slots.push(textoDosMinutos(m));
  }

  return slots;
}

/**
 * A data provável do próximo retorno. Alimenta a mensagem de fim de
 * atendimento — "seu próximo costuma cair por volta de [data], já quer deixar
 * marcado?" — que é a intervenção de maior retorno do produto inteiro, porque
 * agenda o retorno enquanto o cliente ainda está satisfeito e impede o estoque
 * de inativos de se formar de novo.
 */
export function proximoRetornoProvavel(ultimaVisita: Date, cicloDias: number): Date {
  return new Date(ultimaVisita.getTime() + cicloDias * 24 * 60 * MIN_MS);
}
