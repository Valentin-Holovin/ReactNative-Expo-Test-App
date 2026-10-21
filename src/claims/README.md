# Claim lifecycle

A claim is confirmed explicitly in the form. Before submission, balances and
claim options are requested again; changed fees/destinations require another
review. The backend still owns the live balance check and final monetary values.

One unresolved claim per token is allowed. Its idempotency key, exact body and
reviewed terms are written to AsyncStorage BEFORE POST. A failed initial write
prevents submission. Once an ID is known, subsequent checks use GET by ID.
A timeout, network error or 5xx does not prove failure: the original POST is
replayed with the SAME saved key/body. Rejected validation requests can be edited;
409 mismatch stays locked. Rate-limit deadlines are persisted across reloads.

Storage is scoped by SHA-256 of the exact trimmed token. Keys and query keys do
not contain credentials. Browser Web Locks serialize start/recovery/clear across
tabs, and each operation rereads durable state while holding the lock. The web
workflow requires a current browser on HTTPS (localhost is also a secure context).
Browsers without secure crypto/locks fail closed instead of risking duplicate
submissions. No additional native integration is included in this web task.

The provider tracks the operation across screen changes and reloads. Changing the
token aborts requests for the old session; its saved attempt remains in its own
scope and is recovered when that token is used again.

The UI keeps server balances unchanged and displays the claim separately. New
claims remain locked until a completed/failed operation is followed by a balance
snapshot whose `asOf` is at least the claim's terminal `updatedAt`. This avoids
optimistic rollback jumps and prevents reusing the pre-claim snapshot. A failed
claim displays the server's failure reason; the server returns the funds.

`npm test` includes durable-write, timeout/reload, replay, duplicate clicks/tabs,
rate limiting, corrupt storage, account isolation and snapshot-ordering tests.
