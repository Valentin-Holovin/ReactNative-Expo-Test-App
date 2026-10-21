import { router } from 'expo-router';
import { Button } from 'react-native';

import { Screen } from '@/components/Screen';

export default function HomeScreen() {
  return (
    <Screen title="Balances">
      <Button title="Claim payback" onPress={() => router.navigate('/claim')} />
      <Button title="Activity" onPress={() => router.navigate('/activity')} />
      <Button title="API token" onPress={() => router.navigate('/token')} />
    </Screen>
  );
}
