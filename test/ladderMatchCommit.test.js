import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAdminLadderMatchCommitPayload,
  createLadderMatchCommitRequestId,
} from '../src/domain/ladderMatchCommit.js'

function payload(extra = {}) {
  return buildAdminLadderMatchCommitPayload({
    clubId: 'club-a',
    ladderId: 'mens',
    challengerPlayerId: 'alex',
    opponentPlayerId: 'prince',
    timing: 'now',
    clientRequestId: 'request-a',
    ...extra,
  })
}

test('normalizes individual and bulk commit metadata', () => {
  assert.equal(payload().creationMode, 'individual')
  assert.equal(payload({ creationMode: 'bulk' }).creationMode, 'bulk')
  assert.equal(payload().scheduledAt, null)
})

test('normalizes scheduled timestamps and rejects invalid identities', () => {
  assert.equal(payload({ timing: 'scheduled', scheduledAt: '2027-01-01T12:00:00Z' }).scheduledAt, '2027-01-01T12:00:00.000Z')
  assert.throws(() => payload({ opponentPlayerId: 'alex' }))
  assert.throws(() => payload({ clubId: '' }))
  assert.throws(() => payload({ timing: 'invalid' }))
})

test('bulk draft request identities are stable', () => {
  const options = { creationMode: 'bulk', draftId: 'draft-abc' }
  assert.equal(createLadderMatchCommitRequestId(options), createLadderMatchCommitRequestId(options))
  assert.ok(createLadderMatchCommitRequestId().length > 0)
})
