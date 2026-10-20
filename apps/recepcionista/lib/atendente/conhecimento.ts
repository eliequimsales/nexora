import { z } from "zod";
import { horarioFalado } from "./datas";
import { duracaoFalada, precoFalado, type Fatos } from "./fatos";

/** O modelo escolhe fontes; o texto comercial enviado continua vindo do cadastro. */
export type FonteDeResposta = { id: string; assunto: string; texto: string };

export function catalogoDeRespostas(fatos: Fatos): FonteDeResposta[] {
  const fontes: FonteDeResposta[] = [];
  const incluir = (id: string, assunto: string, texto: string | undefined) => {
    if (texto?.trim()) fontes.push({ id, assunto, texto: texto.trim() });
  };
  for (const servico of fatos.servicos) {
    if (servico.precoCents > 0) {
      incluir(`servico:${servico.id}:preco`, `Preço de ${servico.nome}`,
        `${servico.nome} custa ${precoFalado(servico.precoCents)}.`);
    }
    if (servico.duracaoMin > 0) {
      incluir(`servico:${servico.id}:duracao`, `Duração de ${servico.nome}`,
        `${servico.nome} leva ${duracaoFalada(servico.duracaoMin)}.`);
    }
  }
  incluir("endereco", "Endereço da empresa", fatos.endereco ? `Estamos em ${fatos.endereco}.` : "");
  incluir("pagamento", "Formas de pagamento autorizadas", fatos.pagamento ? `Aceitamos ${fatos.pagamento}.` : "");
  incluir("funcionamento", "Horários habituais de funcionamento; não são vagas na agenda",
    fatos.horarios.length ? `Funcionamos ${horarioFalado(fatos.horarios)}.` : "");
  incluir("descricao", "Apresentação da empresa", fatos.descricao);
  incluir("produtos", "Produtos e serviços descritos pela empresa", fatos.productsServices);
  incluir("precos", "Condições de preço cadastradas pela empresa", fatos.pricingInfo);
  // A agenda também usa este campo para um JSON de profissionais, que não é uma política.
  const regras = fatos.serviceRules?.trim();
  if (regras && !/^[\[{]/.test(regras)) incluir("regras", "Regras cadastradas pela empresa", regras);
  fatos.perguntas.forEach((faq, i) => incluir(`faq:${i}`, faq.question, faq.answer));
  return fontes;
}

const selecaoSchema = z.object({
  fontes_ids: z.array(z.string().min(1).max(200)).max(12),
  duvida_pendente: z.boolean(),
});

/** Não usa texto livre, IDs desconhecidos ou uma seleção sem estado de cobertura. */
export function validarSelecaoDeFontes(
  resposta: unknown,
  catalogo: FonteDeResposta[],
): { fontes: FonteDeResposta[]; pendente: boolean } | null {
  const parsed = selecaoSchema.safeParse(resposta);
  if (!parsed.success) return null;
  const ids = [...new Set(parsed.data.fontes_ids)];
  const porId = new Map(catalogo.map((fonte) => [fonte.id, fonte]));
  if (ids.some((id) => !porId.has(id))) return null;
  return { fontes: ids.map((id) => porId.get(id)!), pendente: parsed.data.duvida_pendente || ids.length === 0 };
}
