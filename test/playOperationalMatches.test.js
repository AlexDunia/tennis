import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PLAY_MATCH_ACTIONS,
  compareOperationalPlayMatches,
  getPlayMatchActions,
  isOperationalPlayMatch,
} from '../src/domain/playMatchActions.js'

function ladderMatch(overrides = {}) {
  return {
    id: 'match-ready',
    type: 'ladder',
    status: 'ready',
    clubId: 'club-a',
    challengerId: 'player-a',
    defenderId: 'player-b',
    scheduledAt: '2027-02-01T10:00:00.000Z',
    ...overrides,
  }
}

function actionIds(match, options) {
  return getPlayMatchActions(match, options).map((action) => action.id)
}

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

function actionCase(sourceText, actionName) {
  const marker = `case PLAY_MATCH_ACTIONS.${actionName}:`
  const start = sourceText.indexOf(marker)

  assert.notEqual(start, -1, `Missing ${actionName} action case.`)

  const next = sourceText.indexOf('case PLAY_MATCH_ACTIONS.', start + marker.length)
  return sourceText.slice(start, next === -1 ? undefined : next)
}

test('shows an active-club ready Ladder match to its participant only', () => {
  const match = ladderMatch()

  assert.equal(
    isOperationalPlayMatch(match, {
      actorId: 'player-a',
      activeClubId: 'club-a',
      canManage: false,
    }),
    true,
  )
  assert.equal(
    isOperationalPlayMatch(match, {
      actorId: 'player-z',
      activeClubId: 'club-a',
      canManage: false,
    }),
    false,
  )
})

test('shows active-club operational Ladder matches to managers without cross-club leakage', () => {
  const match = ladderMatch()

  assert.equal(
    isOperationalPlayMatch(match, {
      actorId: 'manager-user',
      activeClubId: 'club-a',
      canManage: true,
    }),
    true,
  )
  assert.equal(
    isOperationalPlayMatch(match, {
      actorId: 'manager-user',
      activeClubId: 'club-b',
      canManage: true,
    }),
    false,
  )
})

test('excludes completed and cancelled Ladder matches from operational visibility', () => {
  for (const status of ['completed', 'cancelled']) {
    assert.equal(
      isOperationalPlayMatch(
        ladderMatch({ status }),
        {
          actorId: 'player-a',
          activeClubId: 'club-a',
          canManage: false,
        },
      ),
      false,
    )
  }
})

test('returns the scheduled action policy for participants and managers', () => {
  const match = ladderMatch({ status: 'scheduled' })

  assert.deepEqual(
    actionIds(match, { actorId: 'player-a' }),
    [PLAY_MATCH_ACTIONS.VIEW_MATCH],
  )

  const managerActions = actionIds(match, {
    actorId: 'manager-user',
    canManage: true,
  })
  assert.deepEqual(managerActions, [
    PLAY_MATCH_ACTIONS.VIEW_MATCH,
    PLAY_MATCH_ACTIONS.RESCHEDULE,
    PLAY_MATCH_ACTIONS.CANCEL,
  ])
  assert.ok(!managerActions.includes(PLAY_MATCH_ACTIONS.START_MATCH))
})

test('returns the ready action policy without granting managers Start Match', () => {
  const match = ladderMatch({ status: 'ready' })

  assert.deepEqual(
    actionIds(match, { actorId: 'player-a' }),
    [PLAY_MATCH_ACTIONS.START_MATCH, PLAY_MATCH_ACTIONS.VIEW_MATCH],
  )

  const managerActions = actionIds(match, {
    actorId: 'manager-user',
    canManage: true,
  })
  assert.deepEqual(managerActions, [
    PLAY_MATCH_ACTIONS.VIEW_MATCH,
    PLAY_MATCH_ACTIONS.RESCHEDULE,
    PLAY_MATCH_ACTIONS.CANCEL,
  ])
  assert.ok(!managerActions.includes(PLAY_MATCH_ACTIONS.START_MATCH))
})

test('returns Resume scoring only to the current live scorer', () => {
  const match = ladderMatch({
    status: 'live',
    scorerId: 'player-a',
  })

  assert.deepEqual(
    actionIds(match, { actorId: 'player-a' }),
    [PLAY_MATCH_ACTIONS.RESUME_SCORING, PLAY_MATCH_ACTIONS.VIEW_MATCH],
  )
})

test('returns a read-only live score action to a live participant who is not scorer', () => {
  const match = ladderMatch({
    status: 'live',
    scorerId: 'player-b',
  })

  const actions = actionIds(match, { actorId: 'player-a' })
  assert.deepEqual(actions, [
    PLAY_MATCH_ACTIONS.VIEW_LIVE_SCORE,
    PLAY_MATCH_ACTIONS.VIEW_MATCH,
  ])
  assert.ok(!actions.includes(PLAY_MATCH_ACTIONS.RESUME_SCORING))
})

test('returns live score and match control to a live-control manager', () => {
  const match = ladderMatch({
    status: 'live',
    scorerId: 'player-a',
  })

  assert.deepEqual(
    actionIds(match, {
      actorId: 'manager-user',
      canManage: true,
      canLiveControl: true,
    }),
    [
      PLAY_MATCH_ACTIONS.VIEW_LIVE_SCORE,
      PLAY_MATCH_ACTIONS.OPEN_MATCH_CONTROL,
      PLAY_MATCH_ACTIONS.VIEW_MATCH,
    ],
  )
})

test('keeps accepted and pending-review participant actions passive', () => {
  for (const status of ['accepted', 'pending_review']) {
    const actions = actionIds(ladderMatch({ status }), { actorId: 'player-a' })
    assert.deepEqual(actions, [PLAY_MATCH_ACTIONS.VIEW_MATCH])
    assert.ok(!actions.includes(PLAY_MATCH_ACTIONS.START_MATCH))
  }
})

test('sorts operational statuses by live, ready, scheduled, accepted, then pending review', () => {
  const matches = [
    ladderMatch({ id: 'scheduled', status: 'scheduled' }),
    ladderMatch({ id: 'pending-review', status: 'pending_review' }),
    ladderMatch({ id: 'ready', status: 'ready' }),
    ladderMatch({ id: 'live', status: 'live' }),
    ladderMatch({ id: 'accepted', status: 'accepted' }),
  ]

  assert.deepEqual(
    matches.sort(compareOperationalPlayMatches).map((match) => match.status),
    ['live', 'ready', 'scheduled', 'accepted', 'pending_review'],
  )
})

test('sorts scheduled matches by their earliest schedule', () => {
  const matches = [
    ladderMatch({
      id: 'later',
      status: 'scheduled',
      scheduledAt: '2027-02-02T10:00:00.000Z',
    }),
    ladderMatch({
      id: 'earlier',
      status: 'scheduled',
      scheduledAt: '2027-02-01T10:00:00.000Z',
    }),
  ]

  assert.deepEqual(
    matches.sort(compareOperationalPlayMatches).map((match) => match.id),
    ['earlier', 'later'],
  )
})

test('integrates the Play policy, operational sorting, row, and dialog into PlayHub', () => {
  const playHub = source('../src/views/PlayHubView.vue')

  for (const token of [
    'isOperationalPlayMatch',
    'getPlayMatchActions',
    'compareOperationalPlayMatches',
    'PlayMatchRow',
    'LadderMatchManageDialog',
    'LiveScoreboard',
    'LiveOperationDetail',
    'MatchDetails',
  ]) {
    assert.ok(playHub.includes(token), `PlayHub is missing ${token}.`)
  }

  assert.ok(!playHub.includes('.slice(0, 3)'))
  assert.ok(!playHub.includes('.slice(0,3)'))
  assert.ok(!playHub.includes('async function continueMatch(match)'))
})

test('keeps explicit start separate from passive Match Details navigation', () => {
  const playHub = source('../src/views/PlayHubView.vue')
  const viewMatch = actionCase(playHub, 'VIEW_MATCH')

  assert.ok(playHub.includes('startLadderMatch'))
  assert.ok(playHub.includes('explicitStart: true'))
  assert.match(viewMatch, /name:\s*'MatchDetails'/)
  assert.ok(!viewMatch.includes('startOrResumeLadderMatch'))
  assert.ok(!viewMatch.includes('explicitStart'))
})

test('uses the correct passive and live routes for each live action', () => {
  const playHub = source('../src/views/PlayHubView.vue')
  const resume = actionCase(playHub, 'RESUME_SCORING')
  const viewLive = actionCase(playHub, 'VIEW_LIVE_SCORE')
  const control = actionCase(playHub, 'OPEN_MATCH_CONTROL')

  assert.match(resume, /name:\s*'LiveMatch'/)
  assert.ok(!resume.includes('explicitStart'))
  assert.match(viewLive, /name:\s*'LiveScoreboard'/)
  assert.match(control, /name:\s*'LiveOperationDetail'/)
})

test('keeps Match Details route metadata neutral and in the Play section', () => {
  const router = source('../src/router/index.js')
  const start = router.indexOf("path: '/matches/:matchId'")
  const end = router.indexOf("path: '/play/:matchId'", start)
  const route = router.slice(start, end)

  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  assert.match(route, /primarySection:\s*'play'/)
  assert.match(route, /Players, schedule, status, score, and match actions\./)
  assert.ok(!route.includes('move the ladder forward'))
})

test('keeps row display permission-free and management dialog limited to schedule or cancel', () => {
  const row = source('../src/components/play/PlayMatchRow.vue')
  const dialog = source('../src/components/play/LadderMatchManageDialog.vue')

  assert.match(row, /actions:\s*\{/)
  assert.match(row, /defineEmits\(\['action'\]\)/)
  assert.doesNotMatch(row, /stores\/admin/)
  assert.doesNotMatch(row, /stores\/player/)
  assert.doesNotMatch(row, /club\.manage/)

  assert.match(dialog, /updateAdminLadderMatchSchedule/)
  assert.match(dialog, /cancelAdminLadderMatch/)
  assert.doesNotMatch(dialog, /startOrResumeLadderMatch/)
  assert.doesNotMatch(dialog, /explicitStart/)
})

