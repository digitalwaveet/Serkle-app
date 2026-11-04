import { supabase } from '../integrations/supabase/client';

// Temporary read-only integration checks; deliberately never expose tokens,
// message contents, conversation IDs, or private file paths in the report.
const output = document.querySelector('#results')!;
const lines: string[] = [];
const report = (name: string, state: string, detail = '') => {
  lines.push(`${state}: ${name}${detail ? ` — ${detail}` : ''}`);
  output.textContent = lines.join('\n');
};
const err = (error: { code?: string; message?: string } | null) =>
  error ? `${error.code || 'error'}: ${error.message || 'Request failed'}` : '';
// These newly deployed functions have not yet been added to generated types.
const rpc = (name: string, args: Record<string, unknown>) =>
  supabase.rpc(name as never, args as never);

async function run() {
  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) {
    report('Existing authenticated session', 'BLOCKED', err(auth.error));
    return;
  }
  const uid = auth.data.user.id;
  report('Existing authenticated session', 'PASS');
  const foreignId = crypto.randomUUID();
  const [list, unread, column, wrongUser, membership, invalidPath, receipts] = await Promise.all([
    supabase.rpc('get_user_conversations', { _user_id: uid }),
    rpc('get_chat_unread_counts', { p_local_reads: {} }),
    supabase.from('messages').select('created_seq', { head: true, count: 'exact' }).is('created_seq', null),
    supabase.rpc('get_user_conversations', { _user_id: foreignId }),
    rpc('chat_member', { p_conversation_id: foreignId }),
    rpc('can_access_chat_object', { p_name: 'invalid/path', p_upload: true }),
    supabase.from('read_receipts').select('conversation_id,user_id,last_read_seq'),
  ]);
  report('Conversation list RPC', list.error ? 'FAIL' : 'PASS', list.error ? err(list.error) : `${list.data?.length ?? 0} conversations`);
  report('Unread-count RPC', unread.error ? 'FAIL' : 'PASS', unread.error ? err(unread.error) : `${(unread.data as unknown[] | null)?.length ?? 0} conversations`);
  report('created_seq column and backfill', column.error ? 'FAIL' : column.count ? 'WARN' : 'PASS', column.error ? err(column.error) : `${column.count} visible rows with null arrival sequence`);
  report('Conversation list rejects another user ID', wrongUser.error?.code === '42501' ? 'PASS' : 'FAIL', err(wrongUser.error) || 'Unexpectedly accepted another user ID');
  report('Unknown-conversation membership denied', !membership.error && membership.data === false ? 'PASS' : 'FAIL', err(membership.error));
  report('Malformed storage path denied', !invalidPath.error && invalidPath.data === false ? 'PASS' : 'FAIL', err(invalidPath.error));
  report('Read receipts SELECT', receipts.error ? 'FAIL' : 'PASS', receipts.error ? err(receipts.error) : `${receipts.data?.filter(r => r.user_id !== uid).length ?? 0} peer receipts visible`);
  const conversations = list.data ?? [];
  if (!conversations.length) {
    report('Member-specific checks', 'SKIP', 'No conversations returned');
    return;
  }
  const cid = conversations[0].conversation_id;
  const cases: [string, string, boolean, boolean][] = [
    ['Member upload path accepted', `${cid}/${uid}/readonly-probe.txt`, true, true],
    ['Another uploader identity denied', `${cid}/${foreignId}/readonly-probe.txt`, true, false],
    ['Member read path accepted', `${cid}/${foreignId}/readonly-probe.txt`, false, true],
    ['Nonmember storage path denied', `${foreignId}/${uid}/readonly-probe.txt`, false, false],
    ['Path traversal denied', `${cid}/${uid}/..`, false, false],
  ];
  for (const [name, path, upload, expected] of cases) {
    const result = await rpc('can_access_chat_object', { p_name: path, p_upload: upload });
    report(name, !result.error && result.data === expected ? 'PASS' : 'FAIL', err(result.error));
  }
  const storage = await supabase.storage.from('chat-media').list(cid, { limit: 1 });
  report('chat-media storage list request', storage.error ? 'FAIL' : 'PASS', err(storage.error));
  if (!unread.error && !list.error) {
    const rows = unread.data as unknown as { conversation_id: string; unread_count: number; last_read_seq: number; latest_seq: number }[];
    const mismatches = conversations.filter(c => !rows.some(r => r.conversation_id === c.conversation_id && Number(r.unread_count) === Number(c.unread_count)));
    report('List and unread RPC counts agree', mismatches.length ? 'FAIL' : 'PASS', `${mismatches.length} mismatches`);
    const hints = Object.fromEntries(rows.map(r => [r.conversation_id, Number(r.latest_seq) + 100]));
    const clamped = await rpc('get_chat_unread_counts', { p_local_reads: hints });
    const hintRows = clamped.data as unknown as typeof rows | null;
    report('Local read hints clamp without writing receipts', !clamped.error && hintRows?.every(r => Number(r.unread_count) === 0 && Number(r.last_read_seq) === Number(r.latest_seq)) ? 'PASS' : 'FAIL', err(clamped.error));
    let checked = 0;
    let mismatch = 0;
    for (const row of rows) {
      const deleted = await supabase.from('message_deletions').select('message_id').eq('user_id', uid);
      if (deleted.error) { report('Independent unread-count comparison', 'BLOCKED', err(deleted.error)); break; }
      let query = supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('conversation_id', row.conversation_id).neq('sender_id', uid)
        .gt('created_seq', row.last_read_seq).or('deleted_for_everyone.is.null,deleted_for_everyone.eq.false');
      const deletedIds = deleted.data.map(d => d.message_id);
      if (deletedIds.length) query = query.not('id', 'in', `(${deletedIds.join(',')})`);
      const count = await query;
      if (count.error) { report('Independent unread-count comparison', 'BLOCKED', err(count.error)); break; }
      checked++;
      if (Number(count.count) !== Number(row.unread_count)) mismatch++;
    }
    if (checked === rows.length) report('Independent unread-count comparison', mismatch ? 'FAIL' : 'PASS', `${checked} conversations checked, ${mismatch} mismatches`);
  }
  const privateMedia = await supabase.from('messages').select('attachment_url').like('attachment_url', 'chat-media://%').limit(1);
  if (privateMedia.error) report('Existing private attachment check', 'BLOCKED', err(privateMedia.error));
  else if (!privateMedia.data.length) report('Existing private attachment check', 'SKIP', 'No private attachments available; no files were uploaded');
  else {
    const path = privateMedia.data[0].attachment_url!.slice('chat-media://'.length);
    const signed = await supabase.storage.from('chat-media').createSignedUrl(path, 60);
    report('Member can sign existing private attachment', signed.error ? 'FAIL' : 'PASS', err(signed.error));
    const publicUrl = supabase.storage.from('chat-media').getPublicUrl(path).data.publicUrl;
    const response = await fetch(publicUrl, { method: 'HEAD', credentials: 'omit' });
    report('Existing private attachment rejects public download', [400, 401, 403, 404].includes(response.status) ? 'PASS' : 'FAIL', `HTTP ${response.status}`);
  }
  report('Write-policy and cross-account end-to-end tests', 'NOT RUN', 'Require disposable test conversation/accounts; existing data left unchanged');
  report('Read-only diagnostic run', 'COMPLETE', new Date().toISOString());
}

void run().catch(error => report('Diagnostic run', 'FAIL', error instanceof Error ? error.message : 'Unexpected error'));
