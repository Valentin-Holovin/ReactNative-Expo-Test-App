import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Decimal } from 'decimal.js';
import {
  MoneyError, parseAmount, parseSignedAmount, calculateReceiveAmount,
  validateClaimAmount, getMaxClaimAmount, calculateUsdTotals, formatUsd,
} from '../src/lib/money.ts';

const rules = { decimals: 6, available: '820.413207', minAmount: '0.01', fee: '0.0012' };
const asset = (overrides = {}) => ({ asset: 'USDT', decimals: 6, available: '0', pending: '0', claiming: '0', usdPrice: '1', ...overrides });

test('parses canonical strings without losing precision', () => {
  assert.equal(parseAmount('12.3400', 6), '12.34');
  assert.equal(parseAmount('0.000000000000000001', 18), '0.000000000000000001');
  assert.equal(parseAmount('9007199254740993.123456', 6), '9007199254740993.123456');
});

test('rejects formats that the API does not accept', () => {
  for (const value of ['', '.5', '1.', '05', '00', '1e-3', '0x10', 'NaN', 'Infinity', '-1', '+1', '1,5', ' 1', '1 ', '1\n']) {
    assert.throws(() => parseAmount(value, 6), MoneyError, value);
  }
});

test('counts trailing zeros toward input precision; accepts zero-decimal assets', () => {
  assert.throws(() => parseAmount('1.0000000', 6), e => e.code === 'PRECISION');
  assert.equal(parseAmount('12', 0), '12');
  assert.throws(() => parseAmount('12.0', 0), e => e.code === 'PRECISION');
  for (const decimals of [-1, 1.5, NaN]) assert.throws(() => parseAmount('1', decimals), RangeError);
});

test('supports negative activity without allowing negative claim amounts', () => {
  assert.equal(parseSignedAmount('-9.8100', 6), '-9.81');
  assert.equal(parseSignedAmount('9.81', 6), '9.81');
  assert.throws(() => parseSignedAmount('-01', 6), MoneyError);
});

test('validates inclusive min and available bounds', () => {
  assert.equal(validateClaimAmount('0.01', rules).ok, true);
  assert.equal(validateClaimAmount(rules.available, rules).ok, true);
  assert.equal(validateClaimAmount('0.009999', rules).code, 'BELOW_MINIMUM');
  assert.equal(validateClaimAmount('820.413208', rules).code, 'INSUFFICIENT_BALANCE');
  assert.equal(validateClaimAmount('0', rules).code, 'NON_POSITIVE');
  assert.equal(validateClaimAmount('', rules).code, 'REQUIRED');
  assert.equal(validateClaimAmount('0.1234567', rules).code, 'PRECISION');
});

test('fee is deducted once; Max uses full available balance', () => {
  assert.equal(getMaxClaimAmount(rules.available, 6), '820.413207');
  assert.deepEqual(validateClaimAmount('0.5', rules), {
    ok: true, amount: '0.5', fee: '0.0012', receiveAmount: '0.4988',
  });
  assert.equal(calculateReceiveAmount('0.3', '0.1', 6), '0.2');
  assert.equal(getMaxClaimAmount('0', 6), '0');
});

test('blocks a non-positive receive amount as a documented client safeguard', () => {
  assert.equal(validateClaimAmount('0.01', { ...rules, fee: '0.01' }).code, 'NON_POSITIVE_RECEIVE');
  assert.equal(validateClaimAmount('0.01', { ...rules, fee: '0.02' }).code, 'NON_POSITIVE_RECEIVE');
});

test('does not silently round an invalid server balance', () => {
  assert.throws(() => getMaxClaimAmount('0.1234567', 6), e => e.code === 'PRECISION');
  assert.throws(() => validateClaimAmount('1', { ...rules, available: 'NaN' }), MoneyError);
});

test('totals all balance categories across assets exactly', () => {
  assert.deepEqual(calculateUsdTotals([
    asset({ available: '0.1', pending: '0.2', claiming: '0.3' }),
    asset({ asset: 'ETH', available: '2', pending: '0.5', claiming: '0.1', usdPrice: '3' }),
  ]), { available: '6.1', pending: '1.7', claiming: '0.6', total: '8.4' });
  assert.deepEqual(calculateUsdTotals([]), { available: '0', pending: '0', claiming: '0', total: '0' });
});

test('rounds USD only after summing, HALF_UP to two decimal places', () => {
  const totals = calculateUsdTotals([asset({ available: '0.004' }), asset({ available: '0.004' })]);
  assert.equal(totals.total, '0.008');
  assert.equal(formatUsd(totals.total), '0.01');
  assert.equal(formatUsd('1.005'), '1.01');
  assert.equal(formatUsd('-1.005'), '-1.01');
  assert.equal(formatUsd('0'), '0.00');
});

test('handles amounts beyond Decimal default precision and ignores global settings', () => {
  const previousPrecision = Decimal.precision;
  Decimal.set({ precision: 5 });
  try {
    assert.equal(calculateReceiveAmount('123456789012345678901234567890.123456', '0.000001', 6), '123456789012345678901234567890.123455');
    assert.equal(calculateUsdTotals([asset({ available: '123456789012345678901234567890.123456', usdPrice: '1.000001' })]).total,
      '123456912469134691246913469124.691346123456');
  } finally {
    Decimal.set({ precision: previousPrecision });
  }
});

test('rejects malformed or negative balance and price data', () => {
  assert.throws(() => calculateUsdTotals([asset({ usdPrice: '1e3' })]), MoneyError);
  assert.throws(() => calculateUsdTotals([asset({ available: '-1' })]), MoneyError);
  assert.throws(() => calculateUsdTotals([asset({ usdPrice: '-1' })]), MoneyError);
});
