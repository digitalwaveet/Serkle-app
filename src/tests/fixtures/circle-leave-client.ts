// Browser-only fixture. No live Supabase credentials, requests or payments.
const id='00000000-0000-0000-0000-000000000010';
const owner='00000000-0000-0000-0000-000000000002';
const options=new URLSearchParams(location.search);
const owned=options.get('role')==='owner';
const manager=options.get('role')==='admin';
export const fixture = {
  id, user:{id:owned ? owner : '00000000-0000-0000-0000-000000000001',email:'fixture@example.test'},
  status:'active', calls:0, fail:false, hold:false, release:undefined as undefined | (()=>void), members:2,
};
const subscription=options.has('paid') ? {id:'paid',expires_at:'2099-12-01T00:00:00Z',cancel_at_period_end:false} : null;
function snapshot() {
  return { circle_id:id,creator_id:owner,user_id:fixture.user.id,status:fixture.status,
    state:owned ? 'owner' : fixture.status==='active' ? (manager ? 'manager' : 'joined') : 'join',
    role:owned ? 'creator' : manager && fixture.status==='active' ? 'admin' : 'member',
    has_subscription:!!subscription,premium_locked:false };
}
function row() {
  return { id,name:'Test Circle',description:'A test Circle',creator_id:owner,category:'community',is_private:options.has('private'),
    is_active:true,subscription_enabled:!!subscription,subscription_method:'before_join',subscription_price:10,
    circle_type:'community',enabled_features:['posts'],created_at:'2026-01-01T00:00:00Z',
    circle_stats:{members_count:fixture.members},profiles:{name:'Owner',username:'owner'} };
}
export function card() { return {...row(),members_count:fixture.members,membership_state:snapshot(),is_joined:fixture.status==='active'}; }
export const supabase={
  rpc:async(name: string,args: any)=>{
    if(name==='get_circle_membership_states') return {data:[snapshot()],error:null};
    if(name==='get_circle_subscription') return {data:subscription,error:null};
    if(name==='leave_circle') {
      fixture.calls++;
      if(fixture.hold) await new Promise<void>(resolve=>{fixture.release=resolve;});
      if(fixture.fail) return {data:null,error:{message:'Network unavailable. Please retry.'}};
      fixture.status='left'; fixture.members=1;
      return {data:{...snapshot(),leave_confirmed:true,membership_changed:true,replayed:false,members_count:fixture.members,circle_visible:true},error:null};
    }
    if(name==='cancel_circle_subscription') { if(subscription) subscription.cancel_at_period_end=true; return {data:null,error:null}; }
    throw new Error(`Unexpected fixture RPC ${name}`);
  },
  from:(table: string)=>{
    const builder={ select:()=>builder, eq:()=>builder, upsert:async()=>({error:null}),
      single:async()=>({data:table==='circles' ? row() : null,error:null}),maybeSingle:async()=>({data:null,error:null}) };
    return builder;
  },
};
(window as any).leaveFixture=fixture;
