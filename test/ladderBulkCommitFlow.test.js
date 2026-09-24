import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Bulk commits are normalized and preserve queued draft identity', () => {
  const source = readFileSync('src/components/ladder/LadderBulkScheduler.vue', 'utf8')
  for (const marker of ['evaluateLadderMatchup', 'buildAdminLadderMatchCommitPayload', 'createLadderMatchCommitRequestId', 'Play Ladder Match', 'Schedule Match', 'Record missing match', "creationMode: 'bulk'", "timing: 'now'", "timing: 'scheduled'", 'pair.id', 'draft.id']) assert.ok(source.includes(marker), marker)
  assert.doesNotMatch(source, /Set challenge/)
  const schedule = source.slice(source.indexOf('async function saveSchedule()'))
  assert.ok(schedule.indexOf('createAdminLadderMatch') < schedule.indexOf('removeDraft(draft.id, commitScope)'))
})