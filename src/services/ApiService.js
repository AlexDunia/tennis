import axios from 'axios'
import {
  createEmptyKnockout,
  generateKnockoutForCategory,
  progressKnockout,
} from '../composables/useBracketBuilder'
import { generateRoundRobinFixtures } from '../composables/useTournamentFixtures'
import { calculateGroupStandings } from '../composables/useTournamentStandings'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const defaultDelay = 300

const profileImageUrls = [
  'https://res.cloudinary.com/dnuhjsckk/image/upload/v1776502607/Foster_Ezenwelu_c1ntjt.jpg',
  'https://res.cloudinary.com/dnuhjsckk/image/upload/v1776502607/Henry_Dunia_eraqx9.jpg',
  'https://res.cloudinary.com/dnuhjsckk/image/upload/v1776502606/Nestor_Madukaife_pyb3em.jpg',
  'https://res.cloudinary.com/dnuhjsckk/image/upload/v1776502606/phillip_Onu_urjbqq.jpg',
]

const names = [
  'Amina Esin',
  'Chima Adamu',
  'Ify Okonkwo',
  'Bola Johnson',
  'Grace Nwosu',
  'Seun Adeyemi',
  'Tomiwa Adebayo',
  'Nkechi Okonkwo',
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
  'Oyin Adewale',
  'Kelechi Iro',
  'Mariam Bello',
  'Victor Etim',
  'Rita Okafor',
  'Samuel Okoro',
  'Efe Ajayi',
  'Fola Bakare',
  'Chioma Udo',
  'Peter Danjuma',
  'Yemi Lawal',
  'Theresa Obi',
]

const femalePlayerNames = new Set([
  'Amina Esin',
  'Ify Okonkwo',
  'Grace Nwosu',
  'Nkechi Okonkwo',
  'Ifeoma Umeh',
  'Nadia Abdul',
  'Amaka Osei',
  'Aisha Musa',
  'Lilian Ibiam',
  'Oyin Adewale',
  'Mariam Bello',
  'Rita Okafor',
  'Chioma Udo',
  'Theresa Obi',
])

const mockDatabase = {
  players: [],
  challenges: [],
  matches: [],
  tournaments: [],
}

const tournamentRules = {
  winPoints: 1,
  lossPoints: 0,
  qualifiersPerGroup: 4,
  tiebreakAt: 6,
  knockoutFormat: 'top4-crossover',
  rankingOrder: ['points', 'setDiff', 'gameDiff', 'wins', 'name'],
  walkovertimeMinutes: 30,
  rescheduleNoticeHours: 24,
}

const rspCategories = [
  {
    id: 'premier',
    name: 'Premier',
    groups: [
      {
        id: 'A',
        name: 'Group A',
        players: [
          ['rsp-premier-01', 'Andy Spencer', 1],
          ['rsp-premier-03', 'Charles Harcourt', 3],
          ['rsp-premier-05', 'Igho Eguegue', 5],
          ['rsp-premier-08', 'Babatunde Salami', 8],
          ['rsp-premier-09', 'Ulo Okon', 9],
          ['rsp-premier-11', 'Amaechi Modunkwu', 11],
        ],
      },
      {
        id: 'B',
        name: 'Group B',
        players: [
          ['rsp-premier-02', 'Rv. Fr. John Konyeke', 2],
          ['rsp-premier-04', 'Zino Ejomarie', 4],
          ['rsp-premier-06', 'Leonard Chimaobi', 6],
          ['rsp-premier-07', 'Chukwunalu Adeshina', 7],
          ['rsp-premier-10', 'Ifeanyi Atumonye', 10],
          ['rsp-premier-12', 'Alfred Equong', 12],
        ],
      },
    ],
  },
  {
    id: 'category-a',
    name: 'Category A',
    groups: [
      {
        id: 'A',
        name: 'Group A',
        players: [
          ['rsp-category-a-01', 'Okey Oturu', 1],
          ['rsp-category-a-04', 'Julian Anaele', 4],
          ['rsp-category-a-05', 'Philip Onu', 5],
          ['rsp-category-a-07', 'Dogiye Esendu', 7],
          ['rsp-category-a-10', 'Ogechukwu Izedinor', 10],
          ['bye-category-a-a', 'BYE', 99, true],
        ],
      },
      {
        id: 'B',
        name: 'Group B',
        players: [
          ['rsp-category-a-02', 'Gbolade Ibikunle', 2],
          ['rsp-category-a-03', 'Arinze Ugochukwu', 3],
          ['rsp-category-a-06', 'Gift Elekwuwa', 6],
          ['rsp-category-a-08', 'David Dugo', 8],
          ['rsp-category-a-09', 'Gibson Oriaku', 9],
          ['bye-category-a-b', 'BYE', 99, true],
        ],
      },
    ],
  },
  {
    id: 'category-b',
    name: 'Category B',
    groups: [
      {
        id: 'A',
        name: 'Group A',
        players: [
          ['rsp-category-b-01', 'Hamza Kassim', 1],
          ['rsp-category-b-04', 'Kodili Iloka', 4],
          ['rsp-category-b-05', 'Nwoke Adinigwe', 5],
          ['rsp-category-b-07', 'Dennis Okoro', 7],
          ['rsp-category-b-09', 'David Michael', 9],
          ['rsp-category-b-11', 'Chidiebere Oburu', 11],
        ],
      },
      {
        id: 'B',
        name: 'Group B',
        players: [
          ['rsp-category-b-02', 'Voke Emore', 2],
          ['rsp-category-b-03', 'Reuben Eteure', 3],
          ['rsp-category-b-06', 'George Nwachukwu', 6],
          ['rsp-category-b-08', 'Ikechi Okpala', 8],
          ['rsp-category-b-10', 'Ben Oguche', 10],
          ['rsp-category-b-12', 'Major Kenechukwu Otubo', 12],
        ],
      },
    ],
  },
  {
    id: 'ladies',
    name: 'Ladies',
    groups: [
      {
        id: 'A',
        name: 'Group A',
        players: [
          ['rsp-ladies-01', 'Brownie Blessing', 1],
          ['rsp-ladies-03', 'Heritage Imo', 3],
          ['rsp-ladies-05', 'Abisola Dare Linus', 5],
          ['rsp-ladies-07', 'Stella Ezimoha', 7],
          ['bye-ladies-a-1', 'BYE', 99, true],
          ['bye-ladies-a-2', 'BYE', 100, true],
        ],
      },
      {
        id: 'B',
        name: 'Group B',
        players: [
          ['rsp-ladies-02', 'Chinazor Okpalogu', 2],
          ['rsp-ladies-04', 'Ejemen Obozokhae', 4],
          ['rsp-ladies-06', 'Elah Adagogo', 6],
          ['rsp-ladies-08', 'Sotonye Akhagbeme', 8],
          ['bye-ladies-b-1', 'BYE', 99, true],
          ['bye-ladies-b-2', 'BYE', 100, true],
        ],
      },
    ],
  },
  {
    id: 'veterans',
    name: 'Veterans',
    groups: [
      {
        id: 'A',
        name: 'Group A',
        players: [
          ['rsp-veterans-01', 'Chukuwdi Imo', 1],
          ['rsp-veterans-03', 'Forster Ezenwelu', 3],
          ['rsp-veterans-06', 'Funmi Adebowale', 6],
          ['rsp-veterans-07', 'Nestor Madukaife', 7],
          ['rsp-veterans-09', 'Joe Ighekpe', 9],
          ['rsp-veterans-12', 'Kayode Adeyeri', 12],
        ],
      },
      {
        id: 'B',
        name: 'Group B',
        players: [
          ["rsp-veterans-02", "Chijioke Amu'nnadi", 2],
          ['rsp-veterans-04', 'Greg Ojih', 4],
          ['rsp-veterans-05', 'Augustine Inyikalum', 5],
          ['rsp-veterans-08', 'Vincent Nwabueze', 8],
          ['rsp-veterans-10', 'Uche Okpalogu', 10],
          ['rsp-veterans-11', 'Ufuoma Oghene', 11],
        ],
      },
    ],
  },
]

function deriveNameFromCloudinaryUrl(url) {
  const lastSegment = url.split('/').pop() || ''
  const base = lastSegment.replace(/\.[^.]+$/, '')
  const tokens = base.split(/[_-]+/).filter(Boolean)
  const maybeSuffix = tokens[tokens.length - 1] || ''
  const isRandomSuffix = /^[a-z0-9]{6,8}$/i.test(maybeSuffix) && /\d/.test(maybeSuffix)
  const nameTokens = isRandomSuffix ? tokens.slice(0, -1) : tokens
  const normalized = nameTokens.map((token) => {
    const lower = token.toLowerCase()
    if (lower === 'phillip') return 'Philip'
    return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
  })
  return normalized.join(' ')
}

function getSkillCategoryForRank(rank) {
  if (rank <= 12) return 'premier'
  if (rank <= 24) return 'category-a'
  return 'category-b'
}

function getSkillCategoryName(categoryId) {
  switch (categoryId) {
    case 'premier':
      return 'Premier'
    case 'category-a':
      return 'Category A'
    case 'category-b':
      return 'Category B'
    case 'ladies':
      return 'Ladies'
    case 'veterans':
      return 'Veterans'
    default:
      return categoryId
  }
}

function createPlayerCategoryMetadata(name, rank, index) {
  const categoryId = getSkillCategoryForRank(rank)
  const gender = femalePlayerNames.has(name) ? 'female' : 'male'
  const veteranRanks = new Set([2, 4, 7, 11, 15, 18, 22])
  const birthYear = veteranRanks.has(rank) ? 1968 + (index % 6) : 1983 + (index % 18)
  const isVeteran = new Date().getFullYear() - birthYear >= 50
  const eligibleCategoryIds = [categoryId]

  if (gender === 'female') {
    eligibleCategoryIds.push('ladies')
  }

  if (isVeteran) {
    eligibleCategoryIds.push('veterans')
  }

  return {
    ladderRank: rank,
    category: getSkillCategoryName(categoryId),
    categoryId,
    gender,
    birthYear,
    isVeteran,
    status: 'active',
    eligibleCategoryIds,
    categoryHistory: [
      {
        categoryId,
        category: getSkillCategoryName(categoryId),
        from: '2026-01',
        to: null,
        reason: 'Initial ladder band assignment',
      },
    ],
  }
}

function createPlayers() {
  const imagePlayers = profileImageUrls.map((imageUrl, index) => {
    const rank = index + 1
    const name = deriveNameFromCloudinaryUrl(imageUrl)

    return {
      id: `player-${String(index + 1).padStart(2, '0')}`,
      name,
      imageUrl,
      rank,
      wins: Math.max(0, 12 - index),
      losses: Math.max(0, index - 2),
      matchesPlayed: Math.max(1, 12 - index + index - 2),
      ...createPlayerCategoryMetadata(name, rank, index),
    }
  })

  const remainingPlayers = names.map((name, index) => {
    const rank = profileImageUrls.length + index + 1

    return {
      id: `player-${String(rank).padStart(2, '0')}`,
      name,
      imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=EDF2F7&color=2E3A59`,
      rank,
      wins: Math.max(0, 8 - index),
      losses: Math.max(0, index - 1),
      matchesPlayed: Math.max(1, 8 - index + index - 1),
      ...createPlayerCategoryMetadata(name, rank, index + profileImageUrls.length),
    }
  })

  return [...imagePlayers, ...remainingPlayers]
}

function mapTournamentPlayer([playerId, name, seed, isBye = false]) {
  return { playerId, name, seed, isBye }
}

function createRspTournament() {
  const tournamentId = 'rsp-masters-2026'
  const categories = rspCategories.map((category) => {
    const groups = category.groups.map((group) => ({
      id: group.id,
      name: group.name,
      categoryId: category.id,
      tournamentId,
      players: group.players.map(mapTournamentPlayer),
      fixtureIds: [],
    }))

    return {
      id: category.id,
      tournamentId,
      name: category.name,
      status: 'round-robin',
      groups,
      knockout: createEmptyKnockout(tournamentId, category.id),
    }
  })

  return {
    id: tournamentId,
    name: '2026 RSP Masters Tennis Tournament',
    description: 'Annual masters tournament for RSP Tennis Section members. Port Harcourt, Nigeria.',
    status: 'active',
    roundRobinStart: '2026-03-14',
    roundRobinEnd: '2026-03-31',
    knockoutStart: '2026-04-01',
    finalDate: '2026-04-04',
    categories,
    officials: ['Igo', 'Harcourt', 'Zino', 'Dogiye', 'David'],
    rules: tournamentRules,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function seedTournamentFixtures(tournament) {
  const fixtures = []

  tournament.categories.forEach((category) => {
    category.groups.forEach((group) => {
      const groupFixtures = generateRoundRobinFixtures({
        tournamentId: tournament.id,
        categoryId: category.id,
        groupId: group.id,
        groupPlayers: group.players,
      })
      group.fixtureIds = groupFixtures.map((fixture) => fixture.id)
      fixtures.push(...groupFixtures)
    })
  })

  return fixtures
}

function ensureMatchDefaults(match) {
  return {
    type: 'ladder',
    tournamentId: null,
    categoryId: null,
    groupId: null,
    round: null,
    sets: [],
    liveState: null,
    ...match,
  }
}

function ensureTournamentData() {
  if (mockDatabase.tournaments.length > 0) {
    return
  }

  const tournament = createRspTournament()
  mockDatabase.tournaments = [tournament]
  mockDatabase.matches.push(...seedTournamentFixtures(tournament))
  tournament.categories.forEach(syncCategoryKnockout)
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
        challengerId: 'player-01',
        defenderId: 'player-02',
        status: 'awaiting',
        requestedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      },
      {
        id: 'challenge-02',
        challengerId: 'player-03',
        defenderId: 'player-04',
        status: 'scheduled',
        requestedAt: new Date(Date.now() - 7200 * 1000).toISOString(),
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      },
      {
        id: 'challenge-03',
        challengerId: 'player-02',
        defenderId: 'player-01',
        status: 'pending_review',
        requestedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        scheduledAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ]
    mockDatabase.matches = [
      ensureMatchDefaults({
        id: 'match-01',
        challengeId: 'challenge-02',
        challengerId: 'player-03',
        defenderId: 'player-04',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        score: null,
        winnerId: null,
      }),
      ensureMatchDefaults({
        id: 'match-02',
        challengeId: 'challenge-03',
        challengerId: 'player-02',
        defenderId: 'player-01',
        status: 'pending_review',
        scheduledAt: new Date(Date.now() - 86400000).toISOString(),
        score: '6-4, 3-6, 7-5',
        winnerId: 'player-02',
      }),
    ]
  }

  ensureTournamentData()
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
  const scorer = challenge.scorerId ? getPlayerById(challenge.scorerId) : null
  return {
    ...challenge,
    statusLabel: getStatusLabel(challenge.status),
    challengerName: challenger?.name ?? 'Unknown',
    defenderName: defender?.name ?? 'Unknown',
    scorerName: scorer?.name ?? null,
    challengerRank: challenger?.rank ?? 0,
    defenderRank: defender?.rank ?? 0,
    challengerImage: challenger?.imageUrl ?? '',
    defenderImage: defender?.imageUrl ?? '',
  }
}

function buildMatchResponse(match) {
  if (match.type === 'tournament') {
    return {
      statusLabel: match.status.replace('_', ' ').toUpperCase(),
      challengerName: match.player1Name ?? 'TBD',
      defenderName: match.player2Name ?? 'TBD',
      challengerImage: '',
      defenderImage: '',
      ...match,
    }
  }

  const challenger = getPlayerById(match.challengerId)
  const defender = getPlayerById(match.defenderId)
  return {
    ...ensureMatchDefaults(match),
    statusLabel: match.status.replace('_', ' ').toUpperCase(),
    challengerName: challenger?.name ?? 'Unknown',
    defenderName: defender?.name ?? 'Unknown',
    challengerImage: challenger?.imageUrl ?? '',
    defenderImage: defender?.imageUrl ?? '',
  }
}

function buildResponse(data) {
  return { success: true, data, message: '' }
}

function findTournament(tournamentId) {
  return mockDatabase.tournaments.find((tournament) => tournament.id === tournamentId)
}

function findCategory(tournamentId, categoryId) {
  const tournament = findTournament(tournamentId)
  return tournament?.categories.find((category) => category.id === categoryId) || null
}

function getCategoryMatches(tournamentId, categoryId) {
  return mockDatabase.matches.filter(
    (match) => match.tournamentId === tournamentId && match.categoryId === categoryId,
  )
}

function syncKnockoutMatchToSharedMatch(knockoutMatch) {
  if (!knockoutMatch) {
    return
  }

  const existingIndex = mockDatabase.matches.findIndex((match) => match.id === knockoutMatch.id)
  const sharedMatch = {
    ...knockoutMatch,
    type: 'tournament',
    groupId: null,
    player1Seed: null,
    player2Seed: null,
    challengerId: knockoutMatch.player1Id,
    defenderId: knockoutMatch.player2Id,
    isBye: false,
    sets: [],
    liveState: null,
    score:
      knockoutMatch.p1Sets !== null && knockoutMatch.p2Sets !== null
        ? `${knockoutMatch.p1Sets}-${knockoutMatch.p2Sets}`
        : null,
  }

  if (existingIndex === -1) {
    mockDatabase.matches.push(sharedMatch)
    return
  }

  mockDatabase.matches[existingIndex] = {
    ...mockDatabase.matches[existingIndex],
    ...sharedMatch,
  }
}

function syncCategoryKnockout(category) {
  category.knockout.quarterFinals?.forEach(syncKnockoutMatchToSharedMatch)
  category.knockout.semiFinals?.forEach(syncKnockoutMatchToSharedMatch)
  syncKnockoutMatchToSharedMatch(category.knockout.final)
}

function updateKnockoutMatch(category, match) {
  const collections = [category.knockout.quarterFinals, category.knockout.semiFinals]
  collections.forEach((collection) => {
    const matchIndex = collection.findIndex((item) => item.id === match.id)
    if (matchIndex !== -1) {
      collection[matchIndex] = { ...collection[matchIndex], ...match }
    }
  })

  if (category.knockout.final?.id === match.id) {
    category.knockout.final = { ...category.knockout.final, ...match }
  }
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

  if (method === 'get' && path.match(/^\/matches\/[^/]+$/)) {
    const matchId = path.split('/')[2]
    const match = mockDatabase.matches.find((item) => item.id === matchId)

    return {
      data: match
        ? buildResponse(buildMatchResponse(match))
        : { success: false, data: null, message: 'Match not found' },
      status: match ? 200 : 404,
      statusText: match ? 'OK' : 'Not Found',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'patch' && path.match(/^\/matches\/[^/]+$/)) {
    const matchId = path.split('/')[2]
    const matchIndex = mockDatabase.matches.findIndex((item) => item.id === matchId)

    if (matchIndex === -1) {
      return {
        data: { success: false, data: null, message: 'Match not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }

    mockDatabase.matches[matchIndex] = {
      ...mockDatabase.matches[matchIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    }

    return {
      data: buildResponse(buildMatchResponse(mockDatabase.matches[matchIndex])),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path === '/tournaments') {
    return {
      data: buildResponse(mockDatabase.tournaments),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path === '/tournaments') {
    const tournament = {
      ...body,
      id: body.id || `tournament-${Date.now()}`,
      status: body.status || 'upcoming',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockDatabase.tournaments.push(tournament)
    tournament.categories?.forEach(syncCategoryKnockout)

    return {
      data: buildResponse(tournament),
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+$/)) {
    const tournamentId = path.split('/')[2]
    const tournament = findTournament(tournamentId)

    return {
      data: tournament
        ? buildResponse(tournament)
        : { success: false, data: null, message: 'Tournament not found' },
      status: tournament ? 200 : 404,
      statusText: tournament ? 'OK' : 'Not Found',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'put' && path.match(/^\/tournaments\/[^/]+$/)) {
    const tournamentId = path.split('/')[2]
    const tournamentIndex = mockDatabase.tournaments.findIndex((item) => item.id === tournamentId)

    if (tournamentIndex === -1) {
      return {
        data: { success: false, data: null, message: 'Tournament not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }

    mockDatabase.tournaments[tournamentIndex] = {
      ...mockDatabase.tournaments[tournamentIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    }

    return {
      data: buildResponse(mockDatabase.tournaments[tournamentIndex]),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+\/categories$/)) {
    const tournament = findTournament(path.split('/')[2])

    return {
      data: tournament
        ? buildResponse(tournament.categories)
        : { success: false, data: null, message: 'Tournament not found' },
      status: tournament ? 200 : 404,
      statusText: tournament ? 'OK' : 'Not Found',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+$/)) {
    const [, , tournamentId, , categoryId] = path.split('/')
    const category = findCategory(tournamentId, categoryId)

    return {
      data: category ? buildResponse(category) : { success: false, data: null, message: 'Category not found' },
      status: category ? 200 : 404,
      statusText: category ? 'OK' : 'Not Found',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+\/schedule$/)) {
    const tournamentId = path.split('/')[2]
    const schedule = mockDatabase.matches.filter((match) => match.tournamentId === tournamentId)

    return {
      data: buildResponse(schedule.map(buildMatchResponse)),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+\/standings\/[^/]+$/)) {
    const [, , tournamentId, , categoryId, , groupId] = path.split('/')
    const tournament = findTournament(tournamentId)
    const category = findCategory(tournamentId, categoryId)
    const group = category?.groups.find((item) => item.id === groupId)
    const matches = getCategoryMatches(tournamentId, categoryId)
    const standings = group ? calculateGroupStandings(group, matches, tournament.rules) : []

    return {
      data: group ? buildResponse(standings) : { success: false, data: null, message: 'Group not found' },
      status: group ? 200 : 404,
      statusText: group ? 'OK' : 'Not Found',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+\/close-round-robin$/)) {
    const [, , tournamentId, , categoryId] = path.split('/')
    const tournament = findTournament(tournamentId)
    const category = findCategory(tournamentId, categoryId)

    if (!tournament || !category) {
      return {
        data: { success: false, data: null, message: 'Category not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }

    const matches = getCategoryMatches(tournamentId, categoryId)
    const categoryRules = {
      ...tournament.rules,
      qualifiersPerGroup: category.settings?.qualifiersPerGroup ?? tournament.rules?.qualifiersPerGroup,
    }
    const standingsByGroup = category.groups.reduce((lookup, group) => {
      lookup[group.id] = calculateGroupStandings(group, matches, categoryRules)
      return lookup
    }, {})
    category.knockout = generateKnockoutForCategory(category, standingsByGroup)
    if ((category.settings?.knockoutFormat || category.knockout?.format) === 'round-robin-only') {
      const firstGroupId = category.groups[0]?.id
      const champion = standingsByGroup[firstGroupId]?.[0]
      category.status = 'completed'
      category.knockout = {
        ...category.knockout,
        championId: champion?.playerId || null,
        championName: champion?.name || null,
      }
    } else {
      category.status = 'knockout'
    }
    syncCategoryKnockout(category)

    return {
      data: buildResponse(category),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+\/generate-fixtures$/)) {
    const [, , tournamentId, , categoryId] = path.split('/')
    const category = findCategory(tournamentId, categoryId)

    if (!category) {
      return {
        data: { success: false, data: null, message: 'Category not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }

    const existingIds = new Set(mockDatabase.matches.map((match) => match.id))
    const newFixtures = category.groups.flatMap((group) =>
      generateRoundRobinFixtures({
        tournamentId,
        categoryId,
        groupId: group.id,
        groupPlayers: group.players,
      }),
    )
    const uniqueFixtures = newFixtures.filter((fixture) => !existingIds.has(fixture.id))
    mockDatabase.matches.push(...uniqueFixtures)

    category.groups.forEach((group) => {
      group.fixtureIds = mockDatabase.matches
        .filter(
          (match) =>
            match.tournamentId === tournamentId &&
            match.categoryId === categoryId &&
            match.groupId === group.id,
        )
        .map((match) => match.id)
    })

    return {
      data: buildResponse(category),
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
      scorerId: body.scorerId || null,
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
    const match = ensureMatchDefaults({
      id: matchId,
      challengeId: challenge.id,
      challengerId: challenge.challengerId,
      defenderId: challenge.defenderId,
      status: 'scheduled',
      scheduledAt: challenge.scheduledAt,
      score: null,
      winnerId: null,
    })
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

    if (match.type === 'tournament') {
      match.p1Sets = body?.p1Sets
      match.p2Sets = body?.p2Sets
      match.p1Games = body?.p1Games ?? null
      match.p2Games = body?.p2Games ?? null
      match.winnerId = body?.winnerId
      match.winnerName =
        match.winnerId === match.player1Id ? match.player1Name : match.player2Name
      match.status = body?.status || 'completed'
      match.score = `${match.p1Sets}-${match.p2Sets}`

      const category = findCategory(match.tournamentId, match.categoryId)
      if (category && match.groupId === null) {
        updateKnockoutMatch(category, match)
        const progressedCategory = progressKnockout(category)
        Object.assign(category, progressedCategory)
        syncCategoryKnockout(category)
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

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/decline$/)) {
    const challengeId = path.split('/')[2]
    const challengeIndex = mockDatabase.challenges.findIndex((item) => item.id === challengeId)
    if (challengeIndex === -1) {
      return {
        data: { success: false, data: null, message: 'Challenge not found' },
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }
    mockDatabase.challenges.splice(challengeIndex, 1)
    return {
      data: buildResponse({}),
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
