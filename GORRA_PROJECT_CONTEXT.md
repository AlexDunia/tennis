# GORRA Project Context

This is an implementation-level handoff for the Gorra repository. It describes what the checked-in application actually does, including the local prototype data layer, active and inactive code paths, gaps, and the development boundary at the time of inspection.

Snapshot used for this handoff:

- Repository root: **C:/Users/HP/sportsproject**
- Branch: **main**
- Baseline commit before this document: **b7fb942** — “Gorra milestone before Codex handoff” (2026-08-18)
- Baseline was clean and matched **origin/main**
- Existing test suite: **25/25 passing**
- Production build: **passing**, with a large single-chunk warning

This document should be treated as more current than the generic **README.md** and the older architecture/feature handoffs. It is based on the routed source and service/store implementations, not on product claims in documentation.

## 1. What Gorra Is Today

Gorra is a responsive club-tennis management single-page application built with Vue 3. It covers:

- member Home, Play, Compete, and Club experiences;
- club creation, local multi-club membership, role-aware management, invites, members, ladders, and rules;
- a club ladder with eligibility rules, challenges, scheduling, result review, and ranking movement;
- friendly and ladder match creation, QR/invite-style local joining, and live point-by-point scoring;
- tournament discovery, category/group/fixture/standings/knockout operation, score entry, scheduling, live scoring, and gallery management;
- a newly rebuilt tournament creation flow which publishes a registration-stage tournament plan.

It is not yet a production multi-user system. Authentication is simulated, the main “API” is an Axios instance wired permanently to an in-browser mock adapter, and nearly all durable state is browser localStorage. Invite links, shared matches, notifications, and “live refresh” do not synchronize across devices.

The most accurate mental model is:

> A polished, broad, local-first product prototype with several end-to-end domain workflows, but without a real identity, database, server authorization, upload, messaging, or realtime backend.

## 2. Technology and Runtime Architecture

### Stack

- Vue **3.5**
- Vue Router **4.6**
- Pinia **3.0**
- Vite **5.4**
- Axios **1.6**, but only through the custom local adapter in **src/services/ApiService.js**
- qrcode for generated invitation QR images
- Chart.js / vue-chartjs, currently used only by an inactive legacy dashboard component
- Node’s built-in test runner, not Vitest/Jest
- GitHub Pages deployment through **.github/workflows/deploy.yml**

Node must be **20.19+** or **22.12+**, per **package.json**.

### Runtime layers

The active application generally follows this flow:

    Vue route/view
      -> Pinia domain store
        -> thin service module
          -> Axios ApiService custom mock adapter
            -> in-memory mockDatabase
              -> localStorage persistence

Club administration and a few other domains bypass ApiService:

    Club views
      -> admin Pinia store
        -> AdminService
          -> versioned localStorage club directory

    Friendly match flow
      -> friendlyMatch Pinia store
        -> its own localStorage records and scoring engine

    Tournament creation draft/templates
      -> TournamentSetupService
        -> its own localStorage workspace

    Court booking
      -> BookingService fake promises
        -> booking store localStorage

There is therefore no single authoritative repository or transaction boundary. The app contains several local persistence islands which only partially share identity, club, match, and tournament context.

### Application startup

- **src/main.js** creates the Vue app, Pinia, and router.
- It imports **src/assets/main.css** and **src/assets/tournament.css** globally.
- It installs the global form-submit hardening listener from **src/utils/formSafety.js**.
- It uses normal HTML5 history through **createWebHistory**.
- It also reads hash routes and calls router.replace for compatibility with links such as **#/signup?...**.
- **src/App.vue** renders only **src/layouts/DefaultLayout.vue**.
- The app waits for router readiness, applies hash-route synchronization, then mounts.

All route components are imported eagerly in **src/router/index.js**. There is no route-level code splitting, which contributes to the current large bundle.

## 3. Repository Map

### Application source

- **src/main.js**, **src/App.vue** — bootstrapping.
- **src/router/index.js** — all active routes, route metadata, authentication/setup/permission guards, document titles, and scroll reset.
- **src/layouts/DefaultLayout.vue** — the shared desktop/mobile application shell and route loading transitions.
- **src/views/** — routed screens. Some are old and no longer imported by the router; see “Legacy and misleading code.”
- **src/views/compete/** — the active Ladder, Challenges queue, Tournaments list, and direct Challenge creation screens.
- **src/components/** — shared primitives and domain components.
- **src/components/dashboard/** — active Home page cards.
- **src/components/friendly/** — match-flow icons and result modal; one old home component is inactive.
- **src/components/compete/** — shared Compete navigation/icons.
- **src/components/tournament/** — active tournament cards, tables, fixtures, brackets, modals, and gallery UI.
- **src/components/tournament/creation/** — the current four-step creation UI.
- **src/stores/** — Pinia stores for auth, club admin, players, challenges, matches, tournaments, friendly matches, notifications, booking, and gallery.
- **src/services/** — thin endpoint wrappers, the mock API adapter, local club service, booking service, ladder access check, and tournament draft/template service.
- **src/config/** — role/club/ladder defaults and branding.
- **src/composables/** — bracket, fixtures, standings, tournament refresh, and a thin auth helper.
- **src/utils/** — input safety, scoring, dates, notifications, access control, club setup, challenge lifecycle, onboarding validation/import, and tournament creation logic.
- **src/data/** — the fresh-account ladder projection.
- **src/assets/** — global, landing, tournament, and tournament-creation CSS plus landing images.
- **src/dataMode.js** — global empty/demo mode.

### Tests and delivery

- **test/** — five Node test files with 25 tests.
- **public/404.html** — GitHub Pages deep-link redirect shim.
- **.github/workflows/deploy.yml** — npm ci, build, upload, and deploy to GitHub Pages on main.
- **vite.config.js** — Vue plugin, alias, and production repository base path.
- **package.json** — dev/build/test/preview/deploy scripts.

### Documentation and non-runtime material

- **APP_FEATURES.md**, **ARCHITECTURE.md**, **logic.md**, **styling.md** — large older reference documents. They predate the 2026-08-18 milestone and are not fully authoritative.
- **docs/** — product-flow, backend-contract, database-schema, typography, UI psychology, tournament, and rehearsal documents plus screenshots.
- **docs/GORRA_APPLICATION_TYPOGRAPHY.md** and **docs/GORRA_UI_PSYCHOLOGY_AND_MOTION_SYSTEM.md** are useful current design guidance, although implementation inconsistencies remain.
- **docs/TOURNAMENT_CREATION_RULES.md** describes the older player/category wizard and does not match the current four-step registration-plan creator.
- **docs/AUTHORIZATION_BACKEND_CONTRACT.md** and **docs/CLUB_MEMBERSHIP_SCHEMA.sql** are proposed backend references, not connected code. The authorization document also omits the active frontend club_admin role.
- **dashboard-*.patch**, **dashboard-visual-check.ps1**, and **artifacts/dashboard-*.png** are historical dashboard development artifacts.
- **.dashboard-check-9331/** and **.dashboard-check-9332/** are tracked Chromium test profiles, not application source. Together they account for 952 of the 1,161 tracked paths and should eventually be removed from version control and ignored.
- Local **node_modules/** and **dist/** exist but are ignored.

## 4. Shared Shell, Navigation, and Design System

### DefaultLayout

**src/layouts/DefaultLayout.vue** is a central architectural component, not a decorative wrapper.

It provides:

- desktop sidebar navigation;
- a contracted tablet sidebar;
- fixed mobile bottom navigation;
- shared route title/subtitle header;
- notifications indicator;
- active-club switcher;
- account menu and sign-out;
- Club contextual navigation;
- Compete contextual navigation on mobile;
- tournament-specific header context;
- full-width/focused/immersive route handling;
- route-shaped skeleton overlays;
- global toast shelf;
- animated navigation tracks;
- reduced-motion fallbacks;
- an extremely narrow “watch” state.

Primary destinations are:

- Home -> Dashboard
- Play -> PlayHub
- Compete -> Ladder, with Ladder/Challenges/Tournaments subnavigation
- Club -> Club overview

The Club section adds Overview, Members, Rules, and manager-only Manage links. The account menu adds Profile, Match history, Account settings, manager-only Club settings, and sign-out.

Public pages, onboarding flows, friendly match flows, and immersive scoring pages hide some or all of the normal shell. Tournament workspaces can use a wider body.

The layout loads player and club context on mount and on relevant active-club/route changes. Navigation deliberately uses real href values from router.resolve, while intercepting ordinary clicks for SPA navigation.

Route transitions use **src/components/RoutePageSkeleton.vue**. The shell waits a fixed 900 ms on most routes and 650 ms on focused flows. This is visual choreography, not actual network readiness.

### Visual system

**src/assets/main.css** defines the shared tokens:

- bright green primary **#00b51a** and strong green **#008f15**;
- yellow/amber and clay supporting accents;
- white and quiet gray-green surfaces;
- 10 px card and 7 px inner radii;
- 44 px standard button height;
- hairline borders and restrained shadows;
- approximately 90–240 ms control/content motion tokens;
- global focus-ring and reduced-motion patterns.

The intended product feeling is “quiet at rest, alive on intent, clear at every step.”

Typography is not yet unified:

- global body: Inter/system stack;
- DefaultLayout: historical Poppins;
- tournament stylesheet: DM Sans with Poppins fallback;
- selected login/onboarding display copy: Georgia;
- several views import Poppins independently.

Do not introduce another font family. When touching a screen, move it toward the shared type tokens in **main.css** and the direction in **docs/GORRA_APPLICATION_TYPOGRAPHY.md**.

## 5. Authentication, Identity, Data Modes, and Authorization

### Authentication is simulated

**src/stores/auth.js** persists **sheltennis-auth** and uses a delayed fake promise from **src/services/api.js**.

There are no credentials, password verification, tokens, sessions, or authenticated backend calls. The sign-in screen asks the user to choose Player or Club admin and immediately creates a local identity:

- Player -> **player-05**, role player
- Club admin -> **player-02**, role club_admin
- super_admin is supported in code but not exposed as a normal button

Admin login always selects demo data. Player login defaults to empty/fresh data unless “Use sample club data” is selected.

There is stale branding in this store: the fallback email uses **@shell.com** and the welcome message says “Welcome to ShellTennis.”

### Empty versus demo data

**src/dataMode.js** persists **gorra.appDataMode.v1**:

- empty is the default;
- demo exposes all seeded mock data;
- admin login forces demo;
- player login chooses empty unless sample data is requested.

In empty mode, ApiService returns:

- eight ladder players from **src/data/freshAccountLadder.js**, with zeroed stats;
- only challenges and matches tagged **fresh-account-ladder**;
- no tournaments;
- tournament detail requests as not found.

This separation is incomplete. The main ladder and tournament state keys are not mode- or user-specific; empty mode only filters reads. A fresh player’s created challenge is saved into the same underlying ladder payload later read by demo mode.

### Global and active-club roles

**src/utils/auth/accessControl.js** defines:

- player
- tournament_admin
- club_admin
- super_admin

Global permissions include tournament viewing/management/scoring, match viewing/live scoring, rankings, challenge creation, and club management.

The active club is a second authorization layer in **src/stores/admin.js**:

- an active membership is required;
- player membership allows tournament view, match view, rankings, and challenge creation;
- admin/co-admin membership additionally allows club management, tournament management/scoring/fixtures/knockout/images, and match live scoring.

Important distinction: the router uses active-club permission checks for tournament creation, club settings, challenge creation, and the shared live scoreboard. Many store/mock endpoints still rely on the UI and do not independently enforce all permissions.

### Router guards

In **src/router/index.js**:

1. Every non-public route redirects an unauthenticated user to SignIn with a redirect query.
2. A globally administrative identity is forced through club setup unless the active setup is status active with completedStep 5.
3. Routes with activeClubPermission load the club directory and check membership-derived permission.
4. Other permission routes use the global auth role.
5. Failures redirect to Dashboard with an access query; there is no dedicated authorization error page.

## 6. Complete Active Route Map

### Public/auth routes

| Path | Route name | View | Purpose and outgoing flow |
| --- | --- | --- | --- |
| / | Home | **LandingView.vue** | Public Gorra marketing page. Sign in -> SignIn; Join -> SignUp; Explore product -> Dashboard and therefore auth guard; demo CTA is mailto. |
| /signin, /login | SignIn | **LoginView.vue** | Role-based simulated sign-in. Player -> Dashboard; admin with no configured club -> AdminSetup. Honors a safe local redirect query. |
| /signup | SignUp | **LoginView.vue** | Role selection/sign-up. Admin -> AdminSetup create/join flow. Player -> PlayerClubJoin. |

### Main shell routes

| Path | Route name | View | Purpose and outgoing flow |
| --- | --- | --- | --- |
| /dashboard | Dashboard | **DashboardView.vue** | Personal Home summary, nearby ladder, activity, and tournament opportunity. Links to CreateChallenge, ChallengeDetails/Challenges, MatchDetails/tournament match, Ladder, or TournamentOverview. |
| /home | — | redirect | Redirects to Dashboard. |
| /play | Play | **PlayHubView.vue** | Start Friendly/Ladder flow or continue active matches. Continue buttons target PlayMatch. |
| /compete | — | redirect | Redirects to Rankings. |
| /rankings | Rankings | **views/compete/LadderView.vue** | Current position and full ladder. Eligible Challenge action -> CreateChallenge with opponent query. |
| /challenges | Challenges | **views/compete/ChallengesQueueView.vue** | Sent/received queue. Details -> ChallengeDetails; New challenge -> CreateChallenge. |
| /challenges/:challengeId | ChallengeDetails | **ChallengeDetailsView.vue** | Participant state machine for accept, decline, withdraw, schedule, start, continue scoring, review, and completed movement. |
| /create-challenge | CreateChallenge | **views/compete/CompeteChallengeCreateView.vue** | Direct shell-based ladder challenge creation. Requires active-club challenges.create. Success -> ChallengeDetails. |
| /matches/:matchId | MatchDetails | **MatchDetailsView.vue** | Ladder result preview/submission/review or tournament match detail/edit. |
| /play/:matchId | PlayMatch | **PlayView.vue** | Immersive shared scoreboard. Requires active-club matches.live_score. Final ladder result -> MatchDetails preview; final tournament score saves directly. |
| /club | Club | **ClubView.vue** | Club overview, members, rules, courts, ladders. Query section controls Overview/Members/Rules. Manager actions -> Settings or Clubs. |
| /settings, /club/settings | Settings | **SettingsView.vue** | Active-club management. Requires club.manage for the active club. |
| /account/settings | AccountSettings | **AccountSettingsView.vue** | Local profile edits, simulated password change, and sign-out. |
| /profile | Profile | **ProfileView.vue** | Current ladder player summary and stats. |
| /history | History | **HistoryView.vue** | Local booking and completed-match history. |
| /notifications | Notifications | **NotificationsView.vue** | Local notification feed with read/dismiss/clear actions. |

### Club setup/onboarding

| Path | Route name | View | Purpose and outgoing flow |
| --- | --- | --- | --- |
| /admin/setup | AdminSetup | **ClubsView.vue** | Create first club or join by invite; forced route for unconfigured admins. Publish/join -> Dashboard. |
| /clubs | Clubs | **ClubsView.vue** | Same component, used for creating another club, joining, or switching. |
| /onboarding/join-club | PlayerClubJoin | **MemberOnboardingView.vue** | Player search/code/link/QR experience. Visually completes -> Dashboard, but does not write a real membership. |

### Tournament routes

| Path | Route name | View | Purpose and outgoing flow |
| --- | --- | --- | --- |
| /tournaments | Tournaments | **views/compete/TournamentsListView.vue** | Search/filter active, upcoming, and completed tournaments. Card -> Overview. Admin create action -> TournamentCreate. |
| /tournaments/create | TournamentCreate | **TournamentCreate.vue** | Four-step creation flow. Requires active-club tournaments.manage. Publish -> newly created TournamentOverview. |
| /tournaments/:tournamentId | TournamentOverview | **TournamentOverview.vue** | Registration-stage summary or operational tournament overview. Links to category, schedule, gallery, and match records. |
| /tournaments/:tournamentId/category/:categoryId | TournamentCategory | **TournamentCategory.vue** | Overview, Groups, Matches, Standings, and Knockout tabs; fixtures, scoring, stage close, bracket. |
| /tournaments/:tournamentId/schedule | TournamentSchedule | **TournamentSchedule.vue** | Full dated schedule with category/status/court filters and match modal. |
| /tournaments/:tournamentId/gallery | TournamentGallery | **TournamentGallery.vue** | Folders, image add, lightbox, share, delete. |
| /tournaments/:tournamentId/match/:matchId | TournamentMatchDetails | **MatchDetailsView.vue** | Same match view with tournament context. |

### Friendly/ladder focused flow routes

All use **FriendlyMatchFlowView.vue** and hide normal shell chrome. Ladder aliases reuse the same component and state.

| Friendly path | Ladder alias | Step |
| --- | --- | --- |
| /friendly-match/type | /ladder-match/type | Choose friendly or ladder. |
| /friendly-match/timing | /ladder-match/timing | Play now or later. |
| /friendly-match/join | /ladder-match/join | Generate/share QR and wait for opponent. |
| /friendly-match/club-opponent | /ladder-match/opponent | Choose a club opponent. |
| /friendly-match/schedule | /ladder-match/schedule | Optional date/time/court. |
| /friendly-match/opponent | none; normalized to club-opponent | Historical opponent step. |
| /friendly-match/scoring | /ladder-match/scoring | Advantage/no-ad selection for friendly matches. |
| /friendly-match/format | /ladder-match/format | Friendly format or locked ladder review. |
| /friendly-match/custom-format | none | Create/save a local custom format. |
| /friendly-match/scheduled | /ladder-match/sent | Invitation/challenge sent confirmation. |
| /friendly-match/join/:token | /ladder-match/join/:token | External invitation join step; still auth-protected. |
| /friendly-match/live | /ladder-match/live | Immersive local scorer. |

Any unmatched route redirects to Dashboard.

## 7. Page-to-Page Product Flows

### First-time admin

    Landing / SignUp
      -> choose Club admin
      -> AdminSetup or Clubs start screen
      -> Create club or Join club
      -> three visible setup steps:
           Workspace basics
           Members
           Starting ladder
      -> publish active setup with hidden default placement/rules
      -> Dashboard
      -> Club / Settings / Tournaments

The underlying config still defines five steps. **ClubsView.vue** intentionally exposes only three and force-completes the five-step model with default placement/rules. Template branches for the older intro, placement, and rules setup remain but are unreachable.

### Player sign-up

    Landing / SignUp
      -> choose Player
      -> MemberOnboarding
      -> search club OR code/link OR QR image
      -> local timer shows Joined or Pending
      -> Dashboard

This flow is presentation-only. It does not call AdminService, does not create a directory membership, does not decode a QR, and does not make the player eligible for active-club permission routes.

### Direct ladder challenge

    Ladder or Challenges
      -> CreateChallenge
      -> load current player + challenges
      -> LadderAccessService eligibility check
      -> choose only rank-window-eligible opponent
      -> optional date/time/court/note
      -> ApiService POST /challenges
      -> ChallengeDetails
      -> defender accepts or declines
      -> either participant schedules
      -> within 30 minutes: start
      -> PlayMatch
      -> MatchDetails result preview
      -> other participant confirms
      -> challenge completed + ladder movement + stats

The mock service enforces the main lifecycle rules: active season, ladder placement, challenge range, rematch cooldown, maximum active challenges, participant identity for transitions, response deadline, start-time window, result participant, and second-participant review.

### Play flow: friendly match

    Play
      -> New match
      -> Friendly
      -> Now or Later

Now:

    -> QR/join or choose club opponent
    -> advantage/no-ad
    -> one set / best of three / match tie-break / custom
    -> local live scorer
    -> result modal
    -> save local result
    -> Dashboard

Later:

    -> choose opponent
    -> optional schedule
    -> scoring + format
    -> create local invitation
    -> Scheduled confirmation

Friendly invitations/results live only in the friendlyMatch store. They do not become ApiService matches, do not appear in the shared match store, and do not synchronize to another device.

### Play flow: ladder “play now”

    Play
      -> New match
      -> Ladder
      -> Now
      -> QR/join or eligible club opponent
      -> locked club-rule review
      -> create challenge
      -> locally auto-accept using defender identity
      -> link generated challenge and match to friendly draft
      -> friendly live scorer
      -> submit shared match result as pending_review
      -> Challenges

The local auto-accept is a prototype shortcut and effectively impersonates the defender in the mock request. It must not survive a real backend.

Ladder “later” creates a normal awaiting challenge and returns through ChallengeDetails.

### Existing seeded tournament operation

    Tournaments
      -> RSP Masters overview
      -> category
      -> group fixtures and standings
      -> admin enters scores / walkovers / schedule
      -> close round robin
      -> generated knockout bracket
      -> score knockout rounds
      -> champion

Parallel paths:

- Overview -> full Schedule -> match modal/detail/live scorer
- Overview -> Gallery -> folder/lightbox/add/share/delete
- Member views see personal placement and match emphasis when the current player is in the draw

### New tournament creation

    Tournaments
      -> Create Tournament
      -> Details
      -> Where & when
      -> Events
      -> Review
      -> Publish
      -> TournamentOverview in registration stage

This is exactly where the new tournament lifecycle currently stops. The published record has events/categories and registration requirements, but empty player/group arrays, no draw, no fixtures, and no court reservation.

## 8. Feature and Page Details

### Landing and sign-in

**LandingView.vue** is a real marketing page with Gorra branding, static product previews, two local tennis images, meta description/title handling, sticky navigation, and CTA links. The showcased “live” data is visual copy, not connected domain state.

**LoginView.vue** handles both sign-in and sign-up through route metadata. It safely rejects redirect values not beginning with a single local slash. It does not collect or validate a real password.

### Dashboard

**DashboardView.vue** loads players, challenges, matches, tournaments, and clubs with an all-settled pattern. It assembles:

- **MemberLadderSnapshot.vue** — current/nearby ranking and challenge action;
- **ClubActivityCard.vue** — challenge, match, and movement events;
- **ClubOpportunityBanner.vue** — active/open tournament opportunity;
- domain-specific empty and error states.

Activity cards route to exact challenge/match/tournament records when possible. The page adapts to empty player data and missing club context.

### Play hub

**PlayHubView.vue** offers Friendly match and Ladder match entry. It also derives “ready to continue” rows from match states such as scheduled, live, and pending_review.

The continuation route currently conflicts with player permissions: it targets PlayMatch, but PlayMatch requires the active-club **matches.live_score** permission, which player membership does not receive.

### Ladder

**views/compete/LadderView.vue** is the active ranking page. It shows:

- current player summary;
- active club/ladder context;
- sorted full ladder;
- nearby/challengeable status;
- a challenge action only when **isEligibleLadderOpponent** and club permissions allow it;
- first-use/no-club/empty handling.

Eligibility defaults are in **src/config/ladder.js** and can be derived from the mirrored active club setup:

- challenge up 3 positions;
- no downward challenges by default;
- max 1 active challenge;
- 48-hour response;
- 7-day completion;
- 7-day rematch cooldown from the club default;
- position swap by default;
- time-smart match preset and advantage scoring in new club setup defaults.

### Challenges

**views/compete/ChallengesQueueView.vue** is the active queue. It separates sent and received records, shows human lifecycle state, and routes every record to **ChallengeDetailsView.vue**.

**ChallengeDetailsView.vue** is the canonical lifecycle screen added in the latest milestone. **src/utils/challenge/challengeLifecycle.js** maps records into:

- sent
- received
- accepted_unscheduled
- scheduled
- ready within 30 minutes
- live
- pending_review
- completed
- declined
- cancelled
- expired

It verifies participant context before exposing participant actions. The page polls its local clock, not the backend, and reloads stores on entry.

**views/compete/CompeteChallengeCreateView.vue** is the active creator. It keeps the normal shell, supports an opponent query parameter from Ladder, shows locked club rules/movement, and checks the optional backend ladder-access endpoint before submitting.

### Match details and scoring

**MatchDetailsView.vue** serves both ladder and tournament records:

- ladder participants can preview winner/score before submission;
- the first submission sets pending_review;
- only the other participant may confirm;
- tournament managers use **TournamentMatchModal.vue** for scores, walkovers, and scheduling;
- completed tournament records refresh tournament state and local notifications.

**PlayView.vue** uses **TennisScoreboard.vue** and **src/utils/tennisScoring.js**. It:

- loads/polls the shared match store every two seconds;
- persists liveState after each point through PATCH /matches/:id;
- supports server toggle, dark/light theme, and browser/app fullscreen;
- directly completes tournament matches;
- sends ladder matches to MatchDetails for review.

The scoring engine is fixed to advantage scoring, best-of-three standard sets, and a seven-point tiebreak at 6–6. It does not consume the challenge’s locked matchConfig or tournament event scoring config.

**FriendlyMatchFlowView.vue** has a different, more capable scorer in **src/stores/friendlyMatch.js**, including no-ad, one-set, match-tiebreak, custom sets, time-smart deciding tiebreak, and undo. The two scoring systems are not unified.

### Club setup, directory, and settings

**AdminService.js** implements the most complete local authorization domain in the app:

- versioned multi-club directory;
- user/club membership records;
- active club per user;
- draft setup per user;
- admin/co-admin/player roles;
- secure browser-crypto invite generation;
- invite preview/join;
- invite rotation;
- club switching;
- manager checks;
- validation and normalization;
- migration/mirroring of the older single-setup key;
- stripping invite secrets from non-manager views.

The main key is **gorra.admin.clubDirectory.v2**. The compatibility mirror is **gorra.admin.clubSetup.v1** so ladder configuration can still read the active setup.

**ClubsView.vue** supports:

- create versus join start screen;
- switching when multiple clubs are available;
- workspace name/location/timezone/courts/season;
- member source choice;
- private player invite QR/code;
- email/phone collection;
- manual members;
- roster file validation;
- ladder templates and a custom starting order;
- autosaved setup draft and publish.

File upload in this setup flow validates CSV/Excel/PDF type and size but does not parse any of them. CSV parsing is implemented later in Settings, not here.

**ClubView.vue** reads the active club and presents overview, members, and rules. It merges roster/import/manual member displays, shows court/season/ladder metrics, and exposes manager actions.

**SettingsView.vue** has Club, Members, Ladders, Rules & format, and Account categories:

- update name/logo/location/timezone/courts/season;
- rotate/copy player and co-admin invites;
- parse CSV roster files;
- add/edit/remove local roster members and roles;
- add, archive, and choose primary ladders;
- edit challenge, movement, match preset, scoring, and result rules;
- edit the local auth profile;
- validate but only simulate password change.

Excel and PDF are accepted by the preliminary file validator but Settings explicitly refuses to parse them and asks for CSV.

Roster entries without a stable userId remain club setup records and do not create login-capable directory memberships.

### Tournaments list and creation

**views/compete/TournamentsListView.vue** owns its page heading, create action, metrics, search, and status filters. Despite the copy “Club tournaments,” it displays the global tournament store without active-club filtering.

The rebuilt **TournamentCreate.vue** is a four-step admin flow:

1. Details — name, start/end, signup open/close.
2. Where & when — active club venue, courts, common or per-day hours, booking-conflict awareness, per-court start rules.
3. Events — preset/custom singles/doubles/mixed events, entry restrictions, capacity, format, scoring, level/age, seeding.
4. Review — estimates and publish.

Supporting files:

- **src/utils/tournament/tournamentCreation.js** — canonical state, validation, date/hour/court math, event defaults, capacity/match/hour estimates, group recommendations, seeding capability, registration fields, payload builder.
- **src/services/TournamentSetupService.js** — club/user-scoped draft and up to 50 reusable configurations.
- **src/components/tournament/creation/** — step views and dialogs.
- **src/assets/tournament-creation.css** — creator styling.

Drafts autosave after 350 ms and on navigation. A reusable setup keeps venue/hours/courts/events but intentionally discards day-specific court rules and reevaluates stale courts/seeding support.

Publication creates schema version 2, status upcoming, with:

- clubId and creator identity;
- date and registration window;
- venue and courtIntent;
- explicit **reservesCourts: false**;
- categories derived from events;
- empty players/groups;
- empty knockout;
- **registrationStage: true**;
- **actualDrawCreated: false**;
- derived registration requirements.

There is no entrant registration UI, registration persistence, registration close action, seeding review, draw builder, or actual court booking after this point.

### Tournament operation

The seeded demo tournament is **rsp-masters-2026**, “2026 RSP Masters Tennis Tournament.” It includes Premier, Category A, Category B, Ladies, and Veterans categories; seeded groups/players; generated round-robin fixtures; tournament rules; and six gallery images. A one-time local scenario applies partial Category A results.

**TournamentOverview.vue**:

- detects registrationStage;
- hides schedule on new registration-stage tournaments;
- shows dates/venue/registration facts;
- for seeded operational tournaments shows category cards, officials, schedule, gallery, and current-player placement.

It has no Register, Manage entrants, Close registration, or Create draw action.

**TournamentCategory.vue**:

- tabs: Overview, Groups, Matches, Standings, Knockout;
- personal placement/match emphasis;
- group lists and standings;
- fixture filters;
- admin scoring/live actions;
- fixture generation;
- close-round-robin/knockout generation, including confirmation with pending matches;
- responsive desktop/mobile brackets;
- one-second local refresh.

**TournamentSchedule.vue**:

- all tournament matches grouped by date;
- category/status/court filtering;
- manager score/schedule modal;
- viewer match details;
- one-second local refresh.

Its court filter values are hardcoded to Court 1–4 instead of the active venue’s court names.

**TournamentGallery.vue**:

- All and category folders;
- local image URL or file upload;
- file validation and conversion to data URL up to 1.5 MB;
- lightbox, previous/next, share/copy, and manager delete;
- query-based folder/image deep linking.

Images are stored inside tournament localStorage. Large base64 images can exhaust storage and do not exist for another browser.

### Tournament algorithms

- **useTournamentFixtures.js** generates deterministic round-robin pairs and BYE fixtures.
- **useTournamentStandings.js** ranks by configured points, set difference, game difference, wins, then name.
- **useBracketBuilder.js** builds and progresses one-, two-, or four-group knockout patterns and a limited direct-knockout bracket.
- **useTournamentLiveRefresh.js** refetches tournament and match state every second, skipping hidden pages and overlapping calls.

This refresh only rereads the same browser’s mock/local state. It is not server push or multi-user synchronization.

### Notifications

**src/stores/notification.js** persists:

- **tennis.local.notifications.v1**
- **tennis.local.matchEventSignatures.v1**

Empty mode adds an **.empty** suffix. It provides toasts and a persistent feed, sound on score updates, deduplication via match signatures, mark read, dismiss, and clear.

Only tournament match score changes are currently turned into durable notifications. Challenge invites, acceptances, schedules, reviews, club invites, and friendly events are not generally integrated.

**NotificationsView.vue** contains a disabled prototype seeding block and has no notification click-through destinations.

### Profile, history, account, and booking

**ProfileView.vue** displays the current mock player’s ladder stats. Its challenge totals count every challenge returned by the store, not only those involving the current player.

**HistoryView.vue** combines BookingStore and completed MatchStore records. Its match template expects old fields **title** and **scoreboard.completedSets**, while current shared matches primarily expose player names, score, and liveState. Completed match rows therefore show incomplete information.

**AccountSettingsView.vue** and the Account section in **SettingsView.vue** persist local profile fields. Password changes only validate, delay, and show success.

**BookView.vue**, **CourtBookingForm.vue**, BookingStore, and BookingService implement a basic 06:00–20:00, one/two-hour local booking prototype, but BookView has no active route. Tournament creation reads bookings only for conflict hints. Booking records have no reliable clubId/venueId/courtId, so the creator maps them to the first active court and cannot provide true per-court reservations.

## 9. Reusable Components and Actual Usage

### Shared active components

| Component | Actual use |
| --- | --- |
| **AppLogo.vue** | DefaultLayout, Landing, Login, MemberOnboarding, Clubs, and some legacy views. Central logo/brand rendering. |
| **EmptyState.vue** | Dashboard, Ladder, Challenge details, Play hub/scorer, Profile, History, Notifications, Club, Match details, and tournament empty-state wrapper. It uses BaseButton and FlowIcon. |
| **BaseButton.vue** | Active indirectly through EmptyState; also older CreateChallenge/PlayerCard. |
| **PersonAvatar.vue** | Dashboard cards, active Ladder, Challenges queue, Challenge details, and direct challenge creation. |
| **RoutePageSkeleton.vue** | DefaultLayout route loading overlay with many destination-specific shapes. |
| **ToastShelf.vue** | DefaultLayout global transient feedback. |
| **TennisScoreboard.vue** | PlayView shared live match scoreboard. |
| **FlowIcon.vue** | Friendly flow, result modal, Club setup, Member onboarding, and EmptyState. |
| **MatchResultModal.vue** | FriendlyMatchFlowView final confirmation/share UI. |
| **CompeteSectionShell.vue** | DefaultLayout mobile Compete tabs. |
| **TennisNavIcon.vue** | DefaultLayout, active Compete views, and Compete section shell. |

### Dashboard components

- **MemberLadderSnapshot.vue** — nearby ladder and challenge action; used only by Dashboard.
- **ClubActivityCard.vue** — domain-aware activity row; used only by Dashboard.
- **ClubOpportunityBanner.vue** — tournament opportunity; used only by Dashboard.

### Tournament operation components

- **CategoryCard.vue** — TournamentOverview.
- **CategoryStatusBadge.vue** — category cards, fixture cards/rows, and old TournamentCard.
- **StandingsTable.vue** — TournamentCategory.
- **MatchFixtureCard.vue** — TournamentCategory.
- **MatchFixtureRow.vue** — TournamentSchedule.
- **TournamentMatchModal.vue** — TournamentCategory, TournamentSchedule, and MatchDetails.
- **BracketTree.vue** + **BracketNode.vue** — desktop TournamentCategory knockout.
- **BracketTreeMobile.vue** + **BracketNode.vue** — mobile knockout.
- **KnockoutChampionCard.vue** — TournamentCategory.
- **TournamentEmptyState.vue** — wrapper used across Overview/Category/Schedule/Gallery and old hub.
- **TournamentGalleryCard.vue**, **TournamentGalleryFolder.vue**, **TournamentImageAddModal.vue**, **TournamentImageLightbox.vue** — TournamentGallery.

### Tournament creation components

- **TournamentDetailsStep.vue**
- **TournamentWhereWhenStep.vue**
- **TournamentEventsStep.vue**
- **TournamentReviewStep.vue**
- **TournamentCourtDialog.vue**
- **TournamentEventDialog.vue**
- **TournamentSetupDialog.vue**

All seven are composed by **TournamentCreate.vue** and belong to the current implementation.

### Inactive/legacy components

These are not on an active routed path:

- **BaseInput.vue**
- **NavBar.vue**
- **PlayerCard.vue**
- **RankingRow.vue**
- **CountdownTimer.vue**
- **MatchCard.vue** — only old MatchesView
- **CourtBookingForm.vue** — only unrouted BookView
- **charts/PerformanceChart.vue** — only DashboardView.legacy
- **friendly/FriendlyMatchHome.vue** — only legacy dashboard
- **ChallengeCard.vue**, **challenges/ChallengeEmptyState.vue**, **ChallengeSkeleton.vue**, **FreshAccountSetupGuide.vue** — only the old ChallengesView
- **tournament/TournamentCard.vue** — only the old TournamentHub

Do not assume a component is canonical simply because its name sounds generic. Check the router/import graph first.

## 10. Stores, Services, and Data Ownership

### Pinia stores

| Store | Owns / derives | Persistence or service |
| --- | --- | --- |
| **auth.js** | Local identity, global access profile, sign-in/out | sheltennis-auth; fake service |
| **admin.js** | Clubs, memberships, active club, active role/permission, setup | AdminService |
| **player.js** | Player roster, current player, ladder order, category assignment, local role overrides | PlayerService; tennis.local.playerRoles.v1 |
| **challenge.js** | Challenge list, filters, counts, all lifecycle actions | ChallengeService |
| **match.js** | Match list, lookups, scheduled/review/open groups, live state, results | MatchService; syncs tournament notifications |
| **tournament.js** | Tournament list/active tournament, category/group/standing/bracket access, fixtures/stages/results/schedule | TournamentService and MatchStore |
| **tournamentGallery.js** | Active image/folder/filter state and CRUD | TournamentImageService |
| **friendlyMatch.js** | Draft, invitations, custom formats, results, scoring, undo, local join ownership | Four Gorra localStorage keys |
| **notification.js** | Toasts, feed, unread count, tournament event signatures | Mode-specific localStorage |
| **booking.js** | Bookings, slots, booking actions | BookingService; mode-specific localStorage |
| **counter.js** | Vue starter counter | Unused boilerplate |

### Thin endpoint services

- **PlayerService.js** — GET players; get-by-id filters the full response client-side.
- **ChallengeService.js** — list/create/accept/schedule/start/review/decline/withdraw.
- **MatchService.js** — list/get/patch/result.
- **TournamentService.js** — list/get/create/update/schedule/generate fixtures/close round robin.
- **TournamentImageService.js** — list/get/create/delete tournament images.

### Local domain services

- **ApiService.js** — central seeded in-memory database, Axios adapter, endpoint router, lifecycle rules, tournament algorithms, and ladder/tournament persistence.
- **AdminService.js** — local club directory/membership/invite authorization domain.
- **TournamentSetupService.js** — creator drafts and reusable configurations.
- **BookingService.js** — local sample bookings and time-slot overlap.
- **LadderAccessService.js** — local preflight plus optional real POST endpoint from **VITE_LADDER_ACCESS_ENDPOINT**. If configured and unavailable, it fails closed.
- **api.js** — generic delayed promise/id/timestamp helper used by auth and booking.

## 11. Mock API Surface

**src/services/ApiService.js** creates Axios with:

- baseURL from **VITE_API_BASE_URL** or localhost:4000;
- a permanently installed custom adapter;
- 300 ms artificial delay;
- response envelopes shaped as success/data/message.

Because the adapter is always installed, **VITE_API_BASE_URL=https://api.sheltennis.local** in **.env** does not cause real requests.

Implemented routes:

| Method/path | Behavior |
| --- | --- |
| GET /players | Demo roster or eight-player fresh projection. |
| GET /challenges | Enriched challenges; fresh mode filters by accountScope. |
| POST /challenges | Validates ladder season, placement, eligible rank window, cooldown, max active count; snapshots rules/deadlines. |
| POST /challenges/:id/accept | Defender only; creates linked match; accepted or scheduled. |
| POST /challenges/:id/schedule | Participant only; future date; creates/updates linked match. |
| POST /challenges/:id/start | Participant only; valid state and no more than 30 minutes early; marks live. |
| POST /challenges/:id/decline | Defender only while awaiting. |
| POST /challenges/:id/withdraw | Challenger in allowed pre-play states; cancels linked match. |
| POST /challenges/:id/review | Other participant confirms pending result; completes challenge and moves ladder/stats. |
| GET /matches, GET /matches/:id | Shared ladder/tournament match data. |
| PATCH /matches/:id | Arbitrary local match patch, used for schedule and liveState. |
| POST /matches/:id/result | Tournament completion/walkover or ladder pending_review submission. |
| GET/POST /tournaments | List or create. Fresh mode list is empty. |
| GET/PUT /tournaments/:id | Read or merge-update. |
| GET /tournaments/:id/categories | Categories. |
| GET /tournaments/:id/categories/:categoryId | Category. |
| GET /tournaments/:id/schedule | Tournament matches. |
| GET /tournaments/:id/categories/:categoryId/standings/:groupId | Calculated standings. |
| POST .../generate-fixtures | Deterministically creates missing round-robin fixtures. |
| POST .../close-round-robin | Calculates standings and generates/progresses knockout, or completes round-robin-only category. |
| GET/POST /tournaments/:id/images | Image list/create with source validation and sanitization. |
| GET/DELETE /tournaments/:id/images/:imageId | Image detail/delete. |

Unknown routes return “Route not implemented.”

### Ladder result behavior

The first valid ladder result submission:

- must come from a participant;
- validates winner;
- stores score/sets/submittedBy;
- marks match and challenge pending_review.

The other participant’s review:

- completes match and challenge;
- applies position-swap or leapfrog;
- updates wins, losses, match counts, movement, and recent form;
- persists the changed ladder state.

### Tournament behavior

Round-robin fixtures and bracket matches share the match collection. Saving scores progresses matching knockout nodes and persists both tournament and match state.

The API and stores do not consistently enforce active club or admin permission for every tournament mutation. Most protection is route/button-level.

## 12. Core Domain Shapes

### Player

Important fields include id, name, rank, wins, losses, matchesPlayed, winRate, movement, recentForm, gender, birthYear/age metadata, veteran/category metadata, status, image, and optional rating/elo.

The current authenticated player is selected by auth user.playerId, with player-02 fallback.

### Club directory

The v2 directory contains:

- clubs: id, name, normalized setup, invites, timestamps;
- memberships: userId, clubId, role, joinedAt;
- activeClubByUser;
- draftsByUser.

The club setup contains workspace, membership/roster, ladders, primary ladder, placement, rules, status, completion, and timestamps.

### Challenge

Important fields:

- id, type ladder;
- challengerId/defenderId and enriched names/ranks;
- status;
- requested/created/accepted/scheduled/started/submitted/confirmed timestamps;
- responseDeadline and playDeadline;
- court/note;
- scorerId;
- preMatchPositions;
- ladderConfigSnapshot;
- locked matchConfig;
- linked matchId;
- submitted winner/score and final movement.

### Match

Two related shapes coexist:

- ladder: challenger/defender ids and names, challengeId, status, schedule, score, winner, submittedBy, liveState;
- tournament: tournament/category/group/stage identifiers, player1/player2, matchCode/round, schedule, sets/games/winner, liveState.

Some older screens still expect a third obsolete social-match shape with title, players array, maxPlayers, and scoreboard.

### Tournament

Seeded operational tournaments contain:

- id/name/edition/status/dates/venue;
- rules;
- officials;
- categories;
- each category’s settings, players, groups, group fixture ids, knockout;
- images.

Newly created schema-v2 tournaments additionally emphasize:

- clubId/createdBy;
- registration dates;
- venue and courtIntent;
- event-derived empty categories;
- registrationRequirements;
- registrationStage and drawCreated flags.

No implemented migration turns the new registration-stage shape into the operational seeded shape.

## 13. Persistence Keys and Isolation

| Key | Owner | Notes |
| --- | --- | --- |
| sheltennis-auth | AuthStore | Local identity; not a secure session. |
| gorra.appDataMode.v1 | dataMode | Global empty/demo choice. |
| gorra.admin.clubDirectory.v2 | AdminService | Main multi-club directory. |
| gorra.admin.clubSetup.v1 | AdminService/config ladder | Legacy mirror of active setup or draft. |
| tennis.mock.ladderState.v1 | ApiService | Players, challenges, non-tournament matches; browser-global. |
| tennis.mock.tournamentState.v1 | ApiService | Tournaments and tournament matches; browser-global. |
| tennis.mock.rspCategoryAPartialScenario.v1 | ApiService | One-time demo scenario marker. |
| gorra.tournamentSetupWorkspace.v1 | TournamentSetupService | Drafts keyed club:user and reusable setups. |
| gorra.friendlyMatchDraft.v3 | FriendlyMatchStore | One browser-global current draft. |
| gorra.friendlyMatchResults.v1 | FriendlyMatchStore | Local friendly results. |
| gorra.friendlyMatchInvitations.v1 | FriendlyMatchStore | Local invitations. |
| gorra.friendlyMatchCustomFormats.v1 | FriendlyMatchStore | Local saved formats. |
| tennis.local.notifications.v1 | NotificationStore | Demo notifications; .empty suffix in empty mode. |
| tennis.local.matchEventSignatures.v1 | NotificationStore | Notification dedup; .empty suffix in empty mode. |
| sheltennis-bookings | BookingStore | Demo bookings; .empty suffix in empty mode. |
| tennis.local.playerRoles.v1 | PlayerStore | Local role overrides. |

Most keys are not scoped to authenticated user or active club. Logging out does not erase domain data. Switching identities on the same browser can expose the same mock records.

## 14. Backend Relationship and Production Boundary

There is no connected Gorra backend in this repository.

The following are only future-facing:

- **VITE_API_BASE_URL** — currently neutralized by the Axios mock adapter.
- **VITE_LADDER_ACCESS_ENDPOINT** — the only code path that can make a real domain authorization request.
- **docs/AUTHORIZATION_BACKEND_CONTRACT.md** — proposed authenticated user and permission contract.
- **docs/CLUB_MEMBERSHIP_SCHEMA.sql** — proposed PostgreSQL users/clubs/memberships/active-club/invite tables.

The SQL design correctly treats membership as a user-club relation and stores hashed invitation secrets. The current frontend stores raw local invite code/token values because it must render/copy them.

A production backend must own:

- identity and session;
- club membership and active club;
- role/permission enforcement;
- invitations and expiry/revocation;
- players/ladders and rank transactions;
- challenge state transitions and concurrency;
- match scoring and review;
- tournament registration, draw, scheduling, progression, and audit;
- files/gallery;
- notifications;
- court bookings;
- realtime or polling endpoints.

Frontend guards and local service checks are useful UX but cannot be treated as authorization.

## 15. Completed and Working Features

“Completed” here means implemented and usable in the local prototype, not production-ready.

- Responsive shared shell with desktop/tablet/mobile navigation, active states, contextual tabs, account menu, club switcher, route headers, skeletons, toasts, and reduced-motion handling.
- Public landing, role-based local sign-in/sign-up, redirect handling, and empty/demo modes.
- Local multi-club admin directory with active membership, admin/co-admin/player roles, create/join/switch, manager enforcement, invite rotation, and legacy migration.
- Three-step club quick setup publishing full default club configuration.
- Club overview and settings for identity, courts, season, members, CSV import, ladders, invites, and rules.
- Fresh account ladder projection and a rich seeded demo roster.
- Active Ladder UI and opponent eligibility.
- Direct Challenge creation in the normal shell.
- Challenge accept/decline/withdraw/schedule/start/result/review lifecycle.
- Ranking movement and player stat persistence after confirmation.
- Friendly match now/later flow, local invitations, custom formats, point scoring, undo, and result saving.
- Play-now ladder flow bridged into challenge/match records.
- Shared immersive scoreboard with liveState persistence, server/theme/fullscreen, and match result routing.
- Seeded tournament with groups, fixtures, standings, score entry, walkovers, schedules, bracket generation/progression, champions, member emphasis, and live refresh.
- Tournament gallery folder/lightbox/add/share/delete prototype.
- Rebuilt tournament creator with strong validation, court/hour awareness, event planning, estimates, autosaved drafts, reusable configurations, and registration-stage payload.
- Local toast/feed notification infrastructure and tournament-score notifications.
- Global text control-character hardening, URL/image validation, form validity enforcement, and several input size/type limits.
- GitHub Pages CI deployment configuration.
- Passing unit/structural test and production build at the handoff snapshot.

## 16. Unfinished Features

### Product-critical

- Real backend, database, authentication, session, and server authorization.
- Real player membership onboarding. The current player join flow is disconnected.
- User/club data isolation across all domain stores.
- Tournament registration, entrant/team management, signup approval, registration close, seeding review, draw/group creation, and post-create editing.
- Actual tournament court reservations and a usable booking route/domain.
- Consistent match scoring rules across challenge, friendly, shared live scorer, and tournament event configuration.
- Real cross-device invitations, QR joins, shared live scoring, and realtime refresh.
- General notifications for challenges, match actions, clubs, and invitations.
- Real file upload/storage and image CDN integration.
- Password/account security.

### Secondary

- Tournament active-club filtering.
- Dynamic schedule court filters.
- Member-facing tournament registration action.
- Tournament edit/cancel/archive and registration management.
- Result dispute/admin resolution despite config containing dispute rules.
- Repeated-decline/inactivity/no-show automation despite stored rule fields.
- Excel/PDF roster parsing.
- QR image decoding.
- Audit logs, undo/reversal for admin changes, and server conflict handling.
- Full accessibility, keyboard modal/focus-trap, contrast, and screen-reader audit.
- Route lazy loading and bundle splitting.
- Cleanup of legacy views/utilities/components/docs and tracked browser artifacts.

## 17. Known Bugs and Important Risks

### P0/P1 functional issues

1. **Normal players cannot open the shared live scoreboard.**  
   PlayHub and ChallengeDetails route participants to **/play/:matchId**, but the route requires active-club **matches.live_score**. **src/stores/admin.js** grants that only to admin/co-admin, not player membership. The guard silently redirects the player to Dashboard.

2. **The shared scorer ignores the locked match rules.**  
   **PlayView.vue** always creates the fixed **tennisScoring.js** best-of-three advantage scoreboard. It ignores challenge.matchConfig, no-ad, time-smart final-set match tiebreak, and tournament event scoring.

3. **New tournaments reach a dead-end after publish.**  
   The current creator intentionally produces registrationStage with no entrants/groups/draw/fixtures. Overview explains that the draw comes later, but no code can perform the later step.

4. **Player club onboarding reports success without membership.**  
   **MemberOnboardingView.vue** only waits 720 ms and changes local component status. It never calls AdminService. Search uses a hardcoded three-club directory; code/link validation checks shape only; QR upload validates the image but does not decode it.

5. **Play-now ladder acceptance impersonates the opponent.**  
   **FriendlyMatchFlowView.vue** creates a challenge then calls accept with **defender.id** from the same local client. This only works because the mock API trusts the supplied actorId.

6. **Tournament data is not active-club scoped.**  
   Creation validates clubId, but TournamentStore list/detail and the Tournaments page do not filter by adminStore.activeClubId. Seeded and created tournaments can appear under unrelated club copy.

7. **Most local domain data is browser-global.**  
   Ladder, tournament, friendly draft/results/invitations, and role overrides are not reliably scoped by user and club. Switching local identities can expose or mutate shared state.

### Incorrect or stale rendering

8. **Club no-ad rule renders as advantage.**  
   **ClubView.vue** checks **rules.scoring === 'no-ad'**, while Settings/config normalize the value as **noad**.

9. **Profile challenge totals are global.**  
   **ProfileView.vue** counts the complete challenge store rather than filtering records involving the current player.

10. **Match history expects obsolete fields.**  
    **HistoryView.vue** renders **match.title** and **match.scoreboard.completedSets**, which current ladder/tournament match records generally do not contain.

11. **Schedule court filters are hardcoded.**  
    **TournamentSchedule.vue** offers All and Court 1–4 regardless of the tournament venue/courts.

12. **Booking-to-tournament conflict mapping is lossy.**  
    Old booking records lack venue/court identifiers and are treated as though they belong to the first court.

### Deployment/share issues

13. **GitHub Pages deep-link fallback is likely broken.**  
    **public/404.html** hardcodes **/tennis** and redirects the original location into a **redirect** query. App startup does not consume that query to restore the route. Vite’s production base is dynamic from GITHUB_REPOSITORY, so the hardcoded repo can also diverge.

14. **Shared links are not actually shareable across browsers.**  
    Friendly invitations, club invite records, matches, and gallery images live in the originating browser. A recipient device does not have the underlying record.

15. **Gallery base64 storage can exceed localStorage quota.**  
    Individual files are capped at 1.5 MB, but repeated images are stored in the tournament JSON with no quota management.

### Security/consistency issues

16. **Frontend permission enforcement is uneven.**  
    Routes/buttons are often guarded, but tournament fixture/stage/result APIs and generic match PATCH rely heavily on UI access. Actor ids are request fields, not authenticated principals.

17. **Seeded and newer records have different completeness.**  
    Some older seeded challenge/match records predate the latest deadlines/snapshots/status model. Views contain fallbacks, but lifecycle consistency is not guaranteed.

18. **Two scoring engines can produce different rule behavior.**  
    FriendlyMatchStore supports more formats and undo; PlayView uses a simpler engine. The same ladder rules can therefore score differently depending on entry path.

19. **Fixed loading delays hide actual readiness.**  
    Every route transition pays a visual delay even when local data is already available.

20. **The build is a large eager bundle.**  
    Current production output is approximately 720.53 kB JavaScript minified / 220.55 kB gzip and emits Vite’s over-500-kB warning.

## 18. Test, Build, and Deployment State

### Commands

- **npm run dev** — Vite development server.
- **npm test** — Node built-in test runner.
- **npm run build** — production Vite build.
- **npm run preview** — preview production output.
- **npm run format** — Prettier over src using an experimental CLI flag.
- **npm run deploy** — legacy manual gh-pages publication.

### Verified at handoff

- 25 tests passed.
- Production build passed.
- 322 modules transformed.
- Main CSS output was approximately 303.73 kB minified / 49.62 kB gzip.
- Main JS output was approximately 720.53 kB minified / 220.55 kB gzip.
- Build warning: chunk larger than 500 kB.

### Test coverage reality

The suite covers:

- challenge view-state utility;
- tournament creation dates/hours/courts/capacity/counts/seeding/registration payload/security validation;
- selected source-level shell/route/challenge integration expectations.

Several “integration” and shell tests read files as text and use regular expressions. There are no mounted Vue component tests, browser end-to-end tests, accessibility tests, visual regression tests, live localStorage migration tests, or real endpoint tests. The full ApiService lifecycle is not executed by the current test suite.

### Deployment

**.github/workflows/deploy.yml** runs on main, uses Node 20, npm ci, npm run build, and GitHub’s Pages actions.

**vite.config.js** uses **/repository-name/** as production base. **package.json** still names the package “tennis” and homepage **AlexDunia.github.io/tennis/**.

## 19. Legacy and Misleading Code

### Unrouted views

The router does not use:

- **views/RankingsView.vue** — replaced by **views/compete/LadderView.vue**
- **views/ChallengesView.vue** — replaced by **views/compete/ChallengesQueueView.vue**
- **views/CreateChallengeView.vue** — replaced by **views/compete/CompeteChallengeCreateView.vue**
- **views/TournamentHub.vue** — replaced by **views/compete/TournamentsListView.vue**
- **views/AdminSetupView.vue** — replaced by **ClubsView.vue**
- **views/PlayerClubJoinView.vue** — replaced by **MemberOnboardingView.vue**
- **views/DashboardView.legacy.vue**
- **views/BookView.vue**
- **views/MatchesView.vue**

**MatchesView.vue** is particularly stale: it expects MatchStore computed values/actions such as liveMatches, upcomingMatches, createNewMatch, and joinExistingMatch which the current store does not export.

### Unused old tournament creation utilities

These form an older category/player/draw builder and are not used by the current creator:

- **assignPlayersToCategories.js**
- **buildCategoryGroups.js**
- **buildTournamentPayload.js**
- **categoryTemplates.js**
- **tournamentFormatAdvisor.js**
- **validateTournamentSetup.js**

Some may contain reusable ideas for the future registration-to-draw step, but they should not be reactivated wholesale without reconciling their old schema with **tournamentCreation.js** and the registration-stage payload.

### Documentation traps

- **README.md** is still the default Vue starter readme.
- Root architecture/feature docs were last materially updated before the August milestone.
- **docs/TOURNAMENT_CREATION_RULES.md** describes a superseded wizard.
- **docs/TOURNAMENT_APP_HANDOFF_FOR_CLAUDE.md** is tournament-era historical context, not the current whole-app handoff.
- **docs/AUTHORIZATION_BACKEND_CONTRACT.md** is aspirational and not fully aligned with active roles.
- Product screenshots and rehearsal scripts demonstrate selected local seeded states, not guaranteed current flows.

## 20. Development Rules Implied by the Current Code

- Start from **src/router/index.js** to identify the active view before editing a similarly named file.
- Preserve the shared shell for normal app tasks. Use focused/immersive metadata only for genuinely concentrated flows.
- Treat active club plus membership role as part of every club-domain request.
- Keep a single source of truth for a domain transition; do not add another local persistence island.
- New tournament work must build on **tournamentCreation.js** schema-v2 output, not the old TournamentCreate implementation.
- Mutation permission must move into the future backend/service boundary, not remain button-only.
- Do not claim an invitation, notification, or live update is shared until the underlying record is server-backed.
- Reuse the shared EmptyState, PersonAvatar, ToastShelf, route skeleton, Compete shell, tournament components, and visual tokens.
- Match scoring should be config-driven and shared across PlayView and FriendlyMatchStore.
- Preserve form input after validation failure and state the effect of destructive/publishing actions.
- Add tests that execute logic rather than only checking source strings.
- Be careful with localStorage migrations; the app has real compatibility behavior between club directory v2 and setup v1.
- Avoid adding new work to legacy views/components merely because their names look canonical.

## 21. CURRENT HANDOFF

Development stopped at commit **b7fb942**, the “Gorra milestone before Codex handoff.” That milestone did three major things:

1. Rebuilt tournament creation into the current Details -> Where & when -> Events -> Review workflow, with autosaved drafts, reusable setups, validation, estimates, and registration-stage schema-v2 publication.
2. Replaced the older challenge creation/queue continuity with a direct Compete creator and exact Challenge Details lifecycle.
3. Realigned the shared layout and added the current 25-test suite.

At the moment of this handoff:

- **main** matched **origin/main** before this context file was added.
- Tests and build passed.
- The active tournament creator is complete through publication.
- Publication deliberately stops before entrant registration, draw creation, fixture creation, and court reservation.
- Existing seeded tournament operation remains functional because its categories/groups/fixtures are prebuilt.
- The newest challenge lifecycle is locally functional, but its participant-to-live-score permission and scoring-engine integration are not complete.

### Where development should continue

The main feature continuation is the bridge from a newly published registration-stage tournament to an operational tournament.

Implement it in this order:

1. **Add a canonical registration/entrant model.**  
   Extend the tournament schema and mock/service surface with registrations per event, singles versus team/partner identity, eligibility answers, status, timestamps, and admin approval. Scope every record by tournament and active club.

2. **Add member registration and admin entrant management.**  
   Put member Register/Withdraw actions and admin Manage entrants/registration state on **TournamentOverview.vue**. Add service/store methods rather than writing directly in the view.

3. **Add Close registration -> Review seeding -> Create draw.**  
   Convert approved entrants into category players/groups/knockout according to each event’s format, capacity, and seeding configuration. Reuse algorithms from the old tournament utilities only after adapting them to the schema-v2 event payload. Flip **registrationStage** off and **actualDrawCreated/drawCreated** on atomically.

4. **Generate fixtures and then schedule/reserve courts.**  
   Use the actual venue court ids/names and create bookings/reservations with clubId, venueId, courtId, start/end, and conflict enforcement. Replace the current first-court booking approximation and hardcoded schedule filters.

5. **Add executable tests for the entire transition.**  
   Test publish -> register -> approve -> close -> seed -> draw -> fixtures -> schedule using actual service calls and persisted state, not only source regex.

Before or alongside that feature, apply these small but blocking stabilizations:

- allow an authenticated match participant to enter **PlayMatch**, while keeping tournament/admin scoring authority separate;
- make PlayView instantiate its scorer from the locked challenge/tournament match config;
- remove the play-now ladder defender impersonation shortcut;
- connect MemberOnboarding to the same AdminService membership model or clearly disable it until a backend exists;
- filter tournament lists/details/mutations by active club;
- fix the noad comparison, profile challenge filtering, History match shape, dynamic court filters, and GitHub Pages deep-link restoration.

After those local contracts are coherent, the next architectural milestone should be replacing **ApiService.js** and the local identity/invite flows with a real backend. The proposed SQL and authorization docs are a starting point, but the backend contract must be updated to include active **club_admin**, club-scoped permissions, registration/draw endpoints, authenticated actor identity, transactional ladder movement, file storage, notifications, and realtime/versioned match updates.

The key warning for the next AI is: do not spend the next cycle polishing another creation screen or reviving an old tournament wizard. The current creator already does its job. Continue from its schema-v2 registration-stage output and make that new record become a real, operable tournament.
