import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClaimController, canStartClaim } from '../src/claims/controller.ts';
import { claimStorageKey } from '../src/claims/browserStorage.ts';

const body = { asset: 'ETH', amount: '0.5', destinationId: 'wallet' };
const quote = { fee: '0.0012', receiveAmount: '0.4988', destinationLabel: 'Wallet' };
const asOf = '2026-10-21T19:00:00.000Z';
function fixture() {
  const state = { records: new Map(), claims: new Map(), posts: [], gets: [], count: 0,
    loseResponse: false, postError: null, getError: null, writeError: false, now: Date.parse(asOf), hold: null };
  let queue = Promise.resolve();
  function withLock(work) {
    const job = queue.then(work);
    queue = job.catch(() => {});
    return job;
  }
  const storage = {
    async getItem(key) { return state.records.get(key) ?? null; },
    async setItem(key, value) { if (state.writeError) throw Error('storage full'); state.records.set(key, value); },
    async removeItem(key) { state.records.delete(key); },
  };
  const api = {
    async createClaim(request, key) {
      state.posts.push({ body: { ...request }, key });
      if (state.hold) await state.hold;
      if (state.postError) throw state.postError;
      let claim = state.claims.get(key);
      if (claim && (claim.asset !== request.asset || claim.amount !== request.amount || claim.destinationId !== request.destinationId)) throw { code: 'IDEMPOTENCY_MISMATCH', status: 409 };
      if (!claim) {
        claim = { ...request, id: `clm_${++state.count}`, fee: quote.fee, receiveAmount: quote.receiveAmount,
          status: 'pending', failureReason: null, createdAt: asOf, updatedAt: asOf };
        state.claims.set(key, claim);
      }
      if (state.loseResponse) { state.loseResponse = false; throw { code: 'TIMEOUT', status: 504 }; }
      return { claim: { ...claim }, replayed: state.posts.length > 1 };
    },
    async getClaim(id) {
      state.gets.push(id);
      if (state.getError) throw state.getError;
      return { ...[...state.claims.values()].find(claim => claim.id === id) };
    },
  };
  let keyId = 0;
  function controller(storageKey = 'scope-A') {
    return createClaimController({ api, storage, storageKey, createKey: () => `key-${++keyId}`,
      withLock, signal: new AbortController().signal, onChange() {}, now: () => state.now });
  }
  return { state, controller };
}

test('persists the original body and key before POST; ignores second start while pending', async () => {
  const { state, controller } = fixture(); const first = controller();
  await first.restore();
  await first.start(body, quote, asOf);
  const record = JSON.parse(state.records.get('scope-A'));
  assert.deepEqual(record.body, body);
  assert.equal(record.key, state.posts[0].key);
  assert.equal(first.getSnapshot().attempt.claim.status, 'pending');
  assert.equal(await first.start(body, quote, asOf), false);
  assert.equal(state.count, 1);
});

test('lost response then reload replays the SAME body/key and creates only one claim', async () => {
  const { state, controller } = fixture(); const first = controller();
  await first.restore(); state.loseResponse = true;
  await first.start(body, quote, asOf);
  assert.equal(first.getSnapshot().attempt.state, 'unresolved');
  assert.equal(first.getSnapshot().attempt.claim, null);
  const recovered = controller(); await recovered.restore();
  state.now += 3000; await recovered.sync();
  assert.equal(recovered.getSnapshot().attempt.claim.id, 'clm_1');
  assert.equal(state.count, 1);
  assert.deepEqual(state.posts[1], state.posts[0]);
});

test('nothing is sent if the initial durable write fails', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore(); state.writeError = true;
  await current.start(body, quote, asOf);
  assert.equal(state.posts.length, 0);
  assert.equal(current.getSnapshot().attempt, null);
  assert.ok(current.getSnapshot().error);
});

test('failed response persistence still recovers through the original durable key', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore();
  let release; state.hold = new Promise(resolve => { release = resolve; });
  const sending = current.start(body, quote, asOf);
  while (!state.posts.length) await new Promise(resolve => setImmediate(resolve));
  state.writeError = true; release(); await sending;
  assert.equal(current.getSnapshot().attempt.claim.id, 'clm_1');
  state.writeError = false; state.hold = null;
  const recovered = controller(); await recovered.restore(); await recovered.sync();
  assert.equal(recovered.getSnapshot().attempt.claim.id, 'clm_1');
  assert.equal(state.count, 1);
});

test('double clicks and separate tabs cannot create competing attempts', async () => {
  const { state, controller } = fixture(); const first = controller(); const second = controller();
  await first.restore(); await second.restore();
  await Promise.all([first.start(body, quote, asOf), first.start(body, quote, asOf), second.start(body, quote, asOf)]);
  assert.equal(state.posts.length, 1);
  assert.equal(state.count, 1);
});

test('unknown and pending claims cannot be cleared; terminal state waits for snapshot', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore(); state.loseResponse = true; await current.start(body, quote, asOf);
  assert.equal(await current.clear(asOf), false);
  state.now += 3000; await current.sync();
  assert.equal(await current.clear(asOf), false);
  const claim = [...state.claims.values()][0];
  claim.status = 'completed'; claim.updatedAt = '2026-10-21T19:00:20.000Z';
  await current.sync();
  assert.equal(canStartClaim(current.getSnapshot().attempt, asOf), false);
  assert.equal(canStartClaim(current.getSnapshot().attempt, claim.updatedAt), true);
  assert.equal(await current.clear(claim.updatedAt), true);
});

test('failed claim keeps failure reason and GET polling never repeats POST', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore(); await current.start(body, quote, asOf);
  const claim = [...state.claims.values()][0]; claim.status = 'failed'; claim.failureReason = 'Destination unavailable';
  await current.sync();
  assert.equal(current.getSnapshot().attempt.claim.failureReason, 'Destination unavailable');
  assert.equal(state.posts.length, 1);
  assert.equal(state.gets.length, 1);
});

test('429 survives reload and blocks requests until retryAfterMs', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore(); state.postError = { code: 'RATE_LIMITED', status: 429, retryAfterMs: 10000 };
  await current.start(body, quote, asOf);
  const recovered = controller(); await recovered.restore(); await recovered.sync();
  assert.equal(state.posts.length, 1);
  state.now += 10000; state.postError = null; await recovered.sync();
  assert.equal(state.posts.length, 2);
  assert.deepEqual(state.posts[1], state.posts[0]);
});

test('definitive validation rejection allows editing; 409 stays locked after reload', async () => {
  const { state, controller } = fixture(); let current = controller();
  await current.restore(); state.postError = { code: 'VALIDATION', status: 400 };
  await current.start(body, quote, asOf);
  assert.equal(current.getSnapshot().attempt.state, 'rejected');
  assert.equal(await current.clear(asOf), true);
  state.postError = { code: 'IDEMPOTENCY_MISMATCH', status: 409 };
  await current.start(body, quote, asOf);
  current = controller(); await current.restore(); state.now += 10000; await current.sync();
  assert.equal(current.getSnapshot().attempt.stopReason, 'IDEMPOTENCY_MISMATCH');
  assert.equal(state.posts.length, 2);
  assert.equal(await current.clear(asOf), false);
});

test('corrupt saved attempt blocks sending instead of silently starting over', async () => {
  const { state, controller } = fixture(); state.records.set('scope-A', '{broken');
  const current = controller(); await current.restore(); await current.start(body, quote, asOf);
  assert.equal(current.getSnapshot().ready, false);
  assert.equal(state.posts.length, 0);
});

test('token scopes are deterministic, distinct and do not contain the token', async () => {
  assert.equal(await claimStorageKey(' token-A '), await claimStorageKey('token-A'));
  assert.notEqual(await claimStorageKey('token-A'), await claimStorageKey('token-B'));
  assert.equal((await claimStorageKey('token-A')).includes('token-A'), false);
  const { controller } = fixture(); const first = controller('token-A-hash'); const second = controller('token-B-hash');
  await first.restore(); await first.start(body, quote, asOf); await second.restore();
  assert.equal(second.getSnapshot().attempt, null);
});

test('temporary GET failure keeps the known claim ID and never submits a new POST', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore(); await current.start(body, quote, asOf);
  state.getError = { code: 'NETWORK' }; await current.sync();
  assert.equal(current.getSnapshot().attempt.claim.id, 'clm_1');
  state.now += 3000; state.getError = null; await current.sync();
  assert.equal(state.posts.length, 1);
  assert.deepEqual(state.gets, ['clm_1', 'clm_1']);
});

test('unauthorized recovery stops polling until the original token is revalidated', async () => {
  const { state, controller } = fixture(); const current = controller();
  await current.restore(); state.postError = { code: 'UNAUTHORIZED', status: 401 };
  await current.start(body, quote, asOf); state.now += 3000; await current.sync();
  assert.equal(state.posts.length, 1);
  assert.equal(current.getSnapshot().attempt.stopReason, 'UNAUTHORIZED');
  // A new controller is created only after SessionProvider revalidates the token.
  const recovered = controller(); state.postError = null; await recovered.restore(); await recovered.sync();
  assert.equal(state.posts.length, 2);
  assert.deepEqual(state.posts[1], state.posts[0]);
});

test('clearing stale local state cannot erase a newer pending attempt from another tab', async () => {
  const { state, controller } = fixture(); const first = controller(); const second = controller();
  await first.restore(); await second.restore(); await first.start(body, quote, asOf);
  assert.equal(await second.clear(asOf), false);
  assert.ok(state.records.get('scope-A'));
});
