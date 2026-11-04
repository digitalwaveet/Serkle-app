import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import CircleDetail from '@/pages/CircleDetail';
import { fixture, card } from 'virtual:leave-client';

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
client.setQueryData(['circles',fixture.user.id],[card()]);
client.setQueryData(['my-circles',fixture.user.id,'non-owner-memberships'],[card()]);

function Home() {
  const { data: circles = [] } = useQuery<any[]>({ queryKey: ['circles',fixture.user.id], queryFn: async()=>[card()] });
  const { data: joined = [] } = useQuery<any[]>({ queryKey: ['my-circles',fixture.user.id,'non-owner-memberships'], queryFn: async()=>fixture.status==='active' ? [card()] : [] });
  return <main><h1>Your Circles</h1><p>Joined Circles: {joined.length}</p><p>Members: {circles[0]?.members_count}</p><Link to={`/circle/${fixture.id}`}>View Circle</Link></main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}>
  <MemoryRouter initialEntries={[`/circle/${fixture.id}`]}><Routes>
    <Route path="/circle/:id" element={<CircleDetail activeTab="circles" setActiveTab={()=>{}} onTabSelect={()=>{}} onOpenCreate={()=>{}} />} />
    <Route path="/" element={<Home />} />
  </Routes></MemoryRouter>
</QueryClientProvider>);
