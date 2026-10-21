import type { AxiosInstance } from 'axios';

import { ApiError } from './errors';
import type { ActivityParams, ActivityResponse, RequestOptions } from './types';

export function createActivityApi(client: AxiosInstance) {
  return {
    async getActivity(
      { limit = 20, cursor }: ActivityParams = {},
      { signal }: RequestOptions = {},
    ): Promise<ActivityResponse> {
      if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
        throw new ApiError('Limit must be an integer from 1 to 20', 'VALIDATION', undefined, 'limit');
      }
      const { data } = await client.get<ActivityResponse>('/v1/activity', {
        params: { limit, cursor: cursor ?? undefined }, signal,
      });
      return data;
    },
  };
}
