import type { AxiosInstance } from 'axios';

import { ApiError } from './errors';
import type {
  Claim, ClaimOptions, CreateClaimRequest, CreateClaimResponse, RequestOptions,
} from './types';

export function createClaimsApi(client: AxiosInstance) {
  return {
    async getClaimOptions(asset: string, { signal }: RequestOptions = {}): Promise<ClaimOptions> {
      const { data } = await client.get<ClaimOptions>('/v1/claim-options', {
        params: { asset }, signal,
      });
      return data;
    },

    /** Persist key + body BEFORE calling; reuse both if the outcome is unknown. */
    async createClaim(
      body: CreateClaimRequest,
      idempotencyKey: string,
      { signal }: RequestOptions = {},
    ): Promise<CreateClaimResponse> {
      if (!idempotencyKey.trim() || idempotencyKey.length > 100) {
        throw new ApiError('Idempotency key must contain 1 to 100 characters', 'VALIDATION');
      }
      const response = await client.post<Claim>('/v1/claims', body, {
        headers: { 'Idempotency-Key': idempotencyKey }, signal,
      });
      return {
        claim: response.data,
        // The API guarantees 200 for replay, even when CORS hides the custom header.
        replayed: response.status === 200 ||
          String(response.headers['idempotent-replayed']).toLowerCase() === 'true',
      };
    },

    async getClaim(id: string, { signal }: RequestOptions = {}): Promise<Claim> {
      const { data } = await client.get<Claim>(`/v1/claims/${encodeURIComponent(id)}`, { signal });
      return data;
    },
  };
}
