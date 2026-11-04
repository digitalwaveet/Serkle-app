import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { CIRCLE_ACCESS_QUERY_KEYS } from '@/lib/circlePayments';
import { recordTopUpResult } from '@/lib/chapaPayments';

/** Payment/grant restoration comes from account-scoped server receipts, even on
 * a new device with no localStorage. This never initiates or repeats a charge. */
export default function ChapaReconciliation() {
  const { user }=useUser();
  const client=useQueryClient();
  useEffect(()=>{
    if(!user?.id) return;
    let disposed=false,running=false;
    const reconcile=async()=>{
      if(disposed || running || document.visibilityState==='hidden') return;
      running=true;
      try {
        const {data,error}=await supabase.functions.invoke('chapa-reconcile',{body:{}});
        if(error || disposed) return;
        for(const result of data?.results || []) recordTopUpResult(user.id,result);
        await Promise.all(CIRCLE_ACCESS_QUERY_KEYS.map(key=>client.invalidateQueries({queryKey:[key]})));
      }catch { /* Server verification will retry on reconnect/focus; never grant optimistically. */ }
      finally{running=false;}
    };
    void reconcile();
    const timer=setInterval(()=>{void reconcile();},60000);
    const resume=()=>{void reconcile();};
    window.addEventListener('online',resume);
    window.addEventListener('focus',resume);
    document.addEventListener('visibilitychange',resume);
    return ()=>{disposed=true;clearInterval(timer);window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[user?.id,client]);
  return null;
}
