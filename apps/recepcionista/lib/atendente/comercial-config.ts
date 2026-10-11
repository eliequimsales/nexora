export const ID_CONTA_MESTRE_PADRAO = "cmr6swe6z001ym7xu4lcxpxs7";

export function ehContaComercialNexora(companyId: string): boolean {
  const oficial = process.env.NEXORA_COMMERCIAL_COMPANY_ID?.trim() || ID_CONTA_MESTRE_PADRAO;
  return companyId === oficial;
}

export const URL_ATIVACAO = "meunexora.com.br/ativar";
