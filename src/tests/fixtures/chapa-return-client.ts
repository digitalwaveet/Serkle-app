const scenario = localStorage.getItem('chapa-return-fixture') || 'test';
const userId = '00000000-0000-0000-0000-000000000001';
const reference = 'serkle-return-fixture';
export const fixture = {
  user: scenario === 'login' ? null : { id: userId },
  calls: [] as Array<Record<string, unknown>>,
  balance: 0,
};
(window as any).chapaReturnFixture = fixture;

function result(txRef: string, status: string, amount = 500) {
  const live = status === 'success';
  if (live) fixture.balance = amount;
  return { userId, txRef, amount, status, success: live, verified: live,
    message: status === 'test_verified' ? 'Test payment recorded; no spendable coins were added.' : 'Payment status checked.' };
}

export const supabase = {
  functions: { invoke: async (name: string, options: { body?: Record<string, unknown> }) => {
    if (name === 'chapa-transfer') return { data: { success: true, banks: [] }, error: null };
    if (name !== 'chapa-verify') throw new Error('The return page must never initialize or charge a payment');
    const body = options.body || {};
    fixture.calls.push(body);
    await new Promise(resolve => setTimeout(resolve, 30));
    let data: any;
    if (scenario === 'unknown') data = { userId, status: 'unknown', success: false, verified: false, candidates: [], message: 'No recent payment could be identified. Check your wallet history.' };
    else if (scenario === 'selection' && !body.txRef) data = { userId, status: 'selection_required', success: false, verified: false, candidates: [
      { txRef: 'serkle-first', amount: 10, status: 'pending', createdAt: '2026-11-05T09:00:00Z' },
      { txRef: 'serkle-second', amount: 20, status: 'pending', createdAt: '2026-11-05T09:02:00Z' },
    ] };
    else if (scenario === 'selection') data = result(String(body.txRef), 'success', body.txRef === 'serkle-second' ? 20 : 10);
    else if (scenario === 'pending') data = result(String(body.txRef || reference), fixture.calls.length === 1 ? 'pending' : 'success');
    else if (scenario === 'forged') data = { ...result(String(body.txRef || reference), 'pending'), status: 'success', success: true, verified: false };
    else if (scenario === 'failed') data = result(String(body.txRef || reference), 'failed');
    else data = result(String(body.txRef || reference), 'test_verified');
    return { data, error: null };
  } },
  from: (table: string) => {
    const data = () => table === 'coin-wallets' || table === 'coin_wallets'
      ? { user_id: userId, balance: fixture.balance, total_earned: fixture.balance, total_spent: 0 } : [];
    const query = {
      select: () => query, eq: () => query, order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: data(), error: null }),
      then: (resolve: any, reject: any) => Promise.resolve({ data: data(), error: null }).then(resolve, reject),
    };
    return query;
  },
};
