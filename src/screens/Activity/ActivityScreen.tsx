import { router } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';

import { Action, Card, Detail, ui } from '@/components/Form';
import { Screen } from '@/components/Screen';

import { formatActivityAmount, formatActivityDate } from './activityQuery';
import { useActivityScreen } from './useActivityScreen';

const titles = { accrual: 'Payback earned', reversal: 'Reversal', claim: 'Claim' };

export default function ActivityScreen() {
  const screen = useActivityScreen();
  return (
    <Screen title="Activity">
      <Text style={ui.text}>Payback accruals, reversals and claims, newest first.</Text>
      <Action title="Change API token" secondary onPress={() => router.navigate('/token')} />
      <Action title={screen.refreshing ? 'Updating history…' : 'Refresh activity'} disabled={!screen.canFetch} secondary onPress={() => { void screen.refresh(); }} />
      {screen.error ? (
        <Card title={screen.unauthorized ? 'Connection expired' : 'Could not update history'}>
          <Text accessibilityRole="alert" style={ui.text}>{screen.error}</Text>
          {screen.hasData ? <Text style={ui.muted}>Previously loaded operations remain visible and may be out of date.</Text> : null}
          {screen.retrySeconds > 0 ? <Text accessibilityLiveRegion="polite" style={ui.muted}>Try again in {screen.retrySeconds}s.</Text> : null}
          {screen.unauthorized
            ? <Action title="Enter another token" onPress={() => router.navigate('/token')} />
            : <Action title={screen.retryLabel} disabled={!screen.canFetch} onPress={() => { void screen.retry(); }} />}
        </Card>
      ) : null}
      {screen.offline ? <Text accessibilityRole="alert" style={ui.muted}>You are offline. Updates will resume when the connection returns.</Text> : null}
      {screen.loading || screen.refreshing ? <ActivityIndicator accessibilityLabel="Loading activity" /> : null}
      {screen.hasData && screen.items.length === 0 ? <Card title="No activity yet"><Text style={ui.muted}>Your payback operations will appear here.</Text></Card> : null}
      {screen.items.map(item => (
        <Card key={item.id} title={titles[item.type]}>
          <Detail label="Amount" value={`${formatActivityAmount(item)} ${item.asset}`} />
          <Detail label="Status" value={item.status} />
          {item.exchange ? <Detail label="Exchange" value={item.exchange} /> : null}
          <Detail label="Date (UTC)" value={formatActivityDate(item.createdAt)} />
          {item.relatedId ? <Detail label="Related operation" value={item.relatedId} /> : null}
          {item.type === 'claim' && item.relatedId && item.relatedId === screen.currentClaimId
            ? <Action title="View claim status" secondary onPress={() => router.navigate('/claim-status')} /> : null}
        </Card>
      ))}
      {screen.cursorLoop ? <Text accessibilityRole="alert" style={ui.muted}>History pagination could not continue. Refresh the history before trying again.</Text> : null}
      {screen.hasNextPage ? <Action title={screen.loadingMore ? 'Loading more…' : 'Load more'} disabled={!screen.canFetch} secondary onPress={() => { void screen.loadMore(); }} /> : null}
      {screen.loadingMore ? <ActivityIndicator accessibilityLabel="Loading next page" /> : null}
      {screen.hasData && screen.items.length > 0 && !screen.hasNextPage && !screen.cursorLoop ? <Text style={ui.muted}>All operations loaded.</Text> : null}
      <Action title="Back to balances" secondary onPress={() => router.navigate('/')} />
    </Screen>
  );
}
