import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VerifyTopUp from '@/pages/VerifyTopUp';
import { Toaster } from '@/components/ui/toaster';
import WalletModal from '@/components/wallet/WalletModal';

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}>
  <BrowserRouter><Routes>
    <Route path="/verify" element={<VerifyTopUp />} />
    <Route path="/login" element={<h1>Sign in</h1>} />
    <Route path="/wallet-fixture" element={<WalletModal isOpen={true} onClose={()=>{}} />} />
    <Route path="/" element={<h1>Wallet</h1>} />
  </Routes><Toaster /></BrowserRouter>
</QueryClientProvider>);
