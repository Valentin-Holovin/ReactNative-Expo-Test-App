import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import { useClaims } from '@/claims/ClaimsProvider';
import { canRefreshBalances as canRequest, getBalanceRetryAt as getRetryAt } from '@/queries/balancePolicy';
import { useSession } from '@/session/SessionProvider';
import { sessionErrorMessage } from '@/session/controller';

import { activityRows, createActivityQueryOptions } from './activityQuery';

export function useActivityScreen() {
  const { session } = useSession();
  const claims = useClaims();
  const active = usePathname() === '/activity';
  const [now, setNow] = useState(Date.now);
  const queryClient = useQueryClient();
  const options = createActivityQueryOptions(session);
  const cached = queryClient.getQueryState(options.queryKey);
  const query = useInfiniteQuery({
    ...options,
    enabled: active && !!session && canRequest(cached?.error, cached?.errorUpdatedAt ?? 0, now),
    refetchOnWindowFocus: query => active && canRequest(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnReconnect: query => active && canRequest(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnMount: query => canRequest(query.state.error, query.state.errorUpdatedAt, Date.now()),
  });
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  const unauthorized = (query.error as { code?: string } | null)?.code === 'UNAUTHORIZED';
  const pages = query.data?.pages ?? [];
  const lastPage = pages.at(-1);
  const cursorLoop = !!lastPage?.nextCursor && !!query.data?.pageParams.includes(lastPage.nextCursor);
  const retrySeconds = Math.max(0, Math.ceil((getRetryAt(query.error, query.errorUpdatedAt) - now) / 1000));
  const canFetch = !!session && !query.isFetching && !unauthorized && retrySeconds === 0;
  const guard = () => !!session && !query.isFetching && canRequest(query.error, query.errorUpdatedAt, Date.now());
  async function refresh() {
    if (!guard()) return;
    // Refetch existing pages sequentially from the first cursor. TanStack retains
    // the previous successful history if any request in this refresh fails.
    await query.refetch({ cancelRefetch: false });
  }
  async function loadMore() {
    if (!guard() || !query.hasNextPage) return;
    await query.fetchNextPage({ cancelRefetch: false });
  }
  return {
    items: unauthorized ? [] : activityRows(pages),
    loading: query.isPending && query.isFetching,
    refreshing: query.isFetching && !query.isFetchingNextPage,
    loadingMore: query.isFetchingNextPage,
    offline: query.fetchStatus === 'paused',
    error: query.error ? sessionErrorMessage(query.error) : null,
    unauthorized,
    retrySeconds,
    hasData: !!query.data && !unauthorized,
    hasNextPage: query.hasNextPage && !cursorLoop && !unauthorized,
    cursorLoop,
    canFetch,
    refresh, loadMore,
    retry: query.isFetchNextPageError ? loadMore : refresh,
    retryLabel: query.isFetchNextPageError ? 'Retry loading more' : 'Retry refresh',
    currentClaimId: claims.attempt?.claim?.id ?? null,
  };
}
