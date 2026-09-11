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
export const VERSAO_DOCUMENTOS = "2026-09-10";

/**
 * Preencher antes da primeira cobrança. O titular legal é o irmão adulto do
 * fundador — o fundador é menor de idade e não pode figurar como parte.
 *
 * ONDE FICAM OS DADOS: nas variáveis do serviço no Railway, nunca aqui. O
 * repositório no GitHub é público; CPF e endereço escritos neste arquivo ficariam
 * visíveis para qualquer um e para sempre no histórico. tests/identidade.test.ts
 * reprova o build se um CPF válido aparecer em app/, components/ ou lib/.
 */
type Fornecedor = {
  /** Nome civil completo de quem presta o serviço. */
  nome: string;
  /** CPF do prestador (ou CNPJ, se um dia houver empresa), já formatado. */
  documento: string;
  /** Endereço completo, com bairro, cidade/UF e CEP — Decreto 7.962/2013. */
  endereco: string;
  /** Canal de atendimento e de pedidos de LGPD. Tem que ser lido de verdade. */
  email: string;
  /** Encarregado de dados (LGPD art. 41). Pessoa natural, não um cargo vago. */
  encarregado: string;
};

/** O nome de cada variável no Railway. docs/runbooks/colocar-no-ar.md manda criar estas. */
export const VARIAVEIS_DO_FORNECEDOR = {
  nome: "FORNECEDOR_NOME",
  documento: "FORNECEDOR_DOCUMENTO",
  endereco: "FORNECEDOR_ENDERECO",
  email: "FORNECEDOR_EMAIL",
  encarregado: "FORNECEDOR_ENCARREGADO",
} as const;

const PENDENTE = "[DEFINIR]";

/** CPF com 11 dígitos vira 000.000.000-00; CNPJ com 14, 00.000.000/0000-00. */
export function formatarDocumento(bruto: string): string {
  const d = bruto.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return bruto.trim();
}

export function lerFornecedor(env: Record<string, string | undefined>): Fornecedor {
  const valor = (chave: string) => (env[chave] ?? "").trim() || PENDENTE;
  const nome = valor(VARIAVEIS_DO_FORNECEDOR.nome);
  const documento = valor(VARIAVEIS_DO_FORNECEDOR.documento);
  return {
    nome,
    documento: documento === PENDENTE ? PENDENTE : formatarDocumento(documento),
    endereco: valor(VARIAVEIS_DO_FORNECEDOR.endereco),
    email: valor(VARIAVEIS_DO_FORNECEDOR.email),
    // Decisão do dono (11/09/2026): o encarregado é o próprio fornecedor, a não
    // ser que a variável traga outro nome.
    encarregado: (env[VARIAVEIS_DO_FORNECEDOR.encarregado] ?? "").trim() || nome,
  };
}

/**
 * Lido quando o servidor carrega o módulo. As páginas que mostram estes dados são
 * geradas a cada acesso (force-dynamic): geradas no build, sairiam com "[DEFINIR]",
 * porque o build do Docker não enxerga as variáveis do serviço.
 */
export const FORNECEDOR: Fornecedor = lerFornecedor(process.env);

/** Nenhum campo pode ficar como marcador quando o produto começar a cobrar. */
export function identificacaoCompleta(f: Fornecedor = FORNECEDOR): boolean {
  return Object.values(f).every((v) => v !== PENDENTE && v.trim().length > 0);
}

/** Campos que ainda faltam — para a tela poder dizer exatamente o quê. */
export function camposPendentes(f: Fornecedor = FORNECEDOR): string[] {
  return Object.entries(f)
    .filter(([, v]) => v === PENDENTE || !v.trim())
    .map(([k]) => k);
}

/**
 * A DECLARAÇÃO QUE O DONO ASSINA AO SUBIR A BASE.
 *
 * Texto único, gravado por extenso em RegistroImportacao junto da versão. Não
 * é um booleano: se a frase mudar daqui a um ano, ninguém consegue dizer o que
 * a pessoa aceitou naquele dia — e é exatamente isso que a ANPD pergunta
 * quando um titular reclama de ter sido contatado.
 *
 * A tela mostra ESTA constante. tests/declaracao.test.ts quebra o build se
 * alguma tela voltar a digitar a frase à mão.
 */
export const DECLARACAO_BASE =
  "Confirmo que estes clientes são meus, que eu já tinha contato com eles antes " +
  "de usar a Nexora e que posso falar com eles. Eu sou o responsável por esta " +
  "base: a Nexora trata esses dados seguindo a minha instrução, e eu posso " +
  "exportar ou apagar tudo quando quiser.";
