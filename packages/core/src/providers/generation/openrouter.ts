import {
  GenerationProvider, GenerationRequest, TextResult, ProviderCallError,
} from './types';

const BASE_URL = 'https://openrouter.ai/api/v1';
const SITE_URL = process.env.OPENROUTER_SITE_URL ?? 'https://platform.mintagemarkcomm.com';
const SITE_NAME = process.env.OPENROUTER_SITE_NAME ?? 'Mintage Platform';

/** Free and affordable models served through a single OPENROUTER_API_KEY. */
export const OPENROUTER_FREE_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'deepseek/deepseek-chat-v3-0324:free',
] as const;

export const OPENROUTER_PAID_MODELS = [
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'google/gemini-2.0-flash-001',
  'google/gemini-2.5-pro',
  'mistralai/mistral-large',
  'meta-llama/llama-3.1-405b-instruct',
] as const;

export type OpenRouterModel =
  | (typeof OPENROUTER_FREE_MODELS)[number]
  | (typeof OPENROUTER_PAID_MODELS)[number]
  | string;

export class OpenRouterProvider implements GenerationProvider {
  readonly vendor = 'openrouter';
  readonly capabilities = ['text'] as const;
  private readonly defaultModel: OpenRouterModel =
    (process.env.OPENROUTER_DEFAULT_MODEL as OpenRouterModel) ??
    'meta-llama/llama-3.3-70b-instruct:free';

  async generateText(req: GenerationRequest): Promise<TextResult> {
    const model = (req.model as OpenRouterModel | undefined) ?? this.defaultModel;
    const apiKey = process.env.OPENROUTER_API_KEY ?? '';

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`,
        'http-referer': SITE_URL,
        'x-title': SITE_NAME,
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior creative strategist at a marketing agency. ' +
              'Respond ONLY with a JSON array of concept objects: ' +
              '[{"title": string, "coreMessage": string, "suggestedFormat": string}]. ' +
              'No prose, no markdown fences.',
          },
          { role: 'user', content: req.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new ProviderCallError(this.vendor, res.status, detail);
    }

    const data = await res.json() as {
      id: string;
      model: string;
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const text = data.choices?.[0]?.message?.content ?? '';

    let concepts: TextResult['concepts'];
    try {
      concepts = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (!Array.isArray(concepts)) throw new Error('expected array');
    } catch (e) {
      throw new ProviderCallError(this.vendor, null,
        `Model returned unparseable concept JSON: ${(e as Error).message}`);
    }

    return {
      kind: 'text',
      provider: this.vendor,
      model: data.model ?? model,
      concepts,
      rawOutput: data,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
