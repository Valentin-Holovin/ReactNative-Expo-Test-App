import { Decimal } from 'decimal.js';

import type { Balance } from '../api/types';

export type MoneyErrorCode =
  | 'REQUIRED' | 'INVALID_FORMAT' | 'PRECISION' | 'NON_POSITIVE'
  | 'BELOW_MINIMUM' | 'INSUFFICIENT_BALANCE' | 'NON_POSITIVE_RECEIVE';

export class MoneyError extends Error {
  readonly code: MoneyErrorCode;

  constructor(code: MoneyErrorCode, message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

function validateDecimals(decimals: number) {
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new RangeError('Asset decimals must be a non-negative safe integer.');
  }
}

function readDecimal(input: string, signed = false): Decimal {
  if (input === '') throw new MoneyError('REQUIRED', 'Enter an amount.');
  const pattern = signed ? /^-?(0|[1-9]\d*)(\.\d+)?$/ : /^(0|[1-9]\d*)(\.\d+)?$/;
  if (typeof input !== 'string' || input.trim() !== input || !pattern.test(input)) {
    throw new MoneyError('INVALID_FORMAT', 'Use digits and a decimal point, without spaces, signs or leading zeros.');
  }
  return new Decimal(input);
}

function readAssetAmount(input: string, decimals: number, signed = false) {
  validateDecimals(decimals);
  const value = readDecimal(input, signed);
  // Count the original digits, including trailing zeros: never silently round input.
  if ((input.split('.')[1]?.length ?? 0) > decimals) {
    throw new MoneyError('PRECISION', `Use no more than ${decimals} decimal places.`);
  }
  return value;
}

/** Canonical API string; no exponent notation and no rounding. */
export function parseAmount(input: string, decimals: number): string {
  return readAssetAmount(input, decimals).toFixed();
}

/** Activity may contain negative reversals and claims. */
export function parseSignedAmount(input: string, decimals: number): string {
  return readAssetAmount(input, decimals, true).toFixed();
}

/**
 * Exact addition/subtraction/multiplication for these finite decimal inputs.
 * Sum of input lengths + carry room bounds the significant digits needed.
 * Use a local constructor so global Decimal settings cannot round our results.
 */
function arithmetic(values: readonly string[]) {
  return Decimal.clone({
    precision: Math.max(20, values.reduce((sum, value) => sum + value.length, 0) + 10),
    rounding: Decimal.ROUND_HALF_UP,
  });
}

export function calculateReceiveAmount(amount: string, fee: string, decimals: number): string {
  readAssetAmount(amount, decimals);
  readAssetAmount(fee, decimals);
  const Exact = arithmetic([amount, fee]);
  const received = new Exact(amount).minus(fee);
  if (received.lte('0')) {
    throw new MoneyError('NON_POSITIVE_RECEIVE', 'The claim amount must be greater than the fee.');
  }
  return received.toFixed();
}

export interface ClaimAmountRules {
  decimals: number;
  available: string;
  minAmount: string;
  fee: string;
}

export type ClaimAmountValidation =
  | { ok: true; amount: string; fee: string; receiveAmount: string }
  | { ok: false; code: MoneyErrorCode; message: string };

export function validateClaimAmount(input: string, rules: ClaimAmountRules): ClaimAmountValidation {
  // Invalid API rules throw instead of being treated as an ordinary input error.
  const available = readAssetAmount(rules.available, rules.decimals);
  const minimum = readAssetAmount(rules.minAmount, rules.decimals);
  const fee = parseAmount(rules.fee, rules.decimals);
  try {
    const amount = readAssetAmount(input, rules.decimals);
    if (amount.lte('0')) throw new MoneyError('NON_POSITIVE', 'Amount must be greater than zero.');
    if (amount.lt(minimum)) throw new MoneyError('BELOW_MINIMUM', `Minimum claim amount is ${minimum.toFixed()}.`);
    if (amount.gt(available)) throw new MoneyError('INSUFFICIENT_BALANCE', 'Amount exceeds your available balance.');
    const normalized = amount.toFixed();
    return {
      ok: true,
      amount: normalized,
      fee,
      receiveAmount: calculateReceiveAmount(normalized, fee, rules.decimals),
    };
  } catch (error) {
    if (!(error instanceof MoneyError)) throw error;
    return { ok: false, code: error.code, message: error.message };
  }
}

/** The fee comes OUT OF this amount; Max does not subtract the fee. */
export function getMaxClaimAmount(available: string, decimals: number): string {
  return parseAmount(available, decimals);
}

export interface UsdTotals {
  available: string;
  pending: string;
  claiming: string;
  total: string;
}

/** Includes available + pending + claiming. All results remain exact decimal strings. */
export function calculateUsdTotals(balances: readonly Balance[]): UsdTotals {
  const values: string[] = [];
  for (const balance of balances) {
    for (const name of ['available', 'pending', 'claiming'] as const) {
      readAssetAmount(balance[name], balance.decimals);
      values.push(balance[name]);
    }
    readDecimal(balance.usdPrice);
    values.push(balance.usdPrice);
  }
  const Exact = arithmetic(values);
  let available = new Exact('0');
  let pending = new Exact('0');
  let claiming = new Exact('0');
  for (const balance of balances) {
    available = available.plus(new Exact(balance.available).times(balance.usdPrice));
    pending = pending.plus(new Exact(balance.pending).times(balance.usdPrice));
    claiming = claiming.plus(new Exact(balance.claiming).times(balance.usdPrice));
  }
  return {
    available: available.toFixed(),
    pending: pending.toFixed(),
    claiming: claiming.toFixed(),
    total: available.plus(pending).plus(claiming).toFixed(),
  };
}

/** Display only. Never send rounded USD values as asset amounts. */
export function formatUsd(value: string): string {
  return readDecimal(value, true).toFixed(2, Decimal.ROUND_HALF_UP);
}
