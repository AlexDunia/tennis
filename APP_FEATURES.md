# ShellTennis PH - Current App Features

## Product Summary

ShellTennis PH is a Shell-branded tennis ladder web app for the Port Harcourt team court.

The current real product is built around one primary workflow:

1. Open the dashboard.
2. Review pending ladder actions.
3. Create a challenge against an eligible opponent.
4. Accept a challenge to create a scheduled match.
5. Open the live play screen for that match.
6. Submit the final result from the match details page.
7. Review the completed challenge to finalize ranking updates.

The repository also includes secondary or legacy views for login, bookings, landing, profile, matches, and history, but those are not currently part of the active router.

---

## Current Active Navigation

The live router currently exposes these pages:

- `/dashboard`
- `/rankings`
- `/challenges`
- `/create-challenge`
- `/play/:matchId`
- `/matches/:matchId`

The root path `/` redirects to `/dashboard`.

Any unknown route redirects to `/dashboard`.

There are no active routes right now for:

- `/login`
- `/book`
- `/matches`
- `/profile`
- `/history`
- `/landing`

---

## Current App Shell

The app now uses a product-style dashboard shell instead of a top navigation bar.

### Sidebar

The main navigation is a left sidebar.

It contains:

- ShellTennis PH brand block
- navigation links with icon + label + hint text
- `Dashboard`
- `Rankings`
- `Challenges`
- footer CTA linking to `Create Challenge`

Important UI rule:

- create challenge is no longer a header button
- setup actions live inside the page body or sidebar CTA area, not in the top header bar

### Page Header

The main content area has a route-aware page header.

For every active page, the header shows:

- current page title
- current page subtitle
- contextual workspace chips

This means each routed page no longer needs to lead with a duplicate full title block inside the page body.

---

## Active Pages and Features

## Dashboard

Purpose:

- overview page
- action routing hub

Current features:

- summary hero for the current player
- dedicated in-page create challenge entry point
- stats cards:
  - players
  - matches
  - ladder
- pending actions list
  - awaiting challenges
  - pending review matches
- featured match card
- recent challenges list
- recent matches list

Current behavior:

- loads players, challenges, and matches on mount
- clicking pending items routes to the correct management page
- clicking featured scheduled match routes to the play screen
- clicking recent items routes to challenge or match detail flows

## Rankings

Purpose:

- ladder exploration
- challenge discovery

Current features:

- current player summary
- challenge window summary
- full player ladder list
- challenge button only for eligible opponents

Current behavior:

- loads player data on mount
- challenge CTA routes to `/create-challenge?opponent=<playerId>`

Eligibility rule:

- only higher-ranked opponents within 3 positions are challengeable

## Challenges

Purpose:

- challenge management queue

Current features:

- filter tabs:
  - all
  - awaiting acceptance
  - scheduled
  - pending review
- challenge cards
- accept action
- review action
- details action

Current behavior:

- loads challenges and matches on mount
- accept updates challenge status and creates a scheduled match
- review finalizes the challenge and applies ranking changes
- details routes to `/matches/:matchId`

## Create Challenge

Purpose:

- setup page for a new ladder challenge

Current features:

- current player summary card
- eligible opponent selector
- note/message field
- create challenge CTA

Current behavior:

- loads player data on mount
- preselects opponent from route query when available
- falls back to first eligible opponent when no query is present
- on success routes to `/challenges`

## Play

Purpose:

- live scoring interface for a scheduled match

Current features:

- match identity card
- status chip
- scheduled time
- open match details CTA
- full tennis scoreboard component
- point controls for both players

Current behavior:

- loads players and matches on mount
- creates a local scoreboard state for the selected match
- updates tennis score in memory while the page is open

Important limitation:

- live point-by-point scoring is not persisted to the store or mock backend

## Match Details

Purpose:

- result submission page

Current features:

- match summary card
- winner selector
- score input
- result submission CTA

Current behavior:

- loads players and matches on mount
- pre-fills default score and winner
- only allows submission for scheduled matches
- submitting a result moves the match and related challenge to `pending_review`

---

## Real Ladder Workflow

This is the current real ladder lifecycle:

### 1. Load dashboard

- dashboard reads players, challenges, and matches
- user sees overview + entry points

### 2. Create challenge

- user opens `Create Challenge`
- chooses an eligible opponent
- submits challenge
- challenge is created with `awaiting` status

### 3. Accept challenge

- user opens `Challenges`
- accepts an awaiting challenge
- system changes challenge to `scheduled`
- system creates a related scheduled match

### 4. Play / live scoring

- user opens `Play`
- system creates a local scoreboard for the selected match
- user can award points to either side
- live scoreboard is visual and interactive

### 5. Submit result

- user opens `Match Details`
- enters winner and score
- system changes match to `pending_review`
- related challenge also becomes `pending_review`

### 6. Review result

- user opens `Challenges`
- reviews the pending result
- challenge becomes `completed`
- match becomes `completed`
- player ladder updates are applied

### 7. Updated rankings

- player records update
- challenger can move above defender if challenger wins from below
- ranks are normalized back into order

---

## Current Data Behavior

## Players / challenges / matches

- served by the Axios mock adapter in `src/services/ApiService.js`
- stored in memory only
- reset when the runtime/browser session is restarted

## Auth

- persisted to localStorage under `sheltennis-auth`

## Bookings

- persisted to localStorage under `sheltennis-bookings`

---

## Current Business Rules

## Ladder challenge rules

- current active user is fixed in the player store as `player-15`
- users may only challenge players above them
- users may only challenge opponents within 3 ranks above them

## Match creation rule

- scheduled matches are created by accepting a challenge
- there is no separate active standalone create-match flow in the current router

## Ranking update rule

When a reviewed match is finalized:

- both players get `matchesPlayed + 1`
- winner gets an added win
- loser gets an added loss
- if challenger beats a higher-ranked defender, their ladder positions swap
- player list is then re-sorted and re-ranked from 1 upward

## Court booking rules

The booking system exists in the repo but is not part of the active routed product flow.

Its rules are:

- one fixed court
- generated slots from 06:00 to 20:00
- 1-hour and 2-hour durations only
- overlap prevention on booking creation

---

## Current Reusable UI Pieces

Core currently relevant components:

- `BaseButton.vue`
- `BaseInput.vue`
- `ChallengeCard.vue`
- `PlayerCard.vue`
- `TennisScoreboard.vue`

Still present but secondary/legacy:

- `CountdownTimer.vue`
- `CourtBookingForm.vue`
- `MatchCard.vue`
- `NavBar.vue`

---

## Important Reality Checks

These are critical if another person or AI is going to work on the app:

1. The active product is the ladder flow, not the booking flow.
2. The active shell is now sidebar + route-based page header.
3. `MatchesView.vue` is legacy and expects APIs that do not exist in the current `match` store.
4. `PlayView.vue` is interactive but does not persist rally-by-rally scoreboard state.
5. Result submission happens in `MatchDetailsView.vue`, not in `PlayView.vue`.
6. Several views still exist in the repo even though they are not routed.

---

## Technology

- Vue 3.5+
- Composition API
- `<script setup>`
- Pinia
- Vue Router 4
- Axios
- Vite
- Prettier
