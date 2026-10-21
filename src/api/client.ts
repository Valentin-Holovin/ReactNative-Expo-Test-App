import { create } from 'axios';

import { ApiError, toApiError } from './errors';

export const API_BASE_URL = 'https://task-api.cashmine.io';
export const API_TIMEOUT_MS = 15_000;

/** Create a new client when the token changes; credentials never live in global defaults. */
export function createApiClient(token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new ApiError('Enter an API token', 'UNAUTHORIZED');
  }

  const client = create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${normalizedToken}`,
    },
  });

  let blockedUntil = 0;
  client.interceptors.request.use((config) => {
    const remaining = blockedUntil - Date.now();
    if (remaining > 0) {
      throw new ApiError('Too many requests. Please wait.', 'RATE_LIMITED', 429, undefined, remaining);
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const normalized = toApiError(error);
      if (normalized.code === 'RATE_LIMITED') {
        blockedUntil = Math.max(blockedUntil, Date.now() + (normalized.retryAfterMs ?? 1000));
      }
      return Promise.reject(normalized);
    },
  );

  // No automatic retries, particularly for claim submissions.
  return client;
}
