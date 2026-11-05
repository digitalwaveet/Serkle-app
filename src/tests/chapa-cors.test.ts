import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chapaCorsHeaders, createChapaHttpHandler, type ChapaRoute } from '../../supabase/functions/_shared/chapaHttp.ts';

const origin='https://serkle-app-five.vercel.app';
const routes:ChapaRoute[]=['initialize','verify','webhook','reconcile'];
for(const route of routes) {
  test(`${route}: production preflight succeeds with no secrets, JWT, database or provider`,async()=>{
    let initialized=false;
    const handler=createChapaHttpHandler(route,()=>{initialized=true;throw new Error('Missing payment secrets');});
    const response=await handler(new Request(`https://edge.test/chapa-${route}`,{method:'OPTIONS',headers:{
      Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform',
    }}));
    assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal(initialized,false);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
    assert.ok(response.headers.get('Access-Control-Allow-Methods')!.includes('POST'));
    for(const header of ['authorization','apikey','content-type','x-client-info','x-supabase-client-platform']) assert.ok(response.headers.get('Access-Control-Allow-Headers')!.includes(header));
  });
  test(`${route}: missing configuration is a readable 503 with full CORS headers`,async()=>{
    const handler=createChapaHttpHandler(route,()=>{throw new Error('Missing CHAPA_MODE');});
    const response=await handler(new Request('https://edge.test',{method:'POST',headers:{Origin:origin},body:'{}'}));
    assert.equal(response.status,503);assert.match((await response.json()).error,/not configured/);
    for(const [header,value] of Object.entries(chapaCorsHeaders)) assert.equal(response.headers.get(header),value);
  });
}

test('real requests still reach payment authentication and preserve its error response',async()=>{
  const unauthenticated=async()=>new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:{...chapaCorsHeaders,'Content-Type':'application/json'}});
  const handler=createChapaHttpHandler('reconcile',()=>({initialize:unauthenticated,verify:unauthenticated,webhook:unauthenticated,reconcile:unauthenticated}));
  const response=await handler(new Request('https://edge.test',{method:'POST',headers:{Origin:origin},body:'{}'}));
  assert.equal(response.status,401);assert.equal((await response.json()).error,'Authentication required');
});

test('unsupported methods are rejected before initialization',async()=>{
  const handler=createChapaHttpHandler('reconcile',()=>{throw new Error('Must not initialize');});
  const response=await handler(new Request('https://edge.test',{method:'GET',headers:{Origin:origin}}));
  assert.equal(response.status,405);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
});
