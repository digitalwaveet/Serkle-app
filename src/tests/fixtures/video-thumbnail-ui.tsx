import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import VideoThumbnailModal from '@/components/VideoThumbnailModal';
import '@/index.css';

export function Fixture() {
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    void fetch('/loading-animation.mp4')
      .then(response => response.blob())
      .then(blob => setFile(new File([blob], 'loading-animation.mp4', { type: blob.type || 'video/mp4' })));
  }, []);

  if (selected) return <main className="p-6"><p role="status">Thumbnail selected</p><img src={selected} alt="Selected thumbnail" /></main>;
  if (!file) return <p role="status">Preparing fixture</p>;
  return <>
    <button type="button" onClick={() => setOpen(true)}>Open selector</button>
    <VideoThumbnailModal
      isOpen={open}
      onClose={() => setOpen(false)}
      videoFile={file}
      onSelect={(_blob, url) => { setSelected(url); setOpen(false); }}
    />
  </>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
