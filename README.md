# HealthTracker

A React Native mobile app for tracking daily health progress. This repository contains the mobile app only; the backend API is a separate project.

## 1. About HealthTracker

HealthTracker helps someone track their physical progress over time by logging a short daily check-in and seeing how it compares to where they started and where they want to get to.

**What it does.** A user records weight plus optional steps, sleep, water, height, mood and a note. The app turns those entries into progress against a baseline and goals — a dashboard with rings and a weight trend, a history grouped by day with day-to-day deltas, and BMI where height is known.

**Who it is for.** Anyone tracking a weight or activity goal over weeks and months: someone losing or gaining weight deliberately, or keeping an eye on daily habits. It assumes one person per account.

**Main user journey.**

```text
Sign up → OTP verification → onboarding (name, optional Health Connect,
baseline weight & height, optional goals) → dashboard → daily check-ins
→ history & progress
```

Onboarding runs once. After that the app opens straight to the dashboard, and the daily loop is: open the app, tap add, confirm or type today's numbers, save. Saving never waits for a network — entries are stored on the device first and sent to the backend when a connection is available.

## 2. Tech Stack

| Technology | Purpose |
| --- | --- |
| React Native 0.86 (CLI) | The app itself. Bare CLI, not Expo; new architecture and Hermes enabled |
| TypeScript 5.9 | Types across the whole codebase, with a `@/*` → `src/*` path alias |
| Redux Toolkit 2.12 | Application state — 8 slices covering auth, check-ins, profile, sync, settings and more |
| RTK Query | HTTP data fetching and caching, defined as one API with injected endpoints |
| React Navigation 7 | Native stacks plus a bottom tab bar |
| MMKV | Fast synchronous local storage. Holds the persisted app state, so the last session is available before the first frame renders |
| Keychain | The OS keystore, used to store the refresh token outside app state |
| NetInfo | Detects connectivity so the app knows when to attempt a sync |
| React Hook Form + Zod | Form handling and validation, sharing the same schemas the domain layer uses |
| Health Connect | Reads weight, height, steps, sleep and hydration from Android's health platform (read-only) |
| Notifee | Schedules the local daily check-in reminder |
| react-native-svg | Draws the progress rings and weight trend chart |
| Jest + React Native Testing Library | Unit and integration tests |
| Lucide icons, Toast Message, Size Matters | Icons, in-app toasts, and scaling helpers |

Requires Node `>= 22.11.0`. Yarn is the package manager.

## 3. Health Connect

**What the user sees.** On Android, the app can connect to Health Connect and use data other apps and devices already record there. Today's steps, sleep and water appear on the dashboard, and weight from a smart scale can prefill a check-in or prompt the user that a newer reading exists. Connecting is optional; the app is fully usable without it.

**Important boundaries, stated plainly:**

- **Android only.** Health Connect is an Android platform feature.
- **Read-only.** The app requests five read permissions — weight, height, steps, sleep and hydration — and never writes anything back.
- **Raw device data is not uploaded to the backend.** Health Connect readings stay on the device. What reaches the server is the check-in the user saved.
- **Health Connect can prefill or nudge, never overwrite.** A prefilled number is a suggestion. The user's own most recent check-in wins over a stale device reading, and editing a field marks it as manually entered.
- **User-entered values remain authoritative.** A saved check-in is what the user reported, even if a field started as a device reading.
- **iOS has no HealthKit integration.** On iOS the Health Connect UI is hidden entirely and all values are entered manually.
- **No historical backfill.** Connecting on a new device reads that device's current data. Past Health Connect history is not imported or transferred.
- **Permissions are device-specific.** Granting access on one phone does not grant it on another; each device asks separately.

The key distinction:

| | Where it lives | Does it sync? |
| --- | --- | --- |
| **Raw Health Connect data** | Device-local, owned by the Android platform | No — never sent to the backend |
| **A saved check-in** | Application data | Yes — syncs to the backend and appears on other devices |

The one exception worth naming precisely: a saved check-in includes a small label per field recording whether that number came from Health Connect or was typed manually. That is a provenance label, not health data — no readings, samples, timestamps or device details are sent.

Availability is treated as a ladder rather than an on/off switch ([src/domain/healthConnect/provider.ts](src/domain/healthConnect/provider.ts)): available, update required, provider missing, provider disabled, or unsupported. Each recoverable state offers the matching action — install the provider, update it, or open its settings — instead of a generic error. Connection state is likewise three-valued, because a user can grant some data types and refuse others.

## 4. Core Functionality

**Authentication.** Sign up with email and password, then verify with a one-time code. Sign in and sign out from Settings. Passwords and codes are validated on-device before any request is sent.

**OTP verification.** Sign-up parks the credentials; the account is actually created when the code is verified. The code auto-submits once the last digit is entered.

**Onboarding.** A four-step guided setup: name, an optional Health Connect connection, a required baseline (weight and height), and optional goals. If it is interrupted, it resumes at the step the user left off.

**Baseline and goals.** Baseline weight and height anchor progress and BMI. Optional goals — daily steps, water, sleep, and a target weight — drive the dashboard rings and attainment. All are editable later from Settings.

**Dashboard.** Progress toward the target weight, attainment against goals, BMI, a weight trend chart, rings for today's steps, sleep and water, and recent check-ins. Banners surface being offline, a failed refresh, or a newer weight reading from Health Connect.

**Check-ins.** Create, edit and delete. Weight is required; steps, sleep, water, height, mood (five faces) and notes are optional. Fields prefilled from Health Connect are marked as such until edited. Multiple check-ins on the same day are kept as separate entries, ordered by time.

**History.** All check-ins grouped by day with month separators, each showing the change since the previous entry, plus goal chips that jump straight to editing that goal.

**Profile and settings.** Name and email, baseline and goals, Health Connect status per data type, the daily reminder, sync status, and sign-out.

**Reminders.** An optional daily check-in reminder at 8:00 PM, scheduled locally on the device. It works without a network and does not depend on a push service.

**Deep links.** `healthtracker://checkin/<id>` opens a specific check-in. A check-in can be shared as a link from its detail screen. A link tapped while signed out is held briefly and opened after sign-in rather than being lost, and a link to something that no longer exists lands on a clear "not found" screen instead of an error.

**Sync status, retry and discard.** Settings shows how many changes are waiting to sync. Anything that failed permanently is listed individually with the reason and two choices: retry it, or discard it and revert that change locally. Nothing is dropped silently, and signing out warns first if work is still unsynced.

## 5. Offline-first

**What the user experiences.** The app opens and works with no connection. Previously loaded check-ins and profile data are there, new check-ins can be added and edited, and everything looks immediately saved — because it is, locally. When the connection returns, queued changes are sent in the background.

```text
User saves a check-in
        ↓
Written to local state + queued        ← visible immediately, no waiting
        ↓
Persisted to device storage (MMKV)     ← survives closing the app
        ↓
   [ offline ]  → shown as pending, stays queued
        ↓
Connection returns
        ↓
Queue is sent to the backend           ← retried with backoff on failure
        ↓
Server copy reconciled with local      ← no duplicates, local edits preserved
```

**Works without a network:** viewing previously loaded dashboard, history and check-in detail; creating, editing and deleting check-ins; editing baseline and goals; reading Health Connect data; the daily reminder; and retrying or discarding failed items.

**Requires a network:** sign up, OTP verification, sign in, the profile fetch that follows sign-in, sending queued changes, fetching check-ins from the server, and refreshing the access token. A first sign-in therefore needs connectivity; after that, launches work offline.

**How it works.** Writes go through a small commands layer ([src/store/checkins/checkinsCommands.ts](src/store/checkins/checkinsCommands.ts)) rather than direct API calls: the app generates a local id, updates state immediately, and adds an operation to an outbox queue held in the sync slice. Each queued operation carries the complete check-in, an attempt count, a next-attempt time, and the value to revert to if discarded. Operations for the same entry are merged, so editing one check-in repeatedly while offline leaves one queued operation rather than many.

The sync engine ([src/services/sync/syncEngine.ts](src/services/sync/syncEngine.ts)) pushes the profile, drains the queue, then fetches check-ins — push before pull, so the server has the device's changes before the device reads back. Creates carry a client id so a repeated attempt updates the same record instead of creating a second one. Retryable failures back off exponentially with jitter up to a bounded number of attempts; permanent failures stop and surface in Settings.

Reconciliation re-keys server rows onto local ids and overlays anything still queued, so a check-in created offline never appears twice and server data never overwrites an unsent local edit. A failed fetch leaves local data untouched. Sync is triggered by sign-in, connectivity changes, a newly queued change, app foreground, and a timer for the next scheduled retry ([src/hooks/useSync.ts](src/hooks/useSync.ts)).

State is persisted to MMKV by a small hand-written layer ([src/services/storage/persistence.ts](src/services/storage/persistence.ts)) rather than a library, because MMKV reads synchronously — the store is created already holding the last session, so the app opens on the right screen with no loading gate.

## 6. Authentication & Security

**In plain terms.** Signing in gives the app two tokens. The short-lived one is kept only in memory, so it is never written to disk. The long-lived one is stored in the device's own secure keystore. If the short-lived token expires mid-use, the app quietly gets a new one and retries the request — the user sees nothing.

- **Access token stays in memory.** It is held in app state and deliberately stripped before every write to local storage, so it never reaches disk.
- **Refresh token is stored in the OS keystore** via Keychain ([src/security/tokenStore.ts](src/security/tokenStore.ts)). If the keystore is unavailable, that reads as "no token" and the user simply signs in again — it never crashes.
- **401 → refresh → replay once** ([src/services/api/baseQueryWithReauth.ts](src/services/api/baseQueryWithReauth.ts)). Only genuine token errors trigger a refresh; a wrong password is an answer, not an expired session. Because the refresh token rotates on every use, refreshes run behind a single-flight lock — two concurrent refreshes would invalidate each other and sign out a healthy session. The original request is replayed exactly once.
- **No token is restored at launch.** The access token is intentionally not persisted, so the first request after opening the app refreshes on demand. One code path instead of a special startup sequence.
- **Explicit logout clears account-scoped local data.** Signing out resets every account slice, clears the keystore and drops persisted state.
- **Session expiry preserves unsynced work.** An expired session keeps local check-ins and the user's identity, so nothing waiting to sync is lost and the app can say whose data it is. The user is told what happened and signs back in.
- **Session fencing prevents stale responses crossing accounts.** A counter increments on every session change, and the sync engine checks it before writing a response. A reply that arrives after a sign-out cannot land in the next user's account.
- **Account isolation.** Signing in as a different user on the same device clears the previous account's local data before the new session starts.

No secrets are stored in this repository. Environment values are configuration, not credentials.

## 7. Device-to-Device Behavior

This describes how the app **currently behaves in the demo**, so there are no surprises during a walkthrough. These are known characteristics, not defects.

**Android → Android** (signing in on a second Android device):

- Check-in history transfers — it is server-backed.
- Profile, baseline and goals transfer.
- Raw Health Connect data does not transfer through the backend.
- The new device reads Health Connect from its own device, and asks for its own permissions.
- There is no historical Health Connect backfill; only data present on that device is read.
- The backend keeps **one active refresh token per account**, so signing in on a second device ends the first device's session — the first device is signed out the next time it needs to refresh, and is told the account was used on another device.
- Same-day check-ins created on different devices remain **separate records**. Entries are identified individually and ordered by time, so there is no automatic same-day merge.

**Android → iOS:**

- Existing check-in history transfers.
- Profile, baseline and goals transfer.
- Health Connect is unavailable — it is an Android platform feature.
- HealthKit is not currently implemented.
- Health values are entered manually on iOS.

## 8. Current Demo Limitations

| Limitation | Detail |
| --- | --- |
| Single active session per account | The backend stores one refresh token per user, so a new sign-in ends the previous device's session |
| Health Connect is Android-only | No health platform integration on iOS |
| No HealthKit | iOS has no automatic health data source; values are entered manually |
| No Health Connect historical backfill | A newly connected device reads current data only |
| No cross-device raw health data sync | Health Connect readings stay on the device that read them |
| Possible same-day duplicates across devices | Two devices can each create a check-in for the same day; there is no server-side same-day merge |
| Demo backend persistence | The backend runs SQLite from a file on a free hosting tier with no persistent disk, so data resets when the service redeploys, restarts or spins down after inactivity |
| Fixed verification code | The demo backend issues a fixed OTP rather than emailing one |
| Debug-signed release APK | The release build type still uses the debug signing config, which is fine for sideloading but not for store distribution |
| No offline sign-in | The first sign-in on a device needs connectivity |
| No local state migrations | Persisted local state is versioned; bumping the version drops the stored copy rather than migrating it |
| No E2E test layer | Testing is unit and integration only |

## 9. How These Limitations Could Be Handled in Production

These are product-dependent architectural choices, not gaps that the demo needs in order to work. Each has a well-understood production answer:

- **Multi-device sessions** — replace the single refresh token per user with a sessions/devices table, one row per device, so several devices stay signed in and can be revoked individually.
- **Health data synchronization** — if the business genuinely needs health data server-side, model it explicitly with user consent, a defined retention policy and per-source records, rather than implying it from check-ins.
- **HealthKit** — add an iOS provider behind the same interface the Health Connect service already sits behind, so the rest of the app is unchanged.
- **Cross-device duplicate handling** — decide the rule at the product level (one check-in per day, or many), then enforce it server-side with a uniqueness constraint or a merge strategy.
- **Production storage** — a managed persistent database instead of a file-based one, with backups and migrations.
- **Stronger synchronization** — incremental, cursor-based sync so a device fetches only what changed, plus explicit conflict resolution for concurrent edits.
- **Historical import** — a one-off consented backfill job if importing a user's past health history is a requirement.

## 10. Architecture

```text
Screens
   ↓
Hooks / Commands
   ↓
Redux Toolkit + RTK Query
   ↓
Services
   ↓
Backend API
```

Four layers, each with one job:

- **`domain/`** — pure business logic. No React, no Redux, no I/O: validation rules, sync merge and backoff, reconciliation, BMI and progress maths, Health Connect availability rules, error classification. Directly unit-testable, and where most of the real logic lives.
- **`services/`** — everything external: HTTP, Health Connect, MMKV, Keychain, connectivity, notifications.
- **`store/`** — application state. Slices with their selectors, plus two thin command modules for actions that need to coordinate more than one slice.
- **`screens/` and `components/`** — UI. Screens read selectors and dispatch commands; they do not call services directly.

Navigation reflects session state rather than being driven imperatively ([src/navigation/RootNavigator.tsx](src/navigation/RootNavigator.tsx)): one of three stacks is chosen from two pieces of state — signed out shows auth, signed in but not onboarded shows onboarding, otherwise the main app. No navigation call ever switches between them.

The app shell composes as gesture root → Redux provider → safe area → theme → navigation ([App.tsx](App.tsx)), with local state loaded before the first render.

## 11. API / Backend Integration

The app talks to a REST API over RTK Query. All endpoints are declared in one API definition with paths centralised in [src/services/api/apiConfig.ts](src/services/api/apiConfig.ts).

| Purpose | Method and path |
| --- | --- |
| Sign up | `POST /auth/signup` |
| Verify OTP | `POST /auth/verify-otp` |
| Sign in | `POST /auth/login` |
| Refresh tokens | `POST /auth/refresh` |
| Sign out | `POST /auth/logout` |
| Get profile | `GET /profile` |
| Update profile | `PUT /profile` |
| List check-ins | `GET /checkins` |
| Create check-in | `POST /checkins` |
| Update check-in | `PUT /checkins/:id` |
| Delete check-in | `DELETE /checkins/:id` |

Every authenticated request carries a bearer token attached automatically; sign-up, OTP, sign-in and refresh never do. Requests time out after 15 seconds so a dead server fails visibly rather than hanging.

`POST /auth/refresh` is not exposed as a normal endpoint — it is called by the **reauth wrapper**, which sits in front of every request. On a genuine token error it refreshes once, behind a single-flight lock, and replays the original request; if the refresh fails, the session ends cleanly.

Reads use RTK Query's cache and tags. Check-in writes are deliberately different: they are invoked by the sync engine rather than from screens, and carry no cache invalidation, because the engine owns ordering, retries and reconciliation and would otherwise fight a tag-driven refetch. Server errors are normalised once into a small set of kinds ([src/domain/api/errors.ts](src/domain/api/errors.ts)), so only transport-shaped failures are retried and user-facing messages never leak status codes.

## 12. Testing

```bash
yarn test              # Jest
yarn test --coverage    # no thresholds configured, so request it explicitly
yarn lint               # ESLint
npx tsc --noEmit        # type check (there is no typecheck script)
```

30 test suites run under Jest with React Native Testing Library, mirroring the source layout:

| Group | Suites | What is covered |
| --- | --- | --- |
| `domain/` | 8 | Auth, check-in and profile validation; sync merge rules and backoff; reconciliation; Health Connect availability across Android versions; goal attainment; reminder scheduling; API error classification |
| `store/` | 9 | Reducer and selector behaviour, including logout clearing every account-scoped slice and session expiry preserving unsynced work |
| `services/` | 4 | The sync engine, local persistence, the reauth wrapper, and request/response mapping |
| `components/` | 6 | Inputs, OTP entry, mood picker, check-in and attainment rows, toasts |
| `navigation/`, `utils/`, root | 3 | Deep-link parsing and gating, local-day grouping, and an app smoke render |

The emphasis is on business logic rather than screen snapshots. The sync engine suite is the clearest example: it mocks only the network transport and the keystore, so the real endpoints, the real reauth wrapper, real error handling and every real reducer run against a live store. It covers deleting something already gone, falling back when a server id was never learned, session fencing, and a failed fetch leaving local data intact.

There is currently **no E2E framework** (no Detox or Maestro).

## 13. Environment & Setup

**Requirements:** Node `>= 22.11.0`, Yarn, a JDK and the Android SDK, and an Android 8.0+ (API 26) emulator or device. For iOS, Xcode plus CocoaPods (`bundle install && bundle exec pod install` in `ios/`).

```bash
yarn install
cp .env.example .env    # then edit it, see below
yarn start              # Metro
yarn android            # build, install and run (separate terminal)
```

**Configuration.** Three values in `.env` at the project root, resolved in [src/config/env.ts](src/config/env.ts):

| Key | Meaning |
| --- | --- |
| `API_MODE` | Which backend to use — exactly `server` or `local` |
| `SERVER_URL` | The deployed backend. Must be `https://` |
| `LOCAL_URL` | A backend running on your own machine |

Pointing at the deployed backend:

```env
API_MODE=server
SERVER_URL=https://healthtracker-backend-k6v3.onrender.com
LOCAL_URL=http://10.0.2.2:3000
```

Pointing at a backend running locally — set `API_MODE=local` and match `LOCAL_URL` to how the device reaches your machine:

| Target | `LOCAL_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:3000` — the emulator's alias for the host machine |
| iOS simulator | `http://localhost:3000` |
| Physical device | `http://<your-LAN-IP>:3000` |

Configuration is validated at startup and **fails fast** with a message telling you what to fix: an unrecognised `API_MODE`, an empty URL, an unfilled placeholder, or a URL with no scheme all stop the app rather than silently defaulting. An app quietly pointing at localhost is indistinguishable from a server that is down, so it refuses to guess. In development the resolved URL is logged once, and an `http://` server URL warns, because release builds block cleartext traffic.

**After editing `.env`, restart Metro with `yarn start --reset-cache`.** These values are inlined into the JavaScript bundle at build time, so a plain reload keeps serving the old ones. `.env` is not committed; `.env.example` is the template.

The deployed demo backend runs on a free hosting tier, so the first request after a period of inactivity may be slow while the service wakes up, and its data resets when it restarts.

## 14. Building the APK

```bash
# Install dependencies
yarn install

# Start Metro (for development builds)
yarn start

# Debug build — installs and runs on a connected device or emulator
yarn android

# Debug APK
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# Release APK
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk

# Release AAB (for store upload)
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

Application id `com.healthtracker`, version 1.0 (1). Hermes and the new architecture are enabled; minimum Android 8.0 (API 26), which is what Health Connect requires.

Two things to know before sharing a build:

- **`.env` values are inlined at build time.** The APK carries whatever `API_MODE` and URL were set when it was bundled. A build that has to work away from your machine needs `API_MODE=server` with an `https://` URL — it cannot be repointed afterwards.
- **The release build type currently uses the debug signing config**, so `assembleRelease` produces a debug-signed APK. That installs fine for a demo or sideload, but a real release keystore is required before store distribution.

## 15. Future Production Improvements

- **Multi-device sessions** — a sessions/devices table so several devices stay signed in, with per-device revocation.
- **HealthKit on iOS** — an iOS health provider behind the existing service interface.
- **Cross-device health data sync** — only if the product requires it, with an explicit consented data model.
- **Managed production database** — persistent, backed-up storage in place of a file-based demo database.
- **Stronger conflict resolution** — a defined same-day rule and server-side deduplication, plus incremental cursor-based sync.
- **E2E testing** — device-level flows for sign-up, onboarding, offline check-in and sync.
- **Local state migrations** — migrate persisted state across schema versions instead of discarding it.
- **Production hardening** — real email or SMS delivery for verification codes, rate limiting, structured logging, crash reporting and monitoring.
