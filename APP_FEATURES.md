# ShellTennis PH - Current Feature Set

## What The App Is About

ShellTennis PH is a simple tennis ladder app for real-world club play.

The app helps players:

1. See where they stand on the ladder.
2. Challenge eligible higher-ranked players.
3. Accept or decline incoming challenges.
4. Turn accepted challenges into scheduled matches.
5. Use a live scoreboard during play.
6. Submit match results.
7. Review results so ladder rankings can move.

The main idea is easy: players climb the ladder by challenging other players, playing matches, and confirming results.

---

## Active App Experience

The current live app is a dashboard-style Vue app.

It has:

- a fixed left sidebar
- navigation for Dashboard, Rankings, Challenges, Profile, and Notifications
- a top page header that changes by route
- the current player's name and initials in the header
- a notification badge in the sidebar
- toast messages for important actions
- white, green, and tennis-focused styling
- Cloudinary-hosted brand and tennis images

The app uses hash routing, so the live browser URLs appear like `/#/dashboard`.

---

## Current Active Routes

These are the routes currently exposed by the active router:

- `/dashboard`
- `/rankings`
- `/challenges`
- `/create-challenge`
- `/play/:matchId`
- `/matches/:matchId`
- `/profile`
- `/notifications`

`/` redirects to `/dashboard`.

Unknown routes also redirect to `/dashboard`.

---

## Page-By-Page Features

### Dashboard

The dashboard is the player's home screen.

It shows:

- a personalized greeting based on the time of day
- the current player's first name and rank
- a hero image section with a Start Challenge button
- cards for matches, wins, losses, and win rate
- a win streak badge when the player has more than one current win
- action counts for pending challenges, matches to play, and reviews
- a Chart.js performance chart showing weekly win rate
- chart details for wins, losses, match count, win rate, and recent form
- total match and upcoming match summary text
- a recent activity feed combining matches and challenges
- click-through behavior from recent activity to match details

### Rankings

The rankings page lets players understand the ladder and pick who to challenge.

It shows:

- the current player's position card
- current rank, wins, losses, win rate, and matches played
- the full leaderboard sorted by rank
- player search by name
- separate visual sections for challengeable players, the current player, and out-of-range players
- Challenge buttons for legal opponents
- route handoff into Create Challenge with the selected opponent prefilled
- loading, error, retry, empty, and no-search-result states

The rankings page also includes sharing tools:

- share leaderboard to WhatsApp
- share leaderboard to Facebook
- copy the leaderboard link for Instagram use
- open a share-card modal
- download a branded ranking image with the current player's rank and the top 5 players
- fallback behavior if image generation fails

### Challenges

The challenges page is the work queue for challenge activity.

It shows:

- the current player's rank summary
- a pending reply card for the next awaiting challenge
- a View action that scrolls to the challenge, highlights it, then opens details
- tabs for All, Awaiting, Scheduled, and Pending Review
- tab counts for each challenge status
- loading and empty states
- challenge cards with player names, ranks, roles, status, scorer, date, note, and match format
- rank gain hint when the challenger can move upward
- accept and decline actions for incoming awaiting challenges
- confirm result action for pending review challenges
- View details action for scheduled, pending review, and completed challenges
- a challenge details modal with matchup, rules, scorer, schedule, and note
- toast and notification messages after accept, decline, or review actions

### Create Challenge

The create challenge page is where a player configures a new challenge.

It includes:

- a "challenging as" identity card for the current player
- current player stats
- opponent picker restricted to eligible higher-ranked players
- opponent search
- matchup preview after selecting an opponent
- singles or doubles selection
- doubles partner selectors
- match length selection
- custom set target with plus and minus controls
- set rule selection for tiebreak at 6-6 or play until a 2-game lead
- deuce rule selection for normal advantage or sudden death
- final set rule selection for normal final set or super tiebreak
- optional scorer selection
- optional message to the opponent
- disabled submit state until required fields are complete
- success toast and notification after creating a challenge
- redirect back to Challenges after submission

Important implementation note:

- the form collects match configuration, teams, scorer, and note
- the current mock API stores the new challenge, scorer, and note
- the current mock API does not yet persist every challenge configuration field, such as teams and full match rules

### Play

The play page provides a live scoreboard for a match.

It includes:

- match title with challenger and defender names
- scheduled date and time display
- status text for ready, review, completed, or missing match state
- a live tennis scoreboard component
- point buttons for both players
- current game point display using Love, 15, 30, 40, Deuce, and Advantage
- set score display
- tiebreak display when a set reaches 6-6
- match winner display once the required sets are won
- disabled scoring buttons after a match winner is reached
- button to open the match details page

Important implementation note:

- live scoreboard state is local to the page
- live points and set history are not saved into match history yet
- the scoreboard currently defaults to best of 3 sets

### Match Details

The match details page is for submitting the official score after play.

It includes:

- match status
- challenger and defender names
- scheduled time text
- existing score text if available
- winner selector
- score input
- default score example of `6-4, 6-4`
- submit result button
- disabled submission if the match is not scheduled
- submitted state after a result is sent

After result submission:

- the mock API updates the match score
- the match status becomes pending review
- the related challenge also becomes pending review
- player data is reloaded

### Profile

The profile page shows the current player's ladder summary.

It includes:

- initials avatar
- player name
- rank badge
- wins
- losses
- win rate
- matches played
- total challenges
- completed challenges
- ladder standing card
- current rank details
- win/loss record
- loading state while player data loads

### Notifications

The notifications page shows app activity.

It includes:

- notification feed grouped by Today, Yesterday, and Earlier
- unread count
- unread badge in the sidebar
- mark one notification as read
- mark all as read
- dismiss one notification
- clear all notifications
- empty state when all notifications are cleared
- type styles for info, success, warning, and danger notifications
- seeded prototype notifications when the feed is empty

Notifications are also added after important actions such as creating, accepting, declining, and reviewing challenges.

---

## Current Business Logic

### Player And Ladder Rules

- the active player is fixed to `player-02`
- players are sorted by rank, with rank 1 at the top
- legal challenge targets are players ranked above the current player
- legal challenge targets must be within 3 ranking positions
- the leaderboard clearly separates challengeable players, the current player, and out-of-range players

### Challenge Rules

- new challenges start as awaiting
- accepting a challenge changes it to scheduled
- accepting a challenge creates a scheduled match
- declining a challenge removes it from the challenge list
- submitting a match result changes the match and challenge to pending review
- reviewing a challenge completes it
- reviewing a completed result updates player wins, losses, matches played, and ranking order
- if a lower-ranked challenger beats a higher-ranked defender, the challenger takes the defender's rank

### Match And Scoring Rules

- match result submission happens from Match Details
- live point scoring happens from Play
- the live scoreboard supports normal tennis point labels
- the live scoreboard supports deuce and advantage
- the live scoreboard starts a tiebreak at 6-6
- a tiebreak is won by first to 7 with a 2-point lead
- a set is won by at least 6 games with a 2-game lead, or by tiebreak
- the match is won when a player wins enough sets for the selected best-of value

---

## Data And Persistence

The app uses Pinia stores for:

- players
- challenges
- matches
- notifications
- bookings
- authentication

Current data behavior:

- player and challenge data come from an Axios mock adapter
- the mock adapter simulates backend endpoints in memory
- most ladder state resets when the app reloads
- notifications and toasts are in memory
- live scoring state is in memory
- authentication state is saved to `localStorage` under `sheltennis-auth`
- booking state is saved to `localStorage` under `sheltennis-bookings`

Current match data note:

- match result submission uses the mock API
- the match list service still contains demo-style mock match data
- the match list path should be reviewed before treating match history as production-ready

---

## Current Gaps

These items are visible in the product direction but are not fully implemented yet:

- real authentication and active-user switching
- real backend persistence
- full challenge configuration persistence
- structured sets as the stored match result source of truth
- saving live point-by-point history
- saving live scoreboard state between page reloads
- enforced 48-hour challenge response workflow
- automatic challenge expiry
- result confirmation timers
- auto-confirmation
- dispute creation and resolution
- monthly dispute limits
- exposed withdraw challenge action
- full booking flow inside the active routed dashboard shell

---

## Secondary Or Legacy Code Paths

The repo also contains other views and components that are not currently exposed by the active router.

Examples include:

- login
- landing
- booking
- history
- matches list
- court booking form
- auth composable
- booking store and service

These files still exist in the codebase, but they are not part of the current active dashboard flow unless the router is updated to expose them.

---

## Technology

The app uses:

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
- Cloudinary-hosted images
- localStorage for selected prototype state
