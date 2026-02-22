# Boot Sequence — Architectural Invariants

## What Invariant Does This Protect?

The app reaches a consistent, operational state before any user interaction or background sync activity begins. No step that depends on a prior step ever runs before that prior step completes successfully.

## What Assumptions Must Never Change?

- The database initializes before any repository access. No service, hook, or component reads from or writes to WatermelonDB before the database step completes.
- Auth state is restored before the sync engine starts. The sync engine must not attempt authenticated requests using a session that has not yet been validated.
- Boot is sequential. Steps do not run in parallel. Order is enforced by `BootManager`.

## What Breaks If This Is Modified Incorrectly?

- Running sync before auth restoration means the engine may attempt requests with no valid token — requests that will fail or, worse, succeed with a stale/wrong identity.
- Running anything before database initialization causes immediate crashes at the repository layer.
- Parallelizing boot steps removes the ordering guarantee entirely.

## Order of Initialization

```markdown
1. database         (required)
2. auth             (optional)
3. network          (optional)
4. autosync         (optional)
```

`BootManager` iterates steps in registration order. If a **required** step fails, the manager rolls back all completed steps in reverse order and halts. If an **optional** step fails, the manager logs the failure and continues.

Only `database` is marked required. The app cannot function without a readable local store. All other steps are optional because the app must remain usable — offline and unauthenticated — even when those services are unavailable.

## Why Database Initializes First

Every layer of the application that touches local data — repositories, the sync engine, the integrity checker — speaks to WatermelonDB. WatermelonDB must be initialized and validated before any of those layers are activated.

The `DatabaseStep` performs three things in sequence:

1. Validates that the device filesystem is accessible and has at minimum 100 MB of free space
2. Calls `initDatabase()` to open or create the SQLite store
3. Runs a validation query against the `inspections` collection to confirm the schema is readable

If initialization fails due to a schema migration error, corruption, or malformed database, recovery is attempted by re-running `initDatabase()`. If recovery also fails, the step throws and the app halts with a user-facing error offering retry or database reset options.

Database reset clears all local data. The user is warned explicitly. Synced inspections are recoverable from the server; unsynced operations are not.

## Why Auth Restore Happens Before Queue Processing

The sync engine sends authenticated HTTP requests. JWT access tokens are stored in Expo SecureStore and must be read and validated before any outgoing request is made.

The `AuthStep` calls `AuthService.isAuthenticated()` and, if authenticated, loads the current user. The result is stored in module-level state (`restoredAuth`) and made available to the rest of the app via `getRestoredAuth()`.

Auth is marked optional because a failed auth step should land the user on the login screen, not crash the app. The sync engine checks for a valid session before processing and will not begin if auth is absent.

Queue processing (the `AutoSyncStep`) is the last registered step, ensuring that by the time sync begins, both the database and auth state are confirmed ready.

## Recovery Behaviour After Crash

`BootManager` does not persist boot state. Every app launch begins a fresh boot sequence from step one. There is no concept of "resuming" a partial boot.

This is intentional. Partial initialization is more dangerous than full re-initialization. Re-running each step from scratch is safe because each step is idempotent — opening an already-initialized database, restoring an already-valid token, and registering a network listener are all harmless to repeat.

If the app crashed mid-sync on the previous session, the sync queue contains operations in `in_progress` status. On the next boot, after database and auth are confirmed ready, the sync engine re-fetches the queue. `in_progress` operations are not automatically retried — they remain in their status until the engine's queue fetch logic re-evaluates them. This avoids blindly reprocessing operations whose outcome is unknown.

Before boot steps execute, a `DataIntegrityService` check runs asynchronously. It scans for known inconsistency patterns — orphaned operations, inspections stuck in transition states — and auto-fixes issues it can resolve safely. Issues it cannot fix are surfaced to the user as alerts. This check does not block boot; it runs in parallel with the boot sequence.

## Non-Goals

- Parallel boot optimization
- Real-time socket initialization during boot
- Lazy database migration

Boot is about correctness, not speed.
