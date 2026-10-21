import { infiniteQueryOptions } from '@tanstack/react-query';
import { Decimal } from 'decimal.js';

import type { ActivityItem, ActivityParams, ActivityResponse, RequestOptions } from '../../api/types';

interface ActivitySession {
  id: number;
  api: { getActivity(params?: ActivityParams, options?: RequestOptions): Promise<ActivityResponse> };
}

/** Preserve decimal strings: history does not include per-asset precision metadata. */
export function validateActivityPage(page: ActivityResponse): ActivityResponse {
  if (!page || !Array.isArray(page.items) ||
      (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor))) {
    throw new Error('Invalid activity page');
  }
  for (const item of page.items) {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.asset !== 'string' || !item.asset ||
        typeof item.amount !== 'string' || item.amount.trim() !== item.amount ||
        !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(item.amount) || !Number.isFinite(Date.parse(item.createdAt)) ||
        (item.exchange !== null && typeof item.exchange !== 'string') ||
        (item.relatedId !== null && typeof item.relatedId !== 'string')) throw new Error('Invalid activity item');
    const amount = new Decimal(item.amount);
    if (item.type === 'accrual') {
      if (!['pending', 'confirmed'].includes(item.status) || amount.isNegative()) throw new Error('Invalid accrual');
    } else if (item.type === 'reversal') {
      if (item.status !== 'confirmed' || !amount.lt('0')) throw new Error('Invalid reversal');
    } else if (item.type === 'claim') {
      if (!['pending', 'completed', 'failed'].includes(item.status) || item.exchange !== null || !amount.lt('0')) throw new Error('Invalid claim');
    } else throw new Error('Unknown activity type');
  }
  return page;
}

export function nextActivityCursor(page: ActivityResponse, pageParams: readonly (string | null)[]) {
  // Do not request a cursor twice if a malformed backend response cycles pages.
  return page.nextCursor !== null && !pageParams.includes(page.nextCursor) ? page.nextCursor : undefined;
}

export function activityRows(pages: readonly ActivityResponse[]): ActivityItem[] {
  const seen = new Set<string>();
  return pages.flatMap(page => page.items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }));
}

export function formatActivityAmount(item: ActivityItem): string {
  const value = new Decimal(item.amount).toFixed();
  return item.type === 'accrual' ? `+${value}` : value;
}

export function formatActivityDate(value: string): string {
  return new Date(value).toISOString().replace('T', ' ').replace('Z', ' UTC');
}

export function createActivityQueryOptions(session: ActivitySession | null) {
  return infiniteQueryOptions({
    queryKey: ['session', session?.id ?? null, 'activity'] as const,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      if (!session) throw new Error('No active session');
      return validateActivityPage(await session.api.getActivity({ limit: 20, cursor: pageParam }, { signal }));
    },
    getNextPageParam: (page, _pages, _pageParam, pageParams) => nextActivityCursor(page, pageParams),
    retry: false,
    staleTime: 15_000,
  });
}
