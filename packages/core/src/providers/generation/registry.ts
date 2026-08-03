import type { GenerationProvider, ModelDescriptor, Capability } from './types';
import { ProviderNotConfiguredError } from './types';
import { AnthropicTextProvider } from './anthropic';
import { StabilityImageProvider } from './stability';
import { RunwayVideoProvider } from './runway';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { IdeogramProvider } from './ideogram';
import { LumaProvider } from './luma';
import { ElevenLabsProvider } from './elevenlabs';
import { OpenAITTSProvider } from './openai-tts';
import { OpenRouterProvider, OPENROUTER_FREE_MODELS, OPENROUTER_PAID_MODELS } from './openrouter';

// All concrete provider instances. One instance per vendor class.
const ALL_PROVIDERS: GenerationProvider[] = [
  new AnthropicTextProvider(),
  new OpenAIProvider(),
  new GeminiProvider(),
  new StabilityImageProvider(),
  new IdeogramProvider(),
  new RunwayVideoProvider(),
  new LumaProvider(),
  new ElevenLabsProvider(),
  new OpenAITTSProvider(),
  new OpenRouterProvider(),
];

/** Which env vars are needed per vendor. */
const VENDOR_ENV: Record<string, string[]> = {
  anthropic:    ['ANTHROPIC_API_KEY'],
  openai:       ['OPENAI_API_KEY'],
  'openai-tts': ['OPENAI_API_KEY'],
  google:       ['GOOGLE_AI_API_KEY'],
  stability:    ['STABILITY_API_KEY'],
  ideogram:     ['IDEOGRAM_API_KEY'],
  runway:       ['RUNWAY_API_KEY'],
  luma:         ['LUMA_API_KEY'],
  elevenlabs:   ['ELEVENLABS_API_KEY'],
  openrouter:   ['OPENROUTER_API_KEY'],
};

/**
 * Named task types that can be assigned different LLM models in platform settings.
 * Stored as keys in platform_settings.llm_task_routing (JSON column).
 */
export type LlmTask = 'strategy' | 'concept' | 'caption' | 'audience' | 'lead_scout';

export const LLM_TASK_LABELS: Record<LlmTask, string> = {
  strategy:   'Marketing strategy',
  concept:    'Content concepts',
  caption:    'Captions & hashtags',
  audience:   'Audience analysis',
  lead_scout: 'B2B lead scouting',
};

/** Default task → model mapping. Free models first for zero-config bootstrapping. */
export const DEFAULT_TASK_ROUTING: Record<LlmTask, { vendor: string; model: string }> = {
  strategy:   { vendor: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  concept:    { vendor: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  caption:    { vendor: 'openrouter', model: 'google/gemma-3-27b-it:free' },
  audience:   { vendor: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct:free' },
  lead_scout: { vendor: 'openrouter', model: 'mistralai/mistral-7b-instruct:free' },
};

function isVendorConfigured(vendor: string): boolean {
  const keys = VENDOR_ENV[vendor] ?? [];
  return keys.every((k) => Boolean(process.env[k]));
}

/**
 * Full static catalog of every provider × model combination.
 * The UI reads this to render model-selection dropdowns and settings cards.
 * `configured` reflects whether the required API key(s) are present at runtime.
 */
export function getProviderCatalog(): ModelDescriptor[] {
  return [
    // ── TEXT ──────────────────────────────────────────────────────────────────
    { vendor: 'anthropic', vendorLabel: 'Anthropic', capability: 'text', model: 'claude-opus-4-7',
      label: 'Claude Opus 4.7', description: 'Most capable model. Best for nuanced brand strategy and long-form concepts.',
      costUnitsPerCall: 4, configured: isVendorConfigured('anthropic') },
    { vendor: 'anthropic', vendorLabel: 'Anthropic', capability: 'text', model: 'claude-sonnet-4-6',
      label: 'Claude Sonnet 4.6', description: 'Balanced speed and quality. Recommended default for concept generation.',
      costUnitsPerCall: 2, configured: isVendorConfigured('anthropic') },
    { vendor: 'anthropic', vendorLabel: 'Anthropic', capability: 'text', model: 'claude-haiku-4-5-20251001',
      label: 'Claude Haiku 4.5', description: 'Fastest and most economical. Good for rapid drafts and iteration.',
      costUnitsPerCall: 1, configured: isVendorConfigured('anthropic') },
    { vendor: 'openai', vendorLabel: 'OpenAI', capability: 'text', model: 'gpt-4o',
      label: 'GPT-4o', description: 'OpenAI flagship. Strong at following structured JSON output instructions.',
      costUnitsPerCall: 3, configured: isVendorConfigured('openai') },
    { vendor: 'openai', vendorLabel: 'OpenAI', capability: 'text', model: 'gpt-4o-mini',
      label: 'GPT-4o mini', description: 'Cheaper, faster GPT-4o variant. Good for high-volume concept drafting.',
      costUnitsPerCall: 1, configured: isVendorConfigured('openai') },
    { vendor: 'google', vendorLabel: 'Google', capability: 'text', model: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash', description: 'Very fast and affordable Google model with strong creative output.',
      costUnitsPerCall: 1, configured: isVendorConfigured('google') },
    { vendor: 'google', vendorLabel: 'Google', capability: 'text', model: 'gemini-1.5-pro',
      label: 'Gemini 1.5 Pro', description: 'Google Pro — long context, strong reasoning, good for detailed briefs.',
      costUnitsPerCall: 3, configured: isVendorConfigured('google') },

    // ── IMAGE ─────────────────────────────────────────────────────────────────
    { vendor: 'stability', vendorLabel: 'Stability AI', capability: 'image', model: 'stable-image-core',
      label: 'Stable Image Core', description: 'Fast, affordable. Best for photorealistic lifestyle imagery.',
      costUnitsPerCall: 3, configured: isVendorConfigured('stability') },
    { vendor: 'stability', vendorLabel: 'Stability AI', capability: 'image', model: 'stable-image-ultra',
      label: 'Stable Image Ultra', description: 'Highest quality Stability model. Slower but exceptional detail.',
      costUnitsPerCall: 5, configured: isVendorConfigured('stability') },
    { vendor: 'openai', vendorLabel: 'OpenAI', capability: 'image', model: 'dall-e-3',
      label: 'DALL-E 3', description: 'Excellent prompt adherence. Strong for conceptual and editorial imagery.',
      costUnitsPerCall: 4, configured: isVendorConfigured('openai') },
    { vendor: 'openai', vendorLabel: 'OpenAI', capability: 'image', model: 'gpt-image-1',
      label: 'GPT Image 1', description: 'OpenAI\'s newest image model with improved instruction following.',
      costUnitsPerCall: 4, configured: isVendorConfigured('openai') },
    { vendor: 'ideogram', vendorLabel: 'Ideogram', capability: 'image', model: 'V_2',
      label: 'Ideogram V2', description: 'Best-in-class for text-in-image and graphic design assets.',
      costUnitsPerCall: 3, configured: isVendorConfigured('ideogram') },
    { vendor: 'ideogram', vendorLabel: 'Ideogram', capability: 'image', model: 'V_2_TURBO',
      label: 'Ideogram V2 Turbo', description: 'Fast version of V2. Great for iteration and variant generation.',
      costUnitsPerCall: 2, configured: isVendorConfigured('ideogram') },

    // ── VIDEO ─────────────────────────────────────────────────────────────────
    { vendor: 'runway', vendorLabel: 'Runway', capability: 'video', model: 'gen4_turbo',
      label: 'Gen-4 Turbo', description: 'Runway\'s latest model. Photorealistic motion, supports image-to-video.',
      costUnitsPerCall: 25, configured: isVendorConfigured('runway') },
    { vendor: 'runway', vendorLabel: 'Runway', capability: 'video', model: 'gen3a_turbo',
      label: 'Gen-3 Alpha Turbo', description: 'Faster generation at lower cost. Good for storyboard-style reels.',
      costUnitsPerCall: 15, configured: isVendorConfigured('runway') },
    { vendor: 'luma', vendorLabel: 'Luma AI', capability: 'video', model: 'ray-2',
      label: 'Ray 2', description: 'Luma\'s flagship — cinematic quality, smooth motion, strong on camera movement.',
      costUnitsPerCall: 25, configured: isVendorConfigured('luma') },
    { vendor: 'luma', vendorLabel: 'Luma AI', capability: 'video', model: 'ray-flash-2',
      label: 'Ray Flash 2', description: 'Fast and cost-effective. Great for quick social media video drafts.',
      costUnitsPerCall: 10, configured: isVendorConfigured('luma') },

    // ── AUDIO ─────────────────────────────────────────────────────────────────
    { vendor: 'elevenlabs', vendorLabel: 'ElevenLabs', capability: 'audio', model: 'eleven_multilingual_v2',
      label: 'Multilingual v2', description: 'ElevenLabs flagship — most natural-sounding voices, 29 languages.',
      costUnitsPerCall: 2, configured: isVendorConfigured('elevenlabs') },
    { vendor: 'elevenlabs', vendorLabel: 'ElevenLabs', capability: 'audio', model: 'eleven_turbo_v2_5',
      label: 'Turbo v2.5', description: 'Ultra-low latency. Great for quick voiceover drafts and previews.',
      costUnitsPerCall: 1, configured: isVendorConfigured('elevenlabs') },
    { vendor: 'openai-tts', vendorLabel: 'OpenAI', capability: 'audio', model: 'tts-1-hd',
      label: 'TTS-1 HD', description: 'OpenAI high-fidelity TTS. 6 voices, simple and reliable.',
      costUnitsPerCall: 2, configured: isVendorConfigured('openai-tts') },
    { vendor: 'openai-tts', vendorLabel: 'OpenAI', capability: 'audio', model: 'tts-1',
      label: 'TTS-1', description: 'OpenAI standard TTS. Faster and cheaper for voiceover prototyping.',
      costUnitsPerCall: 1, configured: isVendorConfigured('openai-tts') },

    // ── OPENROUTER (FREE) ─────────────────────────────────────────────────────
    ...OPENROUTER_FREE_MODELS.map(m => ({
      vendor: 'openrouter', vendorLabel: 'OpenRouter (Free)', capability: 'text' as const, model: m,
      label: m.split('/')[1]?.replace(/:free$/, '') ?? m,
      description: 'Free model via OpenRouter. No usage costs — ideal for high-volume tasks.',
      costUnitsPerCall: 0, configured: isVendorConfigured('openrouter'),
    })),

    // ── OPENROUTER (PAID) ─────────────────────────────────────────────────────
    ...OPENROUTER_PAID_MODELS.map(m => ({
      vendor: 'openrouter', vendorLabel: 'OpenRouter', capability: 'text' as const, model: m,
      label: m.split('/')[1] ?? m,
      description: 'Paid model via OpenRouter. One OPENROUTER_API_KEY, billed per-token.',
      costUnitsPerCall: 2, configured: isVendorConfigured('openrouter'),
    })),
  ];
}

/**
 * Resolve a provider instance for a (capability, vendor, model) triple.
 * Called by the orchestrator worker. Throws visibly if not configured.
 */
export function resolveProvider(
  capability: Capability,
  vendor?: string,
  _model?: string, // model is passed through to GenerationRequest.model, not used for routing
): GenerationProvider {
  const candidates = ALL_PROVIDERS.filter(
    (p) =>
      p.capabilities.includes(capability) &&
      (!vendor || p.vendor === vendor),
  );
  const configured = candidates.find((p) => isVendorConfigured(p.vendor));
  if (!configured) {
    throw new ProviderNotConfiguredError(
      vendor ?? candidates[0]?.vendor ?? 'unknown',
      capability,
    );
  }
  return configured;
}

/**
 * Resolve a provider + model for a named task using the platform's task routing config.
 * `taskRouting` comes from `platform_settings.llm_task_routing` (nullable).
 * Falls back to DEFAULT_TASK_ROUTING when unset.
 */
export function resolveTaskProvider(
  task: LlmTask,
  taskRouting?: Record<string, { vendor: string; model: string }> | null,
): { provider: GenerationProvider; model: string } {
  const route = taskRouting?.[task] ?? DEFAULT_TASK_ROUTING[task];
  const provider = resolveProvider('text', route.vendor, route.model);
  return { provider, model: route.model };
}
