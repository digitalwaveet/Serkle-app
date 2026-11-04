import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { StoryDialog } from './StoryDialog';

export function StoryReportDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string, details: string) => Promise<void> }) {
  const [reason, setReason] = useState('Spam');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const locked = useRef(false);
  return <StoryDialog title="Report story" className="story-insights" onClose={() => { if (!locked.current) onClose(); }}>
    <div className="story-insights-header"><h2>Report story</h2><button className="studio-icon" aria-label="Close report" disabled={sending} onClick={onClose}><X size={20} /></button></div>
    <form className="story-insights-scroll" onSubmit={async event => {
      event.preventDefault(); if (locked.current) return;
      locked.current = true; setSending(true); setError('');
      try { await onSubmit(reason, details.trim()); onClose(); }
      catch { setError('Your report was not submitted. Please try again.'); }
      finally { locked.current = false; setSending(false); }
    }}>
      <p className="text-sm text-neutral-500 my-5">Tell us what’s wrong so our team can review this story.</p>
      <label className="block text-sm font-semibold">Reason
        <select className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 mt-2" value={reason} onChange={event => setReason(event.target.value)} disabled={sending}>
          {['Spam', 'Inappropriate Content', 'Harassment or Bullying', 'Hate Speech', 'Other'].map(item => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold mt-5">Details (optional)
        <textarea className="block w-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 mt-2 font-normal" rows={4} maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} disabled={sending} />
      </label>
      {error && <p role="alert" className="story-error mt-4">{error}</p>}
      <button className="story-primary w-full mt-6" disabled={sending}>{sending ? 'Submitting…' : 'Submit report'}</button>
    </form>
  </StoryDialog>;
}
