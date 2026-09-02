import { prisma } from "@/lib/db";
import { logError } from "@/lib/errors";
import { montarOndaDaSemana } from "@/lib/recuperacao/servico";
import { enviarEmail } from "./email";
import { tokenDescadastro } from "./servico";
import { deveChamarParaOnda, momentoDaOnda, textoDaChamada } from "./onda-semanal";

/**
 * A CHAMADA DE SEGUNDA — o único e-mail recorrente da régua.
 *
 * Todos os outros momentos são de ciclo de vida e vão uma vez na vida da conta.
 * Este vai toda segunda, enquanto houver onda para chamar — e é a diferença
 * entre uma vida média de 6 meses e uma de 9 a 12, que é a diferença entre o
 * anúncio precisar de 27 assinantes ou de 13.
 *
 * A trava de "um por semana" não é código: é o `@@unique([companyId, momento])`
 * que o model Reengajamento já tinha. Como o momento carrega a semana
 * (`ONDA:2026-W36`), a segunda tentativa da mesma semana estoura no banco e é
 * ignorada. Sem migração, sem consulta extra, e à prova de duas execuções do
 * cron ao mesmo tempo.
 */

export type ResultadoChamada = { enviados: number; pulados: number; falhas: number };

export async function chamarParaAOnda(hoje: Date): Promise<ResultadoChamada> {
  const resultado: ResultadoChamada = { enviados: 0, pulados: 0, falhas: 0 };
  const momento = momentoDaOnda(hoje);
  const appUrl = process.env.APP_URL ?? "";

  const empresas = await prisma.company.findMany({
    where: {
      semEmail: false,
      subscriptionStatus: { in: ["active", "trialing", "past_due"] },
    },
    select: { id: true, name: true, email: true, subscriptionStatus: true, semEmail: true },
  });

  for (const empresa of empresas) {
    try {
      const jaEnviado =
        (await prisma.reengajamento.count({ where: { companyId: empresa.id, momento } })) > 0;

      // Monta a onda ANTES de decidir: sem saber quantos cartões existem não dá
      // para respeitar a regra mais importante daqui, que é não mandar e-mail
      // anunciando onda vazia.
      const clientesNaBase = jaEnviado
        ? 0
        : await prisma.customer.count({ where: { companyId: empresa.id, optOut: false } });

      const onda = jaEnviado || clientesNaBase === 0
        ? null
        : await montarOndaDaSemana(empresa.id, { hoje });

      const chamar = deveChamarParaOnda({
        subscriptionStatus: empresa.subscriptionStatus,
        semEmail: empresa.semEmail,
        clientesNaBase,
        cartoesNaOnda: onda?.cards.length ?? 0,
        jaEnviadoNestaSemana: jaEnviado,
      });

      if (!chamar) {
        resultado.pulados += 1;
        continue;
      }

      // Contatos de semanas anteriores que ainda não têm desfecho. É o "3 de 12
      // inacabado" que traz o dono de volta no meio da semana — e é dinheiro
      // que pode já ter voltado sem entrar no Livro-Caixa.
      const vencidos = await prisma.recoveryTouch.count({
        where: {
          companyId: empresa.id,
          outcome: "AGUARDANDO",
          sentAt: { lte: new Date(hoje.getTime() - 3 * 86_400_000) },
        },
      });

      const mensagem = textoDaChamada({
        nome: empresa.name,
        cartoes: onda!.cards.length,
        potencialCents: onda!.totalEmJogoCents,
        vencidos,
      });

      // Este e-mail É marketing de relacionamento, então leva descadastro —
      // diferente da confirmação de contratação, que ninguém pode recusar.
      const url = `${appUrl}/descadastro?e=${empresa.id}&t=${tokenDescadastro(empresa.id)}`;
      const envio = await enviarEmail(empresa.email, mensagem, url);

      // Grava mesmo se o envio falhar: o registro é o que impede a segunda
      // execução do cron de mandar de novo no mesmo dia.
      await prisma.reengajamento.create({
        data: {
          companyId: empresa.id,
          momento,
          erro: envio.enviado ? null : (envio.motivo ?? "falha desconhecida"),
        },
      });

      if (envio.enviado) resultado.enviados += 1;
      else resultado.falhas += 1;
    } catch (erro) {
      // Corrida entre duas execuções do cron: a segunda estoura no @@unique e
      // cai aqui. Não é falha de verdade — é a trava funcionando.
      const codigo = (erro as { code?: string })?.code;
      if (codigo === "P2002") {
        resultado.pulados += 1;
        continue;
      }
      resultado.falhas += 1;
      await logError("chamada-semanal", erro, empresa.id);
    }
  }

  return resultado;
}
