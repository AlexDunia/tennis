import assert from 'node:assert/strict'
import test, { after, beforeEach } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  clearLadderPlayerAccessTestState,
  getOrCreateLadderPlayerAccess,
  resolveLadderPlayerAccess,
  rotateLadderPlayerAccess,
} from '../src/services/LadderPlayerAccessService.js'
import {
  getLadderSelfServiceActionLabel,
  getLadderSelfServiceAssignments,
  getLadderSelfServiceDestination,
} from '../src/domain/ladderPlayerSelfService.js'

class MemoryStorage {
  constructor() { this.values = new Map() }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(key, String(value)) }
}

const originalWindow = globalThis.window
beforeEach(() => { globalThis.window = { localStorage: new MemoryStorage() } })
after(() => { globalThis.window = originalWindow })

function challenge(id, status, extras = {}) {
  return {
    id,
    type: 'ladder',
    clubId: 'club-a',
    ladderId: 'ladder-a',
    challengerId: 'player-a',
    defenderId: 'player-b',
    status,
    ...extras,
  }
}

test('player access registry reuses one opaque locator per club and Ladder scope', () => {
  const first = getOrCreateLadderPlayerAccess({ clubId: 'club-a', ladderId: 'ladder-a' })
  const reused = getOrCreateLadderPlayerAccess({ clubId: 'club-a', ladderId: 'ladder-a' })
  const other = getOrCreateLadderPlayerAccess({ clubId: 'club-a', ladderId: 'ladder-b' })

  assert.equal(first.token, reused.token)
  assert.notEqual(first.token, other.token)
  assert.match(first.token, /^gpa_[A-Za-z0-9_-]+$/)
  assert.equal(first.token.includes('club-a'), false)
  assert.deepEqual(Object.keys(first).sort(), ['clubId', 'createdAt', 'ladderId', 'rotatedAt', 'token'])
  assert.deepEqual(resolveLadderPlayerAccess(first.token), first)
})

test('player access rotation invalidates the old locator and test cleanup is scoped to a club', () => {
  const old = getOrCreateLadderPlayerAccess({ clubId: 'club-a', ladderId: 'ladder-a' })
  const otherClub = getOrCreateLadderPlayerAccess({ clubId: 'club-b', ladderId: 'ladder-a' })
  const rotated = rotateLadderPlayerAccess({ clubId: 'club-a', ladderId: 'ladder-a' })

  assert.notEqual(rotated.token, old.token)
  assert.ok(rotated.rotatedAt)
  assert.equal(resolveLadderPlayerAccess(old.token), null)
  assert.equal(resolveLadderPlayerAccess(rotated.token)?.clubId, 'club-a')
  assert.equal(clearLadderPlayerAccessTestState({ clubId: 'club-a' }), 1)
  assert.equal(resolveLadderPlayerAccess(rotated.token), null)
  assert.equal(resolveLadderPlayerAccess(otherClub.token)?.clubId, 'club-b')
})

test('player access registry rejects corrupt storage and retains at most 100 records', () => {
  window.localStorage.setItem('gorra.ladder.playerAccess.v1', '{bad json')
  assert.equal(resolveLadderPlayerAccess('gpa_not-a-real-token'), null)
  const created = getOrCreateLadderPlayerAccess({ clubId: 'club-a', ladderId: 'ladder-a' })
  assert.ok(created)

  for (let index = 0; index < 105; index += 1) {
    getOrCreateLadderPlayerAccess({ clubId: 'club-many', ladderId: `ladder-${index}` })
  }
  const stored = JSON.parse(window.localStorage.getItem('gorra.ladder.playerAccess.v1'))
  assert.equal(stored.length, 100)
})

test('self-service assignments use only active, exact-scope Ladder records in the required order', () => {
  const challenges = [
    challenge('awaiting', 'awaiting'),
    challenge('accepted', 'accepted'),
    challenge('scheduled-late', 'scheduled', { scheduledAt: '2026-10-10T12:00:00.000Z' }),
    challenge('scheduled-early', 'scheduled', { scheduledAt: '2026-10-01T12:00:00.000Z' }),
    challenge('ready', 'ready'),
    challenge('live', 'live'),
    challenge('review', 'pending_review'),
    challenge('wrong-club', 'live', { clubId: 'club-b' }),
    { ...challenge('friendly', 'live'), type: 'friendly' },
    challenge('finished', 'completed'),
  ]
  const matches = [
    { id: 'friendly-shadow', type: 'friendly', challengeId: 'scheduled-early' },
    { id: 'match-scheduled-early', type: 'ladder', challengeId: 'scheduled-early' },
    { id: 'match-live', type: 'ladder', challengeId: 'live', scorerId: 'player-a', status: 'live' },
  ]
  const assignments = getLadderSelfServiceAssignments({
    challenges,
    matches,
    clubId: 'club-a',
    ladderId: 'ladder-a',
    playerId: 'player-a',
  })

  assert.deepEqual(assignments.map((item) => item.challenge.id), [
    'live', 'ready', 'scheduled-early', 'scheduled-late', 'accepted', 'awaiting', 'review',
  ])
  assert.equal(assignments.find((item) => item.challenge.id === 'scheduled-early').match.id, 'match-scheduled-early')
  assert.equal(assignments.some((item) => item.challenge.id === 'wrong-club'), false)
  assert.equal(assignments.some((item) => item.challenge.id === 'friendly'), false)
})

test('self-service destinations and labels preserve scorer authority and never create or start a match', () => {
  const live = challenge('live', 'live')
  const liveMatch = { id: 'match-live', type: 'ladder', challengeId: 'live', scorerId: 'player-a', status: 'live' }
  const ready = challenge('ready', 'ready')
  const scheduled = challenge('scheduled', 'scheduled')
  const awaiting = challenge('awaiting', 'awaiting')
  const review = challenge('review', 'pending_review')

  assert.deepEqual(getLadderSelfServiceDestination({ challenge: live, match: liveMatch, actorId: 'player-a' }), { name: 'LiveMatch', params: { matchId: 'match-live' } })
  assert.deepEqual(getLadderSelfServiceDestination({ challenge: live, match: liveMatch, actorId: 'player-b' }), { name: 'LiveScoreboard', params: { matchId: 'match-live' } })
  assert.deepEqual(getLadderSelfServiceDestination({ challenge: ready, match: { id: 'match-ready', status: 'ready' }, actorId: 'player-a' }), { name: 'MatchDetails', params: { matchId: 'match-ready' } })
  assert.deepEqual(getLadderSelfServiceDestination({ challenge: scheduled, match: { id: 'match-scheduled', status: 'scheduled' }, actorId: 'player-a' }), { name: 'MatchDetails', params: { matchId: 'match-scheduled' } })
  assert.deepEqual(getLadderSelfServiceDestination({ challenge: awaiting, actorId: 'player-a' }), { name: 'ChallengeDetails', params: { challengeId: 'awaiting' } })
  assert.deepEqual(getLadderSelfServiceDestination({ challenge: review, actorId: 'player-a' }), { name: 'ChallengeDetails', params: { challengeId: 'review' } })
  assert.equal(getLadderSelfServiceDestination({ challenge: live, match: liveMatch, actorId: 'outsider' }), null)

  assert.equal(getLadderSelfServiceActionLabel({ challenge: live, match: liveMatch, actorId: 'player-a' }), 'Resume scoring')
  assert.equal(getLadderSelfServiceActionLabel({ challenge: live, match: liveMatch, actorId: 'player-b' }), 'View live score')
  assert.equal(getLadderSelfServiceActionLabel({ challenge: ready, match: { id: 'match-ready', status: 'ready' }, actorId: 'player-a' }), 'Open ready match')
  assert.equal(getLadderSelfServiceActionLabel({ challenge: scheduled, match: { id: 'match-scheduled', status: 'scheduled' }, actorId: 'player-a' }), 'View scheduled match')
  assert.equal(getLadderSelfServiceActionLabel({ challenge: awaiting, actorId: 'player-a' }), 'View challenge')
  assert.equal(getLadderSelfServiceActionLabel({ challenge: challenge('accepted', 'accepted'), actorId: 'player-a' }), 'Continue challenge')
  assert.equal(getLadderSelfServiceActionLabel({ challenge: review, actorId: 'player-a' }), 'Review result')
})

test('Implementation 7 route and source stay protected and self-service-only', async () => {
  const [router, dialog, view, ladderView] = await Promise.all([
    readFile(new URL('../src/router/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/ladder/LadderPlayerAccessDialog.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/LadderPlayerAccessView.vue', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/compete/LadderView.vue', import.meta.url), 'utf8'),
  ])
  assert.match(router, /name: 'LadderPlayerAccess'/)
  assert.match(router, /path: '\/ladder\/access\/:token'/)
  assert.doesNotMatch(router.match(/path: '\/ladder\/access\/:token'[\s\S]{0,500}/)?.[0] || '', /public:\s*true/)
  assert.match(dialog, /import QRCode from 'qrcode'/)
  assert.match(dialog, /getOrCreateLadderPlayerAccess/)
  assert.match(ladderView, /v-if="canManageLadder"[\s\S]*ladder-header-player-access/)
  assert.match(view, /verifyLadderCreationAccess/)
  assert.match(view, /getEligibleLadderOpponents/)
  assert.match(view, /name: 'CreateChallenge'/)
  assert.doesNotMatch(view, /challengeStore\.createChallenge|startChallenge|createAdminLadderMatch/)
})