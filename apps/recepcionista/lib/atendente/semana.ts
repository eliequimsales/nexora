import type { BusinessHour } from "@/lib/validation";
import { horaFalada, minutosDe } from "./datas";

/**
 * A SEMANA DESENHADA: QUEM ATENDE EM CADA FAIXA.
 *
 * É o avesso do horário da agenda — o dono não configura nada. A tela desenha
 * as sete faixas ("aberto — você atende · fechado — o Atendente atende") e o
 * texto resume a mesma coisa em palavras.
 */

export type Faixa = { de: number; ate: number; quem: "VOCE" | "ATENDENTE" };
export type DiaDesenhado = { dia: number; nome: string; faixas: Faixa[] };

const ORDEM = [1, 2, 3, 4, 5, 6, 0];
const NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIA_MIN = 24 * 60;
const MENOR_FAIXA = 5;

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

function faixasDoDia(horarios: BusinessHour[], dia: number): Faixa[] {
  const faixas: Faixa[] = [];
  let cursor = 0;
  for (const [de, ate] of abertoNoDia(horarios, dia)) {
    if (de > cursor) faixas.push({ de: cursor, ate: de, quem: "ATENDENTE" });
    faixas.push({ de: Math.max(de, cursor), ate, quem: "VOCE" });
    cursor = Math.max(cursor, ate);
  }
  if (cursor < DIA_MIN) faixas.push({ de: cursor, ate: DIA_MIN, quem: "ATENDENTE" });

  // Faixa de poucos minutos ("23:59") não é desenho, é arredondamento.
  const limpas = faixas.filter((f) => f.ate - f.de >= MENOR_FAIXA);
  return limpas.reduce<Faixa[]>((acc, f) => {
    const ultima = acc.at(-1);
    if (ultima && ultima.quem === f.quem) ultima.ate = f.ate;
    else acc.push({ ...f });
    return acc;
  }, []);
}

export function semanaDoAtendente(horarios: BusinessHour[]): DiaDesenhado[] {
  return ORDEM.map((dia) => ({ dia, nome: NOMES[dia], faixas: faixasDoDia(horarios, dia) }));
}

function textoDoDia(horarios: BusinessHour[], dia: number): string {
  const h = horarios.find((x) => x.day === dia);
  if (!h || h.closed || h.open === h.close) return "o dia todo";
  const [abre, fecha] = [minutosDe(h.open), minutosDe(h.close)];
  if (fecha < abre) return `das ${horaFalada(fecha)} às ${horaFalada(abre)}`;
  if (abre === 0 && fecha >= DIA_MIN - 1) return "só quando ninguém responde";
  if (abre === 0) return `depois das ${horaFalada(fecha)}`;
  if (fecha >= DIA_MIN - 1) return `antes das ${horaFalada(abre)}`;
  return `antes das ${horaFalada(abre)} e depois das ${horaFalada(fecha)}`;
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
