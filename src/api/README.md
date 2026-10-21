# CashMine API

```ts
import { createCashMineApi, ApiError } from '@/api';

// Token comes from the user's input/storage, never from source code.
const api = createCashMineApi(token);
const balances = await api.getBalances();
const options = await api.getClaimOptions('ETH');
const activity = await api.getActivity({ limit: 20 });
const nextPage = activity.nextCursor
  ? await api.getActivity({ cursor: activity.nextCursor })
  : null;
```

## Claims

Persist a unique `idempotencyKey` and the exact `{ asset, amount, destinationId }`
body before submitting. Pass both to `api.createClaim(body, idempotencyKey)`.
It returns `{ claim, replayed }`. Follow the result with `api.getClaim(claim.id)`.

All methods accept a final `{ signal }` argument for cancellation.
The client does not retry automatically or generate keys. A timeout, network
failure, cancellation or 5xx response on submission can leave the result unknown:
`ApiError.outcomeUnknown` is true. Reconcile by sending the SAME key and SAME body,
not by creating another attempt. Observe `retryAfterMs` on rate limits.

Amounts are decimal strings. The feature layer must validate precision/minimum
against balances/options; the server checks the live available balance. Fees are
deducted from the requested amount. Balances may lag by 15 seconds.

On token change, create a new API instance, cancel old requests and clear the
previous session's query cache. The API layer does not persist credentials or
pending attempts; that belongs to the session/claim feature.

Errors expose `code`, `status`, `field`, `retryAfterMs`, `outcomeUnknown`.
They intentionally do not retain Axios request config containing credentials.
