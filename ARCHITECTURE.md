# ShellTennis PH - Current Application Architecture

## Overview

ShellTennis PH is a Vue 3 + Vite single-page application for a Shell-branded Port Harcourt tennis ladder experience.

The app is currently centered around one active product flow:

1. Load the ladder dashboard.
2. Review pending challenge or match actions.
3. Create a challenge against an allowed opponent.
4. Accept a challenge, which creates a scheduled match.
5. Open the play screen for a scheduled match.
6. Submit a result from the match details page.
7. Review and finalize the result, which updates ladder rankings.

The app also contains older or secondary flows for:

- login and local auth persistence
- single-court booking with localStorage persistence
- landing, matches, history, and profile views

Important: not every file in `src/views` is currently connected to the router. The router only exposes the dashboard/challenge/ladder/play flow. Several other views and components still exist in the repo as legacy or future-facing UI.

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

- SPA rendered entirely on the client.
- `main.js` creates the app, registers Pinia and Vue Router, imports global CSS, and mounts only after `router.isReady()`.
- `App.vue` is intentionally minimal and renders only `DefaultLayout`.

### Backend model

The app does not call a real backend by default.

- `src/services/ApiService.js` creates an Axios instance with a custom mock adapter.
- The adapter simulates network delay and handles all challenge/player/match endpoints in memory.
- The in-memory database is initialized lazily the first time a request is made.
- Because the mock adapter uses in-memory arrays, challenge/match/player changes persist only for the current browser session/runtime.

### Local persistence model

Only some domains persist to localStorage:

- Auth state persists to `localStorage` key `sheltennis-auth`.
- Booking data persists to `localStorage` key `sheltennis-bookings`.
- Player/challenge/match ladder data does not persist to localStorage. It is generated in memory by the mock API adapter on first request.

---

## Current Active User Flow

## 1. App boot

1. `src/main.js` creates the Vue app.
2. Pinia is installed.
3. Vue Router is installed.
4. `src/assets/main.css` applies the Shell/tennis visual system globally.
5. `App.vue` renders `DefaultLayout`.
6. `DefaultLayout.vue` renders the branded sidebar, route-aware page header, and `RouterView`.

## 2. Initial navigation

The root path `/` redirects to `/dashboard`.

The currently active route map is:

- `/` -> redirect to `/dashboard`
- `/dashboard` -> dashboard overview
- `/rankings` -> ladder list
- `/challenges` -> challenge management
- `/matches/:matchId` -> match details/result submission
- `/play/:matchId` -> live play/scoreboard screen
- `/create-challenge` -> challenge creation page
- unknown route -> redirect to `/dashboard`

Important: there are no active routes for `/login`, `/book`, `/matches`, `/profile`, `/history`, or `/landing` in the current router.

## 3. Dashboard flow

`DashboardView.vue` is the current hub.

On mount it loads:

- players via `playerStore.loadPlayers()`
- challenges via `challengeStore.loadChallenges()`
- matches via `matchStore.loadMatches()`

The dashboard then derives:

- stats: player count, ladder count, match count
- current player from `playerStore.currentPlayer`
- featured match: first scheduled match, otherwise first pending-review match
- pending actions:
  - awaiting challenges become "Accept challenge from X"
  - pending review matches become "Confirm match vs X"
- recent challenges: first 3 challenge records
- recent matches: first 3 match records

Dashboard actions do not execute full workflows directly. They route the user into the correct page:

- create challenge entry points in the page body or sidebar footer -> `/create-challenge`
- pending challenge action -> `/challenges`
- pending review action -> `/matches/:matchId`
- featured match -> `/play/:matchId`
- recent challenge -> related `/matches/:matchId` if one exists, otherwise `/challenges`
- recent match -> `/play/:matchId` for scheduled matches, `/matches/:matchId` otherwise

This matches the app's current mental model:

- Dashboard = overview + entry points
- Create Challenge = setup
- Play = live interaction
- Match Details = result submission/review
- Rankings = exploration
- Challenges = management

## 4. Rankings flow

`RankingsView.vue`:

- loads players on mount
- reads `playerStore.sortedLadder`
- reads `playerStore.currentPlayer`
- shows the current player summary
- renders all players through `PlayerCard`
- enables challenge CTA only for opponents returned by `playerStore.availableOpponents`

When a challenge CTA is clicked:

- the user is routed to `/create-challenge?opponent=<playerId>`

## 5. Create challenge flow

`CreateChallengeView.vue`:

- loads players on mount
- reads the current player from `playerStore.currentPlayer`
- reads allowed opponents from `playerStore.availableOpponents`
- optionally preselects `route.query.opponent`
- falls back to the first allowed opponent if none is preselected

On submit it calls:

- `challengeStore.createChallenge({ challengerId, defenderId, note })`

If successful:

- the user is routed to `/challenges`

Business rule enforcement for who can be challenged is currently frontend-derived from the player store:

- current player is fixed at `player-15`
- available opponents are players ranked above the current player
- opponent must be within 3 ladder positions above the current player

## 6. Challenge management flow

`ChallengesView.vue`:

- loads challenges and matches on mount
- exposes filters: `all`, `awaiting`, `scheduled`, `pending_review`
- renders filtered challenges through `ChallengeCard`

Challenge card actions:

- `Accept` -> `challengeStore.acceptChallenge(challengeId)`
- `Review` -> `challengeStore.reviewChallenge(challengeId)`
- `Details` -> looks up the related match by `challengeId` and routes to `/matches/:matchId`

After `acceptChallenge` or `reviewChallenge`:

- `matchStore.loadMatches()` is called again so match state stays aligned with challenge changes

## 7. Match creation via challenge acceptance

There is no separate dedicated create-match domain in the current active router/store flow.

A match is created when a challenge is accepted.

Inside the mock API adapter:

- POST `/challenges/:id/accept`
- updates the challenge status to `scheduled`
- sets `scheduledAt` if not provided
- creates a new match with:
  - `id`
  - `challengeId`
  - `challengerId`
  - `defenderId`
  - `status: 'scheduled'`
  - `scheduledAt`
  - `score: null`
  - `winnerId: null`

This means the current domain model is:

- challenge acceptance is the source of match creation
- there is no standalone match scheduling form in the active route tree

## 8. Play flow

`PlayView.vue` is route-driven at `/play/:matchId`.

On mount it loads:

- players
- matches

Then it creates a local scoreboard state using:

- `createScoreboard(challengerName, defenderName)`

Important behavior:

- The play screen scoreboard is local UI state only.
- It is not persisted into the match store or mock API.
- Awarding points calls `recordPoint(scoreboardState, playerKey)` from `tennisScoring.js`.
- The play screen is currently a live scoring experience, but it does not save rally-by-rally progress to backend/store state.

Play screen actions:

- show current match title and scheduled time
- show scoreboard status
- award points to either player
- navigate to `/matches/:matchId` via "Open Match Details"

## 9. Match details / result submission flow

`MatchDetailsView.vue` is route-driven at `/matches/:matchId`.

On mount it loads:

- players
- matches

It then:

- finds the target match via `matchStore.matchById(matchId)`
- derives challenger and defender names from the player store
- pre-fills the form with:
  - `winnerId = challengerId`
  - `score = '6-4, 6-4'`

Submit behavior:

- allowed only when `match.status === 'scheduled'`
- calls `matchStore.submitResult(matchId, { winnerId, score })`

Mock API result submission:

- POST `/matches/:id/result`
- sets `match.score`
- sets `match.winnerId`
- changes match status to `pending_review`
- changes related challenge status to `pending_review`

## 10. Result review / ladder update flow

Review is currently triggered from the challenges page.

When `challengeStore.reviewChallenge(challengeId)` is called:

- POST `/challenges/:id/review`
- related challenge status becomes `completed`
- related match status becomes `completed`
- `updateRankingsForResult(match)` runs inside the mock API adapter

Ranking update rules:

- both players' `matchesPlayed` increment
- winner gains a win
- loser gains a loss
- if the challenger beats a higher-ranked defender, challenger and defender ranks swap
- after that, all players are sorted and re-numbered sequentially from rank 1

The review response may include updated players.

Store behavior after review:

- challenge record is updated in `challengeStore`
- if player data is returned, `playerStore.players` is overwritten with new rankings
- otherwise `playerStore.loadPlayers()` is called

---

## Domain Model

## Player

Source: `ApiService.js`

Shape:

- `id`
- `name`
- `rank`
- `wins`
- `losses`
- `matchesPlayed`

Generated from a fixed list of 20 names.

Current default current player:

- `player-15`

## Challenge

Shape:

- `id`
- `challengerId`
- `defenderId`
- `status`
- `requestedAt`
- optional `scheduledAt`
- optional `note`

Derived response enrichment adds:

- `statusLabel`
- `challengerName`
- `defenderName`
- `challengerRank`
- `defenderRank`

Supported statuses:

- `awaiting`
- `scheduled`
- `pending_review`
- `completed`

## Match

Shape in the active ladder flow:

- `id`
- `challengeId`
- `challengerId`
- `defenderId`
- `status`
- `scheduledAt`
- `score`
- `winnerId`

Derived response enrichment adds:

- `statusLabel`
- `challengerName`
- `defenderName`

Supported statuses in active flow:

- `scheduled`
- `pending_review`
- `completed`

## Booking

Shape in the booking flow:

- `id`
- `date`
- `startHour`
- `duration`
- `playerName`
- `description`
- `createdAt`

## Scoreboard

Created by `tennisScoring.js`

Shape:

- `players: { playerA, playerB }`
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

Set shape:

- `games`
- `winner`
- `tieBreak`

---

## Service Layer

## `src/services/ApiService.js`

This is the core simulated backend.

Responsibilities:

- create Axios instance
- apply artificial request delay
- seed mock players/challenges/matches on first use
- handle read/write endpoints for players, challenges, and matches
- enrich raw data with labels and names
- update rankings after reviewed results

Implemented endpoints:

- `GET /players`
- `GET /challenges`
- `GET /matches`
- `POST /challenges`
- `POST /challenges/:id/accept`
- `POST /matches/:id/result`
- `POST /challenges/:id/review`

## `src/services/PlayerService.js`

Thin wrapper over `ApiService`:

- `getPlayers()`
- `getPlayerById(playerId)` by fetching all players and filtering locally

## `src/services/ChallengeService.js`

Thin wrapper over `ApiService`:

- `getChallenges()`
- `createChallenge(payload)`
- `acceptChallenge(challengeId, scheduledAt)`
- `reviewChallenge(challengeId)`

## `src/services/MatchService.js`

Thin wrapper over `ApiService`:

- `getMatches()`
- `submitMatchResult(matchId, payload)`

## `src/services/BookingService.js`

Separate from the Axios mock API. Uses `fakeRequest` helpers.

Responsibilities:

- provide sample bookings
- generate slot labels
- generate daily court slots from 06:00 to 20:00
- prevent overlapping bookings
- create booking records

Important booking behavior:

- durations allowed: 1 hour or 2 hours
- one court only
- overlap detection is done against current booking array

## `src/services/api.js`

Generic utility helpers:

- `fakeRequest(payload, delay)`
- `createId(prefix)`
- `createTimestamp()`

---

## Store Layer

## `auth` store

File: `src/stores/auth.js`

Pinia setup store with localStorage persistence.

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

Behavior:

- reads initial auth state from localStorage
- writes auth state back on `isLoggedIn`/`user` changes
- fake login creates a Shell user object using entered username

## `booking` store

File: `src/stores/booking.js`

Pinia setup store with localStorage persistence.

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

Behavior:

- reads stored bookings from localStorage
- only falls back to sample bookings if local storage is empty
- persists bookings back to localStorage whenever they change

## `player` store

File: `src/stores/player.js`

Pinia setup store for ladder player data.

State:

- `players`
- `currentPlayerId`
- `isLoading`
- `error`

Computed:

- `sortedLadder`
- `currentPlayer`
- `availableOpponents`

Actions:

- `loadPlayers()`

Important rule:

- `availableOpponents` returns only players above the current player and within 3 ranks.

## `challenge` store

File: `src/stores/challenge.js`

Pinia setup store for ladder challenges.

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

Cross-store behavior:

- `reviewChallenge()` updates challenge state and also refreshes or overwrites player rankings using `playerStore`

## `match` store

File: `src/stores/match.js`

Pinia setup store for ladder matches.

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

Cross-store behavior:

- after successful result submission, `playerStore.loadPlayers()` is called

## `counter` store

File: `src/stores/counter.js`

Simple example/demo store:

- `count`
- `doubleCount`
- `increment()`

This store is not part of the active ladder flow.

---

## Component Layer

## Active reusable components

### `BaseButton.vue`

- generic button wrapper with `primary`, `secondary`, and `ghost` variants
- emits `click`
- used in challenge creation and challenge cards

### `BaseInput.vue`

- generic labeled input
- supports `v-model` via `update:modelValue`

### `ChallengeCard.vue`

- renders one challenge summary
- shows challenger/defender/status/schedule/note
- conditionally shows `Accept`, `Review`, and `Details` buttons

### `TennisScoreboard.vue`

- consumes a scoreboard object
- renders:
  - match status
  - best-of value
  - winner
  - per-player live points
  - set summaries
  - tie-break display
- emits `point` when either point button is pressed

## Existing but not central to active route flow

### `CountdownTimer.vue`

- interval-driven countdown to a target date
- not currently used by the latest dashboard implementation

### `CourtBookingForm.vue`

- form for selecting date, slot, duration, and notes
- emits a `book` payload
- used by `BookView.vue`, which is not currently routed

### `MatchCard.vue`

- older/general-purpose match card for live/upcoming matches
- expects a match shape with fields such as `players`, `title`, `type`, `level`, `court`, `scoreboard`
- used by `MatchesView.vue`
- does not match the current active `matchStore` API anymore

### `NavBar.vue`

- older navigation header with auth action
- not used by the current layout

### `PlayerCard.vue`

- renders one player row and optional challenge button
- used by `RankingsView.vue`
- styling is older than the latest dashboard redesign

---

## View Layer

## Routed views in the current router

### `DashboardView.vue`

Purpose:

- overview page and routing hub

Loads:

- players
- challenges
- matches

Shows:

- stats
- current player badge
- pending actions
- featured match
- recent challenges
- recent matches

Routes out to:

- create challenge
- challenges
- play screen
- match details

### `RankingsView.vue`

Purpose:

- ladder exploration and challenge entry point

Loads:

- players

Shows:

- current player summary
- full sorted ladder
- challenge CTA for allowed opponents only

Routes out to:

- create challenge with `opponent` query param

### `ChallengesView.vue`

Purpose:

- challenge management

Loads:

- challenges
- matches

Shows:

- filter tabs
- challenge list

Actions:

- accept challenge
- review challenge
- open match details

### `CreateChallengeView.vue`

Purpose:

- create ladder challenge

Loads:

- players

Uses:

- current player
- available opponents
- optional opponent query param

Action:

- create challenge then redirect to `/challenges`

### `PlayView.vue`

Purpose:

- route-based live scoring screen for a specific match

Loads:

- players
- matches

Important limitation:

- scoreboard progress is local view state only and is not persisted to store/mock backend

Action:

- navigate to match details page

### `MatchDetailsView.vue`

Purpose:

- result submission for a specific match

Loads:

- players
- matches

Action:

- submit result, which moves match/challenge to `pending_review`

## Existing views present in the repo but not currently routed

These files exist but are not exposed by the current router:

### `LandingView.vue`

- marketing/hero landing page
- uses a static sample scoreboard preview
- links to `/login` and `/matches`

### `LoginView.vue`

- local Shell-themed login form
- uses `authStore.login()`
- redirects to `/dashboard`

### `BookView.vue`

- court booking page
- uses `bookingStore` and `CourtBookingForm`

### `MatchesView.vue`

- older general match-creation/join page
- expects `matchStore.liveMatches`, `upcomingMatches`, `joinExistingMatch`, `createNewMatch`
- these APIs do not exist in the current `match` store
- this view is currently legacy/incompatible with the active ladder match store

### `ProfileView.vue`

- shows local auth profile data

### `HistoryView.vue`

- shows booking history and completed matches
- completed match rendering assumes older match shape and may not match current active match data perfectly

---

## Utility Layer

## `src/utils/tennisScoring.js`

This file contains the rules engine for the play screen and scoreboard component.

Exports:

- `createScoreboard(playerA, playerB, bestOfSets = 3)`
- `recordPoint(scoreboard, playerKey)`
- `describePoint(scoreboard, playerKey)`
- `formatSetSummary(scoreboard)`

Rules implemented:

- Love / 15 / 30 / 40
- deuce
- advantage
- game win requires 2-point lead after 40
- set win requires at least 6 games with 2-game lead
- tie-break starts at 6-6
- tie-break win requires at least 7 points with 2-point lead
- match win requires majority of sets in best-of format

Important implementation note:

- `recordPoint()` clones the scoreboard before mutating and returns the cloned next state

---

## Current Styling System

Global styling lives primarily in `src/assets/main.css`.

Theme direction:

- Shell/tennis-inspired warm palette
- green primary
- red secondary
- yellow accent
- cream/yellow glassy surfaces

Global CSS responsibilities:

- CSS custom properties
- body gradient background
- typography
- shared container sizing
- shared card classes:
  - `.surface-card`
  - `.section-card`

Layout styling lives in `DefaultLayout.vue` and provides:

- branded left sidebar with icon navigation
- route-aware page header with current title and subtitle
- sidebar footer create-challenge CTA instead of a header action button
- background blur orbs
- main content container

Most routed views use scoped CSS on top of the global theme.

Some legacy views/components still use older colors and styling conventions.

---

## Current File/Flow Mismatches and Technical Reality

This section is important if another AI is going to reason about the repo without opening the code.

1. The router is narrow and only exposes the ladder flow.
   - Many views exist in `src/views`, but only six route components are currently active.

2. The active match domain is challenge-derived.
   - Matches are created by challenge acceptance.
   - There is no standalone create-match route in the active router.

3. The play screen is not persistent.
   - Rally-by-rally scoring is local component state only.
   - Submitting the final result happens on the match details page, not on the play page.

4. The booking system is separate from the ladder system.
   - Booking uses localStorage plus `fakeRequest`.
   - Ladder players/challenges/matches use the Axios mock adapter and in-memory state.

5. Some repo files are legacy or partially stale.
   - `MatchesView.vue` expects store APIs that do not exist.
   - `NavBar.vue` is not used.
   - `CountdownTimer.vue` is not used by the current dashboard.
   - `HistoryView.vue` assumes an older match shape for completed matches.

6. Authentication exists but is not currently enforced by routing.
   - There are no route guards.
   - Active routes can be loaded without using `LoginView.vue`.

---

## End-to-End Data Flow

### Ladder flow

1. View mounts.
2. View calls Pinia action(s).
3. Store calls service function(s).
4. Service calls `ApiService` Axios client.
5. Mock adapter reads/mutates in-memory DB.
6. Store updates refs/computed state.
7. View re-renders.

### Booking flow

1. `BookView` loads `bookingStore`.
2. `bookingStore` loads from localStorage or sample data.
3. `CourtBookingForm` emits booking payload.
4. `bookingStore.bookCourt()` calls `BookingService.createBooking()`.
5. Overlap check is done against existing bookings.
6. New booking is added and stored back to localStorage.

### Auth flow

1. `LoginView` submits username/password.
2. `authStore.login()` creates a fake Shell user object.
3. Store persists auth state to localStorage.
4. User is redirected to `/dashboard`.

---

## Project Structure Snapshot

```text
src/
  App.vue                     # Renders DefaultLayout only
  main.js                     # App bootstrap
  assets/
    main.css                  # Global theme, tokens, shared layout utilities
  layouts/
    DefaultLayout.vue         # Active sidebar shell with route-aware header
  router/
    index.js                  # Active routed flow
  services/
    ApiService.js             # Mock backend for ladder domain
    PlayerService.js          # Player API wrapper
    ChallengeService.js       # Challenge API wrapper
    MatchService.js           # Match API wrapper
    BookingService.js         # Separate local booking logic
    api.js                    # Generic fake request utilities
  stores/
    auth.js                   # Local auth state
    booking.js                # LocalStorage booking state
    player.js                 # Ladder players
    challenge.js              # Ladder challenges
    match.js                  # Ladder matches
    counter.js                # Demo store
  composables/
    useAuth.js                # Thin wrapper around auth store
  utils/
    tennisScoring.js          # Tennis scoring engine
  components/
    BaseButton.vue
    BaseInput.vue
    ChallengeCard.vue
    CountdownTimer.vue
    CourtBookingForm.vue
    MatchCard.vue
    NavBar.vue
    PlayerCard.vue
    TennisScoreboard.vue
  views/
    DashboardView.vue         # Active
    RankingsView.vue          # Active
    ChallengesView.vue        # Active
    CreateChallengeView.vue   # Active
    MatchDetailsView.vue      # Active
    PlayView.vue              # Active
    LandingView.vue           # Present but not routed
    LoginView.vue             # Present but not routed
    BookView.vue              # Present but not routed
    MatchesView.vue           # Present but legacy/incompatible
    ProfileView.vue           # Present but not routed
    HistoryView.vue           # Present but not routed
```

---

## Practical Summary

If another AI needs to work on this project without opening the codebase, the safest mental model is:

- This is a Vue SPA with one active ladder workflow.
- The active workflow is dashboard -> rankings/challenges/create challenge -> play -> match details -> review.
- Match creation happens by accepting a challenge, not by a standalone match creator.
- The play screen is visual/live but not persisted.
- Final score submission happens on the match details page.
- Ranking updates happen only when a challenge is reviewed.
- Auth and booking systems exist, but they are secondary and mostly disconnected from the currently routed ladder flow.
- Several non-routed files remain in the repo and should not be assumed to be production-active just because they exist.
