import { router } from 'expo-router';
import { Text } from 'react-native';

import { Action, Card, Detail, Field, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

export default function ClaimScreen() {
  return (
    <Screen title="Claim payback">
      <Card title="Claim details">
        <Field label="Asset" placeholder="Select an asset" editable={false} />
        <Detail label="Available balance" value="—" />
        <Field label="Amount" placeholder="0.00" inputMode="decimal" autoCorrect={false} />
        <Action title="Max" secondary disabled />
        <Detail label="Minimum claim" value="—" />
        <Field label="Destination" placeholder="Select a destination" editable={false} />
      </Card>
      <Card title="Summary">
        <Detail label="Claim amount" value="—" />
        <Detail label="Fee" value="—" />
        <Detail label="You receive" value="—" />
        <Text style={ui.muted}>The fee is deducted from the claim amount.</Text>
      </Card>
      <Action title="Review claim" disabled />
      <Text style={ui.muted}>Connect your token and load balances to make a claim.</Text>
      <Action title="View claim status" secondary onPress={() => router.navigate('/claim-status')} />
      <Action title="Back to balances" secondary onPress={() => router.navigate('/')} />
    </Screen>
  );
}
