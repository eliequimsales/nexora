import { prisma } from "@/lib/db";
import { gerarDiagnostico, type ClienteBase } from "@/lib/importacao/diagnostico";
import { medianaDoSegmento } from "@/lib/recuperacao/ciclo";
import { montarOferta, type Oferta } from "./oferta";
import { resultadoDaPrimeiraOndaDaEmpresa } from "./primeira-onda-da-conta";

/**
 * A oferta calculada com a lista que o dono subiu.
 *
 * Mesmo motor do diagnóstico público (gerarDiagnostico), para a tela de dentro
 * nunca mostrar um número diferente do que a página de venda mostrou para a
 * mesma lista. Quem pediu para parar de receber mensagem fica fora da conta:
 * não é oportunidade, é pessoa que disse não.
 */
export async function ofertaDaEmpresa(companyId: string, hoje = new Date()): Promise<Oferta> {
  const [empresa, clientes, garantia] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { primeiraOndaEm: true, profile: { select: { segments: true } } },
    }),
    prisma.customer.findMany({
      where: { companyId, optOut: false },
      select: {
        name: true,
        phone: true,
        visits: { select: { occurredAt: true, valueCents: true } },
      },
    }),
    prisma.garantia.findUnique({ where: { companyId }, select: { id: true } }),
  ]);

  const segmentos = Array.isArray(empresa?.profile?.segments)
    ? (empresa!.profile!.segments as string[])
    : [];

  const base: ClienteBase[] = clientes.map((c) => ({
    nome: c.name,
    telefone: c.phone,
    visitas: c.visits.map((v) => ({ data: v.occurredAt, valorCents: v.valueCents })),
  }));

  // Ticket médio só com visitas que têm valor: somar visitas de R$ 0 derrubaria a
  // média e faria a âncora dizer que a mensalidade precisa de mais retornos do que precisa.
  const comValor = clientes.flatMap((c) => c.visits).filter((v) => v.valueCents > 0);
  const ticketMedioCents = comValor.length
    ? Math.round(comValor.reduce((soma, v) => soma + v.valueCents, 0) / comValor.length)
    : null;

  const diagnostico = gerarDiagnostico(base, {
    hoje,
    medianaSegmentoDias: medianaDoSegmento(segmentos[0] ?? null),
  });

  const oferta = montarOferta(diagnostico, ticketMedioCents);
  const primeiraOnda = empresa?.primeiraOndaEm
    ? await resultadoDaPrimeiraOndaDaEmpresa(companyId, empresa.primeiraOndaEm)
    : null;

  // A garantia é uma por negócio: quem já teve a dela não compra outra.
  return { ...oferta, comGarantia: oferta.comGarantia && !garantia, primeiraOnda };
}
