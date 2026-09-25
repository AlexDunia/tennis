import assert from 'node:assert/strict'
import test from 'node:test'
import { createLiveMatchPresenceService } from '../src/services/LiveMatchPresenceService.js'

function createHarness() {
  let currentTime = 1000
  let heartbeat = null
  const service = createLiveMatchPresenceService({
    now: () => currentTime,
    channel: null,
    setInterval: (callback) => { heartbeat = callback; return 1 },
    clearInterval: () => { heartbeat = null },
  })
  return { service, advance: (ms) => { currentTime += ms }, heartbeat: () => heartbeat?.() }
}

test('join returns a presence id and normalizes bounded public fields', () => {
  const { service } = createHarness()
  const joined = service.join({ matchId: ' match ', actorId: ' actor ', actorName: ' ', role: 'unknown' })
  const entry = service.list('match')[0]
  assert.ok(joined.presenceId)
  assert.deepEqual({ matchId: entry.matchId, actorId: entry.actorId, actorName: entry.actorName, role: entry.role }, { matchId: 'match', actorId: 'actor', actorName: 'Someone', role: 'viewer' })
  joined.leave(); service.dispose()
})

test('invalid identity does not create presence', () => {
  const { service } = createHarness()
  assert.equal(service.join({ matchId: 'match' }).presenceId, '')
  assert.deepEqual(service.list('match'), [])
  service.dispose()
})

test('subscribe provides a snapshot then join and leave events', () => {
  const { service } = createHarness()
  const events = []
  const stop = service.subscribe('match', (_entries, event) => events.push(event.type))
  const joined = service.join({ matchId: 'match', actorId: 'a', actorName: 'A' })
  joined.leave(); stop(); service.dispose()
  assert.deepEqual(events, ['snapshot', 'join', 'leave'])
})

test('updateRole changes display role without changing identity', () => {
  const { service } = createHarness()
  const joined = service.join({ matchId: 'match', actorId: 'a', actorName: 'A', role: 'viewer' })
  joined.updateRole('scorer')
  assert.equal(service.list('match')[0].role, 'scorer')
  joined.leave(); service.dispose()
})

test('the heartbeat refreshes local presence', () => {
  const harness = createHarness()
  const joined = harness.service.join({ matchId: 'match', actorId: 'a', actorName: 'A' })
  const firstSeen = harness.service.list('match')[0].lastSeenAt
  harness.advance(5000); harness.heartbeat()
  assert.ok(harness.service.list('match')[0].lastSeenAt > firstSeen)
  joined.leave(); harness.service.dispose()
})

test('presence expires after eighteen seconds without a heartbeat', () => {
  const first = createHarness()
  const second = createHarness()
  const joined = first.service.join({ matchId: 'match', actorId: 'a', actorName: 'A' })
  assert.equal(second.service.list('match').length, 1)
  second.advance(18001)
  assert.deepEqual(second.service.list('match'), [])
  joined.leave(); first.service.dispose(); second.service.dispose()
})

test('visible entries deduplicate an actor by the strongest role at the same time', () => {
  const first = createHarness()
  const second = createHarness()
  const one = first.service.join({ matchId: 'match', actorId: 'a', actorName: 'A', role: 'viewer' })
  const two = second.service.join({ matchId: 'match', actorId: 'a', actorName: 'A', role: 'scorer' })
  assert.equal(first.service.list('match').length, 1)
  assert.equal(first.service.list('match')[0].role, 'scorer')
  one.leave(); two.leave(); first.service.dispose(); second.service.dispose()
})

test('presence stays scoped to its match', () => {
  const { service } = createHarness()
  const joined = service.join({ matchId: 'match-a', actorId: 'a', actorName: 'A' })
  assert.equal(service.list('match-b').length, 0)
  joined.leave(); service.dispose()
})

test('a late subscriber receives existing runtime presence through sync', () => {
  const first = createHarness()
  const joined = first.service.join({ matchId: 'match', actorId: 'a', actorName: 'A' })
  const second = createHarness()
  const snapshots = []
  const stop = second.service.subscribe('match', (entries) => snapshots.push(entries.length))
  assert.ok(snapshots.includes(1))
  stop(); joined.leave(); first.service.dispose(); second.service.dispose()
})

test('dispose clears presence and subscriber state', () => {
  const { service } = createHarness()
  service.join({ matchId: 'match', actorId: 'a', actorName: 'A' })
  service.dispose()
  assert.deepEqual(service.list('match'), [])
})