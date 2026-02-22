# Conflict Resolution — Architectural Invariants

## What Invariant Does This Protect?

No inspection write ever silently overwrites another user's changes. Every version mismatch is surfaced explicitly, and resolution requires a deliberate user action.

## What Assumptions Must Never Change?

- The server is the authority on the current version of an inspection. The client's version is only valid at the time it was last synced.
- A conflict is a data integrity signal, not a sync error. It must never be swallowed, auto-resolved without user awareness, or retried away.
- After resolution, the client adopts the server's version number before re-queuing the update.

## What Breaks If This Is Modified Incorrectly?

Silent overwrites destroy audit integrity — a manager's approval or another inspector's correction could be erased without trace. Auto-resolving conflicts removes human judgment from a process that requires it. Failing to adopt the server version after resolution causes an immediate second conflict on the next sync.

## When Conflicts Are Generated

A conflict is generated when the server rejects an update because the client's version number does not match the server's current version. This happens when another client — or the same user on another device — has successfully written to the same inspection since the current client last synced.

On the mobile client, a conflict record is created locally the moment a 409 response is received, regardless of whether the app is in the foreground. The sync operation is then marked `completed` (not failed) — the conflict has been handled, even if not yet resolved. The inspection's local status transitions to `conflict`.

## What `409 Conflict` Means in This System

`409 Conflict` does not mean the request was malformed or the server encountered an error. It means the server has a version of this record that the client did not know about when it made its local edit.

It means version divergence.

The `409` response body carries:

- `client_version` — the version the client submitted
- `server_version` — the version currently on the server
- `server_data` — a full snapshot of the server's current state, including who last modified it and when

This payload is what populates the local `ConflictRecord`. Without it, the user cannot make an informed resolution decision.

`409` is treated as a correctness signal in a multi-writer distributed system. The server is protecting data integrity.

The sync engine must:

- Mark the queue entry as `conflicted`
- Stop retrying that operation
- Hand control to the resolution flow

## User Decision Flow

Once a conflict is recorded, the inspection is flagged in the UI. The inspector navigates to the conflict resolution screen, which presents:

1. A summary of what happened — who edited the server version and when
2. A field-by-field comparison of client vs. server values, with conflicting fields highlighted

The inspector selects one of three strategies:

- **`keep_mine`** — discard server changes, resubmit the client's version
- **`keep_theirs`** — discard local changes, adopt the server's version as-is
- **`merge`** — review each conflicting field individually and compose a combined version

All three strategies require an explicit tap. There is no default selection. The resolve button is disabled until a strategy is chosen.

After resolution, the local inspection is updated with the chosen data, its version is set to `server_version`, and the conflict record is marked resolved. A new sync operation is enqueued to push the resolved state to the server.

## Version Increment Rules

The server increments `version` by 1 on every successful write (`inspection.version += 1`). The client never calculates or predicts the next version number — it reads the version from the server response and stores it.

During conflict resolution, the resolved inspection is saved locally with `version = conflict.serverVersion`. This ensures the next sync attempt submits the correct base version and passes the server's optimistic lock check.

Version numbers are monotonically increasing integers. They carry no semantic meaning beyond ordering. They are not timestamps, not content hashes, and not guaranteed to be contiguous (gaps can form if operations are rolled back).

## Why Silent Overwrite Is Forbidden

This system operates in multi-user, low-connectivity environments where inspections may be reviewed, approved, or corrected by a manager between the time an inspector goes offline and the time they reconnect. A silent overwrite would:

- Erase a manager's corrections without any record
- Allow a stale client state to win over a more recent server state, silently
- Corrupt the audit trail — the `ConflictRecord` exists precisely to preserve both states

Optimistic locking exists as the enforcement mechanism. The 409 response is the signal that enforcement triggered. Swallowing that signal — by auto-incrementing the version and retrying, or by skipping the version check — would render the integrity model inert.

The constraint is not a UX decision. It is a correctness guarantee.
