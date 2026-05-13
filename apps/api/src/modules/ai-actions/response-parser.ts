import type { ClassifyResult, AiClassification } from '@reshit/shared';

export interface RespondResult {
  message: string;
}

const VALID_CLASSIFICATIONS: AiClassification[] = ['hot', 'warm', 'cold'];

export class ResponseParser {
  static parseClassify(raw: string): ClassifyResult {
    let parsed: unknown;

    try {
      // Strip markdown code fences if model wrapped JSON in ```json ... ```
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`LLM returned non-JSON for classify: ${raw.slice(0, 200)}`);
    }

    const obj = parsed as Record<string, unknown>;

    const classification = obj.classification as AiClassification;
    if (!VALID_CLASSIFICATIONS.includes(classification)) {
      throw new Error(`Invalid classification value: ${classification}`);
    }

    const score = Number(obj.score);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error(`Invalid score value: ${obj.score}`);
    }

    return {
      classification,
      score,
      justification: String(obj.justification ?? ''),
    };
  }

  static parseRespond(raw: string): RespondResult {
    const message = raw.trim();
    if (!message) throw new Error('LLM returned empty response for respond');
    return { message };
  }
}
