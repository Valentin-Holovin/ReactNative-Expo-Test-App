import { Decimal } from 'decimal.js';
import type { Claim, CreateClaimRequest, createCashMineApi } from '../api';

type Api = ReturnType<typeof createCashMineApi>;
export interface ClaimQuote { fee: string; receiveAmount: string; destinationLabel: string }
export interface ClaimAttempt {
  version: 1;
  key: string;
  body: CreateClaimRequest;
  quote: ClaimQuote;
  createdAt: string;
  state: 'unresolved' | 'accepted' | 'rejected';
  claim: Claim | null;
  retryAt: number;
  stopReason: 'UNAUTHORIZED' | 'IDEMPOTENCY_MISMATCH' | null;
}
interface Snapshot {
  ready: boolean;
  busy: boolean;
  attempt: ClaimAttempt | null;
  error: string | null;
}
interface Dependencies {
  api: Api;
  storageKey: string;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  createKey(): string;
  withLock<T>(work: () => Promise<T>): Promise<T>;
  signal: AbortSignal;
  onChange(): void;
  now?(): number;
}

export function canStartClaim(attempt: ClaimAttempt | null, asOf?: string | null): boolean {
  if (!attempt || attempt.state === 'rejected') return true;
  if (!attempt.claim || attempt.claim.status === 'pending') return false;
  const snapshotTime = Date.parse(asOf ?? '');
  const settledTime = Date.parse(attempt.claim.updatedAt);
  return Number.isFinite(snapshotTime) && Number.isFinite(settledTime) && snapshotTime >= settledTime;
}

function isAmount(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value) && value.trim() === value;
}
function validateClaim(claim: Claim, attempt: ClaimAttempt) {
  if (!claim || typeof claim.id !== 'string' || !claim.id || claim.asset !== attempt.body.asset ||
      claim.destinationId !== attempt.body.destinationId || !isAmount(claim.amount) ||
      !new Decimal(claim.amount).eq(attempt.body.amount) ||
      !isAmount(claim.fee) || !isAmount(claim.receiveAmount) ||
      !['pending', 'completed', 'failed'].includes(claim.status) ||
      !Number.isFinite(Date.parse(claim.createdAt)) || !Number.isFinite(Date.parse(claim.updatedAt)) ||
      (claim.failureReason !== null && typeof claim.failureReason !== 'string')) {
    throw new Error('The server returned an unexpected claim. Keep this attempt and check its status again.');
  }
  const Exact = Decimal.clone({ precision: claim.amount.length + claim.fee.length + claim.receiveAmount.length + 10 });
  if (!new Exact(claim.amount).minus(claim.fee).eq(claim.receiveAmount) || new Exact(claim.receiveAmount).lte('0')) {
    throw new Error('Inconsistent claim amounts');
  }
}

function readAttempt(raw: string): ClaimAttempt {
  const value = JSON.parse(raw) as ClaimAttempt;
  if (!value || value.version !== 1 || typeof value.key !== 'string' || !value.key.trim() || value.key.length > 100 ||
      typeof value.body?.asset !== 'string' || !value.body.asset || !isAmount(value.body.amount) ||
      typeof value.body.destinationId !== 'string' || !value.body.destinationId ||
      !isAmount(value.quote?.fee) || !isAmount(value.quote.receiveAmount) ||
      typeof value.quote.destinationLabel !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      !['unresolved', 'accepted', 'rejected'].includes(value.state) ||
      ![null, 'UNAUTHORIZED', 'IDEMPOTENCY_MISMATCH'].includes(value.stopReason) || !Number.isFinite(value.retryAt) || value.retryAt < 0 ||
      (value.state === 'accepted' ? !value.claim : value.claim !== null)) throw new Error('Invalid saved attempt');
  if (value.claim) validateClaim(value.claim, value);
  return value;
}

function failureMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'UNAUTHORIZED') return 'Your token is invalid or expired. Reconnect with the original token to recover this attempt.';
  if (code === 'IDEMPOTENCY_MISMATCH') return 'The server reports a key/body mismatch. This attempt is locked to prevent a duplicate claim.';
  if (code === 'RATE_LIMITED') return 'Too many requests. Waiting before checking again.';
  if (code === 'VALIDATION') return 'The server rejected the claim. Refresh balances and options before editing the amount or destination.';
  return 'Could not confirm the result. This is not a failure confirmation. Check again using the same saved attempt.';
}

/** Single durable attempt per token. Web Locks serialize work across tabs. */
export function createClaimController(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  let snapshot: Snapshot = { ready: false, busy: false, attempt: null, error: null };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let running = false;
  function update(patch: Partial<Snapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  }
  async function read() {
    const raw = await deps.storage.getItem(deps.storageKey);
    return raw ? readAttempt(raw) : null;
  }
  async function save(attempt: ClaimAttempt) {
    await deps.storage.setItem(deps.storageKey, JSON.stringify(attempt));
  }
  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    if (running || deps.signal.aborted) return;
    running = true;
    update({ busy: true, error: null });
    try { return await deps.withLock(work); }
    catch {
      update({ error: 'Could not access saved claim data. Nothing new will be sent until it can be recovered.' });
    } finally { running = false; update({ busy: false }); }
  }
  async function reconcile(attempt: ClaimAttempt, manual = false) {
    if (deps.signal.aborted || attempt.state === 'rejected' || attempt.stopReason ||
        now() < attempt.retryAt || (attempt.claim && attempt.claim.status !== 'pending' && !manual)) return;
    try {
      const claim = attempt.claim
        ? await deps.api.getClaim(attempt.claim.id, { signal: deps.signal })
        : (await deps.api.createClaim({ ...attempt.body }, attempt.key, { signal: deps.signal })).claim;
      validateClaim(claim, attempt);
      if (attempt.claim && attempt.claim.id !== claim.id) throw new Error('Mismatched claim ID');
      const next: ClaimAttempt = { ...attempt, claim, state: 'accepted', retryAt: 0 };
      update({ attempt: next, error: null });
      try { await save(next); }
      catch { update({ error: 'The result was received, but could not be saved. Your original attempt is still recoverable.' }); }
      deps.onChange();
    } catch (error) {
      // Keep the durable original key/body even when cancellation loses the response.
      if (deps.signal.aborted) return;
      const failure = error as { code?: string; retryAfterMs?: number; status?: number };
      const delay = typeof failure.retryAfterMs === 'number' && Number.isFinite(failure.retryAfterMs) && failure.retryAfterMs >= 0
        ? failure.retryAfterMs : 3000;
      const next: ClaimAttempt = {
        ...attempt,
        state: !attempt.claim && failure.status === 400 && failure.code === 'VALIDATION' ? 'rejected' : attempt.state,
        retryAt: now() + (failure.code === 'RATE_LIMITED' ? delay : 3000),
        stopReason: failure.code === 'UNAUTHORIZED' || failure.code === 'IDEMPOTENCY_MISMATCH' ? failure.code : null,
      };
      update({ attempt: next, error: failureMessage(error) });
      try { await save(next); } catch { /* Original attempt remains durable. */ }
      deps.onChange();
    }
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async restore() {
      return run(async () => {
        const attempt = await read();
        if (deps.signal.aborted) return;
        // A token revalidated by SessionProvider may resume a previously unauthorized attempt.
        const resumed = attempt?.stopReason === 'UNAUTHORIZED' ? { ...attempt, stopReason: null } : attempt;
        if (resumed && resumed !== attempt) await save(resumed);
        update({ ready: true, attempt: resumed });
      });
    },
    async start(body: CreateClaimRequest, quote: ClaimQuote, asOf: string) {
      return run(async () => {
        if (!snapshot.ready) return false;
        const existing = await read();
        if (!canStartClaim(existing, asOf)) {
          update({ attempt: existing, error: 'An earlier claim is still being resolved. Open its status instead of submitting again.' });
          return false;
        }
        const attempt: ClaimAttempt = {
          version: 1, key: deps.createKey(), body: { ...body }, quote: { ...quote },
          createdAt: new Date(now()).toISOString(), state: 'unresolved', claim: null, retryAt: 0, stopReason: null,
        };
        if (deps.signal.aborted) return false;
        await save(attempt); // MUST succeed before the first POST.
        update({ attempt });
        deps.onChange();
        await reconcile(attempt);
        return true;
      });
    },
    async sync(manual = false) {
      return run(async () => {
        if (!snapshot.ready) return;
        const attempt = await read();
        update({ attempt });
        if (attempt) await reconcile(attempt, manual);
      });
    },
    async clear(asOf?: string | null) {
      return run(async () => {
        const attempt = await read();
        if (!snapshot.ready || !canStartClaim(attempt, asOf)) return false;
        await deps.storage.removeItem(deps.storageKey);
        update({ attempt: null });
        return true;
      });
    },
  };
}
