import { z } from "zod";
import { TIPOS_DE_MIDIA, textoDeMidiaNaoInterpretada } from "@/lib/whatsapp/midia";

/**
 * O QUE A TELA DO ATENDENTE PODE MANDAR — VALIDADO E LIMPO.
 *
 * Tudo que entra aqui acaba nos fatos que o Atendente usa com o cliente: nome,
 * endereço, pagamento. Por isso cada campo tem tamanho máximo, os caracteres de
 * controle saem, e o objeto é estrito — campo que a tela não manda é recusado.
 */

/** Letras, espaço, apóstrofo e hífen: "Bia", "Ana Clara", "D'Ávila". */
const SO_LETRAS = /^[\p{L}\s'-]*$/u;
export const MAX_NOME_DO_ATENDENTE = 30;

const limpo = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const nomeDoAtendente = z
  .string()
  .transform(limpo)
  .pipe(
    z
      .string()
      .max(MAX_NOME_DO_ATENDENTE, `O nome pode ter até ${MAX_NOME_DO_ATENDENTE} letras.`)
      .regex(SO_LETRAS, "Use só letras no nome."),
  );

const textoCurto = z.string().transform(limpo).pipe(z.string().max(300, "Texto longo demais."));
const limpoMultilinha = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.replace(/[ -  ]/g, " ").replace(/[^\S\r\n]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
const textoMultilinha = z
  .string()
  .transform(limpoMultilinha)
  .pipe(z.string().max(2000, "Texto longo demais (máximo 2.000 letras)."));

const jeito = z.enum(["ACOLHEDOR", "DIRETO", "DESCONTRAIDO"]);

export const ajusteDoAtendente = z
  .object({
    nome: nomeDoAtendente.optional(),
    jeito: jeito.optional(),
    marcaDireto: z.boolean().optional(),
    expediente: z.boolean().optional(),
    endereco: textoCurto.optional(),
    pagamento: textoCurto.optional(),
    descricao: textoMultilinha.optional(),
    /** true fecha o dia de hoje; false reabre. */
    fecharHoje: z.boolean().optional(),
    /** Id de uma anotação da lista "Precisa de você" que o dono resolveu. */
    resolver: z
      .string()
      .regex(/^[a-z0-9]{10,40}$/i, "Anotação inválida.")
      .optional(),
  })
  .strict();

export const pedidoDeLigar = z.object({ ligar: z.boolean() }).strict();

export const pedidoDeSimulacao = z
  .object({
    mensagens: z
      .array(
        z
          .object({
            de: z.enum(["cliente", "atendente"]),
            texto: z.string().default("").transform(limpo).pipe(z.string().max(5000, "Mensagem longa demais.")),
            /** Tipo simulado, sem carregar arquivo ou afirmar interpretação. */
            midia: z.enum(TIPOS_DE_MIDIA).optional(),
          })
          .strict()
          .superRefine((m, ctx) => {
            if (m.de === "cliente" && m.texto.length > 500) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mensagem longa demais (máximo de 500 caracteres)." });
            if (!m.texto && !m.midia) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mensagem vazia." });
            if (m.midia && m.de !== "cliente") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Simule a mídia como mensagem do cliente." });
          })
          .transform((m) => ({ de: m.de, texto: m.midia ? textoDeMidiaNaoInterpretada(m.midia, m.texto) : m.texto })),
      )
      .min(1)
      .max(30),
    /** A escolha pendente que o próprio simulador devolveu; o servidor confere de novo. */
    estado: z.unknown().optional(),
    /** O servidor carrega a versão salva; o cliente não injeta fatos no motor. */
    configuracaoRevisao: z.number().int().nonnegative().optional(),
    cenario: z.enum(["INFORMACOES", "HORARIO", "HUMANO", "DESCONHECIDA", "MULTIPLA", "CANCELAMENTO", "MIDIA"]).optional(),
    nome: nomeDoAtendente.optional(),
    jeito: jeito.optional(),
    marcaDireto: z.boolean().optional(),
  })
  .strict()
  // O refine roda mesmo quando a lista veio vazia: por isso o `?.`.
  .refine((p) => p.mensagens[p.mensagens.length - 1]?.de === "cliente", {
    message: "A última mensagem do teste é a do cliente.",
  });
