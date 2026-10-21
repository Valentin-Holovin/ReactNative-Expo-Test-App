import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionController, TOKEN_STORAGE_KEY } from '../src/session/controller.ts';

const balances = { asOf: '2026-10-21T19:00:00Z', items: [] };
function setup(saved = null) {
  const state = { saved, requests: [], events: [], fail: null, storageFail: false, wait: null, entries: new Map() };
  const controller = createSessionController({
    storage: {
      async getItem(key) { assert.equal(key, TOKEN_STORAGE_KEY); return state.saved; },
      async setItem(key, value) {
        if (state.storageFail) throw new Error('blocked');
        state.saved = value;
      },
      async removeItem() { state.saved = null; },
    },
    createApi(token) {
      return { async getBalances({ signal }) {
        state.requests.push({ token, signal });
        if (state.wait) await state.wait;
        if (state.fail) throw state.fail;
        return balances;
      } };
    },
    cache: {
      async cancelQueries() { state.events.push('cancel'); },
      clear() { state.events.push('clear'); state.entries.clear(); },
      setQueryData(key, data) { state.entries.set(JSON.stringify(key), data); },
    },
  });
  const signal = () => new AbortController().signal;
  return { state, controller, signal };
}

test('first open does not send a request without a token', async () => {
  const { controller, state, signal } = setup();
  await controller.restore(signal());
  assert.equal(controller.getSnapshot().restoring, false);
  assert.equal(controller.getSnapshot().session, null);
  assert.equal(state.requests.length, 0);
});

test('validates and trims token before saving; seeds cache without credentials', async () => {
  const { controller, state, signal } = setup();
  await controller.restore(signal());
  await controller.connect('  example-token  ', signal());
  assert.equal(state.saved, 'example-token');
  assert.equal(state.requests[0].token, 'example-token');
  assert.deepEqual(state.events, ['cancel', 'clear']);
  assert.equal(controller.getSnapshot().session.id, 1);
  assert.deepEqual([...state.entries.keys()], ['["session",1,"balances"]']);
  assert.equal(state.entries.get('["session",1,"balances"]'), balances);
});

test('rejects invalid replacement and keeps old session, storage and cache', async () => {
  const { controller, state, signal } = setup('old-token');
  await controller.restore(signal());
  const old = controller.getSnapshot().session;
  state.fail = { code: 'UNAUTHORIZED' };
  await assert.rejects(controller.connect('bad-token', signal()));
  assert.equal(state.saved, 'old-token');
  assert.equal(controller.getSnapshot().session, old);
  assert.equal(state.events.length, 2);
});

test('switching account clears previous cache and changes session ID', async () => {
  const { controller, state, signal } = setup('first-token');
  await controller.restore(signal());
  state.entries.set('old-claim', {});
  await controller.connect('second-token', signal());
  assert.equal(controller.getSnapshot().session.id, 2);
  assert.deepEqual([...state.entries.keys()], ['["session",2,"balances"]']);
  assert.deepEqual(state.events, ['cancel', 'clear', 'cancel', 'clear']);
});

test('restores saved token and deletes only an unauthorized token', async () => {
  const { controller, state, signal } = setup('expired-token');
  state.fail = { code: 'UNAUTHORIZED' };
  await controller.restore(signal());
  assert.equal(state.saved, null);
  assert.match(controller.getSnapshot().error, /expired/);
  assert.equal(controller.getSnapshot().session, null);
});

test('network failure preserves saved token so restoration can be retried', async () => {
  const { controller, state, signal } = setup('saved-token');
  state.fail = { code: 'NETWORK' };
  await controller.restore(signal());
  assert.equal(state.saved, 'saved-token');
  assert.match(controller.getSnapshot().error, /connection/);
  state.fail = null;
  await controller.restore(signal());
  assert.ok(controller.getSnapshot().session);
  assert.equal(controller.getSnapshot().error, null);
});

test('storage failure preserves existing active session', async () => {
  const { controller, state, signal } = setup('old-token');
  await controller.restore(signal());
  const old = controller.getSnapshot().session;
  state.storageFail = true;
  await assert.rejects(controller.connect('new-token', signal()), /save the token/);
  assert.equal(state.saved, 'old-token');
  assert.equal(controller.getSnapshot().session, old);
});

test('aborted validation does not save or activate token', async () => {
  const { controller, state, signal } = setup();
  await controller.restore(signal());
  const request = new AbortController();
  request.abort();
  await controller.connect('token', request.signal);
  assert.equal(state.saved, null);
  assert.equal(state.requests.length, 0);
});

test('rate limit exposes retry time and preserves storage', async () => {
  const { controller, state, signal } = setup('saved-token');
  const before = Date.now();
  state.fail = { code: 'RATE_LIMITED', retryAfterMs: 2300 };
  await controller.restore(signal());
  assert.ok(controller.getSnapshot().retryAt >= before + 2300);
  assert.equal(state.saved, 'saved-token');
});

test('aborting an in-flight verification prevents saving and activation', async () => {
  const { controller, state, signal } = setup();
  await controller.restore(signal());
  let release;
  state.wait = new Promise(resolve => { release = resolve; });
  const request = new AbortController();
  const attempt = controller.connect('token', request.signal);
  request.abort();
  release();
  await attempt;
  assert.equal(state.saved, null);
  assert.equal(controller.getSnapshot().session, null);
});

test('double submission sends only one verification request', async () => {
  const { controller, state, signal } = setup();
  await controller.restore(signal());
  let release;
  state.wait = new Promise(resolve => { release = resolve; });
  const attempt = controller.connect('token', signal());
  await assert.rejects(controller.connect('token', signal()), /already in progress/);
  assert.equal(state.requests.length, 1);
  release();
  await attempt;
});
