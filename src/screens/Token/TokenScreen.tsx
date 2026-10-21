import { router } from 'expo-router';
import { Button } from 'react-native';

import { Screen } from '@/components/Screen';

export default function TokenScreen() {
  return (
    <Screen title="API token">
      <Button title="Back to balances" onPress={() => router.navigate('/')} />
    </Screen>
  );
}
