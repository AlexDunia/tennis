import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { homeLiveMatchRoute } from '../src/utils/homePriority/homeLiveMatchRoute.js'
import { resolveLiveMatchPriority } from '../src/utils/homePriority/liveMatchPriority.js'
import { resolveHomePriority } from '../src/utils/homePriority/resolveHomePriority.js'
import { createStandardMatchRulesSnapshot } from '../src/domain/matchRules.js'
import { createScoreboard, recordPoint } from '../src/utils/tennisScoring.js'
import { toTennisEngineConfig } from '../src/domain/toTennisEngineConfig.js'

test('Home resumes each match through the flow that owns it', () => {
  for (const matchType of ['friendly', 'ladder', 'tournament']) {
    assert.deepEqual(homeLiveMatchRoute({ matchId: 'court-a', matchType }), {
      name: matchType === 'friendly' ? 'FriendlyMatchLive' : 'LiveMatch',
      params: { matchId: 'court-a' },
    })
  }
  assert.equal(homeLiveMatchRoute(null), null)
})

test('live priority yields immediately to the next important state after completion', () => {
  const match = {
    id: 'court-a', status: 'live', participantBId: 'player-b',
    liveState: { players: { playerA: 'Alex', playerB: 'Lucky' } },
  }
  const challenge = { id: 'received', priority: 85, kind: 'challenge_received' }
  const resolve = () => resolveHomePriority([
    challenge,
    resolveLiveMatchPriority({ matches: [match], actorId: 'player-b' }),
  ])
  assert.equal(resolve().kind, 'live_match')
  match.liveState.matchWinner = 'playerA'
  assert.equal(resolve().kind, 'challenge_received')
})

test('persisted live matches recover their rules and notify Home in the same tab', async () => {
  const values = new Map()
  const target = new EventTarget()
  target.localStorage = {
    get length() { return values.size },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
  const previousWindow = globalThis.window
  const previousChannel = globalThis.BroadcastChannel
  globalThis.window = target
  globalThis.BroadcastChannel = undefined
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  let stop = () => {}
  let store
  try {
    const { useFriendlyMatchStore } = await server.ssrLoadModule('/src/stores/friendlyMatch.js')
    setActivePinia(createPinia())
    store = useFriendlyMatchStore()
    const rules = createStandardMatchRulesSnapshot()
    const liveState = recordPoint(createScoreboard({
      config: toTennisEngineConfig(rules), players: { playerA: 'Alex', playerB: 'Lucky' },
    }), 'playerA')
    const draft = {
      matchId: 'court-a', matchType: 'friendly', clubId: 'club-a', status: 'live',
      ownerId: 'alex', scorerId: 'alex', opponent: { id: 'lucky', name: 'Lucky' },
      format: 'ad', matchFormat: 'best-of-3', liveState,
    }
    target.localStorage.setItem('gorra.friendlyMatchLive.v1.court-a', JSON.stringify(draft))
    let updates = 0
    stop = store.subscribeToLiveMatchChanges(() => { updates += 1 })
    const restored = store.loadLiveMatch('court-a')
    assert.ok(restored.rulesSnapshot, 'legacy rules are resolved before the live route initializes')
    assert.deepEqual(JSON.parse(JSON.stringify(restored.liveState)), liveState)
    await nextTick()
    const before = updates
    store.draft.liveState.matchWinner = 'playerA'
    store.draft.over = true
    await nextTick()
    assert.ok(updates > before, 'Home hears same-tab completion without a storage event')
    assert.deepEqual(store.listLiveMatchesForUser({ clubId: 'club-a', actorId: 'alex' }), [])
    stop()
    const stoppedAt = updates
    store.draft.over = false
    await nextTick()
    assert.equal(updates, stoppedAt, 'unmount cleans up the subscription')
    const { liveMatchSessionRepository: repository } = await server.ssrLoadModule('/src/services/LiveMatchSessionRepository.js')
    // The legacy projection may lag the authoritative session.
    target.localStorage.setItem('gorra.friendlyMatchLive.v1.court-a', JSON.stringify(draft))
    stop = store.subscribeToLiveMatchChanges(() => { updates += 1 })
    const beforeSession = updates
    assert.equal(repository.save({
      matchId: 'court-a', status: 'completing', engineState: liveState,
      scoreRevision: liveState.revision || 0,
    }).ok, true)
    assert.ok(updates > beforeSession, 'canonical session changes notify Home immediately')
    assert.deepEqual(store.listLiveMatchesForUser({ clubId: 'club-a', actorId: 'alex' }), [])
    stop()
    const { subscribeToCompetitionChanges } = await server.ssrLoadModule('/src/services/ApiService.js')
    let competitionUpdates = 0
    stop = subscribeToCompetitionChanges(() => { competitionUpdates += 1 })
    target.dispatchEvent(new Event('gorra:competition-change'))
    target.dispatchEvent(new Event('gorra:competition-change'))
    await Promise.resolve()
    assert.equal(competitionUpdates, 1, 'same-turn domain writes are coalesced')
    const externalChange = new Event('storage')
    Object.defineProperty(externalChange, 'key', { value: 'tennis.mock.ladderState.v2' })
    target.dispatchEvent(externalChange)
    await Promise.resolve()
    assert.equal(competitionUpdates, 2, 'other-tab challenge/result changes refresh Home')
    stop()
    target.dispatchEvent(new Event('gorra:competition-change'))
    await Promise.resolve()
    assert.equal(competitionUpdates, 2)

  } finally {
    stop()
    store?.$dispose()
    await server.close()
    globalThis.window = previousWindow
    globalThis.BroadcastChannel = previousChannel
  }
})
