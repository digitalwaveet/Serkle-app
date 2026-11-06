export const fixture = {
  calls: [] as Array<{ operation: string; value?: unknown }>,
  localPayments: [] as string[],
  closed: 0,
  items: [{ id:'cart-item',shopItemId:'item-id',title:'Fixture item',price:20,quantity:1,stock:5,category:'books',image:'',seller:{id:'seller-id',name:'Seller',avatar:''} }],
};
(window as any).shopCheckoutFixture = fixture;

export const cart = {
  items:fixture.items,isCheckoutOpen:true,
  closeCheckout:()=>{fixture.closed++;},getCartTotal:()=>20,
  createOrder:(_address:any,payment:any)=>{fixture.localPayments.push(payment.type);return {id:'local-order'};},
  setCurrentOrder:()=>{},clearCart:()=>{},
};

export const supabase = {
  auth:{getUser:async()=>{fixture.calls.push({operation:'auth'});return {data:{user:{id:'buyer-id'}}};}},
  rpc:async(name:string,args:any)=>{
    fixture.calls.push({operation:name,value:args});
    if(name==='generate_order_number') return {data:'ORDER-FIXTURE',error:null};
    if(name==='update_item_stock') return {data:true,error:null};
    throw new Error('Unexpected payment RPC: '+name);
  },
  from:(table:string)=>{
    if(!['orders','order_items','seller_profiles'].includes(table)) throw new Error('Unexpected wallet/database access: '+table);
    const query={
      insert:(value:any)=>{fixture.calls.push({operation:'insert:'+table,value});return query;},
      select:()=>query,eq:()=>query,
      single:async()=>({data:{id:'server-order'},error:null}),
      maybeSingle:async()=>({data:null,error:null}),
      then:(resolve:any,reject:any)=>Promise.resolve({data:null,error:null}).then(resolve,reject),
    };
    return query;
  },
};
