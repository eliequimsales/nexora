import type { BusinessHour } from "@/lib/validation";

/**
 * O HORÁRIO DA EMPRESA MORA NUM LUGAR SÓ.
 *
 * A página pública de agendar e o atendimento liam o mesmo campo
 * (`CompanyProfile.businessHours`), mas cada um inventava o próprio padrão para
 * quando ele estava vazio: a agenda assumia 8h às 20h, e o atendimento assumia
 * "sempre aberto". Com o Plantão — que só responde com a loja fechada —, esse
 * "sempre aberto" viraria "nunca atende", sem aviso nenhum.
 *
 * O padrão é o que a página pública já mostrava aos clientes, com os sete dias
 * explícitos para a tela de configurações exibir a semana como ela vale.
 *
 * Sem zod de propósito: a tela de configurações roda no navegador, e o schema
 * levaria a biblioteca inteira para o celular do dono.
 */
export const HORARIO_PADRAO: readonly Readonly<BusinessHour>[] = [
  { day: 0, open: "08:00", close: "20:00", closed: true },
  { day: 1, open: "08:00", close: "20:00", closed: false },
  { day: 2, open: "08:00", close: "20:00", closed: false },
  { day: 3, open: "08:00", close: "20:00", closed: false },
  { day: 4, open: "08:00", close: "20:00", closed: false },
  { day: 5, open: "08:00", close: "20:00", closed: false },
  { day: 6, open: "08:00", close: "19:00", closed: false },
];

/** A mesma regra de `businessHourSchema`: HH:MM de 00:00 a 23:59. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function lerDia(item: unknown): BusinessHour | null {
  if (typeof item !== "object" || item === null) return null;
  const { day, open, close, closed } = item as Record<string, unknown>;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6) return null;
  if (typeof open !== "string" || !HORA.test(open)) return null;
  if (typeof close !== "string" || !HORA.test(close)) return null;
  // `closed` ausente é dia aberto: é como a agenda e o isOpenNow sempre leram.
  return { day, open, close, closed: closed === true };
}

/**
 * O horário que vale para a empresa: o cadastrado, se tiver ao menos um dia
 * válido; senão, o padrão. Entrada inválida (o campo é Json) é descartada, e dia
 * que não aparece é dia fechado. Sempre devolve cópia: quem mexer no resultado
 * não mexe no padrão.
 */
export function horarioDaEmpresa(valor: unknown): BusinessHour[] {
  if (Array.isArray(valor)) {
    const validos = valor.map(lerDia).filter((d): d is BusinessHour => d !== null);
    if (validos.length > 0) return validos;
  }
  return HORARIO_PADRAO.map((h) => ({ ...h }));
}

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Os dias fechados pelo botão "Fechar hoje" (feriado, imprevisto). O campo é
 * Json: só entra o que for data "AAAA-MM-DD". A página pública não oferece
 * horário nesses dias, e o Atendente trata o dia inteiro como loja fechada.
 */
export function lerDiasFechados(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter((d): d is string => typeof d === "string" && DATA.test(d));
}

/**
 * A semana inteira, dia por dia, para a tela de configurações: o dia que não
 * aparece no horário da empresa entra como fechado, em vez de sumir da tela.
 */
export function semanaCompleta(horario: readonly BusinessHour[]): BusinessHour[] {
  return Array.from({ length: 7 }, (_, day) => {
    const achado = horario.find((h) => h.day === day);
    return achado ? { ...achado } : { day, open: "08:00", close: "18:00", closed: true };
  });
}
