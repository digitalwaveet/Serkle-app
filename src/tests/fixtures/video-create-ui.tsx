import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import CreateVideo from '@/pages/CreateVideo';
import { NavigationProvider } from '@/contexts/NavigationContext';
import '@/index.css';

declare global {
  interface Window {
    videoCreateFixture: { calls: number };
  }
}

window.videoCreateFixture = { calls: 0 };

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/create/video']}>
    <NavigationProvider><CreateVideo /></NavigationProvider>
  </MemoryRouter>,
);
