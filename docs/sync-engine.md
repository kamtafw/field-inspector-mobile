# Sync Engine — Architectural Invariants

## What Invariant Does This Protect?

Every mutation a user makes is delivered to the server **at least once** in creation order, and produces its effect **at most once**.

The client may transmit duplicates.  
The server must guarantee idempotent effect.

## What Assumptions Must Never Change?

- The local database is the primary source of truth. The server is a sync target, not a live dependency.
- Every queued operation carries a unique idempotency key generated at write time, before any network attempt.
- Operations are processed in ascending `created_ts` order.

## What Breaks if This Is Modified Incorrectly?

- Removing idempotency keys causes duplicate server records on retry.
- Changing the processing order can create UPDATE operations that arrive before their CREATE counterparts.
- Bypassing the queue and writing directly to the API breaks the offline guarantee entirely.

## System Model

This is an **offline-first, single-writer client model**.

- The mobile client is the only writer of its local records.
- The server is authoritative for versioning.
- Conflict detection occurs server-side.
- The client reconciles based on server response.
- The queue represents *intent*, not truth.

This system assumes a single active device per user.  
Multi-device concurrent edits are not supported.

## Queue Structure

Operations are stored in the `sync_operations` WatermelonDB table with the following lifecycle statuses:

```toml
pending → in_progress → completed
                      ↘ failed → (retry) → in_progress → ...
                                         → quarantined (max retries exceeded)
```

A `pending` operation is always ready to process. A `failed` operation is only eligible once its `next_retry_ts` timestamp has elapsed. Operations are fetched in ascending `created_ts` order to preserve causal ordering — a CREATE must land before its UPDATE.

The queue is the source of truth for what has not yet been confirmed by the server. An operation is removed from active processing only after the server returns a success response or a conflict (409). Errors that are not actionable (max retries exceeded) result in quarantine, not deletion.

## Idempotency Key Lifecycle

An idempotency key is a UUID generated at the moment the user mutation is recorded locally — not when the network request is made. This is a deliberate design choice.

The key is stored on the `SynOperation` record and included in every outgoing request as the `Idempotency-Key` header. If the server has already processed a key, it returns the cached result without re-executing the operation. The client treats this response identically to a fresh success.

Keys are scoped to a single logical operation. They are never reused across different mutations, and they are never regenerated on retry. Regenerating a key on retry defeats the purpose — the server would re-process the operation and potentially create a duplicate record.

## Retry Policy

Failed operations use exponential backoff. The delay before a retry is calculated as:

```ts
backoff_seconds = min(2^retryCount, 64)
```

This caps at 64 seconds. The maximum retry count is **5**. After 5 failed attempts, the inspection is quarantined — its local status is set to `sync_failed`, and it is excluded from future queue processing until manually reviewed.

Client-side errors (4xx responses, excluding 409) are not retried. They indicate a problem with the request itself, not a transient network condition. Retrying them wastes cycles and can mask bugs.

409 conflicts are not treated as failures. They are handled immediately via the conflict flow and the operation is marked completed.

## Batch Routing Threshold

The engine routes operations based on queue size at the time of processing:

- **1–2 operations** → processed individually via `POST /api/v1/inspections/`
- **3+ operations** → processed as a batch via `POST /api/v1/sync/batch/`

The threshold of 3 is not arbitrary. Individual processing gives finer-grained error isolation. Batch processing reduces round-trips when a user has been offline for an extended period. The tradeoff is that batch responses require per-operation result parsing.

When batch processing is used, rollback points are captured for all operations before the batch request is sent. If the batch fails at the network level, local state is restored from those snapshots.

## Circuit Breaker

The circuit breaker wraps every outgoing network call. It tracks consecutive failures and transitions through three states:

- **Closed** — normal operations. Requests proceed.
- **Open** — triggered after **5 consecutive failures**. All outgoing sync requests are blocked immediately. A user-facing alert is shown. The breaker holds open for **60 seconds**.
- **Half-open** — after the 60-second timeout, one probe request is allowed through. On success, the breaker closes and the failure count resets. On failure, it returns to open.

The circuit breaker prevents a degraded or unreachable server from generating a flood of failed retries. It also gives the server time to recover before being hit again.

The circuit breaker state is in-memory and does not persist across app restarts. A fresh app launch always starts with a closed breaker.
