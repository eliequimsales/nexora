/**
 * ONDE O GATEWAY DO WHATSAPP PODE MORAR.
 *
 * Por este endereço passa o conteúdo das conversas dos clientes do assinante,
 * com nome e telefone. Isso torna a escolha do host uma questão de proteção de
 * dados, não de conveniência de deploy.
 *
 * A auditoria encontrou EVOLUTION_API_URL apontando para *.trycloudflare.com —
 * o túnel rápido e gratuito da Cloudflare, que é a ferramenta certa para
 * testar do próprio computador e a errada para qualquer outra coisa:
 *
 *   1. O nome do host é sorteado a cada execução e o túnel morre junto com o
 *      processo local. Em produção, o WhatsApp para em silêncio e a URL
 *      guardada aponta para o nada.
 *   2. A outra ponta é uma máquina pessoal. Dado de terceiro trafegando para
 *      o PC de alguém não está em política de privacidade nenhuma.
 *   3. O endereço é público e a única barreira é o cabeçalho de chave.
 *
 * Esta função não conserta a hospedagem — isso custa dinheiro e é decisão de
 * quem paga. Ela impede que o problema entre em produção em silêncio, que é
 * como esse tipo de coisa vira incidente.
 */

/** Hosts que existem para desenvolvimento e não sobrevivem a produção. */
const EFEMEROS = [
  "trycloudflare.com",
  "ngrok.io",
  "ngrok-free.app",
  "ngrok.app",
  "loca.lt",
  "serveo.net",
  "localhost.run",
];

const LOCAIS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

/**
 * Devolve a explicação do problema, ou null quando o endereço serve.
 *
 * Texto e não booleano: quem lê isso está com o WhatsApp fora do ar e precisa
 * saber o que trocar, não descobrir que "algo está inválido".
 */
export function problemaNoGateway(
  url: string | undefined,
  ambiente: string | undefined,
): string | null {
  if (!url || !url.trim()) {
    return "EVOLUTION_API_URL não está definida.";
  }

  let endereco: URL;
  try {
    endereco = new URL(url);
  } catch {
    return `EVOLUTION_API_URL não é um endereço válido: ${url.slice(0, 80)}`;
  }

  // Fora de produção o túnel é a ferramenta certa, e barrar aqui só quebraria
  // o desenvolvimento de quem está testando o QR code na própria máquina.
  if (ambiente !== "production") return null;

  const host = endereco.hostname.toLowerCase();

  const efemero = EFEMEROS.find((e) => host === e || host.endsWith(`.${e}`));
  if (efemero) {
    return (
      `EVOLUTION_API_URL aponta para ${efemero}, que é um túnel de desenvolvimento: ` +
      `o endereço é público, muda a cada execução e a outra ponta costuma ser uma ` +
      `máquina pessoal. Por ele passam as conversas dos clientes. Use um servidor fixo.`
    );
  }

  if (LOCAIS.includes(host)) {
    return `EVOLUTION_API_URL aponta para ${host}, que em produção não existe fora do próprio contêiner.`;
  }

  if (endereco.protocol !== "https:") {
    return (
      `EVOLUTION_API_URL usa ${endereco.protocol.replace(":", "")}, sem criptografia. ` +
      `A conversa do cliente trafegaria em claro.`
    );
  }

  return null;
}
