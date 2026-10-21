import { router, usePathname } from 'expo-router';

import { useClaims } from '@/claims/ClaimsProvider';
import { canStartClaim } from '@/claims/controller';
import { useBalancesQuery } from '@/queries/useBalancesQuery';

export function useClaimStatusScreen() {
  const claims = useClaims();
  const balances = useBalancesQuery(usePathname() === '/claim-status');
  const attempt = claims.attempt;
  const retrySeconds = Math.max(0, Math.ceil(((attempt?.retryAt ?? 0) - balances.now) / 1000));
  const canStartNew = claims.ready && !claims.busy && canStartClaim(attempt, balances.query.data?.asOf);
  return {
    ...claims, retrySeconds, canStartNew,
    waitingForSnapshot: !!attempt?.claim && attempt.claim.status !== 'pending' && !canStartNew,
    canCheck: claims.ready && !!attempt && !claims.busy && !attempt.stopReason && !retrySeconds && attempt.state !== 'rejected' && (!attempt.claim || attempt.claim.status === 'pending'),
    check: () => { void claims.controller?.sync(true); },
    refreshBalances: balances.refresh,
    balancesError: !!balances.query.error,
    async startNew() {
      if (await claims.controller?.clear(balances.query.data?.asOf)) router.replace('/claim');
    },
  };
}
