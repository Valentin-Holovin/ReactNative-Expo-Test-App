import { router } from 'expo-router';
import { Button } from 'react-native';

import { Screen } from '@/components/Screen';

export default function ActivityScreen() {
  return (
    <Screen title="Activity">
      <Button title="Back to balances" onPress={() => router.navigate('/')} />
    </Screen>
  );
}
