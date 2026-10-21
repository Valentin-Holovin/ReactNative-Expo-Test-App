import { router } from 'expo-router';
import { Text } from 'react-native';

import { Action, Card, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

export default function ActivityScreen() {
  return (
    <Screen title="Activity">
      <Text style={ui.text}>Payback accruals, reversals and claims, newest first.</Text>
      <Action title="Refresh activity" disabled secondary />
      <Card title="No activity loaded">
        <Text style={ui.muted}>Connect your API token to view your transaction history.</Text>
        <Action title="Set API token" onPress={() => router.navigate('/token')} />
      </Card>
      <Action title="Load more" disabled secondary />
      <Action title="Back to balances" secondary onPress={() => router.navigate('/')} />
    </Screen>
  );
}
