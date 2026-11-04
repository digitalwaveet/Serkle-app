import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FunctionsHttpError, FunctionsFetchError } from '@supabase/supabase-js';
import { edgeFunctionErrorMessage } from '../lib/edgeFunctionError.ts';

test('checkout displays the function validation error and preserves the original response', async () => {
  const body = { success: false, error: 'Invalid payment return URL' };
  const response = Response.json(body, { status: 400 });
  assert.equal(await edgeFunctionErrorMessage(new FunctionsHttpError(response)), body.error);
  assert.deepEqual(await response.json(), body);
});

test('gateway authentication and configuration errors are readable', async () => {
  for (const body of [{ message: 'Invalid JWT' }, { msg: 'Missing authorization header' },
    { error: 'Payment service is not configured. Check the Supabase payment secrets.' }]) {
    const expected = Object.values(body)[0];
    assert.equal(await edgeFunctionErrorMessage(new FunctionsHttpError(Response.json(body, { status: 401 }))), expected);
  }
});

test('non-JSON gateway pages, malformed JSON and unhelpful bodies keep the SDK fallback', async () => {
  for (const response of [new Response('<html>Bad Gateway</html>', { status: 502 }),
    new Response('{', { status: 503 }), Response.json({ error: {}, message: '' }, { status: 400 }),
    Response.json(null, { status: 500 })]) {
    const error = new FunctionsHttpError(response);
    assert.equal(await edgeFunctionErrorMessage(error), error.message);
  }
});

test('an already-read response does not prevent handling the original error', async () => {
  const response = Response.json({ error: 'A valid receipt email is required' }, { status: 400 });
  await response.json();
  const error = new FunctionsHttpError(response);
  assert.equal(await edgeFunctionErrorMessage(error), error.message);
});

test('network failures and errors without a response remain readable', async () => {
  const error = new FunctionsFetchError(new Error('Offline'));
  assert.equal(await edgeFunctionErrorMessage(error), error.message);
  assert.equal(await edgeFunctionErrorMessage(new Error('Timed out')), 'Timed out');
  assert.equal(await edgeFunctionErrorMessage(null), 'Request failed. Please try again.');
});
