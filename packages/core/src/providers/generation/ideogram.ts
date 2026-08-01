import {
  GenerationProvider, GenerationRequest, ImageResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

/** Ideogram image generation — strong at text-in-image and stylized illustrations. */
export class IdeogramProvider implements GenerationProvider {
  readonly vendor = 'ideogram';
  readonly capabilities = ['image'] as const;

  async generateImage(req: GenerationRequest): Promise<ImageResult> {
    const key = process.env.IDEOGRAM_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.vendor, 'image');

    const model = req.model ?? 'V_2';
    const aspectRatio = req.constraints?.aspectRatio;
    const RATIO_MAP: Record<string, string> = {
      '1:1': 'ASPECT_1_1', '9:16': 'ASPECT_9_16', '16:9': 'ASPECT_16_9',
      '4:5': 'ASPECT_4_5', '2:3': 'ASPECT_2_3',
    };

    const res = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        image_request: {
          model,
          prompt: req.prompt,
          aspect_ratio: RATIO_MAP[aspectRatio ?? '1:1'] ?? 'ASPECT_1_1',
          style_type: (req.options?.style as string) ?? 'AUTO',
          magic_prompt_option: 'AUTO',
        },
      }),
    });
    if (!res.ok) throw new ProviderCallError(this.vendor, res.status, await res.text().catch(() => res.statusText));
    const data = await res.json();
    const images = (data.data ?? []).map((img: { url: string; seed?: number }) => ({
      url: img.url,
      seed: img.seed,
    }));
    return { kind: 'image', provider: this.vendor, model, images, rawOutput: data, costUnits: 3 };
  }
}
