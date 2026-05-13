import { Injectable, Logger } from '@nestjs/common';

export interface WhatsAppConfig {
  apiUrl: string;
  instance: string;
  apiKey: string;
}

@Injectable()
export class WhatsAppAdapter {
  private readonly logger = new Logger(WhatsAppAdapter.name);

  async send(config: WhatsAppConfig, phone: string, message: string): Promise<void> {
    // Stub — Evolution API delivery not yet wired. Log intent only.
    this.logger.log(`[STUB] WhatsApp to ${phone} via ${config.apiUrl}/${config.instance} | msg="${message.slice(0, 40)}…"`);
  }

  async testConnection(config: WhatsAppConfig): Promise<{ ok: boolean; error?: string }> {
    if (!config.apiUrl || !config.instance || !config.apiKey) {
      return { ok: false, error: 'Configuração incompleta' };
    }

    try {
      const res = await fetch(
        `${config.apiUrl}/instance/connectionState/${config.instance}`,
        { headers: { apikey: config.apiKey } },
      );
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const body = (await res.json()) as Record<string, unknown>;
      const state = (body as any)?.instance?.state ?? (body as any)?.state;
      if (state && state !== 'open') return { ok: false, error: `Estado: ${state}` };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message ?? 'Falha na conexão' };
    }
  }
}
