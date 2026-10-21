import { usePathname } from 'expo-router';
import { useMemo } from 'react';

import type { BalancesResponse } from '@/api';
import { calculateUsdTotals, formatUsd, parseAmount } from '@/lib/money';
import { useBalancesQuery } from '@/queries/useBalancesQuery';
import { getBalanceFreshness } from '@/queries/balancePolicy';
import { useClaims } from '@/claims/ClaimsProvider';
import { canStartClaim } from '@/claims/controller';
import { sessionErrorMessage } from '@/session/controller';


function presentBalances(data: BalancesResponse) {
  if (!Array.isArray(data.items) || !Number.isFinite(Date.parse(data.asOf))) {
    throw new Error('Invalid balance snapshot');
  }
  const names = new Set<string>();
  const assets = data.items.map((balance) => {
    if (typeof balance.asset !== 'string' || !balance.asset.trim() || names.has(balance.asset)) {
      throw new Error('Invalid asset');
    }
    names.add(balance.asset);
    return {
      asset: balance.asset,
      available: parseAmount(balance.available, balance.decimals),
      pending: parseAmount(balance.pending, balance.decimals),
      claiming: parseAmount(balance.claiming, balance.decimals),
      usdTotal: formatUsd(calculateUsdTotals([balance]).total),
    };
  });
  const totals = calculateUsdTotals(data.items);
  return {
    assets,
    totalUsd: formatUsd(totals.total),
    availableUsd: formatUsd(totals.available),
    pendingUsd: formatUsd(totals.pending),
    claimingUsd: formatUsd(totals.claiming),
  };
}

export function useHomeScreen() {
  const pathname = usePathname();
  const { query, now, retrySeconds, canRefresh, refresh } = useBalancesQuery(pathname === '/');
  const claims = useClaims();
  const presentation = useMemo(() => {
    if (!query.data) return null;
    try { return presentBalances(query.data); }
    catch { return null; }
  }, [query.data]);

  const unauthorized = (query.error as { code?: string } | null)?.code === 'UNAUTHORIZED';
  const error = query.error ? sessionErrorMessage(query.error)
    : query.data && !presentation ? 'The server returned invalid balance data. Please refresh.' : null;

  return {
    balances: unauthorized ? null : presentation,
    asOf: query.data?.asOf ?? null,
    freshness: query.data ? getBalanceFreshness(query.data.asOf, now) : null,
    loading: query.isPending && query.isFetching,
    refreshing: query.isFetching,
    offline: query.fetchStatus === 'paused',
    error,
    unauthorized,
    retrySeconds,
    canRefresh,
    refresh,
    claimAttempt: claims.attempt,
    claimRecoveryError: claims.error,
    canClaim: claims.ready && !claims.busy && canStartClaim(claims.attempt, query.data?.asOf),
  };
}
