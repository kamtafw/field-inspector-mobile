# VANTAGE Field Inspector — Mobile App

Offline-first mobile client for the VANTAGE Field Inspector platform.

Designed for inspectors operating in low-connectivity environments, the app supports full offline inspection workflows with background synchronization and conflict resolution.

## Overview

The mobile app enables inspectors to:

- Download inspection templates
- Create and edit inspections offline
- Attach photos
- Sync batched operations when connectivity returns
- Resolve data conflicts safely

The application is built around an offline-first architecture, where the local database is the primary source of truth and the server acts as a synchronization target.

## Architecture Summary

```scss
UI Layer (Screens)
      │
      ▼
Hooks & Services
      │
      ▼
Local Database (Offline Source of Truth)
      │
      ▼
Sync Queue Engine
      │
      ▼
Backend API

```

### Architectural Principles

- **Offline-first** — All inspection data is stored locally
- **Queued writes** — Mutations are stored in a sync queue before being sent to the server
- **Conflict-aware updates** — Version mismatches trigger resolution flows
- **Separation of concerns** — UI is decoupled from data-fetching and sync logic

## Core Capabilities

### Offline Inspections

Users can create, edit, and submit inspections without network access. All changes are persisted locally.

### Sync Queue Engine

A central `SyncEngine` processes queued operations:

- Each operation includes an idempotency key
- Routes small queues individually, large queues via batch endpoints
- Applies retries with exponential backoff
- Opens a circuit breaker after repeated failures
- Conflicts are surfaced to the user

### Conflict Resolution

Version mismatches (HTTP 409) create local conflict records.
Inspectors can:

- Keep local version
- Accept server version
- View field-level differences before deciding

### Media Upload Pipeline

Photo are queued separately and uploaded after inspection sync:

1. Request signed upload parameters
2. Upload directly to Cloudinary
3. Confirm upload with backend

## Tech Stack

- React Native 0.81 + Expo SDK 54
- TypeScript
- WatermelonDB (SQLite)
- Axios (API layer)
- Expo SecureStore (JWT Storage)
- NetInfo (connectivity detection)

## Project Structure (High-Level)

```scss
src/
 ├── screens/
 ├── components/
 ├── database/
 ├── services/
 ├  ├── auth/
 ├  ├── sync/
 ├  ├── network/
 ├  └── photo/
 ├── navigation/
 ├── providers/
 └── hooks/
```

Detailed breakdown available in `/docs/architecture.md`.

## Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI
- Android Studio or Xcode
- Running backend instance

## Installation

```bash
git clone https://github.com/kamtafw/field-inspector-mobile.git
cd field-inspector-mobile

npm install
```

Set API base URL in `src/config/index.ts`:

```ts
export API_BASE_URL = 
__DEV__
  ? 'http://<your-lan-ip>:8000/api/v1/'
  : 'http://api.yourdomain.com/api/v1/'
```

Start development:

```bash
npx expo run:android
# or
npx expo run:ios
```

## Offline-First Model

### Write Flow

1. User edits inspection.
2. Local database updates immediately.
3. A `SyncOperation` is created with an idempotency key.
4. `SyncEngine` processes queue when online.

### Read Flow

- All UI subscribes to local database observables.
- No screen depends directly on live API responses.

## Boot Lifecycle

On app launch:

1. Database initializes
2. Auth tokens restored
3. Network status checked
4. Sync triggered (if online)

Boot orchestration is handled by `BootManager`.

## Error & Resilience Strategy

- Network failures do not block UI
- Retries use exponential backoff
- Circuit breaker pauses repeated failures
- Unresolved sync operations are quarantined
- Conflicts are surfaced intentionally.

## Build & Distribution

Production builds via EAS:

```bash
eas build -platform android --profile production
eas build -platform ios --profile production
```

Ensure `API_BASE_URL` points to production backend before building.

## Extended Documentation

See `/docs` for:

- `architecture.md`
- `sync-engine.md`
- `database-schema.md`
- `conflict-resolution.md`
- `network-resilience.md`
- `boot-sequence.md`

## Design Philosophy

The client is engineered to prioritize:

- Workflow continuity over connectivity
- Predictable sync behaviour over silent overwrites
- Local durability over remote dependency

The app is not just a frontend — it is a distributed system node.
