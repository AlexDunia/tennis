# Gorra Live Match Architecture: Current State and Migration Design

**Inspection date:** 2026-09-01  
**Scope:** Current repository working tree. This is an architecture report only; no application code was changed.  
**Conclusion:** Gorra has one shared pure tennis rules engine, but two application-level live-match stacks. The inconsistency is caused by routing, state ownership, persistence, realtime, authority, and completion orchestration—not by a product requirement for Ladder or Tournament to score differently.

## Evidence conventions

This report comes from direct inspection of routes, views, stores, services, utilities, mock API handlers, and tests. Source code was treated as controlling evidence.

- **Observed**: directly represented in current source.
- **Recommendation**: proposed target, not current behavior.
- **NEEDS VERIFICATION**: not provable from this repository alone or needs an end-to-end test.
- **NOT IMPLEMENTED**: no implementation was found after repository search.
- **LEGACY COMPATIBILITY**: supports an older state shape, URL, or flow during transition.

The working tree already contained unrelated modified/untracked files. This report describes that current working tree.

## Executive answer

The experiences differ because two generations were built separately and have not converged:

1. Newer: `FriendlyMatchFlowView.vue` → `LiveMatchControl.vue` → `friendlyMatchStore`. It uses a browser-persisted match draft and supports undo, scorer authority/handoff, public/TV displays, Live Operations, chair umpire control, voice/announcements, and a dedicated result screen.
2. Older: `/play/:matchId` → `PlayView.vue` → `TennisScoreboard.vue` → `matchStore`/`Match.liveState`. `PlayView` owns a local score copy, writes whole snapshots, polls every two seconds, and has different completion behavior.
3. Both use `src/utils/tennisScoring.js`; duplication is above the pure engine.
4. Source comments and `GORRA_PROJECT_CONTEXT.md:551` describe the split as transitional. `FriendlyMatchFlowView.vue` also says the old Ladder confirmation lifecycle is retained “for now.” The difference is accumulated architecture, not a deliberate post-start product distinction.

The clean target is one canonical `Match`, one `LiveMatchSession`, and one source-neutral live route. Friendly, Ladder, and Tournament provide rules, context, permissions, and completion policy; none owns separate live score state.

## 1. Entry-flow map

| Flow | Live route | View/component | State owner | Persistence/realtime | Completion |
|---|---|---|---|---|---|
| Play → Friendly → now | `/friendly-match/live/:matchId` | `FriendlyMatchFlowView` → `LiveMatchControl` | `friendlyMatchStore.draft.liveState` | Match localStorage, storage events, BroadcastChannel, projections | Friendly local result → result route |
| Play → Ladder → now | `/ladder-match/live/:matchId` alias | Same newer stack | Friendly live draft plus linked Challenge/Match | Browser-local score; domain records separate | Ladder pending review plus Friendly-store end |
| Play → Ladder → later | Eventually `/play/:matchId` | `PlayView` → `TennisScoreboard` | Local `scoreboardState` / `Match.liveState` | Whole-state PATCH, 2s polling | Match preview → Ladder review |
| Ladder member challenge | `/play/:matchId` | Older stack | Local state / Match | Mock API/localStorage, polling | Ladder review |
| Ladder admin Play Now | `/play/:matchId` | Older stack | Local state / Match | Mock API/localStorage, polling | Ladder review |
| Tournament fixture | `/play/:matchId` | Older stack | Local state / Match | Mock API/localStorage, polling | Direct Tournament result/progression |
| Live Operations control | Newer live route | Newer stack | Newer session only | Operations registry/snapshots | Source-specific |
| Public scoreboard | `/live-scoreboard/:matchId` | `LiveScoreboardView` | Read-only projection | BroadcastChannel, cache, heartbeat | Display only |
| Chair umpire | `/match-umpire/control/:matchId?` | Newer stack | Newer session | Tab capability + newer sync | Source-specific |

### Play → Friendly

`DefaultLayout` Play → `/play` (`PlayHubView`) → initialize Friendly draft → Friendly scoring/format/timing/join routes → `friendlyMatchStore.startLiveMatch()` → `/friendly-match/live/:matchId` → `FriendlyMatchFlowView` renders `LiveMatchControl`.

- `draft.liveState` is explicitly the score source of truth.
- Live records: `gorra.friendlyMatchLive.v1.<matchId>`.
- Setup: `gorra.friendlyMatchDraft.v5`.
- Results: `gorra.friendlyMatchResults.v2`.
- Recovery: storage events, focus/visibility refresh, score revision, separate scorer-authority revision.
- Realtime projections: browser-only BroadcastChannel/localStorage/custom events/heartbeat.
- Completion: `endMatch()` creates a local result, removes/detaches the active live record, publishes completion, and routes to `/friendly-match/result/:resultId`.

The schedule-later branch creates `waiting_for_acceptance`; inspected `joinInvitation()` accepts only `waiting_for_opponent`, and no scheduled acceptance/start transition was found.

**NOT IMPLEMENTED:** Complete scheduled-Friendly acceptance → ready → start/resume.

### Play → Ladder

`/play` → choose Ladder → `/ladder-match/opponent` and setup → create Challenge with `ladderConfigSnapshot` and locked `matchConfig`.

For Play now, `completeReview()` creates and accepts the Challenge, links Challenge/Match into `friendlyMatchStore`, starts the browser-local draft, publishes, and routes to the newer live URL.

**Lifecycle conflict:** it does not call normal `startChallenge`; the draft can be `live` while shared Challenge/Match remains accepted/scheduled.

For Schedule later, normal Challenge acceptance/start eventually calls `ChallengeDetailsView.startChallenge()` and routes to `/play/:matchId`. Thus a Play-created Ladder match gets the newer scorer when immediate and older scorer when scheduled.

### Ladder sidebar → Challenge

Sidebar Ladder → `/rankings` (`src/views/compete/LadderView.vue`) → `/create-challenge` (`CompeteChallengeCreateView`) → `/challenges/:challengeId` → accept/schedule/start → API marks Challenge/Match live → `/play/:matchId` → `PlayView` → `TennisScoreboard`.

`continueMatch()` also forces `/play/:matchId`. `PlayView` loads only engine-shaped `Match.liveState` (`sets` and `currentGame`); otherwise it creates/persists a default scoreboard. It polls Match data every two seconds while visible.

Old Ladder completion routes to `MatchDetails` with score/winner preview; existing review logic then submits/resolves result and rankings.

### Ladder admin Play Now

`src/views/compete/LadderView.vue` calls `createAdminLadderMatch()`. For timing `now`, the mock creates live linked Challenge/Match records and assigns scorer, then routes to `/play/:matchId`. Admin Play Now therefore uses the old stack while Play-hub Ladder Play Now uses the newer one.

### Tournament → Match

`TournamentCategory.vue.openLiveBoard()` and Tournament `MatchDetailsView` route to `/play/:matchId`.

No dedicated Tournament physical-start command was found. Opening `PlayView` initializes/persists engine state when none is recognized. Some Tournament UI treats pending + `liveState.startedAt` as live, so status can remain `pending`.

Completion calls `matchStore.submitResult()` with `completed`; mock logic updates Tournament state and knockout progression. Separate Tournament tools support manual score entry/walkover policy.

### Resume/reopen and other paths

| Entry | Behavior | Implication |
|---|---|---|
| Play hub Continue | Routes listed Match records to `/play/:matchId`; filter excludes `live` | Cannot reliably resume newer sessions |
| Challenge Continue | Routes old stack | Forces old UI |
| Direct newer URL | Reads only match-scoped browser record; missing record redirects | Cannot reconstruct from Match/server |
| Direct old URL | Reads Match state or initializes defaults | No optimistic revision guard |
| Live Operations | Opens newer route | Old scores are not published |
| Public/TV | Reads newer sanitized snapshot | Old score changes are invisible |
| Chair umpire | Reuses newer view/capability | Unavailable to old stack |
| `MatchesView.vue` | Contains old navigation | **LEGACY/UNROUTED:** current router does not expose it |
| `DashboardView.legacy.vue` | Old actions | **LEGACY** |

**NOT WIRED:** Home-priority/live-match helpers exist, but active `DashboardView.vue` is fixture-driven and does not import them.

## 2. State ownership

| Source | Current responsibility | Authority/durability |
|---|---|---|
| Match | Participants, type, status, context, result, optional config, old `liveState` | Mock/browser persistence; permissive PATCH |
| Challenge | Ladder lifecycle, deadlines, positions, locked rules, result review | Ladder domain mock state |
| Friendly draft | Setup plus newer score, authority, revisions, linked IDs | Browser localStorage |
| Flattened Friendly fields | Points/games/sets/history/winner copied from liveState | **LEGACY COMPATIBILITY** |
| `PlayView.scoreboardState` | Old scorer working copy | Local component state, written wholesale |
| Match store | Collection, shallow patch, live save, result submission | Client over mock API |
| Public snapshot | Sanitized score/status/latest event | Projection, not authority |
| Operations registry | Liveness/court/scorer projection | Browser-only |
| BroadcastChannel | New cross-tab delivery | Same browser only |
| Polling | Old scorer 2s; Tournament pages about 1s | Whole-record pull |
| Mock persistence | Ladder/non-tournament and Tournament storage keys | Development only |

Conflicts:

1. New Play-Ladder score and shared Match lifecycle can diverge.
2. Old local ref can race with polling/whole Match snapshots.
3. New revisions help merging, but whole localStorage drafts still permit same-revision writers.
4. New scorer authority and old `matches.live_score` route permission are different models.
5. Tournament `createLiveState()` is a legacy shape that `PlayView` replaces with defaults.
6. New Ladder completion creates shared pending-review data plus a local Friendly-style result.
7. Public/Operations are valid projections, but only newer matches publish them.

Generic Match PATCH has no expected revision, command idempotency key, scorer-capability validation, or durable audit event.

**NEEDS VERIFICATION:** Production backend, database constraints, authorization, and websocket behavior are absent from this repository.

## 3. Rules propagation

`tennisScoring.js` is the correct shared pure engine: normal sets/match-tiebreak mode, advantage/no-ad, configurable sets/games/tiebreaks, deciding match tiebreak, server, revision, undo, and normalization.

### Friendly

`engineConfigForDraft()` converts setup choices; `startLiveMatch()` creates/normalizes with them. Inspected Play-now rules survive.

**NEEDS VERIFICATION:** Browser tests should cover every custom format and reload/rejoin combination because old drafts/compatibility fields remain readable.

### Ladder

Ladder stores `ladderConfigSnapshot` and locked `matchConfig` (`gameScoringRule`, `finalSetRule`, etc.).

- New Play-hub Ladder adapts no-ad and time-smart deciding tiebreak.
- Old `PlayView` calls `createScoreboard(playerA, playerB)` without adapting `matchConfig`.

**Confirmed defect:** normal Ladder/admin Play Now can display locked no-ad/super-tiebreak rules while live scoring uses default best-of-three/advantage/normal-final-set behavior.

### Tournament

Tournament/category setup offers best-of-three, two sets plus match tiebreak, and one set. Fixture generation does not copy scoring into an immutable Match snapshot; knockout Matches also lack a normalized snapshot. Legacy Tournament live state is incompatible with the engine shape expected by `PlayView`.

**Confirmed defect:** Tournament configuration is not reliably propagated and can be replaced by defaults.

Required foundation: one versioned `MatchRulesSnapshot → TennisEngineConfig` boundary, with source adapters and no start when required rules are ambiguous.

## 4. Shared versus domain/presentation-specific

| Owner | Should own | Should not own |
|---|---|---|
| Match | ID, source/reference, club, participants, court/schedule, immutable normalized rules, lifecycle, final result reference | Mutable UI state, ranking/bracket algorithms |
| LiveMatchSession | Authoritative engine state, timestamps, scorer authority, revision, accepted commands/events, undo policy, liveness | Eligibility, Challenge acceptance, ranking/bracket consequences |
| Friendly | Opponent/invitation/join, flexible rules before snapshot, Friendly result policy | Separate live scorer/state |
| Ladder | Eligibility, Challenge lifecycle/deadlines, positions, locked source rules, review/dispute/ranking/cooldown | Point/game/set state |
| Tournament | Fixture/category/round/court, official assignment, result policy, walkover/retirement, progression | Separate engine/state shape |
| Scorer UI | Render session, issue allowed commands, interaction safety, optional source context | Persistence protocol/domain consequences |
| Public scoreboard | Sanitized read-only projection, stale/completed display | Commands, private authority, finalization |
| Live Operations | Club operational projection, liveness, court/scorer links | Second score source/lifecycle |

Domain modules decide whether and under what policy a Match starts/completes. `LiveMatchSession` owns physical-play state. UI presents state and issues commands.

## 5. Recommended target architecture

```text
Friendly setup ─────┐
Ladder challenge ───┼─> Match + immutable rules snapshot
Tournament fixture ─┘                 │
                                      v
                             startLiveSession(matchId)
                                      │
                                      v
                         Canonical LiveMatchSession
                     ┌────────────┬───────────────┐
                     v            v               v
                 Scorer UI   Public/TV view   Live Operations
                                      │
                                      v
                             finishPhysicalMatch
                                      │
                                      v
                          Normalized MatchResult
                     ┌────────────┬───────────────┐
                     v            v               v
                  Friendly      Ladder        Tournament
                  finality      review/rank    progression
```

Suggested `Match`:

- `id`, `source`, `sourceRef`, `clubId`;
- participants/sides;
- schedule/court;
- immutable versioned normalized rules snapshot;
- lifecycle;
- `liveSessionId` and final `resultId`.

Suggested `LiveMatchSession`:

- `id`, `matchId`, status;
- authoritative `TennisScoreboard` engine state;
- start/activity/completion timestamps and clock anchors;
- scorer/capability authority and separate authority revision;
- monotonic score revision;
- accepted command IDs and event/correction history;
- normalized completion reference;
- projection version/publication time.

Avoid duplicate authoritative fields. Current server, for example, should remain in engine state; other copies are projections.

Views issue commands such as `RecordPoint(side, commandId, expectedRevision)`, `UndoLastPoint`, `SetServer`, `AssignScorer`, and `FinishPhysicalMatch`. One session controller authorizes, applies `tennisScoring.js`, persists atomically, increments revision, and publishes projections.

An interim frontend repository can wrap browser persistence, but its interface should be replaceable by a server implementation without changing UI or engine.

The engine has local undo snapshots; the public projection has only a latest event descriptor.

**NOT IMPLEMENTED:** No canonical durable live event feed exists. The target should record commands/events with actor, time, revision, and command ID. Undo should produce a correction event in durable history.

## 6. Routing

Use one source-neutral scorer route:

`/matches/:matchId/live`

The URL identifies a Match only. The Match supplies source, rules, participants, permissions, and source reference. Each setup flow completes its domain start transaction, then navigates here.

Safe migration:

1. Add the route while both implementations exist.
2. Load a canonical session by Match ID; never select engine/state from route name or query.
3. Convert `/friendly-match/live/:matchId`, `/ladder-match/live/:matchId`, and `/play/:matchId` into source-safe adapters/redirects only after that source is migrated.
4. Keep public scoreboard, TV, Operations, and umpire routes as separate projections/capability routes.
5. Retain compatibility telemetry and old-state readers through a defined retention window.

**LEGACY COMPATIBILITY:** `/play/:matchId` should become a temporary adapter/redirect, not a second scorer.

### Permissions

Old `PlayMatch` requires `matches.live_score`. Ordinary player/member permission sets do not include it, but Ladder participant actions can route those users there. The newer route instead uses owner/scorer checks and lacks the same route permission.

The target must distinguish:

- Match view access;
- public-score access;
- participant scoring where policy permits;
- assigned scorer/official authority;
- manager assignment/handoff/override;
- source-specific finalization/review.

Route guards are UX; session command handlers must be authoritative.

## 7. UI architecture

### `LiveMatchControl.vue`

Use it as the UX baseline, not domain owner. Adapt it to a canonical session API and split responsibilities where useful:

- source-neutral `LiveMatchView` route loader/reconnect shell;
- `useLiveMatchSession(matchId)` or canonical session store;
- score/sets/server presentation;
- point controls/input safety;
- corrections/undo;
- clocks;
- scorer authority/handoff;
- public/TV publishing;
- umpire controls;
- optional source context panel/slot.

This is a responsibility map, not a requirement for one file per bullet.

### `FriendlyMatchFlowView.vue`

Keep Friendly/Play setup, but extract live orchestration. It currently coordinates setup, scoring, realtime, Operations, TV, umpire, voice, result flow, and Ladder bridging. After migration it should prepare/start Match then route to `LiveMatchView`.

### `PlayView.vue`

Do not extend it. Use temporarily as an old `Match.liveState` adapter/redirect; remove its state ownership when all sources migrate. Do not copy its polling/whole-PATCH/source-completion approach.

### `TennisScoreboard.vue`

Retire it after parity or reuse only presentation pieces. It should not own session behavior. Hard-coded copy such as a fixed seven-point tiebreak must become config-driven if retained.

## 8. Completion

`FinishPhysicalMatch` should be idempotent:

1. authorize actor and expected revision;
2. verify engine winner or explicit retirement/walkover policy;
3. freeze terminal state;
4. create one normalized result with stable ID/idempotency key;
5. mark session completed once;
6. update Match to source-appropriate post-play state;
7. dispatch domain completion through a handler/outbox event.

Normalized result should contain Match ID, outcome, completed sets, aggregates if needed, finish reason, terminal revision, timestamps, scorer/official, and audit metadata.

Source consequences:

- **Friendly:** normally final immediately; retain Friendly issue/report policy.
- **Ladder:** Match/Challenge become `pending_review`; confirmation/dispute applies ranking/stat/cooldown effects once.
- **Tournament:** apply fixture policy and advance standings/bracket once; retirement/walkover is an explicit reason, not fabricated points.

Current risks:

- newer Ladder creates shared pending review and a local Friendly-style completed result;
- old/new Ladder submit from different UI stages;
- live and manual Tournament result paths need idempotent progression;
- separate score PATCH/result requests can partially succeed.

## 9. Migration risks

| Risk | Current evidence | Control |
|---|---|---|
| Duplicate state | Friendly liveState, PlayView ref, Match liveState, Tournament legacy shape | One repository; explicit legacy readers; no indefinite dual-write |
| URL compatibility | Three scorer URLs | Controlled adapters/redirects |
| Resume | New state is browser-local; old is Match-backed | Server session lookup by Match ID |
| Permission mismatch | Player starts can reach manager-gated route | Capability-based commands |
| Realtime conflict | BroadcastChannel vs polling/full snapshots | One revisioned command/subscription protocol |
| Concurrent scoring | No atomic expected revision/idempotency | Transactional compare-and-swap command handler |
| Result duplication | New Ladder has two representations | Stable result ID, idempotent source handler |
| Stale localStorage | Many versioned drafts/snapshots/pairings | Versioned migration/expiry; no blind deletion |
| Lifecycle split | Play-Ladder local live after accept | Atomic Challenge/Match/session start |
| Ladder regression | Old scorer ignores locked config | Rules-adapter tests before routing migration |
| Tournament regression | Fixture lacks rule snapshot | Backfill/derive before start and block ambiguity |
| Progression regression | Result drives brackets/standings | Characterization + idempotency tests |
| Display regression | Only new stack publishes | Move projections to canonical session first |

Do not allow both writers for one Match. Temporary dual-read is acceptable; uncontrolled dual-write is not.

## 10. Incremental migration plan

### Phase 0 — Characterize

- Route-to-stack tests for every entry/resume path.
- Engine tests for advantage/no-ad, formats, deciding tiebreak, server, undo, reload.
- Ladder confirmation/ranking and Tournament group/knockout regression tests.
- Record storage schemas/fixtures.
- Decide scheduled-Friendly lifecycle, currently **NOT IMPLEMENTED**.

### Phase 1 — Contracts and rule adapters

- Define versioned Match rules, session, commands/events, projections, normalized result.
- Add Friendly, Ladder, and Tournament rule adapters.
- Require resolved rules before start.
- Add readers for old engine Match state, Tournament legacy state, and Friendly drafts.

### Phase 2 — Session behind newer UI

- Extract orchestration from `FriendlyMatchFlowView`.
- Keep `tennisScoring.js` as sole transition engine.
- Adapt `LiveMatchControl` to canonical state/commands.
- Publish public/TV/Operations/voice/umpire projections from the session.
- Keep browser adapter temporarily behind replaceable interface.

### Phase 3 — Canonical route and Friendly

- Add `/matches/:matchId/live` and `LiveMatchView`.
- Migrate Friendly Play Now first.
- Convert Friendly legacy URLs carefully.
- Test reload, second tab, displays, Operations, umpire, undo, handoff, completion.

### Phase 4 — Ladder

- Make accepted/scheduled → live Challenge + Match + session one transition.
- Prove locked no-ad/super-tiebreak in canonical scorer.
- Route Play, sidebar, and admin Ladder paths identically.
- Produce one normalized result then reuse Ladder review/ranking logic.
- Remove duplicate Friendly-style result.

### Phase 5 — Tournament

- Persist rules snapshot per fixture; safely derive/backfill old fixtures.
- Define explicit start and scorer/official authority.
- Route category/details actions to canonical scorer.
- Adapt normalized completion to current standings/bracket/walkover policy.
- Test group, knockout, edits, walkover, retirement, progression.

Tournament follows Ladder because legacy fixture state and progression create higher migration risk.

### Phase 6 — Server/realtime hardening

- Transactional revisioned/idempotent commands.
- Server-enforced capabilities.
- Websocket/SSE projections.
- BroadcastChannel/localStorage becomes cache/optimization only.
- Reconnect/offline/stale/audit behavior.

### Phase 7 — Retire legacy

Only after no callers remain:

- remove old `PlayView` orchestration;
- remove Tournament legacy state;
- remove Friendly flattened compatibility score fields;
- expire old storage through controlled migration;
- remove obsolete aliases/unrouted views;
- decide whether to retain any `TennisScoreboard` presentation.

---

# Required closing summary

## 1. Current architecture

One pure engine (`tennisScoring.js`) is wrapped by two stacks:

- newer: `FriendlyMatchFlowView` → `LiveMatchControl` → `friendlyMatchStore` → browser snapshots;
- older: `/play/:matchId` → `PlayView` → `TennisScoreboard` → local state/`Match.liveState` → polling.

Play-now Friendly and Play-now Ladder use the newer stack. Normal/scheduled Ladder, Ladder admin Play Now, and Tournament use the older one. Ladder can therefore receive either scorer based on entry history.

## 2. Main problems

- Two live state/persistence/realtime models above one engine.
- Old Ladder and Tournament can replace configured rules with defaults.
- New Play-Ladder can outrun Challenge/Match lifecycle.
- Public/TV/Operations/umpire/undo/authority exist only on newer path.
- Ordinary Ladder participants can be sent to a manager-permission route.
- New Ladder can create duplicate result representations.
- Browser channels are not cross-device authority.
- Scheduled Friendly continuation and durable event feed are **NOT IMPLEMENTED**.

## 3. Target architecture

Every setup flow creates one Match with immutable normalized rules. A source-neutral LiveMatchSession owns physical-play state and commands. Scorer, public/TV, and Operations are projections. The session produces one idempotent normalized result, after which Friendly, Ladder, or Tournament applies its own policy.

## 4. Component/store changes required

- Extract live orchestration from `FriendlyMatchFlowView`.
- Adapt/decompose `LiveMatchControl` over a canonical session API.
- Add a canonical session store/controller/repository.
- Make `PlayView` a temporary legacy adapter/redirect, then remove its score ownership.
- Retire or reuse only presentational parts of `TennisScoreboard`.
- Move realtime/display/Operations/umpire publication behind session projections.
- Add versioned rule and legacy-state adapters.

## 5. Route changes required

- Add `/matches/:matchId/live`.
- Send Friendly, all Ladder starts, and Tournament starts there after domain start succeeds.
- Gradually redirect/adapt the two Friendly/Ladder live paths and `/play/:matchId`.
- Keep read-only display/TV/Operations/umpire routes separate.
- Replace broad manager-only scoring access with explicit participant/scorer/official capabilities.

## 6. Backend/domain contract implications

- Server-owned Match and LiveMatchSession persistence.
- Immutable versioned rules snapshots.
- Revisioned/idempotent commands and atomic start/finish.
- Server-authorized scorer/official handoff.
- Durable event/audit history and sanitized projections.
- Exactly-once normalized result plus idempotent Ladder/Tournament consequences.
- Cross-device websocket/SSE or equivalent; browser channels become optimization only.

These are target requirements. The current repository provides local mocks/browser persistence, not these production guarantees.

## 7. Safe migration order

1. Characterization and domain regression tests.
2. Canonical contracts and rules adapters.
3. Session controller behind newer UI.
4. Canonical route and Friendly.
5. All Ladder entries and one Ladder completion workflow.
6. Tournament rules/start/completion.
7. Server authority/realtime hardening.
8. Remove legacy only after unused.

## 8. Files likely to be touched

Existing files likely involved:

- `src/router/index.js`
- `src/views/PlayHubView.vue`
- `src/views/FriendlyMatchFlowView.vue`
- `src/components/LiveMatchControl.vue`
- `src/views/PlayView.vue`
- `src/components/TennisScoreboard.vue`
- `src/views/ChallengeDetailsView.vue`
- `src/views/compete/LadderView.vue`
- `src/views/TournamentCategory.vue`
- `src/views/MatchDetailsView.vue`
- `src/stores/friendlyMatch.js`
- `src/stores/match.js`
- `src/stores/challenge.js`
- `src/stores/tournament.js`
- `src/config/ladder.js`
- `src/composables/useTournamentFixtures.js`
- `src/services/ApiService.js` or later real API modules
- `src/services/liveMatchRealtime.js`
- `src/utils/liveScoreboardSnapshot.js`
- `src/utils/liveOperationsSnapshot.js`
- `src/services/liveOperationsRegistry.js`
- TV pairing and chair-umpire capability modules
- scoring, routing, lifecycle, realtime, Ladder, and Tournament tests

Likely new modules: source-neutral `LiveMatchView`, session controller/repository, normalized rule adapters, normalized completion dispatcher, and legacy migration adapters.

`src/utils/tennisScoring.js` should mainly receive tests or narrowly necessary interface support; its single-engine role should remain.

## 9. Things that should explicitly NOT be touched yet

- Do not redesign Friendly, Ladder, or Tournament pre-match UX.
- Do not rewrite Ladder eligibility, acceptance, rankings, cooldown, or review policy.
- Do not rewrite Tournament draw, standings, bracket, or progression before characterization tests.
- Do not create another scoring engine or source-specific score store.
- Do not fork/remove `tennisScoring.js`.
- Do not bulk-delete localStorage or old state without versioned migration/retention.
- Do not remove `/play` or live URLs before every caller/stored session has an adapter.
- Do not make route/query names authoritative for source or rules.
- Do not treat BroadcastChannel/localStorage as production realtime/security.
- Do not put Ladder ranking or Tournament bracket logic in the scoring engine.
- Do not implement UI changes before agreeing contracts, rule propagation, lifecycle, and tests.

## Key source evidence index

- Routes/permissions: `src/router/index.js:78`, `:306`, `:392`, `:402`, `:439`, `:453`, `:477`, `:568`, `:591`; `src/utils/auth/accessControl.js`.
- Sidebar: `src/layouts/DefaultLayout.vue:435-441`.
- Play hub: `src/views/PlayHubView.vue:15-44`.
- New start/Ladder bridge: `src/views/FriendlyMatchFlowView.vue:1556-1600`, `:1695-1855`, `:3105`, `:3957`.
- New state/compatibility: `src/stores/friendlyMatch.js:32-48`, `:74-143`, `:373-405`, `:1648-1908`, `:2124-2284`, `:2638-2810`.
- Ladder start/resume: `src/views/ChallengeDetailsView.vue:204-230`; `src/views/compete/LadderView.vue:162-201`.
- Old scorer: `src/views/PlayView.vue:10-18`, `:129-180`, `:250-334`; `src/components/TennisScoreboard.vue`.
- Engine: `src/utils/tennisScoring.js:54-101`, `:664-735`, `:837-975`.
- Ladder rules: `src/config/ladder.js:115-116`; `src/services/ApiService.js:2594-2680`.
- Tournament gap: `src/composables/useTournamentFixtures.js:19-144`; `src/services/ApiService.js:1001`, `:1069`, `:1103`, `:1152`, `:1589`; `src/views/TournamentCategory.vue:275-280`.
- Match persistence: `src/stores/match.js:73-121`; Match handlers in `src/services/ApiService.js`.
- Browser realtime: `src/services/liveMatchRealtime.js:1-18`, `:608-803`; `src/utils/liveScoreboardSnapshot.js`; `src/views/LiveScoreboardView.vue`; `src/services/liveOperationsRegistry.js`; `src/utils/liveOperationsSnapshot.js`.
- Existing architecture acknowledgement: `GORRA_PROJECT_CONTEXT.md:551`.

