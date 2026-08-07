# GORRA - Product Features and Workflows

Status of this document: **Implemented** as a repository-grounded description of the current frontend prototype. Last verified against the repository on 2026-07-30.

Related documents: [technical architecture](ARCHITECTURE.md) and [UI psychology, motion, and visual discipline](docs/GORRA_UI_PSYCHOLOGY_AND_MOTION_SYSTEM.md).

## Status vocabulary

- **Implemented** - connected to an active route or an active routed flow and usable with the current local/mock data layer.
- **Partially implemented** - connected, but an important transition, permission, persistence path, or state is incomplete.
- **Prototype or mock** - deliberately simulated in the browser; it is not evidence of a production backend.
- **Planned** - represented as product direction or configuration, but not delivered as an end-to-end workflow.
- **Legacy or inactive** - present in the repository but not used by the active router/import graph.
- **Needs verification** - the repository contains a contradiction or cannot establish the intended business decision.

## What GORRA is

GORRA is a responsive tennis-club workspace for public discovery, club membership, ladders, challenges, friendly matches, live scoring, tournaments, club administration, notifications, and personal records. It serves one shared club context rather than splitting players and administrators into unrelated products.

The current runtime is a frontend prototype. Vue routes, Pinia stores, an Axios mock adapter, and browser storage provide working flows and durable local demo state. There is no production identity provider, authoritative remote database, file store, or server-enforced club tenancy.

Two data experiences are selectable at sign-in:

- A normal player sign-in defaults to an empty/fresh account experience with a fresh ladder roster and no tournaments.
- Club-admin sign-in always selects demo data. A player can also opt into demo data.

Implementation: `REF-AUTH`, `REF-DATA`.

## Who GORRA serves

| Actor | Runtime identity | Purpose and landing area | Active capabilities | Important restriction | Status |
| --- | --- | --- | --- | --- | --- |
| Public visitor | No session | Learn what GORRA does at `/`; enter at `/signin` or `/signup` | View landing content and choose Player or Club admin | All other routes redirect to sign-in | **Implemented**, public content only |
| Authenticated player/member | Global role `player`; club membership role usually `player` | `/dashboard`; Home, Play, Compete, Club | View ladder/tournaments/club, create eligible challenges, create friendly matches, score connected matches, view notifications/profile/history | Club join onboarding is simulated and does not add a persisted club-directory membership | **Partially implemented** |
| Club admin | Global role `club_admin`; active-club membership `admin` or `co-admin` | Setup at `/admin/setup` or `/clubs`, then shared `/dashboard` | Create/join/switch clubs, manage club setup, create tournaments, edit tournament scores/schedules/gallery, use all player areas | Authority is local-browser logic, not a backend security boundary | **Prototype or mock** |
| Co-admin | Active-club membership `co-admin` | Same shared shell for a club the user has joined | Receives active-club manager permissions | No sign-in option creates this role directly; it comes from stored membership/invite data | **Partially implemented** |
| Tournament admin | Global role `tournament_admin` exists in access control | Intended tournament management | Permission list includes tournament management and live scoring | Not selectable in the active login UI; an unconfigured tournament admin can bounce between admin setup and dashboard because it lacks `club.manage` | **Needs verification** |
| Super admin | Global role `super_admin` exists in access control | Broad prototype administration | Wildcard permission | Not selectable in the active login UI and has no dedicated product area | **Prototype or mock** |
| Owner | No role exists | Not established by the repository | None | Do not treat a club admin as an owner without a product decision | **Planned / Needs verification** |

Global roles and active-club roles are separate. Global role checks protect `/admin/setup` and `/clubs`; active-club membership checks protect club settings, tournament creation, tournament editing, and the routed live scoreboard. Most member read routes require only authentication and do not explicitly check their nominal `*.view` permissions.

Implementation: `REF-AUTH`, `REF-CLUB`.

## Role and capability matrix

| Capability | Public | Player/member | Club admin or co-admin | Enforcement today |
| --- | ---: | ---: | ---: | --- |
| Landing, sign-in, sign-up | Yes | Yes | Yes | Public route metadata |
| Shared Home, Play, Compete, Club shell | No | Yes | Yes | Authentication guard |
| View ladder, challenges, and tournaments | No | Yes | Yes | Authentication only; view permissions are not checked on these routes |
| Create a ladder challenge | No | Yes, when eligible | Yes, when eligible as the active player | UI eligibility plus mock API validation |
| Accept or decline a challenge | No | Challenged player only | Same participant rule | Mock API checks `actorId` |
| Submit a ladder result | No | Match participant only | Same participant rule | Mock API checks `submittedBy`; the dedicated Match Details form omits it and currently fails |
| Confirm a ladder result | No | Other match participant only | Same participant rule | Mock API checks actor and pending-review state; active queue has no confirm button |
| Create and score friendly matches | No | Yes | Yes | Local draft-owner checks only |
| View club overview, members, rules | No | Yes | Yes | Authentication only |
| Create/join/switch clubs through admin flow | No | No through the active player onboarding | Yes | Global `club.manage` plus AdminService checks |
| Manage club settings | No | No | Yes for active club | Route and service both check manager membership locally |
| Create tournament | No | No | Yes for active club | Active-club `tournaments.manage` route check |
| Enter/edit tournament score, schedule, or gallery | No | View only | Yes for active club | UI checks active-club permissions; mock API handlers do not re-check actor authority |
| Live scoreboard route | No | No by route permission, despite being a match participant | Yes for active club | Active-club `matches.live_score`; this is stricter than the player-facing Play hub implies |

## Reference Map

- `REF-PUBLIC` - active public experience: `src/views/LandingView.vue`, `src/assets/landing.css`, `src/views/LoginView.vue`, `src/router/index.js`.
- `REF-AUTH` - session, roles, permissions, and guards: `src/stores/auth.js`, `src/composables/useAuth.js`, `src/utils/auth/accessControl.js`, `src/router/index.js`, `src/views/LoginView.vue`.
- `REF-SHELL` - shared member/admin shell and route feedback: `src/App.vue`, `src/layouts/DefaultLayout.vue`, `src/components/RoutePageSkeleton.vue`, `src/components/ToastShelf.vue`, `src/components/compete/CompeteSectionShell.vue`.
- `REF-DATA` - data-mode and mock persistence foundation: `src/dataMode.js`, `src/services/ApiService.js`, `src/services/api.js`, `src/data/freshAccountLadder.js`.
- `REF-CLUB` - club directory, active-club membership, onboarding, overview, and settings: `src/views/ClubsView.vue`, `src/views/MemberOnboardingView.vue`, `src/views/ClubView.vue`, `src/views/SettingsView.vue`, `src/stores/admin.js`, `src/services/AdminService.js`, `src/config/admin.js`, `src/utils/admin/clubSetup.js`, `src/utils/onboarding/clubInvitation.js`, `src/utils/onboarding/rosterImport.js`, `src/utils/onboarding/parseRosterCsv.js`.
- `REF-HOME` - personalized member/admin command surface: `src/views/DashboardView.vue`, `src/components/charts/PerformanceChart.vue`, `src/components/friendly/FriendlyMatchHome.vue`, plus the stores in `REF-LADDER`, `REF-MATCH`, `REF-TOURNAMENT`, and `REF-NOTIFY`.
- `REF-LADDER` - roster, position, challenge eligibility, and movement rules: `src/views/compete/LadderView.vue`, `src/stores/player.js`, `src/services/PlayerService.js`, `src/config/ladder.js`, `src/services/LadderAccessService.js`, `src/services/ApiService.js`.
- `REF-CHALLENGE` - challenge queue and state changes: `src/views/compete/ChallengesQueueView.vue`, `src/stores/challenge.js`, `src/services/ChallengeService.js`, `src/services/ApiService.js`, `src/config/ladder.js`.
- `REF-FRIENDLY` - friendly/ladder creation, invitation, custom format, and local scoring flow: `src/views/PlayHubView.vue`, `src/views/FriendlyMatchFlowView.vue`, `src/stores/friendlyMatch.js`, `src/components/friendly/FriendlyMatchHome.vue`, `src/components/friendly/MatchResultModal.vue`, `src/components/friendly/FlowIcon.vue`, `src/services/LadderAccessService.js`.
- `REF-MATCH` - shared match list, live scoreboard, result entry, and persisted live state: `src/views/PlayView.vue`, `src/views/MatchDetailsView.vue`, `src/components/TennisScoreboard.vue`, `src/stores/match.js`, `src/services/MatchService.js`, `src/services/ApiService.js`, `src/utils/tennisScoring.js`.
- `REF-TOURNAMENT` - tournament creation and competition lifecycle: `src/views/compete/TournamentsListView.vue`, `src/views/TournamentCreate.vue`, `src/views/TournamentOverview.vue`, `src/views/TournamentCategory.vue`, `src/views/TournamentSchedule.vue`, `src/stores/tournament.js`, `src/services/TournamentService.js`, `src/composables/useTournamentFixtures.js`, `src/composables/useTournamentStandings.js`, `src/composables/useBracketBuilder.js`, `src/composables/useTournamentLiveRefresh.js`, `src/utils/tournament/assignPlayersToCategories.js`, `src/utils/tournament/buildCategoryGroups.js`, `src/utils/tournament/buildTournamentPayload.js`, `src/utils/tournament/validateTournamentSetup.js`, `src/utils/tournament/tournamentFormatAdvisor.js`, `src/utils/tournament/categoryTemplates.js`.
- `REF-GALLERY` - tournament folders, lightbox, share, local upload/link data, and removal: `src/views/TournamentGallery.vue`, `src/stores/tournamentGallery.js`, `src/services/TournamentImageService.js`, `src/components/tournament/TournamentGalleryFolder.vue`, `src/components/tournament/TournamentGalleryCard.vue`, `src/components/tournament/TournamentImageAddModal.vue`, `src/components/tournament/TournamentImageLightbox.vue`, `src/services/ApiService.js`.
- `REF-NOTIFY` - stored notifications and transient toasts: `src/views/NotificationsView.vue`, `src/stores/notification.js`, `src/components/ToastShelf.vue`, `src/utils/notificationSound.js`.
- `REF-ACCOUNT` - player profile, account settings, and history: `src/views/ProfileView.vue`, `src/views/AccountSettingsView.vue`, `src/views/HistoryView.vue`, `src/stores/auth.js`, `src/stores/player.js`, `src/stores/challenge.js`, `src/stores/match.js`, `src/stores/booking.js`.
- `REF-BOOKING-LEGACY` - locally persisted booking support not exposed as a booking route: `src/stores/booking.js`, `src/services/BookingService.js`, `src/views/BookView.vue`, `src/components/CourtBookingForm.vue`.

## Product continuity

The active experience follows one shared model:

```text
Public landing or sign-in
-> role/data-mode choice
-> club setup/join step when applicable
-> shared Home / Play / Compete / Club shell
-> user decision
-> routed view or focused flow
-> Pinia store/composable
-> mock service or browser storage
-> local state change
-> toast, notification, skeleton, empty/error state, or next route
```

The active club selector in the shell is the context bridge between member and admin work. The same player, match, challenge, tournament, and club records feed Home, Compete, Play, and Club. This continuity is real within one browser profile, but it is not multi-user or server synchronized.

## Feature catalogue

### Public landing and authentication

Purpose: Explain the product and open a player or club-admin workspace.

Actors: Public visitor; returning player; club admin.

Entry: `/`, `/signin` (alias `/login`), `/signup`.

Main flow: Landing call to action -> sign-in/sign-up -> choose Player or Club admin -> hardcoded prototype identity is written to browser storage -> redirect to requested route, dashboard, member join, or admin setup.

System response: Public metadata is updated; the login shows loading/error feedback; authenticated routes become available.

Rules: Redirect query must be a local path. Club admins always receive demo data. Player sign-up goes to the member join flow; admin sign-up goes to club setup/join.

States: Public page; role unselected; busy; inline error; signed in; empty-data player; demo player/admin.

Permissions: Route guard only; authentication is simulated and has no credential verification.

Connected features: Club onboarding, shared shell, data mode.

Implementation references: `REF-PUBLIC`, `REF-AUTH`, `REF-DATA`.

Status: **Prototype or mock**.

Known gaps: Hardcoded names/emails/player IDs, stale `shell.com` fallback email and ShellTennis welcome copy, no real sign-up, password check, account recovery, or backend session.

### Shared Home dashboard

Purpose: Show the active person's standing, urgent work, tournament context, activity, and next actions.

Actors: Authenticated player/member and admin.

Entry: `/dashboard` or redirect from `/home`.

Main flow: Route -> parallel load of players, challenges, matches, bookings, tournaments -> compute personal/admin summaries -> open a challenge, tournament, category, match, or notification target.

System response: Route-shaped skeleton; fresh-account empty treatment; stats, performance chart, urgent counts, tournament progress, and a combined event feed.

Rules: Player identity comes from the auth store's `playerId`; admin copy changes when the player is not in a draw; the dashboard does not itself mutate competition records.

States: Loading; empty/fresh account; populated demo; query-driven empty preview; missing active tournament; personal tournament placement; admin tournament attention; access-message query.

Permissions: Authentication only. Links may lead to more restricted routes.

Connected features: Ladder, challenges, matches, tournaments, notifications, bookings.

Implementation references: `REF-HOME`, `REF-SHELL`.

Status: **Implemented** on prototype data.

Known gaps: Some motivational copy is inferred from win rate rather than a backend insight; booking contributes data but has no active booking route.

### Club membership and active club

Purpose: Give every authenticated user a club context and allow managers to create, join, switch, and configure clubs.

Actors: Player/member; club admin; co-admin.

Entry: Player `/onboarding/join-club`; admin `/admin/setup` or `/clubs`; shared `/club`; manager `/settings` (alias `/club/settings`).

Main flow: Admin can create a three-step club setup (basics, member source, starting ladder), publish it, join by invite, and switch clubs. The shared Club page exposes overview, deduplicated members, and rule summaries. Managers open Manage to edit club details, members, ladders, rules, invites, account data, and a simulated password.

System response: Active-club header/switcher, setup progress, validation, QR/invite data, save toasts, loading/error/empty states, and role-sensitive Manage navigation.

Rules: A published club needs validated setup data and at least one active ladder. At least one ladder must remain open; settings limits the list to 12. Member removal/role change tries to retain at least one admin in the editable manual list. Active membership role `admin` or `co-admin` grants manager capabilities.

States: No club; setup start; join; join confirmation; draft steps; configured club; multiple clubs; switching; loading; saving; invalid invite; settings validation error; joined/pending member onboarding.

Permissions: AdminService locally enforces authenticated user IDs, membership access, and manager access. Player onboarding is separate and simulated, so a successful player join does not create this membership record.

Connected features: Shell context, ladder configuration, tournaments, invitations, account.

Implementation references: `REF-CLUB`, `REF-SHELL`, `REF-AUTH`.

Status: Admin directory/settings are **Prototype or mock**; player membership is **Partially implemented**.

Known gaps: No authoritative club tenancy, approval queue, email/SMS delivery, true QR scanning, or persisted player-onboarding join. Excel/PDF are accepted by the onboarding validator but Settings imports only CSV and tells the user other formats can be added later.

### Ladder and ranking context

Purpose: Show the ordered ladder, the current player, points, and eligible opponents.

Actors: Authenticated players and admins acting as the current player.

Entry: `/rankings`; Compete -> Ladder.

Main flow: Load roster -> sort ascending by rank -> highlight current player -> evaluate each opponent against active ladder rules -> challenge action redirects into the ladder-mode friendly flow.

System response: Personal position summary, full ladder rows, challenge buttons only for eligible players, and empty/error treatment.

Rules: Default ladder is active; challenge window is up to three places above; downward challenges are off; inactive/suspended opponents are excluded. Active club rules are intended to override defaults, but `getActiveLadderConfig()` expects stored setup schema version 1 while current setup uses version 2, so defaults usually win.

States: Loading; error; empty roster; current player; challengeable; out of range; disabled challenge.

Permissions: The route requires authentication. Button visibility uses active-club `challenges.create`; the mock challenge endpoint validates eligibility again.

Connected features: Challenge creation, active club rules, dashboard.

Implementation references: `REF-LADDER`, `REF-CLUB`.

Status: **Partially implemented** because club rule override has a schema mismatch.

Known gaps: No ladder selector despite multiple configured ladders; points are display fallbacks and are not the movement source of truth.

### Ladder challenge lifecycle

Purpose: Let a placed player challenge an eligible opponent and move the ladder only after the other participant confirms the result.

Actors: Challenger; challenged player; the other result confirmer.

Entry: Ladder Challenge from Play or `/create-challenge` (redirects to `/ladder-match/type?mode=ladder`); review queue at `/challenges`; result at `/matches/:matchId` or the focused live flow.

Main flow: Check access -> choose now/later and eligible opponent -> lock ladder scoring rules -> create awaiting challenge -> challenged player accepts/declines -> accepted challenge creates a scheduled match -> participant submits result -> other participant confirms -> match/challenge complete and rankings update.

System response: Inline eligibility messages, focused step guards, QR/link for play-now, queue status copy, toasts, and refreshed ladder/match records.

Rules: Active ladder; valid ranks; eligible window; active-challenge maximum; rematch cooldown; defender-only accept/decline; response deadline check at accept time; participant-only result submission; other-participant confirmation; position swap when a lower-ranked challenger wins.

States: Draft; `awaiting`; `scheduled`; `pending_review`; `completed`; `declined`; `cancelled`; `expired`; plus focused-flow `ready`, `live`, and `finished` states.

Permissions: Actor IDs are checked in the mock API for accept, decline, submit, confirm, and withdraw. This is meaningful prototype behavior but not server security.

Connected features: Ladder, focused match creation, live scoring, notifications.

Implementation references: `REF-CHALLENGE`, `REF-FRIENDLY`, `REF-MATCH`, `REF-LADDER`.

Status: **Partially implemented**.

Known gaps: The active challenge queue exposes accept, decline, and open-result actions but not confirm-result or withdraw, even though store/service/adapter functions exist. Automatic expiry is only evaluated during accept; no background expiry or reminder job runs. The standalone Match Details submit omits `submittedBy`, so the mock API rejects it. There is no dispute action or admin resolution flow.

### Friendly match creation and local invitation

Purpose: Start a non-ladder match now or schedule it for later, with a known club opponent and configurable scoring.

Actors: Authenticated player/member or admin as match creator; authenticated joining player.

Entry: `/play` -> friendly match -> focused routes under `/friendly-match/*`.

Main flow: Choose friendly -> now/later -> play-now join link/QR or club opponent -> optional schedule -> advantage/no-ad -> preset, saved, or custom format -> start local live scoring or save a scheduled invitation.

System response: Focused full-height screens, guarded step redirects, join status, copied link feedback, custom-format validation, live point feedback, undo, result modal, and return to dashboard.

Rules: The creator owns and mutates the draft. A join token accepts one different authenticated identity. Play-now invitations expire after 30 minutes when refreshed. Custom formats constrain numeric values; optional saved formats persist locally.

States: `draft`; `waiting_for_opponent`; `waiting_for_acceptance`; `ready`; `live`; `finished`; invitation `completed`, `cancelled`, or `expired`.

Permissions: The join-token route still requires authentication. Draft owner IDs prevent another local identity from scoring, but all records are browser-local.

Connected features: Play hub, live scoring, dashboard.

Implementation references: `REF-FRIENDLY`, `REF-AUTH`.

Status: **Prototype or mock**.

Known gaps: No remote invitation delivery or cross-device state; scheduled friendly invitations do not appear in the shared match service; the opponent catalogue includes hardcoded club players; friendly results remain separate from the canonical match/ladder/tournament records.

### Play hub and live scoring

Purpose: Start a friendly or ladder match and continue an actionable shared match from one Play area.

Actors: Authenticated player/member; active-club manager for the routed shared scoreboard.

Entry: `/play`, focused `/friendly-match/live`, or `/play/:matchId`.

Main flow: Play hub shows up to three current-player matches in pending/scheduled/review states. Starting a new match enters the focused flow. Continuing opens the routed scoreboard, which loads or initializes `liveState`, records points, saves after each point, can change server/theme/fullscreen, polls match data, and submits a completed score.

System response: Immersive shell, elapsed and point clocks, tennis point/set display, completion state, save toast, and link to match details.

Rules: Shared scoreboard uses best-of scoring from `tennisScoring.js`. Point controls stop after a winner. Tournament final submission records structured sets; ladder final submission from this route lacks `submittedBy` and is rejected by the adapter.

States: Loading; not found; ready; live; persisted live state; review; finished; completed/walkover; save error.

Permissions: `/play/:matchId` requires active-club `matches.live_score`, so an ordinary player can see a Continue button on `/play` and then be redirected away. Focused friendly scoring uses only draft-owner checks.

Connected features: Match details, tournament result entry, ladder result review, notifications.

Implementation references: `REF-MATCH`, `REF-FRIENDLY`, `REF-SHELL`.

Status: Tournament/admin scoreboard is **Implemented** on mock persistence; ordinary-player continuity is **Needs verification**.

Known gaps: Polling every two seconds is local prototype synchronization; error feedback from point-save failures is limited; non-tournament live result submission has the actor-payload defect described above.

### Match details and result entry

Purpose: Show a shared match record and provide the correct score action for ladder or tournament matches.

Actors: Match participant; active-club tournament manager.

Entry: `/matches/:matchId` or `/tournaments/:tournamentId/match/:matchId`.

Main flow: Load player/match data -> fetch tournament when relevant -> show matchup/status/schedule -> ladder scheduled match shows winner/score form; tournament match opens a reusable score/schedule modal -> store submits or patches the record -> views refresh.

System response: Loading/not-found state, match summary, disabled or available actions, submitted state, tournament score/update toast.

Rules: Ladder form is only enabled for `scheduled`. Tournament score action allows pending, scheduled, completed, and walkover records for a tournament manager. Tournament results can progress knockout state.

States: Loading; not found; scheduled; pending review; completed; walkover; submitted; editable tournament result.

Permissions: Tournament UI checks score-update permission. The tournament mock endpoint does not validate actor identity. Ladder mock endpoint does, but the form does not provide the required actor.

Connected features: Challenges, live scoreboard, tournament category/schedule.

Implementation references: `REF-MATCH`, `REF-TOURNAMENT`.

Status: Tournament path **Implemented** as mock; ladder path **Partially implemented**.

Known gaps: Ladder score is still accepted as a plain string on this screen; no dispute or correction workflow exists after confirmation.

### Tournament discovery and personal context

Purpose: Let members follow active/completed events and understand their placement, next fixture, standings, bracket, and progress.

Actors: Authenticated members and admins.

Entry: `/tournaments`, then overview/category/schedule/gallery/match routes.

Main flow: Load ordered tournaments -> open overview -> select category -> filter group/status -> inspect fixtures and standings -> open match, live board, schedule, gallery, or bracket.

System response: Active/completed counts, personal seed/group copy, progress metrics, category status, standings, responsive desktop/mobile brackets, filters, empty states, and periodic two-second refresh where enabled.

Rules: Byes are excluded from playable counts. Group standings use points, set difference, game difference, wins, then name. Tournament/category statuses drive round-robin and knockout presentation.

States: Fresh-account empty; loading; error/not found; active/upcoming/completed event; pending/completed/walkover fixture; round robin; knockout; champion; filter-empty.

Permissions: Tournament read routes require authentication but do not explicitly check `tournaments.view`.

Connected features: Dashboard, match details/live score, notifications, gallery.

Implementation references: `REF-TOURNAMENT`, `REF-MATCH`, `REF-HOME`.

Status: **Implemented** on persisted mock tournament data.

Known gaps: Refresh is polling rather than realtime; club isolation is not encoded in tournament records; event completion is not automatically promoted at the tournament level in every path.

### Tournament creation and administration

Purpose: Build a tournament, assign members to divisions, choose a format per category, generate fixtures, record scores, and progress to a champion.

Actors: Active-club admin or co-admin.

Entry: `/tournaments/create`; actions within tournament overview, category, schedule, gallery, match, and live board.

Main flow: Basics and ordered dates -> enable built-in/custom categories -> select and manually adjust players -> choose recommended or alternate category formats -> validate blockers/warnings -> create active tournament -> generate each category's fixtures -> enter scores/schedules -> close round robin -> generate/progress knockout -> champion.

System response: Four-step progress, wide side rails for Players/Review, category counts, assignment warnings, format advice, group preview, blockers, success toast, fixture/schedule updates, and score notifications.

Rules: At least one category; valid dates; selected players; category-specific minimums/format requirements; ladder-sorted snake seeding; optional overlapping special categories; byes where allowed. Formats include round-robin only, final/semifinal group paths, two/four-group knockouts, and direct knockout. Closing round robin uses calculated standings; knockout match completion progresses the bracket.

States: Basics/Categories/Players/Review; invalid/blocked/warning; creating; active; round robin; knockout; completed category; walkover; champion.

Permissions: Tournament create route and manager actions use active-club permissions in the router/UI. The mock tournament endpoints trust calls and are not an independent authority.

Connected features: Roster, ladder ranks, match service, gallery, notifications.

Implementation references: `REF-TOURNAMENT`, `REF-LADDER`, `REF-MATCH`, `REF-NOTIFY`.

Status: **Implemented** as a sophisticated local prototype.

Known gaps: No production scheduling engine, remote concurrency control, audit history, publish/unpublish workflow, or backend permission enforcement. Default category branding is RSP-specific and should be confirmed for a general GORRA product.

### Tournament gallery

Purpose: Organize and share event moments by category.

Actors: Authenticated viewer; active-club manager for add/remove actions.

Entry: `/tournaments/:tournamentId/gallery`; optional `folder` and `image` query state.

Main flow: Load tournament/images -> browse All or category folders -> open lightbox -> move, share, or copy link -> manager adds link or local file with caption/category -> mock storage saves -> manager may remove after confirmation.

System response: Folder covers/counts, responsive image grid, lightbox, Web Share/clipboard fallback, validation/toasts, loading and empty states.

Rules: Link must be safe HTTP(S); upload accepts JPEG/PNG/WEBP/GIF up to 1.5 MB and converts it to a data URL; caption is required; category must belong to the tournament.

States: Loading; no images; folders; selected image; add modal upload/link; validation error; saving; shared/copied; removed.

Permissions: UI uses `tournaments.images.manage`; mock endpoints do not verify actor.

Connected features: Tournament overview and categories.

Implementation references: `REF-GALLERY`, `REF-TOURNAMENT`.

Status: **Prototype or mock**.

Known gaps: Data URLs are stored in localStorage, not an object store; storage quotas and multi-user sharing are not production-safe.

### Notifications and feedback

Purpose: Confirm actions immediately and preserve a readable activity feed.

Actors: Authenticated user.

Entry: Header bell and `/notifications`; toasts appear globally.

Main flow: Stores/views add a toast and/or notification -> tournament match synchronization records event signatures -> header unread badge updates -> feed groups by Today/Yesterday/Earlier -> read, mark all, dismiss, or clear.

System response: Success/info/warning/danger styles, optional score sound, unread dot/count, deduplicated tournament score notifications, empty state.

Rules: Notifications persist in mode-specific browser keys; toasts are transient. Seeded example notifications are disabled.

States: Loading delay; unread/read; grouped feed; empty; toast visible/dismissed.

Permissions: Authentication only; notifications are local to the browser and not user-account records.

Connected features: Dashboard activity, tournament scores, challenge actions.

Implementation references: `REF-NOTIFY`, `REF-HOME`, `REF-SHELL`.

Status: **Implemented** locally.

Known gaps: No delivery channel, server event stream, cross-device sync, notification preferences integration, or durable audit log.

### Profile, account, and history

Purpose: Show personal ladder statistics, edit local identity details, sign out, and review completed matches/bookings.

Actors: Authenticated user.

Entry: Account menu -> `/profile`, `/account/settings`, `/history`.

Main flow: Load player/challenge/match/booking data -> show summary/history -> edit name/email/phone in auth state or run simulated password change -> toast -> sign out when requested.

System response: Loading/empty profile and history states, validation errors, avatar initials, success toasts.

Rules: Email format and password length/number are checked locally. Auth-store persistence writes identity edits to browser storage.

States: Loading; populated; empty; validation error; password busy/success; signed out.

Permissions: Authentication only.

Connected features: Shell account identity, ladder/player statistics, bookings.

Implementation references: `REF-ACCOUNT`, `REF-AUTH`.

Status: Profile and identity editing **Prototype or mock**; password change is **Prototype or mock**.

Known gaps: Profile totals count all loaded challenges instead of only the current player's challenges. Password change waits 300 ms but calls no identity service. History combines active match and legacy booking sources.

## Confirmed lifecycle tables

### Authentication and membership

| Stage | Trigger | Stored/runtime result | Feedback and next step | Status |
| --- | --- | --- | --- | --- |
| Public | Open `/` | No session | Landing -> sign in/sign up | **Implemented** |
| Prototype sign-in | Choose Player or Club admin | `sheltennis-auth` plus selected data mode | Dashboard or requested local redirect | **Prototype or mock** |
| Player sign-up | Choose Player on `/signup` | Auth session created | `/onboarding/join-club` | **Prototype or mock** |
| Player club selection | Search/code/link/QR | Timer changes local view state only | Joined/pending message -> Dashboard | **Partially implemented**; no directory membership |
| Admin sign-up | Choose Club admin | Auth session created | `/admin/setup?view=start` or Join | **Prototype or mock** |
| Admin draft | Create and complete three steps | User draft in club directory localStorage | Progress, validation, save | **Implemented** locally |
| Publish club | Open my club | Active club, admin membership, active-club selection | Dashboard/shared shell | **Implemented** locally |
| Join existing club | Preview and confirm invite | Membership and active club in directory | Toast -> Dashboard | **Implemented** locally for admin flow |

### Invitation lifecycles

| Invitation | Creation | Waiting state | Acceptance | Completion/terminal state | Status |
| --- | --- | --- | --- | --- | --- |
| Club invite | Manager creates/rotates role invite | Enabled token/code stored with club | Admin flow previews and joins; player onboarding does not use AdminService | Membership stored; old same-role invite replaced when rotated | **Partially implemented** |
| Play-now friendly | Creator chooses Now | `waiting_for_opponent`, 30-minute local TTL | Different signed-in user opens token route or creator simulates/chooses opponent | `ready` -> `live` -> `completed`, or `expired/cancelled` | **Prototype or mock** |
| Scheduled friendly | Creator selects opponent/date/format | `waiting_for_acceptance` | No active acceptance UI transition was found | May remain waiting; creator can later start only through draft continuity | **Partially implemented** |
| Ladder challenge | Eligible challenger submits | `awaiting` until response deadline | Defender accepts/declines in Challenges | Scheduled -> pending review -> completed; or declined/expired/cancelled | **Partially implemented** |

### Ladder challenge and match lifecycle

| State | Entered by | Allowed transition | Data effect | Active UI coverage |
| --- | --- | --- | --- | --- |
| Draft | Focused ladder flow | Create | Local draft plus validation | Yes |
| `awaiting` | Mock API challenge creation | Accept, decline, withdraw, expire-on-late-accept | Challenge persisted | Accept/decline yes; withdraw no |
| `scheduled` | Defender accepts | Score/live, withdraw | Match created and linked | Open result yes; live route conflicts with player permission |
| `pending_review` | Participant submits result | Other participant confirms | Score/winner stored; ranking not moved | Open result yes; confirm action missing |
| `completed` | Other participant confirms | No correction workflow | Wins/losses/matches and ladder order update | Read-only display |
| `declined` | Defender declines | None | Challenge retained with timestamp | Displayed |
| `cancelled` | Challenger withdraws | None | Challenge retained | Service exists; active action missing |
| `expired` | Late accept attempt | None | Status changes at that moment | No background transition |

### Friendly match lifecycle

| Stage | Decision/action | State change | Persistence | Feedback |
| --- | --- | --- | --- | --- |
| Type | Friendly | Draft `matchType=friendly` | `gorra.friendlyMatchDraft.v3` | Next focused step |
| Timing | Now / Later | Creates play-now invitation or continues opponent selection | Draft/invitations localStorage | QR/link or opponent list |
| Opponent | Join token or club list | Opponent attached, possibly `ready` | Draft/invitations localStorage | Join announcement |
| Scoring rules | Advantage / No-ad; preset/custom | Format saved | Draft and optional custom-format key | Review summary |
| Live | Start and record/undo points | `live`, then `finished` | Deep-watched draft | Tennis score feedback |
| Finish | Confirm result modal | Result appended; invitation completed; draft reset | `gorra.friendlyMatchResults.v1` | Dashboard |

### Tournament lifecycle

| Stage | Trigger | System result | Status/feedback | Status |
| --- | --- | --- | --- | --- |
| Configure | Four-step creation flow | Basics, categories, assignments, format choices | Validations, warnings, blockers | **Implemented** |
| Create | Generate tournament | Active tournament record persisted | Success toast and overview route | **Implemented** mock |
| Fixtures | Generate per category | Round-robin fixtures added to shared matches | Schedule/category refresh | **Implemented** mock |
| Round robin | Enter completed/walkover scores | Standings recompute | Notifications and progress metrics | **Implemented** mock |
| Close stage | Manager closes round robin | Qualifiers produce knockout, or table winner completes category | Category moves to `knockout` or `completed` | **Implemented** mock |
| Knockout | Enter knockout result | Next bracket participants progress | Bracket refresh | **Implemented** mock |
| Champion | Final or table calculation | Champion ID/name stored on category | Champion card | **Implemented** mock |
| Tournament completion | All categories complete | No single confirmed automatic transition found | **Needs verification** |

## Confirmed business rules

### Ladder

- Rank 1 is highest; the default challenge window is three places above.
- Downward challenges are disabled by default.
- Default maximum active challenges is one per player.
- Default response window is 48 hours; default play window is seven days.
- Default rematch cooldown is seven days.
- Default movement is position swap when the challenger defeats the higher-ranked defender.
- Both players are intended to confirm a result; the submitter cannot confirm their own result.
- Active club setup exposes these rule fields, but current ladder rule lookup has a schema-version mismatch and usually returns `LADDER_CONFIG` defaults.

Implementation: `REF-LADDER`, `REF-CHALLENGE`, `REF-CLUB`.

### Tennis scoring

- Shared scoreboard supports Love/15/30/40, deuce/advantage, games, sets, 6-6 tiebreaks, and match winner calculation.
- Focused friendly scoring supports advantage or no-ad, one set, best of three, 10-point match tiebreak, and bounded custom formats.
- The club default `time-smart` ladder preset is described as two tiebreak sets followed by a 10-point deciding match tiebreak.
- Tournament score records can store structured set payloads, sets/games totals, winner, completed/walkover status, and a formatted score string.

Implementation: `REF-FRIENDLY`, `REF-MATCH`, `REF-TOURNAMENT`.

### Club management

- Membership roles are `admin`, `co-admin`, and `player`.
- A user can access only clubs represented in their local membership records.
- Admin/co-admin membership grants active-club manager permissions.
- A published setup must pass full setup validation and have completed all configured setup steps.
- Settings keeps at least one active ladder, caps ladders at 12, accepts up to 30 courts and 500 manual members in its local build input, and keeps invite history bounded in service storage.

Implementation: `REF-CLUB`.

### Tournament categories and progression

- Built-in RSP categories use ladder range or eligibility; Ladies and Veterans can overlap skill divisions.
- Manual assignments/exclusions override automatic selection and can produce warnings.
- Snake seeding distributes ladder-sorted players across groups.
- Format advice changes by player count and can be overridden by the administrator.
- Group standings rank by configured points and tiebreak sequence.
- Closing the group stage generates knockout structure; completing knockout matches progresses later rounds.

Implementation: `REF-TOURNAMENT`.

## Cross-feature state expectations

| State | Expected product treatment | Current evidence |
| --- | --- | --- |
| Loading | Route-shaped skeleton or local loading copy; controls disabled where mutation is active | Shared `RoutePageSkeleton`; per-view loading flags |
| Empty | Calm icon-led explanation and useful next action when allowed | Shared `EmptyState`, tournament empty states, fresh-account views |
| Error | Human message, retry or safe route where practical | Store errors and per-view fallbacks; coverage varies |
| Disabled | Visibly unavailable with reason in adjacent copy when important | Form/action computed states; some permission redirects only use dashboard query |
| Success | Toast and, for durable activity, notification plus next route | Notification store and routed flows |
| Completed | Read-only status, score/champion/result summary | Challenge, match, tournament, friendly results |
| Mobile | Bottom navigation, shared 85% rail, stacked forms/cards, mobile brackets | Shared shell and view breakpoints |
| Reduced motion | Remove navigation/content/skeleton animations while keeping final state clear | Shared CSS/layout/components; not every view declares an override |

## Persistence visible to users

| Area | Browser key/source | What persists | Caution |
| --- | --- | --- | --- |
| Auth | `sheltennis-auth` | Prototype session and identity | Stale product key; not secure |
| Data mode | `gorra.appDataMode.v1` | Empty/demo selection | Ladder/tournament storage keys are not mode-scoped |
| Club directory | `gorra.admin.clubDirectory.v2` | Clubs, memberships, active club, invites, drafts | Contains private invite data locally |
| Legacy setup mirror | `gorra.admin.clubSetup.v1` | Compatibility setup snapshot | Current schema and ladder reader disagree |
| Ladder mock | `tennis.mock.ladderState.v1` | Players, challenges, non-tournament matches/live state | Local browser only |
| Tournament mock | `tennis.mock.tournamentState.v1` | Tournaments, tournament matches, gallery/data URLs | Local browser only; quota risk |
| Friendly flow | `gorra.friendlyMatchDraft.v3`, `gorra.friendlyMatchInvitations.v1`, `gorra.friendlyMatchResults.v1`, `gorra.friendlyMatchCustomFormats.v1` | Draft, invitations, results, formats | Separate from shared match service |
| Notifications | `tennis.local.notifications.v1` plus `.empty`; match-event signature key | Feed and deduplication state | Not account-scoped |
| Booking | `sheltennis-bookings` plus `.empty` | Local booking list | Feature route inactive |
| Role override | `tennis.local.playerRoles.v1` | Prototype player role overrides | Not a security authority |

## Current gaps and contradictions

1. **Ladder result completion is not reachable end to end from the active queue.** Focused live scoring can submit a result with `submittedBy`; the queue can open pending review but has no confirm action. Match Details submits without `submittedBy` and is rejected.
2. **Player club onboarding is visual only.** It never calls AdminService, so the shell may still have no active-club membership after a success message.
3. **Player Play continuity conflicts with route authorization.** `/play` advertises Continue for a participant, but `/play/:matchId` requires a manager permission.
4. **Club ladder rules generally do not reach ladder eligibility.** Setup is schema version 2 while `getActiveLadderConfig()` accepts only legacy schema version 1.
5. **Permissions are uneven.** Some actions are checked in the adapter, some only in UI/router, and member read routes do not check their nominal view permissions.
6. **Data modes share the same ladder/tournament persistence.** Empty mode filters records by account scope, while demo mode reads all records, so local cross-mode leakage is possible.
7. **Configured clubs and competition data are not joined by club ID.** The active club changes context and permissions, but ladder/tournament mock data is largely global.
8. **Scheduled friendly acceptance is incomplete.** The invitation can be created in `waiting_for_acceptance`, but no connected accept transition was found.
9. **Profile challenge totals are global loaded totals.** They are not filtered to the current player.
10. **Typography/product naming remain mixed in implementation.** ShellTennis storage/copy, Vite title, `tennis` package/repository path, and RSP/demo branding remain; these documents use GORRA consistently without claiming the code is clean.

## Planned product direction - not active behavior

- Real authentication, recovery, durable accounts, and server sessions.
- Authoritative club tenancy and a persisted player membership approval/invite workflow.
- Server-enforced roles/permissions for every read and mutation.
- Email/SMS/push invitation and notification delivery.
- Automatic challenge expiry, reminders, result-confirmation deadline, and auto-confirm rules.
- Dispute creation, ranking freeze, admin resolution, audit history, and any monthly limits.
- Connected court booking inside the active router.
- Remote object storage and moderation for tournament media.
- Realtime or event-driven match/tournament synchronization instead of polling/localStorage.
- A confirmed owner role and owner-specific safeguards, if the product requires one.

## Legacy or inactive product surfaces

- `src/views/RankingsView.vue`, `src/views/ChallengesView.vue`, and `src/views/TournamentHub.vue` are older alternatives; active routes use the `src/views/compete/*` versions.
- `src/views/CreateChallengeView.vue` contains an older standalone form; `/create-challenge` redirects to the focused ladder-match flow.
- `src/views/AdminSetupView.vue` is not routed; `/admin/setup` renders `ClubsView.vue`.
- `src/views/PlayerClubJoinView.vue` is not routed; player onboarding renders `MemberOnboardingView.vue`.
- `src/views/BookView.vue`, `src/components/CourtBookingForm.vue`, and booking service/store are not exposed as a booking route.
- `src/views/MatchesView.vue` is not routed and expects match-store APIs that do not exist.
- `src/components/NavBar.vue`, `ChallengeCard.vue`, `PlayerCard.vue`, `RankingRow.vue`, and `CountdownTimer.vue` belong to older/inactive screen paths unless imported by another active file.
- `src/stores/counter.js` is a scaffold demo store.
- Older documents under `styling.md`, `logic.md`, and several tournament handoff/walkthrough files retain ShellTennis naming and must not override active code or these three core documents.

Implementation: exact active route ownership is documented in [architecture](ARCHITECTURE.md).

## Questions needing confirmation

- **Needs verification:** Should an ordinary match participant be allowed onto `/play/:matchId`, or is live scoring intentionally manager-only?
- **Needs verification:** Should player club onboarding create an immediate membership, an approval request, or only validate an invitation before a backend completes it?
- **Needs verification:** Is `tournament_admin` a supported product role? If yes, its setup redirect/permission loop and active-club membership model need definition.
- **Needs verification:** Is a distinct club owner role required, or are admin/co-admin the final authority model?
- **Needs verification:** Should RSP category names/templates remain a first-class GORRA preset or become club-specific demo content?
- **Needs verification:** Which configured club ladder should feed the current player/competition stores when a user switches active club?

## Product handoff summary

Treat GORRA as one responsive club workspace with shared Home, Play, Compete, and Club context. Treat authentication, club storage, ladder/match/tournament APIs, invitations, notifications, and gallery uploads as browser-based prototype infrastructure. Do not call a field, status, role, permission, timer, dispute rule, or backend behavior active unless it is connected through the files in the Reference Map and the active router.
