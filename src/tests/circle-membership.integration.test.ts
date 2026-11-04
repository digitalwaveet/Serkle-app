import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer, type ViteDevServer } from 'vite';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query';
import { circleMembershipAction, validateCircleSnapshot, type CircleMembershipSnapshot } from '../lib/circleMembershipState.ts';
import { fetchCircleMemberships, requestCircleJoin, refreshCircleMembership } from '../lib/circleMembershipClient.ts';
import { authReturnPath, circleLoginPath } from '../lib/authReturnPath.ts';
import { applyCircleLeaveResult, requestCircleLeave, type CircleLeaveResult } from '../lib/circleLeave.ts';

const db = new PGlite();
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const member=id(1), owner=id(2), other=id(3), admin=id(99), circle=id(10);
let frontend: ViteDevServer;
let MembershipButton: React.ComponentType<any>, CircleCard: React.ComponentType<any>;
const file = (path: string) => readFile(new URL(path,import.meta.url),'utf8');
const q = async (sql: string, params: unknown[] = []) => (await db.query<any>(sql,params)).rows;
async function login(user: string | null = member) {
  await db.exec('RESET ROLE');
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[user || '']);
  await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}`);
}
const state = async () => (await q('SELECT get_circle_membership_state($1) result',[circle]))[0].result as CircleMembershipSnapshot;
const join = async (request = randomUUID()) => (await q('SELECT join_circle($1,$2) result',[circle,request]))[0].result as CircleMembershipSnapshot;
async function configure(sql: string, params: unknown[] = []) { await db.exec('RESET ROLE'); await q(sql,params); await login(); }
const respond = async (approve = true) => q('SELECT respond_circle_join_request($1,$2,$3)',[circle,member,approve]);
async function stats() { return (await q('SELECT members_count FROM circle_stats WHERE circle_id=$1',[circle]))[0].members_count; }
async function subscribe(expires = "now()+interval '1 month'", refunded = false) {
  await configure(`INSERT INTO circle_subscriptions(circle_id,user_id,expires_at,refunded_at) VALUES ($1,$2,${expires},${refunded ? 'now()' : 'NULL'}) ON CONFLICT(circle_id,user_id) DO UPDATE SET expires_at=EXCLUDED.expires_at,refunded_at=EXCLUDED.refunded_at`,[circle,member]);
}
const storage = () => {
  const data = new Map<string,string>();
  return { getItem: (key: string) => data.get(key) || null, setItem: (key: string,value: string) => { data.set(key,value); }, removeItem: (key: string) => { data.delete(key); } };
};

before(async () => {
  await db.exec(await file('./fixtures/circle-entitlements.sql'));
  await db.exec(await file('./fixtures/circle-membership.sql'));
  const invitations = await file('../../supabase/migrations/20260308144618_4aeb70bc-1a5c-4d3b-a61a-8278b77e54e1.sql');
  await db.exec(invitations.split('ALTER PUBLICATION')[0]);
  await db.exec('GRANT SELECT,INSERT,UPDATE,DELETE ON circle_invitations TO authenticated');
  const base = await file('../../supabase/migrations/20251015065703_3940d4e4-0147-42cf-9177-f11642380172.sql');
  for (const name of ['create_circle_stats','update_circle_member_count']) {
    await db.exec(base.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`))![0]);
  }
  await db.exec('CREATE TRIGGER on_circle_created AFTER INSERT ON circles FOR EACH ROW EXECUTE FUNCTION create_circle_stats(); CREATE TRIGGER on_circle_member_change AFTER INSERT OR UPDATE OR DELETE ON circle_members FOR EACH ROW EXECUTE FUNCTION update_circle_member_count()');
  await db.exec(await file('../../supabase/migrations/20261102150000_circle_entitlements.sql'));
  const contentSecurity = await file('../../supabase/migrations/20261102151000_circle_content_security.sql');
  await db.exec(contentSecurity.match(/CREATE OR REPLACE FUNCTION public\.get_circle_subscription\([\s\S]*?\$\$;/)![0]);
  await db.exec(await file('../../supabase/migrations/20261104120000_circle_membership_state_machine.sql'));
  await db.exec(await file('../../supabase/migrations/20261104130000_circle_leave_flow.sql'));
  frontend = await createServer({ configFile:false, resolve:{ alias:{ '@':fileURLToPath(new URL('../',import.meta.url)) } },
    server:{ middlewareMode:true, hmr:false, watch:null }, plugins:[{ name:'isolated-membership', enforce:'pre',
      resolveId(source) { if (source.replace(/\\/g,'/').match(/(?:@|\/src)\/integrations\/supabase\/client(?:\.ts)?$/)) return '\0isolated-client'; },
      load(id) { if (id==='\0isolated-client') return 'export const supabase = {};'; },
    }],
  });
  MembershipButton=(await frontend.ssrLoadModule('/src/components/circles/CircleMembershipButton.tsx')).CircleMembershipButton;
  CircleCard=(await frontend.ssrLoadModule('/src/components/circles/CircleCard.tsx')).default;
});
after(async () => { await frontend?.close(); await db.close(); });
beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE profiles,circles,circle_members,circle_stats,circle_subscriptions,circle_payment_requests,circle_join_intents,circle_leave_intents,circle_invitations,push_notifications CASCADE');
  await q("INSERT INTO profiles(id,name) VALUES($1,'Member'),($2,'Owner'),($3,'Other'),($4,'Admin')",[member,owner,other,admin]);
  await q("INSERT INTO circles(id,creator_id,name,subscription_enabled,invite_code) VALUES($1,$2,'Circle',false,'invite123')",[circle,owner]);
  await login();
});

test('owner without a membership row always sees Manage and cannot leave', async () => {
  await configure('DELETE FROM circle_members WHERE circle_id=$1',[circle]);
  await login(owner);
  assert.equal((await state()).state,'owner');
  assert.equal((await join()).state,'owner');
  assert.equal(circleMembershipAction(await state()).label,'Manage');
  await assert.rejects(q('SELECT leave_circle($1)',[circle]),/Transfer ownership/);
});

test('Circle creation atomically creates one active owner membership and accurate stats', async () => {
  await login(other);
  await q("INSERT INTO circles(id,creator_id,name) VALUES($1,$2,'New')",[id(11),other]);
  assert.equal((await q('SELECT role,status FROM circle_members WHERE circle_id=$1',[id(11)]))[0].role,'creator');
  assert.equal((await q('SELECT members_count FROM circle_stats WHERE circle_id=$1',[id(11)]))[0].members_count,1);
  await assert.rejects(q("INSERT INTO circles(id,creator_id) VALUES($1,$2)",[id(12),owner]),/row-level security/);
});

test('public Join -> Joined persists through new reads, leave and deliberate rejoin', async () => {
  assert.equal((await state()).state,'join');
  assert.equal((await join()).state,'joined');
  await login();
  assert.equal((await state()).state,'joined');
  assert.equal(await stats(),2);
  assert.equal((await q('SELECT leave_circle($1) result',[circle]))[0].result.state,'join');
  await q('SELECT leave_circle($1)',[circle]);
  assert.equal(await stats(),1);
  assert.equal((await join()).state,'joined');
  assert.equal((await q('SELECT count(*)::int n FROM circle_members WHERE circle_id=$1 AND user_id=$2',[circle,member]))[0].n,1);
  assert.equal(await stats(),2);
});

test('concurrent joins and repeated request IDs produce one membership and one count change', async () => {
  const request=randomUUID();
  const results=await Promise.all([join(request),join(request),join(),join()]);
  assert.ok(results.every(result=>result.state==='joined'));
  assert.equal((await q('SELECT count(*)::int n FROM circle_members WHERE user_id=$1',[member]))[0].n,1);
  assert.equal(await stats(),2);
});

test('private invite preview and join require approval, preserve pending after reload and suppress duplicate requests', async () => {
  await configure('UPDATE circles SET is_private=true WHERE id=$1',[circle]);
  assert.equal((await q('SELECT * FROM circles WHERE id=$1',[circle])).length,0);
  const preview=(await q("SELECT get_circle_invite_preview('invite123') result"))[0].result;
  assert.equal(preview.membership_state.state,'join');
  assert.equal(preview.invite_code,undefined);
  const results=await Promise.all([join(),join(),join()]);
  assert.ok(results.every(result=>result.state==='pending'));
  await login();
  assert.equal((await state()).state,'pending');
  assert.equal((await q('SELECT * FROM circles WHERE id=$1',[circle])).length,1);
  assert.equal((await q('SELECT * FROM circle_members WHERE user_id=$1',[member])).length,1);
  assert.equal(await stats(),1);
});

test('only owner/active admins can approve; repeated approval notifies and counts once', async () => {
  await configure('UPDATE circles SET is_private=true WHERE id=$1',[circle]);
  await join();
  await assert.rejects(respond(),/Only Circle managers/);
  await login(other);
  await assert.rejects(respond(),/Only Circle managers/);
  await login(owner);
  await respond(); await respond(); await respond(false);
  assert.equal(await stats(),2);
  await db.exec('RESET ROLE');
  assert.equal((await q('SELECT count(*)::int n FROM push_notifications'))[0].n,1);
  await login();
  assert.equal((await state()).state,'joined');
});

test('decline and cancelled requests retain history; lost-response retries cannot resurrect them', async () => {
  await configure('UPDATE circles SET is_private=true WHERE id=$1',[circle]);
  const request=randomUUID();
  await join(request);
  await login(owner); await respond(false);
  await login();
  assert.equal((await join(request)).state,'join');
  assert.equal((await state()).status,'declined');
  await join();
  const again=randomUUID(); await join(again);
  await q('SELECT leave_circle($1)',[circle]);
  await join(again);
  assert.equal((await state()).status,'left');
  assert.equal(await stats(),1);
});

test('active admins manage, moderators are Joined, inactive admins cannot approve', async () => {
  await configure("INSERT INTO circle_members(circle_id,user_id,role,status) VALUES($1,$2,'admin','active')",[circle,member]);
  assert.equal((await state()).state,'manager');
  await configure("UPDATE circle_members SET role='moderator' WHERE user_id=$1",[member]);
  assert.equal((await state()).state,'joined');
  await assert.rejects(respond(),/Only Circle managers/);
  await configure("UPDATE circle_members SET role='admin',status='left' WHERE user_id=$1",[member]);
  await assert.rejects(respond(),/Only Circle managers/);
});

test('an active admin can approve and an owner missing their member row can still read requests', async () => {
  await configure('UPDATE circles SET is_private=true WHERE id=$1',[circle]);
  await join();
  await configure("INSERT INTO circle_members(circle_id,user_id,role,status) VALUES($1,$2,'admin','active')",[circle,other]);
  await login(other); await respond();
  await login(); assert.equal((await state()).state,'joined');
  await q('SELECT leave_circle($1)',[circle]); await join();
  await configure('DELETE FROM circle_members WHERE user_id=$1',[owner]);
  await login(owner);
  assert.equal((await q("SELECT user_id FROM circle_members WHERE circle_id=$1 AND status='pending'",[circle])).length,1);
  await respond();
});

test('anonymous users see Sign in and cannot call any membership mutation', async () => {
  await login(null);
  assert.equal((await state()).state,'guest');
  assert.equal(circleMembershipAction(await state()).label,'Sign in');
  for (const sql of ["SELECT join_circle($1,gen_random_uuid())","SELECT leave_circle($1)","SELECT respond_circle_join_request($1,auth.uid(),true)","SELECT send_circle_invitation($1,auth.uid(),'admin')","SELECT remove_circle_member($1,auth.uid())"]) {
    await assert.rejects(q(sql,[circle]),/permission denied/);
  }
});

test('direct inserts, self-approval, role escalation and deletes are denied', async () => {
  for (const sql of ["INSERT INTO circle_members(circle_id,user_id,role,status) VALUES($1,auth.uid(),'creator','active')","UPDATE circle_members SET role='admin',status='active' WHERE circle_id=$1","DELETE FROM circle_members WHERE circle_id=$1"]) {
    await assert.rejects(q(sql,[circle]),/permission denied/);
  }
});

test('banned and removed memberships remain restricted and cannot rejoin or clear their status', async () => {
  for (const status of ['banned','removed']) {
    await configure("INSERT INTO circle_members(circle_id,user_id,status) VALUES($1,$2,$3) ON CONFLICT(circle_id,user_id) DO UPDATE SET status=EXCLUDED.status",[circle,member,status]);
    assert.equal((await state()).state,'restricted');
    await assert.rejects(join(),/restricted/);
    await q('SELECT leave_circle($1)',[circle]);
    assert.equal((await state()).status,status);
  }
});

test('before-join subscriptions require active access; valid subscribers can join without another purchase', async () => {
  await configure("UPDATE circles SET subscription_enabled=true,subscription_method='before_join' WHERE id=$1",[circle]);
  assert.equal((await join()).state,'subscription_required');
  await subscribe("now()-interval '1 second'");
  assert.equal((await join()).state,'subscription_required');
  await subscribe("now()+interval '1 month'",true);
  assert.equal((await join()).state,'subscription_required');
  await subscribe();
  assert.equal((await state()).state,'join');
  assert.equal((await join()).state,'joined');
  assert.equal((await q('SELECT count(*)::int n FROM circle_payment_requests'))[0].n,0);
});

test('expiry or refund never replaces Joined with Join; after-join subscriptions do not block free joining', async () => {
  await configure('UPDATE circles SET subscription_enabled=true WHERE id=$1',[circle]);
  assert.equal((await join()).state,'joined');
  await subscribe();
  assert.equal((await state()).premium_locked,false);
  await subscribe("now()-interval '1 second'");
  const result=await state();
  assert.equal(result.state,'joined');
  assert.equal(circleMembershipAction(result).canSubscribe,true);
  await subscribe("now()+interval '1 month'",true);
  assert.equal((await state()).state,'joined');
});

test('management permissions do not grant non-owner admins premium subscriptions', async () => {
  await configure('UPDATE circles SET subscription_enabled=true WHERE id=$1',[circle]);
  await configure("INSERT INTO circle_members(circle_id,user_id,role,status) VALUES($1,$2,'admin','active')",[circle,member]);
  const manager=await state();
  assert.equal(manager.state,'manager');
  assert.equal(manager.premium_locked,true);
  assert.equal(circleMembershipAction(manager).canSubscribe,true);
  await login(owner);
  assert.equal((await state()).premium_locked,false);
});

test('a pending premium requester must renew before approval and remains pending on failure', async () => {
  await configure("UPDATE circles SET is_private=true,subscription_enabled=true,subscription_method='before_join' WHERE id=$1",[circle]);
  await subscribe(); await join(); await subscribe("now()-interval '1 second'");
  await login(owner); await assert.rejects(respond(),/renew/);
  await login(); assert.equal((await state()).state,'pending');
  await subscribe(); await login(owner); await respond();
  await login(); assert.equal((await state()).state,'joined');
});

test('inactive Circles deny new memberships and retain owner management', async () => {
  await configure('UPDATE circles SET is_active=false WHERE id=$1',[circle]);
  assert.equal((await state()).state,'unavailable');
  await assert.rejects(join(),/unavailable/);
  await login(owner); assert.equal((await state()).state,'owner');
});

test('manager invitation acceptance and ownership transfer preserve rows and are idempotent', async () => {
  await login(owner);
  const send=async(type: string) => (await q('SELECT send_circle_invitation($1,$2,$3) id',[circle,member,type]))[0].id;
  const invitation=await send('admin');
  assert.equal(await send('admin'),invitation);
  await login(other);
  await assert.rejects(q('SELECT accept_circle_invitation($1,$2)',[invitation,member]),/not authorized/);
  await login();
  await q('SELECT respond_circle_invitation($1,true)',[invitation]);
  await q('SELECT respond_circle_invitation($1,true)',[invitation]);
  assert.equal((await state()).state,'manager');
  await login(owner);
  const transfer=await send('transfer_ownership');
  await login();
  await q('SELECT respond_circle_invitation($1,true)',[transfer]);
  assert.equal((await state()).state,'owner');
  assert.equal(await stats(),2);
  await login(owner); assert.equal((await state()).state,'joined');
});

test('invitations cannot be forged, edited, accepted by other users or replayed after owner changes', async () => {
  await assert.rejects(q("SELECT send_circle_invitation($1,$2,'admin')",[circle,other]),/Only the owner/);
  await assert.rejects(q("INSERT INTO circle_invitations(circle_id,inviter_id,invitee_id,invitation_type) VALUES($1,$2,$3,'admin')",[circle,owner,member]),/permission denied/);
  await login(owner);
  const invitation=(await q("SELECT send_circle_invitation($1,$2,'transfer_ownership') id",[circle,member]))[0].id;
  await configure('UPDATE circles SET creator_id=$1 WHERE id=$2',[other,circle]);
  await assert.rejects(q('SELECT respond_circle_invitation($1,true)',[invitation]),/no longer valid/);
});

test('platform moderation blocks rejoin but cannot remove the owner', async () => {
  await join();
  await assert.rejects(q('SELECT remove_circle_member($1,$2)',[circle,member]),/Platform admin/);
  await login(admin); await q('SELECT remove_circle_member($1,$2)',[circle,member]);
  await assert.rejects(q('SELECT remove_circle_member($1,$2)',[circle,owner]),/owner cannot/);
  await login(); assert.equal((await state()).state,'restricted');
});

test('declined invitations cannot later be accepted and banned invitees cannot gain a role', async () => {
  await login(owner);
  const invitation=(await q("SELECT send_circle_invitation($1,$2,'admin') id",[circle,member]))[0].id;
  await login();
  assert.equal((await q('SELECT respond_circle_invitation($1,false) result',[invitation]))[0].result,false);
  assert.equal((await q('SELECT respond_circle_invitation($1,true) result',[invitation]))[0].result,false);
  assert.equal((await state()).state,'join');
  await login(owner);
  const bannedInvitation=(await q("SELECT send_circle_invitation($1,$2,'admin') id",[circle,member]))[0].id;
  await configure("INSERT INTO circle_members(circle_id,user_id,status) VALUES($1,$2,'banned')",[circle,member]);
  await assert.rejects(q('SELECT respond_circle_invitation($1,true)',[bannedInvitation]),/restricted/);
  assert.equal((await state()).state,'restricted');
});

test('missing Circles and request IDs reused for another Circle fail safely', async () => {
  assert.equal((await q('SELECT get_circle_membership_state($1) result',[id(88)]))[0].result.state,'unavailable');
  const request=randomUUID(); await join(request);
  await configure("INSERT INTO circles(id,creator_id,name) VALUES($1,$2,'Other Circle')",[id(11),owner]);
  await assert.rejects(q('SELECT join_circle($1,$2)',[id(11),request]),/another Circle/);
});

test('real cards and buttons render every server state consistently without a misleading Join', async () => {
  const labels={ guest:'Sign in', owner:'Manage', manager:'Manage', joined:'Joined', pending:'Pending approval', join:'Join', subscription_required:'Subscribe', restricted:'Membership restricted', unavailable:'Unavailable' };
  for (const [state,label] of Object.entries(labels)) {
    const snapshot={ circle_id:circle,user_id:member,state,premium_locked:state==='joined' };
    const button=renderToStaticMarkup(React.createElement(MembershipButton,{snapshot,onClick() {}}));
    const card=renderToStaticMarkup(React.createElement(CircleCard,{circle:{id:circle,name:'Circle',description:'',category:'community',circle_type:'community',creator_id:owner,membership_state:snapshot},onClick() {}}));
    assert.ok(button.includes(`>${label}</button>`),button);
    assert.ok(card.includes(`>${label}</button>`),card);
    if (state!=='join') assert.ok(!card.includes('>Join</button>'));
    if (['pending','restricted','unavailable'].includes(state)) assert.ok(button.includes('disabled=""'));
  }
  const unknown=renderToStaticMarkup(React.createElement(MembershipButton,{onClick() {}}));
  assert.ok(unknown.includes('Checking membership'));
  assert.ok(unknown.includes('disabled=""'));
});

test('membership snapshots reload from the backend; invalidation covers every Circle screen', async () => {
  const client={ rpc:async(name: string,args: any) => ({data:(await q(`SELECT ${name}($1::uuid[]) result`,[args._circle_ids]))[0].result,error:null}) } as any;
  const initial=await fetchCircleMemberships(client,[circle],member);
  const first=new QueryClient(); first.setQueryData(['circles',member],initial.get(circle));
  const second=new QueryClient(); hydrate(second,dehydrate(first));
  await join();
  second.setQueryDefaults(['circles'],{queryFn: async()=> (await fetchCircleMemberships(client,[circle],member)).get(circle)});
  await refreshCircleMembership(second);
  assert.equal(second.getQueryState(['circles',member])?.isInvalidated,true);
  const fresh=await second.fetchQuery<CircleMembershipSnapshot>({queryKey:['circles',member]});
  assert.equal(fresh.state,'joined');
  assert.throws(()=>validateCircleSnapshot(fresh,circle,other),/Could not verify/);
  const seen: string[]=[];
  await refreshCircleMembership({invalidateQueries: async({queryKey}: any)=>{seen.push(queryKey[0]);}} as any);
  for (const key of ['circle','circles','circles-search','my-circles','owned-circles','circle-invite-preview','circle-members','circle-join-requests','circle-invitations']) assert.ok(seen.includes(key));
});

test('client double-clicks share one request and lost responses retry the same persisted request ID', async () => {
  const saved=storage(); let calls=0; let lastRequest=''; let fail=true;
  const client={rpc:async(_name: string,args: any)=>{
    calls++; if (lastRequest) assert.equal(args._request_id,lastRequest); lastRequest=args._request_id;
    const result=await join(args._request_id);
    if (fail) return {data:null,error:new Error('Response lost')};
    return {data:result,error:null};
  }} as any;
  const one=requestCircleJoin(client,circle,member,saved), two=requestCircleJoin(client,circle,member,saved);
  assert.equal(one,two);
  await assert.rejects(one,/Response lost/);
  assert.equal(calls,1);
  fail=false;
  assert.equal((await requestCircleJoin(client,circle,member,saved)).state,'joined');
  assert.equal(calls,2); assert.equal(await stats(),2);
});

test('snapshot failures and snapshots for a previous account never default to Join', async () => {
  await assert.rejects(fetchCircleMemberships({rpc:async()=>({error:new Error('Network unavailable')})} as any,[circle],member),/Network/);
  await assert.rejects(fetchCircleMemberships({rpc:async()=>({data:[{circle_id:circle,user_id:other,state:'join'}],error:null})} as any,[circle],member),/verify/);
});

test('membership checks are paginated independently of Circle list pagination', async () => {
  const ids=Array.from({length:205},(_,index)=>id(index+1000));
  const sizes: number[]=[];
  const client={ rpc:async(_name: string,args: any) => {
    sizes.push(args._circle_ids.length);
    return {data:args._circle_ids.map((circle_id: string)=>({circle_id,user_id:member,state:'join'})),error:null};
  }} as any;
  assert.equal((await fetchCircleMemberships(client,ids,member)).size,205);
  assert.deepEqual(sizes,[100,100,5]);
});

test('login returns to Circle and invite routes, preserves sharing, and rejects external redirects', () => {
  for (const path of [`/circle/${circle}`,`/circle/${circle}?tab=learn`,`/circle/${circle}/dashboard`,'/join/invite123',`/share?draft=${circle}`]) {
    assert.equal(authReturnPath(circleLoginPath(path).split('?')[1]),path);
  }
  for (const path of ['https://evil.test','//evil.test','/\\evil.test','/circle/../../evil','/join/invite123?returnTo=https://evil.test']) assert.equal(authReturnPath(`?returnTo=${encodeURIComponent(path)}`),'/');
});

const leave = async (request = randomUUID()) => (await q('SELECT leave_circle($1,$2) result',[circle,request]))[0].result as CircleLeaveResult;
const leaveClient = () => ({ rpc: async (_name: string, args: any) => ({ data: await leave(args._request_id), error: null }) }) as any;

test('every non-owner active role can leave, including an inactive Circle, without deleting records', async () => {
  for (const role of ['member','moderator','admin','creator']) {
    await configure("INSERT INTO circle_members(circle_id,user_id,role,status) VALUES($1,$2,$3,'active') ON CONFLICT(circle_id,user_id) DO UPDATE SET role=EXCLUDED.role,status='active'",[circle,member,role]);
    assert.equal(circleMembershipAction(await state()).canLeave,true);
    const result=await leave();
    assert.equal(result.leave_confirmed,true);
    assert.equal(result.membership_changed,true);
    assert.equal(result.status,'left');
    assert.equal(result.members_count,1);
    assert.equal((await q('SELECT role FROM circle_members WHERE circle_id=$1 AND user_id=$2',[circle,member]))[0].role,'member');
    await login(owner); assert.equal((await state()).status,'active'); await login();
  }
  await join();
  await configure('UPDATE circles SET is_active=false WHERE id=$1',[circle]);
  assert.equal(circleMembershipAction(await state()).canLeave,true);
  assert.equal((await leave()).leave_confirmed,true);
  assert.equal(await stats(),1);
});

test('leaving cannot target another user and rejects anonymous calls and direct deletes', async () => {
  await join();
  await login(other);
  const result=await leave();
  assert.equal(result.leave_confirmed,false);
  assert.equal(result.membership_changed,false);
  assert.equal(await stats(),2);
  await assert.rejects(q('SELECT leave_circle(_circle_id => $1, _user_id => $2)',[circle,member]),/does not exist/);
  await assert.rejects(q('DELETE FROM circle_members WHERE user_id=$1',[member]),/permission denied/);
  await login(); assert.equal((await state()).status,'active');
  await login(null); await assert.rejects(leave(),/permission denied/);
});

test('owners cannot leave while a transfer is pending; after acceptance they may explicitly leave as members', async () => {
  await login(owner);
  assert.equal(circleMembershipAction(await state()).canLeave,false);
  const invitation=(await q("SELECT send_circle_invitation($1,$2,'transfer_ownership') id",[circle,member]))[0].id;
  await assert.rejects(leave(),/Transfer ownership and wait/);
  await login(); await q('SELECT respond_circle_invitation($1,true)',[invitation]);
  await login(owner);
  assert.equal(circleMembershipAction(await state()).canLeave,true);
  assert.equal((await leave()).status,'left');
  await login(); assert.equal((await state()).state,'owner');
  assert.equal(await stats(),1);
});

test('leaving paid private Circles preserves subscription, renewal settings and paid access exactly', async () => {
  await configure("UPDATE circles SET is_private=true,subscription_enabled=true,subscription_method='before_join' WHERE id=$1",[circle]);
  await subscribe(); await join(); await login(owner); await respond(); await login();
  for (const cancelled of [false,true]) {
    await configure('UPDATE circle_subscriptions SET cancel_at_period_end=$1 WHERE circle_id=$2',[cancelled,circle]);
    const before=await q('SELECT * FROM circle_subscriptions WHERE circle_id=$1',[circle]);
    const result=await leave();
    assert.equal(result.leave_confirmed,true);
    assert.equal(result.has_subscription,true);
    assert.equal(result.circle_visible,true);
    assert.equal(result.state,'join');
    assert.equal(await stats(),1);
    assert.deepEqual(await q('SELECT * FROM circle_subscriptions WHERE circle_id=$1',[circle]),before);
    assert.equal((await q('SELECT get_circle_subscription($1) result',[circle]))[0].result.cancel_at_period_end,cancelled);
    assert.equal((await q('SELECT id FROM circles WHERE id=$1',[circle])).length,1);
    assert.equal((await q('SELECT count(*)::int n FROM circle_payment_requests'))[0].n,0);
    // Rejoin deliberately before checking the other renewal setting.
    await join(); await login(owner); await respond(); await login();
  }
  await leave();
  await q('SELECT cancel_circle_subscription($1)',[circle]);
  assert.equal((await q('SELECT get_circle_subscription($1) result',[circle]))[0].result.cancel_at_period_end,true);
});

test('repeated leave requests count once and cannot leave a later rejoined membership', async () => {
  await join();
  const request=randomUUID();
  const results=await Promise.all([leave(request),leave(request),leave()]);
  assert.equal(results.filter(result=>result.membership_changed).length,1);
  assert.ok(results.every(result=>result.leave_confirmed));
  assert.equal(await stats(),1);
  await join();
  const stale=await leave(request);
  assert.equal(stale.replayed,true);
  assert.equal(stale.leave_confirmed,false);
  assert.equal(stale.status,'active');
  assert.equal(await stats(),2);
});

test('leaving preserves expired subscription history and existing one-time purchases', async () => {
  await join();
  await configure('UPDATE circles SET is_private=true,subscription_enabled=true WHERE id=$1',[circle]);
  await subscribe("now()-interval '1 day'");
  await configure('INSERT INTO posts(id,circle_id,user_id,is_premium) VALUES($1,$2,$3,true)',[id(22),circle,owner]);
  await configure('INSERT INTO post_unlocks(post_id,user_id,amount_paid) VALUES($1,$2,5)',[id(22),member]);
  const subscription=await q('SELECT * FROM circle_subscriptions WHERE circle_id=$1',[circle]);
  const purchase=await q('SELECT * FROM post_unlocks WHERE post_id=$1',[id(22)]);
  await leave();
  assert.deepEqual(await q('SELECT * FROM circle_subscriptions WHERE circle_id=$1',[circle]),subscription);
  assert.deepEqual(await q('SELECT * FROM post_unlocks WHERE post_id=$1',[id(22)]),purchase);
  assert.equal((await q("SELECT circle_content_access('post',$1,auth.uid()) access",[id(22)]))[0].access,true);
});

test('API failure rolls back membership, count and leave intent with no partial success', async () => {
  await join();
  await db.exec('RESET ROLE');
  await db.exec("CREATE FUNCTION reject_test_leave() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='left' THEN RAISE EXCEPTION 'Leave processing failed'; END IF; RETURN NEW; END $$; CREATE TRIGGER zz_reject_test_leave AFTER UPDATE ON circle_members FOR EACH ROW EXECUTE FUNCTION reject_test_leave()");
  try {
    await login();
    await assert.rejects(leave(),/Leave processing failed/);
    assert.equal((await state()).status,'active');
    assert.equal(await stats(),2);
    await db.exec('RESET ROLE');
    assert.equal((await q('SELECT count(*)::int n FROM circle_leave_intents'))[0].n,0);
  } finally {
    await db.exec('RESET ROLE; DROP TRIGGER zz_reject_test_leave ON circle_members; DROP FUNCTION reject_test_leave()');
  }
});

test('confirmed leave updates all cached lists, flags and counts immediately without changing subscription data', async () => {
  await join();
  const snapshot=await state();
  const client=new QueryClient();
  const card={id:circle,creator_id:owner,is_joined:true,is_admin:true,member_role:'admin',members_count:99,membership_state:snapshot};
  const otherCard={...card,id:id(44)};
  client.setQueryData(['circles',member],[card,otherCard]);
  client.setQueryData(['circles',other],[card]);
  client.setQueryData(['circles-search','circle',member],[{...card,members_count:73}]);
  client.setQueryData(['my-circles',member,'non-owner-memberships'],[card]);
  client.setQueryData(['owned-circles',member,'creator-ownership'],[card]);
  client.setQueryData(['circle',circle,member],card);
  client.setQueryData(['circle-invite-preview','invite123',member],card);
  client.setQueryData(['circle-members',circle],[{user_id:member},{user_id:owner}]);
  client.setQueryData(['circle-subscription',circle,member],{id:'subscription',cancel_at_period_end:false});
  const result=await requestCircleLeave(leaveClient(),circle,member,storage());
  await applyCircleLeaveResult(client,result);
  assert.deepEqual(client.getQueryData(['my-circles',member,'non-owner-memberships']),[]);
  assert.deepEqual(client.getQueryData(['owned-circles',member,'creator-ownership']),[]);
  for (const key of [['circle',circle,member],['circle-invite-preview','invite123',member]]) {
    const cached=client.getQueryData<any>(key);
    assert.equal(cached.members_count,1);
    assert.equal(cached.is_joined,false);
    assert.equal(cached.is_admin,false);
    assert.equal(cached.membership_state.status,'left');
  }
  assert.equal(client.getQueryData<any[]>(['circles-search','circle',member])![0].members_count,1);
  const otherAccount=client.getQueryData<any[]>(['circles',other])![0];
  assert.equal(otherAccount.is_joined,true);
  assert.equal(otherAccount.members_count,1);
  assert.deepEqual(client.getQueryData(['circle-members',circle]),[{user_id:owner}]);
  assert.deepEqual(client.getQueryData(['circle-subscription',circle,member]),{id:'subscription',cancel_at_period_end:false});
  assert.equal(client.getQueryData<any[]>(['circles',member])![1].members_count,99);
});

test('private unsubscribed Circles disappear from browse/search as well as Joined after leaving', async () => {
  await configure('UPDATE circles SET is_private=true WHERE id=$1',[circle]);
  await join(); await login(owner); await respond(); await login();
  const result=await leave();
  assert.equal(result.circle_visible,false);
  const client=new QueryClient();
  for (const key of [['circles',member],['circles-search','circle',member],['my-circles',member]]) client.setQueryData(key,[{id:circle}]);
  await applyCircleLeaveResult(client,result);
  for (const key of [['circles',member],['circles-search','circle',member],['my-circles',member]]) assert.deepEqual(client.getQueryData(key),[]);
});

test('stale in-flight requests cannot restore Joined after a confirmed leave', async () => {
  await join();
  const client=new QueryClient();
  const key=['circle',circle,member];
  const old={id:circle,is_joined:true,members_count:2};
  client.setQueryData(key,old);
  let resolve: (value: any)=>void;
  const fetching=client.fetchQuery({queryKey:key,queryFn:()=>new Promise(done=>{resolve=done;})}).catch(()=>{});
  await applyCircleLeaveResult(client,await leave());
  resolve!(old); await fetching;
  assert.equal(client.getQueryData<any>(key).is_joined,false);
  assert.equal(client.getQueryData<any>(key).members_count,1);
});

test('client double-clicks and retries share a leave ID; lost responses cannot show a false success', async () => {
  await join();
  let calls=0, requestId='', fail=true;
  const saved=storage();
  const client={rpc:async(name: string,args: any)=>{
    assert.equal(name,'leave_circle');
    assert.deepEqual(Object.keys(args).sort(),['_circle_id','_request_id']);
    if (requestId) assert.equal(args._request_id,requestId);
    requestId=args._request_id; calls++;
    const data=await leave(args._request_id);
    return fail ? {data:null,error:new Error('Response lost')} : {data,error:null};
  }} as any;
  const first=requestCircleLeave(client,circle,member,saved);
  assert.equal(requestCircleLeave(client,circle,member,saved),first);
  await assert.rejects(first,/Response lost/);
  assert.equal(calls,1);
  assert.equal(await stats(),1);
  fail=false;
  assert.equal((await requestCircleLeave(client,circle,member,saved)).leave_confirmed,true);
  assert.equal(calls,2);
  assert.equal(await stats(),1);
});

test('client never accepts an empty, wrong-account, owner or unconfirmed leave response as success', async () => {
  for (const data of [null,{circle_id:circle,user_id:other,state:'join',status:'left',leave_confirmed:true,members_count:1},
    {circle_id:circle,user_id:member,state:'owner',status:'active',leave_confirmed:true,members_count:2},
    {circle_id:circle,user_id:member,state:'joined',status:'active',leave_confirmed:false,members_count:2}]) {
    await assert.rejects(requestCircleLeave({rpc:async()=>({data,error:null})} as any,circle,member,storage()),/verify|not confirmed/);
  }
  assert.equal(circleMembershipAction({circle_id:circle,user_id:member,creator_id:owner,state:'pending',status:'pending'}).canLeave,false);
});
