import type { BusinessHour } from "@/lib/validation";
import { horaFalada, minutosDe } from "./datas";

/**
 * QUANDO A LOJA ESTÁ FECHADA — QUE É QUANDO O ATENDENTE RESPONDE NA HORA.
 *
 * É o avesso do horário da agenda: o dono não configura nada. A tela diz numa
 * linha só, a partir dos intervalos reais de cada dia — inclusive o fim de um
 * expediente que vira a madrugada, que pertence ao dia seguinte.
 */

const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_MIN = 24 * 60;
/** Poucos minutos fechado (quem fecha às 23:59) não é horário, é arredondamento. */
const MENOR_INTERVALO = 5;

/** Os intervalos em que a loja está aberta num dia, incluindo o fim da madrugada do dia anterior. */
function abertoNoDia(horarios: BusinessHour[], dia: number): [number, number][] {
  const intervalos: [number, number][] = [];
  const hoje = horarios.find((h) => h.day === dia);
  const ontem = horarios.find((h) => h.day === (dia + 6) % 7);

  if (ontem && !ontem.closed) {
    const [abre, fecha] = [minutosDe(ontem.open), minutosDe(ontem.close)];
    if (fecha < abre) intervalos.push([0, fecha]);
  }
  if (hoje && !hoje.closed) {
    const [abre, fecha] = [minutosDe(hoje.open), minutosDe(hoje.close)];
    if (fecha > abre) intervalos.push([abre, fecha]);
    else if (fecha < abre) intervalos.push([abre, DIA_MIN]);
  }
  return intervalos.sort((a, b) => a[0] - b[0]);
}

/** O avesso: os intervalos do dia com a loja fechada. */
function fechadoNoDia(horarios: BusinessHour[], dia: number): [number, number][] {
  const fechados: [number, number][] = [];
  let cursor = 0;
  for (const [de, ate] of abertoNoDia(horarios, dia)) {
    if (de > cursor) fechados.push([cursor, de]);
    cursor = Math.max(cursor, ate);
  }
  if (cursor < DIA_MIN) fechados.push([cursor, DIA_MIN]);
  return fechados.filter(([de, ate]) => ate - de >= MENOR_INTERVALO);
}

function textoDoDia(horarios: BusinessHour[], dia: number): string {
  const fechados = fechadoNoDia(horarios, dia);
  if (fechados.length === 0) return "nunca fecha";
  return fechados
    .map(([de, ate]) => {
      if (de === 0 && ate === DIA_MIN) return "o dia todo";
      if (de === 0) return `antes das ${horaFalada(ate)}`;
      if (ate === DIA_MIN) return `depois das ${horaFalada(de)}`;
      return `das ${horaFalada(de)} às ${horaFalada(ate)}`;
    })
    .join(" e ");
}

/** "seg a sex: antes das 9h e depois das 19h", "dom: o dia todo". */
export function quandoAtendeTexto(horarios: BusinessHour[]): string[] {
  const grupos: { inicio: number; fim: number; texto: string }[] = [];
  for (const dia of ORDEM) {
    const texto = textoDoDia(horarios, dia);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.texto === texto) ultimo.fim = dia;
    else grupos.push({ inicio: dia, fim: dia, texto });
  }
  return grupos.map((g) => {
    const rotulo = g.inicio === g.fim ? CURTOS[g.inicio] : `${CURTOS[g.inicio]} a ${CURTOS[g.fim]}`;
    return `${rotulo}: ${g.texto}`;
  });
}
