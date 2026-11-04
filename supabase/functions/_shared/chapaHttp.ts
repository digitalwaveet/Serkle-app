export type ChapaRoute = 'initialize' | 'verify' | 'webhook' | 'reconcile';
type ChapaHandlers = Record<ChapaRoute, (request: Request) => Promise<Response>>;

export const chapaCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function chapaJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...chapaCorsHeaders, 'Content-Type': 'application/json' } });
}

/** Preflight must not read secrets, authenticate, construct clients or call any
 * provider/database. Error responses must carry the same browser CORS headers. */
export function createChapaHttpHandler(route: ChapaRoute, buildRuntime: () => ChapaHandlers) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: chapaCorsHeaders });
    if (request.method !== 'POST') return chapaJson({ success: false, error: 'Method not allowed' }, 405);
    try {
      return await buildRuntime()[route](request);
    } catch {
      return chapaJson({ success: false, error: 'Payment service is not configured. Check the Supabase payment secrets.' }, 503);
    }
  };
}
