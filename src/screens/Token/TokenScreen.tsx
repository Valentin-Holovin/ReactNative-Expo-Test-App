import { Link } from 'expo-router';

import { Screen } from '@/components/Screen';

export default function TokenScreen() {
  return (
    <Screen title="API token">
      <Link href="/">Back to balances</Link>
    </Screen>
  );
}
