import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class IntegrationCryptoService {
  private readonly logger = new Logger(IntegrationCryptoService.name);
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('integrations.encryptionKey') ?? '';
    // Pad/trim to exactly 32 bytes for AES-256
    this.key = Buffer.alloc(32);
    Buffer.from(raw, 'utf8').copy(this.key);

    if (raw === 'dev-key-change-in-production-32b') {
      const isProduction = this.config.get<string>('nodeEnv') === 'production';
      if (isProduction) {
        throw new Error('INTEGRATION_ENCRYPTION_KEY must be set in production — refusing to start with default key');
      }
      this.logger.warn('Using default integration encryption key — set INTEGRATION_ENCRYPTION_KEY in production');
    }
  }

  encrypt(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(stored: string): string {
    const [ivHex, authTagHex, cipherHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const cipherBuf = Buffer.from(cipherHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(cipherBuf), decipher.final()]).toString('utf8');
  }
}
