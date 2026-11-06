export const fixture={
  user:{id:'fixture-user',name:'Hana Tesfaye',username:'hana.tesfaye',initials:'HT',avatar:'',isOnline:false},
  balance:1250,signOuts:0,refreshes:0,
};
(window as any).profileMenuFixture=fixture;
if(localStorage.getItem('menu-state')==='long'){
  fixture.user.name='Hana Tesfaye with a very long account display name';
  fixture.user.username='hana.tesfaye.with.a.long.username';fixture.balance=2147483647;
}
export const supabase={auth:{signOut:async()=>{fixture.signOuts++;return {error:null};}}};
