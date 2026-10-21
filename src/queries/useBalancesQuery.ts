import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { calculateUsdTotals } from '@/lib/money';
import { useSession } from '@/session/SessionProvider';

import { BALANCE_POLL_MS, canRefreshBalances, getBalancePollInterval, getBalanceRetryAt } from './balancePolicy';

export function useBalancesQuery(active: boolean) {
  const { session } = useSession();
  const [now, setNow] = useState(Date.now);
  const queryClient = useQueryClient();
  const queryKey = ['session', session?.id ?? null, 'balances'] as const;
  const cached = queryClient.getQueryState(queryKey);
  const allowed = canRefreshBalances(cached?.error, cached?.errorUpdatedAt ?? 0, now);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!session) throw new Error('No active session');
      const response = await session.api.getBalances({ signal });
      if (!response || !Array.isArray(response.items) || !Number.isFinite(Date.parse(response.asOf))) throw new Error('Invalid balances');
      const assets = new Set<string>();
      response.items.forEach(item => {
        if (!item.asset || typeof item.asset !== 'string' || assets.has(item.asset)) throw new Error('Invalid asset');
        assets.add(item.asset);
      });
      calculateUsdTotals(response.items);
      return response;
    },
    enabled: active && !!session && allowed,
    staleTime: BALANCE_POLL_MS,
    retry: false,
    refetchInterval: query => active ? getBalancePollInterval(query.state.error, query.state.errorUpdatedAt, Date.now()) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: query => active && canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnReconnect: query => active && canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnMount: query => canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
  });
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const retrySeconds = Math.max(0, Math.ceil((getBalanceRetryAt(query.error, query.errorUpdatedAt) - now) / 1000));
  const canRefresh = !!session && !query.isFetching && canRefreshBalances(query.error, query.errorUpdatedAt, now);
  return { query, now, retrySeconds, canRefresh,
    async refresh() {
      if (!session || query.isFetching || !canRefreshBalances(query.error, query.errorUpdatedAt, Date.now())) return;
      await query.refetch({ cancelRefetch: false });
    },
  };
}
