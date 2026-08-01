import {
  GenerationProvider, GenerationRequest, TextResult, ImageResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

/** OpenAI provider: text via Chat Completions, image via Images API (DALL-E 3 / gpt-image-1). */
export class OpenAIProvider implements GenerationProvider {
  readonly vendor = 'openai';
  readonly capabilities = ['text', 'image'] as const;

  private get key(): string {
    const k = process.env.OPENAI_API_KEY;
    if (!k) throw new ProviderNotConfiguredError(this.vendor, 'text/image');
    return k;
  }

  async generateText(req: GenerationRequest): Promise<TextResult> {
    const model = req.model ?? 'gpt-4o';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a senior creative strategist at a marketing agency. ' +
              'Respond ONLY with a JSON object: {"concepts": [{"title": string, "coreMessage": string, "suggestedFormat": string}]}. ' +
              'No prose, no markdown.',
          },
          { role: 'user', content: req.prompt },
        ],
      }),
    });
    if (!res.ok) throw new ProviderCallError(this.vendor, res.status, await res.text().catch(() => res.statusText));
    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';
    let concepts: TextResult['concepts'] = [];
    try {
      const parsed = JSON.parse(raw);
      concepts = Array.isArray(parsed) ? parsed : (parsed.concepts ?? []);
      if (!Array.isArray(concepts)) throw new Error('expected array');
    } catch (e) {
      throw new ProviderCallError(this.vendor, null, `Unparseable concept JSON: ${(e as Error).message}`);
    }
    return {
      kind: 'text',
      provider: this.vendor,
      model,
      concepts,
      rawOutput: data,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  async generateImage(req: GenerationRequest): Promise<ImageResult> {
    const model = req.model ?? 'dall-e-3';
    // gpt-image-1 and dall-e-3 share the same endpoint
    const size = req.constraints?.aspectRatio === '9:16' ? '1024x1792'
      : req.constraints?.aspectRatio === '16:9' ? '1792x1024' : '1024x1024';
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.key}` },
      body: JSON.stringify({
        model,
        prompt: req.prompt,
        n: 1,
        size,
        quality: (req.options?.quality as string) ?? 'standard',
        ...(model === 'dall-e-3' ? { style: (req.options?.style as string) ?? 'natural' } : {}),
      }),
    });
    if (!res.ok) throw new ProviderCallError(this.vendor, res.status, await res.text().catch(() => res.statusText));
    const data = await res.json();
    const images = (data.data ?? []).map((img: { url?: string; b64_json?: string; revised_prompt?: string }) => ({
      url: img.url ?? `storage://pending-b64-upload`,
      revisedPrompt: img.revised_prompt,
    }));
    return { kind: 'image', provider: this.vendor, model, images, rawOutput: data, costUnits: 3 };
  }
}
