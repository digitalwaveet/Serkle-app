import React, { useState } from 'react';
import '@/index.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VerifyTopUp from '@/pages/VerifyTopUp';
import { Toaster } from '@/components/ui/toaster';
import WalletModal from '@/components/wallet/WalletModal';

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function WalletFixture() {
  const [open,setOpen]=useState(true);
  return <><button onClick={()=>setOpen(true)}>Open wallet</button><WalletModal isOpen={open} onClose={()=>setOpen(false)}/></>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}>
  <BrowserRouter><Routes>
    <Route path="/verify" element={<VerifyTopUp />} />
    <Route path="/login" element={<h1>Sign in</h1>} />
    <Route path="/wallet-fixture" element={<WalletFixture />} />
    <Route path="/" element={<h1>Wallet</h1>} />
  </Routes><Toaster /></BrowserRouter>
</QueryClientProvider>);
