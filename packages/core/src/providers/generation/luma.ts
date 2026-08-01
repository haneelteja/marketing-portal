import {
  GenerationProvider, GenerationRequest, VideoResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

/** Luma Dream Machine — text/image-to-video generation. */
export class LumaProvider implements GenerationProvider {
  readonly vendor = 'luma';
  readonly capabilities = ['video'] as const;
  private readonly base = 'https://api.lumalabs.ai/dream-machine/v1';

  async generateVideo(req: GenerationRequest): Promise<VideoResult> {
    const key = process.env.LUMA_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.vendor, 'video');

    const model = req.model ?? 'ray-2';
    const create = await fetch(`${this.base}/generations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: req.prompt,
        ...(req.options?.sourceImageUrl
          ? { keyframes: { frame0: { type: 'image', url: req.options.sourceImageUrl } } }
          : {}),
        aspect_ratio: req.constraints?.aspectRatio === '9:16' ? '9:16' : '16:9',
        loop: false,
      }),
    });
    if (!create.ok) throw new ProviderCallError(this.vendor, create.status, await create.text());
    const { id: generationId } = await create.json() as { id: string };

    // Poll until complete (Luma generations typically take 60–120 seconds)
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 5000 + attempt * 500));
      const poll = await fetch(`${this.base}/generations/${generationId}`, {
        headers: { authorization: `Bearer ${key}` },
      });
      if (!poll.ok) throw new ProviderCallError(this.vendor, poll.status, await poll.text());
      const gen = await poll.json() as { state: string; failure_reason?: string; assets?: { video?: string } };
      if (gen.state === 'completed') {
        return {
          kind: 'video',
          provider: this.vendor,
          model,
          videoUrl: gen.assets?.video ?? '',
          durationSeconds: 5,
          rawOutput: gen,
          costUnits: 25,
        };
      }
      if (gen.state === 'failed') {
        throw new ProviderCallError(this.vendor, null, gen.failure_reason ?? 'Luma generation failed');
      }
    }
    throw new ProviderCallError(this.vendor, null, `Luma generation ${generationId} timed out`);
  }
}
