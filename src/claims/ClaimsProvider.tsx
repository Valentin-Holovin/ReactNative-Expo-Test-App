import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';

import { useSession } from '@/session/SessionProvider';

import { withClaimLock } from './browserStorage';
import { createClaimController } from './controller';

type Controller = ReturnType<typeof createClaimController>;
const Context = createContext<{ controller: Controller | null; error: string | null }>({ controller: null, error: null });
const empty = { ready: false, busy: false, attempt: null, error: null };
const noSubscribe = () => () => {};
const emptySnapshot = () => empty;

export function ClaimsProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const [controllerState, setController] = useState<{ id: number; controller: Controller } | null>(null);
  const [initializationError, setError] = useState<{ id: number; message: string } | null>(null);
  const controller = controllerState?.id === session?.id ? controllerState?.controller ?? null : null;
  const error = initializationError?.id === session?.id ? initializationError?.message ?? null : null;

  useEffect(() => {
    if (!session) return;
    const activeSession = session;
    const request = new AbortController();
    let timer: ReturnType<typeof setInterval> | undefined;
    async function initialize() {
      try {
        const key = await activeSession.api.getClaimStorageKey();
        if (request.signal.aborted) return;
        const next = createClaimController({
          api: activeSession.api, storage: AsyncStorage, storageKey: key,
          signal: request.signal,
          createKey: () => globalThis.crypto.randomUUID(),
          withLock: work => withClaimLock(key, request.signal, work),
          onChange: () => {
            void queryClient.invalidateQueries({ queryKey: ['session', activeSession.id, 'balances'] });
            void queryClient.invalidateQueries({ queryKey: ['session', activeSession.id, 'activity'] });
          },
        });
        setController({ id: activeSession.id, controller: next });
        await next.restore();
        await next.sync();
        if (request.signal.aborted) return;
        timer = setInterval(() => {
          const current = next.getSnapshot();
          if (current.ready && !current.busy && current.attempt && !current.attempt.stopReason &&
              (current.attempt.state === 'unresolved' || current.attempt.claim?.status === 'pending')) {
            void next.sync();
          }
        }, 3000);
      } catch {
        if (!request.signal.aborted) setError({ id: activeSession.id, message: 'Claim recovery is unavailable. Use a current browser over HTTPS and allow browser storage.' });
      }
    }
    void initialize();
    return () => { request.abort(); if (timer) clearInterval(timer); };
  }, [session, queryClient]);

  return <Context.Provider value={{ controller, error }}>{children}</Context.Provider>;
}

export function useClaims() {
  const { controller, error } = useContext(Context);
  const snapshot = useSyncExternalStore(controller?.subscribe ?? noSubscribe,
    controller?.getSnapshot ?? emptySnapshot, controller?.getServerSnapshot ?? emptySnapshot);
  return { ...snapshot, error: error ?? snapshot.error, controller };
}
