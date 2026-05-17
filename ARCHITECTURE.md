# ShellTennis PH - Current Product Architecture

## Overview

ShellTennis PH is a Vue 3 and Vite single-page application for a tennis ladder workflow.

The active product experience is centered on a simple club ladder:

1. A player checks the dashboard.
2. The player views the rankings.
3. The player challenges an eligible higher-ranked opponent.
4. The opponent accepts or declines the challenge.
5. An accepted challenge becomes a scheduled match.
6. The match can be scored live from the Play screen.
7. The official result is submitted from Match Details.
8. The result is reviewed from Challenges.
9. Player records and ladder rankings update after review.

The current app is a prototype-style frontend with mock services. It has strong UI coverage for the ladder flow, but it does not yet have production backend persistence, real authentication, disputes, or canonical structured match results.

---

## Technology Stack

- Vue 3.5+
- Composition API
- `<script setup>`
- Pinia
- Vue Router 4
- Axios
- Chart.js
- vue-chartjs
- Vite
- Prettier
- localStorage for selected prototype state
- Cloudinary-hosted brand and tennis images

---

## Runtime Boot

The app starts in `src/main.js`.

Boot order:

1. `createApp(App)` creates the Vue app.
2. Pinia is installed.
3. Vue Router is installed.
4. `src/assets/main.css` is imported.
5. The app waits for `router.isReady()`.
6. The app mounts to `#app`.

`src/App.vue` renders only `DefaultLayout`.

`src/layouts/DefaultLayout.vue` owns the active shell:

- fixed left sidebar
- Renaissance Africa logo
- sidebar links for Dashboard, Rankings, Challenges, Profile, and Notifications
- unread notification badge
- route-aware title and subtitle
- current player name and initials in the header
- routed page content through `RouterView`
- global `ToastShelf`

---

## Routing Architecture

Router file: `src/router/index.js`

The app uses `createWebHashHistory`, so browser URLs use hash routing such as `/#/dashboard`.

Active route map:

- `/` redirects to `/dashboard`
- `/dashboard` renders `DashboardView.vue`
- `/rankings` renders `RankingsView.vue`
- `/challenges` renders `ChallengesView.vue`
- `/create-challenge` renders `CreateChallengeView.vue`
- `/play/:matchId` renders `PlayView.vue`
- `/matches/:matchId` renders `MatchDetailsView.vue`
- `/profile` renders `ProfileView.vue`
- `/notifications` renders `NotificationsView.vue`
- unknown routes redirect to `/dashboard`

There are currently no active routes for:

- login
- booking
- landing
- history
- matches list

Those views exist in the repo, but the active router does not expose them.

There are also no route guards today. Authentication state exists, but active ladder routes can be opened without logging in.

---

## Active User Flow

### 1. Dashboard

File: `src/views/DashboardView.vue`

On mount, the dashboard loads:

- players
- challenges
- matches
- bookings

It uses:

- `playerStore.currentPlayer`
- `challengeStore.summaryCounts`
- `matchStore.matches`
- `matchStore.scheduledMatches`
- `bookingStore.loadBookings()`

The dashboard is a command center. It does not complete full workflows inline.

It routes users to:

- Create Challenge
- Match Details

It also displays:

- current player rank
- wins, losses, matches, and win rate
- win streak
- pending challenge counts
- scheduled match counts
- pending review counts
- performance chart
- recent activity

### 2. Rankings

File: `src/views/RankingsView.vue`

On mount, the page loads players.

It reads:

- `playerStore.sortedLadder`
- `playerStore.currentPlayer`
- `playerStore.getPlayerZone(playerId)`

The page separates players into:

- challengeable players
- current player
- out-of-range players

Challenge action:

- routes to `CreateChallenge` with `?opponent=<playerId>`

Sharing behavior:

- WhatsApp share opens a `wa.me` URL
- Facebook share opens the Facebook sharer URL
- Instagram action copies the current URL
- save-as-image opens a modal and dynamically imports `html2canvas` from CDN
- if image generation fails, it opens a fallback HTML preview window

### 3. Create Challenge

File: `src/views/CreateChallengeView.vue`

On mount, the page loads players.

It uses:

- `playerStore.currentPlayer`
- `playerStore.availableOpponents`
- `route.query.opponent`
- `challengeStore.createChallenge(payload)`
- `notificationStore.addToast()`
- `notificationStore.addNotification()`

Form state includes:

- opponent
- match type: singles or doubles
- match format: best of 3, best of 5, or custom
- custom set count
- set win rule
- game scoring rule
- final set rule
- teammate IDs for doubles
- optional scorer
- optional note

Submit payload includes:

- `challengerId`
- `defenderId`
- `teams`
- `matchConfig`
- `scorerId`
- `note`

Current mock API note:

- `POST /challenges` stores challenger, defender, scorer, status, requested time, and note
- it does not yet persist every submitted field, including teams and full match configuration

### 4. Challenges

File: `src/views/ChallengesView.vue`

On mount, the page loads:

- challenges
- matches

It uses:

- `challengeStore.filteredChallenges`
- `challengeStore.summaryCounts`
- `challengeStore.filterStatus`
- `matchStore.matches`
- `playerStore.currentPlayer`
- `notificationStore`

Supported filters:

- `all`
- `awaiting`
- `scheduled`
- `pending_review`

Challenge actions:

- Accept calls `challengeStore.acceptChallenge(challengeId)`
- Decline calls `challengeStore.declineChallenge(challengeId)`
- Review calls `challengeStore.reviewChallenge(challengeId)`
- Details finds the related match by `challengeId` and routes to Match Details

Accept and review actions reload matches afterward.

The page also includes a details modal for awaiting challenges. The modal shows matchup, rules, scorer, schedule, and note.

### 5. Match Creation

There is no active standalone create-match route.

Matches are created by accepting a challenge.

In the mock API adapter:

- `POST /challenges/:id/accept` changes the challenge to `scheduled`
- `scheduledAt` is set to the provided value or a default future date
- a match is created with `status: 'scheduled'`

### 6. Play

File: `src/views/PlayView.vue`

Route: `/play/:matchId`

On mount, it loads:

- players
- matches

It creates local scoreboard state with:

- `createScoreboard(challengerName, defenderName)`

Point scoring uses:

- `recordPoint(scoreboardState, playerKey)`

Current behavior:

- live scoring is local state only
- live scoring is not persisted to the mock API
- point logs are not saved
- refreshing the page resets the live scoreboard
- the scoreboard defaults to best of 3 sets

### 7. Match Details

File: `src/views/MatchDetailsView.vue`

Route: `/matches/:matchId`

On mount, it loads:

- players
- matches

It finds the match with:

- `matchStore.matchById(matchId)`

It initializes the form with:

- winner defaulted to the challenger
- score defaulted to `6-4, 6-4`

Submit behavior:

- only enabled when `match.status === 'scheduled'`
- calls `matchStore.submitResult(matchId, { winnerId, score })`

Mock API result behavior:

- sets `match.score`
- sets `match.winnerId`
- changes the match status to `pending_review`
- changes the related challenge status to `pending_review`

Current data mismatch:

- this flow depends on a scheduled match with `challengerId` and `defenderId`
- `MatchService.getMatches()` currently returns completed demo matches directly
- because of that, result submission is architecturally wired but the active match read path needs cleanup before the full result flow is reliable

### 8. Result Review And Ranking Update

Review happens from the Challenges page.

The review action calls:

- `challengeStore.reviewChallenge(challengeId)`

Mock API behavior:

- challenge status becomes `completed`
- related match status becomes `completed`
- both players get `matchesPlayed + 1`
- winner gets a win
- loser gets a loss
- if the challenger beats a higher-ranked defender, their ranks swap
- all players are normalized back into sequential rank order

### 9. Profile

File: `src/views/ProfileView.vue`

On mount, it loads:

- players
- challenges

It displays:

- current player identity
- rank
- wins
- losses
- win rate
- matches played
- total challenges
- completed challenges
- ladder standing details

### 10. Notifications

File: `src/views/NotificationsView.vue`

Notifications are kept in the notification Pinia store.

The page supports:

- grouped feed by Today, Yesterday, and Earlier
- unread count
- mark one read
- mark all read
- dismiss one
- clear all
- empty state

Prototype behavior:

- if the notification feed is empty when the page loads, the page seeds example notifications
- notifications do not persist across reloads

---

## Domain Model

### Player

Current source:

- `src/services/ApiService.js`
- consumed through `PlayerService.js`

Shape:

- `id`
- `name`
- `imageUrl`
- `rank`
- `wins`
- `losses`
- `matchesPlayed`

Current active player:

- `player-02`

### Challenge

Current source:

- `src/services/ApiService.js`
- consumed through `ChallengeService.js`

Stored shape:

- `id`
- `challengerId`
- `defenderId`
- `scorerId`
- `status`
- `requestedAt`
- `scheduledAt`
- `note`

Enriched response shape also includes:

- `statusLabel`
- `challengerName`
- `defenderName`
- `scorerName`
- `challengerRank`
- `defenderRank`
- `challengerImage`
- `defenderImage`

Current statuses:

- `awaiting`
- `scheduled`
- `pending_review`
- `completed`

There is a `withdrawChallenge()` service and store function, but the store currently does not return it from `useChallengeStore()`, so it is not available to active UI.

### Match

Current sources:

- `src/services/ApiService.js` supports match endpoints
- `src/services/MatchService.js` currently returns demo mock matches directly for `getMatches()`
- `submitMatchResult()` calls the Axios mock API

Adapter-backed match shape:

- `id`
- `challengeId`
- `challengerId`
- `defenderId`
- `status`
- `scheduledAt`
- `score`
- `winnerId`
- `statusLabel`
- `challengerName`
- `defenderName`
- `challengerImage`
- `defenderImage`

Current `MatchService.getMatches()` demo shape:

- `id`
- `playerA`
- `playerB`
- `challengerName`
- `defenderName`
- `winnerId`
- `score`
- `status`
- `completedAt`

Current statuses:

- `scheduled`
- `pending_review`
- `completed`

Technical mismatch:

- the Axios mock adapter includes `GET /matches`
- the active `MatchService.getMatches()` does not call it today
- because of that, match list data and mock API match mutation can drift
- accepted challenge matches can be created in the adapter but lost when the store reloads from the direct demo match list

### Scoreboard

Source:

- `src/utils/tennisScoring.js`

Scoreboard shape:

- `players`
- `sets`
- `currentSetIndex`
- `currentGame`
- `completedSets`
- `matchWinner`
- `bestOfSets`

Current game shape:

- `points`
- `advantage`
- `inTieBreak`
- `tieBreakPoints`

Scoring rules implemented:

- normal tennis labels: Love, 15, 30, 40
- deuce and advantage
- set tiebreak starts at 6-6
- tiebreak requires at least 7 points and a 2-point lead
- set win requires at least 6 games and a 2-game lead unless won by tiebreak
- match winner is set when a player wins enough sets for the selected best-of value

### Notification

Source:

- `src/stores/notification.js`

Shape:

- `id`
- `title`
- `message`
- `type`
- `time`
- `read`

Types used:

- `info`
- `success`
- `warning`
- `danger`

Notifications and toasts are memory-only.

### Booking

Source:

- `src/services/BookingService.js`
- `src/stores/booking.js`

Booking shape:

- `id`
- `date`
- `startHour`
- `duration`
- `playerName`
- `description`
- `createdAt`

Booking is not part of the active route map, but the store and service still exist.

Rules:

- one court
- available slots from 06:00 to 20:00
- 1-hour and 2-hour durations
- overlap detection prevents double booking
- persisted under `sheltennis-bookings`

### Auth

Source:

- `src/stores/auth.js`
- `src/composables/useAuth.js`

Auth shape:

- `isLoggedIn`
- `user`
- `isAuthLoading`
- `authMessage`

Auth is persisted under:

- `sheltennis-auth`

Current limitation:

- auth is not enforced by router guards
- active player is still fixed by `playerStore.currentPlayerId`

---

## Store Layer

### `player` Store

File: `src/stores/player.js`

State:

- `players`
- `currentPlayerId`
- `isLoading`
- `error`

Computed:

- `sortedLadder`
- `currentPlayer`
- `availableOpponents`
- `getPlayerZone`

Actions:

- `loadPlayers()`

Important rule:

- `availableOpponents` returns players ranked above the current player and within 3 positions

### `challenge` Store

File: `src/stores/challenge.js`

State:

- `challenges`
- `filterStatus`
- `isLoading`
- `error`

Computed:

- `filteredChallenges`
- `summaryCounts`

Actions returned by the store:

- `loadChallenges()`
- `createChallenge(payload)`
- `acceptChallenge(challengeId, scheduledAt)`
- `declineChallenge(challengeId)`
- `reviewChallenge(challengeId)`
- `setFilter(status)`

Implementation note:

- `withdrawChallenge()` exists internally but is not returned by the store

### `match` Store

File: `src/stores/match.js`

State:

- `matches`
- `isLoading`
- `error`

Computed:

- `matchById`
- `scheduledMatches`
- `pendingReviewMatches`
- `openChallenges`

Actions:

- `loadMatches()`
- `submitResult(matchId, payload)`

Important mismatch:

- legacy `MatchesView.vue` expects APIs such as `liveMatches`, `upcomingMatches`, `joinExistingMatch()`, and `createNewMatch()`
- those APIs do not exist in the current match store
- because `MatchesView.vue` is not routed, this does not affect the active app

### `notification` Store

File: `src/stores/notification.js`

State:

- `notifications`
- `toasts`

Computed:

- `unreadCount`

Actions:

- `addNotification(payload)`
- `addToast(payload)`
- `markRead(id)`
- `dismissNotification(id)`
- `clearNotifications()`
- `dismissToast(id)`

### `booking` Store

File: `src/stores/booking.js`

State:

- `bookings`
- `bookingSlots`
- `isBookingLoading`
- `bookingMessage`

Computed:

- `upcomingCount`

Actions:

- `loadBookings()`
- `loadSlots(date)`
- `bookCourt(payload)`

Persistence:

- localStorage key `sheltennis-bookings`

### `auth` Store

File: `src/stores/auth.js`

State:

- `isLoggedIn`
- `user`
- `isAuthLoading`
- `authMessage`

Computed:

- `isAuthenticated`

Actions:

- `login(credentials)`
- `logout()`

Persistence:

- localStorage key `sheltennis-auth`

### `counter` Store

File: `src/stores/counter.js`

This is a demo store with:

- `count`
- `doubleCount`
- `increment()`

It is not part of the active ladder flow.

---

## Service Layer

### `src/services/ApiService.js`

Responsibilities:

- create the Axios client
- provide a custom mock adapter
- seed mock players, challenges, and matches lazily
- simulate network latency
- enrich challenge and match responses
- handle challenge and match mutations
- update rankings after review

Implemented mock endpoints:

- `GET /players`
- `GET /challenges`
- `GET /matches`
- `POST /challenges`
- `POST /challenges/:id/accept`
- `POST /matches/:id/result`
- `POST /challenges/:id/review`
- `POST /challenges/:id/decline`

Missing adapter endpoint:

- `POST /challenges/:id/withdraw` is declared in `ChallengeService.js`, but the mock adapter does not implement it

### `src/services/PlayerService.js`

Functions:

- `getPlayers()`
- `getPlayerById(playerId)`

Uses:

- Axios mock API

### `src/services/ChallengeService.js`

Functions:

- `getChallenges()`
- `createChallenge(payload)`
- `acceptChallenge(challengeId, scheduledAt)`
- `reviewChallenge(challengeId)`
- `declineChallenge(challengeId)`
- `withdrawChallenge(challengeId)`

Uses:

- Axios mock API

### `src/services/MatchService.js`

Functions:

- `getMatches()`
- `submitMatchResult(matchId, payload)`

Current behavior:

- `getMatches()` returns hardcoded demo completed matches directly
- `submitMatchResult()` calls `POST /matches/:id/result` on the Axios mock API

This is the biggest service-layer mismatch today.

### `src/services/BookingService.js`

Functions:

- `fetchSampleBookings()`
- `createBooking(payload, existingBookings)`
- `fetchDailySlots(date)`
- `getSlotLabel(startHour, duration)`

Uses:

- `fakeRequest()` from `src/services/api.js`

### `src/services/api.js`

Shared helper functions:

- `fakeRequest(payload, delay)`
- `createId(prefix)`
- `createTimestamp()`

---

## Component And View Layer

### Active Layout And Global Components

- `DefaultLayout.vue`
- `ToastShelf.vue`

### Active Routed Views

- `DashboardView.vue`
- `RankingsView.vue`
- `ChallengesView.vue`
- `CreateChallengeView.vue`
- `PlayView.vue`
- `MatchDetailsView.vue`
- `ProfileView.vue`
- `NotificationsView.vue`

### Active Reusable Components

- `BaseButton.vue`
- `BaseInput.vue`
- `ChallengeCard.vue`
- `PersonAvatar.vue`
- `TennisScoreboard.vue`
- `PerformanceChart.vue`

### Present But Secondary Or Legacy

- `LandingView.vue`
- `LoginView.vue`
- `BookView.vue`
- `MatchesView.vue`
- `HistoryView.vue`
- `NavBar.vue`
- `MatchCard.vue`
- `CourtBookingForm.vue`
- `CountdownTimer.vue`
- `PlayerCard.vue`
- `RankingRow.vue`

Important:

- the existence of a view file does not mean it is currently reachable
- active product behavior should be inferred from `src/router/index.js`, not from the full file list

---

## Styling Architecture

Global CSS:

- `src/assets/main.css`

Global styling provides:

- light color scheme
- app-wide color tokens
- surface and border tokens
- green primary accent
- yellow and orange support accents
- shared card helpers
- base element resets

Layout-level styling:

- `src/layouts/DefaultLayout.vue`

View-level styling:

- each active view contains its own scoped or local CSS
- many views import Poppins directly

Current visual direction:

- white dashboard workspace
- fixed sidebar
- clean cards
- green tennis/brand accents
- subtle borders and shadows
- some richer image-based hero sections on Dashboard, Rankings, and Challenges

---

## Data And Persistence Architecture

### Memory-Only State

These reset on reload:

- players
- challenges
- ladder rankings
- notifications
- toasts
- live scoreboard state

### localStorage State

These persist across reloads:

- auth state under `sheltennis-auth`
- booking state under `sheltennis-bookings`

### Mock API State

The Axios mock adapter keeps:

- players
- challenges
- matches

This state is in memory inside `ApiService.js` and is seeded lazily.

Current caution:

- match read data is not fully aligned with the adapter because `MatchService.getMatches()` returns hardcoded demo data

---

## End-To-End Data Flow

### Active Ladder Flow

1. A routed view mounts.
2. The view calls one or more Pinia actions.
3. The store calls a service wrapper.
4. The service calls the mock API or returns demo data.
5. The store updates refs.
6. Computed values update.
7. The view re-renders.

### Challenge Creation Flow

1. `CreateChallengeView` loads players.
2. The user selects an eligible opponent.
3. The view builds a challenge payload.
4. `challengeStore.createChallenge()` calls `ChallengeService.createChallenge()`.
5. The mock API creates an awaiting challenge.
6. The store pushes the challenge into local store state.
7. A toast and notification are created.
8. The router navigates to Challenges.

### Challenge Acceptance Flow

1. `ChallengesView` calls `challengeStore.acceptChallenge(challengeId)`.
2. `ChallengeService.acceptChallenge()` posts to the mock API.
3. The mock API marks the challenge scheduled.
4. The mock API creates a scheduled match.
5. The challenge store replaces the challenge record.
6. The match store reloads matches.
7. Toast and notification messages are created.

### Result Submission Flow

1. `MatchDetailsView` loads players and matches.
2. The user selects winner and score.
3. `matchStore.submitResult()` calls `MatchService.submitMatchResult()`.
4. The mock API marks the match pending review.
5. The related challenge becomes pending review.
6. The match store replaces the local match if found.
7. The player store reloads players.

Current caution:

- this flow is intended for scheduled challenge-derived matches
- the current demo match read path mostly returns completed matches, so this path should be retested after `MatchService.getMatches()` is aligned with `ApiService.js`

### Result Review Flow

1. `ChallengesView` calls `challengeStore.reviewChallenge(challengeId)`.
2. The mock API completes the challenge and match.
3. The mock API updates wins, losses, matches played, and ranks.
4. The challenge store replaces the challenge record.
5. The player store is updated with returned players.
6. The match store reloads matches.
7. Toast and notification messages are created.

### Live Scoring Flow

1. `PlayView` loads players and matches.
2. The view creates local scoreboard state.
3. `TennisScoreboard` emits `point` events.
4. `PlayView` calls `recordPoint()`.
5. Local scoreboard state updates.
6. No backend or store persistence happens for point data.

### Notification Flow

1. Views call `notificationStore.addToast()` for temporary messages.
2. Views call `notificationStore.addNotification()` for feed messages.
3. `DefaultLayout` shows unread badge.
4. `ToastShelf` shows active toasts.
5. `NotificationsView` lets users read, dismiss, or clear notifications.

---

## Known Technical Gaps

Current gaps in the architecture:

- no production backend
- no real authentication or route guards
- active player is hardcoded to `player-02`
- live scoreboard does not persist
- point history is not saved
- stored match result is still a plain score string
- structured `sets` are not the source of truth yet
- submitted challenge match configuration is not fully persisted by the mock API
- `MatchService.getMatches()` is not aligned with the Axios mock adapter
- route-level booking flow is not active
- route-level login flow is not active
- `MatchesView.vue` references old match-store APIs and should be treated as legacy
- withdraw challenge is declared but not exposed in active store/UI and is not implemented by the mock adapter
- 48-hour response and result confirmation timers are not enforced
- disputes are not implemented
- auto-confirmation is not implemented
- monthly dispute limits are not implemented

---

## Product Direction Not Yet Implemented

These are target product rules, not current runtime behavior:

- official results should use structured set data instead of plain score strings
- both players should confirm final results
- players should have a 48-hour confirmation window
- undisputed results should auto-confirm after the window
- disputed results should freeze ranking updates
- admins should resolve disputes manually
- each player should have a monthly dispute limit
- ranking updates should happen only after final confirmation
- live score history should be persisted for auditability

---

## Practical Working Model

When working in this repo, assume:

- the active product is the routed dashboard ladder flow
- the active shell is `DefaultLayout`
- the route map is the source of truth for what users can currently open
- players and challenges use the Axios mock adapter
- match reads currently use demo data from `MatchService.js`
- matches are intended to be created by accepting challenges
- official score submission happens on Match Details
- ranking updates happen when challenge review completes
- live scoring is useful UI but not persisted
- auth and booking exist as secondary systems but are not active routed product flows
- legacy files should not be treated as active behavior unless they are added to the router and brought back in sync
