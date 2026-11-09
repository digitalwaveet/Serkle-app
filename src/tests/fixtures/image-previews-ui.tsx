import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { OriginalImageDownload } from '@/components/ui/OriginalImageDownload';
import MediaGroupMosaic from '@/components/messages/MediaGroupMosaic';
import { uploadImageWithPreviews } from '@/lib/imageStorage';
import { encodeImagePreviews } from '@/lib/imagePreviewCodec';
import '@/components/messages/messages.css';
import '@/index.css';

const owner = '00000000-0000-4000-8000-000000000001';
const operation = '20000000-0000-4000-8000-000000000001';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function App() {
  const [src, setSrc] = useState(''), [status, setStatus] = useState('Choose image');
  const [size, setSize] = useState<'thumb' | 'display' | 'full'>('display');
  const upload = async (file: File) => {
    setStatus('Uploading');
    try { setSrc(await uploadImageWithPreviews('post-media', owner, file, operation)); setStatus('Uploaded'); }
    catch { setStatus('Upload failed'); }
  };
  (window as any).imageFixture = { upload, setSrc, setSize, queryClient, encode: encodeImagePreviews };
  return <main className="msg-ui p-4 max-w-xl mx-auto">
    <label>Choose image<input aria-label="Choose image" type="file" onChange={e => { if (e.target.files?.[0]) void upload(e.target.files[0]); }} /></label>
    <p role="status">{status}</p>
    {src && <>
      <section aria-label="Image preview"><OptimizedImage src={src} alt="Uploaded photograph" loading="eager" size={size} className="rounded-xl" /></section>
      <OriginalImageDownload src={src} />
      <section aria-label="Gallery" className="mt-4"><MediaGroupMosaic items={[0, 1, 2].map(n => ({ id: String(n), type: 'photo' as const, url: src }))} isOwn timestamp="10:30" onOpenLightbox={() => setSize('full')} /></section>
    </>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>);
