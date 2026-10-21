import { router } from 'expo-router';
import { Button } from 'react-native';

import { Screen } from '@/components/Screen';

export default function ClaimScreen() {
  return (
    <Screen title="Claim payback">
      <Button title="View claim status" onPress={() => router.navigate('/claim-status')} />
      <Button title="Back to balances" onPress={() => router.navigate('/')} />
    </Screen>
  );
}
