import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createStandaloneMatchTieBreakRules,
  createStandardMatchRulesSnapshot,
} from '../src/domain/matchRules.js'
import {
  matchRulesDraftToSnapshot,
  matchRulesSnapshotToDraft,
} from '../src/domain/matchRulesEditor.js'
import { withFriendlyScoringFormat } from '../src/domain/ruleAdapters/friendlyMatchRules.js'
import {
  ladderRulesToMatchRulesSnapshot,
  matchRulesSnapshotToLegacyLadderConfig,
} from '../src/domain/ruleAdapters/ladderMatchRules.js'
import { formatMatchRulesSummary } from '../src/utils/matchRulesSummary.js'

test('editor draft round-trips every canonical set, game, tiebreak, and deciding rule', () => {
  const rules = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 3 },
    set: {
      gamesToWin: 4,
      winBy: 3,
      tiedAtTarget: {
        mode: 'tiebreak',
        tiebreak: { pointsToWin: 9, winBy: 3 },
      },
    },
    game: { mode: 'numeric', pointsToWin: 5, winBy: 2 },
    decidingSet: { mode: 'match_tiebreak', pointsToWin: 12, winBy: 4 },
  })
  const editable = matchRulesSnapshotToDraft(rules)
  assert.equal(editable.ok, true)
  const rebuilt = matchRulesDraftToSnapshot(editable.draft)
  assert.equal(rebuilt.ok, true)
  assert.deepEqual(rebuilt.snapshot, rules)
})

test('editor draft round-trips a standalone match tiebreak', () => {
  const rules = createStandaloneMatchTieBreakRules({ pointsToWin: 15, winBy: 3 })
  const editable = matchRulesSnapshotToDraft(rules)
  assert.equal(editable.draft.matchMode, 'tiebreak')
  assert.deepEqual(matchRulesDraftToSnapshot(editable.draft).snapshot, rules)
})

test('conditional editor rules omit irrelevant tied-set and deciding-set fields', () => {
  const editable = matchRulesSnapshotToDraft(createStandardMatchRulesSnapshot()).draft
  editable.setsToWin = 1
  editable.setWinBy = 1
  editable.setTieMode = 'tiebreak'
  editable.decidingSetMode = 'match_tiebreak'
  const rebuilt = matchRulesDraftToSnapshot(editable)
  assert.equal(rebuilt.ok, true)
  assert.deepEqual(rebuilt.snapshot.set.tiedAtTarget, { mode: 'continue', tiebreak: null })
  assert.deepEqual(rebuilt.snapshot.decidingSet, { mode: 'normal_set' })
})

test('editor validation rejects out-of-range values without clamping', () => {
  const editable = matchRulesSnapshotToDraft(createStandardMatchRulesSnapshot()).draft
  editable.gamesToWin = 99
  const rebuilt = matchRulesDraftToSnapshot(editable)
  assert.equal(rebuilt.ok, false)
  assert.equal(rebuilt.candidate.set.gamesToWin, 99)
  assert.ok(rebuilt.errors.some((error) => error.path === 'set.gamesToWin'))
})

test('plain-English summary uses one shared canonical vocabulary', () => {
  const rules = createStandardMatchRulesSnapshot({
    game: { mode: 'traditional', deuce: 'advantage' },
    decidingSet: { mode: 'match_tiebreak', pointsToWin: 10, winBy: 2 },
  })
  const summary = formatMatchRulesSummary(rules)
  assert.equal(summary.match, 'Best of 3 sets')
  assert.equal(summary.game, 'Traditional · Advantage')
  assert.equal(summary.set, 'First to 6 games · win by 2')
  assert.equal(summary.tiebreak, '7-point tiebreak at 6–6')
  assert.equal(summary.decidingSet, '10-point deciding match tiebreak')
})

test('Friendly scoring changes keep a selected custom snapshot canonical', () => {
  const custom = createStandardMatchRulesSnapshot({
    game: { mode: 'numeric', pointsToWin: 5, winBy: 2 },
  })
  const noAd = withFriendlyScoringFormat(custom, 'noad')

  assert.equal(noAd.game.mode, 'traditional')
  assert.equal(noAd.game.deuce, 'no_ad')
  assert.equal(Object.isFrozen(noAd), true)
  assert.equal(custom.game.mode, 'numeric')
})

test('Ladder defaults load through the adapter and legacy config is projection-only', () => {
  const adapted = ladderRulesToMatchRulesSnapshot({
    ladderConfigSnapshot: { scoring: 'noad', matchPreset: 'time-smart' },
    matchConfig: {
      matchFormat: 'best_of_3',
      setWinRule: 'standard',
      gameScoringRule: 'sudden_death',
      finalSetRule: 'super_tiebreak',
    },
  })
  assert.equal(adapted.ok, true)
  assert.equal(adapted.snapshot.game.deuce, 'no_ad')
  assert.equal(adapted.snapshot.decidingSet.mode, 'match_tiebreak')
  assert.deepEqual(matchRulesSnapshotToLegacyLadderConfig(adapted.snapshot), {
    matchType: 'singles',
    matchFormat: 'best_of_3',
    gamesToWin: 6,
    setWinBy: 2,
    setWinRule: 'standard',
    tieBreakPointsToWin: 7,
    tieBreakWinBy: 2,
    gameMode: 'traditional',
    gameScoringRule: 'sudden_death',
    numericGamePointsToWin: undefined,
    numericGameWinBy: undefined,
    finalSetRule: 'super_tiebreak',
    decidingTieBreakPointsToWin: 10,
    decidingTieBreakWinBy: 2,
    locked: true,
  })
})

test('one editor supports editable and read-only setup contexts with prototype copy intact', () => {
  const editor = readFileSync('src/components/match/MatchFormatEditor.vue', 'utf8')
  assert.ok(editor.includes('editable: { type: Boolean, default: true }'))
  assert.ok(editor.includes(':disabled="!editable'))
  assert.ok(editor.includes('v-if="editable && showSave"'))
  assert.ok(editor.includes('Set up how this match is won.'))
  assert.ok(editor.includes('You only need to answer three things:'))
  assert.ok(editor.includes('how to win the match, how to win a set, and how to win'))
  assert.ok(editor.includes('a game.'))
  assert.ok(editor.includes('v-if="Number(draft.setWinBy) > 1"'))
  assert.ok(editor.includes('draft.decidingSetMode ==='))
})

test('Friendly, Play to Ladder, and rankings reuse the editor without route migration', () => {
  const flow = readFileSync('src/views/FriendlyMatchFlowView.vue', 'utf8')
  const drawer = readFileSync('src/components/ladder/AdminLadderMatchDrawer.vue', 'utf8')
  const router = readFileSync('src/router/index.js', 'utf8')
  const store = readFileSync('src/stores/friendlyMatch.js', 'utf8')

  assert.ok(router.includes("path: '/friendly-match/custom-format'"))
  assert.ok(router.includes("alias: '/ladder-match/format'"))
  assert.ok(router.includes("path: '/rankings'"))
  assert.ok(flow.includes('v-model="customFormatRules"'))
  assert.ok(flow.includes(':model-value="ladderSetupRules"'))
  assert.ok(flow.includes(':editable="false"'))
  assert.ok(flow.includes("customFormat: 'FriendlyMatchFormat'"))
  assert.ok(store.includes('rulesSnapshot: draft.value.rulesSnapshot'))
  assert.ok(store.includes('rulesSnapshot: resolvedRules.snapshot'))
  assert.ok(store.includes('matchSetup: {'))
  assert.ok(drawer.includes('rulesEditable: { type: Boolean, default: true }'))
  assert.ok(drawer.includes('<MatchFormatEditor'))
  assert.ok(drawer.includes('rulesSnapshot: currentRulesSnapshot.value'))
  assert.equal(drawer.includes('<option value="best_of_3">'), false)
})
