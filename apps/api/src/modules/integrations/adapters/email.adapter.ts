import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from?: string;
}

export interface SendEmailOptions {
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailAdapter {
  private readonly logger = new Logger(EmailAdapter.name);

  private createTransport(config: EmailConfig) {
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
  }

  async send(config: EmailConfig, to: string, options: SendEmailOptions): Promise<void> {
    const transporter = this.createTransport(config);
    await transporter.sendMail({
      from: config.from ?? config.user,
      to,
      subject: options.subject,
      text: options.text,
      ...(options.html && { html: options.html }),
    });
    this.logger.log(`Email sent to ${to} via ${config.host} — subject: "${options.subject}"`);
  }

  async testConnection(config: EmailConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.host || !config.user || !config.password) {
      return { ok: false, error: 'Configuração incompleta' };
    }
    const transporter = this.createTransport(config);
    try {
      await transporter.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: this.mapSmtpError(err) };
    }
  }

  private mapSmtpError(err: unknown): string {
    if (!(err instanceof Error)) return 'Erro desconhecido ao conectar ao servidor de email';
    const msg = err.message.toLowerCase();
    if (msg.includes('invalid login') || msg.includes('auth') || msg.includes('535')) {
      return 'Credenciais inválidas. Verifique usuário e senha SMTP.';
    }
    if (msg.includes('econnrefused') || msg.includes('connect')) {
      return 'Não foi possível conectar ao servidor. Verifique host e porta.';
    }
    if (msg.includes('timeout') || msg.includes('etimedout')) {
      return 'Tempo limite de conexão atingido. Verifique host e porta.';
    }
    if (msg.includes('sender') || msg.includes('from')) {
      return 'Endereço de remetente inválido ou não autorizado.';
    }
    return 'Falha ao conectar ao servidor de email. Verifique as configurações.';
  }
}
