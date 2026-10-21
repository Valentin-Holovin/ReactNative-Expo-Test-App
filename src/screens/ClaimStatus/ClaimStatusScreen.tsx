import { router } from 'expo-router';
import { Button } from 'react-native';

import { Screen } from '@/components/Screen';

export default function ClaimStatusScreen() {
  return (
    <Screen title="Claim status">
      <Button title="Back to balances" onPress={() => router.navigate('/')} />
    </Screen>
  );
}
