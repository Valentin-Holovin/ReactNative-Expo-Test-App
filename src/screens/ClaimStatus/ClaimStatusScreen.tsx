import { router } from 'expo-router';
import { Text } from 'react-native';

import { Action, Card, Detail, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

export default function ClaimStatusScreen() {
  return (
    <Screen title="Claim status">
      <Card title="No claim selected">
        <Text style={ui.text}>Your claim status will appear here after submission.</Text>
        <Detail label="Claim ID" value="—" />
        <Detail label="Status" value="—" />
        <Detail label="Asset" value="—" />
        <Detail label="Amount" value="—" />
        <Detail label="Fee" value="—" />
        <Detail label="You receive" value="—" />
        <Detail label="Destination" value="—" />
        <Detail label="Last updated" value="—" />
        <Action title="Check status" disabled secondary />
      </Card>
      <Action title="Back to balances" onPress={() => router.navigate('/')} />
    </Screen>
  );
}
