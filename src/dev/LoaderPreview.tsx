// Standalone development preview. Not imported by the application or production entry.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SerkleLoader } from '@/components/ui/SerkleLoader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { VideoLoader, InlineVideoLoader } from '@/components/ui/VideoLoader';
import '@/index.css';

export function LoaderPreview() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [still, setStill] = useState(false);
  return <main className="min-h-screen bg-background text-foreground p-6 max-w-2xl mx-auto space-y-6">
    <header><p className="text-xs text-muted-foreground tracking-widest">SERKLE / MOTION</p><h1 className="text-2xl font-semibold mt-2">One familiar loading moment.</h1><p className="text-sm text-muted-foreground mt-2">Local preview — no files uploaded or network mutations.</p></header>
    <section className="rounded-2xl border border-border p-8 flex flex-col items-center gap-5">
      <SerkleLoader size="lg" label="Finding your next connection" showText pulse={!still} />
      <Button variant="ghost" onClick={() => setStill(!still)}>{still ? 'Resume motion' : 'Pause motion'}</Button>
    </section>
    <section className="rounded-2xl border border-border p-5 space-y-4">
      <h2 className="font-medium">File upload</h2>
      {state === 'loading' ? <><div className="flex items-center justify-between"><SerkleLoader size="sm" label="Uploading file" /><span className="text-sm">Uploading 64%</span></div><Progress value={64} aria-label="File upload progress" /></> : <p role="status" className={state === 'error' ? 'text-destructive' : 'text-green-700'}>{state === 'error' ? 'Upload failed. Your file is ready to retry.' : 'Upload complete.'}</p>}
      <div className="flex gap-2 flex-wrap"><Button size="sm" onClick={() => setState('success')}>Complete</Button><Button size="sm" variant="outline" onClick={() => setState('error')}>Fail</Button><Button size="sm" variant="outline" onClick={() => setState('loading')}>Retry</Button></div>
    </section>
    <section style={{ background: '#121212' }} className="rounded-2xl p-8 min-h-32 flex items-center justify-center"><VideoLoader dark size="md" label="Buffering video" /></section>
    <section className="flex items-center gap-3 flex-wrap"><Button disabled><InlineVideoLoader />Uploading</Button><Button variant="outline" disabled><SerkleLoader size="xs" className="text-current" />Fetching</Button><Button size="icon" disabled aria-label="Saving"><SerkleLoader size="xs" className="text-current" /></Button></section>
  </main>;
}

if (import.meta.env.DEV) {
  const previewRoot = createRoot(document.getElementById('root')!);
  previewRoot.render(<LoaderPreview />);
  import.meta.hot?.dispose(() => previewRoot.unmount());
}
