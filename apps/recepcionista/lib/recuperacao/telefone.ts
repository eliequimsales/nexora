/**
 * RECONCILIAÇÃO DE TELEFONE BRASILEIRO.
 *
 * O mesmo cliente existe com três grafias diferentes dentro do sistema:
 *
 *   planilha do dono   11988881234    (lerTelefone: só dígitos, sem país)
 *   JID do WhatsApp    5511988881234  (com o 55 na frente)
 *   cadastro antigo    1188881234     (antes da regra do nono dígito)
 *
 * Buscar por igualdade exata acha zero e não reclama — é a pior forma de
 * falhar, porque parece que funcionou. Em vez de "normalizar" para uma forma
 * canônica (que exigiria migrar a base inteira), geramos as VARIANTES
 * plausíveis e deixamos o banco resolver com `phone: { in: [...] }`: continua
 * sendo busca exata por índice, e nenhum dado precisa ser reescrito.
 *
 * O nono dígito só é adicionado/removido quando o número tem cara de celular
 * (o dígito após o DDD é 9, ou o número tem 8 dígitos de assinante). Fixo de
 * São Paulo começando com 3 não vira celular por engano.
 */

const PAIS = "55";

/** Descarta o que nem telefone brasileiro é. */
function apenasDigitos(bruto: string): string {
  return (bruto ?? "").replace(/\D/g, "");
}

/** Sem país: 10 dígitos (DDD + 8) ou 11 (DDD + 9). */
function semPais(d: string): string | null {
  if (d.length === 12 || d.length === 13) {
    return d.startsWith(PAIS) ? d.slice(2) : null;
  }
  return d.length === 10 || d.length === 11 ? d : null;
}

export function variantesDeTelefone(bruto: string): string[] {
  if (typeof bruto !== "string") return [];

  const local = semPais(apenasDigitos(bruto));
  if (!local) return [];

  const ddd = local.slice(0, 2);
  const assinante = local.slice(2);

  const locais = new Set<string>([local]);

  if (assinante.length === 9 && assinante.startsWith("9")) {
    // Celular novo: a forma antiga é o mesmo número sem o 9 da frente.
    locais.add(ddd + assinante.slice(1));
  } else if (assinante.length === 8) {
    // Oito dígitos: pode ser celular antigo. Só vira celular novo se o
    // primeiro dígito for de celular (9, 8, 7 ou 6) — fixo não entra.
    if (/^[6-9]/.test(assinante)) locais.add(ddd + "9" + assinante);
  }

  const saida = new Set<string>();
  for (const l of locais) {
    saida.add(l);
    saida.add(PAIS + l);
  }
  return [...saida];
}
