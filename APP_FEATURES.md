# ShellTennis PH — Application Features

## Overview

This Vue 3 / Vite app is a tennis court booking and match management dashboard for a single Port Harcourt team court. It includes user login, court booking, match creation/joining, live scoring, dashboards, and history views.

## Main Pages

- **Landing**
  - Hero section with app branding, call-to-action buttons, and a scoreboard preview.
  - Feature summary blocks describing court booking, partner/match finder, and live scoring.
  - Links to login and match browsing.

- **Dashboard**
  - Shows the next scheduled court booking.
  - Lists upcoming matches with status and formatted time.
  - Includes a manual refresh button for booking and match data.

- **Book Court**
  - Displays a court booking form using the `CourtBookingForm` component.
  - Loads available daily slots for a chosen date.
  - Creates new bookings with player name, date, start hour, duration and description.
  - Shows upcoming bookings sorted by date.
  - Prevents overlapping bookings for the single court.

- **Matches**
  - Shows live matches and upcoming match invitations.
  - Lets users create a new match with title, type, level, datetime, number of players, court, and description.
  - Lets users join an existing match.
  - Automatically routes to live scoreboard when a joined match becomes live.

- **Login**
  - Accepts username and password.
  - Uses fake authentication to create a Shell user object and store auth state locally.
  - Redirects to the dashboard after successful login.

- **Profile**
  - Displays current user name, email, and active access status from auth state.

- **History**
  - Shows booking history sorted by most recent creation.
  - Shows completed matches and their final set summary.

- **Play**
  - Displays a live tennis scoreboard for a match.
  - Allows recording points for player A or player B.
  - Updates tennis scoring in real time, including deuce, advantage, tie-breaks, and set/match completion.

## Navigation

- Top navbar links:
  - Home (`/`)
  - Dashboard (`/dashboard`)
  - Book Court (`/book`)
  - Matches (`/matches`)
- Additional routes exist in the router but are not in the main navbar:
  - Login (`/login`)
  - History (`/history`)
  - Profile (`/profile`)
  - Play (`/play/:matchId`)

## Data and Persistence

- Stores auth, bookings, and matches in `localStorage`.
- Loads sample booking and match data on first app use.
- Uses fake async requests to simulate server calls.
- Match and booking updates persist across page refreshes.

## Booking Behavior

- Booking slots are generated between 06:00 and 20:00.
- Slot durations supported: 1 hour and 2 hours.
- Overlap detection prevents double-booking the same court time.
- Bookings include date, start hour, duration, player name, description, and creation timestamp.

## Match Behavior

- Matches can be created as singles or doubles.
- Match creation includes title, level, start time, maximum players, court, and host name.
- Joining a match adds the player to the match roster.
- When a match reaches its maximum player count, it becomes live.
- Live matches can be opened in the `Play` view for scoring.

## Live Scoring Rules

- Uses tennis scoring logic from `src/utils/tennisScoring.js`.
- Supports:
  - Standard points: Love, 15, 30, 40.
  - Deuce and advantage.
  - Tie-break initiation at 6–6 in a set.
  - Best-of-sets scoring and match winner detection.
- Scoreboard persists as part of the match state.

## Technology Stack

- Vue 3 (`vue` beta)
- Vite
- Pinia for state management
- Vue Router for navigation
- LocalStorage for persistence
- Simple service layer in `src/services/`

## Components Used

- `NavBar.vue` — app navigation, auth button, active link highlighting.
- `CourtBookingForm.vue` — booking form UI.
- `MatchCard.vue` — match summary cards with join actions.
- `TennisScoreboard.vue` — visual score display and point controls.

## Notes

- The app is currently built around a single fixed court.
- It is a frontend-only app with simulated backend behavior.
- Data is handled locally, so refreshes keep state via browser storage.
