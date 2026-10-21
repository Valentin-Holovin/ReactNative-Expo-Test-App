import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';

import { createCashMineApi } from '@/api';

import { createSessionController } from './controller';

const SessionContext = createContext<ReturnType<typeof createSessionController> | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [controller] = useState(() => createSessionController({
    storage: AsyncStorage,
    createApi: createCashMineApi,
    cache: queryClient,
  }));

  useEffect(() => {
    const request = new AbortController();
    void controller.restore(request.signal);
    return () => request.abort();
  }, [controller]);

  return <SessionContext.Provider value={controller}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const controller = useContext(SessionContext);
  if (!controller) throw new Error('useSession requires SessionProvider');
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return { ...snapshot, connect: controller.connect, restore: controller.restore };
}
