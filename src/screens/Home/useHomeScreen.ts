import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import type { BalancesResponse } from '@/api';
import { calculateUsdTotals, formatUsd, parseAmount } from '@/lib/money';
import { useSession } from '@/session/SessionProvider';
import { sessionErrorMessage } from '@/session/controller';

import { BALANCE_POLL_MS, canRefreshBalances, getBalanceFreshness, getBalancePollInterval, getBalanceRetryAt } from './balancePolicy';

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
  const { session } = useSession();
  const pathname = usePathname();
  const [now, setNow] = useState(Date.now);
  const active = pathname === '/' && !!session;
  const queryClient = useQueryClient();
  const queryKey = ['session', session?.id ?? null, 'balances'] as const;
  const cachedState = queryClient.getQueryState(queryKey);
  // Also gate route re-entry: enabling a stale query otherwise bypasses rate-limit delays.
  const allowed = canRefreshBalances(cachedState?.error, cachedState?.errorUpdatedAt ?? 0, now);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!session) throw new Error('No active session');
      const response = await session.api.getBalances({ signal });
      presentBalances(response); // Reject malformed amounts before replacing good cached data.
      return response;
    },
    enabled: active && allowed,
    staleTime: BALANCE_POLL_MS,
    retry: false,
    refetchInterval: (query) => active
      ? getBalancePollInterval(query.state.error, query.state.errorUpdatedAt, Date.now())
      : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => active && canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnReconnect: (query) => active && canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnMount: (query) => canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
  });

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const presentation = useMemo(() => {
    if (!query.data) return null;
    try { return presentBalances(query.data); }
    catch { return null; }
  }, [query.data]);

  const unauthorized = (query.error as { code?: string } | null)?.code === 'UNAUTHORIZED';
  const retrySeconds = Math.max(0, Math.ceil((getBalanceRetryAt(query.error, query.errorUpdatedAt) - now) / 1000));
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
    canRefresh: !!session && !query.isFetching && !unauthorized && retrySeconds === 0,
    async refresh() {
      if (!session || query.isFetching || !canRefreshBalances(query.error, query.errorUpdatedAt, Date.now())) return;
      await query.refetch({ cancelRefetch: false });
    },
  };
}
