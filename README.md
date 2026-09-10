# HealthTracker

HealthTracker is a React Native health progress tracker. Users log daily check-ins — weight, steps, sleep, water, height, mood and notes — against personal baselines and goals, then review history, deltas and trends. Check-ins are written to local storage and queued, so logging and browsing work without a network; a sync engine pushes queued work to the backend and reconciles the server's copy when connectivity returns. On Android the app reads weight, height, steps, sleep and hydration from Health Connect (read-only) to prefill and cross-check entries.

The backend is a separate sibling repository (`../Backend`). This README covers the mobile app only.

## Architecture

```text
Screens (src/screens)                    views, react-hook-form + zod
        ↓
Hooks / Commands                         src/hooks/*, src/store/*/*Commands.ts (thunks)
        ↓
Redux Toolkit + RTK Query                src/store (8 slices) + baseApi
        ↓
API Layer                                src/services/api (baseQuery → reauth wrapper)
        ↓
Backend API                              local dev server or deployed Render instance
```

Three subsystems hang off the store rather than sitting in the request path:

```text
Health Connect (Android)  →  src/services/healthConnect  →  healthConnect slice
MMKV + Keychain           ↔  src/services/storage, src/security/tokenStore
Outbox + sync engine      →  src/services/sync/syncEngine  ↔  sync slice
```

## What works offline

| Works without a network | Requires a network |
| --- | --- |
| Viewing the dashboard, history and check-in detail from persisted local state | Sign up, OTP verification and sign in |
| Creating, editing and deleting check-ins (written locally, queued) | The profile fetch that follows sign-in |
| Editing profile baselines and goals (queued behind a dirty flag) | Pulling check-ins from the server |
| Reading Health Connect data (device-local, Android) | Pushing anything queued |
| Daily reminder notifications (scheduled locally via Notifee) | Access-token refresh |
| Retrying or discarding failed queued work from Settings | |

A first sign-in needs connectivity; after that the last session is restored from local storage on launch, so a cold start with no network shows local data but cannot reach the server until it returns. Logout is a local teardown and the server call is best-effort, but Settings warns first when unsynced work exists.

## Tech stack

Bare React Native CLI — not Expo. New architecture and Hermes are enabled.

| Package | Version | Role |
| --- | --- | --- |
| `react-native` / `react` | 0.86.3 / 19.2.3 | Runtime |
| `typescript` | ~5.9 | Types; `@/*` → `./src/*` path alias |
| `@reduxjs/toolkit` | 2.12 | State, plus RTK Query via `@reduxjs/toolkit/query/react` |
| `react-redux` | 9.3 | Bindings (typed `useAppDispatch` / `useAppSelector`) |
| `@react-navigation/*` | 7 | native-stack + bottom-tabs |
| `react-native-health-connect` | 4.1 | Android Health Connect reads |
| `react-native-mmkv` | 3.3 | Synchronous local storage (state persistence) |
| `react-native-keychain` | 10 | OS keystore for the refresh token |
| `@react-native-community/netinfo` | 12 | Connectivity detection |
| `react-hook-form` + `zod` | 7.87 + 4.5 | Forms and validation (`@hookform/resolvers`) |
| `@notifee/react-native` | 9.1 | Local reminder notifications |
| `react-native-svg` | 15 | Progress rings and trend charts |
| `lucide-react-native` | 1.41 | Icons |
| `react-native-toast-message` | 2.5 | Toasts |
| `react-native-gesture-handler` / `screens` / `safe-area-context` | 3 / 4.27 / 5.9 | Navigation primitives |
| `react-native-size-matters` | 0.4 | Scaling helpers |

Dev tooling: Jest 29 + `@testing-library/react-native` 14, ESLint 8 (`@react-native` config), Prettier 2.8.8, `react-native-dotenv`, `babel-plugin-module-resolver`.

Node `>= 22.11.0` (`engines`). Yarn is the package manager (`yarn.lock`; no `package-lock.json`).

## Project structure

```text
src/
  assets/fonts/     Plus Jakarta Sans (linked via react-native.config.js)
  components/       common/ data/ layout/ forms/ overlays/ toast/ + feature folders
  config/env.ts     API base URL resolution and startup validation
  context/          ThemeContext (light/dark tokens)
  domain/           pure logic — no React, no Redux
  hooks/            sync, connectivity, health connect, deep links, sign-in, toasts
  navigation/       RootNavigator, three stacks, tab navigator, deep-link parsing
  screens/          auth/ onboarding/ dashboard/ checkins/ settings/
  security/         tokenStore (Keychain wrapper)
  services/         api/ healthConnect/ network/ notifications/ storage/ sync/
  store/            8 slices, each with selectors; two *Commands.ts thunk modules
  theme/            colors, typography, spacing, radius
  types/            navigation param lists, @env declarations
  utils/            formatters, local id generation
```

The layering is deliberate and is the fastest way to read the codebase:

- **`domain/`** holds pure functions with no React and no Redux — validation schemas, sync merge rules and backoff, reconciliation, BMI/progress/trend maths, Health Connect availability rules, API error taxonomy. This is where most of the interesting logic lives, and it is directly unit-testable.
- **`services/`** owns all I/O — HTTP, Health Connect, MMKV, Keychain, NetInfo, Notifee.
- **`store/`** owns state. Screens read selectors and dispatch commands; they do not call services directly.

App shell composition ([App.tsx:19-27](App.tsx#L19-L27)):

```text
GestureHandlerRootView → Provider (redux) → SafeAreaProvider → ThemeProvider → RootNavigator
```

MMKV hydration happens in [src/store/store.ts](src/store/store.ts) before the first render, and [index.js](index.js) registers the Notifee background handler at module scope, before `AppRegistry.registerComponent`.

## Navigation

The root picks one of three stacks from two selectors ([src/navigation/RootNavigator.tsx:39-43](src/navigation/RootNavigator.tsx#L39-L43)):

```ts
const activeStack = !hasSession ? 'auth' : !profileComplete ? 'onboarding' : 'main';
```

No `navigate()` call ever changes stacks — stack choice is derived state, so an expired session or a completed onboarding step swaps the tree on the next render.

| Navigator | Routes |
| --- | --- |
| `AuthStack` | Login, Signup, VerifyOtp |
| `OnboardingStack` | Name, HealthConnect, Baseline, Goals — initial route resumes an interrupted setup |
| `MainStack` | Tabs, CheckInForm (modal), CheckInDetail, CheckInNotFound, EditProfileField (modal) |
| `BottomTabNavigator` | Home, History, Settings (custom tab bar) |

- **Auth** — email/password sign-in and sign-up, then OTP verification.
- **Onboarding** — name, optional Health Connect connection, required baseline (weight + height), optional goals. Completing it is what flips the root to `main`.
- **Dashboard (Home)** — progress and attainment, BMI, weight trend chart, steps/sleep/water rings, recent check-ins, plus connectivity and sync banners.
- **History** — check-ins grouped by day with month separators and deltas against the previous entry.
- **Check-in form / detail** — create, edit, view and delete a single check-in.
- **Settings** — profile, baselines and goals, Health Connect status per data type, the daily reminder, pending and failed sync work with Retry/Discard, and logout.

The four app-wide hooks (`useHealthConnectResume`, `useNotificationSchedule`, `useConnectivity`, `useSync`) are mounted in `MainStack` because that is the authenticated boundary. The single `<Toast>` host sits outside the stacks, inside `NavigationContainer`, so a toast raised at sign-in survives the auth→main swap.

**Deep linking** uses the scheme `healthtracker://checkin/:id`, registered in `AndroidManifest.xml` and `ios/HealthTracker/Info.plist`. It is hand-rolled in [src/navigation/deepLinks.ts](src/navigation/deepLinks.ts) and [src/hooks/useDeepLinks.ts](src/hooks/useDeepLinks.ts) rather than using `NavigationContainer`'s `linking` prop, so a URL can be parsed before the auth gate and stashed with a TTL across sign-in instead of being dropped.

## Authentication and session handling

**Token split.** The access token lives in Redux memory only and is stripped before every persist write ([src/services/storage/persistence.ts](src/services/storage/persistence.ts)). The refresh token lives in the OS keystore via `react-native-keychain` ([src/security/tokenStore.ts](src/security/tokenStore.ts)). There is no AsyncStorage in the project. Every keystore call is failure-tolerant: an unavailable keystore reads as "no token" and lands the user on Login rather than crashing.

**Sign-up is two steps.** `POST /auth/signup` parks credentials and starts no session; the account is created and the session begins at `POST /auth/verify-otp`. Sign-in and OTP verification both funnel into `establishSession` ([src/hooks/useSignIn.ts](src/hooks/useSignIn.ts)), whose order is load-bearing: save the refresh token → clear the previous account's local data if the user id differs → put the access token in state → fetch the profile (a 404 means onboarding) → start the session, which is the dispatch that swaps navigators.

**Cold start.** MMKV is read synchronously before the store is created, so `hasSession` is already correct on the first frame and Login never flashes. The access token is deliberately not restored and there is no bootstrap refresh call: the first authenticated request goes out without a bearer token, the server answers 401, and the reauth wrapper refreshes and replays it. One auth path instead of a separate boot sequence.

**401 refresh** ([src/services/api/baseQueryWithReauth.ts](src/services/api/baseQueryWithReauth.ts)). A refresh is attempted only on 401, only for authenticated paths, and only for refreshable error codes — a wrong password is an answer, not an expired session, so it never triggers one. The refresh runs behind a module-scope single-flight latch, which is a correctness requirement rather than an optimisation because the refresh token rotates on every use. The original request is then replayed exactly once; a failed refresh ends the session.

**Expiry versus logout** ([src/store/auth/authSlice.ts](src/store/auth/authSlice.ts)). An expired session clears credentials but keeps the user id, email and all local data, so unsynced work survives and the app can say whose it is. `loggedOut` is the single teardown action: every account-scoped slice resets through `extraReducers` and the persisted state is dropped. A `sessionEpoch` counter is bumped on every transition and used by the sync engine as a fence, so a response from a finished session cannot be written into a live one.

Full state-by-state walkthrough: [docs/AUTH_FLOW.md](docs/AUTH_FLOW.md).

## Health Connect (Android)

Read-only, Android-only, via `react-native-health-connect`. Nothing is ever written back. `minSdkVersion` is 26, since Health Connect requires Android 8.0+.

| App field | Health Connect record type |
| --- | --- |
| weight | `Weight` |
| height | `Height` |
| steps | `Steps` |
| sleep | `SleepSession` |
| water | `Hydration` |

Five read permissions, no write permissions and no heart rate.

**Availability is a ladder, not a boolean** ([src/domain/healthConnect/provider.ts](src/domain/healthConnect/provider.ts)): `AVAILABLE`, `UPDATE_REQUIRED`, `PROVIDER_MISSING`, `PROVIDER_DISABLED` or `NOT_SUPPORTED`. Each recoverable state maps to a specific call to action — install the provider, update it, or open its settings — instead of a generic failure message. Connection status is likewise three-valued: not connected, partially connected, connected, because a user can grant some data types and refuse others.

**iOS.** The native module resolves its TurboModule at import time and throws off Android, so it is lazily required behind a platform guard and every function returns a safe default ([src/services/healthConnect/healthConnectService.ts](src/services/healthConnect/healthConnectService.ts)). Availability reports `NOT_SUPPORTED`, and the Health Connect UI is hidden rather than shown as dead controls. HealthKit is not used, so iOS has no device data source.

**Where readings surface.** Dashboard steps/sleep/water rings, a weight nudge banner, check-in form prefill, and onboarding baseline prefill. Device readings only prefill or nudge — they never overwrite a value the user entered, the user's own most recent check-in wins over a stale device reading, and the form tracks per field whether a number came from Health Connect or was typed.

Permissions are requested only on an explicit user tap; a silent re-read runs on mount and on every foreground. Revoking access is handed to system settings, since the platform only applies an in-app revoke after a process restart.

Permission model, read windows, aggregation rules and per-state UI: [docs/HEALTH_CONNECT.md](docs/HEALTH_CONNECT.md), [docs/HEALTH_CONNECT_PERMISSIONS.md](docs/HEALTH_CONNECT_PERMISSIONS.md), [docs/HEALTH_CONNECT_EXPLAINED.md](docs/HEALTH_CONNECT_EXPLAINED.md).

## Offline-first data and sync

**Local storage.** A single MMKV instance sits behind a three-method interface, with an in-memory fallback if it fails to construct — the app runs, it just does not persist ([src/services/storage/mmkv.ts](src/services/storage/mmkv.ts)). Persistence is hand-written rather than redux-persist: MMKV reads synchronously, so the store is created already holding the last session. Writes are debounced and flushed when the app backgrounds. The `auth`, `checkins`, `onboarding`, `profile`, `settings` and `sync` slices persist; the RTK Query cache, connectivity and Health Connect state deliberately do not — the latter two are re-derived from the device, and a value restored from disk would be a guess.

**Writes are local-first.** Check-ins go through a commands layer of thunks ([src/store/checkins/checkinsCommands.ts](src/store/checkins/checkinsCommands.ts)) rather than RTK Query mutation hooks: the app mints a local id, updates state immediately, and enqueues an operation. The form saves and navigates back without awaiting anything.

**The outbox** is an ordered queue of pending operations (create, update, delete) held in the `sync` slice. Each carries the complete check-in rather than a diff, an attempt count, a next-attempt time, and the value to revert to if the user discards it. Operations targeting the same entity are merged, so editing the same check-in ten times offline leaves one queued operation rather than ten.

**The sync engine** ([src/services/sync/syncEngine.ts](src/services/sync/syncEngine.ts)) pushes the profile, drains the queue, then pulls check-ins — push before pull, so the server has the device's changes before the device reads it back. Creates carry a client id so the server upserts, which makes a repeated attempt safe. Retryable failures back off exponentially with jitter up to a bounded number of attempts; an operation that fails permanently stays visible in Settings with Retry and Discard rather than being dropped silently.

**Reconciliation.** Server rows are re-keyed onto local ids, so a check-in created offline never appears twice, and queued work is overlaid on top of the server snapshot — server data never overwrites something still waiting to sync. Local ids are never rewritten once a server id is learned, so open screens, deep links and queued operations stay valid. A failed pull leaves local data untouched.

**Sync triggers** ([src/hooks/useSync.ts](src/hooks/useSync.ts)): sign-in and connectivity changes, a newly queued operation, app foreground, and a timer for the next scheduled retry. All are safe to overlap, because the engine holds its own single-flight latches.

Lifecycle of a check-in created with no network:

1. Saved to local state and enqueued in one step; the UI updates immediately and the form closes.
2. Persisted to MMKV within 250 ms, so it survives process death.
3. Shown as pending in the dashboard and history; logout warns while it is unsynced.
4. Connectivity returns — transient failures are revived, then the queue drains.
5. On success the server id is recorded against the local id; the local id is not rewritten.
6. The next pull re-keys the server row onto the local id via its client id, so no duplicate appears.

Operation model, merge rules, backoff, failure matrix and the id-map lifecycle: [docs/CHECKIN_SYNC.md](docs/CHECKIN_SYNC.md), [docs/SERVER_ID_MAPPING.md](docs/SERVER_ID_MAPPING.md).

## API layer

One `createApi` ([src/services/api/baseApi.ts](src/services/api/baseApi.ts)) with `reducerPath: 'api'`, the reauth base query, tag types `Profile` and `CheckIns`, and no inline endpoints — feature files inject them. Paths are centralised in [src/services/api/apiConfig.ts](src/services/api/apiConfig.ts).

| Endpoint | Kind | Method and path | Tags |
| --- | --- | --- | --- |
| `signup` | mutation | `POST /auth/signup` | — |
| `verifyOtp` | mutation | `POST /auth/verify-otp` | — |
| `login` | mutation | `POST /auth/login` | — |
| `logout` | mutation | `POST /auth/logout` | — |
| `getProfile` | query | `GET /profile` | provides `Profile` |
| `updateProfile` | mutation | `PUT /profile` | invalidates `Profile` |
| `listCheckIns` | query | `GET /checkins` | provides `CheckIns` |
| `createCheckIn` | mutation | `POST /checkins` | — |
| `updateCheckIn` | mutation | `PUT /checkins/:id` | — |
| `deleteCheckIn` | mutation | `DELETE /checkins/:id` | — |

`POST /auth/refresh` is called directly by the reauth wrapper rather than being an endpoint.

Note the deliberate asymmetry: check-in mutations declare no `invalidatesTags` and are invoked imperatively by the sync engine, because the engine owns ordering, retries and reconciliation and would fight a tag-driven refetch. Only `Profile` uses tag invalidation.

`prepareHeaders` ([src/services/api/baseQuery.ts](src/services/api/baseQuery.ts)) sets `Accept` and an `X-App-Platform` header, and attaches `Authorization: Bearer …` from state for every endpoint outside the unauthenticated set. Requests time out after 15 seconds, so a dead server fails visibly instead of leaving a spinner running.

Errors are normalised once ([src/domain/api/errors.ts](src/domain/api/errors.ts)): server codes map to error kinds, only transport-shaped kinds are retryable, and user-facing messages never leak status codes.

## Backend configuration (local or Render)

Three keys in `.env`, loaded by `react-native-dotenv` as the `@env` module and resolved in [src/config/env.ts](src/config/env.ts):

| Key | Meaning |
| --- | --- |
| `API_MODE` | Exactly `server` or `local` — nothing else is accepted |
| `SERVER_URL` | The deployed Render backend. Must be `https://` |
| `LOCAL_URL` | A backend running on your own machine |

`API_MODE` selects the URL. There is no `__DEV__` switching and no automatic host rewriting — `10.0.2.2` is simply what you put in `LOCAL_URL`:

| Target | `LOCAL_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:3000` (the emulator's alias for the host machine) |
| iOS simulator | `http://localhost:3000` |
| Physical device | `http://<your-LAN-IP>:3000` |

Configuration **fails fast at startup**: a missing or misspelled `API_MODE`, an empty URL, the unfilled `https://<your-render-url>` placeholder, or a URL with no scheme throws with a message telling you what to fix. An APK silently pointing at localhost is indistinguishable from a server that is down, so it refuses to guess. Trailing slashes are stripped. In development the resolved base URL is logged once, and `API_MODE=server` with an `http://` URL warns, because release builds block cleartext traffic.

These values are **inlined by Babel at build time**, so editing `.env` requires `yarn start --reset-cache` — a plain reload keeps serving the old ones. `.env` is gitignored; `.env.example` is the committed template.

## Getting started

Prerequisites: Node `>= 22.11.0`, Yarn, a JDK and the Android SDK (compile/target 36, build tools 36.0.0, NDK 27.1.12297006), and an API 26+ emulator or device. For iOS, Xcode plus `bundle install && bundle exec pod install` in `ios/`.

```bash
yarn install

# Configure the backend
cp .env.example .env
# Then either:
#   API_MODE=local   and LOCAL_URL pointing at ../Backend on this machine
#   API_MODE=server  and SERVER_URL set to the deployed Render URL

yarn start           # Metro
yarn android         # build, install and run (separate terminal)
yarn ios             # iOS, if pods are installed
```

Health Connect features need the Health Connect provider present on the device; on Android 14+ it is part of the platform, and on older versions it is a Play Store app. After changing anything in `src/assets/fonts`, run `yarn react-native-asset` to re-link.

## Testing

```bash
yarn test              # Jest
yarn test --coverage   # no thresholds are configured, so ask for it explicitly
yarn lint              # ESLint
npx tsc --noEmit       # type check (there is no typecheck script)
```

30 suites live under `__tests__/`, mirroring the source layout:

| Group | Suites | Covers |
| --- | --- | --- |
| `domain/` | 8 | Pure logic — auth/check-in/profile validation, sync merge rules and backoff, reconciliation, Health Connect availability across API levels, attainment, notification scheduling, the API error taxonomy |
| `store/` | 9 | Reducer and selector behaviour, including logout teardown across every account-scoped slice and expiry preserving unsynced work |
| `services/` | 4 | Sync engine, persistence, the reauth wrapper, DTO mapping |
| `components/` | 6 | Inputs, OTP entry, mood picker, check-in and attainment rows, toasts |
| `navigation/`, `utils/`, root | 3 | Deep-link parsing and gating, local-day keys, an app smoke render |

The approach favours integration over isolation where it matters: the sync-engine suite mocks only the raw base query and the token store, so RTK Query endpoints, the reauth wrapper, error normalisation and every reducer run for real against a live store. `jest.setup.js` mocks NetInfo, toasts and Notifee — including its enums, which are consumed as values — while MMKV runs against its own in-memory store under Jest.

There is no E2E layer (no Detox, no Maestro).

## Building the APK

```bash
# Debug
yarn android
cd android && ./gradlew assembleDebug     # → android/app/build/outputs/apk/debug/app-debug.apk

# Release
cd android && ./gradlew assembleRelease   # → android/app/build/outputs/apk/release/app-release.apk
cd android && ./gradlew bundleRelease     # → android/app/build/outputs/bundle/release/app-release.aab
```

`applicationId com.healthtracker`, `versionCode 1`, `versionName 1.0`. Hermes and the new architecture are on, ProGuard is off, ABIs are `armeabi-v7a, arm64-v8a, x86, x86_64`, Gradle wrapper 9.3.1.

Two things to know before building something you intend to hand to someone:

- `.env` is baked into the bundle at build time, so a release APK carries whatever `API_MODE` and URL were set when it was bundled. A build that has to run away from your dev machine needs `API_MODE=server` with an `https://` URL.
- `buildTypes.release` currently uses the debug `signingConfig`, so `assembleRelease` produces a debug-signed APK. That is fine for sideloading; a release keystore has to be configured before store distribution.

## Design trade-offs

**Hand-written MMKV persistence instead of redux-persist.** MMKV reads synchronously, so the store is constructed already holding the last session and the navigator picks the right stack on the first frame — no rehydration gate, no Login flash. The cost is no migration framework: bumping the schema version drops the stored state rather than migrating it.

**Thunks for writes, RTK Query for reads.** A check-in must be saved and queued without awaiting a network, and retries, ordering and reconciliation belong to the sync engine. So writes go through a commands layer and the engine calls mutation endpoints imperatively. The consequence is that check-in mutations carry no tag invalidation, and the engine — not RTK Query — owns cache correctness.

**Access token in memory, refresh token in the keystore, no cold-start refresh.** This gives one auth path (401 → refresh → replay) instead of a special boot sequence, and keeps no long-lived bearer token on disk. The cost is that the first authenticated request after each launch is a guaranteed 401 round-trip.

**Local ids are never rewritten.** The server id is recorded in a side map keyed by the local id, so open screens, deep links and queued operations stay valid after a create syncs. The cost is a persisted id map that needs pruning.

**Client-id upsert for idempotency.** From the device, a dropped response and a dropped request look identical, so creates are made safe to repeat rather than attempting exactly-once delivery. This is also why a create followed by a delete only cancels out while the create has not yet been attempted.

**`sessionEpoch` fencing.** Simpler and more reliable than cancelling in-flight requests on logout, and it closes the window where user A's late response could be written into user B's account.

**Health Connect read-only, Android-only, degrading to hidden UI.** The module cannot be imported off Android, so it sits behind a platform guard where every call has a safe default, and iOS hides the feature rather than showing controls that cannot work. Device readings prefill and nudge but never overwrite user input, because the person's own logged number is the one they trust.

**Build-time env inlining with fail-fast validation.** No runtime config fetch and no silent default, at the cost of `yarn start --reset-cache` after every `.env` edit.

## Further reading

Design notes in `docs/`, written against the current code:

| Document | Covers |
| --- | --- |
| [AUTH_FLOW.md](docs/AUTH_FLOW.md) | Launch to dashboard, the three-navigator gating, session start, onboarding, interruption handling |
| [CHECKIN_SYNC.md](docs/CHECKIN_SYNC.md) | Check-in create/edit/delete end to end, the outbox, the sync engine, failure matrix |
| [SERVER_ID_MAPPING.md](docs/SERVER_ID_MAPPING.md) | The local-to-server id map: lifecycle, growth and cleanup |
| [HEALTH_CONNECT.md](docs/HEALTH_CONNECT.md) | Android configuration, permission flows, read windows, mapping, slice state |
| [HEALTH_CONNECT_PERMISSIONS.md](docs/HEALTH_CONNECT_PERMISSIONS.md) | The consent model, the five permissions, request and silent-read paths, revocation |
| [HEALTH_CONNECT_EXPLAINED.md](docs/HEALTH_CONNECT_EXPLAINED.md) | Plain-language walkthrough with flowcharts |
| [SLEEP_WATER_AND_NOTIFICATIONS.md](docs/SLEEP_WATER_AND_NOTIFICATIONS.md) | Sleep and water progress, local reminder notifications |
