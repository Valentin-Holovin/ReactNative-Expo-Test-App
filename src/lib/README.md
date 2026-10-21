# Money calculations

All public functions in `money.ts` accept/return decimal strings. JavaScript
`Number`, `parseFloat` and `toNumber()` must not be used for money.

- `parseAmount(input, decimals)` checks the API grammar and original fractional
  digit count, then returns a canonical non-exponential string. No whitespace,
  comma, leading zeros, sign or scientific notation is accepted. UI drafts such
  as `0.` can stay in input state but are not valid submissions.
- `parseSignedAmount` also allows negative activity amounts.
- `validateClaimAmount(input, { decimals, available, minAmount, fee })` returns
  either `{ ok: true, amount, fee, receiveAmount }` or a typed input error.
  Invalid server rules throw instead of being silently repaired.
- `calculateReceiveAmount` subtracts the fixed fee from the requested amount.
  As an additional client safeguard, the result must be strictly positive.
- `getMaxClaimAmount` returns the full available balance; do not subtract the
  fee again. Max still needs the regular claim validation (including minimum).
- `calculateUsdTotals` sums available, pending and claiming across all assets at
  their supplied USD prices. Category subtotals and the overall total are exact.
- `formatUsd` rounds only the displayed USD string to two decimal places using
  ROUND_HALF_UP. Never use this rounded value for requests or intermediate sums.

Arithmetic uses an isolated Decimal constructor with precision derived from
input lengths, so long amounts are not rounded to the default 20 significant
digits. These functions only add, subtract and multiply finite decimal values.
The shared Decimal configuration is not modified.

The claim form must revalidate after refreshing rules/balances. A snapshot can
lag by 15 seconds; the API is authoritative for live available funds and for the
final claim fee/receiveAmount. Local validation does not reserve funds.

Run `npm run test:money` for monetary tests or `npm test` for all tests.
The test commands use Node's TypeScript support (Node 22.18+ or Node 24).
