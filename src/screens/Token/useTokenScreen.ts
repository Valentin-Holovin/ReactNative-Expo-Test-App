import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '@/session/SessionProvider';
import { retryAtFor, sessionErrorMessage, SessionStorageError } from '@/session/controller';

export function useTokenScreen() {
  const session = useSession();
  const [token, setToken] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const request = useRef<AbortController | null>(null);
  const blockedUntil = Math.max(retryAt, session.retryAt);
  const retrySeconds = Math.max(0, Math.ceil((blockedUntil - now) / 1000));

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!blockedUntil) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= blockedUntil) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [blockedUntil]);

  async function submit() {
    if (request.current || session.restoring || Date.now() < blockedUntil) return;
    if (!token.trim()) {
      setError('Enter your API token.');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      await session.connect(token, controller.signal);
      if (!controller.signal.aborted) {
        setToken('');
        setVisible(false);
        router.replace('/');
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        // Only locally-authored storage errors are shown verbatim; never server messages.
        setError(cause instanceof SessionStorageError
          ? cause.message : sessionErrorMessage(cause));
        setRetryAt(retryAtFor(cause));
        setNow(Date.now());
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      request.current = null;
    }
  }

  async function retryRestore() {
    if (request.current || session.restoring || Date.now() < blockedUntil) return;
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    try {
      const restored = await session.restore(controller.signal);
      if (restored && !controller.signal.aborted) router.replace('/');
    } finally {
      request.current = null;
    }
  }

  return {
    token,
    setToken(value: string) { setToken(value); setError(null); },
    visible,
    toggleVisible: () => setVisible((value) => !value),
    busy: busy || session.restoring,
    error: error ?? session.error,
    canSubmit: !!token.trim() && !busy && !session.restoring && retrySeconds === 0,
    retrySeconds,
    canGoBack: !!session.session,
    canRetryRestore: !!session.error && !session.restoring && !busy && retrySeconds === 0,
    submit,
    retryRestore,
  };
}
