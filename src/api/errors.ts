import { isAxiosError, isCancel } from 'axios';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_MISMATCH'
  | 'RATE_LIMITED'
  | 'SERVER'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'CANCELED'
  | 'UNKNOWN';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly status?: number,
    public readonly field?: string,
    public readonly retryAfterMs?: number,
    /** A claim might have been accepted. Reconcile using the SAME key and body. */
    public readonly outcomeUnknown = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorResponse {
  error?: { code?: string; message?: string; field?: string; retryAfterMs?: number };
}

const serverCodes = new Set<string>([
  'VALIDATION', 'UNAUTHORIZED', 'NOT_FOUND', 'IDEMPOTENCY_MISMATCH',
  'RATE_LIMITED', 'SERVER', 'TIMEOUT',
]);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!isAxiosError<ErrorResponse>(error)) {
    return new ApiError('Unexpected request error', 'UNKNOWN');
  }

  const status = error.response?.status;
  const body = error.response?.data?.error;
  const isClaimSubmission = error.config?.method?.toLowerCase() === 'post';
  // Cancellation also cannot undo a request already received by the server.
  const outcomeUnknown = isClaimSubmission && (status === undefined || status >= 500);
  const header = error.response?.headers['retry-after'];
  const seconds = header !== undefined ? Number(header) : NaN;
  const retryAfterMs = typeof body?.retryAfterMs === 'number' &&
    Number.isFinite(body.retryAfterMs) && body.retryAfterMs >= 0
    ? body.retryAfterMs
    : Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;

  let code: ApiErrorCode = 'UNKNOWN';
  if (isCancel(error)) code = 'CANCELED';
  else if (body?.code && serverCodes.has(body.code)) code = body.code as ApiErrorCode;
  else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || status === 504) code = 'TIMEOUT';
  else if (!error.response) code = 'NETWORK';
  else if (status === 401) code = 'UNAUTHORIZED';
  else if (status === 429) code = 'RATE_LIMITED';
  else if (status !== undefined && status >= 500) code = 'SERVER';

  // Do not retain the Axios error/config: it contains the Authorization header.
  return new ApiError(
    body?.message ?? (code === 'TIMEOUT' ? 'Request timed out' : 'Request failed'),
    code, status, body?.field, retryAfterMs, outcomeUnknown,
  );
}
