import { router } from 'expo-router';
import { Text } from 'react-native';

import { Action, Card, Detail, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

export default function HomeScreen() {
  return (
    <Screen title="Balances">
      <Card title="Total balance (USD)">
        <Text selectable style={ui.total}>—</Text>
        <Text style={ui.muted}>Includes available, pending and claiming balances.</Text>
        <Detail label="Last updated" value="Not loaded yet" />
        <Action title="Refresh balances" disabled secondary />
      </Card>
      <Card title="Your assets">
        <Detail label="Available to claim" value="—" />
        <Detail label="Pending confirmation" value="—" />
        <Detail label="Currently claiming" value="—" />
        <Text style={ui.muted}>Connect your API token to load your assets.</Text>
        <Action title="Set API token" onPress={() => router.navigate('/token')} />
      </Card>
      <Action title="Claim payback" onPress={() => router.navigate('/claim')} />
      <Action title="Activity" secondary onPress={() => router.navigate('/activity')} />
    </Screen>
  );
}
