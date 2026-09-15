import { identificacaoCompleta, lerFornecedor, tipoDoDocumento } from "@/lib/legal/identidade";

/**
 * A EMPRESA NO RODAPÉ.
 *
 * Os dois rodapés — o do funil e o dos documentos — mostram a mesma coisa, então
 * a coisa mora aqui. Razão social e documento vêm das variáveis do servidor: o
 * repositório é público, e o dado muda fora do código.
 */

type Fornecedor = ReturnType<typeof lerFornecedor>;

export const LINKS_DO_RODAPE = [
  { texto: "Sobre", href: "/sobre" },
  { texto: "Termos de Uso", href: "/termos" },
  { texto: "Privacidade & LGPD", href: "/privacidade" },
  { texto: "Status", href: "/status" },
] as const;

/**
 * Fatos, não certificados. Selo que parece certificação sem existir certificação
 * é o mesmo defeito do CNPJ que o rodapé antigo prometia e nunca mostrou.
 */
export const SELOS_DO_RODAPE = [
  { texto: "Pagamentos processados pela Stripe", href: "/termos" },
  { texto: "Seus direitos na LGPD", href: "/privacidade" },
] as const;

/**
 * "© 2026 Razão Social · CNPJ 00.000.000/0000-00". Some inteira enquanto a
 * identificação não estiver preenchida: rodapé com "[DEFINIR]" é pior do que
 * rodapé sem empresa.
 */
export function linhaDaEmpresa(f: Fornecedor, ano: number): string | null {
  if (!identificacaoCompleta(f)) return null;
  const tipo = tipoDoDocumento(f.documento);
  return tipo ? `© ${ano} ${f.nome} · ${tipo} ${f.documento}` : `© ${ano} ${f.nome}`;
}

/** O canal de suporte é o e-mail de quem presta o serviço, o mesmo dos Termos. */
export function linkDeSuporte(f: Fornecedor): string {
  const email = f.email.trim();
  return /^[^\s@]+@[^\s@]+$/.test(email) ? `mailto:${email}` : "/sobre#contato";
}

const anoEmBrasilia = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

/** O ano em Brasília: na noite de 31/12 o servidor em UTC já está no ano seguinte. */
export function anoAtual(agora = new Date()): number {
  return Number(anoEmBrasilia.format(agora));
}
