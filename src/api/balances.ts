import type { AxiosInstance } from 'axios';

import type { BalancesResponse, RequestOptions } from './types';

export function createBalancesApi(client: AxiosInstance) {
  return {
    async getBalances({ signal }: RequestOptions = {}): Promise<BalancesResponse> {
      const { data } = await client.get<BalancesResponse>('/v1/balances', { signal });
      return data;
    },
  };
}
