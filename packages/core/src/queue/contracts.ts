/** Queue names + payload contracts shared by web (enqueuer) and services (workers). */
export const QUEUES = {
  GENERATE: 'generation.run',          // orchestrator
  PUBLISH: 'publish.run',              // publisher — fired at scheduled_at
  TOKEN_REFRESH: 'social.token-refresh',
  ANALYTICS_PULL: 'analytics.pull',
} as const;

export interface GenerateJobPayload {
  jobId: string;          // generation_jobs.id
  clientId: string;
  capability: 'text' | 'image' | 'video' | 'audio';
  vendor?: string;
  model?: string;         // specific model variant (e.g. "claude-opus-4-7", "tts-1-hd")
  reservedUnits: number;
  ledgerEntryId: string;
}

export interface PublishJobPayload {
  scheduledPostId: string;
  clientId: string;
}
