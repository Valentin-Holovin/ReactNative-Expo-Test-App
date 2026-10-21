import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import type { ClaimOptions, CreateClaimRequest } from '@/api';
import { useClaims } from '@/claims/ClaimsProvider';
import { canStartClaim } from '@/claims/controller';
import type { ClaimQuote } from '@/claims/controller';
import { getMaxClaimAmount, parseAmount, validateClaimAmount } from '@/lib/money';
import { canRefreshBalances, getBalanceRetryAt } from '@/queries/balancePolicy';
import { useBalancesQuery } from '@/queries/useBalancesQuery';
import { useSession } from '@/session/SessionProvider';
import { sessionErrorMessage } from '@/session/controller';

class FormError extends Error {}
interface Review { body: CreateClaimRequest; quote: ClaimQuote }
function checkOptions(options: ClaimOptions, asset: string, decimals: number) {
  if (options.asset !== asset || !Array.isArray(options.destinations)) throw new FormError('Invalid claim options. Refresh and try again.');
  parseAmount(options.fee, decimals);
  parseAmount(options.minAmount, decimals);
  const ids = new Set<string>();
  options.destinations.forEach(destination => {
    if (!destination.id || !destination.label || ids.has(destination.id)) throw new FormError('Invalid destinations. Refresh and try again.');
    ids.add(destination.id);
  });
  return options;
}

export function useClaimScreen() {
  const { session } = useSession();
  const active = usePathname() === '/claim';
  const balances = useBalancesQuery(active);
  const claims = useClaims();
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDestination, setDestination] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const operation = useRef<AbortController | null>(null);
  useEffect(() => () => operation.current?.abort(), []);

  const assets = balances.query.data?.items ?? [];
  const asset = assets.find(item => item.asset === selectedAsset) ?? assets[0];
  const optionsKey = ['session', session?.id, 'claim-options', asset?.asset] as const;
  const previous = queryClient.getQueryState(optionsKey);
  const options = useQuery({
    queryKey: optionsKey,
    queryFn: async ({ signal }) => {
      if (!session || !asset) throw new FormError('Select an asset.');
      return checkOptions(await session.api.getClaimOptions(asset.asset, { signal }), asset.asset, asset.decimals);
    },
    enabled: active && !!session && !!asset && !claims.attempt &&
      canRefreshBalances(previous?.error, previous?.errorUpdatedAt ?? 0, balances.now),
    retry: false,
    staleTime: 15000,
    refetchOnWindowFocus: query => canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnReconnect: query => canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
    refetchOnMount: query => canRefreshBalances(query.state.error, query.state.errorUpdatedAt, Date.now()),
  });
  const destination = options.data?.destinations.find(item => item.id === selectedDestination) ?? options.data?.destinations[0];
  let validation: ReturnType<typeof validateClaimAmount> | null = null;
  try {
    if (asset && options.data) validation = validateClaimAmount(amount, {
      decimals: asset.decimals, available: asset.available, minAmount: options.data.minAmount, fee: options.data.fee,
    });
  } catch { /* Invalid API rules prevent submission. */ }
  const blockedUntil = Math.max(retryAt, getBalanceRetryAt(options.error, options.errorUpdatedAt),
    getBalanceRetryAt(balances.query.error, balances.query.errorUpdatedAt));
  const retrySeconds = Math.max(0, Math.ceil((blockedUntil - balances.now) / 1000));
  const canReview = claims.ready && !claims.busy && !claims.attempt && !submitting && !retrySeconds &&
    !balances.query.error && !options.error && !!validation?.ok && !!destination;

  function showReview() {
    if (!canReview || !validation?.ok || !asset || !destination) return;
    setReview({
      body: { asset: asset.asset, amount: validation.amount, destinationId: destination.id },
      quote: { fee: validation.fee, receiveAmount: validation.receiveAmount, destinationLabel: destination.label },
    });
    setError(null);
  }
  async function confirm() {
    if (!session || !review || operation.current || claims.busy || !claims.ready || Date.now() < blockedUntil) return;
    const request = new AbortController();
    operation.current = request;
    setSubmitting(true);
    setError(null);
    try {
      // Re-check terms and snapshot before creating the durable attempt.
      const latestBalances = await session.api.getBalances({ signal: request.signal });
      const latestAsset = latestBalances.items.find(item => item.asset === review.body.asset);
      if (!latestAsset) throw new FormError('This asset is no longer available. Edit the claim and select another asset.');
      const latestOptions = checkOptions(await session.api.getClaimOptions(latestAsset.asset, { signal: request.signal }), latestAsset.asset, latestAsset.decimals);
      queryClient.setQueryData(['session', session.id, 'balances'], latestBalances);
      queryClient.setQueryData(['session', session.id, 'claim-options', latestAsset.asset], latestOptions);
      const checked = validateClaimAmount(review.body.amount, {
        decimals: latestAsset.decimals, available: latestAsset.available,
        minAmount: latestOptions.minAmount, fee: latestOptions.fee,
      });
      const latestDestination = latestOptions.destinations.find(item => item.id === review.body.destinationId);
      if (!checked.ok) throw new FormError(checked.message);
      if (!latestDestination || checked.fee !== review.quote.fee || checked.receiveAmount !== review.quote.receiveAmount || latestDestination.label !== review.quote.destinationLabel) {
        setReview(null);
        throw new FormError('Claim terms changed. Review the updated fee and destination before confirming again.');
      }
      if (request.signal.aborted) return;
      const started = await claims.controller?.start(review.body, review.quote, latestBalances.asOf);
      if (started && !request.signal.aborted) router.replace('/claim-status');
    } catch (cause) {
      if (!request.signal.aborted) {
        setError(cause instanceof FormError ? cause.message : sessionErrorMessage(cause));
        setRetryAt(getBalanceRetryAt(cause, Date.now()));
      }
    } finally {
      if (!request.signal.aborted) setSubmitting(false);
      operation.current = null;
    }
  }
  async function startNew() {
    if (await claims.controller?.clear(balances.query.data?.asOf)) {
      setReview(null); setAmount(''); setError(null);
      await balances.refresh();
      await options.refetch({ cancelRefetch: false });
    }
  }
  return {
    assets, asset, amount, options: options.data, destination, validation, review,
    claims, submitting, canReview, retrySeconds,
    loading: balances.query.isFetching || options.isFetching,
    error: error ?? (balances.query.error ? sessionErrorMessage(balances.query.error) : options.error ? sessionErrorMessage(options.error) : claims.error),
    canStartNew: claims.ready && !claims.busy && canStartClaim(claims.attempt, balances.query.data?.asOf),
    chooseAsset(value: string) { setSelectedAsset(value); setDestination(''); setAmount(''); setReview(null); setError(null); },
    chooseDestination(value: string) { setDestination(value); setReview(null); },
    changeAmount(value: string) { setAmount(value); setReview(null); setError(null); },
    max() { if (asset) { setAmount(getMaxClaimAmount(asset.available, asset.decimals)); setReview(null); } },
    showReview, confirm, startNew,
    edit: () => { if (!submitting) setReview(null); },
    async refresh() {
      if (Date.now() < blockedUntil || submitting) return;
      await balances.refresh();
      if (!claims.attempt && canRefreshBalances(options.error, options.errorUpdatedAt, Date.now())) await options.refetch({ cancelRefetch: false });
    },
  };
}
