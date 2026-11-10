import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

const db = new PGlite();
let frontend: ViteDevServer;
let VideoCard: React.ComponentType<any>;
let VideoPlayer: React.ComponentType<any>;
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const buyer = id(1), seller = id(2), outsider = id(3), circle = id(10), post = id(20), video = id(30), resource = id(40);
const sqlFile = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');
const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql, params)).rows;
async function login(user: string | null = buyer) {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)", [user || '']);
  await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}`);
}
async function purchase(kind = 'subscription', target = circle, request = randomUUID(), renew = false, expected: string | null = null) {
  return (await q('SELECT purchase_circle_access($1,$2,$3,$4,$5,$6) result', [kind,target,request,renew,expected,kind === 'subscription' ? 10 : kind === 'post' ? 5 : 7]))[0].result;
}
const access = async (kind: string, target: string) => (await q('SELECT circle_content_access($1,$2,auth.uid()) access', [kind,target]))[0].access;
const balance = async () => { await db.exec('RESET ROLE'); return (await q('SELECT balance FROM coin_wallets WHERE user_id=$1',[buyer]))[0].balance; };

before(async () => {
  await db.exec(await sqlFile('./fixtures/circle-entitlements.sql'));
  const coinSql = await sqlFile('../../supabase/migrations/20260302072500_4606f06a-a7ce-49ac-aa6d-44e29b3037cb.sql');
  for (const name of ['transfer_coins','spend_coins']) {
    await db.exec(coinSql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`))![0]);
  }
  for (const name of ['20261102150000_circle_entitlements.sql','20261102151000_circle_content_security.sql','20261102152000_circle_post_rpc_entitlements.sql','20261102153000_circle_separate_purchases.sql']) {
    await db.exec(await sqlFile(`../../supabase/migrations/${name}`));
  }
  // Reproduce a deployment where post visibility exists but the helper does not.
  await db.exec('DROP FUNCTION public.is_post_audience(uuid,uuid)');
  const previewMigration = await sqlFile('../../supabase/migrations/20261109120000_circle_post_previews.sql');
  await db.exec(previewMigration);
  await db.exec(await sqlFile('../../supabase/migrations/20261109130000_automatic_circle_post_previews.sql'));
  await db.exec(previewMigration);
  frontend = await createServer({
    configFile: false,
    resolve: { alias: { '@': fileURLToPath(new URL('../', import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, watch: null },
    plugins: [{
      name: 'isolated-entitlement-client', enforce: 'pre',
      resolveId(source) { if (source.replaceAll('\\','/').match(/(?:@|\/src)\/integrations\/supabase\/client(?:\.ts)?$/)) return '\0isolated-supabase'; },
      // Render real screens with backend RPC results. No live Supabase calls,
      // payments or React effect subscriptions are allowed in this harness.
      load(id) { if (id === '\0isolated-supabase') return 'export const supabase = {};'; },
    }],
  });
  VideoCard = (await frontend.ssrLoadModule('/src/components/circles/CircleVideoCard.tsx')).CircleVideoCard;
  VideoPlayer = (await frontend.ssrLoadModule('/src/components/circles/CircleVideoPlayer.tsx')).default;
});
after(async () => { await frontend?.close(); await db.close(); });
beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE profiles,circles,circle_members,follows,posts,post_stats,circle_videos,circle_resources,circle_subscriptions,post_unlocks,video_unlocks,coin_wallets,coin_transactions,circle_payment_requests,circle_booking_payments,circle_events,circle_event_attendees,circle_services,circle_service_bookings,storage.objects CASCADE');
  await q('INSERT INTO profiles(id,name) VALUES ($1,\'Buyer\'),($2,\'Seller\'),($3,\'Other\')',[buyer,seller,outsider]);
  await q('INSERT INTO circles(id,creator_id) VALUES ($1,$2)',[circle,seller]);
  await q("INSERT INTO posts(id,circle_id,user_id,content,is_premium,premium_price,media_url,media_urls) VALUES ($1,$2,$3,'SECRET PREMIUM TEXT',true,5,'https://example.test/storage/v1/object/public/post-media/secret.mp4',ARRAY['https://example.test/storage/v1/object/public/post-media/secret.mp4'])",[post,circle,seller]);
  await q('INSERT INTO post_stats(post_id) VALUES ($1)',[post]);
  await q("INSERT INTO circle_videos(id,circle_id,user_id,title,is_premium,price,video_url) VALUES ($1,$2,$3,'Video',true,7,'https://example.test/storage/v1/object/public/circle-videos/secret.mp4')",[video,circle,seller]);
  await q("INSERT INTO circle_resources(id,circle_id,uploader_id,title,is_premium,file_url) VALUES ($1,$2,$3,'Resource',true,'secret.pdf')",[resource,circle,seller]);
  await q('INSERT INTO coin_wallets(user_id,balance) VALUES ($1,100),($2,0),($3,100)',[buyer,seller,outsider]);
  await db.exec("INSERT INTO storage.objects(bucket_id,name) VALUES ('post-media','secret.mp4'),('circle-videos','secret.mp4'),('circle-resources','secret.pdf')");
  await q("INSERT INTO circle_events(id,circle_id,creator_id,price,meeting_url) VALUES ($1,$2,$3,8,'https://meeting.test/secret')",[id(50),circle,seller]);
  await q('INSERT INTO circle_services(id,circle_id,provider_id,price) VALUES ($1,$2,$3,12)',[id(60),circle,seller]);
  await login();
});

test('active subscribers receive every included content type without another debit', async () => {
  assert.equal((await purchase()).charged,10);
  for (const [kind,target] of [['post',post],['video',video],['resource',resource]]) assert.equal(await access(kind,target),true);
  assert.equal((await purchase('video',video)).charged,0);
  assert.equal((await purchase('post',post)).charged,0);
  assert.equal(await balance(),90);
});

test('locked APIs redact payloads and table/storage RLS denies access', async () => {
  assert.equal(await access('post',post),false);
  assert.equal((await q('SELECT * FROM get_post_details($1)',[post]))[0].content,'');
  assert.equal((await q('SELECT * FROM get_circle_posts_definitive($1)',[circle]))[0].media_url,null);
  assert.equal((await q('SELECT * FROM get_feed_posts()'))[0].content,'');
  assert.equal((await q('SELECT get_circle_videos($1) data',[circle]))[0].data[0].video_url,null);
  assert.equal((await q('SELECT get_circle_resources($1) data',[circle]))[0].data[0].file_url,null);
  assert.equal((await q('SELECT * FROM posts')).length,0);
  assert.equal((await q('SELECT * FROM circle_videos')).length,0);
  assert.equal((await q('SELECT * FROM circle_resources')).length,0);
  assert.equal((await q('SELECT * FROM storage.objects')).length,0);
});

test('authorized API payloads and storage use the same entitlement', async () => {
  await purchase();
  assert.equal((await q('SELECT * FROM get_post_details($1)',[post]))[0].content,'SECRET PREMIUM TEXT');
  assert.equal((await q('SELECT get_circle_videos($1) data',[circle]))[0].data[0].user_has_unlocked,true);
  assert.equal((await q('SELECT get_circle_resources($1) data',[circle]))[0].data[0].can_access,true);
  assert.equal((await q('SELECT * FROM storage.objects')).length,3);
});

test('locked previews are automatic and respect Circle and post visibility', async () => {
  const [legacy] = await q('SELECT * FROM get_circle_post_previews($1, ARRAY[$2]::uuid[])', [circle, post]);
  assert.equal(legacy.preview_image, null);
  assert.equal(legacy.preview_text, 'SECRET PR…');

  await db.exec('RESET ROLE');
  const thumbnail = 'data:image/webp;base64,AAAA';
  const cover = 'data:image/webp;base64,BBBB';
  await q('UPDATE posts SET content=$2, circle_preview_thumb=$3, circle_preview_cover=$4, has_tips_enabled=false WHERE id=$1', [post, '<p>Public <b>teaser</b></p><p>Secret body</p>', thumbnail, cover]);
  await login();
  const preview = (detail: boolean) => q('SELECT * FROM get_circle_post_previews($1, ARRAY[$2]::uuid[], $3)', [circle, post, detail]);
  assert.deepEqual(await preview(false), [{ post_id: post, preview_text: 'Public teaser', preview_image: thumbnail, has_tips_enabled: false }]);
  assert.equal((await preview(true))[0].preview_image, cover);
  assert.equal((await q('SELECT * FROM get_post_details($1)', [post]))[0].content, '');
  assert.equal((await q('SELECT * FROM get_post_details($1)', [post]))[0].media_url, null);

  await db.exec('RESET ROLE');
  await q("UPDATE posts SET visibility='friends' WHERE id=$1", [post]);
  await q('INSERT INTO follows(follower_id,following_id) VALUES ($1,$2)', [seller, buyer]);
  await login(buyer);
  assert.equal((await preview(true))[0].preview_image, cover);
  await login(null);
  assert.deepEqual(await preview(true), []);
  await login(outsider);
  assert.deepEqual(await preview(true), []);

  await db.exec('RESET ROLE');
  await q("UPDATE posts SET visibility='public' WHERE id=$1", [post]);
  await q('UPDATE circles SET is_private=true WHERE id=$1', [circle]);
  await login(outsider);
  assert.deepEqual(await preview(true), []);
});

test('legacy cover worker only claims author-owned images and rejects outdated leases', async () => {
  const origin = 'https://example.test';
  const photo = seller + '/legacy.jpg';
  const url = origin + '/storage/v1/object/public/post-media/' + photo;
  await assert.rejects(q('SELECT * FROM claim_circle_cover_preview($1)', [origin]), { code: '42501' });
  await db.exec('RESET ROLE');
  await q('UPDATE posts SET cover_image_url=$2 WHERE id=$1', [post, url]);
  await q(`INSERT INTO storage.objects (bucket_id,name,owner_id,metadata)
    VALUES ('post-media',$1,$2,'{"mimetype":"image/jpeg","size":123}')`, [photo, outsider]);
  assert.deepEqual(await q('SELECT * FROM claim_circle_cover_preview($1)', [origin]), []);
  await q('UPDATE storage.objects SET owner_id=$2 WHERE name=$1', [photo, seller]);
  assert.deepEqual(await q('SELECT * FROM claim_circle_cover_preview($1)', ['https://another-project.test']), []);
  const [job] = await q('SELECT * FROM claim_circle_cover_preview($1)', [origin]);
  assert.equal(job.object_path, photo);
  assert.deepEqual(await q('SELECT * FROM claim_circle_cover_preview($1)', [origin]), []);
  await q('UPDATE posts SET cover_image_url=NULL WHERE id=$1', [post]);
  const finish = (lease: string) => q('SELECT complete_circle_cover_preview($1,$2,$3,$4) AS stored',
    [post, lease, 'data:image/webp;base64,AAAA', 'data:image/webp;base64,BBBB']);
  assert.deepEqual(await finish(job.lease), [{ stored: false }]);
  const oldSignedUrl = origin + '/storage/v1/object/sign/post-media/' + photo + '?token=expired';
  await q('UPDATE posts SET cover_image_url=$2 WHERE id=$1', [post, oldSignedUrl]);
  const [retry] = await q('SELECT * FROM claim_circle_cover_preview($1)', [origin]);
  assert.deepEqual(await finish(retry.lease), [{ stored: true }]);
  await login(buyer);
  assert.equal((await q('SELECT * FROM get_circle_post_previews($1,ARRAY[$2]::uuid[],true)', [circle, post]))[0].preview_image,
    'data:image/webp;base64,AAAA');
  assert.equal((await q('SELECT * FROM get_post_details($1)', [post]))[0].cover_image_url, null);
});

test('expiry denies subscription access while retaining a prior one-time purchase', async () => {
  await purchase('video',video);
  await db.exec('RESET ROLE');
  await q("INSERT INTO circle_subscriptions(circle_id,user_id,expires_at) VALUES ($1,$2,now()-interval '1 second')",[circle,buyer]);
  await login();
  assert.equal(await access('video',video),true);
  assert.equal(await access('post',post),false);
  assert.equal(await access('resource',resource),false);
  assert.equal((await q('SELECT get_circle_subscription($1) data',[circle]))[0].data,null);
});

test('refund immediately revokes subscription, never refunds twice, and preserves independent purchases', async () => {
  await purchase('video',video);
  const sub = await purchase();
  await login(seller);
  assert.equal((await q('SELECT refund_circle_payment($1) result',[sub.payment_id]))[0].result.replayed,false);
  assert.equal((await q('SELECT refund_circle_payment($1) result',[sub.payment_id]))[0].result.replayed,true);
  await login();
  assert.equal(await access('post',post),false);
  assert.equal(await access('video',video),true);
  assert.equal(await balance(),93);
});

test('refunded one-time purchase loses access and can be explicitly purchased again', async () => {
  const request = randomUUID();
  const paid = await purchase('video',video,request);
  await login(seller);
  await q('SELECT refund_circle_payment($1)',[paid.payment_id]);
  await login();
  assert.equal(await access('video',video),false);
  const replay = await purchase('video',video,request);
  assert.equal(replay.refunded,true); assert.equal(replay.has_access,false); assert.equal(replay.charged,0);
  assert.equal((await purchase('video',video)).charged,7);
  assert.equal(await access('video',video),true);
});

test('retries, lost responses and concurrent submissions with different keys charge once', async () => {
  const request = randomUUID();
  const results = await Promise.all(Array.from({length:8},(_,i) => purchase('video',video,i<4?request:randomUUID())));
  assert.equal(results.reduce((sum,r)=>sum+r.charged,0),7);
  assert.equal(await balance(),93);
  assert.equal((await q('SELECT count(*)::int n FROM video_unlocks'))[0].n,1);
});

test('idempotency keys cannot be reused for a different purchase', async () => {
  const request=randomUUID(); await purchase('video',video,request);
  await assert.rejects(purchase('post',post,request),/Idempotency key reused/);
  assert.equal(await balance(),93);
});

test('cancellation preserves access through paid period and renewal extends one calendar month', async () => {
  await purchase();
  await q('SELECT cancel_circle_subscription($1)',[circle]);
  assert.equal(await access('post',post),true);
  const sub=(await q('SELECT get_circle_subscription($1) data',[circle]))[0].data;
  assert.equal(sub.cancel_at_period_end,true);
  const request=randomUUID();
  assert.equal((await purchase('subscription',circle,request,true,sub.expires_at)).charged,10);
  assert.equal((await purchase('subscription',circle,request,true,sub.expires_at)).charged,0);
  await assert.rejects(purchase('subscription',circle,randomUUID(),true,sub.expires_at),/refresh renewal quote/);
  assert.equal(await balance(),80);
});

test('calendar-month renewal clamps month end and protects current month when future renewal is refunded', async () => {
  const first=await purchase();
  const sub=(await q('SELECT get_circle_subscription($1) data',[circle]))[0].data;
  const renewal=await purchase('subscription',circle,randomUUID(),true,sub.expires_at);
  await login(seller); await q('SELECT refund_circle_payment($1)',[renewal.payment_id]); await login();
  assert.equal(await access('post',post),true);
  await login(seller); await q('SELECT refund_circle_payment($1)',[first.payment_id]); await login();
  assert.equal(await access('post',post),false);
  assert.equal((await q("SELECT (('2027-01-31T10:00:00Z'::timestamptz + interval '1 month') AT TIME ZONE 'UTC')::text d"))[0].d,'2027-02-28 10:00:00');
});

test('legacy unexpired/null-expiry subscriptions and legacy one-time purchases remain valid', async () => {
  await db.exec('RESET ROLE');
  await q('INSERT INTO circle_subscriptions(circle_id,user_id) VALUES ($1,$2)',[circle,buyer]);
  await q('INSERT INTO post_unlocks(post_id,user_id,amount_paid) VALUES ($1,$2,5)',[post,outsider]);
  await login(); assert.equal(await access('resource',resource),true);
  await login(outsider); assert.equal(await access('post',post),true); assert.equal(await access('video',video),false);
});

test('failed payment rolls back every debit, ledger row and grant', async () => {
  await db.exec('RESET ROLE'); await q('UPDATE coin_wallets SET balance=1 WHERE user_id=$1',[buyer]); await login();
  await assert.rejects(purchase(),/Insufficient/);
  await db.exec('RESET ROLE');
  assert.equal((await q('SELECT count(*)::int n FROM circle_payment_requests'))[0].n,0);
  assert.equal((await q('SELECT count(*)::int n FROM circle_subscriptions'))[0].n,0);
  assert.equal(await balance(),1);
});

test('anonymous, forged-payer and direct self-grant requests are denied', async () => {
  await assert.rejects(q("INSERT INTO circle_subscriptions(circle_id,user_id) VALUES ($1,$2)",[circle,buyer]),/permission denied/);
  await assert.rejects(q('INSERT INTO video_unlocks(video_id,user_id) VALUES ($1,$2)',[video,buyer]),/permission denied/);
  await assert.rejects(q('SELECT unlock_premium_post($1,$2)',[outsider,post]),/Not authorized/);
  await assert.rejects(q("SELECT spend_coins($1,5,'subscription',$2,'forged')",[outsider,circle]),/Invalid payment/);
  await assert.rejects(q("SELECT spend_coins($1,-5,'subscription',$2,'negative')",[buyer,circle]),/Invalid payment/);
  await login(null); await assert.rejects(purchase(),/permission denied/);
});

test('owners, free content and excluded event/service types follow their access rules', async () => {
  await login(seller); assert.equal(await access('post',post),true); assert.equal((await purchase('video',video)).charged,0);
  await db.exec('RESET ROLE'); await q('UPDATE posts SET is_premium=false WHERE id=$1',[post]); await login();
  assert.equal(await access('post',post),true);
  assert.equal(await access('event',resource),false); assert.equal(await access('service',resource),false);
  await assert.rejects(purchase('event',resource),/Unsupported/);
});

const book = async (kind: string, target: string, price: number, request = randomUUID(), details = {}) =>
  (await q('SELECT purchase_circle_booking($1,$2,$3,$4,$5) result',[kind,target,request,price,JSON.stringify(details)]))[0].result;

test('active subscribers must explicitly buy excluded events; retries cannot double-charge', async () => {
  await purchase();
  assert.equal((await q('SELECT get_circle_events($1) data',[circle]))[0].data[0].meeting_url,null);
  assert.equal((await q('SELECT * FROM circle_events')).length,0);
  const request=randomUUID();
  const results=await Promise.all(Array.from({length:6},()=>book('event',id(50),8,request)));
  assert.equal(results.reduce((sum,r)=>sum+r.charged,0),8);
  assert.equal((await q('SELECT get_circle_events($1) data',[circle]))[0].data[0].meeting_url,'https://meeting.test/secret');
  await q('SELECT cancel_circle_event_registration($1)',[id(50)]);
  assert.equal((await book('event',id(50),8)).charged,0);
  assert.equal(await balance(),82);
});

test('excluded service bookings are atomic and deduplicated by request and appointment', async () => {
  await purchase();
  const details={ booking_date:'2026-12-01',booking_time:'10:00',member_name:'Buyer',member_email:'buyer@example.test' };
  const results=await Promise.all(Array.from({length:6},()=>book('service',id(60),12,randomUUID(),details)));
  assert.equal(results.reduce((sum,r)=>sum+r.charged,0),12);
  assert.equal(await balance(),78);
  assert.equal((await q('SELECT count(*)::int n FROM circle_service_bookings'))[0].n,1);
});

test('event refund revokes paid-event access without affecting subscription content', async () => {
  await purchase(); await book('event',id(50),8);
  const payment=(await q('SELECT id FROM circle_booking_payments'))[0].id;
  await login(seller); await q('SELECT refund_circle_booking($1)',[payment]); await q('SELECT refund_circle_booking($1)',[payment]); await login();
  assert.equal((await q('SELECT get_circle_events($1) data',[circle]))[0].data[0].meeting_url,null);
  assert.equal(await access('video',video),true);
  assert.equal(await balance(),90);
});

test('a changed price requires renewed consent and does not create a payment', async () => {
  await db.exec('RESET ROLE'); await q('UPDATE circles SET subscription_price=11 WHERE id=$1',[circle]); await login();
  await assert.rejects(purchase(),/Price changed/);
  await assert.rejects(book('service',id(60),11,randomUUID(),{booking_date:'2026-12-01',booking_time:'10:00',member_name:'B',member_email:'b@example.test'}),/Review the current/);
  assert.equal(await balance(),100);
});

test('failure after debit rolls back the wallet, ledger and grant together', async () => {
  await db.exec("RESET ROLE; CREATE FUNCTION reject_test_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated grant failure'; END $$; CREATE TRIGGER reject_test_grant BEFORE INSERT ON video_unlocks FOR EACH ROW EXECUTE FUNCTION reject_test_grant()");
  try {
    await login(); await assert.rejects(purchase('video',video),/simulated grant failure/);
    assert.equal(await balance(),100);
    assert.equal((await q('SELECT count(*)::int n FROM coin_transactions'))[0].n,0);
    assert.equal((await q('SELECT count(*)::int n FROM circle_payment_requests'))[0].n,0);
  } finally { await db.exec('RESET ROLE; DROP TRIGGER reject_test_grant ON video_unlocks; DROP FUNCTION reject_test_grant()'); }
});

test('private-circle previews are denied to outsiders and subscription scope never leaks across circles', async () => {
  await db.exec('RESET ROLE'); await q('UPDATE circles SET is_private=true WHERE id=$1',[circle]); await login();
  assert.deepEqual((await q('SELECT get_circle_videos($1) data',[circle]))[0].data,[]);
  assert.equal((await q('SELECT * FROM get_post_details($1)',[post])).length,0);
  await purchase(); assert.equal(await access('video',video),true);
  await login(outsider); assert.equal(await access('video',video),false);
});

test('renewing a finite legacy subscription keeps its already-paid current period', async () => {
  await db.exec('RESET ROLE'); await q("INSERT INTO circle_subscriptions(circle_id,user_id,expires_at) VALUES($1,$2,now()+interval '10 days')",[circle,buyer]); await login();
  const old=(await q('SELECT get_circle_subscription($1) data',[circle]))[0].data;
  await purchase('subscription',circle,randomUUID(),true,old.expires_at);
  assert.equal(await access('video',video),true);
});

test('legacy one-time refunds are authorized, idempotent and revoke only that grant', async () => {
  await db.exec('RESET ROLE');
  await q('INSERT INTO video_unlocks(video_id,user_id,amount_paid) VALUES($1,$2,7)',[video,buyer]);
  await q('UPDATE coin_wallets SET balance=7 WHERE user_id=$1',[seller]);
  await login(); await assert.rejects(q("SELECT refund_circle_purchase('video',$1,$2)",[video,buyer]),/not authorized/);
  await login(seller); await q("SELECT refund_circle_purchase('video',$1,$2)",[video,buyer]); await q("SELECT refund_circle_purchase('video',$1,$2)",[video,buyer]);
  await login(); assert.equal(await access('video',video),false);
  assert.equal(await balance(),107);
});

test('a new explicit subscription after refund starts immediately instead of after a refunded period', async () => {
  const first=await purchase();
  await login(seller); await q('SELECT refund_circle_payment($1)',[first.payment_id]); await login();
  assert.equal(await access('post',post),false);
  assert.equal((await purchase()).charged,10);
  assert.equal(await access('post',post),true);
  assert.equal(await balance(),90);
});

test('cancelled, future and unknown subscription states never grant premium content', async () => {
  await db.exec('RESET ROLE');
  await q("INSERT INTO circle_subscriptions(circle_id,user_id,status,started_at,expires_at) VALUES($1,$2,'cancelled',now(),now()+interval '1 month')",[circle,buyer]);
  await login(); assert.equal(await access('resource',resource),false);
  await db.exec('RESET ROLE'); await q("UPDATE circle_subscriptions SET status='active',started_at=now()+interval '1 day' WHERE user_id=$1",[buyer]);
  await login(); assert.equal(await access('resource',resource),false);
  await assert.rejects(q("UPDATE circle_subscriptions SET status='active',expires_at=NULL WHERE user_id=$1",[buyer]),/permission denied/);
});

test('legacy subscription receipt refunds require an admin and reverse the original debit only once', async () => {
  await db.exec('RESET ROLE');
  await q('INSERT INTO circle_subscriptions(circle_id,user_id) VALUES($1,$2)',[circle,buyer]);
  const transaction=randomUUID();
  await q("INSERT INTO coin_transactions(id,user_id,amount,type,reference_id) VALUES($1,$2,-10,'subscription',$3)",[transaction,buyer,circle]);
  await login(); await assert.rejects(q('SELECT refund_legacy_circle_subscription($1)',[transaction]),/Platform admin/);
  await login(id(99)); await q('SELECT refund_legacy_circle_subscription($1)',[transaction]); await q('SELECT refund_legacy_circle_subscription($1)',[transaction]);
  await login(); assert.equal(await access('video',video),false);
  assert.equal(await balance(),110);
});

async function assertVideoScreen(granted: boolean, unknown = false) {
  const rows=(await q('SELECT get_circle_videos($1) data',[circle]))[0].data;
  const item={...rows[0], views_count:0, duration:null, user_has_unlocked:unknown?undefined:rows[0].user_has_unlocked};
  const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity}}});
  let purchaseClicks=0;
  const render=(component: React.ComponentType<any>, props: object) => renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(component,props)));
  try {
    const card=render(VideoCard,{video:item,onClick:()=>undefined});
    const player=render(VideoPlayer,{video:item,circle:{id:circle,name:'Circle'},onClose:()=>undefined,onUnlock:()=>{purchaseClicks++;}});
    assert.equal(card.includes('Unlocked'),granted);
    assert.equal(player.includes('<video'),granted);
    assert.equal(player.includes('Unlock for'),!granted);
    assert.equal(purchaseClicks,0,'rendering an entitlement must never initiate a payment');
  } finally { client.clear(); }
}

test('real card and player agree with backend active, expired, purchased, refunded and unknown access', async () => {
  await assertVideoScreen(false);
  const paid=await purchase(); await assertVideoScreen(true);
  await db.exec('RESET ROLE'); await q("UPDATE circle_subscriptions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[buyer]); await login();
  await assertVideoScreen(false);
  const single=await purchase('video',video); await assertVideoScreen(true);
  await login(seller); await q('SELECT refund_circle_payment($1)',[single.payment_id]); await login(); await assertVideoScreen(false);
  await assertVideoScreen(false,true);
  await login(seller); await assertVideoScreen(true);
});
