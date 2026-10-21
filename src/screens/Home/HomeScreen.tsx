import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { Action, Card, Detail, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

import { useHomeScreen } from './useHomeScreen';

export default function HomeScreen() {
  const screen = useHomeScreen();
  const balances = screen.balances;

  return (
    <Screen title="Balances">
      <Action title="Change API token" secondary onPress={() => router.navigate('/token')} />
      {screen.error ? (
        <Card title={screen.unauthorized ? 'Connection expired' : 'Could not update balances'}>
          <Text accessibilityRole="alert" style={ui.text}>{screen.error}</Text>
          {balances ? <Text style={ui.muted}>Showing the last successful snapshot. These balances may be out of date.</Text> : null}
          {screen.retrySeconds > 0 ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Try again in {screen.retrySeconds}s.</Text> : null}
          {screen.unauthorized
            ? <Action title="Enter another token" onPress={() => router.navigate('/token')} />
            : <Action title="Retry" disabled={!screen.canRefresh} onPress={() => { void screen.refresh(); }} />}
        </Card>
      ) : null}
      {screen.offline ? <Text accessibilityRole="alert" style={ui.muted}>You are offline. Updates will resume when the connection returns.</Text> : null}
      <Card title="Total balance (USD)">
        <Text selectable style={ui.total}>{balances ? `$${balances.totalUsd}` : '—'}</Text>
        <Text style={ui.muted}>Includes available, pending and claiming balances.</Text>
        {balances ? (
          <>
            <Detail label="Available (USD)" value={`$${balances.availableUsd}`} />
            <Detail label="Pending (USD)" value={`$${balances.pendingUsd}`} />
            <Detail label="Claiming (USD)" value={`$${balances.claimingUsd}`} />
          </>
        ) : null}
        <Detail label="Snapshot time (UTC)" value={screen.asOf ?? 'Not loaded yet'} />
        {screen.freshness ? <Text style={ui.muted}>Snapshot: {screen.freshness}. Server snapshots update every 15 seconds.</Text> : null}
        {screen.refreshing ? <ActivityIndicator accessibilityLabel={screen.loading ? 'Loading balances' : 'Refreshing balances'} /> : null}
        <Action title={screen.refreshing ? 'Updating balances…' : 'Refresh balances'}
          disabled={!screen.canRefresh} secondary onPress={() => { void screen.refresh(); }} />
      </Card>
      {balances?.assets.length === 0 ? (
        <Card title="No assets yet"><Text style={ui.muted}>Your payback balances will appear here when available.</Text></Card>
      ) : null}
      {balances?.assets.map((balance) => (
        <Card key={balance.asset} title={balance.asset}>
          <Detail label="Total (USD)" value={`$${balance.usdTotal}`} />
          <Detail label="Available to claim" value={`${balance.available} ${balance.asset}`} />
          <Detail label="Pending confirmation" value={`${balance.pending} ${balance.asset}`} />
          <Detail label="Currently claiming" value={`${balance.claiming} ${balance.asset}`} />
        </Card>
      ))}
      <View style={{ gap: 16 }}>
        <Action title="Claim payback" disabled={!balances || !balances.assets.some((asset) => asset.available !== '0') || !!screen.error}
          onPress={() => router.navigate('/claim')} />
        <Action title="Activity" secondary onPress={() => router.navigate('/activity')} />
      </View>
    </Screen>
  );
}
