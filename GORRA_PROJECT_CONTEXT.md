# GORRA — Complete Application Context and Handoff

> Current implementation snapshot: 2 September 2026
>
> Repository: `C:\Users\HP\sportsproject`
>
> Branch: `main`
>
> HEAD at inspection: `d71b47f`, with intentional uncommitted implementation work on top
>
> Verification: 125/125 automated tests passing; production build passing

This is the primary handoff document for continuing work on Gorra with another coding assistant. It describes the application actually present in the repository: routes, transitions, roles, onboarding, match lifecycles, state ownership, persistence, design system, legacy surfaces, limitations, and recommended roadmap.

When this file conflicts with `README.md`, `logic.md`, `styling.md`, or older architecture/migration reports, use this file plus the current source. Older documents are historical references and several describe architecture that has since been replaced.

## 0. How to use this document

Before changing the application:

1. Read the relevant flow and ownership sections below.
2. Inspect the named source files; this is a map, not a substitute for code.
3. Check the working tree. This snapshot contains uncommitted match-architecture work that must not be reverted.
4. Preserve the invariants in section 22.
5. Run relevant tests, then the full suite/build when shared behavior changes.

Truth labels:

- **Implemented** — active routed behavior backed by current code.
- **Local prototype** — works through browser-local state, not a production multi-user feature.
- **Compatibility** — retained for older links/records; not the preferred path.
- **Historical/inactive** — present but no active flow should depend on it.
- **Not implemented** — desired behavior that does not exist yet.
- **Needs manual verification** — code/tests exist, but a real responsive browser pass remains.

## 1. Product summary

Gorra is a responsive club-tennis operations application. Current areas are:

- public landing, sign-in, and sign-up;
- dashboard, profile, history, notifications, and account settings;
- club discovery, creation/joining, membership, role-aware administration, ladders, rules, and invitations;
- Friendly setup, invitations, scheduling, live scoring, and results;
- Ladder rankings, eligibility, challenges, scheduling, live scoring, confirmation, and ranking consequences;
- Tournament creation, categories, groups, fixtures, standings, knockout, live scoring, results, schedule, and gallery;
- live operations, public scoreboard, paired TV display, and chair-umpire controls.

The accurate description today is:

> A broad, polished, local-first prototype with working domain flows, but without production identity, server authorization, a shared database, media storage, messaging, or cross-device realtime.

It can demonstrate complete flows in one browser. It is not yet a secure or authoritative production system.

## 2. Technology and runtime

### Stack

- Vue 3.5
- Vue Router 4.6
- Pinia 3.0
- Vite 5.4
- Axios 1.6 through a custom in-browser adapter, not a remote API
- `qrcode` for QR images
- Chart.js/vue-chartjs with limited/legacy use
- Node's built-in test runner via `npm test`
- GitHub Pages deployment via `npm run deploy`

Supported Node: `^20.19.0 || >=22.12.0`.

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
```

### Runtime topology

Most list/detail domains:

```text
Vue route/view
  -> Pinia store
    -> service
      -> Axios ApiService custom adapter
        -> in-memory mock database
          -> localStorage
```

Special persistence boundaries:

```text
Club views -> admin store -> AdminService -> club-directory localStorage
Friendly setup -> friendlyMatch store -> Friendly localStorage records
Canonical scoring -> useLiveMatchSession -> LiveMatchSessionRepository + tennisScoring
Tournament creation -> TournamentSetupService -> draft/template localStorage
TV/public scoreboard/umpire/operations -> projection services -> browser events + localStorage
```

There is no server transaction joining these islands. Identity, membership, scoring commands, source results, ranking changes, and Tournament changes are not one atomic operation.

## 3. Repository map and ownership

```text
src/
  assets/                 global and feature CSS
  components/             reusable and feature UI
    match/                canonical live, result, scoreboard, umpire UI
    tournament/           Tournament UI and creation steps
    challenges/           Challenge state/onboarding UI
  composables/             live-session and Tournament orchestration
  config/                  branding, demo player, Ladder/admin config
  data/                    local fixtures
  domain/                  source-neutral contracts and rule adapters
  layouts/                 authenticated application shell
  router/                  routes and guards
  services/                mock API, repositories, browser projections
  stores/                  Pinia domain state
  utils/                   pure domain/format/scoring helpers
  views/                   routed screens and flow hosts
test/                      Node test-runner coverage
docs/                      focused implementation/design reports
```

Ownership rules:

- `src/utils/tennisScoring.js` is the sole point-by-point tennis engine.
- `src/domain/matchRules.js` owns the canonical immutable rules contract.
- `src/domain/liveMatchSession.js` owns the live-session contract/commands.
- `src/composables/useLiveMatchSession.js` orchestrates live state and permissions.
- `src/services/LiveMatchSessionRepository.js` persists canonical local sessions.
- Source adapters translate Friendly/Ladder/Tournament config into canonical rules.
- Source stores/services own setup and consequences, not a second scoring engine.
- `src/components/match/LiveMatchControl.vue` is the shared scorer.
- `src/components/match/CompletedMatchResult.vue` is the shared white result UI.

## 4. Shell and primary navigation

`src/layouts/DefaultLayout.vue` owns the signed-in shell: desktop dark sidebar, responsive/mobile navigation, active-club/account context, route outlet, and notification/navigation affordances.

Primary navigation:

```text
Home -> Dashboard
Play -> Friendly/Ladder setup and relevant matches
Compete -> Rankings, Challenges, Tournaments
Club -> active club and club directory
Profile/Notifications/Account Settings -> personal surfaces
```

Actions are further limited by authentication, active membership, and permissions. Landing, auth, TV display, guest umpire, and public control routes can operate outside the authenticated shell as their views require.

## 5. Identity, data mode, and authorization

### Simulated authentication

`src/stores/auth.js` stores a simulated session in `sheltennis-auth`. Login validates no real credentials. The tester enters as player, club admin, or super admin. `APP_CURRENT_PLAYER` in `src/config/currentPlayer.js` can force a deterministic demo player. Some ShellTennis naming remains as legacy debt.

### Global roles

`src/utils/auth/accessControl.js` provides defaults:

- `player` — member Tournament/match/ranking access and challenge creation;
- `tournament_admin` — Tournament management, fixture, score, knockout, image, and live-score permissions;
- `club_admin` — club management plus Tournament/match administration;
- `super_admin` — wildcard permission.

The local demo player `player-02` is configured as super admin.

### Club membership roles

Club authority comes from `AdminService.js`/the `admin` store, not only global auth:

- `admin`
- `co-admin`
- `player`

Only active memberships count. Active admin/co-admin members receive club management, Tournament management/scoring/fixture/knockout/image, and `matches.live_score` permissions. Active players receive the allowed member/view capabilities.

Routes with `activeClubPermission: true` check `adminStore.hasActiveClubPermission`; plain `permission` routes check `authStore.hasPermission`. New club operations should use active-club membership authority.

### Live-match authority

The live system separates:

- **Owner** — match/session owner.
- **Manager** — active club admin/co-admin with source permission.
- **Scorer** — actor currently holding Match Control.

Friendly/Ladder managers require `matches.live_score`; Tournament managers require `tournaments.score.update`. Managers can see umpire/display/handoff operations, but explicitly take Match Control before scoring. Owners and source-authorized managers can manage an existing umpire assignment.

All authorization is client-side and insecure for production. Server enforcement is required.

## 6. Club selection and onboarding

Entry points:

- `/clubs` — directory;
- `/clubs?view=create` — create;
- `/clubs?view=join` — join;
- `/onboarding/join-club` — redirects to Clubs join, preserving invite query;
- `/admin/setup` — manager setup/resume, requiring `club.manage`.

`ClubsView.vue` now creates and joins real browser-local club relationships through the admin store. Older claims that member joining is visual-only are stale.

Administrative setup has five configured steps:

1. Workspace — establish club identity/workspace.
2. Members — add/import roster and roles.
3. Ladders — define Ladder structure.
4. Placement — establish initial rankings.
5. Rules — configure Ladder/competition rules.

A setup is configured only when membership is active and `completedStep === 5`. For authenticated routes the router loads active club state. A user with `club.manage` and incomplete setup is forced to `/admin/setup` at start or saved resume step.

Joining calls `adminStore.joinClub(...)`, stores membership in the local club directory, and can activate the club. There is no backend invite validation, approval queue, delivery, or cross-device persistence.

The admin store owns clubs, memberships, active club ID, setup state, create/join/switch/update, invite rotation, and setup discard. Club-scoped views must resolve active club/membership rather than assume the first club or global role.

## 7. Complete active route map

### Public and authentication

| Path | Route | Purpose |
|---|---|---|
| `/` | `Home` | Current landing page |
| `/signin` (`/login`) | `SignIn` | Simulated sign-in |
| `/signup` | `SignUp` | Simulated sign-up |
| `/landing-legacy` (`/old-landing`) | `LegacyLanding` | Previous landing |

### Main authenticated product

| Path | Route | Purpose |
|---|---|---|
| `/dashboard` | `Dashboard` | Home priorities, Ladder snapshot, activity |
| `/home` | — | Redirect to Dashboard |
| `/play` | `Play` | Match entry hub/cards |
| `/compete` | — | Redirect to Rankings |
| `/rankings` | `Rankings` | Active club Ladder |
| `/tournaments` | `Tournaments` | Tournament list/hub |
| `/notifications` | `Notifications` | Local notifications |
| `/profile` | `Profile` | Current player profile |
| `/history` | `History` | Match/history view |
| `/account/settings` | `AccountSettings` | Personal settings |

### Club

| Path | Route | Guard/purpose |
|---|---|---|
| `/onboarding/join-club` | `PlayerClubJoin` | Redirect into Clubs join |
| `/admin/setup` | `AdminSetup` | Global `club.manage`; setup mode |
| `/clubs` | `Clubs` | Directory/add/create/join/switch |
| `/club` | `Club` | Active club home |
| `/settings` (`/club/settings`) | `Settings` | Active-club `club.manage` |

### Tournament

| Path | Route | Purpose |
|---|---|---|
| `/tournaments/create` | `TournamentCreate` | Active-club `tournaments.manage` |
| `/tournaments/:tournamentId` | `TournamentOverview` | Overview/operations |
| `/tournaments/:tournamentId/category/:categoryId` | `TournamentCategory` | Groups, standings, bracket, matches |
| `/tournaments/:tournamentId/schedule` | `TournamentSchedule` | Schedule |
| `/tournaments/:tournamentId/gallery` | `TournamentGallery` | Gallery |
| `/tournaments/:tournamentId/match/:matchId` | `TournamentMatchDetails` | Match detail/operations |

### Friendly and Ladder setup

These paths are hosted by `FriendlyMatchFlowView.vue`. Ladder aliases reuse setup screens with Ladder-specific rules/eligibility.

| Friendly path | Ladder alias | Step |
|---|---|---|
| `/friendly-match/type` | `/ladder-match/type` | Source/type |
| `/friendly-match/timing` | `/ladder-match/timing` | Now/scheduled |
| `/friendly-match/join` | `/ladder-match/join` | Joining method |
| `/friendly-match/club-opponent` | `/ladder-match/opponent` | Club/eligible opponent |
| `/friendly-match/schedule` | `/ladder-match/schedule` | Schedule |
| `/friendly-match/opponent` | — | Friendly opponent entry |
| `/friendly-match/scoring` | `/ladder-match/scoring` | Scoring selection |
| `/friendly-match/format` | `/ladder-match/format` | Format |
| `/friendly-match/custom-format` | — | Custom Friendly format |
| `/friendly-match/scheduled` | `/ladder-match/sent` | Confirmation/invite sent |
| `/friendly-match/join/:token` | `/ladder-match/join/:token` | Invitation join |

### Live, result, and details

| Path | Route | Status |
|---|---|---|
| `/friendly-match/live/:matchId` | `FriendlyMatchLive` | Canonical session/engine/UI, Friendly route host |
| `/matches/:matchId/live` | `LiveMatch` | Canonical Ladder/Tournament live route |
| `/ladder-match/live/:matchId` | `LegacyLadderLive` | Compatibility alias to canonical view |
| `/friendly-match/result/:resultId` | `FriendlyMatchResult` | Friendly persisted result |
| `/matches/:matchId` | `MatchDetails` | Source match detail/actions |
| `/play/:matchId` | `PlayMatch` | Old scorer compatibility route |

`/play/:matchId` is not a target for new work. Its guard loads the match and redirects Ladder/Tournament to `LiveMatch`; unavailable/unsupported records go to Match Details or Dashboard fallbacks. `PlayView.vue` and `TennisScoreboard.vue` remain compatibility/history only.

### Live operations and displays

| Path | Route | Access/purpose |
|---|---|---|
| `/operations/live` | `LiveOperations` | Active-club live-score managers |
| `/operations/live/:matchId` | `LiveOperationDetail` | One live operation |
| `/live-scoreboard/:matchId` | `LiveScoreboard` | Scoreboard projection |
| `/display` | `TvDisplayPairing` | Public TV pairing |
| `/display/live` | `TvDisplayLive` | Public paired display |
| `/match-umpire/invite/:token` | `ChairUmpireInvite` | Authenticated member invite |
| `/match-umpire/guest/:token` | `ChairUmpireGuestInvite` | Public guest invite |
| `/match-umpire/control/:matchId?` | `ChairUmpireMatchControl` | Public shell; view validates capability/session |

### Challenges

| Path | Route | Purpose |
|---|---|---|
| `/create-challenge` | `CreateChallenge` | Active-club `challenges.create` |
| `/challenges` | `Challenges` | Queue, filters, review/actions |
| `/challenges/:challengeId` | `ChallengeDetails` | State-specific lifecycle |

Unknown paths redirect to Dashboard.

## 8. Global navigation and guards

```text
Request route
  -> public?
       no + unauthenticated -> Sign In with redirect query
  -> load active club when needed
  -> manager onboarding incomplete?
       yes -> Admin Setup start/resume
  -> legacy /play/:matchId?
       yes -> load and redirect to canonical live/detail
  -> active-club permission required?
       yes -> check active membership
  -> otherwise global permission required?
       yes -> check auth role
  -> render; set title; scroll to top
```

After sign-in, an invite query goes to Clubs join with the invite preserved. Otherwise a safe internal redirect is honored; without one, the destination is Dashboard.

## 9. Dashboard and home-priority flow

Dashboard combines current player, active Ladder snapshot, activity, and a priority slot. Priority utilities choose a live match, ready match, result awaiting review, or normal club state.

```text
Dashboard -> Open ladder -> Rankings
Priority -> ready/live match -> Match Details or canonical live
Priority -> result review -> Challenge review
Activity/opportunity -> relevant Club, Challenge, or Tournament route
```

Dashboard data remains local/demo data and should eventually come from account/club-scoped backend read models.

## 10. Play and Friendly flow

`/play` is the entry hub. Starting Friendly calls `friendlyMatchStore.beginMatch()`, selects `friendly`, and enters Friendly scoring/setup. Starting Ladder selects `ladder` and enters `/ladder-match/opponent`. Relevant Ladder match cards resolve status and go to canonical Live Match when start/resume is allowed; otherwise to Match Details.

Conceptual Friendly flow:

```text
Play -> Friendly
  -> choose timing/join approach
  -> choose or enter opponent
  -> choose scoring and format
       -> optional custom format
  -> scheduled/invited: confirmation + join-token flow
  -> ready now: create/freeze match record
  -> /friendly-match/live/:matchId
```

Friendly setup stays specific because it owns informal opponent entry, invitations, timing, and optional custom formats.

Friendly live is hosted by `FriendlyMatchFlowView.vue` but uses canonical `LiveMatchSession`, `tennisScoring`, and `LiveMatchControl`.

```text
canonical engine finishes
  -> Friendly handler stores immutable result
  -> /friendly-match/result/:resultId
  -> shared white CompletedMatchResult
```

Friendly results do not affect Ladder rank or Tournament standings.

## 11. Ladder, Rankings, and Challenges

`/rankings` shows the active club Ladder. Opponent eligibility and challenge windows derive from Ladder configuration/current ranking.

Challenge creation:

```text
Rankings or Challenges
  -> /create-challenge
  -> verify active-club permission and Ladder access
  -> choose eligible opponent within rank window
  -> optionally propose time, court, message
  -> freeze Ladder-derived rules/config
  -> create challenge
  -> /challenges/:challengeId
```

Players do not freely redefine Ladder scoring rules during challenge creation.

Lifecycle:

```text
awaiting -> accepted_unscheduled -> scheduled -> ready -> live
  -> pending_review -> completed
```

Declined, withdrawn/cancelled, and expired are terminal alternatives where supported. A scheduled challenge resolves as ready within 30 minutes of the scheduled time. Defender accepts/declines; appropriate participants can agree a schedule; start/resume opens `/matches/:matchId/live`; the scorer submits the physical result; the other eligible participant reviews it; confirmation applies the local ranking consequence.

The list filters all/awaiting/scheduled/pending review and exposes state actions. Match Details and Challenge Details link when records relate.

Ladder completion:

```text
Challenge/Play/Match Details
  -> explicit start/resume
  -> /matches/:matchId/live
  -> shared session + LiveMatchControl
  -> shared white CompletedMatchResult
  -> Submit result for confirmation
  -> matchStore.submitResult(...)
  -> pending_review -> opponent review
  -> completed + local ranking consequence
```

The physical score and Ladder business confirmation are intentionally separate.

## 12. Tournament flow

Tournament creation at `/tournaments/create` has four query-addressable stages:

1. `details` — name, dates, registration/sign-up;
2. `where` — venue, courts, hours, day overrides;
3. `events` — built-in/custom categories, format, seeding/draw setup;
4. `review` — validation and publish.

`TournamentSetupService` owns browser-local drafts/templates. Publishing builds a payload through the Tournament store/service.

Operations:

```text
Tournament list -> Overview
  -> Category -> group assignment/fixtures -> standings
              -> close group stage -> generate/progress knockout -> champion
  -> Schedule
  -> Gallery
  -> Match details/live
```

New fixtures freeze canonical rules. Built-in mappings:

- `best3` — first to two sets, Advantage, first-to-six win-by-two, seven-point tiebreak, normal deciding set;
- `matchtb` — same opening sets, ten-point deciding match tiebreak;
- `oneset` — one set to win.

Live consequence flow:

```text
Tournament action
  -> verify active-club tournaments.score.update
  -> explicit startOrResumeMatch(...)
  -> /matches/:matchId/live
  -> shared session + LiveMatchControl
  -> shared white CompletedMatchResult
  -> Record tournament result
  -> normalized result -> tournamentStore.enterMatchResult(...)
  -> standings/bracket/progression
```

Direct live URL entry is resume-only. Stable result IDs make consequence handling idempotent. Manual result entry and walkover remain separate operations. Retirement and persisted per-fixture official assignment are not implemented.

## 13. Canonical match/live architecture

Setup differs by source; the physical match converges:

```text
Friendly setup ----\
Ladder challenge ---+--> canonical MatchRulesSnapshot
Tournament fixture-/          |
                              v
                    canonical LiveMatchSession
                              |
                    one tennisScoring engine
                              |
                    shared LiveMatchControl
                              |
                    shared CompletedMatchResult
                              |
                    source-specific consequence
```

`src/domain/matchRules.js` defines schema-v1 `MatchRulesSnapshot`. Adapters are `friendlyMatchRules.js`, `ladderMatchRules.js`, and `tournamentMatchRules.js`. The snapshot freezes when live play starts; later configuration changes cannot mutate that match.

`src/domain/match.js` defines sources `friendly`, `ladder`, `tournament` and lifecycle vocabulary: draft, pending, awaiting, accepted, scheduled, ready, live, pending_review, completed, cancelled. Not every source uses every status.

`src/domain/liveMatchSession.js` defines live states ready, live, suspended, completing, completed and commands:

- `record_point`
- `undo_last_point`
- `set_server`
- `assign_scorer`
- `finish_physical_match`

A session includes match/source, frozen rules, engine state, timestamps, scorer authority, score/authority revisions, stable result ID, and recent command IDs.

`LiveMatchControl.vue` contains the shared scoreboard, point controls, undo, server state, timer/activity, projection/feed affordances, management/umpire/display controls, handoff, and finish transition. `CompletedMatchResult.vue` is the canonical white result. The old green/dark `components/friendly/MatchResultModal.vue` is no longer mounted by the live host.

The remaining host split is orchestration only: Friendly lives inside `FriendlyMatchFlowView.vue`; Ladder/Tournament use `LiveMatchView.vue`. The clean destination is one source-neutral live controller/view with small source adapters. Do not add generic live behavior only to Friendly's host.

## 14. Live projection, operations, TV, and umpire

The scorer publishes a normalized read projection consumed by `/live-scoreboard/:matchId` and display views. A projection is never a second score authority.

Operations flow:

```text
/operations/live -> choose match -> /operations/live/:matchId
  -> inspect live/heartbeat/authority state and manager actions
```

TV flow:

```text
Display opens /display
  -> pairing code/QR
  -> manager/scorer pairs display
  -> /display/live reads selected match projection
```

Chair-umpire flow supports club-member and guest invitation links, acceptance/capability validation, control route, manager assignment/removal, and control handoff. The public route is not authority by itself; its view validates token/session/capability.

Synchronization is only between tabs/windows sharing browser storage, using `BroadcastChannel`, storage/custom events, and heartbeats. It is not cross-device realtime. Production needs authenticated server commands plus WebSocket/SSE or equivalent subscriptions.

## 15. Stores, services, and ownership

### Pinia stores

- `auth` — simulated session/global permissions.
- `admin` — clubs, memberships, active club, setup, club permissions.
- `player` — current player/list/ranking data.
- `challenge` — lists, filters, lifecycle mutations.
- `match` — Ladder/general matches and result submission.
- `friendlyMatch` — Friendly draft, invitation/live/result coordination.
- `tournament` — tournaments, categories, fixtures, results, progression.
- `tournamentGallery` — Tournament gallery coordination.
- `notification` — local notification read model.
- `booking` — court-booking prototype.
- `counter` — scaffold/example, not product architecture.

### Key services

- `ApiService.js` — Axios client plus mock adapter/database.
- `AdminService.js` — local club directory/relationships.
- `ChallengeService.js` — Challenge API wrapper.
- `MatchService.js` — match records/API wrapper.
- `LiveMatchService.js` — source-neutral live start/resume coordination.
- `LiveMatchSessionRepository.js` — session persistence/command revisions.
- `LadderLiveMatchService.js` — Ladder adaptation/compatibility.
- `TournamentService.js` — Tournament API wrapper.
- `TournamentSetupService.js` — creation drafts/templates.
- `TournamentImageService.js` — local gallery operations.
- `chairUmpireService.js` — local invitations/capabilities.
- `liveMatchRealtime.js` — browser event transport.
- `liveOperationsRegistry.js` — operations projection.
- `tvPairingService.js` — display pairing/session.
- `BookingService.js` — fake booking persistence/promises.

## 16. Browser persistence inventory

| Domain | Key/prefix |
|---|---|
| Auth | `sheltennis-auth` |
| Data mode | `gorra.appDataMode.v1` |
| Club directory | `gorra.admin.clubDirectory.v2` |
| Legacy club setup mirror | `gorra.admin.clubSetup.v1` |
| Ladder mock | `tennis.mock.ladderState.v2` |
| Tournament mock | `tennis.mock.tournamentState.v2` |
| Friendly results | `gorra.friendlyMatchResults.v2` |
| Friendly draft | `gorra.friendlyMatchDraft.v5` |
| Friendly live record | `gorra.friendlyMatchLive.v1.<matchId>` |
| Friendly invitations | `gorra.friendlyMatchInvitations.v2` |
| Friendly custom formats | `gorra.friendlyMatchCustomFormats.v1` |
| Canonical live session | `gorra.liveMatchSession.v1.<matchId>` |
| Public scoreboard | `gorra.liveScoreboardSnapshot.v1.*` |
| Scoreboard heartbeat | `gorra.liveScoreboardHeartbeat.v1.*` |
| Live operations | `gorra.liveOperations.v1.*` |
| Chair umpire | `gorra.chairUmpireInvitations.v1` plus tab session |
| TV pairing | `gorra.tvPairingSessions.v1` |
| TV display | `gorra.tvDisplaySessions.v1` |
| Tournament setup | `gorra.tournamentSetupWorkspace.v1` |
| Notifications | `tennis.local.notifications.v1`, mode-scoped |
| Event signatures | `tennis.local.matchEventSignatures.v1`, mode-scoped |
| Player role overrides | `tennis.local.playerRoles.v1` |
| Bookings | `sheltennis-bookings` |

Storage is implementation data, not a public API. Schema changes need version/migration plans and tests. Never clear all localStorage as a migration strategy.

## 17. Current design system

`src/assets/main.css` is the global starting point. Current language:

- white surfaces and `#f7f8fa` muted background;
- dark `#0b0d0c` sidebar;
- `#00b51a` primary green and `#008f15` strong green;
- `#ffd33d` yellow and `#ff7f32` clay accents;
- text near `#162218`, border near `#e7ece8`;
- restrained shadows/hairline borders;
- compact 7–10px radii;
- 44px minimum control height;
- focused flow width around 920px;
- visible focus and reduced-motion handling;
- responsive layout and route skeletons.

Global body font:

```css
Inter, 'Avenir Next', 'Segoe UI', sans-serif
```

Weights are 400/500/600/700. Headline hierarchy is approximately responsive 28–40px page title, 20px section, 16px card, 14px row, 11px metadata.

Typography is not fully unified: global CSS prefers Inter/Avenir/Segoe UI; shell/history references Poppins; Tournament CSS explicitly applies DM Sans/Poppins in places, including local `!important`. The customization/setup interface inherits its surface CSS; it is not evidence of an intentional separate brand font.

Shared primitives include `BaseButton`, `BaseInput`, `AppLogo`, `PersonAvatar`, `EmptyState`, `RoutePageSkeleton`, and `ToastShelf`. Many views still define local cards, buttons, dialogs, badges, spacing, and type. Gorra has tokens/patterns, not yet a complete component system.

The correct current match-result visual is the white `CompletedMatchResult.vue` across Friendly/Ladder/Tournament. The old green/dark modal is previous UI.

References:

- `docs/GORRA_APPLICATION_TYPOGRAPHY.md` — audit/guidance; verify against CSS.
- `docs/GORRA_UI_PSYCHOLOGY_AND_MOTION_SYSTEM.md` — motion/interaction principles.
- `styling.md` — historical ShellTennis context.
- `src/assets/tournament.css` and `tournament-creation.css` — feature overrides.

## 18. Introducing a new design system safely

Redesign the visual layer incrementally without changing domain contracts, routes, permissions, or state transitions.

1. Define product tone, density, accessibility, responsive behavior, and retained brand elements.
2. Audit specialist surfaces: numeric scoring, dark sidebar, setup wizards, TV display, brackets, Tournament hero, landing.
3. Create semantic versioned tokens for color, type, spacing, radii, border, elevation, motion, z-index, breakpoint, and focus.
4. Consolidate to one approved app font, with a separate numeric treatment only if scoring needs it.
5. Build primitives: controls, cards, badges, tabs, dialog/drawer, toast, loading/empty/error, headers, flow shell, tables/rows, navigation.
6. Migrate shell first.
7. Migrate canonical Live Match next so all match sources gain consistency.
8. Migrate Club/onboarding, Compete/Challenges, Tournament, then account/secondary screens.
9. Remove local overrides only after each affected surface moves.
10. Add visual regression for desktop/mobile, motion, keyboard focus, loading/empty/error, restricted permissions, and long content.

```text
Design tokens/components may change presentation.
They must not reimplement rules, lifecycle, or authorization.
```

## 19. Status by maturity

### Implemented

- responsive routed shell and simulated role entry;
- route guards and local active-club permissions;
- multi-club create/join/switch and five-step setup/resume;
- Ladder eligibility, Challenges, review, and ranking consequences;
- canonical rule adapters for all three match sources;
- one tennis engine/session foundation/shared scorer/shared white result;
- scorer authority, admin Match Control, revisions, stable result IDs;
- local public scoreboard, operations, TV pairing, and umpire flows;
- Tournament creation, groups, standings, knockout, schedule, gallery;
- local notifications/history/profile;
- automated domain/integration/layout coverage.

### Functional but local prototype only

- auth and authorization enforcement;
- membership/invites and mock API/database;
- notifications and Friendly join links;
- Challenge/live synchronization;
- public scoreboard, TV, umpire, gallery/media records;
- all cross-tab realtime.

### Missing/incomplete

- real accounts/session security/recovery;
- backend database and tenant isolation;
- server permissions/capabilities;
- cross-device realtime and reconciliation;
- atomic completion plus source consequences;
- production invite delivery and reminder/expiry jobs;
- server conflict-safe scoring/audit log;
- production upload/storage/CDN;
- Tournament retirement and persisted fixture officials;
- complete design component system;
- full visual acceptance of latest Tournament live migration;
- systematic code splitting.

## 20. Known risks and debt

1. Client permissions are not security.
2. Storage islands can drift; mutations are not transactional.
3. Friendly still has a different route host despite shared live internals.
4. `PlayView`, `TennisScoreboard`, and `MatchResultModal` can confuse contributors.
5. Live deep links require strict resume-not-create semantics.
6. Cross-tab behavior can be mistaken for cross-device realtime.
7. Global, landing, Tournament, creation, and scoped CSS overlap.
8. Inter/Avenir/Segoe UI, Poppins, and DM Sans are inconsistent.
9. Vite reports a >500 kB JS chunk and mixed imports for services.
10. ShellTennis strings and `tennis.*` keys remain.
11. Local command IDs/revisions are not production concurrency control.
12. Automated tests do not replace responsive live/TV/umpire visual QA.

## 21. Recommended roadmap

### A. Finish canonical live boundary

- Extract generic orchestration from `FriendlyMatchFlowView` into a source-neutral live controller.
- Move Friendly to `/matches/:matchId/live` or make its route a thin alias.
- Keep small load/start and consequence adapters only.
- Verify identical controls, authority, white result, projections, and accessibility.
- Retire old scorer/modal only after route/import/persisted-link tests prove them unused.

### B. Strengthen lifecycle correctness

- Make every start/resume/result transition explicitly idempotent.
- Version/migrate all persisted match/Tournament schemas.
- Test refresh, duplicate command, two-tab takeover, stale revision, permission rejection, direct URL, and completed re-entry.
- Complete scheduled Friendly and approved Challenge expiry/reminder/dispute behavior.
- Add Tournament retirement/official models if product-approved.

### C. Production backend

- Add real accounts, sessions, clubs/organizations, memberships, tenant scope.
- Enforce roles/capabilities server-side.
- Store commands with optimistic concurrency, command IDs, revisions, audit log.
- Use transactions/outbox/idempotent consumers for completion consequences.
- Add WebSocket/SSE projections with reconnect/snapshot recovery.
- Replace local tokens with signed, expiring, revocable capabilities.
- Add notification delivery and media storage.

### D. Design-system consolidation

- Follow section 18 while preserving behavior.
- Establish tokens/component catalogue and one typography system.
- Remove local `!important` rules during migration.
- Add visual/responsive/keyboard/screen-reader/contrast/motion coverage.

### E. Performance/delivery

- Route-split Tournament, operations/display, and legacy surfaces.
- Resolve mixed service imports.
- Add CI for tests, build, formatting, and browser smoke tests.
- Define configuration, observability, backups, and rollback.

## 22. Do-not-regress invariants

1. Friendly, Ladder, and Tournament use one tennis engine.
2. Every live match uses an immutable canonical rules snapshot.
3. Points/games/sets/server/undo belong to shared match domain/UI.
4. Eligibility, Challenges, rankings, standings, brackets, and confirmation stay source-specific.
5. Start is explicit/authorized; a live deep link resumes and does not silently create.
6. Owner, manager, and active scorer are separate.
7. An authorized admin can recover/manage but takes Match Control before scoring.
8. Only the active scorer mutates score commands.
9. Completion and source consequence handlers are idempotent.
10. White `CompletedMatchResult.vue` is canonical, not the old green/dark modal.
11. Public/TV/operations/umpire surfaces consume projections, not score authority.
12. Active-club permissions govern club-scoped actions.
13. Styling must not duplicate domain logic or source-specific scorers.
14. Never discard existing user/uncommitted changes with reset/checkout/broad rewrites.

## 23. Verification state

At this snapshot:

- `npm test`: **125/125 passing**.
- `npm run build`: passing.
- `git diff --check`: passed before this documentation rewrite.
- Build warnings: mixed static/dynamic imports and a large JavaScript chunk; not failures.
- Latest Tournament canonical-live responsive UI needs a manual browser pass because the prior browser run was blocked by Windows ACL behavior.

Tests cover match rules/format editor/scoring/live session, canonical Ladder/Tournament live integration, Challenge lifecycle/integration, club create/join/relationships/navigation/competition, Ladder admin, Tournament creation/security, and shell layout.

## 24. Historical and compatibility guidance

- `logic.md`, `styling.md` — historical broad ShellTennis context.
- `docs/LIVE_MATCH_ARCHITECTURE_MIGRATION_REPORT.md` — documents the former split; two active scoring stacks is no longer current.
- `TOURNAMENT_CANONICAL_LIVE_MIGRATION_REPORT.md` — focused latest migration record.
- `GORRA_PLATFORM_INVENTORY.md`, `ARCHITECTURE.md`, `APP_FEATURES.md` — supporting docs that can lag this one.
- `DashboardView.legacy.vue`, `LandingView.legacy-2026-08.vue` — explicit legacy views.
- `MemberOnboardingView.vue`, `PlayerClubJoinView.vue`, `CreateChallengeView.vue`, and compete alternatives — verify router before treating as active.
- `PlayView.vue`, `TennisScoreboard.vue`, `components/friendly/MatchResultModal.vue` — compatibility/history, not canonical live.

Do not delete compatibility files only because they are labelled legacy. Prove there are no routes, imports, persisted links, or tests depending on them.

## 25. Copy/paste continuation prompt

```text
You are helping me continue the Gorra Vue app in C:\Users\HP\sportsproject.
Read GORRA_PROJECT_CONTEXT.md completely before proposing or making changes. It is the current architecture handoff, but verify the named source files because code is final authority.

The working tree may contain intentional uncommitted canonical live-match work. Do not reset, revert, broadly replace files, or clean unrelated changes. Friendly, Ladder, and Tournament share MatchRulesSnapshot, LiveMatchSession, tennisScoring, LiveMatchControl, and the white CompletedMatchResult. Setup and post-match consequences stay source-specific. Active-club membership controls club-scoped permissions, and an admin explicitly takes Match Control before recording points.

For the next request, identify the affected flow, route, store/service, domain contract, and UI component. Keep changes inside scope. Run relevant tests, the full suite for shared architecture, npm run build, and git diff --check. Report browser-local limitations and unverified visuals honestly.
```

## 26. Immediate continuation checklist

1. Run `git status -sb`; preserve all modifications.
2. Read this file and the exact relevant source.
3. Classify work as setup, shared live domain/UI, or source consequence.
4. Verify active route names instead of trusting old screenshots/docs.
5. Reuse canonical rules/session/scoring/result.
6. Apply active-membership permissions for club scope.
7. Distinguish browser-local from production-ready claims.
8. Test the requested path and affected sibling sources.
9. Update this file when architecture, routes, roles, onboarding, or design ownership changes.

This file is the current roadmap and handoff, not a claim that roadmap items are already implemented.
