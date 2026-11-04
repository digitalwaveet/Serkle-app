import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationProvider } from '@/contexts/NavigationContext';
import CreateStoryModal from '@/components/CreateStoryModal';
import StoryEditor from '@/components/story/StoryEditor';
import StoryViewer from '@/components/StoryViewer';
import { StoryInsightsContent } from '@/components/StoryActivityModal';
import { Story } from '@/types/storyTypes';
import '@/index.css';

const canvas = document.createElement('canvas');
canvas.width = 1080; canvas.height = 1920;
const context = canvas.getContext('2d')!;
const gradient = context.createLinearGradient(0, 0, 1080, 1920);
gradient.addColorStop(0, '#e7cdb0'); gradient.addColorStop(.55, '#ac7955'); gradient.addColorStop(1, '#472b20');
context.fillStyle = gradient; context.fillRect(0, 0, 1080, 1920);
context.strokeStyle = '#ffffff30'; context.lineWidth = 2;
for (let radius = 100; radius < 1200; radius += 90) { context.beginPath(); context.arc(950, 300, radius, 0, Math.PI * 2); context.stroke(); }
const image = canvas.toDataURL('image/jpeg');
const story: Story = { id: 1, user: { id: 'qa-friend', name: 'Maya', initials: 'MA', avatarColor: '#a57250' }, image, mediaType: 'image', createdAt: new Date().toISOString(),
  story_state: { background: { type: 'image', value: image }, drawingPaths: [], elements: [
    { id: 'text', type: 'text', content: 'Little moments.\nCloser circles.', x: 50, y: 48, scale: 1, rotation: 0, zIndex: 1, fontSize: 90, fontWeight: 'bold', color: '#fffdf9' },
    { id: 'label', type: 'text', content: 'S E R K L E   /   S T O R I E S', x: 50, y: 62, scale: 1, rotation: 0, zIndex: 2, fontSize: 25, color: '#fffdf9' },
  ] } };
function Preview() {
  const [view, setView] = useState('');
  const [failed, setFailed] = useState(true);
  const close = () => setView('');
  const profile = { name: 'Maya', initials: 'MA', avatar_color: '#aa7957', avatar_url: null };
  const viewers = Array.from({ length: 4 }, (_, i) => ({ id: String(i), viewer_id: 'qa-friend-' + i, viewed_at: new Date().toISOString(), profile: { ...profile, name: ['Maya', 'Noah', 'Amara', 'Leo'][i] }, hasLiked: i < 2 }));
  return <>
    <main className="min-h-screen bg-[#fffdf9] p-8 text-[#472b20]">
      <p className="story-eyebrow">Serkle / Local QA only</p><h1 className="text-3xl font-semibold mt-4">Story experience</h1>
      <p className="text-sm my-5">Synthetic data. Publishing and replies are intercepted; nothing is sent to a real account.</p>
      <div className="flex flex-wrap gap-3">{['Create', 'Editor', 'Viewer', 'Broken media', 'Insights', 'Empty insights', 'Insights error', 'Insights loading'].map(label => <button key={label} className="story-secondary" onClick={() => setView(label)}>{label}</button>)}</div>
      <label className="block mt-8"><input type="checkbox" checked={failed} onChange={event => setFailed(event.target.checked)} /> Simulate upload/reply failure</label>
    </main>
    {view === 'Create' && <CreateStoryModal isOpen onClose={close} onCreateStory={() => {}} />}
    {view === 'Editor' && <StoryEditor previewUrl={image} onCancel={close} onDone={async () => { if (failed) throw new Error('Simulated upload failure. Your edits are still here.'); close(); }} />}
    {(view === 'Viewer' || view === 'Broken media') && <StoryViewer isOpen initialIndex={0} onClose={close} stories={view === 'Broken media' ? [{ ...story, story_state: undefined, image: '/missing-story-fixture.jpg' }] : [story, { ...story, id: 2 }]} />}
    {view.toLowerCase().includes('insights') ? <StoryInsightsContent userId="qa-owner" onClose={close} viewsCount={view === 'Empty insights' ? 0 : 124} likesCount={view === 'Empty insights' ? 0 : 32} repliesCount={view === 'Empty insights' ? 0 : 8}
      viewers={view === 'Empty insights' ? [] : viewers} messages={view === 'Empty insights' ? [] : [
        { id: 'reply-1', sender_id: 'qa-owner', receiver_id: 'qa-friend-0', content: 'Thank you!', created_at: new Date().toISOString(), profile: { ...profile, name: 'You' }, receiverProfile: profile },
        { id: 'reply-2', sender_id: 'qa-friend-0', receiver_id: 'qa-owner', content: 'Such a lovely moment.', created_at: new Date().toISOString(), profile },
      ]} isLoading={view === 'Insights loading'} isRefreshing={false} error={view === 'Insights error' ? 'Insights could not be loaded. Check your connection and try again.' : ''}
      refetch={() => setView('Insights')} sendReply={async () => { if (failed) throw new Error('Simulated failure'); }} loadMore={() => {}} hasMoreViewers={false} hasMoreMessages={false} /> : null}
  </>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><NavigationProvider><Preview /></NavigationProvider></BrowserRouter></QueryClientProvider>);
