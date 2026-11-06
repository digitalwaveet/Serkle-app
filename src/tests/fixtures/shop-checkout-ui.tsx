import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckoutModal } from '@/components/shop/CheckoutModal';
import { useOrderMutations } from '@/hooks/useOrderMutations';
import { Toaster } from '@/components/ui/toaster';

function CheckoutFixture() {
  const {createOrder}=useOrderMutations();
  (window as any).tryUnsupportedShopPayment=async(type:unknown)=>{
    try {await createOrder.mutateAsync({items:[],shippingAddress:{} as any,paymentMethod:{type} as any,subtotal:20,shipping:0,tax:0,total:20});return null;}
    catch(error) {return (error as Error).message;}
  };
  return <><CheckoutModal /><Toaster /></>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{mutations:{retry:false},queries:{retry:false}}})}><CheckoutFixture /></QueryClientProvider>);
