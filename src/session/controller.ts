import type { BalancesResponse, createCashMineApi } from '../api';

type Api = ReturnType<typeof createCashMineApi>;
export const TOKEN_STORAGE_KEY = 'cashmine.api-token';

export class SessionStorageError extends Error {}

export interface Session {
  api: Api;
  /** A non-secret ID for query keys. Never put the token in a query key. */
  id: number;
}

interface Snapshot {
  initialized: boolean;
  restoring: boolean;
  session: Session | null;
  error: string | null;
  retryAt: number;
}

interface Dependencies {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  createApi(token: string): Api;
  cache: {
    cancelQueries(): Promise<unknown>;
    clear(): void;
    setQueryData(key: readonly unknown[], data: BalancesResponse): unknown;
  };
}

function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error
    ? String(error.code) : undefined;
}

export function retryAtFor(error: unknown): number {
  if (errorCode(error) !== 'RATE_LIMITED') return 0;
  const delay = error && typeof error === 'object' && 'retryAfterMs' in error
    ? Number(error.retryAfterMs) : 1000;
  return Date.now() + (Number.isFinite(delay) && delay >= 0 ? delay : 1000);
}

export function sessionErrorMessage(error: unknown): string {
  switch (errorCode(error)) {
    case 'UNAUTHORIZED': return 'This token is invalid or has expired. Enter another token.';
    case 'RATE_LIMITED': return 'Too many requests. Wait before trying again.';
    case 'TIMEOUT': return 'The server took too long to respond. Please try again.';
    case 'NETWORK': return 'Could not reach the server. Check your connection and try again.';
    default: return 'Could not connect. Please try again.';
  }
}

/** Per-provider state: no shared credentials during web server rendering. */
export function createSessionController({ storage, createApi, cache }: Dependencies) {
  let snapshot: Snapshot = { initialized: false, restoring: true, session: null, error: null, retryAt: 0 };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let generation = 0;
  let connecting = false;

  function update(patch: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }

  async function activate(api: Api, balances: BalancesResponse, signal?: AbortSignal) {
    await cache.cancelQueries();
    if (signal?.aborted) return;
    cache.clear();
    const session = { api, id: ++generation };
    cache.setQueryData(['session', session.id, 'balances'], balances);
    update({ session, error: null, retryAt: 0 });
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async restore(signal: AbortSignal) {
      update({ restoring: true, error: null });
      try {
        const token = await storage.getItem(TOKEN_STORAGE_KEY);
        if (signal.aborted) return;
        if (token?.trim()) {
          const api = createApi(token.trim());
          try {
            const balances = await api.getBalances({ signal });
            if (signal.aborted) return;
            await activate(api, balances, signal);
          } catch (error) {
            if (signal.aborted) return;
            if (errorCode(error) === 'UNAUTHORIZED') {
              await storage.removeItem(TOKEN_STORAGE_KEY);
            }
            update({ error: sessionErrorMessage(error), retryAt: retryAtFor(error) });
          }
        }
      } catch {
        if (!signal.aborted) update({ error: 'Could not access browser storage. Check your browser settings and retry.' });
      } finally {
        if (!signal.aborted) update({ restoring: false, initialized: true });
      }
      return !signal.aborted && !!snapshot.session;
    },
    async connect(input: string, signal: AbortSignal) {
      const token = input.trim();
      if (!token) throw new Error('Enter your API token.');
      if (connecting || snapshot.restoring) throw new Error('A connection is already in progress.');
      if (signal.aborted) return;
      connecting = true;
      try {
        const api = createApi(token);
        const balances = await api.getBalances({ signal });
        if (signal.aborted) return;
        try {
          await storage.setItem(TOKEN_STORAGE_KEY, token);
        } catch {
          throw new SessionStorageError('Could not save the token. Check your browser storage settings.');
        }
        // Once saved, finish the session switch even if the screen was unmounted.
        await activate(api, balances);
      } finally {
        connecting = false;
      }
    },
  };
}
