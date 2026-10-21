import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Action, Card, Field, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

export default function TokenScreen() {
  const [visible, setVisible] = useState(false);

  return (
    <Screen title="API token">
      <Text style={ui.text}>Enter your personal token to access your balances and claims.</Text>
      <Card>
        <Field label="Personal API token" placeholder="Paste your token" secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} />
        <Action title={visible ? 'Hide token' : 'Show token'} secondary onPress={() => setVisible((value) => !value)} />
        <Action title="Save and connect" disabled />
      </Card>
      <Text style={ui.muted}>Use this screen whenever you need to change your token.</Text>
      <Action title="Back to balances" secondary onPress={() => router.navigate('/')} />
    </Screen>
  );
}
