/**
 * QUEM PODE ENTRAR NUMA CONTA EXISTENTE PELO GOOGLE.
 *
 * PRE-SEQUESTRO DE CONTA (achado da auditoria, confirmado no codigo).
 *
 * O cadastro por senha cria conta com QUALQUER e-mail e nao confirma posse. O
 * callback do Google achava a empresa por `where: { email }` e abria sessao.
 * A combinacao das duas coisas e uma tomada de conta completa:
 *
 *   1. O atacante acha o e-mail comercial do alvo no Instagram dele e cadastra
 *      contato@barbearia.com.br com uma senha que ele escolhe.
 *   2. Semanas depois o dono real clica "Entrar com o Google" com o mesmo
 *      e-mail. O callback ACHA a conta do atacante e abre a sessao dela.
 *   3. O dono nao ve nada errado -- e uma conta vazia, como toda conta nova.
 *      Ele importa a base: nome, telefone, historico e valor de centenas de
 *      clientes finais.
 *   4. O atacante entra com a senha, que nunca deixou de funcionar, e exporta
 *      tudo por /api/dados/exportar.
 *
 * A regra abaixo corta o passo 2. E-mail nao e identidade: o `sub` do Google e.
 * Conta que nunca provou posse do e-mail nao pode ser adotada por ninguem --
 * o dono legitimo entra pela senha dele, e ai sim vincula o Google.
 */

export type ContaExistente = {
  id: string;
  googleSub: string | null;
  emailVerificadoEm: Date | null;
};

export type Vinculo =
  | { acao: "CRIAR" }
  | { acao: "ENTRAR"; companyId: string }
  | { acao: "VINCULAR"; companyId: string }
  | { acao: "RECUSAR"; motivo: string };

export function decidirVinculoGoogle(
  conta: ContaExistente | null,
  googleSub?: string,
): Vinculo {
  const sub = (googleSub ?? "").trim();

  // Sem identidade do provedor nao ha o que amarrar. Criar conta assim
  // reintroduziria o problema pelo outro lado.
  if (!sub) {
    return conta
      ? { acao: "RECUSAR", motivo: "O Google não informou o identificador da conta." }
      : { acao: "RECUSAR", motivo: "O Google não informou o identificador da conta." };
  }

  if (!conta) return { acao: "CRIAR" };

  // Caminho normal: esta conta ja e desta identidade Google.
  if (conta.googleSub && conta.googleSub === sub) {
    return { acao: "ENTRAR", companyId: conta.id };
  }

  // Mesmo e-mail, OUTRA identidade Google. Nao existe caso legitimo: o e-mail
  // e unico na base e ja pertence a outra conta Google.
  if (conta.googleSub && conta.googleSub !== sub) {
    return { acao: "RECUSAR", motivo: "Esse e-mail já está ligado a outra conta Google." };
  }

  // Conta sem Google vinculado. So pode ser adotada se a posse do e-mail ja
  // tiver sido provada antes -- caso contrario ela pode ter sido criada por
  // qualquer pessoa que digitou este endereco.
  if (conta.emailVerificadoEm) {
    return { acao: "VINCULAR", companyId: conta.id };
  }

  return {
    acao: "RECUSAR",
    motivo:
      "Já existe uma conta com esse e-mail criada com senha. Entre com a senha " +
      "e ligue o Google depois, pelo painel.",
  };
}
