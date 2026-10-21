import { Link } from 'expo-router';

import { Screen } from '@/components/Screen';

export default function ActivityScreen() {
  return (
    <Screen title="Activity">
      <Link href="/">Back to balances</Link>
    </Screen>
  );
}
