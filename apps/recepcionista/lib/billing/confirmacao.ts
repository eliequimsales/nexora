import type { Mensagem } from "@/lib/reengajamento/email";
import { FORNECEDOR, VERSAO_DOCUMENTOS } from "@/lib/legal/identidade";
import { PRECO_MENSAL_CENTS, emReais } from "@/lib/billing/preco";

/**
 * CONFIRMAÇÃO DA CONTRATAÇÃO — Decreto 7.962/2013, art. 4º, V.
 *
 * "O fornecedor deve confirmar imediatamente o recebimento da aceitação da
 * oferta." Não é cortesia de onboarding: é obrigação legal, e é a única prova
 * que o consumidor tem do que contratou, por quanto e de quem.
 *
 * O art. 2º manda junto a identificação do fornecedor — nome, CPF ou CNPJ,
 * endereço físico e eletrônico. Por isso os dados vêm de FORNECEDOR e não são
 * digitados aqui: enquanto estiverem em [DEFINIR], a rota de checkout recusa
 * abrir cobrança, e o e-mail nunca chega a existir com lacuna.
 *
 * TRANSACIONAL. Não passa pelo motor de reengajamento, não respeita intervalo
 * mínimo entre envios e não leva link de descadastro: ninguém pode optar por
 * não receber a confirmação daquilo que contratou — e `semEmail`, que é
 * recusa de marketing, também não a bloqueia.
 */

export type DadosConfirmacao = {
  nome: string;
  /** true enquanto a assinatura esta em periodo gratuito: nada foi cobrado. */
  emTeste: boolean;
  proximaCobranca: Date | null;
};

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function montarConfirmacao(d: DadosConfirmacao): Mensagem {
  const nome = (d.nome ?? "").trim();
  // Sem nome, a saudação some inteira. "Olá, ," é o tipo de detalhe que faz o
  // dono desconfiar de tudo o que vem depois — inclusive da cobrança.
  const saudacao = nome ? `${nome}, sua assinatura da Nexora está ativa.` : "Sua assinatura da Nexora está ativa.";

  const quando = d.proximaCobranca ? dataBR.format(d.proximaCobranca) : null;

  const cobranca = d.emTeste
    ? `Você está no período gratuito: nada foi cobrado até agora.` +
      (quando
        ? ` A primeira cobrança de ${emReais(PRECO_MENSAL_CENTS)} acontece em ${quando}, e se repete todo mês.`
        : ` Quando o período gratuito terminar, a cobrança passa a ser de ${emReais(PRECO_MENSAL_CENTS)}, todo mês.`)
    : `O valor é ${emReais(PRECO_MENSAL_CENTS)}, cobrado todo mês no cartão cadastrado.` +
      (quando ? ` A próxima cobrança está marcada para ${quando}.` : "");

  const corpo = [
    saudacao,
    `O que você contratou: a Nexora completa — Diagnóstico, importação da sua base, Onda de Segunda e Livro-Caixa da Recuperação. Preço único, sem taxa de adesão e sem cobrança por cliente cadastrado.`,
    cobranca,
    `Você pode cancelar quando quiser, sozinho, pelo painel — não precisa ligar nem pedir. Cancelando, você continua com acesso até o fim do período que já pagou.`,
    // Art. 49 do CDC. Contratação fora do estabelecimento tem arrependimento
    // de 7 dias com devolução integral, e o consumidor precisa SABER disso
    // pelo fornecedor — não descobrir depois.
    `Direito de arrependimento (CDC, art. 49): dentro de 7 dias contados de hoje, você pode desistir da contratação e receber de volta tudo o que pagou, sem precisar justificar. Basta cancelar pelo painel ou responder este e-mail.`,
    `Quem está prestando o serviço:\n${FORNECEDOR.nome}\n${FORNECEDOR.documento}\n${FORNECEDOR.endereco}\n${FORNECEDOR.email}`,
    `Esta contratação seguiu os Termos de Uso, a Política de Privacidade e o Contrato de Operador na versão ${VERSAO_DOCUMENTOS}. Guarde este e-mail: ele é o seu comprovante do que foi contratado.`,
  ].join("\n\n");

  return {
    assunto: "Sua assinatura da Nexora está confirmada",
    corpo,
    acao: { texto: "Ver minha assinatura", href: "/painel/assinatura" },
  };
}

/**
 * Quando mandar — e por que só uma vez.
 *
 * `aplicarAssinatura` roda a cada evento da Stripe, e reentrega de evento é
 * rotina, não exceção. Sem a marca de já-enviada, o dono receberia a mesma
 * confirmação a cada webhook, e o e-mail que existe para dar segurança viraria
 * o motivo de ele marcar a Nexora como spam — e perder, junto, o aviso de que
 * a cobrança falhou.
 *
 * `trialing` conta: o art. 4º manda confirmar a ACEITAÇÃO da oferta, não o
 * pagamento. Quem entrou no teste já contratou, inclusive a cobrança futura —
 * e é justamente quem mais precisa ver por escrito quando ela chega.
 *
 * `incomplete` não conta: o pagamento nunca passou, não há contrato a
 * confirmar. `past_due` e `unpaid` também não, porque quem chega neles já foi
 * `active` antes e já recebeu a confirmação naquele momento.
 */
const CONTRATADO = ["active", "trialing"];

export function deveConfirmar(
  status: string | null | undefined,
  confirmacaoEnviadaEm: Date | null,
): boolean {
  if (confirmacaoEnviadaEm) return false;
  return CONTRATADO.includes(status ?? "");
}
