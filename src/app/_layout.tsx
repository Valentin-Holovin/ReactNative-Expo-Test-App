import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/Screen';
import { SessionProvider, useSession } from '@/session/SessionProvider';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SessionProvider>
          <SessionNavigator />
        </SessionProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function SessionNavigator() {
  const { initialized, session } = useSession();
  if (!initialized) {
    return <Screen title="Connecting"><ActivityIndicator accessibilityLabel="Restoring session" /></Screen>;
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" />
        <Stack.Screen name="claim" />
        <Stack.Screen name="claim-status" />
        <Stack.Screen name="activity" />
      </Stack.Protected>
      <Stack.Screen name="token" />
    </Stack>
  );
}
