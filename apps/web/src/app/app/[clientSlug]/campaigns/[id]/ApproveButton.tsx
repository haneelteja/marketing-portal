'use client';
import { useState } from 'react';

interface Props {
  conceptId: string;
}

export function ApproveButton({ conceptId }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleClick() {
    if (status === 'done') return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target_type: 'concept', target_id: conceptId }),
      });
      if (res.ok) {
        setStatus('done');
      } else {
        const d = await res.json();
        setErrorMsg(d.error ?? 'Failed to request approval');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Network error');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
        Approval requested
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="rounded-[var(--brand-radius)] border border-black/20 px-3 py-1.5 text-xs font-medium text-black/60 hover:bg-black/5 disabled:opacity-50"
      >
        {status === 'loading' ? 'Requesting…' : 'Request approval'}
      </button>
      {status === 'error' && <span className="text-xs text-red-500">{errorMsg}</span>}
    </div>
  );
}
