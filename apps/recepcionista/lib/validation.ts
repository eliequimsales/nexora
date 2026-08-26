import { z } from "zod";

const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length >= 10 && v.length <= 13, {
    message: "Telefone deve ter DDD + número (10 a 13 dígitos)",
  });

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(200),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").max(72),
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const businessHourSchema = z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:MM)"),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (HH:MM)"),
  closed: z.boolean(),
});

export const faqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(1500),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  segments: z.array(z.string().trim().min(2).max(60)).max(3).default([]),
  description: z.string().max(2000).default(""),
  address: z.string().max(300).default(""),
  productsServices: z.string().max(4000).default(""),
  pricingInfo: z.string().max(4000).default(""),
  paymentMethods: z.string().max(1000).default(""),
  serviceRules: z.string().max(2000).default(""),
  aiTone: z.string().max(200).default("profissional, simpático e objetivo"),
  greetingMessage: z.string().max(500).default(""),
  awayMessage: z.string().max(500).default(""),
  businessHours: z.array(businessHourSchema).max(7).default([]),
  faqs: z.array(faqSchema).max(50).default([]),
  handoffKeywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  followUpEnabled: z.boolean().default(false),
  followUpDelayHours: z.number().int().min(1).max(72).default(4),
  followUpMessage: z.string().max(500).default(""),
  maxFollowUps: z.number().int().min(0).max(5).default(2),
});

export const humanMessageSchema = z.object({
  content: z.string().trim().min(1, "Mensagem vazia").max(4000),
});

export const conversationActionSchema = z.object({
  action: z.enum(["assumir", "reativar_ia", "finalizar"]),
});

// ——— NALS: Treinamento do Atendente ———

export const teachSchema = z.object({
  gapId: z.string().trim().max(40).optional(),
  question: z.string().trim().min(4, "Pergunta muito curta").max(300),
  answer: z.string().trim().min(2, "Escreva a resposta").max(1500),
});

export const reviewItemSchema = z.object({
  action: z.enum(["aprovar", "rejeitar"]),
  question: z.string().trim().max(300).optional(),
  answer: z.string().trim().max(1500).optional(),
});

export const gapActionSchema = z.object({
  action: z.enum(["dispensar"]),
});

export const interviewSchema = z.object({
  topics: z.array(z.string().trim().min(2).max(80)).min(1).max(15),
});

export type BusinessHour = z.infer<typeof businessHourSchema>;
export type Faq = z.infer<typeof faqSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
