import {
  GenerationProvider, GenerationRequest, TextResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

/** Google Gemini provider — text generation via the Generative Language API. */
export class GeminiProvider implements GenerationProvider {
  readonly vendor = 'google';
  readonly capabilities = ['text'] as const;

  private get key(): string {
    const k = process.env.GOOGLE_AI_API_KEY;
    if (!k) throw new ProviderNotConfiguredError(this.vendor, 'text');
    return k;
  }

  async generateText(req: GenerationRequest): Promise<TextResult> {
    const model = req.model ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: 'You are a senior creative strategist at a marketing agency. ' +
              'Respond ONLY with a JSON array of concept objects: ' +
              '[{"title": string, "coreMessage": string, "suggestedFormat": string}]. ' +
              'No prose, no markdown fences.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new ProviderCallError(this.vendor, res.status, await res.text().catch(() => res.statusText));
    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    let concepts: TextResult['concepts'] = [];
    try {
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      concepts = Array.isArray(parsed) ? parsed : [];
      if (!Array.isArray(concepts)) throw new Error('expected array');
    } catch (e) {
      throw new ProviderCallError(this.vendor, null, `Unparseable concept JSON: ${(e as Error).message}`);
    }
    const usage = data.usageMetadata ?? {};
    return {
      kind: 'text',
      provider: this.vendor,
      model,
      concepts,
      rawOutput: data,
      usage: { inputTokens: usage.promptTokenCount ?? 0, outputTokens: usage.candidatesTokenCount ?? 0 },
    };
  }
}
