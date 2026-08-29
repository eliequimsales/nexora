/**
 * MOTOR DE REENGAJAMENTO.
 *
 * Decide, para uma conta, qual é o ÚNICO e-mail que faz sentido mandar hoje —
 * ou nenhum. Puro, com `agora` injetado, porque a diferença entre "avisar" e
 * "perseguir" é uma regra de data, e regra de data que não dá para testar é
 * regra que vai errar com gente de verdade.
 *
 * A tese: o e-mail que funciona neste negócio não fala da Nexora, fala do
 * dinheiro DELE. "Volte para a Nexora" é igual a todo e-mail de SaaS que ele já
 * ignorou. "Você tem 118 clientes sumidos e cerca de R$ 4.200 parados" é sobre
 * ele — e é a mesma prova de primeira pessoa que o Diagnóstico usa para vender.
 *
 * Três regras protegem a caixa de entrada, e todas as três existem porque
 * e-mail demais não é insistência, é o que faz o dono marcar como spam e nunca
 * mais receber nada — inclusive o aviso de que a cobrança falhou:
 *
 *   1. Um momento é enviado UMA vez na vida da conta.
 *   2. Nunca dois e-mails em menos de INTERVALO_MINIMO_DIAS.
 *   3. Quem pediu para não receber não recebe nada, em nenhuma hipótese.
 */

export const MOMENTOS = [
  "PAGAMENTO_FALHOU",
  "COMPRA_NAO_FINALIZADA",
  "TRIAL_ACABANDO",
  "TRIAL_ACABOU",
  "TRIAL_ACABOU_3D",
  "TRIAL_ACABOU_10D",
  "CANCELOU",
  "CANCELOU_14D",
  "PEDIR_DEPOIMENTO",
  "SEM_BASE",
  "SEM_USO",
] as const;

export type Momento = (typeof MOMENTOS)[number];

export type Sinais = {
  nome: string;
  criadoEm: Date;
  /** Última vez que abriu o Checkout sem concluir. */
  checkoutAbertoEm: Date | null;
  canceladoEm: Date | null;
  clientesNaBase: number;
  /** Contatos de recuperação que ele registrou. Zero = nunca usou de verdade. */
  toquesRegistrados: number;
  sumidos: number;
  /** Faixa mínima estimada da base dele, em centavos. 0 = não sabemos. */
  recuperavelCents: number;
  /** Receita Recuperada comprovada. */
  recuperadoCents: number;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  dunningIniciadoEm: Date | null;
  semEmail: boolean;
  jaEnviados: Momento[];
  ultimoEnvioEm: Date | null;
};

export type Toque = {
  momento: Momento;
  assunto: string;
  corpo: string;
  acao: { texto: string; href: string };
};

export const INTERVALO_MINIMO_DIAS = 2;

/** Tempo até considerar que ele desistiu do pagamento, e não que está pagando. */
const ESPERA_CHECKOUT_HORAS = 6;

const DIA_MS = 86_400_000;
const HORA_MS = 3_600_000;

const dias = (de: Date, ate: Date) => (ate.getTime() - de.getTime()) / DIA_MS;

const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Status em que a assinatura já foi paga ou está viva e cobrando. */
const VIVA = ["active", "trialing", "past_due", "unpaid"];

/**
 * A frase do dinheiro dele. Volta vazia quando não há número confiável — a
 * Constituição proíbe número solto, e "R$ 0,00 parados" seria pior que silêncio.
 */
function frasedoNumero(s: Sinais): string {
  if (s.sumidos <= 0 || s.recuperavelCents <= 0) return "";
  return (
    `Na última vez que olhamos, ${s.sumidos} clientes seus estavam sumidos — ` +
    `algo entre ${reais(s.recuperavelCents)} e ${reais(Math.round(s.recuperavelCents * 1.67))} ` +
    `parados, pela sua própria frequência e ticket. Não é promessa: é a conta da sua base.`
  );
}

export function decidirToque(s: Sinais, agora: Date): Toque | null {
  if (s.semEmail) return null;

  if (s.ultimoEnvioEm && dias(s.ultimoEnvioEm, agora) < INTERVALO_MINIMO_DIAS) return null;

  const jaFoi = (m: Momento) => s.jaEnviados.includes(m);
  const numero = frasedoNumero(s);
  const comNumero = (base: string) => (numero ? `${base}\n\n${numero}` : base);

  // --- 1. Dinheiro na mesa agora: o pagamento falhou e ele vai perder acesso.
  if (
    !jaFoi("PAGAMENTO_FALHOU") &&
    s.dunningIniciadoEm &&
    (s.subscriptionStatus === "past_due" || s.subscriptionStatus === "unpaid")
  ) {
    return {
      momento: "PAGAMENTO_FALHOU",
      assunto: "Seu pagamento não passou (nada foi perdido)",
      corpo: comNumero(
        `${s.nome}, a cobrança deste mês não foi aprovada. Isso costuma ser limite ou ` +
          `cartão vencido, e resolve em um minuto.\n\n` +
          `Sua base e seu histórico estão intactos. Você continua com acesso normal por ` +
          `alguns dias enquanto isso se resolve.`,
      ),
      acao: { texto: "Atualizar forma de pagamento", href: "/painel/assinatura" },
    };
  }

  // --- 2. Chegou na tela de pagamento e desistiu. É a lista mais quente que existe.
  if (
    !jaFoi("COMPRA_NAO_FINALIZADA") &&
    s.checkoutAbertoEm &&
    !VIVA.includes(s.subscriptionStatus ?? "") &&
    (agora.getTime() - s.checkoutAbertoEm.getTime()) / HORA_MS >= ESPERA_CHECKOUT_HORAS
  ) {
    return {
      momento: "COMPRA_NAO_FINALIZADA",
      assunto: "Faltou pouco — quer que eu termine com você?",
      corpo: comNumero(
        `${s.nome}, vi que você chegou até a tela de pagamento e não terminou. ` +
          `Sem problema — não cobrei nada e sua conta está do jeito que estava.\n\n` +
          `Se travou em alguma coisa (cartão, boleto, uma dúvida sobre a garantia), ` +
          `me responde este e-mail que eu resolvo com você. Se foi só a vida acontecendo, ` +
          `o link abaixo continua valendo.`,
      ),
      acao: { texto: "Terminar minha assinatura", href: "/painel/assinatura" },
    };
  }

  // --- 3. O teste grátis está acabando.
  if (
    !jaFoi("TRIAL_ACABANDO") &&
    s.subscriptionStatus === "trialing" &&
    s.trialEndsAt &&
    dias(agora, s.trialEndsAt) <= 3 &&
    s.trialEndsAt > agora
  ) {
    return {
      momento: "TRIAL_ACABANDO",
      assunto: "Seu mês grátis termina em 3 dias",
      corpo: comNumero(
        `${s.nome}, seu mês de teste acaba em 3 dias. Depois disso a Nexora para de ` +
          `montar a onda semanal — mas nada seu é apagado, e você continua podendo ler ` +
          `e exportar sua base quando quiser.\n\n` +
          `Se a Nexora te trouxe cliente, o painel mostra quanto. Se não trouxe, não ` +
          `assine — e me responde contando o que faltou, que isso vale mais para mim ` +
          `do que a mensalidade.`,
      ),
      acao: { texto: "Ver o que a Nexora trouxe", href: "/painel/assinatura" },
    };
  }

  // --- 4. Acabou o teste e não virou cliente. Três toques, e para.
  const trialAcabou =
    s.trialEndsAt && s.trialEndsAt <= agora && !VIVA.includes(s.subscriptionStatus ?? "");

  if (trialAcabou) {
    if (!jaFoi("TRIAL_ACABOU")) {
      return {
        momento: "TRIAL_ACABOU",
        assunto: "Seu mês grátis acabou — e sua base continua aqui",
        corpo: comNumero(
          `${s.nome}, o período de teste terminou. Não cobrei nada e não vou cobrar sem ` +
            `você mandar.\n\n` +
            `Tudo que você importou continua aí, inteiro. A única coisa que parou foi o ` +
            `envio da onda semanal.`,
        ),
        acao: { texto: "Ligar a onda de novo", href: "/painel/assinatura" },
      };
    }
    if (!jaFoi("TRIAL_ACABOU_3D")) {
      return {
        momento: "TRIAL_ACABOU_3D",
        assunto: "Posso te perguntar uma coisa?",
        corpo:
          `${s.nome}, você testou a Nexora e não continuou. Eu queria muito saber por quê.\n\n` +
          `Não é e-mail automático pedindo nota de 1 a 10. É uma pergunta só: o que faltou? ` +
          `Responde este e-mail com uma frase — pode ser dura. Eu leio todas.\n\n` +
          `Se foi preço, me diz também. Isso muda o que eu construo em seguida.`,
        acao: { texto: "Ver minha conta", href: "/painel/assinatura" },
      };
    }
    if (!jaFoi("TRIAL_ACABOU_10D")) {
      return {
        momento: "TRIAL_ACABOU_10D",
        assunto: "Último e-mail, prometo",
        corpo: comNumero(
          `${s.nome}, esse é o último e-mail que eu te mando sobre isso — não quero virar ` +
            `chatice.\n\n` +
            `Sua conta continua aberta e sua base continua sua. Se um dia quiser voltar, ` +
            `é só entrar: está tudo onde você deixou.`,
        ),
        acao: { texto: "Voltar quando quiser", href: "/painel/assinatura" },
      };
    }
  }

  // --- 5. Cancelou. Perguntar por quê vale mais que tentar segurar.
  if (s.canceladoEm) {
    if (!jaFoi("CANCELOU")) {
      return {
        momento: "CANCELOU",
        assunto: "Cancelamento feito — o que deu errado?",
        corpo:
          `${s.nome}, seu cancelamento está confirmado e você não será cobrado de novo. ` +
          `Você continua com acesso até o fim do período que já pagou, e seus dados ` +
          `continuam seus depois disso: dá para ler e exportar tudo.\n\n` +
          `Eu queria uma frase sua: o que fez você cancelar? Responde este e-mail. ` +
          `Não vou tentar te convencer de nada — só quero acertar o produto.`,
        acao: { texto: "Exportar minha base", href: "/painel/clientes/importar" },
      };
    }
    if (!jaFoi("CANCELOU_14D") && dias(s.canceladoEm, agora) >= 14) {
      return {
        momento: "CANCELOU_14D",
        assunto: "Sua base ainda está aqui",
        corpo: comNumero(
          `${s.nome}, faz duas semanas que você cancelou. Sua base não foi apagada — ` +
            `ela continua aqui do jeito que você deixou.\n\n` +
            `Se quiser voltar, você não recomeça do zero: é entrar e ligar a onda de novo.`,
        ),
        acao: { texto: "Reativar minha conta", href: "/painel/assinatura" },
      };
    }
  }

  // --- 6. Deu certo. Pedir o depoimento no momento de maior felicidade.
  if (!jaFoi("PEDIR_DEPOIMENTO") && s.recuperadoCents > 0) {
    return {
      momento: "PEDIR_DEPOIMENTO",
      assunto: `A Nexora já te trouxe ${reais(s.recuperadoCents)} de volta`,
      corpo:
        `${s.nome}, esse número é seu: ${reais(s.recuperadoCents)} em clientes que tinham ` +
        `sumido e voltaram depois de uma mensagem da onda.\n\n` +
        `Eu ainda não tenho depoimento nenhum para mostrar para quem chega. Você me daria ` +
        `duas frases contando o que aconteceu? Pode ser um áudio no WhatsApp, do jeito que ` +
        `for mais fácil. Se preferir sem o nome do seu negócio, também está ótimo.`,
      acao: { texto: "Ver meu resultado", href: "/painel/assinatura" },
    };
  }

  // --- 7. Ativação: cadastrou e a base está vazia. O produto não pode funcionar.
  if (!jaFoi("SEM_BASE") && s.clientesNaBase === 0 && dias(s.criadoEm, agora) >= 1) {
    return {
      momento: "SEM_BASE",
      assunto: "Falta um passo para a Nexora funcionar",
      corpo:
        `${s.nome}, você criou a conta mas ainda não trouxe sua lista de clientes — e sem ` +
        `ela a Nexora não tem como saber quem sumiu.\n\n` +
        `Manda do jeito que estiver: planilha torta, print do caderno, conversa exportada ` +
        `do WhatsApp. A gente entende e diz o que não conseguiu ler. Leva uns dois minutos.\n\n` +
        `Se estiver difícil, responde este e-mail com o arquivo que eu converto na mão.`,
      acao: { texto: "Trazer minha base", href: "/painel/clientes/importar" },
    };
  }

  // --- 8. Importou e nunca usou. Sem uso não há resultado, e sem resultado ele cancela.
  if (
    !jaFoi("SEM_USO") &&
    s.clientesNaBase > 0 &&
    s.toquesRegistrados === 0 &&
    dias(s.criadoEm, agora) >= 3
  ) {
    return {
      momento: "SEM_USO",
      assunto: "Sua onda está pronta e ninguém abriu",
      corpo: comNumero(
        `${s.nome}, sua base está no sistema e a onda da semana já está montada — mas ` +
          `nenhuma mensagem saiu ainda.\n\n` +
          `São 12 clientes e uns 9 minutos de copiar e colar. Não precisa fazer os 12: ` +
          `manda para três e vê o que acontece.`,
      ),
      acao: { texto: "Abrir minha onda", href: "/painel/onda" },
    };
  }

  return null;
}
