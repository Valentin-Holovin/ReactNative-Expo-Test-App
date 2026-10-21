import { Link } from 'expo-router';

import { Screen } from '@/components/Screen';

export default function HomeScreen() {
  return (
    <Screen title="Balances">
      <Link href="/claim">Claim payback</Link>
      <Link href="/activity">Activity</Link>
      <Link href="/token">API token</Link>
    </Screen>
  );
}
