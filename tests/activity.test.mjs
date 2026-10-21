import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, InfiniteQueryObserver } from '@tanstack/react-query';
import { validateActivityPage, nextActivityCursor, activityRows, formatActivityAmount,
  formatActivityDate, createActivityQueryOptions } from '../src/screens/Activity/activityQuery.ts';

const event = (id, overrides = {}) => ({ id, type: 'accrual', asset: 'USDT', amount: '1.25',
  status: 'confirmed', exchange: 'Binance', createdAt: '2026-10-21T19:00:00.000Z', relatedId: null, ...overrides });
const page = (items, nextCursor = null) => ({ items, nextCursor });
function fixture(t, id = 1) {
  const state = { calls: [], fail: false, hold: null, refreshed: false };
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const session = { id, api: { async getActivity(params, options) {
    state.calls.push({ params, signal: options.signal });
    if (state.hold) await state.hold;
    if (state.fail) throw Error('Network failure');
    return params.cursor === null
      ? page([event(state.refreshed ? 'newest' : 'first')], 'opaque-cursor')
      : page([event('older')]);
  } } };
  const options = createActivityQueryOptions(session);
  const observer = new InfiniteQueryObserver(client, { ...options, enabled: false });
  t.after(() => { observer.destroy(); client.clear(); });
  return { state, client, session, options, observer };
}

test('validates all operation types and preserves exact signed amounts', () => {
  const data = page([
    event('income'),
    event('reversal', { type: 'reversal', amount: '-0.000000000000000001', relatedId: 'income' }),
    event('claim', { type: 'claim', amount: '-9007199254740993.123456', status: 'failed', exchange: null }),
  ]);
  assert.equal(validateActivityPage(data), data);
  assert.equal(formatActivityAmount(data.items[0]), '+1.25');
  assert.equal(formatActivityAmount(data.items[1]), '-0.000000000000000001');
  assert.equal(formatActivityAmount(data.items[2]), '-9007199254740993.123456');
  assert.equal(formatActivityDate(data.items[0].createdAt), '2026-10-21 19:00:00.000 UTC');
});

test('rejects bad pages, invalid signs, statuses and ambiguous amounts', () => {
  for (const data of [null, {}, { items: [], nextCursor: '' }, page([event('x', { amount: '1e-3' })]),
    page([event('x', { amount: '1\n' })]), page([event('x', { amount: '-1' })]),
    page([event('x', { type: 'reversal', amount: '1' })]),
    page([event('x', { type: 'claim', amount: '-1', status: 'confirmed', exchange: null })]),
    page([event('x', { createdAt: 'bad date' })])]) assert.throws(() => validateActivityPage(data));
});

test('deduplicates overlapping pages in server order, keeping the newest copy', () => {
  const newest = event('same', { status: 'confirmed' });
  const older = event('same', { status: 'pending' });
  assert.deepEqual(activityRows([page([newest]), page([older, event('older')])]), [newest, event('older')]);
});

test('stops on the final page or a repeated cursor', () => {
  assert.equal(nextActivityCursor(page([], 'cursor-A'), [null]), 'cursor-A');
  assert.equal(nextActivityCursor(page([], 'cursor-A'), [null, 'cursor-A', 'cursor-B']), undefined);
  assert.equal(nextActivityCursor(page([]), [null]), undefined);
});

test('fetches initial page and next opaque cursor without skipping', async t => {
  const { state, client, options, observer } = fixture(t);
  await client.fetchInfiniteQuery(options);
  await observer.fetchNextPage({ cancelRefetch: false });
  assert.deepEqual(state.calls.map(call => call.params), [{ limit: 20, cursor: null }, { limit: 20, cursor: 'opaque-cursor' }]);
  assert.ok(state.calls[0].signal instanceof AbortSignal);
  assert.equal(observer.getCurrentResult().hasNextPage, false);
  assert.deepEqual(activityRows(observer.getCurrentResult().data.pages).map(item => item.id), ['first', 'older']);
});

test('failed next page retains loaded history and retries the same cursor', async t => {
  const { state, client, options, observer } = fixture(t);
  await client.fetchInfiniteQuery(options); state.fail = true;
  await observer.fetchNextPage({ cancelRefetch: false });
  assert.equal(observer.getCurrentResult().isFetchNextPageError, true);
  assert.deepEqual(activityRows(observer.getCurrentResult().data.pages).map(item => item.id), ['first']);
  state.fail = false; await observer.fetchNextPage({ cancelRefetch: false });
  assert.equal(state.calls[1].params.cursor, state.calls[2].params.cursor);
  assert.equal(observer.getCurrentResult().data.pages.length, 2);
});

test('refresh starts from first page and keeps old pages if refresh fails', async t => {
  const { state, client, options, observer } = fixture(t);
  await client.fetchInfiniteQuery(options); await observer.fetchNextPage({ cancelRefetch: false });
  state.fail = true; await observer.refetch({ cancelRefetch: false });
  assert.equal(observer.getCurrentResult().data.pages.length, 2);
  assert.equal(state.calls.at(-1).params.cursor, null);
  state.fail = false; state.refreshed = true; await observer.refetch({ cancelRefetch: false });
  assert.deepEqual(state.calls.slice(-2).map(call => call.params.cursor), [null, 'opaque-cursor']);
  assert.equal(observer.getCurrentResult().data.pages[0].items[0].id, 'newest');
});

test('duplicate load-more calls share one request', async t => {
  const { state, client, options, observer } = fixture(t);
  await client.fetchInfiniteQuery(options);
  let release; state.hold = new Promise(resolve => { release = resolve; });
  const first = observer.fetchNextPage({ cancelRefetch: false });
  const second = observer.fetchNextPage({ cancelRefetch: false });
  release(); await Promise.all([first, second]);
  assert.equal(state.calls.length, 2);
});

test('session keys isolate histories and an empty final page is valid', async t => {
  const { client, options, session } = fixture(t);
  await client.fetchInfiniteQuery(options);
  const other = createActivityQueryOptions({ ...session, id: 2 });
  assert.equal(client.getQueryData(other.queryKey), undefined);
  assert.deepEqual(other.queryKey, ['session', 2, 'activity']);
  assert.deepEqual(validateActivityPage(page([])), { items: [], nextCursor: null });
});
