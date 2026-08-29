/**
 * REDEFINIÇÃO DE SENHA.
 *
 * Faltava inteira: existia login, cadastro, logout e Google — quem entrou por
 * e-mail e esqueceu a senha ficava trancado para fora da própria base de
 * clientes, sem nenhum caminho de volta.
 *
 * Três decisões de segurança, todas com o mesmo princípio: o pior caso é
 * alguém tomar a conta de um cliente pagante.
 *
 *   TOKEN GRAVADO COM HASH. O banco guarda sha256 do token, nunca o token. Se o
 *   banco vazar, os hashes não redefinem a senha de ninguém — do contrário o
 *   vazamento viraria tomada de conta imediata em toda conta com pedido aberto.
 *
 *   USO ÚNICO E COM PRAZO. `usedAt` queima o link no primeiro uso; uma hora de
 *   validade limita a janela de quem tiver acesso ao e-mail depois.
 *
 *   A RESPOSTA NÃO DIZ SE O E-MAIL EXISTE. Sempre a mesma mensagem, exista ou
 *   não a conta — senão a tela de "esqueci a senha" vira um verificador de
 *   quais e-mails têm conta na Nexora.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const VALIDADE_MINUTOS = 60;

/** Segredo que vai no link, e o hash que fica no banco. */
export function novoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDoToken(token) };
}

export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria o pedido. Devolve o token em claro UMA vez — ele nunca mais existe fora
 * do e-mail que acabou de sair.
 */
export async function abrirPedido(companyId: string): Promise<string> {
  const { token, hash } = novoToken();

  // Pedidos anteriores desta conta morrem: dois links válidos ao mesmo tempo
  // dobram a superfície e confundem quem pediu duas vezes.
  await prisma.passwordReset.updateMany({
    where: { companyId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordReset.create({
    data: {
      companyId,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + VALIDADE_MINUTOS * 60_000),
    },
  });

  return token;
}

export type Resultado = { ok: true } | { ok: false; motivo: string };

/**
 * Consome o token e troca a senha. Tudo dentro de uma transação: sem ela, duas
 * requisições simultâneas com o mesmo token trocariam a senha duas vezes, e a
 * segunda venceria — deixando a conta com uma senha que quem pediu não conhece.
 */
export async function redefinir(token: string, novaSenha: string): Promise<Resultado> {
  const hash = hashDoToken(token);

  const pedido = await prisma.passwordReset.findUnique({
    where: { tokenHash: hash },
    select: { id: true, companyId: true, expiresAt: true, usedAt: true, tokenHash: true },
  });

  // Comparação em tempo constante mesmo já tendo achado pelo índice: mantém o
  // caminho de erro e o de sucesso com custo parecido.
  const confere =
    pedido != null &&
    pedido.tokenHash.length === hash.length &&
    timingSafeEqual(Buffer.from(pedido.tokenHash), Buffer.from(hash));

  if (!confere) return { ok: false, motivo: "Esse link não vale mais." };
  if (pedido.usedAt) return { ok: false, motivo: "Esse link já foi usado." };
  if (pedido.expiresAt <= new Date()) {
    return { ok: false, motivo: "Esse link expirou. Peça outro — leva um minuto." };
  }

  const senhaHash = await hashPassword(novaSenha);

  await prisma.$transaction(async (tx) => {
    // `usedAt: null` no where é a trava: se outra requisição chegou primeiro,
    // esta atualiza zero linhas e a troca não acontece duas vezes.
    const queimado = await tx.passwordReset.updateMany({
      where: { id: pedido.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (queimado.count === 0) throw new Error("token-ja-consumido");

    await tx.company.update({
      where: { id: pedido.companyId },
      data: { passwordHash: senhaHash },
    });
  });

  return { ok: true };
}
