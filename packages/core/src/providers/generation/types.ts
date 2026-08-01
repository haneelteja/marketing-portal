/**
 * GenerationProvider abstraction (spec §8.1).
 * Vendor SDK/HTTP code lives ONLY in concrete implementations under this folder.
 * The orchestrator resolves providers via the registry — never imports a vendor module directly.
 */

export interface BrandContext {
  clientId: string;
  brandVoice: string | null;
  toneGuidelines: string | null;
  targetAudience: string | null;
  colorPalette: Record<string, string>;
  typography: Record<string, string>;
  logoUrl: string | null;
}

export interface PlatformConstraints {
  platform: 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'x';
  aspectRatio?: string;          // "1:1", "9:16", "16:9"
  maxCaptionLength?: number;
  maxDurationSeconds?: number;
  hashtagConvention?: string;
}

export interface GenerationRequest {
  /** Fully assembled prompt from PromptContextBuilder — persisted verbatim for inspection. */
  prompt: string;
  context: BrandContext;
  constraints?: PlatformConstraints;
  /**
   * Specific model to use within this vendor (e.g. "claude-opus-4-7", "gpt-image-1").
   * When omitted the provider uses its own hardcoded default.
   */
  model?: string;
  /** Provider-specific knobs (seed, variant count, voice_id, style, etc.). */
  options?: Record<string, unknown>;
}

export interface TextResult {
  kind: 'text';
  provider: string;
  model: string;
  /** Structured concepts parsed from the model output. */
  concepts: Array<{ title: string; coreMessage: string; suggestedFormat: string }>;
  rawOutput: unknown;          // stored in concepts.raw_llm_output, inspectable
  usage: { inputTokens: number; outputTokens: number };
}

export interface ImageResult {
  kind: 'image';
  provider: string;
  model: string;
  images: Array<{ url: string; seed?: number }>;
  rawOutput: unknown;
  costUnits: number;
}

export interface VideoResult {
  kind: 'video';
  provider: string;
  model: string;
  videoUrl: string;
  durationSeconds: number;
  rawOutput: unknown;
  costUnits: number;
}

export interface AudioResult {
  kind: 'audio';
  provider: string;
  model: string;
  /** URL to the generated audio file (stored in object storage like images/videos). */
  audioUrl: string;
  /** Duration of the generated audio in seconds. */
  durationSeconds: number;
  /** MIME type — e.g. "audio/mpeg", "audio/wav". */
  mimeType: string;
  rawOutput: unknown;
  costUnits: number;
}

export type Capability = 'text' | 'image' | 'video' | 'audio';

export interface GenerationProvider {
  readonly vendor: string;
  readonly capabilities: ReadonlyArray<Capability>;
  generateText?(req: GenerationRequest): Promise<TextResult>;
  generateImage?(req: GenerationRequest): Promise<ImageResult>;
  generateVideo?(req: GenerationRequest): Promise<VideoResult>;
  generateAudio?(req: GenerationRequest): Promise<AudioResult>;
}

/**
 * Static descriptor of one model variant within a provider.
 * Used to populate the model-selection UI without calling any API.
 */
export interface ModelDescriptor {
  vendor: string;
  vendorLabel: string;           // "Anthropic", "OpenAI", "ElevenLabs" …
  capability: Capability;
  model: string;                 // the exact string passed in GenerationRequest.model
  label: string;                 // "Claude Opus 4.7", "DALL-E 3" …
  description: string;
  costUnitsPerCall: number;
  /** True when the required env var(s) are set in this process. */
  configured: boolean;
}

/** Thrown when a vendor isn't configured. Surfaces to the UI as "Coming soon" /
 *  a failed job with a real reason — the backend NEVER fabricates success (spec §15.1). */
export class ProviderNotConfiguredError extends Error {
  constructor(vendor: string, capability: string) {
    super(`Provider "${vendor}" is not configured for ${capability}. ` +
          `Set the required credentials or select a different provider.`);
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ProviderCallError extends Error {
  constructor(vendor: string, public readonly status: number | null, detail: string) {
    super(`${vendor} call failed${status ? ` (HTTP ${status})` : ''}: ${detail}`);
    this.name = 'ProviderCallError';
  }
}
