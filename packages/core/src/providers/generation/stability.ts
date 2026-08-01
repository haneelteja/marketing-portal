import {
  GenerationProvider, GenerationRequest, ImageResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

export class StabilityImageProvider implements GenerationProvider {
  readonly vendor = 'stability';
  readonly capabilities = ['image'] as const;

  async generateImage(req: GenerationRequest): Promise<ImageResult> {
    const key = process.env.STABILITY_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.vendor, 'image');

    const model = req.model ?? 'stable-image-core';
    const endpoint = model === 'stable-image-ultra'
      ? 'https://api.stability.ai/v2beta/stable-image/generate/ultra'
      : 'https://api.stability.ai/v2beta/stable-image/generate/core';

    const form = new FormData();
    form.set('prompt', req.prompt);
    form.set('aspect_ratio', req.constraints?.aspectRatio ?? '1:1');
    form.set('output_format', 'png');
    if (req.options?.negative_prompt) form.set('negative_prompt', String(req.options.negative_prompt));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new ProviderCallError(this.vendor, res.status, detail);
    }
    const data = await res.json();
    return {
      kind: 'image',
      provider: this.vendor,
      model,
      images: [{ url: 'storage://pending-upload', seed: data.seed }],
      rawOutput: { finish_reason: data.finish_reason, seed: data.seed, imageBase64: data.image },
      costUnits: model === 'stable-image-ultra' ? 5 : 3,
    };
  }
}
