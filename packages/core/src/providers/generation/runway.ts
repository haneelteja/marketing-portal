import {
  GenerationProvider, GenerationRequest, VideoResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

export class RunwayVideoProvider implements GenerationProvider {
  readonly vendor = 'runway';
  readonly capabilities = ['video'] as const;
  private readonly base = 'https://api.dev.runwayml.com/v1';

  async generateVideo(req: GenerationRequest): Promise<VideoResult> {
    const key = process.env.RUNWAY_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.vendor, 'video');

    const model = req.model ?? 'gen4_turbo';
    const create = await fetch(`${this.base}/image_to_video`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        model,
        promptText: req.prompt,
        promptImage: (req.options?.sourceImageUrl as string) ?? undefined,
        ratio: req.constraints?.aspectRatio === '9:16' ? '720:1280' : '1280:720',
        duration: Math.min(req.constraints?.maxDurationSeconds ?? 10, 10),
      }),
    });
    if (!create.ok) {
      throw new ProviderCallError(this.vendor, create.status, await create.text());
    }
    const { id: taskId } = await create.json() as { id: string };

    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 5000 + attempt * 500));
      const poll = await fetch(`${this.base}/tasks/${taskId}`, {
        headers: { authorization: `Bearer ${key}`, 'X-Runway-Version': '2024-11-06' },
      });
      if (!poll.ok) throw new ProviderCallError(this.vendor, poll.status, await poll.text());
      const task = await poll.json() as { status: string; failure?: string; output?: string[] };
      if (task.status === 'SUCCEEDED') {
        return {
          kind: 'video',
          provider: this.vendor,
          model,
          videoUrl: task.output?.[0] ?? '',
          durationSeconds: 10,
          rawOutput: task,
          costUnits: model === 'gen4_turbo' ? 25 : 15,
        };
      }
      if (task.status === 'FAILED') {
        throw new ProviderCallError(this.vendor, null, task.failure ?? 'generation failed');
      }
    }
    throw new ProviderCallError(this.vendor, null, `Task ${taskId} timed out after polling window`);
  }
}
