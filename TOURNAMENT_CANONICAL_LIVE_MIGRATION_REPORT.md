# Tournament Canonical Live-Match Migration Report

## 1. Tournament architecture before/after

Before this phase, Tournament fixtures lived in the shared Match collection but live play entered `/play/:matchId`, rendered `PlayView` and `TennisScoreboard`, and wrote score state to `Match.liveState`. Final submission then called the Tournament branch of `/matches/:matchId/result`.

After this phase, Tournament start/resume uses the source-neutral `startOrResumeMatch` boundary, enters `/matches/:matchId/live`, creates or resumes one `LiveMatchSession` keyed by `Match.id`, and renders the same `LiveMatchControl` used by the newer Friendly/Ladder host. Tournament-only consequences remain behind `tournamentStore.enterMatchResult`.

## 2. Tournament rules snapshot

New group fixtures resolve the category's persisted scoring setting through `tournamentRulesToMatchRulesSnapshot` during `generateRoundRobinFixtures`. The resulting snapshot is deep-frozen and stored on each fixture as `Match.rulesSnapshot`; new fixtures no longer receive an empty legacy `Match.liveState`.

Knockout fixtures receive the same resolved snapshot when they are synchronized into the shared Match collection. Fixture generation returns a 422-style error if the category format is unresolved.

For legacy fixtures, the start/resume service checks the Match snapshot first, then the persisted Tournament category. An unambiguous category is frozen back onto Match before a live legacy state is resumed. Ambiguous data is returned as `rules_unresolved`; no default is invented.

## 3. Format mapping

| Tournament format | Canonical match | Game | Set | Deciding set |
| --- | --- | --- | --- | --- |
| `best3` | Sets, 2 sets to win | Traditional Advantage | First to 6, win by 2, 7-point tiebreak at 6-6 | Normal set |
| `matchtb` | Sets, 2 sets to win | Traditional Advantage | First to 6, win by 2, 7-point tiebreak at 6-6 | 10-point match tiebreak, win by 2 |
| `oneset` | Sets, 1 set to win | Traditional Advantage | First to 6, win by 2, 7-point tiebreak at 6-6 | Normal set |

The existing adapter records that game/set details are inherited because current Tournament format IDs do not encode those choices.

## 4. Canonical live entry map

- Category fixture “Live Board” → explicit `startOrResumeMatch` → `LiveMatch`.
- Tournament Match Details “Open live board” → explicit `startOrResumeMatch` → `LiveMatch`.
- Play hub Tournament “Continue” → explicit `startOrResumeMatch` → `LiveMatch`.
- Live Operations control/recovery links for Tournament → `LiveMatch`.
- Legacy `/play/:matchId` for Tournament → router redirect to `LiveMatch`; the redirect itself does not start a scheduled/pending Match.
- Direct `/matches/:matchId/live` → resume/import only. It cannot start a pending/scheduled fixture.

## 5. Scorer authority

The only real Tournament scoring policy currently present is the active-club `tournaments.score.update` permission. Explicit start requires that permission and a concrete actor ID. The initiating authorized actor is persisted as `Match.scorerId` and becomes the session scorer. A URL does not grant authority, and Tournament participants are not silently allowed to score.

An existing live session retains its assigned scorer. Tournament emergency control also checks `tournaments.score.update`, not the generic live-score permission.

**PRODUCT DECISION — TOURNAMENT SCORER AUTHORITY:** there is no persisted per-fixture official/umpire assignment model. Production needs an explicit policy and server-enforced assignment/override workflow.

## 6. Group completion

`FinishPhysicalMatch` first makes the canonical session terminal and supplies stable `result-{matchId}` identity. The engine state is normalized to Tournament set/game totals and winner ID, then passed to the existing Tournament result handler. Group standings continue to derive from completed/walkover Match records; no standings logic was moved into the live view.

The store and mock result endpoint both short-circuit a repeated canonical `resultId`, so the same physical completion is applied once.

## 7. Knockout completion

The live scorer emits the same normalized result to the Tournament result handler. The existing API updates the knockout Match, calls the existing bracket progression function, and synchronizes new bracket Matches. Stable canonical `resultId` handling prevents the same completion from advancing the bracket twice.

No bracket-generation or seeding algorithm was redesigned.

## 8. Walkover / retirement / manual result

- Walkover: remains in `TournamentMatchModal`; it creates no `LiveMatchSession` and records the existing administrative walkover payload.
- Retirement: no Tournament retirement outcome exists in the inspected UI/model/API, so it remains **NOT IMPLEMENTED**.
- Manual result: remains available for pending/scheduled fixtures and completed/walkover corrections. It does not create a live session and does not pass through the tennis engine.

## 9. Legacy state migration

Legacy rules are accepted only when the Match or persisted category resolves unambiguously. Newer-stack legacy score state is importable only when it contains the engine-shaped `sets`, `currentGame`, and `completedSets` fields. It is imported once under canonical `Match.id`.

Old placeholder/counter shapes such as only `p1Points/p2Points`, missing sessions for already-live Matches, missing scorers, and ambiguous formats are reported explicitly. They are never reset to 0-0.

## 10. `/play/:matchId`

The route remains registered for compatibility. Ladder and Tournament Matches redirect to `/matches/:matchId/live`. Unsupported sources go to Match Details with `live=unsupported-source`; missing/unavailable Matches go to the existing explicit fallback. Navigation never performs the physical start.

## 11. Old scorer audit

Remaining references:

- `router/index.js` still registers `PlayView` at the compatibility `PlayMatch` route, but its guard redirects every recognized Ladder/Tournament source before render.
- `PlayView.vue` is the only component importing `TennisScoreboard.vue`.
- Unrouted `MatchesView.vue` still contains an old `/play/:id` navigation.
- `tournamentStore.saveLiveState` and `createTournamentLiveState` remain as unused compatibility exports.
- Comments in `tennisScoring.js` still document the legacy component shape.

No active product flow found in this audit requires `PlayView/TennisScoreboard`.

## 12. Friendly route assessment

Friendly already uses the canonical scoring engine, `LiveMatchSession`, and `LiveMatchControl`, but it still enters through `/friendly-match/live/:matchId`. Moving Friendly to `/matches/:matchId/live` still requires a persisted/retrievable canonical Friendly Match, a source-neutral Friendly start/resume adapter, invitation/owner authorization mapping, and result-route compatibility. Those changes were outside this phase.

## 13. Files created

- `src/services/LiveMatchService.js`
- `src/domain/tournamentMatchResult.js`
- `test/canonicalTournamentLive.test.js`
- `TOURNAMENT_CANONICAL_LIVE_MIGRATION_REPORT.md`

## 14. Files modified

- `src/composables/useTournamentFixtures.js`
- `src/router/index.js`
- `src/services/ApiService.js`
- `src/services/MatchService.js`
- `src/stores/friendlyMatch.js`
- `src/stores/tournament.js`
- `src/views/FriendlyMatchFlowView.vue`
- `src/views/LiveMatchView.vue`
- `src/views/LiveOperationDetailView.vue`
- `src/views/MatchDetailsView.vue`
- `src/views/PlayHubView.vue`
- `src/views/TournamentCategory.vue`
- `test/canonicalLadderLive.test.js`

## 15. Tests/build

- `node --test test/canonicalTournamentLive.test.js`: PASS, 5/5.
- `npm.cmd test`: PASS, 124/124.
- `npm.cmd run build`: PASS, 371 modules transformed.
- `git diff --check`: PASS. Git emitted only the repository's LF-to-CRLF working-copy notices.

Vite retained its existing warnings about mixed static/dynamic imports and a JavaScript chunk larger than 500 kB; there was no build failure.

## 16. Manual verification checklist

Browser automation was attempted against the successfully started local Vite server, but the browser runtime repeatedly exited because the Windows sandbox could not apply the workspace's deny-read ACL. The following browser-only checks are therefore **NOT VERIFIED**, not claimed as passing:

- [ ] Start and complete a group Match through the Tournament UI.
- [ ] Start and complete a knockout Match and visually confirm one advancement.
- [ ] Exercise `best3`, `matchtb`, and `oneset` in the rendered scorer.
- [ ] Verify public scoreboard, TV pairing, live feed, and Live Operations visually.
- [ ] Refresh/reopen a live Match and confirm the visible score resumes.
- [ ] Submit a manual result and a walkover without a session.
- [ ] Open legacy `/play/:matchId` and confirm canonical redirection.

The equivalent domain/service/route behaviors are covered by the passing automated tests.

## 17. Backend contract

Production start should authenticate the actor, authorize the Tournament scorer/official, validate Tournament ownership and fixture lifecycle, resolve and freeze `Match.rulesSnapshot`, mark Match/fixture live, create or retrieve the `LiveMatchSession`, persist scorer authority, and return Match + session + narrow Tournament context.

Production completion should accept the stable result ID and normalized physical result, atomically complete the fixture, update either group standings inputs or knockout progression, and enforce idempotency. The server—not a client `authorized` flag—must be authoritative.

## 18. Existing problems not touched

- Per-fixture Tournament official/scorer assignment does not exist.
- Tournament retirement is not modeled.
- Seeded demo Tournament categories do not store a scoring format; their legacy live starts now block explicitly until resolved.
- Sessions/realtime remain browser/mock persistence rather than Laravel/WebSockets.
- Existing manual knockout winner corrections may require a future explicit policy if downstream Matches have already progressed.
- Legacy scorer files/routes remain in the repository pending a separate cleanup.
- Browser acceptance could not run because of the local Windows ACL/sandbox failure described above.

## 19. Readiness decisions

**Are Friendly, Ladder and Tournament now all using the same canonical scoring engine/session?**

**YES**

Friendly uses its existing route, but all three use the canonical tennis engine, `LiveMatchSession`, and shared `LiveMatchControl`.

**Does any active product flow still require PlayView/TennisScoreboard?**

**NO**

**Is Gorra ready for legacy live-scorer cleanup/removal?**

**READY**

The cleanup was not performed in this phase.
