import ClaimScreen from '@/screens/Claim/ClaimScreen';
import { useSession } from '@/session/SessionProvider';

export default function ClaimRoute() {
  const { session } = useSession();
  return <ClaimScreen key={session?.id} />;
}
