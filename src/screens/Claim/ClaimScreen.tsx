import { Link } from 'expo-router';

import { Screen } from '@/components/Screen';

export default function ClaimScreen() {
  return (
    <Screen title="Claim payback">
      <Link href="/claim-status">View claim status</Link>
      <Link href="/">Back to balances</Link>
    </Screen>
  );
}
