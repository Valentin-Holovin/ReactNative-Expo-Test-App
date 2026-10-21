/** Decimal values stay strings; never convert money to JavaScript numbers. */
export type DecimalAmount = string;

export interface Balance {
  asset: string;
  decimals: number;
  available: DecimalAmount;
  pending: DecimalAmount;
  claiming: DecimalAmount;
  usdPrice: DecimalAmount;
}

export interface BalancesResponse {
  asOf: string;
  items: Balance[];
}

export type ClaimStatus = 'pending' | 'completed' | 'failed';

export interface Claim {
  id: string;
  asset: string;
  amount: DecimalAmount;
  fee: DecimalAmount;
  receiveAmount: DecimalAmount;
  destinationId: string;
  status: ClaimStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimOptions {
  asset: string;
  minAmount: DecimalAmount;
  fee: DecimalAmount;
  destinations: { id: string; label: string }[];
}

export interface CreateClaimRequest {
  asset: string;
  amount: DecimalAmount;
  destinationId: string;
}

export interface CreateClaimResponse {
  claim: Claim;
  replayed: boolean;
}

interface ActivityBase {
  id: string;
  asset: string;
  /** Signed decimal string: reversals and claims are negative. */
  amount: DecimalAmount;
  createdAt: string;
  relatedId: string | null;
}

export type ActivityItem = ActivityBase & (
  | { type: 'accrual'; status: 'pending' | 'confirmed'; exchange: string | null }
  | { type: 'reversal'; status: 'confirmed'; exchange: string | null }
  | { type: 'claim'; status: ClaimStatus; exchange: null }
);

export interface ActivityParams {
  limit?: number;
  cursor?: string | null;
}

export interface ActivityResponse {
  items: ActivityItem[];
  nextCursor: string | null;
}

export interface RequestOptions {
  signal?: AbortSignal;
}
