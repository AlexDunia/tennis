# ShellTennis PH - Current Architecture and Canonical Product Direction

## Overview

ShellTennis PH is a Vue 3 + Vite single-page application for a player-driven tennis ladder workflow.

The active app is currently centered around one routed ladder flow:

1. Open the dashboard.
2. Review pending ladder actions.
3. Create a challenge against an eligible opponent.
4. Accept a challenge, which creates a scheduled match.
5. Open the live play screen.
6. Submit a result from the match details page.
7. Review the challenge result to finalize ranking updates.

The repository also contains secondary or legacy flows for:

- login and local auth persistence
- single-court booking with localStorage persistence
- landing, history, matches, and profile views

Important:

- only part of the repo is currently routed
- the active app shell is now a white product dashboard shell with a left sidebar and route-aware page header
- some product rules below are canonical direction and are not fully implemented yet

---

## Stack

- Vue 3.5.x
- Composition API
- `<script setup>`
- Pinia 3.x
- Vue Router 4
- Axios 1.x
- Vite 5
- Prettier 3

---

## Runtime Model

### Frontend model

- The app is a client-rendered SPA.
- `src/main.js` creates the app, installs Pinia, installs Vue Router, imports global CSS, and mounts after `router.isReady()`.
- `src/App.vue` intentionally renders only `DefaultLayout`.
- `src/layouts/DefaultLayout.vue` provides the persistent shell:
  - full-height left sidebar
  - icon-driven primary navigation
  - full-width route-aware page header
  - main content container for routed views

### Backend model

There is no real backend by default.

- `src/services/ApiService.js` creates an Axios instance with a custom mock adapter.
- The adapter simulates latency and handles players, challenges, and matches in memory.
- The in-memory database is seeded lazily when first accessed.
- Ladder data persists only for the current runtime and resets on reload.

### Local persistence model

Only some domains use localStorage:

- auth state persists under `sheltennis-auth`
- booking state persists under `sheltennis-bookings`
- ladder player, challenge, and match data does not persist to localStorage

---

## Current Active User Flow

## 1. Boot and shell

1. `src/main.js` creates the Vue app.
2. Pinia is installed.
3. Vue Router is installed.
4. `src/assets/main.css` applies the global white-first design tokens.
5. `src/App.vue` renders `DefaultLayout`.
6. `DefaultLayout.vue` renders the sidebar, the route-aware header, and `RouterView`.

## 2. Active route map

The root path `/` redirects to `/dashboard`.

The live route map is:

- `/` -> redirect to `/dashboard`
- `/dashboard` -> overview and command center
- `/rankings` -> ladder view
- `/challenges` -> challenge management
- `/create-challenge` -> challenge setup
- `/play/:matchId` -> live scoring
- `/matches/:matchId` -> result submission
- unknown routes -> redirect to `/dashboard`

There are currently no active routes for:

- `/login`
- `/book`
- `/matches`
- `/profile`
- `/history`
- `/landing`

## 3. Dashboard flow

`DashboardView.vue` is the active command center.

On mount it loads:

- `playerStore.loadPlayers()`
- `challengeStore.loadChallenges()`
- `matchStore.loadMatches()`

It derives:

- player count
- ladder count
- match count
- current player
- featured match
- pending actions
- recent challenges
- recent matches

Dashboard items route the user into deeper workflows rather than completing those workflows inline:

- create challenge entry point -> `/create-challenge`
- pending challenge action -> `/challenges`
- pending review action -> `/matches/:matchId`
- featured match -> `/play/:matchId`
- recent challenge -> related match details or `/challenges`
- recent match -> play or match details depending on match status

## 4. Rankings flow

`RankingsView.vue`:

- loads players on mount
- reads `playerStore.sortedLadder`
- reads `playerStore.currentPlayer`
- displays the full ladder
- exposes challenge CTAs only for `playerStore.availableOpponents`

Challenge action:

- routes to `/create-challenge?opponent=<playerId>`

## 5. Create challenge flow

`CreateChallengeView.vue`:

- loads players on mount
- reads `playerStore.currentPlayer`
- reads `playerStore.availableOpponents`
- optionally preselects `route.query.opponent`
- falls back to the first eligible opponent when needed

Submit action:

- `challengeStore.createChallenge({ challengerId, defenderId, note })`

Success result:

- route to `/challenges`

## 6. Challenge management flow

`ChallengesView.vue`:

- loads challenges and matches on mount
- exposes filters for:
  - `all`
  - `awaiting`
  - `scheduled`
  - `pending_review`
- renders `ChallengeCard` for each visible challenge

Challenge card actions:

- `Accept` -> `challengeStore.acceptChallenge(challengeId)`
- `Review` -> `challengeStore.reviewChallenge(challengeId)`
- `Details` -> route to `/matches/:matchId` for the related match

After accept or review:

- `matchStore.loadMatches()` is called again so challenge and match state stay aligned

## 7. Match creation model in current code

There is no standalone active create-match route.

Current code creates a match by accepting a challenge.

Inside the mock adapter:

- `POST /challenges/:id/accept`
- challenge status changes to `scheduled`
- `scheduledAt` is set if needed
- a new match is created with:
  - `id`
  - `challengeId`
  - `challengerId`
  - `defenderId`
  - `status: 'scheduled'`
  - `scheduledAt`
  - `score: null`
  - `winnerId: null`

## 8. Play flow

`PlayView.vue` is routed at `/play/:matchId`.

On mount it loads:

- players
- matches

It then creates local scoreboard UI state with:

- `createScoreboard(challengerName, defenderName)`

Important current behavior:

- the play scoreboard is local component state only
- it is not persisted to the mock backend
- awarding points uses `recordPoint(scoreboardState, playerKey)`
- the play page is for live scoring, not official result confirmation

## 9. Match details flow

`MatchDetailsView.vue` is routed at `/matches/:matchId`.

On mount it loads:

- players
- matches

It then:

- finds the target match from `matchStore.matchById(matchId)`
- derives player names from the player store
- pre-fills:
  - `winnerId = challengerId`
  - `score = '6-4, 6-4'`

Submit action:

- only allowed when `match.status === 'scheduled'`
- calls `matchStore.submitResult(matchId, { winnerId, score })`

Mock API behavior:

- `POST /matches/:id/result`
- sets `match.score`
- sets `match.winnerId`
- changes match status to `pending_review`
- changes related challenge status to `pending_review`

## 10. Result review and ladder update flow

Review is currently triggered from the challenges page.

When `challengeStore.reviewChallenge(challengeId)` runs:

- `POST /challenges/:id/review`
- challenge status becomes `completed`
- related match status becomes `completed`
- ranking update logic runs inside the mock adapter

Current ranking update behavior:

- both players get `matchesPlayed + 1`
- winner gets a win
- loser gets a loss
- if challenger beats a higher-ranked defender, their ranks swap
- players are then normalized back into sequential ladder order

---

## Canonical Product Rules

This section documents the intended product model that design and future implementation should align to.

## Player roles

There are two fixed roles and one flexible role:

- `Player A`
- `Player B`
- `Scorer`

Rules:

- Player A and Player B are the competitors
- only the two players can confirm final results
- only the two players can influence rankings
- Scorer is optional
- Scorer is not assigned up front
- Scorer can be either player or a spectator
- Scorer can change naturally during the match

## Canonical match data shape

Canonical product direction is to store structured set data, not a plain score string.

```javascript
match: {
  id: 'match-001',
  challengeId: 'challenge-001',
  playerA: { id, name, rank },
  playerB: { id, name, rank },
  winnerId: 'player-x',
  status: 'scheduled' | 'in_progress' | 'pending_confirmation' | 'disputed' | 'completed',
  scheduledAt: 'ISO string',
  completedAt: 'ISO string',
  confirmedBy: ['player-a-id', 'player-b-id'],
  disputedBy: 'player-id' | null,
  sets: [
    {
      playerA: 6,
      playerB: 4,
      tiebreak: null,
    },
    {
      playerA: 7,
      playerB: 6,
      tiebreak: { playerA: 7, playerB: 5 },
    },
  ],
  pointLog: [],
}
```

Canonical storage rule:

- `sets` should be the source of truth
- display strings such as `6-4, 7-6` should be derived at render time
- a plain stored `score` string should not be canonical state

## Confirmation and dispute rules

Canonical product rules:

- both players have 48 hours to confirm a completed match
- if neither player disputes inside that window, the result auto-confirms
- if the losing player disputes inside the window, the result is frozen
- frozen results do not update the ladder until resolved
- a designated admin resolves disputes manually
- each player can raise only one dispute per calendar month

## Dashboard philosophy

The dashboard is a command center.

It should surface:

- ongoing matches
- pending confirmations
- active disputes
- ladder standing context
- entry points into deeper pages

Multi-step workflows should stay on dedicated pages:

- challenge creation
- play / live scoring
- result submission
- confirmation or dispute handling

## Ladder rules

- rankings update only on confirmed results
- challengers may only target opponents within three spots above them
- if a lower-ranked challenger beats a higher-ranked opponent and the result confirms, their positions swap
- wins, losses, and matches played update at the same time

---

## Domain Model in Current Code

## Player

Source: `ApiService.js`

Shape:

- `id`
- `name`
- `rank`
- `wins`
- `losses`
- `matchesPlayed`

Current default active user:

- `player-15`

## Challenge

Current active shape:

- `id`
- `challengerId`
- `defenderId`
- `status`
- `requestedAt`
- optional `scheduledAt`
- optional `note`

Enriched response fields:

- `statusLabel`
- `challengerName`
- `defenderName`
- `challengerRank`
- `defenderRank`

Current statuses:

- `awaiting`
- `scheduled`
- `pending_review`
- `completed`

## Match

Current active shape:

- `id`
- `challengeId`
- `challengerId`
- `defenderId`
- `status`
- `scheduledAt`
- `score`
- `winnerId`

Enriched response fields:

- `statusLabel`
- `challengerName`
- `defenderName`

Current active statuses:

- `scheduled`
- `pending_review`
- `completed`

## Booking

Booking flow shape:

- `id`
- `date`
- `startHour`
- `duration`
- `playerName`
- `description`
- `createdAt`

## Scoreboard

Created by `src/utils/tennisScoring.js`

Shape:

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

---

## Service Layer

## `src/services/ApiService.js`

Responsibilities:

- create the Axios client
- simulate network delay
- seed mock players, challenges, and matches
- handle read and write endpoints
- enrich raw records with labels and names
- update ladder rankings after review

Implemented endpoints:

- `GET /players`
- `GET /challenges`
- `GET /matches`
- `POST /challenges`
- `POST /challenges/:id/accept`
- `POST /matches/:id/result`
- `POST /challenges/:id/review`

## `src/services/PlayerService.js`

- `getPlayers()`
- `getPlayerById(playerId)`

## `src/services/ChallengeService.js`

- `getChallenges()`
- `createChallenge(payload)`
- `acceptChallenge(challengeId, scheduledAt)`
- `reviewChallenge(challengeId)`

## `src/services/MatchService.js`

- `getMatches()`
- `submitMatchResult(matchId, payload)`

## `src/services/BookingService.js`

Separate from the ladder Axios mock adapter.

Responsibilities:

- provide sample bookings
- generate court slots
- prevent overlaps
- create bookings

Booking rules:

- one court only
- durations of 1 hour or 2 hours
- overlap detection against the current booking set

## `src/services/api.js`

Shared helpers:

- `fakeRequest(payload, delay)`
- `createId(prefix)`
- `createTimestamp()`

---

## Store Layer

## `auth` store

File: `src/stores/auth.js`

Setup-style Pinia store with localStorage persistence.

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

## `booking` store

File: `src/stores/booking.js`

Setup-style Pinia store with localStorage persistence.

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

## `player` store

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

Important rule:

- `availableOpponents` returns only players above the current player and within 3 ranks

## `challenge` store

File: `src/stores/challenge.js`

State:

- `challenges`
- `filterStatus`
- `isLoading`
- `error`

Computed:

- `filteredChallenges`
- `summaryCounts`

Actions:

- `loadChallenges()`
- `createChallenge(payload)`
- `acceptChallenge(challengeId, scheduledAt)`
- `reviewChallenge(challengeId)`
- `setFilter(status)`

## `match` store

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

## `counter` store

File: `src/stores/counter.js`

Simple demo store not used in the active ladder flow.

---

## Component and View Layer

## Active reusable components

- `BaseButton.vue`
- `BaseInput.vue`
- `ChallengeCard.vue`
- `PlayerCard.vue`
- `TennisScoreboard.vue`

## Active routed views

- `DashboardView.vue`
- `RankingsView.vue`
- `ChallengesView.vue`
- `CreateChallengeView.vue`
- `PlayView.vue`
- `MatchDetailsView.vue`

## Existing but secondary or legacy

- `CountdownTimer.vue`
- `CourtBookingForm.vue`
- `MatchCard.vue`
- `NavBar.vue`
- `LandingView.vue`
- `LoginView.vue`
- `BookView.vue`
- `MatchesView.vue`
- `ProfileView.vue`
- `HistoryView.vue`

---

## Current Styling System

Global styling primarily lives in `src/assets/main.css`.

Current visual direction:

- white overall background
- minimal dashboard software feel
- restrained use of Renaissance-inspired accents
- green as primary accent
- yellow and orange as secondary highlights
- low-noise cards, small text scale, and subtle borders

Layout styling lives in `DefaultLayout.vue` and provides:

- full-height left sidebar
- icon + text navigation
- route-aware title and subtitle header
- sidebar footer create-challenge entry point

Most routed views layer scoped CSS on top of this shared system.

---

## Current File / Flow Mismatches and Technical Reality

This section matters if another AI is reasoning about the repo without direct code access.

1. The router is narrow and only exposes the ladder flow.
   - Several views exist in the repo but are not currently active.

2. The active match domain is challenge-derived.
   - Matches are created by accepting a challenge.
   - There is no standalone live create-match route today.

3. The play screen is not persistent.
   - Rally-by-rally scoring is local UI state only.
   - Final result submission happens on the match details page.

4. The canonical product model is ahead of the implementation.
   - structured `sets` arrays are not yet the stored match source of truth
   - dispute flow is not implemented
   - confirmation windows are not implemented
   - auto-confirmation is not implemented

5. The booking system is separate from the ladder system.
   - booking uses localStorage and `fakeRequest`
   - ladder data uses the Axios mock adapter and in-memory state

6. Authentication exists but is not currently enforced by routing.
   - there are no route guards
   - active ladder routes can be opened without login

---

## End-to-End Data Flow

### Ladder flow

1. A routed view mounts.
2. The view calls Pinia action(s).
3. Stores call service wrappers.
4. Services call the Axios mock API.
5. The mock adapter reads or mutates in-memory state.
6. Stores update refs and computed state.
7. The view re-renders.

### Booking flow

1. `BookView` loads `bookingStore`.
2. `bookingStore` reads localStorage or sample data.
3. `CourtBookingForm` emits a booking payload.
4. `bookingStore.bookCourt()` calls `BookingService.createBooking()`.
5. The overlap check runs against existing bookings.
6. New booking data is persisted back to localStorage.

### Auth flow

1. `LoginView` submits credentials.
2. `authStore.login()` creates a fake Shell user object.
3. Auth state persists to localStorage.
4. The user is redirected to `/dashboard`.

---

## Practical Summary

If another AI needs a safe working model without opening the codebase, assume:

- this is a Vue SPA with one active ladder workflow
- the active routed flow is dashboard -> rankings/challenges/create challenge -> play -> match details -> review
- the UI shell is sidebar + route-aware page header
- matches are currently created by accepting a challenge
- play is interactive but not persistent
- final score submission currently happens on the match details page
- ranking updates currently happen when a challenge is reviewed
- canonical product rules around `sets`, confirmations, and disputes describe target direction, not finished implementation
- non-routed files should not be assumed to be production-active
