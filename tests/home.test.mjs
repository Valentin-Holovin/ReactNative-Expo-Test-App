import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canRefreshBalances, getBalanceRetryAt, getBalancePollInterval, getBalanceFreshness } from '../src/queries/balancePolicy.ts';

const timestamp = Date.parse('2026-10-21T19:00:00Z');

test('normal polling follows the server snapshot cadence', () => {
  assert.equal(getBalancePollInterval(null, 0, timestamp), 15000);
  assert.equal(canRefreshBalances(null, 0, timestamp), true);
});

test('rate limit blocks refresh and polling until the server delay has elapsed', () => {
  const error = { code: 'RATE_LIMITED', retryAfterMs: 30000 };
  assert.equal(getBalanceRetryAt(error, timestamp), timestamp + 30000);
  assert.equal(canRefreshBalances(error, timestamp, timestamp + 29999), false);
  assert.equal(canRefreshBalances(error, timestamp, timestamp + 30000), true);
  assert.equal(getBalancePollInterval(error, timestamp, timestamp), 30000);
  assert.equal(getBalancePollInterval(error, timestamp, timestamp + 31000), 15000);
});

test('401 stops polling and refresh instead of repeatedly sending an expired token', () => {
  const error = { code: 'UNAUTHORIZED' };
  assert.equal(getBalancePollInterval(error, timestamp, timestamp + 60000), false);
  assert.equal(canRefreshBalances(error, timestamp, timestamp + 60000), false);
});

test('transient errors permit retry and invalid rate delays have a safe fallback', () => {
  assert.equal(canRefreshBalances({ code: 'NETWORK' }, timestamp, timestamp), true);
  assert.equal(getBalanceRetryAt({ code: 'RATE_LIMITED', retryAfterMs: NaN }, timestamp), timestamp + 1000);
  assert.equal(getBalanceRetryAt({ code: 'RATE_LIMITED', retryAfterMs: -1 }, timestamp), timestamp + 1000);
});

test('freshness is based on asOf, handles stale data and clock skew', () => {
  const asOf = '2026-10-21T19:00:00Z';
  assert.equal(getBalanceFreshness(asOf, timestamp + 45000), '45s ago');
  assert.equal(getBalanceFreshness(asOf, timestamp + 125000), '2m ago');
  assert.equal(getBalanceFreshness(asOf, timestamp + 7200000), '2h ago');
  assert.equal(getBalanceFreshness(asOf, timestamp + 86400000), '1d ago');
  assert.equal(getBalanceFreshness(asOf, timestamp - 5000), '0s ago');
  assert.equal(getBalanceFreshness('invalid', timestamp), 'Unknown snapshot time');
});
