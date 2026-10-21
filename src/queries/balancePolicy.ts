/** Poll no faster than the server's 15-second snapshot cadence. */
export const BALANCE_POLL_MS = 15_000;

interface Failure { code?: string; retryAfterMs?: number }

export function getBalanceRetryAt(error: unknown, errorUpdatedAt: number): number {
  const failure = error as Failure | null;
  if (failure?.code !== 'RATE_LIMITED') return 0;
  const delay = failure.retryAfterMs;
  return errorUpdatedAt + (typeof delay === 'number' && Number.isFinite(delay) && delay >= 0 ? delay : 1000);
}

export function canRefreshBalances(error: unknown, errorUpdatedAt: number, now: number): boolean {
  if ((error as Failure | null)?.code === 'UNAUTHORIZED') return false;
  return now >= getBalanceRetryAt(error, errorUpdatedAt);
}

export function getBalancePollInterval(error: unknown, errorUpdatedAt: number, now: number): number | false {
  if ((error as Failure | null)?.code === 'UNAUTHORIZED') return false;
  return Math.max(BALANCE_POLL_MS, getBalanceRetryAt(error, errorUpdatedAt) - now);
}

/** Freshness comes from the server's asOf, never the HTTP response arrival time. */
export function getBalanceFreshness(asOf: string, now: number): string {
  const snapshotTime = Date.parse(asOf);
  if (!Number.isFinite(snapshotTime)) return 'Unknown snapshot time';
  const age = Math.max(0, Math.floor((now - snapshotTime) / 1000));
  if (age < 60) return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  if (age < 86400) return `${Math.floor(age / 3600)}h ago`;
  return `${Math.floor(age / 86400)}d ago`;
}
