export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // O resgate do Atendente Virtual: responde, no expediente, quem esperou 5
    // minutos sem resposta, e manda o resumo da manhã na abertura.
    const { iniciarResgate } = await import("./lib/atendente/resgate");
    iniciarResgate();
  }
}
