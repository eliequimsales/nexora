import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMResult } from '@reshit/shared';

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: 'claude' | 'mock';
  private readonly model: string;
  private readonly client: Anthropic | null;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<'claude' | 'mock'>('llm.provider') ?? 'mock';
    this.model = this.config.get<string>('llm.model') ?? 'claude-haiku-4-5-20251001';

    if (this.provider === 'claude') {
      this.client = new Anthropic({
        apiKey: this.config.get<string>('llm.apiKey'),
      });
    } else {
      this.client = null;
    }
  }

  async call(prompt: string, maxTokens = 1024): Promise<LLMResult> {
    if (this.provider === 'mock') {
      return this.mockResponse(prompt);
    }

    const start = Date.now();

    const message = await this.client!.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected LLM response type');
    }

    return {
      content: content.text,
      tokensInput: message.usage.input_tokens,
      tokensOutput: message.usage.output_tokens,
      latencyMs: Date.now() - start,
    };
  }

  // Mock returns deterministic responses — safe for tests and dev without API key
  private mockResponse(prompt: string): LLMResult {
    const isClassify = prompt.includes('"classification"');
    const content = isClassify
      ? JSON.stringify({ classification: 'warm', score: 55, justification: 'Mock: dados parciais do lead.' })
      : 'Olá! Esta é uma mensagem gerada pelo mock de IA. Configure LLM_PROVIDER=claude para respostas reais.';

    return { content, tokensInput: 0, tokensOutput: 0, latencyMs: 0 };
  }
}
