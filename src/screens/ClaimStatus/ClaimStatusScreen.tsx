import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { Action, Card, Detail, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

import { useClaimStatusScreen } from './useClaimStatusScreen';

export default function ClaimStatusScreen() {
  const screen = useClaimStatusScreen();
  const attempt = screen.attempt;
  const claim = attempt?.claim;
  return (
    <Screen title="Claim status">
      {!screen.ready || screen.busy ? <ActivityIndicator accessibilityLabel="Checking claim" /> : null}
      {screen.error ? <Text accessibilityRole="alert" style={ui.text}>{screen.error}</Text> : null}
      {attempt ? (
        <>
          <Card title={claim?.status === 'completed' ? 'Claim completed' : claim?.status === 'failed' ? 'Claim failed' : attempt.state === 'rejected' ? 'Claim rejected' : claim ? 'Claim processing' : 'Checking submission result'}>
            <Detail label="Claim ID" value={claim?.id ?? 'Not confirmed yet'} />
            <Detail label="Status" value={claim?.status ?? (attempt.state === 'rejected' ? 'rejected' : 'unknown')} />
            <Detail label="Asset" value={attempt.body.asset} />
            <Detail label="Amount" value={claim?.amount ?? attempt.body.amount} />
            <Detail label="Fee" value={claim?.fee ?? attempt.quote.fee} />
            <Detail label={claim?.status === 'completed' ? 'Received' : claim?.status === 'failed' ? 'Expected receive (not paid)' : claim ? 'Net amount' : 'Estimated receive'} value={claim?.receiveAmount ?? attempt.quote.receiveAmount} />
            <Detail label="Destination" value={attempt.quote.destinationLabel} />
            <Detail label="Last updated" value={claim?.updatedAt ?? attempt.createdAt} />
            {claim?.failureReason ? <Text accessibilityRole="alert" style={ui.text}>{claim.failureReason}</Text> : null}
          </Card>
          {!claim && attempt.state !== 'rejected' ? <Text style={ui.text}>The result is not yet known. We will check the original saved attempt; do not create another claim.</Text> : null}
          {claim?.status === 'pending' ? <Text style={ui.muted}>Status is checked automatically. The balance snapshot may take 15 seconds to catch up.</Text> : null}
          {claim?.status === 'failed' ? <Text style={ui.muted}>The server returns the amount to your available balance. Wait for a fresh snapshot.</Text> : null}
          {attempt.stopReason === 'UNAUTHORIZED' ? <Action title="Reconnect API token" onPress={() => router.navigate('/token')} /> : null}
          {attempt.stopReason === 'IDEMPOTENCY_MISMATCH' ? <Text accessibilityRole="alert" style={ui.text}>Key/body mismatch: automatic submission is stopped. Keep this attempt for investigation.</Text> : null}
          {screen.retrySeconds > 0 ? <Text style={ui.muted}>Next check in {screen.retrySeconds}s.</Text> : null}
          <Action title={claim ? 'Check status' : 'Recover original attempt'} secondary disabled={!screen.canCheck} onPress={screen.check} />
          {screen.waitingForSnapshot ? <Text style={ui.muted}>Waiting for a balance snapshot taken after settlement. New claims remain locked.</Text> : null}
          {screen.balancesError ? <Action title="Retry balance update" secondary onPress={() => { void screen.refreshBalances(); }} /> : null}
          <Action title="Start a new claim" disabled={!screen.canStartNew} onPress={() => { void screen.startNew(); }} />
        </>
      ) : screen.ready ? <Card title="No claim selected"><Text style={ui.muted}>Submit a claim to follow its status here.</Text></Card> : null}
      <Action title="Back to balances" secondary onPress={() => router.navigate('/')} />
    </Screen>
  );
}
