import {
  GenerationProvider, GenerationRequest, AudioResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

/**
 * ElevenLabs text-to-speech provider.
 * The prompt is the voiceover script; `options.voice_id` selects the voice.
 * The returned audioUrl is a base64 placeholder until the worker uploads to storage.
 */
export class ElevenLabsProvider implements GenerationProvider {
  readonly vendor = 'elevenlabs';
  readonly capabilities = ['audio'] as const;
  private readonly base = 'https://api.elevenlabs.io/v1';

  async generateAudio(req: GenerationRequest): Promise<AudioResult> {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.vendor, 'audio');

    const model = req.model ?? 'eleven_multilingual_v2';
    const voiceId = (req.options?.voice_id as string) ?? 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" — a neutral default

    const res = await fetch(`${this.base}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: req.prompt,
        model_id: model,
        voice_settings: {
          stability: (req.options?.stability as number) ?? 0.5,
          similarity_boost: (req.options?.similarity_boost as number) ?? 0.75,
          style: (req.options?.style as number) ?? 0,
          use_speaker_boost: true,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new ProviderCallError(this.vendor, res.status, detail);
    }

    // Worker uploads the audio binary to object storage and replaces this placeholder.
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      kind: 'audio',
      provider: this.vendor,
      model,
      audioUrl: `storage://pending-upload-audio`,
      durationSeconds: 0, // updated after upload via metadata
      mimeType: 'audio/mpeg',
      rawOutput: { voiceId, model, audioBase64: base64, contentLength: arrayBuffer.byteLength },
      costUnits: 2,
    };
  }
}
