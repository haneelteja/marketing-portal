import type { BrandContext, PlatformConstraints } from '../providers/generation/types';

export interface CampaignBrief {
  objective: string;
  audienceOverride?: string;
  toneOverride?: string;
  conceptCount?: number;
  lockedConcept?: { title: string; coreMessage: string };
}

/**
 * Single place every generation prompt is assembled (spec §8.2) — brand voice,
 * palette, audience, and platform constraints are never duplicated per generation type.
 * The returned string is persisted verbatim (concepts.generated_from_prompt /
 * concept_assets.prompt_used) so every stage is inspectable and re-runnable (§1.3).
 */
export class PromptContextBuilder {
  constructor(
    private readonly brand: BrandContext,
    private readonly constraints?: PlatformConstraints,
  ) {}

  private brandBlock(toneOverride?: string, audienceOverride?: string): string {
    const palette = Object.entries(this.brand.colorPalette)
      .map(([k, v]) => `${k}: ${v}`).join(', ');
    return [
      '## Brand context',
      this.brand.brandVoice && `Brand voice: ${this.brand.brandVoice}`,
      `Tone: ${toneOverride ?? this.brand.toneGuidelines ?? 'professional, warm'}`,
      `Target audience: ${audienceOverride ?? this.brand.targetAudience ?? 'general consumers'}`,
      palette && `Color palette: ${palette}`,
    ].filter(Boolean).join('\n');
  }

  private platformBlock(): string {
    if (!this.constraints) return '';
    const c = this.constraints;
    return [
      '## Platform constraints',
      `Platform: ${c.platform}`,
      c.aspectRatio && `Aspect ratio: ${c.aspectRatio}`,
      c.maxCaptionLength && `Max caption length: ${c.maxCaptionLength} chars`,
      c.maxDurationSeconds && `Max duration: ${c.maxDurationSeconds}s`,
      c.hashtagConvention && `Hashtag convention: ${c.hashtagConvention}`,
    ].filter(Boolean).join('\n');
  }

  buildConceptPrompt(brief: CampaignBrief): string {
    return [
      `Generate ${brief.conceptCount ?? 4} distinct campaign concept options.`,
      `## Campaign objective\n${brief.objective}`,
      this.brandBlock(brief.toneOverride, brief.audienceOverride),
      this.platformBlock(),
      'Each concept must be clearly on-brand and feasible as social content.',
    ].join('\n\n');
  }

  buildImagePrompt(brief: CampaignBrief): string {
    const c = brief.lockedConcept;
    if (!c) throw new Error('Image generation requires a locked concept');
    const palette = Object.values(this.brand.colorPalette).join(', ');
    return [
      `Marketing visual for the concept "${c.title}": ${c.coreMessage}.`,
      palette && `Use brand colors: ${palette}.`,
      this.brand.toneGuidelines && `Visual mood: ${this.brand.toneGuidelines}.`,
      this.constraints?.aspectRatio && `Composition suited to ${this.constraints.aspectRatio}.`,
      'No text overlays, no watermarks, photographic quality.',
    ].filter(Boolean).join(' ');
  }

  buildVideoPrompt(brief: CampaignBrief): string {
    const c = brief.lockedConcept;
    if (!c) throw new Error('Video generation requires a locked concept');
    return [
      `Short-form vertical social video: "${c.title}" — ${c.coreMessage}.`,
      `Brand tone: ${this.brand.toneGuidelines ?? 'energetic, polished'}.`,
      `Target audience: ${this.brand.targetAudience ?? 'social media users'}.`,
      'Dynamic pacing suitable for the first 3 seconds to hook the viewer.',
    ].join(' ');
  }

  buildAudioPrompt(brief: CampaignBrief): string {
    const c = brief.lockedConcept;
    if (!c) throw new Error('Audio generation requires a locked concept');
    return [
      `Write a voiceover script for this marketing concept: "${c.title}".`,
      `Message: ${c.coreMessage}.`,
      `Brand voice: ${this.brand.brandVoice ?? 'professional, warm'}.`,
      `Tone: ${brief.toneOverride ?? this.brand.toneGuidelines ?? 'conversational and engaging'}.`,
      `Target audience: ${this.brand.targetAudience ?? 'general consumers'}.`,
      this.constraints?.maxDurationSeconds
        ? `Target duration: approximately ${this.constraints.maxDurationSeconds} seconds when read aloud.`
        : 'Target duration: 15–30 seconds when read aloud.',
      'Write only the script text that will be spoken. No stage directions, no headers.',
    ].filter(Boolean).join(' ');
  }
}
