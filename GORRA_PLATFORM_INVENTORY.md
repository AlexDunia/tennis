# GORRA Platform Inventory

Inspection-only repository map captured from the current Gorra frontend working tree.

## A. Current `src` tree

Binary landing images under `assets/landing/` are omitted.

```text
src/
├── App.vue
├── main.js
├── dataMode.js
├── assets/
│   ├── landing-v2.css
│   ├── landing.css
│   ├── main.css
│   ├── tournament-creation.css
│   └── tournament.css
├── components/
│   ├── AppLogo.vue
│   ├── BaseButton.vue
│   ├── BaseInput.vue
│   ├── ChallengeCard.vue
│   ├── CountdownTimer.vue
│   ├── CourtBookingForm.vue
│   ├── EmptyState.vue
│   ├── MatchCard.vue
│   ├── NavBar.vue
│   ├── PersonAvatar.vue
│   ├── PlayerCard.vue
│   ├── RankingRow.vue
│   ├── RoutePageSkeleton.vue
│   ├── TennisScoreboard.vue
│   ├── ToastShelf.vue
│   ├── challenges/
│   │   ├── ChallengeEmptyState.vue
│   │   ├── ChallengeSkeleton.vue
│   │   └── FreshAccountSetupGuide.vue
│   ├── charts/PerformanceChart.vue
│   ├── compete/
│   │   ├── CompeteSectionShell.vue
│   │   └── TennisNavIcon.vue
│   ├── dashboard/
│   │   ├── ClubActivityCard.vue
│   │   ├── ClubOpportunityBanner.vue
│   │   ├── HomePrioritySlot.vue
│   │   └── MemberLadderSnapshot.vue
│   ├── friendly/
│   │   ├── FlowIcon.vue
│   │   ├── FriendlyMatchHome.vue
│   │   └── MatchResultModal.vue
│   ├── landing/LandingProductPreview.vue
│   ├── match/
│   │   ├── ChairUmpireDialog.vue
│   │   ├── CompletedMatchResult.vue
│   │   ├── LiveMatchControl.vue
│   │   └── LiveScoreboard.vue
│   └── tournament/
│       ├── BracketNode.vue
│       ├── BracketTree.vue
│       ├── BracketTreeMobile.vue
│       ├── CategoryCard.vue
│       ├── CategoryStatusBadge.vue
│       ├── KnockoutChampionCard.vue
│       ├── MatchFixtureCard.vue
│       ├── MatchFixtureRow.vue
│       ├── StandingsTable.vue
│       ├── TournamentCard.vue
│       ├── TournamentEmptyState.vue
│       ├── TournamentGalleryCard.vue
│       ├── TournamentGalleryFolder.vue
│       ├── TournamentImageAddModal.vue
│       ├── TournamentImageLightbox.vue
│       ├── TournamentMatchModal.vue
│       └── creation/
│           ├── TournamentCourtDialog.vue
│           ├── TournamentDetailsStep.vue
│           ├── TournamentEventDialog.vue
│           ├── TournamentEventsStep.vue
│           ├── TournamentReviewStep.vue
│           ├── TournamentSetupDialog.vue
│           └── TournamentWhereWhenStep.vue
├── composables/
│   ├── useAuth.js
│   ├── useBracketBuilder.js
│   ├── useTournamentFixtures.js
│   ├── useTournamentLiveRefresh.js
│   └── useTournamentStandings.js
├── config/
│   ├── admin.js
│   ├── branding.js
│   ├── currentPlayer.js
│   └── ladder.js
├── data/
│   ├── dashboard.js
│   └── freshAccountLadder.js
├── layouts/DefaultLayout.vue
├── router/index.js
├── services/
│   ├── AdminService.js
│   ├── api.js
│   ├── ApiService.js
│   ├── BookingService.js
│   ├── chairUmpireService.js
│   ├── ChallengeService.js
│   ├── LadderAccessService.js
│   ├── liveMatchRealtime.js
│   ├── liveOperationsRegistry.js
│   ├── MatchService.js
│   ├── PlayerService.js
│   ├── TournamentImageService.js
│   ├── TournamentService.js
│   ├── TournamentSetupService.js
│   └── tvPairingService.js
├── stores/
│   ├── admin.js
│   ├── auth.js
│   ├── booking.js
│   ├── challenge.js
│   ├── counter.js
│   ├── friendlyMatch.js
│   ├── match.js
│   ├── notification.js
│   ├── player.js
│   ├── tournament.js
│   └── tournamentGallery.js
├── utils/
│   ├── chairUmpire.js
│   ├── dateFormat.js
│   ├── formSafety.js
│   ├── liveOperationsSnapshot.js
│   ├── liveScoreboardSnapshot.js
│   ├── notificationSound.js
│   ├── resultShareCard.js
│   ├── tennisAnnouncements.js
│   ├── tennisScoring.js
│   ├── tvPairing.js
│   ├── admin/clubSetup.js
│   ├── auth/accessControl.js
│   ├── challenge/challengeLifecycle.js
│   ├── homePriority/
│   │   ├── liveMatchPriority.js
│   │   ├── readyMatchPriority.js
│   │   ├── resolveHomePriority.js
│   │   └── resultReviewPriority.js
│   ├── onboarding/
│   │   ├── clubInvitation.js
│   │   ├── parseRosterCsv.js
│   │   └── rosterImport.js
│   └── tournament/
│       ├── assignPlayersToCategories.js
│       ├── buildCategoryGroups.js
│       ├── buildTournamentPayload.js
│       ├── categoryTemplates.js
│       ├── tournamentCreation.js
│       ├── tournamentFormatAdvisor.js
│       └── validateTournamentSetup.js
└── views/
    ├── AccountSettingsView.vue
    ├── AdminSetupView.vue
    ├── BookView.vue
    ├── ChairUmpireInvitationView.vue
    ├── ChallengeDetailsView.vue
    ├── ChallengesView.vue
    ├── ClubsView.vue
    ├── ClubView.vue
    ├── CreateChallengeView.vue
    ├── DashboardView.legacy.vue
    ├── DashboardView.vue
    ├── FriendlyMatchFlowView.vue
    ├── HistoryView.vue
    ├── LandingView.legacy-2026-08.vue
    ├── LandingView.vue
    ├── LiveOperationDetailView.vue
    ├── LiveOperationsView.vue
    ├── LiveScoreboardView.vue
    ├── LoginView.vue
    ├── MatchDetailsView.vue
    ├── MatchesView.vue
    ├── MemberOnboardingView.vue
    ├── NotificationsView.vue
    ├── PlayerClubJoinView.vue
    ├── PlayHubView.vue
    ├── PlayView.vue
    ├── ProfileView.vue
    ├── RankingsView.vue
    ├── SettingsView.vue
    ├── TournamentCategory.vue
    ├── TournamentCreate.vue
    ├── TournamentGallery.vue
    ├── TournamentHub.vue
    ├── TournamentOverview.vue
    ├── TournamentSchedule.vue
    ├── TvDisplayLiveView.vue
    ├── TvDisplayPairingView.vue
    ├── TvDisplayPairView.vue
    └── compete/
        ├── ChallengesQueueView.vue
        ├── CompeteChallengeCreateView.vue
        ├── LadderView.vue
        └── TournamentsListView.vue
```

There is no current `src/api/` directory. API behavior lives under `src/services/`.

## B. Authoritative file map

“Authoritative” means active in the router/import graph or directly responsible for persistence/domain transitions.

### App shell

- Root/bootstrap: `src/App.vue`, `src/main.js`
- Layout, sidebar, header/top navigation, mobile bottom navigation and active-club selector: `src/layouts/DefaultLayout.vue`
- Club switching/state: `src/stores/admin.js`
- Competition sub-navigation: `src/components/compete/CompeteSectionShell.vue`
- Notification badge/toasts: `DefaultLayout.vue`, `src/components/ToastShelf.vue`
- `src/components/NavBar.vue` is not imported by the active shell.

### Identity/auth

- Current user/session: `src/stores/auth.js`
- Login: `src/views/LoginView.vue`
- Auth wrapper: `src/composables/useAuth.js`
- Hardcoded player identity: `src/config/currentPlayer.js`
- Current player/profile/roster: `src/stores/player.js`
- Player retrieval: `src/services/PlayerService.js`
- Roles/permissions: `src/utils/auth/accessControl.js`
- Guards: `src/router/index.js`
- User-to-player mapping: `auth.user.playerId` → `player.currentPlayerId`, with `APP_CURRENT_PLAYER` fallback/override.

Authentication is simulated and persisted under `sheltennis-auth`.

### Club context

- Active club, memberships and active-club role: `src/stores/admin.js`
- Directory, switching, invitations and persistence: `src/services/AdminService.js`
- Setup schema/defaults: `src/config/admin.js`
- Normalization/validation: `src/utils/admin/clubSetup.js`
- Real local create/join/switch UI: `src/views/ClubsView.vue`
- Club display: `src/views/ClubView.vue`
- Member-facing onboarding: `src/views/MemberOnboardingView.vue`

`ClubsView.vue` mutates the local directory through AdminStore. `MemberOnboardingView.vue` only simulates joined/pending status and does not call AdminService.

### Settings

- Club, members, ladders, rules and embedded account section: `src/views/SettingsView.vue`
- Club settings owner: `src/stores/admin.js` → `src/services/AdminService.js`
- Club schema: `src/config/admin.js`
- Separate account settings: `src/views/AccountSettingsView.vue`
- Account persistence: `src/stores/auth.js`
- Ladder/match rule projection: `src/config/ladder.js`
- Empty/demo application mode: `src/dataMode.js`
- Tournament setup drafts/templates: `src/services/TournamentSetupService.js`

Club notification preferences exist in `setup.workspace.notifications`, but no active delivery subsystem consumes them.

### Dashboard/Home

- Routed dashboard: `src/views/DashboardView.vue`
- Fixture data: `src/data/dashboard.js`
- Dynamic player name/rank/count: `src/stores/player.js`
- Present but not imported by the current dashboard: `components/dashboard/HomePrioritySlot.vue`, `MemberLadderSnapshot.vue`, `ClubActivityCard.vue`, `ClubOpportunityBanner.vue`
- Attention resolvers under `src/utils/homePriority/` are not wired into the routed dashboard.
- Previous implementation: `src/views/DashboardView.legacy.vue`

The current Dashboard uses `dashboardFixture.activeClub` rather than `AdminStore.activeClub`.

### Play/match setup

- Play Hub: `src/views/PlayHubView.vue`
- Friendly/Ladder setup flow: `src/views/FriendlyMatchFlowView.vue`
- Setup, invitations, readiness, scheduling, live state and results: `src/stores/friendlyMatch.js`
- Match Control: `src/components/match/LiveMatchControl.vue`
- Friendly result UI: `src/components/friendly/MatchResultModal.vue`, `src/components/match/CompletedMatchResult.vue`
- Challenge/API-backed live match: `src/views/PlayView.vue`
- Match detail/result review: `src/views/MatchDetailsView.vue`

There are two active live-match paths: FriendlyMatchFlow/FriendlyMatchStore and PlayView/MatchStore.

### Match data/scoring

- Match collection: `src/stores/match.js`
- Service façade: `src/services/MatchService.js`
- Mock transitions/persistence: `src/services/ApiService.js`
- Shared scoring engine: `src/utils/tennisScoring.js`
- Friendly live persistence/authority: `src/stores/friendlyMatch.js`
- Read-only scoreboard: `src/views/LiveScoreboardView.vue`, `src/components/match/LiveScoreboard.vue`
- Snapshots: `src/utils/liveScoreboardSnapshot.js`, `src/utils/liveOperationsSnapshot.js`
- Cross-tab sync: `src/services/liveMatchRealtime.js`
- Operations projection: `src/services/liveOperationsRegistry.js`
- Owner/scorer authority: primarily `src/stores/friendlyMatch.js`
- Chair umpire: `src/services/chairUmpireService.js`, `src/utils/chairUmpire.js`
- TV pairing: `src/services/tvPairingService.js`, `src/utils/tvPairing.js`

### Ladders

- Routed Ladder: `src/views/compete/LadderView.vue`
- Roster/ranking: `src/stores/player.js` → `PlayerService.js` → `ApiService.js`
- Rules/eligibility: `src/config/ladder.js`, `src/services/LadderAccessService.js`
- Ranking movement: `src/services/ApiService.js`
- Fresh-account filtering: `src/data/freshAccountLadder.js`
- Club ladder definitions: `src/stores/admin.js` / club setup
- `src/views/RankingsView.vue` is not the current `/rankings` component.

There is no dedicated ladder store. Club ladder definitions and the global mock ranking are only partially connected.

### Challenges

- Queue: `src/views/compete/ChallengesQueueView.vue`
- Creation: `src/views/compete/CompeteChallengeCreateView.vue`
- Details/actions: `src/views/ChallengeDetailsView.vue`
- Store/service: `src/stores/challenge.js` → `src/services/ChallengeService.js`
- Actual lifecycle mutations: `src/services/ApiService.js`
- Lifecycle/readiness helper: `src/utils/challenge/challengeLifecycle.js`
- Result submission: MatchStore/MatchService
- Review/ranking consequence: ChallengeStore → ChallengeService → ApiService

`ChallengesView.vue`, `CreateChallengeView.vue` and `ChallengeCard.vue` belong to an older unrouted presentation.

### Tournaments

- List: `src/views/compete/TournamentsListView.vue`
- Creation: `src/views/TournamentCreate.vue` and `src/components/tournament/creation/*`
- Runtime views: `TournamentOverview.vue`, `TournamentCategory.vue`, `TournamentSchedule.vue`, `TournamentGallery.vue`
- State/service/persistence: `src/stores/tournament.js` → `TournamentService.js` → `ApiService.js`
- Draft/templates: `src/services/TournamentSetupService.js`
- Creation calculations: `src/utils/tournament/tournamentCreation.js`
- Fixtures/standings/brackets/refresh: `useTournamentFixtures.js`, `useTournamentStandings.js`, `useBracketBuilder.js`, `useTournamentLiveRefresh.js`
- Gallery: `src/stores/tournamentGallery.js`, `TournamentImageService.js`
- `src/views/TournamentHub.vue` is not the current list route.

Creation publishes registration-stage data, but entrant sign-up, approval, registration close and later draw generation are not implemented.

### Club administration

- Setup/create/join/switch: `ClubsView.vue`
- Member edit/import/invite/roles: `SettingsView.vue`
- Membership/invites: `AdminService.js`
- CSV/import helpers: `parseRosterCsv.js`, `rosterImport.js`
- Invitation parsing/search fixture: `clubInvitation.js`
- Fees/payments: no implementation; only an unavailable Dashboard fixture.

### Operations

- List/detail: `LiveOperationsView.vue`, `LiveOperationDetailView.vue`
- Registry/snapshots: `liveOperationsRegistry.js`, `liveOperationsSnapshot.js`
- Underlying authority: `friendlyMatch.js`
- Admin takeover: detail view → `emergencyOverrideScoringAuthority`
- Chair umpire/TV: `chairUmpireService.js`, `tvPairingService.js`
- No separate Operations store exists.

### Notifications/attention/activity

- Store/screen/badge/toasts: `notification.js`, `NotificationsView.vue`, `DefaultLayout.vue`, `ToastShelf.vue`
- Sound: `notificationSound.js`
- Attention helpers: `utils/homePriority/*`
- Activity fixture: `data/dashboard.js`

Only tournament score changes are consistently converted to durable notifications. Current challenge/friendly flows mainly use transient toasts.

### Shared data layer

- Axios mock backend: `src/services/ApiService.js`
- Fake request/ID/time helper: `src/services/api.js`
- Data mode: `src/dataMode.js`
- Club local backend: `AdminService.js`
- Friendly local backend: `friendlyMatch.js`
- Realtime/local sync: `liveMatchRealtime.js`, `liveOperationsRegistry.js`
- Fixtures: `data/dashboard.js`, `data/freshAccountLadder.js`, and ApiService seeds
- Common domain code: `src/utils/*`, `src/composables/*`

### Project context

- Whole-project handoff: `GORRA_PROJECT_CONTEXT.md`
- Architecture/features: `ARCHITECTURE.md`, `APP_FEATURES.md`
- Older references: `logic.md`, `styling.md`
- Backend contracts: `docs/AUTHORIZATION_BACKEND_CONTRACT.md`, `docs/CLUB_MEMBERSHIP_SCHEMA.sql`
- Flow prompts: `docs/GORRA_ADMIN_APP_FLOW_PROMPT.md`, `docs/GORRA_MEMBER_APP_FLOW_PROMPT.md`
- Historical tournament handoff: `docs/TOURNAMENT_APP_HANDOFF_FOR_CLAUDE.md`
- Design guidance: `docs/GORRA_APPLICATION_TYPOGRAPHY.md`, `docs/GORRA_UI_PSYCHOLOGY_AND_MOTION_SYSTEM.md`

There is no `GORRA_CONTEXT.md`; the repository uses `GORRA_PROJECT_CONTEXT.md`. No `AGENTS.md` was found in relevant repository directories.

## C. Route map

Guard shorthand: `Public`, `Auth`, `Active permission` (active-club membership plus permission), and `Global permission` (auth access profile). All non-public routes require auth. Authenticated admins are also redirected to setup if no configured club exists.

### Home/shared

| Path | Name | View | Guard |
|---|---|---|---|
| `/` | `Home` | `LandingView.vue` | Public |
| `/dashboard` | `Dashboard` | `DashboardView.vue` | Auth |
| `/home` | — | Redirect to Dashboard | Auth |
| `/profile` | `Profile` | `ProfileView.vue` | Auth |
| `/history` | `History` | `HistoryView.vue` | Auth |
| `/notifications` | `Notifications` | `NotificationsView.vue` | Auth |

### Play

| Path | Name | View | Guard |
|---|---|---|---|
| `/play` | `Play` | `PlayHubView.vue` | Auth |
| `/play/:matchId` | `PlayMatch` | `PlayView.vue` | Active `matches.live_score` |

### Friendly Match

All use `FriendlyMatchFlowView.vue`.

| Path | Name | Step/guard |
|---|---|---|
| `/friendly-match/type` | `FriendlyMatchType` | type; Auth |
| `/friendly-match/timing` | `FriendlyMatchTiming` | timing; Auth |
| `/friendly-match/join` | `FriendlyMatchJoin` | join/readiness; Auth |
| `/friendly-match/club-opponent` | `FriendlyMatchClubOpponent` | club opponent; Auth |
| `/friendly-match/opponent` | `FriendlyMatchOpponent` | opponent; Auth |
| `/friendly-match/schedule` | `FriendlyMatchSchedule` | schedule; Auth |
| `/friendly-match/scoring` | `FriendlyMatchScoring` | scoring; Auth |
| `/friendly-match/format` | `FriendlyMatchFormat` | format; Auth |
| `/friendly-match/custom-format` | `FriendlyMatchCustomFormat` | custom format; Auth |
| `/friendly-match/scheduled` | `FriendlyMatchScheduled` | sent; Auth |
| `/friendly-match/join/:token` | `FriendlyMatchJoinInvitation` | external join; Auth |
| `/friendly-match/live/:matchId` | `FriendlyMatchLive` | live; Auth plus owner/scorer checks |
| `/friendly-match/result/:resultId` | `FriendlyMatchResult` | result; Auth |

Ladder aliases share those route records/names:

- `/ladder-match/type`
- `/ladder-match/timing`
- `/ladder-match/join`
- `/ladder-match/opponent`
- `/ladder-match/schedule`
- `/ladder-match/scoring`
- `/ladder-match/format`
- `/ladder-match/sent`
- `/ladder-match/join/:token`
- `/ladder-match/live/:matchId`

There are no ladder aliases for friendly custom format, generic friendly opponent, or friendly result.

### Ladders and Challenges

| Path | Name | View | Guard |
|---|---|---|---|
| `/compete` | — | Redirect to Rankings | Auth |
| `/rankings` | `Rankings` | `views/compete/LadderView.vue` | Auth |
| `/challenges` | `Challenges` | `views/compete/ChallengesQueueView.vue` | Auth |
| `/challenges/:challengeId` | `ChallengeDetails` | `ChallengeDetailsView.vue` | Auth; participant checked in-view |
| `/create-challenge` | `CreateChallenge` | `views/compete/CompeteChallengeCreateView.vue` | Active `challenges.create` |

### Tournaments

| Path | Name | View | Guard |
|---|---|---|---|
| `/tournaments` | `Tournaments` | `views/compete/TournamentsListView.vue` | Auth |
| `/tournaments/create` | `TournamentCreate` | `TournamentCreate.vue` | Active `tournaments.manage` |
| `/tournaments/:tournamentId` | `TournamentOverview` | `TournamentOverview.vue` | Auth |
| `/tournaments/:tournamentId/category/:categoryId` | `TournamentCategory` | `TournamentCategory.vue` | Auth |
| `/tournaments/:tournamentId/schedule` | `TournamentSchedule` | `TournamentSchedule.vue` | Auth |
| `/tournaments/:tournamentId/gallery` | `TournamentGallery` | `TournamentGallery.vue` | Auth |
| `/tournaments/:tournamentId/match/:matchId` | `TournamentMatchDetails` | `MatchDetailsView.vue` | Auth |

### Club and Settings

| Path | Name | View | Guard |
|---|---|---|---|
| `/onboarding/join-club` | `PlayerClubJoin` | `MemberOnboardingView.vue` | Auth |
| `/admin/setup` | `AdminSetup` | `ClubsView.vue` | Global `club.manage` |
| `/clubs` | `Clubs` | `ClubsView.vue` | Global `club.manage` |
| `/club` | `Club` | `ClubView.vue` | Auth |
| `/settings` | `Settings` | `SettingsView.vue` | Active `club.manage` |
| `/club/settings` | Alias of Settings | Same view | Same guard |
| `/account/settings` | `AccountSettings` | `AccountSettingsView.vue` | Auth |

### Operations/live display

| Path | Name | View | Guard |
|---|---|---|---|
| `/operations/live` | `LiveOperations` | `LiveOperationsView.vue` | Active `matches.live_score` |
| `/operations/live/:matchId` | `LiveOperationDetail` | `LiveOperationDetailView.vue` | Active `matches.live_score` |
| `/live-scoreboard/:matchId` | `LiveScoreboard` | `LiveScoreboardView.vue` | Auth |
| `/display` | `TvDisplayPairing` | `TvDisplayPairingView.vue` | Public |
| `/display/live` | `TvDisplayLive` | `TvDisplayLiveView.vue` | Public |
| `/match-umpire/invite/:token` | `ChairUmpireInvite` | `ChairUmpireInvitationView.vue` | Auth |
| `/match-umpire/guest/:token` | `ChairUmpireGuestInvite` | Same view | Public |
| `/match-umpire/control/:matchId?` | `ChairUmpireMatchControl` | `FriendlyMatchFlowView.vue` | Public route; capability/authority checked in-view |

### Auth

| Path | Name | View | Guard |
|---|---|---|---|
| `/signin` | `SignIn` | `LoginView.vue` | Public |
| `/login` | Alias of SignIn | Same | Public |
| `/signup` | `SignUp` | `LoginView.vue` | Public |
| `/landing-legacy` | `LegacyLanding` | `LandingView.legacy-2026-08.vue` | Public |
| `/old-landing` | Alias of LegacyLanding | Same | Public |

Unknown paths redirect to `/dashboard`.

## D. State ownership map

| Concept | Current owner(s) | Assessment |
|---|---|---|
| Current user | `src/stores/auth.js`; `src/config/currentPlayer.js` overwrites identity fields | **MOCK ONLY** |
| Player profile | `src/stores/player.js` plus auth-store name/avatar overlay | **DUPLICATED**, **MOCK ONLY** |
| Active club | `src/stores/admin.js` → `src/services/AdminService.js` local directory | Local owner clear; **MOCK ONLY** |
| Club membership | AdminService directory memberships plus setup roster/manual/import lists | **DUPLICATED**, **MOCK ONLY** |
| Role/permissions | Auth access profile, active-club membership role, player role overrides | **DUPLICATED** |
| Ladders | Admin setup definitions; PlayerStore ranking; `src/config/ladder.js`; mock API | **DUPLICATED**, **UNCLEAR**, **MOCK ONLY** |
| Challenges | `src/stores/challenge.js` → `src/services/ChallengeService.js` → `src/services/ApiService.js` | **MOCK ONLY** |
| Matches | `src/stores/match.js`/mock API and separate `src/stores/friendlyMatch.js` records | **DUPLICATED**, **MOCK ONLY** |
| Live score | MatchStore `liveState`; FriendlyMatchStore `draft.liveState`; shared scoring engine | **DUPLICATED** |
| Scorer/owner authority | Primarily friendly-match store; projected through chair-umpire and Operations services | **NEEDS VERIFICATION** across non-friendly PlayView |
| Tournaments | Tournament store → TournamentService → ApiService; separate gallery store | **MOCK ONLY** |
| Memberships/fees | Membership in AdminStore/AdminService; fees in Dashboard fixture only | Membership **DUPLICATED**; fees **MOCK ONLY**/not implemented |
| Notifications | Notification store/browser storage | Owner clear; event coverage **NEEDS VERIFICATION** |
| App settings | No single store; split among auth profile, data mode, and two screens | **DUPLICATED**, **UNCLEAR** |
| Club settings | AdminStore/AdminService setup; legacy mirror read by ladder configuration | Mostly clear; **MOCK ONLY** |

## E. Major dependency/flow map

### Identity, club context, and Dashboard

```text
LoginView
→ AuthStore.login()
→ hardcoded APP_CURRENT_PLAYER + simulated access profile
├→ PlayerStore.currentPlayerId → PlayerService → mock roster
└→ AdminStore actor identity → AdminService club directory
   → activeClubId → activeMembership → activeClubRole/permissions
   → DefaultLayout shell and route guards

DashboardView
├→ PlayerStore for current name/rank/player count
└→ data/dashboard.js for active club, events, alerts and activity
```

The intended authenticated-user → active-club → membership/role → Dashboard chain is only partially connected: the shell and guards consume the admin/auth context, while much of Dashboard content still comes from a separate fixture.

### Play, match setup, and live scoring

```text
PlayView
├→ Friendly Match
│  → FriendlyMatchSetupView
│  → FriendlyMatchStore draft/configuration
│  → FriendlyMatchInviteView / FriendlyMatchLobbyView
│  → FriendlyMatchLiveView
│  → FriendlyMatchStore live state + scoring engine + local sync
│  → FriendlyMatchSummaryView
│
└→ Ladder Match / Challenge
   → Challenge setup/detail/readiness
   → MatchDetailsView
   → MatchStore liveState + MatchService/ApiService
   → score confirmation/result handling
```

Friendly matches and challenge/ladder matches use separate record and live-state paths, even though both represent setup → readiness → live match → result.

### Ladder consequence flow

```text
Ladder definitions/configuration
→ challenge creation and lifecycle
→ match record
→ result submission/confirmation
→ PlayerStore ranking data / ladder presentation
```

The code supports the lifecycle stages, but the final ranking consequence is not represented by one authoritative ladder service. Ranking data and ladder definitions remain split.

### Tournament flow

```text
Tournament list/detail
→ tournament creation/setup
→ categories and participant data
→ schedule/fixtures
→ tournament match modal/live refresh
→ standings and results
```

TournamentStore, TournamentService, and ApiService carry most tournament state. Registration/entry is represented in UI/data structures but does not appear to be a complete independent persistence workflow.

### Club settings consumers

```text
Admin setup / club settings screens
→ AdminStore
→ AdminService local club directory
├→ active club and membership context
├→ layout/sidebar visibility and role checks
├→ club/admin screens
└→ legacy configuration mirror
   → ladder configuration helper
```

Club setup settings primarily feed the local AdminService model. Only a subset is visibly consumed elsewhere, with ladder configuration also reading a legacy mirror.

### App and user settings consumers

```text
Profile/account settings
→ AuthStore user/profile fields
→ shell identity display and profile-facing UI

Data-mode settings
→ local configuration/storage
→ service/mock-data selection behavior

Notification preferences/screens
→ notification store/browser storage
→ badges and notification presentation
```

Account editing is split across multiple screens, and password/session behavior is simulated rather than backed by a real authentication service.

## F. Areas currently unclear, duplicated, mocked, or likely stale

- **MOCK ONLY:** There is no production backend client in the inspected frontend. `ApiService` is an adapter over local/mock data.
- **DUPLICATED:** Match records and live scoring exist in both the general MatchStore path and the FriendlyMatchStore path.
- **DUPLICATED:** Role and permission state is represented by auth access profiles, active-club membership roles, and player-level role overrides.
- **DUPLICATED:** Account/profile editing is spread across more than one settings/profile screen.
- **DUPLICATED:** Challenge creation is represented by multiple route/view flows.
- **UNCLEAR:** Ladder definitions, global/player rankings, eligibility configuration, and ranking consequences do not have one authoritative owner.
- **UNCLEAR:** Club memberships in the active directory and setup-time roster/manual/import lists can represent overlapping membership state.
- **NEEDS VERIFICATION:** Scorer/owner authority is explicit in the friendly-match path, but consistent enforcement across non-friendly live matches is not evident.
- **MOCK ONLY:** Member onboarding behavior includes simulated/timer-driven steps.
- **MOCK ONLY:** Fees/payments appear in Dashboard fixture data but no complete fees or payment subsystem was found.
- **INCOMPLETE:** Tournament registration/entry exists as UI/domain data but does not appear to have a complete standalone persistence flow.
- **PARTIAL:** Notifications have browser-backed state and badges, but coverage of every event that should demand attention needs verification.
- **LIKELY STALE:** `AdminSetupView` appears superseded by newer administrative setup screens.
- **LIKELY STALE:** `PlayerClubJoinView` appears to be an older club-joining route/view.
- **LIKELY STALE:** `RankingsView`, `ChallengesView`, `CreateChallengeView`, `TournamentHub`, `MatchesView`, `BookView`, and `DashboardView.legacy` appear legacy, alternate, or no longer routed.
- **UNWIRED:** Some Dashboard components and `homePriority` helpers do not appear fully connected to the current Dashboard route.
- **UNUSED SHELL ALTERNATIVE:** `NavBar` appears to overlap with the current layout navigation without being the authoritative shell.
- **STALE-DOCUMENTATION RISK:** `GORRA_PROJECT_CONTEXT.md` is dated earlier than several current source changes, and `ARCHITECTURE.md` appears older still; both should be treated as context rather than proof of current behavior.
