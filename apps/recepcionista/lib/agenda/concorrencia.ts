/**
 * O erro que o Postgres devolve quando aborta a transação perdedora.
 *
 * Em isolamento serializável, duas marcações simultâneas no mesmo horário não
 * podem valer as duas: o banco deixa uma passar e aborta a outra. Do ponto de
 * vista de quem perdeu, isso não é falha do sistema — é o horário ter acabado
 * de ser ocupado, que é exatamente o 409 que a rota já sabe responder.
 *
 * Sem este mapeamento a pessoa levaria um 500 e pensaria que a agenda quebrou.
 */

/** P2034 = write conflict / deadlock. 40001 e 40P01 são os SQLSTATE do Postgres. */
const CODIGOS = ["P2034", "40001", "40P01"];

export function ehConflitoDeConcorrencia(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const codigo = (erro as { code?: unknown }).code;
  return typeof codigo === "string" && CODIGOS.includes(codigo);
}
