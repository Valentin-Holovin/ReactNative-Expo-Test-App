import { createActivityApi } from './activity';
import { createBalancesApi } from './balances';
import { createClaimsApi } from './claims';
import { createApiClient } from './client';

export function createCashMineApi(token: string) {
  const client = createApiClient(token);
  return {
    ...createBalancesApi(client),
    ...createActivityApi(client),
    ...createClaimsApi(client),
  };
}

export { API_BASE_URL, API_TIMEOUT_MS } from './client';
export { ApiError } from './errors';
export type { ApiErrorCode } from './errors';
export type * from './types';
