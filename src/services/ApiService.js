import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const defaultDelay = 300

const names = [
  'Amina Esin',
  'Chima Adamu',
  'Ify Okonkwo',
  'Bola Johnson',
  'Grace Nwosu',
  'Seun Adeyemi',
  'Tomiwa Adebayo',
  'Nkechi Okafor',
  'David Eze',
  'Ifeoma Umeh',
  'Kingsley Obi',
  'Nadia Abdul',
  'John Paul',
  'Amaka Osei',
  'Sola Akin',
  'Emeka Nwankwo',
  'Aisha Musa',
  'Tunde Bello',
  'Lilian Ibiam',
  'Chinedu Nduka',
]

const mockDatabase = {
  players: [],
  challenges: [],
  matches: [],
}

function createPlayers() {
  return names.map((name, index) => ({
    id: `player-${String(index + 1).padStart(2, '0')}`,
    name,
    rank: index + 1,
    wins: Math.max(0, 12 - index),
    losses: Math.max(0, index - 2),
    matchesPlayed: Math.max(1, 12 - index + index - 2),
  }))
}

function getStatusLabel(status) {
  switch (status) {
    case 'awaiting':
      return 'Awaiting Acceptance'
    case 'scheduled':
      return 'Scheduled'
    case 'pending_review':
      return 'Pending Review'
    case 'completed':
      return 'Completed'
    default:
      return 'Unknown'
  }
}

function ensureData() {
  if (mockDatabase.players.length === 0) {
    mockDatabase.players = createPlayers()
    mockDatabase.challenges = [
      {
        id: 'challenge-01',
        challengerId: 'player-10',
        defenderId: 'player-06',
        status: 'awaiting',
        requestedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      },
      {
        id: 'challenge-02',
        challengerId: 'player-08',
        defenderId: 'player-05',
        status: 'scheduled',
        requestedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      },
      {
        id: 'challenge-03',
        challengerId: 'player-12',
        defenderId: 'player-09',
        status: 'pending_review',
        requestedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        scheduledAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ]
    mockDatabase.matches = [
      {
        id: 'match-01',
        challengeId: 'challenge-02',
        challengerId: 'player-08',
        defenderId: 'player-05',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        score: null,
        winnerId: null,
      },
      {
        id: 'match-02',
        challengeId: 'challenge-03',
        challengerId: 'player-12',
        defenderId: 'player-09',
        status: 'pending_review',
        scheduledAt: new Date(Date.now() - 86400000).toISOString(),
        score: '6-4, 3-6, 7-5',
        winnerId: 'player-12',
      },
    ]
  }
}

function getPlayerById(playerId) {
  return mockDatabase.players.find((player) => player.id === playerId)
}

function reorderRankings() {
  mockDatabase.players.sort((a, b) => a.rank - b.rank)
}

function updateRankingsForResult(match) {
  if (!match || !match.winnerId) {
    return
  }

  const challenger = getPlayerById(match.challengerId)
  const defender = getPlayerById(match.defenderId)
  if (!challenger || !defender) {
    return
  }

  challenger.matchesPlayed += 1
  defender.matchesPlayed += 1

  if (match.winnerId === challenger.id) {
    challenger.wins += 1
    defender.losses += 1
  } else {
    defender.wins += 1
    challenger.losses += 1
  }

  if (match.winnerId === challenger.id && challenger.rank > defender.rank) {
    const oldRank = challenger.rank
    challenger.rank = defender.rank
    defender.rank = oldRank
  }

  mockDatabase.players = mockDatabase.players
    .sort((a, b) => a.rank - b.rank)
    .map((player, index) => ({ ...player, rank: index + 1 }))
}

function buildChallengeResponse(challenge) {
  const challenger = getPlayerById(challenge.challengerId)
  const defender = getPlayerById(challenge.defenderId)
  return {
    ...challenge,
    statusLabel: getStatusLabel(challenge.status),
    challengerName: challenger?.name ?? 'Unknown',
    defenderName: defender?.name ?? 'Unknown',
    challengerRank: challenger?.rank ?? 0,
    defenderRank: defender?.rank ?? 0,
  }
}

function buildMatchResponse(match) {
  const challenger = getPlayerById(match.challengerId)
  const defender = getPlayerById(match.defenderId)
  return {
    ...match,
    statusLabel: match.status.replace('_', ' ').toUpperCase(),
    challengerName: challenger?.name ?? 'Unknown',
    defenderName: defender?.name ?? 'Unknown',
  }
}

function buildResponse(data) {
  return { success: true, data, message: '' }
}

function getRequestPath(url) {
  return url?.replace(API_BASE_URL, '') || ''
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const mockAdapter = async (config) => {
  ensureData()
  await delay(defaultDelay)
  const method = config.method.toLowerCase()
  const path = getRequestPath(config.url)
  const body = config.data ? JSON.parse(config.data) : null

  if (method === 'get' && path === '/players') {
    return {
      data: buildResponse(mockDatabase.players),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path === '/challenges') {
    return {
      data: buildResponse(mockDatabase.challenges.map(buildChallengeResponse)),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path === '/matches') {
    return {
      data: buildResponse(mockDatabase.matches.map(buildMatchResponse)),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path === '/challenges') {
    const id = `challenge-${String(mockDatabase.challenges.length + 1).padStart(2, '0')}`
    const challenge = {
      id,
      challengerId: body.challengerId,
      defenderId: body.defenderId,
      status: 'awaiting',
      requestedAt: new Date().toISOString(),
      note: body.note || '',
    }
    mockDatabase.challenges.push(challenge)
    return {
      data: buildResponse(buildChallengeResponse(challenge)),
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/accept$/)) {
    const challengeId = path.split('/')[2]
    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)
    if (!challenge) {
      return {
        data: { success: false, data: null, message: 'Challenge not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }
    challenge.status = 'scheduled'
    challenge.scheduledAt = body?.scheduledAt || new Date(Date.now() + 3 * 86400000).toISOString()
    const matchId = `match-${String(mockDatabase.matches.length + 1).padStart(2, '0')}`
    const match = {
      id: matchId,
      challengeId: challenge.id,
      challengerId: challenge.challengerId,
      defenderId: challenge.defenderId,
      status: 'scheduled',
      scheduledAt: challenge.scheduledAt,
      score: null,
      winnerId: null,
    }
    mockDatabase.matches.push(match)
    return {
      data: buildResponse({
        challenge: buildChallengeResponse(challenge),
        match: buildMatchResponse(match),
      }),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/matches\/[^/]+\/result$/)) {
    const matchId = path.split('/')[2]
    const match = mockDatabase.matches.find((item) => item.id === matchId)
    if (!match) {
      return {
        data: { success: false, data: null, message: 'Match not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }
    match.score = body?.score || '6-4, 6-4'
    match.winnerId = body?.winnerId
    match.status = 'pending_review'
    const challenge = mockDatabase.challenges.find((item) => item.id === match.challengeId)
    if (challenge) {
      challenge.status = 'pending_review'
    }
    return {
      data: buildResponse(buildMatchResponse(match)),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/review$/)) {
    const challengeId = path.split('/')[2]
    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)
    if (!challenge) {
      return {
        data: { success: false, data: null, message: 'Challenge not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }
    const match = mockDatabase.matches.find((item) => item.challengeId === challenge.id)
    if (!match) {
      return {
        data: { success: false, data: null, message: 'Match not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }
    challenge.status = 'completed'
    match.status = 'completed'
    updateRankingsForResult(match)
    return {
      data: buildResponse({
        challenge: buildChallengeResponse(challenge),
        match: buildMatchResponse(match),
        players: mockDatabase.players,
      }),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  return {
    data: { success: false, data: null, message: 'Route not implemented' },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config,
    request: {},
  }
}

const api = axios.create({ baseURL: API_BASE_URL, adapter: mockAdapter })

export default api
