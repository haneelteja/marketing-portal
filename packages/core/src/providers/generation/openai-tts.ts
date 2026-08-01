import {
  GenerationProvider, GenerationRequest, AudioResult,
  ProviderCallError, ProviderNotConfiguredError,
} from './types';

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
type Voice = (typeof VOICES)[number];

/** OpenAI TTS — text-to-speech via /v1/audio/speech. */
export class OpenAITTSProvider implements GenerationProvider {
  readonly vendor = 'openai-tts';
  readonly capabilities = ['audio'] as const;

  async generateAudio(req: GenerationRequest): Promise<AudioResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ProviderNotConfiguredError(this.vendor, 'audio');

    const model = req.model ?? 'tts-1-hd';
    const voice: Voice = ((req.options?.voice as string) ?? 'nova') as Voice;
    const format = (req.options?.format as string) ?? 'mp3';

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: req.prompt,
        voice,
        response_format: format,
        speed: (req.options?.speed as number) ?? 1.0,
      }),
    });
    if (!res.ok) throw new ProviderCallError(this.vendor, res.status, await res.text().catch(() => res.statusText));

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      kind: 'audio',
      provider: this.vendor,
      model,
      audioUrl: 'storage://pending-upload-audio',
      durationSeconds: 0,
      mimeType: `audio/${format}`,
      rawOutput: { voice, model, audioBase64: base64, contentLength: arrayBuffer.byteLength },
      costUnits: 2,
    };
  }
}
