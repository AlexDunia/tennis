import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('Bulk Play Now paths start the one created canonical Ladder Match before exposing LiveMatch', () => {
  const source = readFileSync('src/components/ladder/LadderBulkScheduler.vue', 'utf8')
  const directPlay = source.slice(source.indexOf('async function playPendingPairNow()'), source.indexOf('function recordMissingFromPair()'))
  const scheduledPlay = source.slice(source.indexOf('async function saveSchedule()'), source.indexOf('function requestCancellation('))

  assert.match(source, /import \{ startOrResumeLadderMatch \}/)
  assert.match(source, /async function startCreatedBulkLadderMatch[\s\S]*explicitStart: true/)
  assert.match(directPlay, /createAdminLadderMatch[\s\S]*startCreatedBulkLadderMatch/)
  assert.match(scheduledPlay, /createAdminLadderMatch[\s\S]*startCreatedBulkLadderMatch/)
  assert.match(source, /started\.match\?\.id !== match\?\.id/)
  assert.match(source, /name: 'LiveMatch'/)
  assert.match(source, /Match created, but it could not start\./)
  assert.doesNotMatch(directPlay, /Match ready to play\./)
})
