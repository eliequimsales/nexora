import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * VERIFICAÇÃO DE E-MAIL.
 *
 * O cadastro por senha aceitava qualquer endereço sem provar posse. Com o
 * vínculo do Google corrigido (lib/auth/vinculo-google.ts), isso deixou de ser
 * tomada de conta — mas ainda deixa três buracos:
 *
 *   1. Alguém OCUPA o e-mail comercial de um negócio, e o dono não consegue se
 *      cadastrar porque o endereço já está em uso.
 *   2. Quem erra o próprio e-mail fica sem caminho de volta: a recuperação de
 *      senha manda para o endereço errado.
 *   3. Não dá para mandar a confirmação da contratação que o Decreto
 *      7.962/2013 exige, porque ninguém garante que o endereço existe.
 *
 * ONDE TRAVAR. Bloquear o painel inteiro mataria o primeiro minuto do produto,
 * que é onde o dono decide se fica. Travar a COBRANÇA é proporcional: antes de
 * tirar dinheiro de alguém é preciso saber que dá para falar com essa pessoa —
 * e a lei obriga a mandar o comprovante para lá.
 *
 * O token segue o mesmo desenho do reset de senha: o banco guarda só o sha256,
 * o link vale uma vez e expira. Se o banco vazar, os hashes não verificam
 * conta nenhuma.
 */

export const VALIDADE_HORAS = 48;

export function precisaVerificar(conta: { emailVerificadoEm: Date | null } | null): boolean {
  // Conta inexistente cai no caminho de "precisa": na dúvida, pedir prova é
  // melhor do que liberar.
  if (!conta) return true;
  return conta.emailVerificadoEm === null;
}

export function podeCobrar(
  conta: { emailVerificadoEm: Date | null } | null,
): { pode: true } | { pode: false; motivo: string } {
  if (precisaVerificar(conta)) {
    return {
      pode: false,
      motivo:
        "Confirme seu e-mail antes de assinar. Mandamos um link no cadastro — " +
        "é ele que garante que o comprovante da compra chegue até você.",
    };
  }
  return { pode: true };
}

function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Abre um pedido de verificação e devolve o token em claro UMA vez — ele nunca
 * mais existe fora do e-mail que acabou de sair.
 *
 * Invalida os pedidos anteriores da mesma conta: pedir um link novo tem que
 * matar o antigo, senão um link velho continua valendo depois de a pessoa
 * suspeitar de alguma coisa e pedir outro.
 */
export async function abrirVerificacao(companyId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await prisma.$transaction([
    prisma.verificacaoEmail.updateMany({
      where: { companyId, usadoEm: null },
      data: { usadoEm: new Date() },
    }),
    prisma.verificacaoEmail.create({
      data: {
        companyId,
        tokenHash: hashDoToken(token),
        expiraEm: new Date(Date.now() + VALIDADE_HORAS * 3_600_000),
      },
    }),
  ]);

  return token;
}

export type ResultadoVerificacao =
  | { ok: true }
  | { ok: false; motivo: string };

/**
 * Consome o token. A mensagem de erro é a mesma para link inválido e para link
 * expirado: distinguir os dois diria a quem está testando token se ele existiu
 * algum dia.
 */
export async function concluirVerificacao(token: string): Promise<ResultadoVerificacao> {
  const INVALIDO = "Esse link não vale mais. Peça um novo pelo painel.";

  const pedido = await prisma.verificacaoEmail.findUnique({
    where: { tokenHash: hashDoToken(token) },
    select: { id: true, companyId: true, expiraEm: true, usadoEm: true },
  });

  if (!pedido || pedido.usadoEm || pedido.expiraEm <= new Date()) {
    return { ok: false, motivo: INVALIDO };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // `usadoEm: null` no where é a trava contra uso duplo: se outra
      // requisição chegou primeiro, esta atualiza zero linhas e desiste.
      const queimado = await tx.verificacaoEmail.updateMany({
        where: { id: pedido.id, usadoEm: null },
        data: { usadoEm: new Date() },
      });
      if (queimado.count === 0) throw new Error("token-ja-consumido");

      await tx.company.update({
        where: { id: pedido.companyId },
        data: { emailVerificadoEm: new Date() },
      });
    });
  } catch {
    return { ok: false, motivo: INVALIDO };
  }

  return { ok: true };
}
