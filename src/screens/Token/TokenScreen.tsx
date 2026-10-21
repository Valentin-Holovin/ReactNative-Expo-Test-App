import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { Action, Card, Field, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

import { useTokenScreen } from './useTokenScreen';

export default function TokenScreen() {
  const screen = useTokenScreen();

  return (
    <Screen title="API token">
      <Text style={ui.text}>Enter your personal token to access your balances and claims.</Text>
      <Card>
        <Field label="Personal API token" placeholder="Paste your token" value={screen.token}
          onChangeText={screen.setToken} editable={!screen.busy} secureTextEntry={!screen.visible}
          autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false}
          onSubmitEditing={() => { void screen.submit(); }} returnKeyType="go" />
        <Action title={screen.visible ? 'Hide token' : 'Show token'} secondary onPress={screen.toggleVisible} />
        {screen.error ? <Text accessibilityRole="alert" style={ui.text}>{screen.error}</Text> : null}
        {screen.retrySeconds > 0 ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Try again in {screen.retrySeconds}s.</Text> : null}
        {screen.busy ? <ActivityIndicator accessibilityLabel="Checking token" /> : null}
        <Action title={screen.busy ? 'Connecting…' : 'Save and connect'}
          disabled={!screen.canSubmit} onPress={() => { void screen.submit(); }} />
        {screen.canRetryRestore ? <Action title="Retry saved token" secondary onPress={() => { void screen.retryRestore(); }} /> : null}
      </Card>
      <Text style={ui.muted}>Your token is saved in this browser after a successful connection. To change it, enter a new token.</Text>
      {screen.canGoBack ? <Action title="Back to balances" secondary disabled={screen.busy} onPress={() => router.navigate('/')} /> : null}
    </Screen>
  );
}
