/**
 * Tipos para o canal profissional de feedback da Nexora.
 */

export type CategoriaFeedback = "sugestao" | "problema" | "duvida" | "elogio" | "outro";

export type FeedbackDados = {
  rating: number; // 1 a 5
  categoria: CategoriaFeedback;
  mensagem: string;
  email: string;
  whatsapp?: string;
  nomeCliente?: string;
  companyId?: string;
  companyName?: string;
  pagina?: string;
};

export type ResultadoFeedback = {
  enviado: boolean;
  motivo?: string;
};
