import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { Action, Card, Detail, Field, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

import { useClaimScreen } from './useClaimScreen';

export default function ClaimScreen() {
  const screen = useClaimScreen();
  const review = screen.review;
  return (
    <Screen title={review ? 'Confirm claim' : 'Claim payback'}>
      {screen.error ? <Text accessibilityRole="alert" style={ui.text}>{screen.error}</Text> : null}
      {screen.retrySeconds > 0 ? <Text style={ui.muted}>Try again in {screen.retrySeconds}s.</Text> : null}
      {screen.claims.attempt ? (
        <Card title="Saved claim">
          <Text style={ui.text}>{screen.claims.attempt.body.amount} {screen.claims.attempt.body.asset}</Text>
          <Text style={ui.muted}>Open the existing claim to follow its result. A new claim is available after settlement and a fresh balance snapshot.</Text>
          <Action title="View claim status" onPress={() => router.navigate('/claim-status')} />
          <Action title="Start a new claim" disabled={!screen.canStartNew} onPress={() => { void screen.startNew(); }} />
        </Card>
      ) : review ? (
        <>
          <Card title="Check before submitting">
            <Detail label="Asset" value={review.body.asset} />
            <Detail label="Claim amount" value={review.body.amount} />
            <Detail label="Fee" value={review.quote.fee} />
            <Detail label="You receive" value={review.quote.receiveAmount} />
            <Detail label="Destination" value={review.quote.destinationLabel} />
            <Text style={ui.muted}>The fee is deducted from the claim amount. Submission creates one claim.</Text>
          </Card>
          <Action title={screen.submitting ? 'Submitting…' : 'Confirm and submit'} disabled={screen.submitting || screen.claims.busy || screen.retrySeconds > 0} onPress={() => { void screen.confirm(); }} />
          <Action title="Edit claim" secondary disabled={screen.submitting} onPress={screen.edit} />
        </>
      ) : (
        <>
          {screen.loading ? <ActivityIndicator accessibilityLabel="Loading claim options" /> : null}
          <Card title="Select asset">
            {screen.assets.map(asset => <Action key={asset.asset} title={`${screen.asset?.asset === asset.asset ? '✓ ' : ''}${asset.asset}`} secondary onPress={() => screen.chooseAsset(asset.asset)} />)}
            {!screen.assets.length && !screen.loading ? <Text style={ui.muted}>No assets available.</Text> : null}
          </Card>
          <Card title="Claim details">
            <Detail label="Available balance" value={screen.asset ? `${screen.asset.available} ${screen.asset.asset}` : '—'} />
            <Field label="Amount" value={screen.amount} onChangeText={screen.changeAmount} placeholder="0.00" inputMode="decimal" autoCorrect={false} />
            <Action title="Max" secondary disabled={!screen.asset} onPress={screen.max} />
            <Detail label="Minimum claim" value={screen.options?.minAmount ?? '—'} />
            {screen.amount && screen.validation && !screen.validation.ok ? <Text accessibilityRole="alert" style={ui.text}>{screen.validation.message}</Text> : null}
          </Card>
          <Card title="Select destination">
            {screen.options?.destinations.map(destination => <Action key={destination.id} title={`${screen.destination?.id === destination.id ? '✓ ' : ''}${destination.label}`} secondary onPress={() => screen.chooseDestination(destination.id)} />)}
            {screen.options?.destinations.length === 0 ? <Text style={ui.muted}>No destinations available for this asset.</Text> : null}
          </Card>
          <Card title="Summary">
            <Detail label="Fee" value={screen.options?.fee ?? '—'} />
            <Detail label="You receive" value={screen.validation?.ok ? screen.validation.receiveAmount : '—'} />
          </Card>
          <Action title="Review claim" disabled={!screen.canReview} onPress={screen.showReview} />
          <Action title="Refresh balances and options" secondary disabled={screen.loading || screen.retrySeconds > 0} onPress={() => { void screen.refresh(); }} />
        </>
      )}
      <Action title="Back to balances" secondary disabled={screen.submitting} onPress={() => router.navigate('/')} />
    </Screen>
  );
}
