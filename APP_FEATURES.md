# ShellTennis PH - Current Features and Canonical Product Rules

## Product Summary

ShellTennis PH is a player-driven tennis ladder system built around real-world play.

The core experience is intentionally lightweight:

1. Players move through a ladder by challenging eligible opponents.
2. Accepting a challenge creates a match.
3. The live play screen handles quick scoring with minimal friction.
4. Final results are submitted after play.
5. Rankings and player records update only when results are finalized.

The active routed app is now presented inside a clean white dashboard shell with:

- a full-height left sidebar
- icon + label navigation
- a full-width route-aware page header
- page content that stays focused on workflow, not decoration

---

## Canonical Product Model

This section is the intended product model other AI tools should reason from when designing or extending the app.

### Core match experience

- Two players create or join a match.
- Scoring during the match should be fast and interruption-free.
- Final scores become official only after confirmation.
- Official results update rankings, wins, losses, and match counts across the ladder.

### Roles

The product is built around three roles:

- `Player A` - competitor
- `Player B` - competitor
- `Scorer` - optional and flexible

Rules:

- Only Player A and Player B can confirm results.
- Only Player A and Player B can affect rankings.
- The Scorer is not assigned up front.
- The Scorer can be either player or a spectator.
- The Scorer role can shift naturally during the match.

### Canonical match data shape

Official match data should be modeled with structured sets, not a plain score string.

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

Important rule:

- a stored plain `score` string should not be the source of truth
- render strings like `6-4, 7-6` should be derived from `sets`

### Confirmation and disputes

Canonical product rules:

- both players have 48 hours to confirm a result
- if neither player disputes within that window, the result auto-confirms
- if the losing player disputes before the window closes, ranking updates are frozen
- disputes are resolved manually by an admin
- each player can raise only one dispute per calendar month

### Dashboard and navigation philosophy

The dashboard is a command center, not a place where full multi-step flows happen.

It should surface:

- ongoing matches
- pending confirmations
- active disputes
- ladder standings
- direct links into deeper pages

Deeper actions happen on dedicated pages:

- challenge creation
- live scoring
- result submission
- result confirmation

### Ladder rules

- rankings update only on confirmed results
- challengers may only target opponents within three places above them
- if a lower-ranked challenger beats a higher-ranked opponent and the result confirms, the two positions swap
- wins, losses, and matches played update at the same time as ladder confirmation

---

## Current Implemented App Flow

This section describes what the codebase currently does today.

### Active routes

The current router exposes:

- `/dashboard`
- `/rankings`
- `/challenges`
- `/create-challenge`
- `/play/:matchId`
- `/matches/:matchId`

The root path `/` redirects to `/dashboard`.

Unknown routes also redirect to `/dashboard`.

### Current active shell

The live app shell currently uses:

- full-height left sidebar navigation
- full-width top page header
- white background across the whole workspace
- restrained Renaissance-inspired accents:
  - green
  - yellow
  - orange

Important UI rules now reflected in the app:

- create challenge is not a top-header action
- the page header shows the current page title and subtext
- the sidebar is the persistent primary navigation

### Dashboard

Purpose:

- overview page
- command center
- routing hub into deeper flows

Current features:

- current player summary
- create challenge entry point in the page body
- stats for players, matches, and ladder
- pending actions
- featured match
- recent challenges
- recent matches

### Rankings

Purpose:

- ladder exploration
- challenge discovery

Current features:

- current player summary
- challenge window summary
- full ranked player list
- challenge CTA only for allowed opponents

### Challenges

Purpose:

- challenge management queue

Current features:

- challenge filters
- challenge cards
- accept action
- review action
- details action

### Create Challenge

Purpose:

- dedicated setup page for creating a ladder challenge

Current features:

- current player summary
- opponent selector
- message field
- create challenge action

### Play

Purpose:

- live scoring screen for a scheduled match

Current features:

- live match summary
- local scoreboard
- point buttons for both players
- route into match details

### Match Details

Purpose:

- post-match result submission

Current features:

- match summary
- winner selection
- score input
- submit result action

---

## Current Technical Reality

These points are critical if another AI tool is working without opening the code.

### Active ladder rules in code today

- current active user is fixed at `player-15`
- challenge creation is limited to opponents within three places above the current player
- accepting a challenge creates a match
- play scoring is local UI state only
- final score submission happens on the match details page
- ranking updates happen when a challenge is reviewed

### Current data behavior

- player, challenge, and match data live in memory only and reset on reload
- auth persists to localStorage under `sheltennis-auth`
- booking persists to localStorage under `sheltennis-bookings`

### Current implementation gaps vs canonical product model

These canonical rules are not fully implemented yet:

- structured `sets` arrays are not yet the stored match source of truth
- 48-hour confirmation windows are not implemented
- dispute handling is not implemented
- auto-confirmation is not implemented
- monthly dispute limits are not implemented
- live point logs are not persisted

Treat those items as product-direction rules, not finished runtime behavior.

---

## Secondary or Non-Routed Areas

The repository still contains secondary or legacy views for:

- login
- bookings
- landing
- matches
- profile
- history

Important:

- these files exist in the repo
- they are not part of the active routed ladder shell
- a file existing does not mean it is currently active product UI

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
