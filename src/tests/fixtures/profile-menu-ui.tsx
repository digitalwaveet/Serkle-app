import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter,useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import Header from '@/components/Header';
import PublicProfileModal from '@/components/PublicProfileModal';
import { StoryDialog } from '@/components/story/StoryDialog';
import '@/index.css';

function Fixture(){
  const location=useLocation();
  const [storyOpen, setStoryOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  if (localStorage.getItem('menu-state') === 'story-profile') {
    return <>
      <button type="button" onClick={() => setStoryOpen(true)}>Open story</button>
      {storyOpen && <StoryDialog title="Story preview" className="story-viewer" onClose={() => setStoryOpen(false)}>
        <div className="story-viewer-stage">
          <button type="button" onClick={() => setProfileOpen(true)}>Open author profile</button>
        </div>
        <PublicProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} userId="story-author" />
      </StoryDialog>}
    </>;
  }
  return <><Header/><main className="max-w-xl mx-auto p-6"><h1 className="text-xl font-semibold">Your Serkle feed</h1><p className="text-muted-foreground mt-2">Isolated profile menu preview with sample account data.</p><button className="mt-6 rounded-xl border p-3">Feed action</button><p data-testid="current-path" className="mt-8">{location.pathname}</p></main></>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><ThemeProvider><NavigationProvider><Fixture/></NavigationProvider></ThemeProvider></BrowserRouter>);
