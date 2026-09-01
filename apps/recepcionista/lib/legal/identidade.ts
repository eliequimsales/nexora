/**
 * QUEM PRESTA O SERVIÇO, E EM QUE VERSÃO.
 *
 * Fonte única da identificação do fornecedor e da versão dos documentos. Existe
 * por dois motivos, os dois aprendidos errando:
 *
 * 1. A página /diagnostico afirmava que a Nexora era "operada por pessoa
 *    jurídica registrada" e que o CNPJ estava "visível no rodapé e no e-mail de
 *    confirmação". Não havia CNPJ, o rodapé não mostrava nada, e o e-mail de
 *    confirmação não existe. Três mentiras numa frase escrita para tranquilizar.
 *
 * 2. Consentimento sem VERSÃO é consentimento que não prova nada. Se o texto
 *    mudar depois, ninguém consegue dizer o que a pessoa aceitou. Por isso o
 *    aceite grava esta constante junto com a data.
 *
 * O Decreto 7.962/2013 art. 2º exige nome, CNPJ **ou CPF** e endereço eletrônico
 * em destaque — pessoa física pode prestar serviço, mas não pode se esconder.
 * Enquanto os campos abaixo estiverem como PENDENTE, o produto NÃO pode cobrar:
 * `identificacaoCompleta()` existe para essa checagem ser código, não memória.
 */

/** Muda sempre que o texto de Termos ou Privacidade mudar. Formato: AAAA-MM-DD. */
export const VERSAO_DOCUMENTOS = "2026-09-01";

/**
 * Preencher antes da primeira cobrança. O titular legal é o irmão adulto do
 * fundador — o fundador é menor de idade e não pode figurar como parte.
 */
type Fornecedor = {
  nome: string;
  documento: string;
  endereco: string;
  email: string;
  encarregado: string;
};

export const FORNECEDOR: Fornecedor = {
  /** Nome civil completo de quem presta o serviço. */
  nome: "[DEFINIR]",
  /** CPF do prestador (ou CNPJ, se um dia houver empresa). */
  documento: "[DEFINIR]",
  /** Endereço completo, exigido pelo Decreto 7.962/2013. */
  endereco: "[DEFINIR]",
  /** Canal de atendimento e de pedidos de LGPD. Tem que ser lido de verdade. */
  email: "[DEFINIR]",
  /** Encarregado de dados (LGPD art. 41). Pessoa natural, não um cargo vago. */
  encarregado: "[DEFINIR]",
};

const PENDENTE = "[DEFINIR]";

/** Nenhum campo pode ficar como marcador quando o produto começar a cobrar. */
export function identificacaoCompleta(): boolean {
  return Object.values(FORNECEDOR).every((v) => v !== PENDENTE && v.trim().length > 0);
}

/** Campos que ainda faltam — para a tela poder dizer exatamente o quê. */
export function camposPendentes(): string[] {
  return Object.entries(FORNECEDOR)
    .filter(([, v]) => v === PENDENTE || !v.trim())
    .map(([k]) => k);
}
