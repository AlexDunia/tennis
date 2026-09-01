import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MATCH_RULE_LIMITS,
  MATCH_RULES_SCHEMA_VERSION,
  createStandaloneMatchTieBreakRules,
  createStandardMatchRulesSnapshot,
  freezeMatchRulesSnapshot,
  validateMatchRulesSnapshot,
} from '../src/domain/matchRules.js'
import { toTennisEngineConfig } from '../src/domain/toTennisEngineConfig.js'
import { friendlyRulesToMatchRulesSnapshot } from '../src/domain/ruleAdapters/friendlyMatchRules.js'
import { ladderRulesToMatchRulesSnapshot } from '../src/domain/ruleAdapters/ladderMatchRules.js'
import { tournamentRulesToMatchRulesSnapshot } from '../src/domain/ruleAdapters/tournamentMatchRules.js'
import { toCanonicalMatch } from '../src/domain/match.js'
import { createLiveMatchSessionContract } from '../src/domain/liveMatchSession.js'

test('canonical standard rules are explicit, serializable, versioned, and valid', () => {
  const rules = createStandardMatchRulesSnapshot()
  assert.equal(rules.schemaVersion, MATCH_RULES_SCHEMA_VERSION)
  assert.equal(rules.sport, 'tennis')
  assert.deepEqual(rules.match, { mode: 'sets', setsToWin: 2 })
  assert.deepEqual(rules.set, {
    gamesToWin: 6,
    winBy: 2,
    tiedAtTarget: {
      mode: 'tiebreak',
      tiebreak: { pointsToWin: 7, winBy: 2 },
    },
  })
  assert.deepEqual(rules.game, { mode: 'traditional', deuce: 'advantage' })
  assert.deepEqual(rules.decidingSet, { mode: 'normal_set' })
  assert.equal(validateMatchRulesSnapshot(rules).valid, true)
  assert.deepEqual(JSON.parse(JSON.stringify(rules)), rules)
})

test('validation reports structured range and required errors without clamping', () => {
  const invalid = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 0 },
    set: {
      gamesToWin: 0,
      winBy: 0,
      tiedAtTarget: {
        mode: 'tiebreak',
        tiebreak: { pointsToWin: 0, winBy: 0 },
      },
    },
    game: { mode: 'numeric', deuce: undefined, pointsToWin: 0, winBy: 0 },
    decidingSet: { mode: 'match_tiebreak', pointsToWin: 0, winBy: 0 },
  })
  const validation = validateMatchRulesSnapshot(invalid)
  assert.equal(validation.valid, false)
  for (const path of [
    'match.setsToWin',
    'set.gamesToWin',
    'set.winBy',
    'set.tiedAtTarget.tiebreak.pointsToWin',
    'set.tiedAtTarget.tiebreak.winBy',
    'game.pointsToWin',
    'game.winBy',
    'decidingSet.pointsToWin',
    'decidingSet.winBy',
  ]) {
    assert.ok(
      validation.errors.some((error) => error.path === path),
      path,
    )
  }
  assert.equal(invalid.match.setsToWin, 0)
})

test('validation rejects structurally contradictory rule combinations', () => {
  const continueWithTieBreak = createStandardMatchRulesSnapshot({
    set: {
      tiedAtTarget: {
        mode: 'continue',
        tiebreak: null,
      },
    },
  })
  continueWithTieBreak.set.tiedAtTarget.tiebreak = { pointsToWin: 7, winBy: 2 }

  const traditionalWithNumeric = createStandardMatchRulesSnapshot()
  traditionalWithNumeric.game.pointsToWin = 4
  traditionalWithNumeric.game.winBy = 2

  const normalDeciderWithPoints = createStandardMatchRulesSnapshot()
  normalDeciderWithPoints.decidingSet.pointsToWin = 10
  normalDeciderWithPoints.decidingSet.winBy = 2
  assert.ok(
    validateMatchRulesSnapshot(continueWithTieBreak).errors.some(
      (error) => error.code === 'contradictory',
    ),
  )
  assert.ok(
    validateMatchRulesSnapshot(traditionalWithNumeric).errors.some(
      (error) => error.code === 'contradictory',
    ),
  )
  assert.ok(
    validateMatchRulesSnapshot(normalDeciderWithPoints).errors.some(
      (error) => error.code === 'contradictory',
    ),
  )
})

test('central limits are conservative, explicit, and enforced at each boundary', () => {
  assert.deepEqual(MATCH_RULE_LIMITS.setsToWin, { min: 1, max: 5 })
  assert.deepEqual(MATCH_RULE_LIMITS.gamesToWin, { min: 1, max: 12 })
  assert.deepEqual(MATCH_RULE_LIMITS.setWinBy, { min: 1, max: 6 })
  assert.deepEqual(MATCH_RULE_LIMITS.tieBreakPointsToWin, { min: 1, max: 50 })
  assert.deepEqual(MATCH_RULE_LIMITS.tieBreakWinBy, { min: 1, max: 10 })
  assert.deepEqual(MATCH_RULE_LIMITS.numericGamePointsToWin, { min: 1, max: 50 })
  assert.deepEqual(MATCH_RULE_LIMITS.numericGameWinBy, { min: 1, max: 10 })

  const tooLarge = createStandardMatchRulesSnapshot({
    set: { gamesToWin: MATCH_RULE_LIMITS.gamesToWin.max + 1 },
  })
  assert.ok(
    validateMatchRulesSnapshot(tooLarge).errors.some(
      (error) => error.path === 'set.gamesToWin' && error.code === 'out_of_range',
    ),
  )
})

test('the canonical engine adapter maps every supported rule explicitly', () => {
  const rules = createStandardMatchRulesSnapshot({
    match: { mode: 'sets', setsToWin: 3 },
    set: {
      gamesToWin: 4,
      winBy: 3,
      tiedAtTarget: {
        mode: 'tiebreak',
        tiebreak: { pointsToWin: 10, winBy: 3 },
      },
    },
    game: { mode: 'numeric', deuce: undefined, pointsToWin: 5, winBy: 2 },
    decidingSet: { mode: 'match_tiebreak', pointsToWin: 12, winBy: 4 },
  })
  assert.deepEqual(toTennisEngineConfig(rules), {
    mode: 'sets',
    setsToWin: 3,
    bestOfSets: 5,
    gamesPerSet: 4,
    setWinBy: 3,
    tieBreakBehavior: 'tiebreak',
    tieBreakAt: 4,
    tieBreakPoints: 10,
    tieBreakWinBy: 3,
    gameMode: 'numeric',
    scoring: 'ad',
    numericGamePoints: 5,
    numericGameWinBy: 2,
    decidingMatchTieBreak: true,
    decidingTieBreakPoints: 12,
    decidingTieBreakWinBy: 4,
  })
})

test('standalone tiebreak is distinct from normal and deciding-set tiebreaks', () => {
  const rules = createStandaloneMatchTieBreakRules({ pointsToWin: 15, winBy: 3 })
  assert.equal(validateMatchRulesSnapshot(rules).valid, true)
  assert.equal(rules.match.mode, 'tiebreak')
  assert.equal(rules.set, null)
  const engine = toTennisEngineConfig(rules)
  assert.equal(engine.mode, 'tiebreak')
  assert.equal(engine.tieBreakPoints, 15)
  assert.equal(engine.tieBreakWinBy, 3)
  assert.equal(engine.decidingMatchTieBreak, false)
})

test('Friendly adapter preserves standard, custom, continue, and standalone formats', () => {
  const noAd = friendlyRulesToMatchRulesSnapshot({
    format: 'noad',
    matchFormat: 'best-of-3',
  })
  assert.equal(noAd.ok, true)
  assert.equal(noAd.snapshot.game.deuce, 'no_ad')
  assert.equal(noAd.snapshot.match.setsToWin, 2)

  const custom = friendlyRulesToMatchRulesSnapshot({
    format: 'ad',
    matchFormat: 'custom',
    customFormat: {
      mode: 'sets',
      setsToWin: 1,
      gamesPerSet: 4,
      setWinBy: 2,
      tieBreakAt: 0,
      tieBreakPoints: 10,
    },
  })
  assert.equal(custom.ok, true)
  assert.equal(custom.snapshot.set.gamesToWin, 4)
  assert.equal(custom.snapshot.set.tiedAtTarget.mode, 'continue')
  assert.equal(custom.snapshot.set.tiedAtTarget.tiebreak, null)

  const standalone = friendlyRulesToMatchRulesSnapshot({
    format: 'ad',
    matchFormat: 'match-tiebreak',
  })
  assert.equal(standalone.ok, true)
  assert.equal(standalone.snapshot.match.mode, 'tiebreak')
})

test('Friendly adapter refuses missing rule decisions instead of guessing', () => {
  const result = friendlyRulesToMatchRulesSnapshot({ matchFormat: 'best-of-3' })
  assert.equal(result.ok, false)
  assert.equal(result.state, 'legacy_unresolved')
  assert.equal(result.issues[0].path, 'format')
})

test('Ladder adapter preserves locked format, No-Ad, no-tiebreak, and deciding tiebreak', () => {
  const result = ladderRulesToMatchRulesSnapshot({
    ladderConfigSnapshot: {
      scoring: 'noad',
      matchPreset: 'time-smart',
      matchFormat: 'match-tiebreak-third',
    },
    matchConfig: {
      matchFormat: 'best_of_3',
      setWinRule: 'no_tiebreak',
      gameScoringRule: 'sudden_death',
      finalSetRule: 'super_tiebreak',
      locked: true,
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.snapshot.match.setsToWin, 2)
  assert.equal(result.snapshot.game.deuce, 'no_ad')
  assert.equal(result.snapshot.set.tiedAtTarget.mode, 'continue')
  assert.deepEqual(result.snapshot.decidingSet, {
    mode: 'match_tiebreak',
    pointsToWin: 10,
    winBy: 2,
  })
})

test('Ladder adapter supports canonical future numeric settings without scoring itself', () => {
  const result = ladderRulesToMatchRulesSnapshot({
    matchConfig: {
      matchFormat: 'best_of_5',
      setWinRule: 'standard',
      gameScoringRule: 'normal',
      gameMode: 'numeric',
      numericGamePointsToWin: 4,
      numericGameWinBy: 2,
      finalSetRule: 'same',
    },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.snapshot.game, { mode: 'numeric', pointsToWin: 4, winBy: 2 })
  assert.equal(result.snapshot.match.setsToWin, 3)
})

test('Ladder adapter marks ambiguous legacy data unresolved', () => {
  const result = ladderRulesToMatchRulesSnapshot({})
  assert.equal(result.ok, false)
  assert.equal(result.state, 'legacy_unresolved')
  assert.match(result.issues[0].message, /does not identify/)
})

test('Tournament adapter maps all exposed formats and refuses ambiguous fixtures', () => {
  const best3 = tournamentRulesToMatchRulesSnapshot({ settings: { scoring: 'best3' } })
  const matchtb = tournamentRulesToMatchRulesSnapshot({ settings: { scoring: 'matchtb' } })
  const oneset = tournamentRulesToMatchRulesSnapshot({ settings: { scoring: 'oneset' } })
  assert.equal(best3.snapshot.match.setsToWin, 2)
  assert.equal(best3.snapshot.decidingSet.mode, 'normal_set')
  assert.ok(best3.warnings.some((warning) => warning.code === 'legacy_inherited_default'))
  assert.equal(matchtb.snapshot.decidingSet.mode, 'match_tiebreak')
  assert.equal(oneset.snapshot.match.setsToWin, 1)

  const ambiguous = tournamentRulesToMatchRulesSnapshot({ id: 'legacy-fixture' })
  assert.equal(ambiguous.ok, false)
  assert.equal(ambiguous.state, 'legacy_unresolved')

  const conflicting = tournamentRulesToMatchRulesSnapshot({
    scoring: 'oneset',
    category: { settings: { scoring: 'best3' } },
  })
  assert.equal(conflicting.ok, false)
  assert.match(conflicting.issues[0].message, /conflict/)
})

test('frozen rules snapshot cannot be mutated once play begins', () => {
  const frozen = freezeMatchRulesSnapshot(createStandardMatchRulesSnapshot())
  assert.equal(Object.isFrozen(frozen), true)
  assert.equal(Object.isFrozen(frozen.set.tiedAtTarget.tiebreak), true)
  assert.throws(() => {
    frozen.match.setsToWin = 5
  }, TypeError)
})

test('initial Match contract reuses legacy fields and identifies missing rules', () => {
  const rules = createStandardMatchRulesSnapshot()
  const resolved = toCanonicalMatch(
    {
      id: 'match-1',
      type: 'ladder',
      clubId: 'club-1',
      challengeId: 'challenge-1',
      challengerId: 'p1',
      defenderId: 'p2',
      challengerName: 'A',
      defenderName: 'B',
      status: 'scheduled',
    },
    { rulesSnapshot: rules },
  )
  assert.equal(resolved.ok, true)
  assert.equal(resolved.match.source, 'ladder')
  assert.deepEqual(resolved.match.sourceRef, { type: 'ladder', id: 'challenge-1' })
  assert.deepEqual(resolved.match.sides[0].participantIds, ['p1'])
  assert.equal(resolved.match.rulesState, 'resolved')

  const legacy = toCanonicalMatch({ id: 'match-2', type: 'tournament', status: 'pending' })
  assert.equal(legacy.ok, false)
  assert.equal(legacy.match.rulesState, 'legacy_unresolved')
  assert.ok(legacy.issues.some((item) => item.code === 'legacy_unresolved'))
})

test('initial LiveMatchSession contract separates engine and authority revisions', () => {
  const engineState = { revision: 4, status: 'live' }
  const result = createLiveMatchSessionContract({
    id: 'session-1',
    matchId: 'match-1',
    status: 'live',
    engineState,
    scoreRevision: 4,
    authorityRevision: 2,
    scorerAuthority: { scorerId: 'p1', assignedBy: 'manager-1' },
    projection: { version: 3, publishedAt: '2026-09-01T10:05:00.000Z' },
  })
  assert.equal(result.ok, true)
  assert.equal(result.session.matchId, 'match-1')
  assert.equal(result.session.scoreRevision, 4)
  assert.equal(result.session.authorityRevision, 2)
  assert.notEqual(result.session.engineState, engineState)

  const mismatch = createLiveMatchSessionContract({
    matchId: 'match-1',
    engineState,
    scoreRevision: 3,
  })
  assert.equal(mismatch.ok, false)
  assert.ok(mismatch.issues.some((item) => item.code === 'revision_mismatch'))
})
