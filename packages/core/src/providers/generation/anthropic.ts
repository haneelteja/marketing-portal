import {
  GenerationProvider, GenerationRequest, TextResult, ProviderCallError,
} from './types';

export class AnthropicTextProvider implements GenerationProvider {
  readonly vendor = 'anthropic';
  readonly capabilities = ['text'] as const;
  private readonly defaultModel = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  async generateText(req: GenerationRequest): Promise<TextResult> {
    const model = req.model ?? this.defaultModel;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system:
          'You are a senior creative strategist at a marketing agency. ' +
          'Respond ONLY with a JSON array of concept objects: ' +
          '[{"title": string, "coreMessage": string, "suggestedFormat": string}]. ' +
          'No prose, no markdown fences.',
        messages: [{ role: 'user', content: req.prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new ProviderCallError(this.vendor, res.status, detail);
    }

    const data = await res.json();
    const text: string = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

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
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    };
  }
}
