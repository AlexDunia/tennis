import assert from 'node:assert/strict'
import test from 'node:test'
import { applyLiveMatchSessionCommand, createLiveMatchSessionFromMatch } from '../src/domain/liveMatchSession.js'
import { createStandardMatchRulesSnapshot } from '../src/domain/matchRules.js'

function command(session, type, actorId, payload = {}, authorized = false) {
  return applyLiveMatchSessionCommand(session, {
    id: `${type}-${actorId}-${session.scoreRevision}-${session.authorityRevision}`,
    type,
    actorId,
    authorized,
    expectedScoreRevision: session.scoreRevision,
    expectedAuthorityRevision: session.authorityRevision,
    payload,
  })
}

test('scoring authority handoff preserves canonical score and separates revisions', () => {
  const created = createLiveMatchSessionFromMatch({
    id: 'authority-match', clubId: 'club-1', source: 'ladder', lifecycleStatus: 'live',
    rulesSnapshot: createStandardMatchRulesSnapshot(),
    sides: [
      { key: 'sideA', id: 'player-a', name: 'A', participantIds: ['player-a'] },
      { key: 'sideB', id: 'player-b', name: 'B', participantIds: ['player-b'] },
    ],
  }, { scorerId: 'player-a' })
  assert.equal(created.ok, true)
  const scored = command(created.session, 'record_point', 'player-a', { side: 'you' })
  assert.equal(scored.ok, true)
  const assigned = command(scored.session, 'assign_scorer', 'club-admin', { scorerId: 'player-b' }, true)
  assert.equal(assigned.ok, true)
  assert.deepEqual(assigned.session.engineState, scored.session.engineState)
  assert.equal(assigned.session.scoreRevision, scored.session.scoreRevision)
  assert.equal(assigned.session.authorityRevision, scored.session.authorityRevision + 1)
  assert.equal(assigned.session.scorerAuthority.scorerId, 'player-b')

  const oldScorer = command(assigned.session, 'record_point', 'player-a', { side: 'you' })
  assert.equal(oldScorer.ok, false)
  assert.equal(oldScorer.code, 'forbidden')
  const newScorer = command(assigned.session, 'record_point', 'player-b', { side: 'opponent' })
  assert.equal(newScorer.ok, true)
  const unauthorized = command(newScorer.session, 'assign_scorer', 'outsider', { scorerId: 'player-a' })
  assert.equal(unauthorized.ok, false)
  assert.equal(unauthorized.code, 'forbidden')
})