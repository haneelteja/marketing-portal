'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Stage = 'concept' | 'image' | 'video' | 'audio';
type JobStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
type Capability = 'text' | 'image' | 'video' | 'audio';

interface Campaign { id: string; name: string }
interface Concept { id: string; title: string; core_message: string; suggested_format: string; status: string }
interface Asset { id: string; source_url: string; status: string; type: string }
interface ModelDescriptor {
  vendor: string; vendorLabel: string; capability: Capability;
  model: string; label: string; description: string; costUnitsPerCall: number; configured: boolean;
}
interface ModelPref { capability: Capability; vendor: string; model: string }

const STAGE_TO_CAPABILITY: Record<Stage, Capability> = {
  concept: 'text', image: 'image', video: 'video', audio: 'audio',
};

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function GenerateClient({
  clientSlug,
  initialConceptId,
  initialStage,
}: {
  clientSlug: string;
  initialConceptId?: string;
  initialStage?: Stage;
}) {
  // Stage
  const [stage, setStage] = useState<Stage>(initialStage ?? 'concept');

  // Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [objective, setObjective] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [tone, setTone] = useState('');

  // Model selection
  const [catalog, setCatalog] = useState<ModelDescriptor[]>([]);
  const [modelPrefs, setModelPrefs] = useState<Record<Capability, { vendor: string; model: string } | null>>({
    text: null, image: null, video: null, audio: null,
  });

  // Job status — one per stage (concept uses the global jobStatus for simplicity)
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [jobError, setJobError] = useState<string | null>(null);

  // Per-stage job IDs to support per-stage Realtime subscriptions + retries
  const [lockedConceptJobId, setLockedConceptJobId] = useState<string | null>(null);
  const [imageJobId, setImageJobId] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [audioJobId, setAudioJobId] = useState<string | null>(null);

  // Per-stage regeneration status (independent of the global concept jobStatus)
  const [imageStatus, setImageStatus] = useState<JobStatus>('idle');
  const [imageError, setImageError] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<JobStatus>('idle');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<JobStatus>('idle');
  const [audioError, setAudioError] = useState<string | null>(null);

  // Results
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [lockedConcept, setLockedConcept] = useState<Concept | null>(null);
  const [images, setImages] = useState<Asset[]>([]);
  const [videos, setVideos] = useState<Asset[]>([]);
  const [audios, setAudios] = useState<Asset[]>([]);

  // Audio-specific
  const [audioScript, setAudioScript] = useState('');

  const selectedCampaignRef = useRef(selectedCampaign);
  useEffect(() => { selectedCampaignRef.current = selectedCampaign; }, [selectedCampaign]);

  // Active Realtime channel refs for cleanup
  const conceptChannelRef = useRef<ReturnType<ReturnType<typeof createSupabase>['channel']> | null>(null);
  const imageChannelRef = useRef<ReturnType<ReturnType<typeof createSupabase>['channel']> | null>(null);
  const videoChannelRef = useRef<ReturnType<ReturnType<typeof createSupabase>['channel']> | null>(null);
  const audioChannelRef = useRef<ReturnType<ReturnType<typeof createSupabase>['channel']> | null>(null);

  // Supabase browser client (stable across renders)
  const supabaseRef = useRef(createSupabase());

  // Cleanup all subscriptions on unmount
  useEffect(() => {
    const supabase = supabaseRef.current;
    return () => {
      if (conceptChannelRef.current) supabase.removeChannel(conceptChannelRef.current);
      if (imageChannelRef.current) supabase.removeChannel(imageChannelRef.current);
      if (videoChannelRef.current) supabase.removeChannel(videoChannelRef.current);
      if (audioChannelRef.current) supabase.removeChannel(audioChannelRef.current);
    };
  }, []);

  // Load catalog + preferences + campaigns
  useEffect(() => {
    fetch('/api/providers/catalog').then(r => r.json()).then((d: ModelDescriptor[]) => {
      if (Array.isArray(d)) setCatalog(d);
    }).catch(() => {});
    fetch('/api/model-preferences').then(r => r.json()).then((d: ModelPref[]) => {
      if (Array.isArray(d)) {
        const map: Record<Capability, { vendor: string; model: string } | null> = { text: null, image: null, video: null, audio: null };
        for (const p of d) map[p.capability] = { vendor: p.vendor, model: p.model };
        setModelPrefs(map);
      }
    }).catch(() => {});
    fetch('/api/campaigns').then(r => r.json()).then((d: Campaign[]) => {
      if (Array.isArray(d)) setCampaigns(d);
    }).catch(() => {});
  }, []);

  // Load initial concept
  useEffect(() => {
    if (!initialConceptId) return;
    fetch(`/api/concepts/${initialConceptId}`).then(r => r.json()).then((d: Concept & { id: string }) => {
      if (d?.id) { setLockedConcept(d); setStage(initialStage === 'video' ? 'video' : initialStage === 'audio' ? 'audio' : 'image'); }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Core result-processing function. Handles both concept text results and
   * asset results for image/video/audio. Called from the Realtime handler.
   * Returns the asset for further processing if needed.
   */
  const processJobResult = useCallback(async (
    jobData: { status: string; result_asset_id?: string | null; error_message?: string | null },
    capability: Capability,
    appendResult: boolean = true,
  ) => {
    if (jobData.status === 'succeeded') {
      if (capability === 'text' && selectedCampaignRef.current) {
        const r = await fetch(`/api/concepts?campaign_id=${selectedCampaignRef.current}`);
        const cs = await r.json() as Concept[];
        if (Array.isArray(cs)) setConcepts(cs.slice(0, 4));
      } else if (jobData.result_asset_id) {
        const r = await fetch(`/api/assets/${jobData.result_asset_id}`);
        const asset = await r.json() as Asset;
        if (appendResult) {
          if (asset?.type === 'image') setImages(prev => [...prev, asset]);
          else if (asset?.type === 'video') setVideos(prev => [...prev, asset]);
          else if (asset?.type === 'audio') setAudios(prev => [...prev, asset]);
        }
      }
    }
  }, []);

  /**
   * Subscribe to Realtime updates for a specific job.
   * Calls onSucceeded / onFailed when the job reaches a terminal state.
   * Returns the channel so the caller can store it for cleanup.
   */
  const subscribeToJob = useCallback((
    jobId: string,
    capability: Capability,
    onSucceeded: (jobData: { status: string; result_asset_id?: string | null; error_message?: string | null }) => void,
    onFailed: (msg: string) => void,
  ) => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generation_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const job = payload.new as { status: string; result_asset_id?: string | null; error_message?: string | null };
          if (job.status === 'succeeded') {
            onSucceeded(job);
          } else if (job.status === 'failed') {
            onFailed(job.error_message ?? 'Generation failed');
          }
        },
      )
      .subscribe();
    return channel;
  }, []);

  /**
   * One-shot fetch of a job's current state (catches already-complete jobs).
   * Returns true if the job was already terminal so the caller can skip subscribing.
   */
  const fetchJobOnce = useCallback(async (
    jobId: string,
    capability: Capability,
    onSucceeded: (jobData: { status: string; result_asset_id?: string | null; error_message?: string | null }) => void,
    onFailed: (msg: string) => void,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const data = await res.json() as { status: string; result_asset_id?: string | null; error_message?: string | null };
      if (data.status === 'succeeded') { onSucceeded(data); return true; }
      if (data.status === 'failed') { onFailed(data.error_message ?? 'Generation failed'); return true; }
    } catch { /* network hiccup — fall through to Realtime */ }
    return false;
  }, []);

  async function saveModelPref(capability: Capability, vendor: string, model: string) {
    setModelPrefs(prev => ({ ...prev, [capability]: { vendor, model } }));
    await fetch('/api/model-preferences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability, vendor, model }),
    });
  }

  /**
   * Starts a generation job and wires up Realtime + one-shot fetch.
   * For concept (text) stage updates global jobStatus.
   * For image/video/audio updates the per-stage status.
   */
  async function startGeneration(capability: Capability, extraBody: object): Promise<string | null> {
    const isConceptStage = capability === 'text';
    const setStatus = isConceptStage ? setJobStatus : (capability === 'image' ? setImageStatus : capability === 'video' ? setVideoStatus : setAudioStatus);
    const setError = isConceptStage ? setJobError : (capability === 'image' ? setImageError : capability === 'video' ? setVideoError : setAudioError);

    setStatus('queued'); setError(null);
    if (isConceptStage) setJobStatus('queued');

    const pref = modelPrefs[capability];
    const res = await fetch('/api/generation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability, vendor: pref?.vendor, model: pref?.model, ...extraBody }),
    });
    const data = await res.json() as { jobId?: string; error?: string };
    if (!res.ok || !data.jobId) {
      setStatus('failed'); setError(data.error ?? 'Failed to start job');
      return null;
    }
    setStatus('running');

    const jobId = data.jobId;

    const onSucceeded = async (jobData: { status: string; result_asset_id?: string | null; error_message?: string | null }) => {
      setStatus('succeeded');
      await processJobResult(jobData, capability);
    };
    const onFailed = (msg: string) => {
      setStatus('failed'); setError(msg);
    };

    // Immediately fetch current state — catches already-complete jobs
    const alreadyDone = await fetchJobOnce(jobId, capability, onSucceeded, onFailed);
    if (!alreadyDone) {
      // Remove any prior subscription for this capability before adding the new one
      const supabase = supabaseRef.current;
      if (capability === 'text' && conceptChannelRef.current) supabase.removeChannel(conceptChannelRef.current);
      if (capability === 'image' && imageChannelRef.current) supabase.removeChannel(imageChannelRef.current);
      if (capability === 'video' && videoChannelRef.current) supabase.removeChannel(videoChannelRef.current);
      if (capability === 'audio' && audioChannelRef.current) supabase.removeChannel(audioChannelRef.current);

      const channel = subscribeToJob(jobId, capability, onSucceeded, onFailed);

      if (capability === 'text') conceptChannelRef.current = channel;
      else if (capability === 'image') imageChannelRef.current = channel;
      else if (capability === 'video') videoChannelRef.current = channel;
      else if (capability === 'audio') audioChannelRef.current = channel;
    }

    return jobId;
  }

  async function generateConcepts() {
    if (!selectedCampaign) { alert('Select a campaign first'); return; }
    const jobId = await startGeneration('text', { brief: { campaignId: selectedCampaign, objective, platform }, constraints: { platform, tone: tone || undefined } });
    if (jobId) setLockedConceptJobId(jobId);
  }
  async function generateImages() {
    if (!lockedConcept) return;
    const jobId = await startGeneration('image', { conceptId: lockedConcept.id, brief: { campaignId: selectedCampaign, objective: lockedConcept.core_message, platform, lockedConcept: { title: lockedConcept.title, coreMessage: lockedConcept.core_message } }, constraints: { platform } });
    if (jobId) setImageJobId(jobId);
  }
  async function generateVideo() {
    if (!lockedConcept) return;
    const jobId = await startGeneration('video', { conceptId: lockedConcept.id, brief: { campaignId: selectedCampaign, objective: lockedConcept.core_message, platform, lockedConcept: { title: lockedConcept.title, coreMessage: lockedConcept.core_message } }, constraints: { platform } });
    if (jobId) setVideoJobId(jobId);
  }
  async function generateAudio() {
    if (!lockedConcept) return;
    const jobId = await startGeneration('audio', { conceptId: lockedConcept.id, brief: { campaignId: selectedCampaign, objective: audioScript || lockedConcept.core_message, platform, lockedConcept: { title: lockedConcept.title, coreMessage: lockedConcept.core_message } } });
    if (jobId) setAudioJobId(jobId);
  }

  /**
   * Calls POST /api/generation/[originalJobId]/retry and subscribes to the new job.
   * Does NOT clear other stages. Appends new results alongside existing ones.
   */
  async function retryStage(
    originalJobId: string,
    capability: 'image' | 'video' | 'audio',
  ) {
    const setStatus = capability === 'image' ? setImageStatus : capability === 'video' ? setVideoStatus : setAudioStatus;
    const setError = capability === 'image' ? setImageError : capability === 'video' ? setVideoError : setAudioError;
    const setJobIdForStage = capability === 'image' ? setImageJobId : capability === 'video' ? setVideoJobId : setAudioJobId;

    setStatus('queued'); setError(null);

    const res = await fetch(`/api/generation/${originalJobId}/retry`, { method: 'POST' });
    const data = await res.json() as { jobId?: string; error?: string };
    if (!res.ok || !data.jobId) {
      setStatus('failed'); setError(data.error ?? 'Failed to start retry');
      return;
    }
    const newJobId = data.jobId;
    setJobIdForStage(newJobId);
    setStatus('running');

    const onSucceeded = async (jobData: { status: string; result_asset_id?: string | null; error_message?: string | null }) => {
      setStatus('succeeded');
      // Append — does NOT clear other stages' results
      await processJobResult(jobData, capability, true);
    };
    const onFailed = (msg: string) => {
      setStatus('failed'); setError(msg);
    };

    const alreadyDone = await fetchJobOnce(newJobId, capability, onSucceeded, onFailed);
    if (!alreadyDone) {
      const supabase = supabaseRef.current;
      if (capability === 'image' && imageChannelRef.current) supabase.removeChannel(imageChannelRef.current);
      if (capability === 'video' && videoChannelRef.current) supabase.removeChannel(videoChannelRef.current);
      if (capability === 'audio' && audioChannelRef.current) supabase.removeChannel(audioChannelRef.current);

      const channel = subscribeToJob(newJobId, capability, onSucceeded, onFailed);
      if (capability === 'image') imageChannelRef.current = channel;
      else if (capability === 'video') videoChannelRef.current = channel;
      else if (capability === 'audio') audioChannelRef.current = channel;
    }
  }

  async function lockConcept(concept: Concept) {
    await fetch(`/api/concepts/${concept.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'locked' }) });
    setLockedConcept(concept); setJobStatus('idle'); setStage('image');
  }

  async function approveAsset(assetId: string, type: 'image' | 'video' | 'audio') {
    await fetch('/api/approvals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target_type: 'concept_asset', target_id: assetId }) });
    const mark = (prev: Asset[]) => prev.map(a => a.id === assetId ? { ...a, status: 'pending_approval' } : a);
    if (type === 'image') setImages(mark);
    else if (type === 'video') setVideos(mark);
    else setAudios(mark);
  }

  const isGenerating = jobStatus === 'queued' || jobStatus === 'running';
  const isImageGenerating = imageStatus === 'queued' || imageStatus === 'running';
  const isVideoGenerating = videoStatus === 'queued' || videoStatus === 'running';
  const isAudioGenerating = audioStatus === 'queued' || audioStatus === 'running';

  const currentCapability = STAGE_TO_CAPABILITY[stage];
  const catalogForStage = catalog.filter(d => d.capability === currentCapability);
  const currentPref = modelPrefs[currentCapability];

  const STAGES: { key: Stage; label: string; requires: boolean }[] = [
    { key: 'concept', label: '1. Concepts', requires: false },
    { key: 'image', label: '2. Images', requires: true },
    { key: 'video', label: '3. Video', requires: true },
    { key: 'audio', label: '4. Audio', requires: true },
  ];

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-[var(--brand-ink)]">Generate content</h1>
      <p className="mb-6 text-sm text-black/50">
        AI-powered concept, image, video, and audio generation grounded in your brand profile.
      </p>

      {/* Stage tabs */}
      <div className="mb-4 flex w-fit overflow-hidden rounded-[var(--brand-radius)] border border-black/10">
        {STAGES.map(s => {
          const locked = s.requires && !lockedConcept;
          return (
            <button key={s.key} onClick={() => { if (locked) return; setStage(s.key); setJobError(null); }}
              className={['px-5 py-2 text-sm font-medium transition-colors',
                stage === s.key ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-[var(--brand-ink)] hover:bg-black/5',
                locked ? 'cursor-not-allowed opacity-40' : ''].join(' ')}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Model selector bar */}
      {catalogForStage.length > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-[var(--brand-radius)] border border-black/10 bg-white px-4 py-3">
          <span className="text-xs font-medium text-black/50 shrink-0">Model:</span>
          <select
            value={currentPref ? `${currentPref.vendor}::${currentPref.model}` : ''}
            onChange={e => {
              const [v, m] = e.target.value.split('::');
              saveModelPref(currentCapability, v, m);
            }}
            className="text-sm border border-black/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          >
            <option value="">— use platform default —</option>
            {catalogForStage.map(d => (
              <option key={`${d.vendor}::${d.model}`} value={`${d.vendor}::${d.model}`} disabled={!d.configured}>
                {d.vendorLabel} · {d.label} ({d.costUnitsPerCall} units){!d.configured ? ' — needs API key' : ''}
              </option>
            ))}
          </select>
          {currentPref && (
            <span className="text-xs text-[var(--brand-primary)]">
              {catalogForStage.find(d => d.vendor === currentPref.vendor && d.model === currentPref.model)?.description ?? ''}
            </span>
          )}
        </div>
      )}

      {/* ── Stage 1: Concept generation ── */}
      {stage === 'concept' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-6">
            <h2 className="mb-4 font-semibold">Brief</h2>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Campaign
                <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]">
                  <option value="">Select a campaign…</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Objective
                <textarea value={objective} onChange={e => setObjective(e.target.value)} rows={3}
                  placeholder="Describe the goal of this content…"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-none" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Target platform
                <select value={platform} onChange={e => setPlatform(e.target.value)}
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none">
                  {['instagram','facebook','youtube','linkedin'].map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Tone override <span className="font-normal text-black/40">(optional)</span>
                <input value={tone} onChange={e => setTone(e.target.value)} placeholder="e.g. playful, urgent…"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]" />
              </label>
              <button onClick={generateConcepts} disabled={isGenerating || !selectedCampaign}
                className="flex items-center justify-center gap-2 rounded-[var(--brand-radius)] bg-[var(--brand-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
                {isGenerating ? <><Spinner />Generating…</> : 'Generate concept options'}
              </button>
              {jobStatus === 'failed' && <p className="text-sm text-red-600">{jobError}</p>}
            </div>
          </div>
          <div>
            <h2 className="mb-4 font-semibold">Concept options</h2>
            {isGenerating && <InfoBanner color="primary">Generating — typically 10–30 seconds…</InfoBanner>}
            {!isGenerating && concepts.length === 0 && (
              <EmptyState>Fill in the brief and generate to see AI-powered concept options.</EmptyState>
            )}
            <div className="flex flex-col gap-3">
              {concepts.map(c => (
                <div key={c.id} className={`rounded-[var(--brand-radius)] border p-4 transition-all ${lockedConcept?.id === c.id ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5' : 'border-black/10 bg-white hover:border-[var(--brand-primary)]/50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{c.title}</p>
                      <p className="mt-1 text-sm text-black/60">{c.core_message}</p>
                      {c.suggested_format && <p className="mt-0.5 text-xs text-black/40">Format: {c.suggested_format}</p>}
                    </div>
                    {lockedConcept?.id === c.id
                      ? <span className="shrink-0 text-xs font-medium text-[var(--brand-primary)]">✓ Locked</span>
                      : <button onClick={() => lockConcept(c)}
                          className="shrink-0 rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10">
                          Use this
                        </button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Stage 2: Image generation ── */}
      {stage === 'image' && (
        <div>
          <LockedConceptBanner concept={lockedConcept} />
          <div className="mb-4 flex items-center gap-3">
            <button onClick={generateImages} disabled={isImageGenerating}
              className="flex items-center gap-2 rounded-[var(--brand-radius)] bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
              {isImageGenerating ? <><Spinner />Generating images…</> : 'Generate image variants'}
            </button>
            {imageJobId && !isImageGenerating && (
              <button
                onClick={() => retryStage(imageJobId, 'image')}
                className="flex items-center gap-1.5 rounded-[var(--brand-radius)] border border-[var(--brand-primary)] px-4 py-2.5 text-sm font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10 transition-colors">
                Regenerate images
              </button>
            )}
          </div>
          {imageStatus === 'failed' && <p className="mb-3 text-sm text-red-600">{imageError}</p>}
          {isImageGenerating && <InfoBanner color="primary">Generating images — typically 15–30 seconds…</InfoBanner>}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map(img => (
              <div key={img.id} className="group relative overflow-hidden rounded-[var(--brand-radius)] border border-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.source_url} alt="" className="aspect-square w-full object-cover" />
                <div className="absolute inset-0 flex flex-col items-center justify-end gap-1 bg-black/40 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <StatusBadge status={img.status} />
                  {img.status === 'draft' && (
                    <button onClick={() => approveAsset(img.id, 'image')}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--brand-primary)] hover:bg-white/90">
                      Request approval
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!images.length && !isImageGenerating && <EmptyState className="col-span-3">Click Generate to create image variants from the locked concept.</EmptyState>}
          </div>
        </div>
      )}

      {/* ── Stage 3: Video generation ── */}
      {stage === 'video' && (
        <div>
          <LockedConceptBanner concept={lockedConcept} />
          <div className="mb-4 flex items-center gap-3">
            <button onClick={generateVideo} disabled={isVideoGenerating}
              className="flex items-center gap-2 rounded-[var(--brand-radius)] bg-[var(--brand-secondary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
              {isVideoGenerating ? <><Spinner />Generating video…</> : 'Generate video reel'}
            </button>
            {videoJobId && !isVideoGenerating && (
              <button
                onClick={() => retryStage(videoJobId, 'video')}
                className="flex items-center gap-1.5 rounded-[var(--brand-radius)] border border-[var(--brand-secondary)] px-4 py-2.5 text-sm font-medium text-[var(--brand-secondary)] hover:bg-[var(--brand-secondary)]/10 transition-colors">
                Regenerate video
              </button>
            )}
          </div>
          {videoStatus === 'failed' && <p className="mb-3 text-sm text-red-600">{videoError}</p>}
          {isVideoGenerating && <InfoBanner color="secondary">Generating video — this can take 1–3 minutes…</InfoBanner>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {videos.map(vid => (
              <div key={vid.id} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-4">
                <video src={vid.source_url} controls className="mb-2 w-full aspect-video rounded-lg object-cover" />
                <div className="flex items-center justify-between">
                  <StatusBadge status={vid.status} />
                  {vid.status === 'draft' && (
                    <button onClick={() => approveAsset(vid.id, 'video')} className="text-xs text-[var(--brand-primary)] underline hover:no-underline">Request approval</button>
                  )}
                </div>
              </div>
            ))}
            {!videos.length && !isVideoGenerating && <EmptyState className="sm:col-span-2">Click Generate to create a video reel from the locked concept.</EmptyState>}
          </div>
        </div>
      )}

      {/* ── Stage 4: Audio generation ── */}
      {stage === 'audio' && (
        <div>
          <LockedConceptBanner concept={lockedConcept} />
          <div className="mb-4 rounded-[var(--brand-radius)] border border-black/10 bg-white p-5">
            <h2 className="mb-3 font-semibold">Voiceover script</h2>
            <p className="mb-3 text-sm text-black/50">
              Optionally write or edit the voiceover script. Leave blank to have the AI generate one from the locked concept.
            </p>
            <textarea value={audioScript} onChange={e => setAudioScript(e.target.value)} rows={5}
              placeholder={`The AI will generate a voiceover script based on: "${lockedConcept?.core_message}"…`}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] resize-y" />
          </div>
          <div className="mb-4 flex items-center gap-3">
            <button onClick={generateAudio} disabled={isAudioGenerating}
              className="flex items-center gap-2 rounded-[var(--brand-radius)] bg-[var(--brand-accent)] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-40">
              {isAudioGenerating ? <><Spinner />Generating audio…</> : 'Generate voiceover'}
            </button>
            {audioJobId && !isAudioGenerating && (
              <button
                onClick={() => retryStage(audioJobId, 'audio')}
                className="flex items-center gap-1.5 rounded-[var(--brand-radius)] border border-black/20 px-4 py-2.5 text-sm font-medium text-[var(--brand-ink)] hover:bg-black/5 transition-colors">
                Regenerate audio
              </button>
            )}
          </div>
          {audioStatus === 'failed' && <p className="mb-3 text-sm text-red-600">{audioError}</p>}
          {isAudioGenerating && <InfoBanner color="accent">Generating audio — typically 10–20 seconds…</InfoBanner>}
          <div className="flex flex-col gap-3">
            {audios.map(aud => (
              <div key={aud.id} className="rounded-[var(--brand-radius)] border border-black/10 bg-white p-4">
                <audio src={aud.source_url} controls className="mb-2 w-full" />
                <div className="flex items-center justify-between">
                  <StatusBadge status={aud.status} />
                  {aud.status === 'draft' && (
                    <button onClick={() => approveAsset(aud.id, 'audio')} className="text-xs text-[var(--brand-primary)] underline hover:no-underline">Request approval</button>
                  )}
                </div>
              </div>
            ))}
            {!audios.length && !isAudioGenerating && <EmptyState>Click Generate to create a voiceover from the locked concept.</EmptyState>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function InfoBanner({ children, color }: { children: React.ReactNode; color: 'primary' | 'secondary' | 'accent' }) {
  const cls = {
    primary: 'border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 text-[var(--brand-primary)]',
    secondary: 'border-[var(--brand-secondary)]/20 bg-[var(--brand-secondary)]/5 text-[var(--brand-secondary)]',
    accent: 'border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/10 text-[var(--brand-ink)]',
  }[color];
  return <div className={`mb-4 flex items-center gap-3 rounded-[var(--brand-radius)] border p-4 text-sm ${cls}`}><Spinner />{children}</div>;
}

function EmptyState({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[var(--brand-radius)] border border-dashed border-black/20 p-8 text-center text-sm text-black/40 ${className}`}>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    pending_approval: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100'}`}>{status}</span>;
}

function LockedConceptBanner({ concept }: { concept: Concept | null }) {
  if (!concept) return null;
  return (
    <div className="mb-4 rounded-[var(--brand-radius)] border border-[var(--brand-primary)]/20 bg-[var(--brand-primary)]/5 p-4">
      <p className="text-sm font-semibold text-[var(--brand-primary)]">Locked concept: {concept.title}</p>
      <p className="text-xs text-black/60 mt-0.5">{concept.core_message}</p>
    </div>
  );
}
