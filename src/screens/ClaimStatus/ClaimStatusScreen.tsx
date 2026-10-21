import { Link } from 'expo-router';

import { Screen } from '@/components/Screen';

export default function ClaimStatusScreen() {
  return (
    <Screen title="Claim status">
      <Link href="/">Back to balances</Link>
    </Screen>
  );
}
