import axios from 'axios'
import {
  createEmptyKnockout,
  generateKnockoutForCategory,
  progressKnockout,
} from '../composables/useBracketBuilder'
import { generateRoundRobinFixtures } from '../composables/useTournamentFixtures'
import { calculateGroupStandings } from '../composables/useTournamentStandings'
import { isSafeImageSource, sanitizePlainText, sanitizeSlugList } from '../utils/formSafety'
import { APP_DATA_MODES, getAppDataMode } from '../dataMode'
import {
  FRESH_ACCOUNT_LADDER_SCOPE,
  buildFreshAccountLadderRoster,
} from '../data/freshAccountLadder'
import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
  deadlineFromNow,
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
} from '../config/ladder'
import {
  ladderRulesToMatchRulesSnapshot,
  matchRulesSnapshotToLegacyLadderConfig,
} from '../domain/ruleAdapters/ladderMatchRules'
import { freezeMatchRulesSnapshot } from '../domain/matchRules'
import { tournamentRulesToMatchRulesSnapshot } from '../domain/ruleAdapters/tournamentMatchRules'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const defaultDelay = 300

/*
 * Bumped from v1 -> v2.
 *
 * This is intentional.
 * Your old mock player roster can already be saved in localStorage.
 * If these keys remained v1, the app could keep restoring the old
 * real club-member names/images even after changing the seed data.
 */
const TOURNAMENT_STORAGE_KEY = 'tennis.mock.tournamentState.v2'
const LADDER_STORAGE_KEY = 'tennis.mock.ladderState.v2'
const RSP_CATEGORY_A_PARTIAL_SCENARIO_KEY = 'tennis.mock.rspCategoryAPartialScenario.v2'

let hasAppliedRspCategoryAPartialScenario = false

/*
|--------------------------------------------------------------------------
| DEMO PLAYER IDENTITY HELPERS
|--------------------------------------------------------------------------
|
| Everything here is synthetic demo data.
| We no longer derive somebody's name from a Cloudinary filename.
|
*/

function createDemoEmail(name) {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return `${slug}@gorra.example`
}

function createDemoAvatarUrl(seed) {
  const encodedSeed = encodeURIComponent(seed)

  /*
   * Synthetic avatars rather than photographs belonging to
   * actual tennis-club members.
   *
   * The allowed skin tones are deliberately darker so the
   * mock roster better represents a Nigerian tennis club.
   *
   * Because the seed is deterministic, every player keeps the
   * same avatar between renders.
   */
  return (
    'https://api.dicebear.com/10.x/avataaars/svg' +
    `?seed=${encodedSeed}` +
    '&skinColor=614335,ae5d29,d08b5b' +
    '&hairColor=2c1b18,4a312c' +
    '&backgroundColor=e8f3eb,f0f5ee,ddebe1' +
    '&borderRadius=50'
  )
}

/*
|--------------------------------------------------------------------------
| MAIN DEMO LADDER ROSTER
|--------------------------------------------------------------------------
|
| 36 players are preserved because your previous seed contained:
|
| - 4 Cloudinary-image players
| - 32 additional named players
|
| Their player IDs/ranks continue to be generated in the exact same
| order, so challenge-01, challenge-02, match-01, etc. still work.
|
*/

const playerSeeds = [
  {
    name: 'Chidi Okafor',
    gender: 'male',
  },
  {
    name: 'Tobi Akinwale',
    gender: 'male',
  },
  {
    name: 'Amara Okoye',
    gender: 'female',
  },
  {
    name: 'Femi Balogun',
    gender: 'male',
  },
  {
    name: 'Zainab Lawal',
    gender: 'female',
  },
  {
    name: 'Obinna Ezeani',
    gender: 'male',
  },
  {
    name: 'Temi Adekunle',
    gender: 'female',
  },
  {
    name: 'Seyi Ogunleye',
    gender: 'male',
  },
  {
    name: 'Adaeze Nwosu',
    gender: 'female',
  },
  {
    name: 'Kene Okoli',
    gender: 'male',
  },
  {
    name: 'Halima Garba',
    gender: 'female',
  },
  {
    name: 'Dayo Adeniran',
    gender: 'male',
  },
  {
    name: 'Ifunanya Eze',
    gender: 'female',
  },
  {
    name: 'Ebuka Nwosu',
    gender: 'male',
  },
  {
    name: 'Morenike Adebayo',
    gender: 'female',
  },
  {
    name: 'Ikenna Umeh',
    gender: 'male',
  },
  {
    name: 'Chioma Umeh',
    gender: 'female',
  },
  {
    name: 'Victor Akpan',
    gender: 'male',
  },
  {
    name: 'Eniola Ogunleye',
    gender: 'female',
  },
  {
    name: 'Tari Peters',
    gender: 'male',
  },
  {
    name: 'Ijeoma Okafor',
    gender: 'female',
  },
  {
    name: 'Boma George',
    gender: 'male',
  },
  {
    name: 'Nafisa Bello',
    gender: 'female',
  },
  {
    name: 'Hassan Bello',
    gender: 'male',
  },
  {
    name: 'Oreoluwa Akin',
    gender: 'female',
  },
  {
    name: 'Sadiq Musa',
    gender: 'male',
  },
  {
    name: 'Tamuno Briggs',
    gender: 'male',
  },
  {
    name: 'Segun Balogun',
    gender: 'male',
  },
  {
    name: 'Kamsi Nnamdi',
    gender: 'female',
  },
  {
    name: 'Uche Nwankwo',
    gender: 'male',
  },
  {
    name: 'Aisha Danjuma',
    gender: 'female',
  },
  {
    name: 'Emeka Udo',
    gender: 'male',
  },
  {
    name: 'Nnamdi Eze',
    gender: 'male',
  },
  {
    name: 'Tunde Akinyemi',
    gender: 'male',
  },
  {
    name: 'Somto Nnamani',
    gender: 'male',
  },
  {
    name: 'Kunle Olatunji',
    gender: 'male',
  },
].map((player, index) => ({
  ...player,

  email: createDemoEmail(player.name),

  imageUrl: createDemoAvatarUrl(`gorra-player-${index + 1}-${player.name}`),
}))

const femalePlayerNames = new Set(
  playerSeeds.filter((player) => player.gender === 'female').map((player) => player.name),
)

const mockDatabase = {
  players: [],
  challenges: [],
  matches: [],
  tournaments: [],
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function loadLadderState() {
  if (!canUseStorage()) return null

  try {
    const stored = window.localStorage.getItem(LADDER_STORAGE_KEY)

    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveLadderState() {
  if (!canUseStorage()) return

  window.localStorage.setItem(
    LADDER_STORAGE_KEY,
    JSON.stringify({
      players: mockDatabase.players,

      challenges: mockDatabase.challenges,

      matches: mockDatabase.matches.filter((match) => match.type !== 'tournament'),
    }),
  )
}

function loadTournamentState() {
  if (!canUseStorage()) {
    return null
  }

  try {
    const stored = window.localStorage.getItem(TOURNAMENT_STORAGE_KEY)

    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function saveTournamentState() {
  if (!canUseStorage()) {
    return
  }

  const tournamentIds = new Set(mockDatabase.tournaments.map((tournament) => tournament.id))

  const tournamentMatches = mockDatabase.matches.filter((match) =>
    tournamentIds.has(match.tournamentId),
  )

  window.localStorage.setItem(
    TOURNAMENT_STORAGE_KEY,
    JSON.stringify({
      tournaments: mockDatabase.tournaments,
      matches: tournamentMatches,
    }),
  )
}

function hasScenarioFlag(storageKey) {
  if (!canUseStorage()) {
    return hasAppliedRspCategoryAPartialScenario
  }

  return window.localStorage.getItem(storageKey) === '1'
}

function setScenarioFlag(storageKey) {
  hasAppliedRspCategoryAPartialScenario = true

  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, '1')
  }
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

const rspCategoryAPartialScenarioResults = [
  ['A', 'rsp-category-a-01', 'rsp-category-a-04', 2, 0, 12, 7, 'rsp-category-a-01'],

  ['A', 'rsp-category-a-01', 'rsp-category-a-05', 1, 2, 15, 16, 'rsp-category-a-05'],

  ['A', 'rsp-category-a-01', 'rsp-category-a-07', 2, 0, 12, 5, 'rsp-category-a-01'],

  ['A', 'rsp-category-a-01', 'rsp-category-a-10', 2, 0, 12, 4, 'rsp-category-a-01'],

  ['A', 'rsp-category-a-04', 'rsp-category-a-05', 0, 2, 8, 13, 'rsp-category-a-05'],

  ['A', 'rsp-category-a-04', 'rsp-category-a-07', 2, 1, 15, 13, 'rsp-category-a-04'],

  ['A', 'rsp-category-a-04', 'rsp-category-a-10', 2, 0, 12, 6, 'rsp-category-a-04'],

  ['A', 'rsp-category-a-05', 'rsp-category-a-07', 2, 0, 12, 4, 'rsp-category-a-05'],

  ['A', 'rsp-category-a-05', 'rsp-category-a-10', 2, 0, 12, 3, 'rsp-category-a-05'],

  ['B', 'rsp-category-a-02', 'rsp-category-a-03', 2, 1, 16, 14, 'rsp-category-a-02'],

  ['B', 'rsp-category-a-02', 'rsp-category-a-06', 2, 0, 12, 5, 'rsp-category-a-02'],

  ['B', 'rsp-category-a-02', 'rsp-category-a-08', 2, 0, 12, 6, 'rsp-category-a-02'],

  ['B', 'rsp-category-a-02', 'rsp-category-a-09', 2, 0, 12, 3, 'rsp-category-a-02'],

  ['B', 'rsp-category-a-03', 'rsp-category-a-06', 2, 1, 15, 13, 'rsp-category-a-03'],

  ['B', 'rsp-category-a-03', 'rsp-category-a-08', 2, 0, 12, 5, 'rsp-category-a-03'],

  ['B', 'rsp-category-a-03', 'rsp-category-a-09', 2, 0, 12, 6, 'rsp-category-a-03'],

  ['B', 'rsp-category-a-06', 'rsp-category-a-08', 2, 1, 15, 14, 'rsp-category-a-06'],

  ['B', 'rsp-category-a-06', 'rsp-category-a-09', 2, 0, 12, 7, 'rsp-category-a-06'],
]

const rspCategoryAPendingScenarioPairs = [
  ['A', 'rsp-category-a-07', 'rsp-category-a-10'],

  ['B', 'rsp-category-a-08', 'rsp-category-a-09'],
]

/*
|--------------------------------------------------------------------------
| TOURNAMENT DEMO PLAYERS
|--------------------------------------------------------------------------
|
| These were another separate collection of real club-member names.
| Their IDs and seeds stay exactly the same so all of the seeded
| scenario-results and fixture logic continue working.
|
*/

const rspCategories = [
  {
    id: 'premier',
    name: 'Premier',

    groups: [
      {
        id: 'A',
        name: 'Group A',

        players: [
          ['rsp-premier-01', 'Adekunle Fashola', 1],

          ['rsp-premier-03', 'Chinedu Okeke', 3],

          ['rsp-premier-05', 'Ifeanyi Nwachukwu', 5],

          ['rsp-premier-08', 'Gbenga Salako', 8],

          ['rsp-premier-09', 'Emmanuel Etim', 9],

          ['rsp-premier-11', 'Timi Alabo', 11],
        ],
      },

      {
        id: 'B',
        name: 'Group B',

        players: [
          ['rsp-premier-02', 'Kabiru Sani', 2],

          ['rsp-premier-04', 'Oghenekaro Efe', 4],

          ['rsp-premier-06', 'Chisom Ekwueme', 6],

          ['rsp-premier-07', 'Ayomide Adesina', 7],

          ['rsp-premier-10', 'Nosa Igbinovia', 10],

          ['rsp-premier-12', 'Bashir Abdullahi', 12],
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
          ['rsp-category-a-01', 'Ugo Emenike', 1],

          ['rsp-category-a-04', 'Lanre Adebisi', 4],

          ['rsp-category-a-05', 'Godwin Essien', 5],

          ['rsp-category-a-07', 'Kelechi Madu', 7],

          ['rsp-category-a-10', 'Seyi Aluko', 10],

          ['bye-category-a-a', 'BYE', 99, true],
        ],
      },

      {
        id: 'B',
        name: 'Group B',

        players: [
          ['rsp-category-a-02', 'Abdulrahman Yusuf', 2],

          ['rsp-category-a-03', 'Chibuzo Eze', 3],

          ['rsp-category-a-06', 'Tarebi Jack', 6],

          ['rsp-category-a-08', 'Folarin Ojo', 8],

          ['rsp-category-a-09', 'Ibrahim Sule', 9],

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
          ['rsp-category-b-01', 'Samuel Ndukwe', 1],

          ['rsp-category-b-04', 'Tochukwu Anene', 4],

          ['rsp-category-b-05', 'Jide Bakare', 5],

          ['rsp-category-b-07', 'Musa Adamu', 7],

          ['rsp-category-b-09', 'Princewill George', 9],

          ['rsp-category-b-11', 'Ovie Edafe', 11],
        ],
      },

      {
        id: 'B',
        name: 'Group B',

        players: [
          ['rsp-category-b-02', 'Chimaobi Iloh', 2],

          ['rsp-category-b-03', 'Babatunde Lawal', 3],

          ['rsp-category-b-06', 'Oluwaseun Akinola', 6],

          ['rsp-category-b-08', 'Henry Ekong', 8],

          ['rsp-category-b-10', 'Kelvin Dike', 10],

          ['rsp-category-b-12', 'Ismaila Garba', 12],
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
          ['rsp-ladies-01', 'Amaka Obi', 1],

          ['rsp-ladies-03', 'Yetunde Ajayi', 3],

          ['rsp-ladies-05', 'Hadiza Umar', 5],

          ['rsp-ladies-07', 'Ogechi Nwafor', 7],

          ['bye-ladies-a-1', 'BYE', 99, true],

          ['bye-ladies-a-2', 'BYE', 100, true],
        ],
      },

      {
        id: 'B',
        name: 'Group B',

        players: [
          ['rsp-ladies-02', 'Bisola Aina', 2],

          ['rsp-ladies-04', 'Ebiere Wariboko', 4],

          ['rsp-ladies-06', 'Mmesoma Eze', 6],

          ['rsp-ladies-08', 'Rukayat Bello', 8],

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
          ['rsp-veterans-01', 'Benedict Onu', 1],

          ['rsp-veterans-03', 'Kayode Akinremi', 3],

          ['rsp-veterans-06', 'Augustine Ekanem', 6],

          ['rsp-veterans-07', 'Patrick Nwosu', 7],

          ['rsp-veterans-09', 'Ikechukwu Eze', 9],

          ['rsp-veterans-12', 'Haruna Mohammed', 12],
        ],
      },

      {
        id: 'B',
        name: 'Group B',

        players: [
          ['rsp-veterans-02', 'Tonye Briggs', 2],

          ['rsp-veterans-04', 'Emeka Iro', 4],

          ['rsp-veterans-05', 'Festus Okorie', 5],

          ['rsp-veterans-08', 'Solomon Edet', 8],

          ['rsp-veterans-10', 'Ganiyu Oladipo', 10],

          ['rsp-veterans-11', 'Vincent Udo', 11],
        ],
      },
    ],
  },
]

function getSkillCategoryForRank(rank) {
  if (rank <= 12) {
    return 'premier'
  }

  if (rank <= 24) {
    return 'category-a'
  }

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

/*
|--------------------------------------------------------------------------
| CREATE PLAYERS
|--------------------------------------------------------------------------
|
| The first four players previously used four real Cloudinary images.
| We preserve the old wins/losses behaviour for those four rank slots,
| but their names/images are now fully synthetic.
|
*/

function createPlayers() {
  return playerSeeds.map((player, index) => {
    const rank = index + 1

    const isOriginalImageSlot = index < 4

    const remainingIndex = index - 4

    return {
      id: `player-${String(rank).padStart(2, '0')}`,

      name: player.name,

      email: player.email,

      imageUrl: player.imageUrl,

      rank,

      wins: isOriginalImageSlot ? Math.max(0, 12 - index) : Math.max(0, 8 - remainingIndex),

      losses: isOriginalImageSlot ? Math.max(0, index - 2) : Math.max(0, remainingIndex - 1),

      matchesPlayed: isOriginalImageSlot
        ? Math.max(1, 12 - index + index - 2)
        : Math.max(1, 8 - remainingIndex + remainingIndex - 1),

      ...createPlayerCategoryMetadata(player.name, rank, index),
    }
  })
}

function mapTournamentPlayer([playerId, name, seed, isBye = false]) {
  return {
    playerId,
    name,
    seed,
    isBye,
  }
}

function createRspTournamentImages(tournamentId) {
  return [
    {
      id: 'rsp-gallery-01',

      tournamentId,

      url: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1800&q=85',

      thumbnailUrl:
        'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=80',

      caption: 'Opening day on centre court',

      categoryId: 'premier',

      tags: ['opening-day', 'centre-court', 'players'],

      uploadedBy: 'player-02',

      uploadedByName: playerSeeds[1].name,

      uploadedAt: '2026-03-14T09:00:00.000Z',
    },

    {
      id: 'rsp-gallery-02',

      tournamentId,

      url: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1800&q=85',

      thumbnailUrl:
        'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=80',

      caption: 'Match point under the afternoon sun',

      categoryId: 'category-a',

      tags: ['match-day', 'action', 'centre-court'],

      uploadedBy: 'player-02',

      uploadedByName: playerSeeds[1].name,

      uploadedAt: '2026-03-19T15:30:00.000Z',
    },

    {
      id: 'rsp-gallery-03',

      tournamentId,

      url: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1800&q=85',

      thumbnailUrl:
        'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=80',

      caption: 'Ready for the next round',

      categoryId: 'category-b',

      tags: ['players', 'practice', 'behind-the-scenes'],

      uploadedBy: 'player-02',

      uploadedByName: playerSeeds[1].name,

      uploadedAt: '2026-03-24T11:20:00.000Z',
    },

    {
      id: 'rsp-gallery-04',

      tournamentId,

      url: 'https://images.unsplash.com/photo-1531315396756-905d68d21b56?auto=format&fit=crop&w=1800&q=85',

      thumbnailUrl:
        'https://images.unsplash.com/photo-1531315396756-905d68d21b56?auto=format&fit=crop&w=900&q=80',

      caption: 'Finals weekend atmosphere',

      categoryId: 'ladies',

      tags: ['finals', 'supporters', 'celebration'],

      uploadedBy: 'player-02',

      uploadedByName: playerSeeds[1].name,

      uploadedAt: '2026-04-04T17:45:00.000Z',
    },

    {
      id: 'rsp-gallery-05',

      tournamentId,

      url: 'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=1800&q=85',

      thumbnailUrl:
        'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=900&q=80',

      caption: 'A quiet court before play begins',

      categoryId: 'veterans',

      tags: ['court', 'opening-day', 'behind-the-scenes'],

      uploadedBy: 'player-02',

      uploadedByName: playerSeeds[1].name,

      uploadedAt: '2026-03-14T07:15:00.000Z',
    },

    {
      id: 'rsp-gallery-06',

      tournamentId,

      url: 'https://images.unsplash.com/photo-1599586120429-48281b6f0ece?auto=format&fit=crop&w=1800&q=85',

      thumbnailUrl:
        'https://images.unsplash.com/photo-1599586120429-48281b6f0ece?auto=format&fit=crop&w=900&q=80',

      caption: 'Championship focus',

      categoryId: 'premier',

      tags: ['finals', 'action', 'players'],

      uploadedBy: 'player-02',

      uploadedByName: playerSeeds[1].name,

      uploadedAt: '2026-04-04T14:10:00.000Z',
    },
  ]
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
    /*
     * Keep the internal ID unchanged because your fixture/scenario
     * code references rsp-masters-2026 directly.
     */

    id: tournamentId,

    name: '2026 Greenview Masters Tennis Tournament',

    description:
      'Demo masters tournament for Greenview Tennis Club members. Port Harcourt, Nigeria.',

    status: 'active',

    roundRobinStart: '2026-03-14',

    roundRobinEnd: '2026-03-31',

    knockoutStart: '2026-04-01',

    finalDate: '2026-04-04',

    categories,

    officials: ['Tunde', 'Amara', 'Femi', 'Zainab', 'Chidi'],

    rules: tournamentRules,

    images: createRspTournamentImages(tournamentId),

    gallerySeeded: true,

    gallerySchemaVersion: 2,

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

        rulesSource: category,
      })

      group.fixtureIds = groupFixtures.map((fixture) => fixture.id)

      fixtures.push(...groupFixtures)
    })
  })

  return fixtures
}

function findTournamentFixture(tournamentId, categoryId, groupId, playerOneId, playerTwoId) {
  return mockDatabase.matches.find((match) => {
    const hasPlayers =
      (match.player1Id === playerOneId && match.player2Id === playerTwoId) ||
      (match.player1Id === playerTwoId && match.player2Id === playerOneId)

    return (
      match.tournamentId === tournamentId &&
      match.categoryId === categoryId &&
      match.groupId === groupId &&
      hasPlayers
    )
  })
}

function applyScenarioResult([
  groupId,
  playerOneId,
  playerTwoId,
  p1Sets,
  p2Sets,
  p1Games,
  p2Games,
  winnerId,
]) {
  const match = findTournamentFixture(
    'rsp-masters-2026',
    'category-a',
    groupId,
    playerOneId,
    playerTwoId,
  )

  if (!match) {
    return
  }

  const isOriginalOrder = match.player1Id === playerOneId

  match.p1Sets = isOriginalOrder ? p1Sets : p2Sets

  match.p2Sets = isOriginalOrder ? p2Sets : p1Sets

  match.p1Games = isOriginalOrder ? p1Games : p2Games

  match.p2Games = isOriginalOrder ? p2Games : p1Games

  match.sets = []

  match.liveState = null

  match.winnerId = winnerId

  match.winnerName = winnerId === match.player1Id ? match.player1Name : match.player2Name

  match.status = 'completed'

  match.score = formatTournamentMatchScore(match)

  match.updatedAt = new Date().toISOString()
}

function clearScenarioResult([groupId, playerOneId, playerTwoId]) {
  const match = findTournamentFixture(
    'rsp-masters-2026',
    'category-a',
    groupId,
    playerOneId,
    playerTwoId,
  )

  if (!match) {
    return
  }

  match.p1Sets = null
  match.p2Sets = null

  match.p1Games = null
  match.p2Games = null

  match.sets = []

  match.liveState = null

  match.winnerId = null

  match.winnerName = null

  match.status = 'pending'

  match.score = null

  match.updatedAt = new Date().toISOString()
}

function applyRspCategoryAPartialScenario() {
  if (hasScenarioFlag(RSP_CATEGORY_A_PARTIAL_SCENARIO_KEY)) {
    return
  }

  const tournament = findTournament('rsp-masters-2026')

  if (!tournament) {
    return
  }

  rspCategoryAPartialScenarioResults.forEach(applyScenarioResult)

  rspCategoryAPendingScenarioPairs.forEach(clearScenarioResult)

  tournament.updatedAt = new Date().toISOString()

  saveTournamentState()

  setScenarioFlag(RSP_CATEGORY_A_PARTIAL_SCENARIO_KEY)
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
  const savedState = loadTournamentState()

  if (savedState?.tournaments?.length) {
    mockDatabase.tournaments = savedState.tournaments

    mockDatabase.tournaments.forEach((tournament) => {
      if (!tournament.gallerySeeded) {
        tournament.images =
          tournament.id === 'rsp-masters-2026' ? createRspTournamentImages(tournament.id) : []

        tournament.gallerySeeded = true
      }

      if (
        tournament.id === 'rsp-masters-2026' &&
        Number(tournament.gallerySchemaVersion || 0) < 2
      ) {
        const categoryIds = ['premier', 'category-a', 'category-b', 'ladies', 'veterans', 'premier']

        tournament.images = (tournament.images || []).map((image, index) => ({
          ...image,

          categoryId: image.categoryId || categoryIds[index % categoryIds.length],
        }))

        tournament.gallerySchemaVersion = 2
      }
    })

    const savedMatches = (savedState.matches || []).map(ensureMatchDefaults)

    const savedMatchIds = new Set(savedMatches.map((match) => match.id))

    mockDatabase.matches = [
      ...mockDatabase.matches.filter((match) => !savedMatchIds.has(match.id)),

      ...savedMatches,
    ]

    mockDatabase.tournaments.forEach((tournament) => {
      tournament.categories?.forEach(syncCategoryKnockout)
    })

    applyRspCategoryAPartialScenario()

    return
  }

  if (mockDatabase.tournaments.length > 0) {
    return
  }

  const tournament = createRspTournament()

  mockDatabase.tournaments = [tournament]

  mockDatabase.matches.push(...seedTournamentFixtures(tournament))

  tournament.categories.forEach(syncCategoryKnockout)

  applyRspCategoryAPartialScenario()

  saveTournamentState()
}

function getStatusLabel(status) {
  switch (status) {
    case 'awaiting':
      return 'Awaiting Acceptance'

    case 'accepted':
      return 'Accepted · Schedule Needed'

    case 'scheduled':
      return 'Scheduled'

    case 'ready':
      return 'Ready to Play'

    case 'live':
      return 'In Progress'

    case 'pending_review':
      return 'Pending Review'

    case 'completed':
      return 'Completed'

    case 'declined':
      return 'Declined'

    case 'cancelled':
      return 'Cancelled'

    case 'expired':
      return 'Expired'

    default:
      return 'Unknown'
  }
}

function ensureData() {
  if (mockDatabase.players.length === 0) {
    const savedLadderState = loadLadderState()

    if (savedLadderState?.players?.length) {
      mockDatabase.players = savedLadderState.players

      mockDatabase.challenges = Array.isArray(savedLadderState.challenges)
        ? savedLadderState.challenges
        : []

      mockDatabase.matches = Array.isArray(savedLadderState.matches)
        ? savedLadderState.matches.map(ensureMatchDefaults)
        : []
    }
  }

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

        scheduledAt: new Date(Date.now() - 86400000).toISOString(),
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

  const movementSystem = match.ladderConfigSnapshot?.movementSystem || 'position-swap'

  if (
    movementSystem === 'position-swap' &&
    match.winnerId === challenger.id &&
    challenger.rank > defender.rank
  ) {
    const oldRank = challenger.rank

    challenger.rank = defender.rank

    defender.rank = oldRank
  }

  if (
    movementSystem === 'leapfrog' &&
    match.winnerId === challenger.id &&
    challenger.rank > defender.rank
  ) {
    const previousRank = challenger.rank

    const targetRank = defender.rank

    mockDatabase.players.forEach((player) => {
      if (player.id !== challenger.id && player.rank >= targetRank && player.rank < previousRank) {
        player.rank += 1
      }
    })

    challenger.rank = targetRank
  }

  mockDatabase.players = mockDatabase.players
    .sort((a, b) => a.rank - b.rank)
    .map((player, index) => ({
      ...player,

      rank: index + 1,
    }))
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

function formatTournamentSetScore(sets = []) {
  return sets
    .map((set) => {
      const playerAGames = Number(set.games?.playerA ?? 0)

      const playerBGames = Number(set.games?.playerB ?? 0)

      const tieBreak = set.tieBreak?.score

      if (tieBreak) {
        return `${playerAGames}-${playerBGames} (${tieBreak.playerA}-${tieBreak.playerB})`
      }

      return `${playerAGames}-${playerBGames}`
    })
    .join(', ')
}

function formatTournamentMatchScore(match) {
  if (match.sets?.length) {
    return formatTournamentSetScore(match.sets)
  }

  if (
    match.p1Sets !== null &&
    match.p1Sets !== undefined &&
    match.p2Sets !== null &&
    match.p2Sets !== undefined
  ) {
    return `${match.p1Sets}-${match.p2Sets}`
  }

  return null
}

function buildResponse(data) {
  return {
    success: true,
    data,
    message: '',
  }
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

function syncKnockoutMatchToSharedMatch(knockoutMatch, category) {
  if (!knockoutMatch) {
    return
  }

  const existingIndex = mockDatabase.matches.findIndex((match) => match.id === knockoutMatch.id)

  const resolvedRules = tournamentRulesToMatchRulesSnapshot({
    ...category,
    rulesSnapshot: knockoutMatch.rulesSnapshot,
  })

  const sharedMatch = {
    ...knockoutMatch,

    type: 'tournament',

    groupId: null,

    player1Seed: null,

    player2Seed: null,

    challengerId: knockoutMatch.player1Id,

    defenderId: knockoutMatch.player2Id,

    isBye: false,

    sets: knockoutMatch.sets || [],

    liveState: null,

    rulesSnapshot: resolvedRules.ok
      ? freezeMatchRulesSnapshot(resolvedRules.snapshot)
      : knockoutMatch.rulesSnapshot || null,

    rulesState: resolvedRules.ok ? 'resolved' : 'legacy_unresolved',

    score: formatTournamentMatchScore(knockoutMatch),
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
  category.knockout.quarterFinals?.forEach((match) =>
    syncKnockoutMatchToSharedMatch(match, category),
  )

  category.knockout.semiFinals?.forEach((match) =>
    syncKnockoutMatchToSharedMatch(match, category),
  )

  syncKnockoutMatchToSharedMatch(category.knockout.final, category)
}

function updateKnockoutMatch(category, match) {
  const collections = [category.knockout.quarterFinals, category.knockout.semiFinals]

  collections.forEach((collection) => {
    const matchIndex = collection.findIndex((item) => item.id === match.id)

    if (matchIndex !== -1) {
      collection[matchIndex] = {
        ...collection[matchIndex],

        ...match,
      }
    }
  })

  if (category.knockout.final?.id === match.id) {
    category.knockout.final = {
      ...category.knockout.final,

      ...match,
    }
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

  const isFreshAccount = getAppDataMode() === APP_DATA_MODES.EMPTY

  /*
    |--------------------------------------------------------------------------
    | FRESH ACCOUNT
    |--------------------------------------------------------------------------
    */

  if (isFreshAccount && method === 'get' && path === '/players') {
    return {
      data: buildResponse(buildFreshAccountLadderRoster(mockDatabase.players)),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  if (isFreshAccount && method === 'get' && path === '/challenges') {
    const challenges = mockDatabase.challenges
      .filter((challenge) => challenge.accountScope === FRESH_ACCOUNT_LADDER_SCOPE)
      .map(buildChallengeResponse)

    return {
      data: buildResponse(challenges),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  if (isFreshAccount && method === 'get' && path === '/matches') {
    const matches = mockDatabase.matches
      .filter((match) => match.accountScope === FRESH_ACCOUNT_LADDER_SCOPE)
      .map(buildMatchResponse)

    return {
      data: buildResponse(matches),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  if (isFreshAccount && method === 'get' && path === '/tournaments') {
    return {
      data: buildResponse([]),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  if (isFreshAccount && method === 'get' && path.startsWith('/tournaments/')) {
    return {
      data: {
        success: false,

        data: null,

        message: 'No tournament data exists for this account yet.',
      },

      status: 404,

      statusText: 'Not Found',

      headers: {},

      config,

      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | PLAYERS
    |--------------------------------------------------------------------------
    */

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

  /*
    |--------------------------------------------------------------------------
    | CHALLENGES
    |--------------------------------------------------------------------------
    */

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

  /*
    |--------------------------------------------------------------------------
    | MATCHES
    |--------------------------------------------------------------------------
    */

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

    const candidate = mockDatabase.matches.find((item) => item.id === matchId)

    const match =
      isFreshAccount && candidate?.accountScope !== FRESH_ACCOUNT_LADDER_SCOPE ? null : candidate

    return {
      data: match
        ? buildResponse(buildMatchResponse(match))
        : {
            success: false,

            data: null,

            message: 'Match not found',
          },

      status: match ? 200 : 404,

      statusText: match ? 'OK' : 'Not Found',

      headers: {},

      config,

      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/matches\/[^/]+\/start$/)) {
    const matchId = path.split('/')[2]
    const match = mockDatabase.matches.find((item) => item.id === matchId)
    const tournament = match?.type === 'tournament' ? findTournament(match.tournamentId) : null
    const category =
      match?.type === 'tournament' ? findCategory(match.tournamentId, match.categoryId) : null
    const rules = tournamentRulesToMatchRulesSnapshot({
      ...category,
      rulesSnapshot: match?.rulesSnapshot,
    })
    const errorMessage = !match
      ? 'Match not found'
      : match.type !== 'tournament'
        ? 'This start operation only accepts Tournament matches.'
        : !body?.authorized || !body?.actorId
          ? 'Tournament score-update permission is required to start this match.'
          : tournament?.clubId && body?.clubId !== tournament.clubId
            ? 'This Tournament does not belong to the active club.'
            : !['pending', 'scheduled', 'live'].includes(match.status)
              ? 'This Tournament match cannot be started from its current state.'
              : !match.player1Id || !match.player2Id
                ? 'Both Tournament sides must be known before live scoring starts.'
                : !rules.ok
                  ? rules.issues?.[0]?.message || 'Tournament match rules are unresolved.'
                  : ''

    if (errorMessage) {
      return {
        data: { success: false, data: null, message: errorMessage },
        status: match ? 422 : 404,
        statusText: match ? 'Unprocessable Entity' : 'Not Found',
        headers: {},
        config,
        request: {},
      }
    }

    const rulesWereMissing = !match.rulesSnapshot
    match.rulesSnapshot = freezeMatchRulesSnapshot(rules.snapshot)
    match.rulesState = 'resolved'

    if (match.status !== 'live') {
      const startedAt = new Date().toISOString()
      match.status = 'live'
      match.startedAt = startedAt
      match.scorerId = body.actorId
      match.updatedAt = startedAt
      saveTournamentState()
    } else if (rulesWereMissing) {
      match.updatedAt = new Date().toISOString()
      saveTournamentState()
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

  if (method === 'patch' && path.match(/^\/matches\/[^/]+$/)) {
    const matchId = path.split('/')[2]

    const matchIndex = mockDatabase.matches.findIndex((item) => item.id === matchId)

    if (matchIndex === -1) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Match not found',
        },

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

    if (mockDatabase.matches[matchIndex].type === 'tournament') {
      saveTournamentState()
    } else {
      saveLadderState()
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

  /*
    |--------------------------------------------------------------------------
    | TOURNAMENTS
    |--------------------------------------------------------------------------
    */

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

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+\/images$/)) {
    const tournament = findTournament(path.split('/')[2])

    return {
      data: tournament
        ? buildResponse(
            [...(tournament.images || [])].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
          )
        : {
            success: false,

            data: null,

            message: 'Tournament not found',
          },

      status: tournament ? 200 : 404,

      statusText: tournament ? 'OK' : 'Not Found',

      headers: {},

      config,

      request: {},
    }
  }

  if (method === 'get' && path.match(/^\/tournaments\/[^/]+\/images\/[^/]+$/)) {
    const [, , tournamentId, , imageId] = path.split('/')

    const tournament = findTournament(tournamentId)

    const image = tournament?.images?.find((item) => item.id === imageId)

    return {
      data: image
        ? buildResponse(image)
        : {
            success: false,

            data: null,

            message: 'Tournament image not found',
          },

      status: image ? 200 : 404,

      statusText: image ? 'OK' : 'Not Found',

      headers: {},

      config,

      request: {},
    }
  }

  if (method === 'post' && path.match(/^\/tournaments\/[^/]+\/images$/)) {
    const tournamentId = path.split('/')[2]

    const tournament = findTournament(tournamentId)

    if (!tournament) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Tournament not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    const categoryExists =
      !body?.categoryId ||
      tournament.categories?.some((category) => category.id === body.categoryId)

    const safeCaption = sanitizePlainText(body?.caption, 120)

    if (!isSafeImageSource(body?.url) || !safeCaption || !categoryExists) {
      return {
        data: {
          success: false,

          data: null,

          message: categoryExists
            ? 'A valid image source and caption are required.'
            : 'Choose a category from this tournament.',
        },

        status: 422,

        statusText: 'Unprocessable Entity',

        headers: {},

        config,

        request: {},
      }
    }

    const image = {
      id: `tournament-image-${Date.now()}`,

      tournamentId,

      url: body.url,

      thumbnailUrl: body.thumbnailUrl || body.url,

      caption: safeCaption,

      categoryId: body.categoryId || null,

      tags: sanitizeSlugList(body.tags),

      sourceType: body.sourceType === 'upload' ? 'upload' : 'link',

      originalFileName: sanitizePlainText(body.originalFileName, 120),

      mimeType: sanitizePlainText(body.mimeType, 80),

      fileSize: Math.max(0, Number(body.fileSize || 0)),

      uploadedBy: body.uploadedBy || null,

      uploadedByName: body.uploadedByName || 'Tournament admin',

      uploadedAt: new Date().toISOString(),
    }

    tournament.images = [image, ...(tournament.images || [])]

    tournament.gallerySeeded = true

    saveTournamentState()

    return {
      data: buildResponse(image),

      status: 201,

      statusText: 'Created',

      headers: {},

      config,

      request: {},
    }
  }

  if (method === 'delete' && path.match(/^\/tournaments\/[^/]+\/images\/[^/]+$/)) {
    const [, , tournamentId, , imageId] = path.split('/')

    const tournament = findTournament(tournamentId)

    const imageIndex = tournament?.images?.findIndex((image) => image.id === imageId) ?? -1

    if (!tournament || imageIndex === -1) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Tournament image not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    tournament.images.splice(imageIndex, 1)

    saveTournamentState()

    return {
      data: buildResponse({
        id: imageId,
      }),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  if (method === 'post' && path === '/tournaments') {
    if (!Array.isArray(body.categories) || body.categories.length === 0) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Create at least one tournament category before generating.',
        },

        status: 422,

        statusText: 'Unprocessable Entity',

        headers: {},

        config,

        request: {},
      }
    }

    const tournament = {
      ...body,

      id: body.id || `tournament-${Date.now()}`,

      status: body.status || 'upcoming',

      images: [],

      gallerySeeded: true,

      gallerySchemaVersion: 2,

      createdAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),
    }

    mockDatabase.tournaments.push(tournament)

    tournament.categories?.forEach(syncCategoryKnockout)

    saveTournamentState()

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
        : {
            success: false,

            data: null,

            message: 'Tournament not found',
          },

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
        data: {
          success: false,

          data: null,

          message: 'Tournament not found',
        },

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

    saveTournamentState()

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
        : {
            success: false,

            data: null,

            message: 'Tournament not found',
          },

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
      data: category
        ? buildResponse(category)
        : {
            success: false,

            data: null,

            message: 'Category not found',
          },

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

  if (
    method === 'get' &&
    path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+\/standings\/[^/]+$/)
  ) {
    const [, , tournamentId, , categoryId, , groupId] = path.split('/')

    const tournament = findTournament(tournamentId)

    const category = findCategory(tournamentId, categoryId)

    const group = category?.groups.find((item) => item.id === groupId)

    const matches = getCategoryMatches(tournamentId, categoryId)

    const standings = group ? calculateGroupStandings(group, matches, tournament.rules) : []

    return {
      data: group
        ? buildResponse(standings)
        : {
            success: false,

            data: null,

            message: 'Group not found',
          },

      status: group ? 200 : 404,

      statusText: group ? 'OK' : 'Not Found',

      headers: {},

      config,

      request: {},
    }
  }

  if (
    method === 'post' &&
    path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+\/close-round-robin$/)
  ) {
    const [, , tournamentId, , categoryId] = path.split('/')

    const tournament = findTournament(tournamentId)

    const category = findCategory(tournamentId, categoryId)

    if (!tournament || !category) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Category not found',
        },

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

      qualifiersPerGroup:
        category.settings?.qualifiersPerGroup ?? tournament.rules?.qualifiersPerGroup,
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

    saveTournamentState()

    return {
      data: buildResponse(category),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  if (
    method === 'post' &&
    path.match(/^\/tournaments\/[^/]+\/categories\/[^/]+\/generate-fixtures$/)
  ) {
    const [, , tournamentId, , categoryId] = path.split('/')

    const category = findCategory(tournamentId, categoryId)

    if (!category) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Category not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    const resolvedRules = tournamentRulesToMatchRulesSnapshot(category)
    if (!resolvedRules.ok) {
      return {
        data: {
          success: false,
          data: null,
          message:
            resolvedRules.issues?.[0]?.message ||
            'Choose an unambiguous scoring format before generating fixtures.',
        },
        status: 422,
        statusText: 'Unprocessable Entity',
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

        rulesSource: category,

        requireResolvedRules: true,
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

    saveTournamentState()

    return {
      data: buildResponse(category),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | ADMIN LADDER MATCH
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path === '/admin/ladder-matches') {
    const ladderConfig = getActiveLadderConfig()
    const challenger = getPlayerById(body.challengerPlayerId)
    const defender = getPlayerById(body.opponentPlayerId)
    const timing = body.timing === 'scheduled' ? 'scheduled' : 'now'
    const activeChallengeCountFor = (playerId) =>
      mockDatabase.challenges.filter(
        (challenge) =>
          (challenge.ladderId || challenge.ladderConfigSnapshot?.id) === body.ladderId &&
          ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
          [challenge.challengerId, challenge.defenderId].includes(playerId),
      ).length
    const scheduledTime = new Date(body.scheduledAt || 0).getTime()
    const allowedRuleSources = ['ladder_default', 'admin_override']
    const resolvedRules = ladderRulesToMatchRulesSnapshot({
      rulesSnapshot: body.rulesSnapshot,
      ladderConfigSnapshot: ladderConfig,
      matchConfig:
        body.matchRuleSource === 'admin_override'
          ? body.matchRules
          : ladderMatchConfig(ladderConfig),
    })
    const invalidMessage = !body.ladderId
      ? 'Choose an active Ladder.'
      : !challenger?.rank || !defender?.rank
        ? 'Both players must belong to the active Ladder.'
        : !isEligibleLadderOpponent(challenger, defender, ladderConfig)
          ? 'The selected opponent is outside this player’s eligible challenge window.'
          : Math.max(
                activeChallengeCountFor(challenger.id),
                activeChallengeCountFor(defender.id),
              ) >= ladderConfig.maxActiveChallenges
            ? 'One of these players must finish an active challenge first.'
            : timing === 'scheduled' &&
                (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now())
              ? 'Choose a future match date and time.'
              : !allowedRuleSources.includes(body.matchRuleSource)
                ? 'Choose whether to use the Ladder default or an admin override.'
                : !resolvedRules.ok
                  ? 'Choose a valid match format for this Ladder match.'
                  : ''

    if (invalidMessage) {
      return {
        data: { success: false, data: null, message: invalidMessage },
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config,
        request: {},
      }
    }

    const now = new Date().toISOString()
    const challengeId = `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const matchId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const rulesSnapshot = freezeMatchRulesSnapshot(resolvedRules.snapshot)
    const matchConfig = matchRulesSnapshotToLegacyLadderConfig(rulesSnapshot)
    const scheduledAt = timing === 'scheduled' ? new Date(scheduledTime).toISOString() : null
    const status = timing === 'scheduled' ? 'scheduled' : 'live'
    const court = sanitizePlainText(body.courtId, 80)
    const challenge = {
      id: challengeId,
      ladderId: body.ladderId,
      challengerId: challenger.id,
      defenderId: defender.id,
      scorerId: body.actorId || null,
      type: 'ladder',
      accountScope: isFreshAccount ? FRESH_ACCOUNT_LADDER_SCOPE : 'demo',
      status,
      requestedAt: now,
      acceptedAt: now,
      createdAt: now,
      startedAt: timing === 'now' ? now : null,
      scheduledAt,
      createdByAdmin: true,
      matchRuleSource: body.matchRuleSource,
      responseDeadline: now,
      playDeadline: deadlineFromNow(ladderConfig.completionDays, 'days'),
      preMatchPositions: {
        challenger: challenger.rank,
        defender: defender.rank,
      },
      ladderConfigSnapshot: { ...ladderConfig },
      rulesSnapshot: freezeMatchRulesSnapshot(rulesSnapshot),
      matchConfig,
      court,
      note: '',
    }
    const match = ensureMatchDefaults({
      id: matchId,
      challengeId,
      ladderId: body.ladderId,
      accountScope: challenge.accountScope,
      challengerId: challenger.id,
      defenderId: defender.id,
      scorerId: body.actorId || null,
      type: 'ladder',
      status,
      scheduledAt,
      startedAt: challenge.startedAt,
      score: null,
      winnerId: null,
      matchRuleSource: body.matchRuleSource,
      rulesSnapshot,
      matchConfig,
      ladderConfigSnapshot: challenge.ladderConfigSnapshot,
      preMatchPositions: challenge.preMatchPositions,
      playDeadline: challenge.playDeadline,
      court,
    })

    mockDatabase.challenges.push(challenge)
    mockDatabase.matches.push(match)
    saveLadderState()

    return {
      data: buildResponse({
        challenge: buildChallengeResponse(challenge),
        match: buildMatchResponse(match),
      }),
      status: 201,
      statusText: 'Created',
      headers: {},
      config,
      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | CREATE CHALLENGE
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path === '/challenges') {
    const ladderConfig = getActiveLadderConfig()
    const ladderId = body.ladderId || ladderConfig.id

    const challenger = getPlayerById(body.challengerId)

    const defender = getPlayerById(body.defenderId)

    const activeChallengeCountFor = (playerId) =>
      mockDatabase.challenges.filter(
        (challenge) =>
          (challenge.ladderId || challenge.ladderConfigSnapshot?.id) === ladderId &&
          ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
          [challenge.challengerId, challenge.defenderId].includes(playerId),
      ).length

    const challengerActiveCount = activeChallengeCountFor(body.challengerId)

    const defenderActiveCount = activeChallengeCountFor(body.defenderId)

    const previousMeeting = mockDatabase.challenges
      .filter((challenge) => challenge.status === 'completed')
      .filter(
        (challenge) => (challenge.ladderId || challenge.ladderConfigSnapshot?.id) === ladderId,
      )
      .filter((challenge) => {
        const pair = new Set([challenge.challengerId, challenge.defenderId])

        return pair.has(body.challengerId) && pair.has(body.defenderId)
      })
      .sort(
        (a, b) =>
          new Date(b.confirmedAt || b.completedAt || 0).getTime() -
          new Date(a.confirmedAt || a.completedAt || 0).getTime(),
      )[0]

    const previousMeetingTime = new Date(
      previousMeeting?.confirmedAt || previousMeeting?.completedAt || 0,
    ).getTime()

    const cooldownEndsAt =
      previousMeetingTime + Number(ladderConfig.rematchCooldownDays || 0) * 86_400_000

    const rematchIsCoolingDown = previousMeetingTime > 0 && cooldownEndsAt > Date.now()

    const preparedRules = ladderRulesToMatchRulesSnapshot({
      rulesSnapshot: body.rulesSnapshot,
      ladderConfigSnapshot: ladderConfig,
      matchConfig: body.matchConfig || ladderMatchConfig(ladderConfig),
    })

    const invalidMessage =
      ladderConfig.seasonStatus !== 'active'
        ? 'The Ladder is not accepting challenges right now.'
        : !challenger?.rank
          ? 'A current Ladder position is required.'
          : !defender?.rank
            ? 'The selected opponent is not on the active Ladder.'
            : !isEligibleLadderOpponent(challenger, defender, ladderConfig)
              ? 'The selected opponent is outside your eligible challenge window.'
              : rematchIsCoolingDown
                ? `This rematch is available after ${new Date(cooldownEndsAt).toLocaleDateString()}.`
                : Math.max(challengerActiveCount, defenderActiveCount) >=
                    ladderConfig.maxActiveChallenges
                  ? 'One of these players must finish an active challenge first.'
                  : !preparedRules.ok
                    ? 'The Ladder match format is invalid.'
                    : ''

    if (invalidMessage) {
      return {
        data: {
          success: false,

          data: null,

          message: invalidMessage,
        },

        status: 422,

        statusText: 'Unprocessable Entity',

        headers: {},

        config,

        request: {},
      }
    }

    const now = new Date().toISOString()

    const id = `challenge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const challenge = {
      ...body,

      id,

      ladderId,

      challengerId: challenger.id,

      defenderId: defender.id,

      scorerId: body.scorerId || null,

      type: 'ladder',

      accountScope: isFreshAccount ? FRESH_ACCOUNT_LADDER_SCOPE : 'demo',

      status: 'awaiting',

      requestedAt: now,

      createdAt: now,

      responseDeadline: deadlineFromNow(ladderConfig.responseHours),

      playDeadline: deadlineFromNow(ladderConfig.completionDays, 'days'),

      preMatchPositions: body.preMatchPositions || {
        challenger: challenger.rank,

        defender: defender.rank,
      },

      ladderConfigSnapshot: {
        ...ladderConfig,
      },

      rulesSnapshot: freezeMatchRulesSnapshot(preparedRules.snapshot),

      matchConfig: matchRulesSnapshotToLegacyLadderConfig(preparedRules.snapshot),

      note: sanitizePlainText(body.note, 500),
    }

    mockDatabase.challenges.push(challenge)

    saveLadderState()

    return {
      data: buildResponse(buildChallengeResponse(challenge)),

      status: 201,

      statusText: 'Created',

      headers: {},

      config,

      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | ACCEPT CHALLENGE
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/accept$/)) {
    const challengeId = path.split('/')[2]

    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)

    if (!challenge) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Challenge not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    if (body?.actorId !== challenge.defenderId) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only the challenged player can accept this challenge.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (challenge.status !== 'awaiting') {
      return {
        data: {
          success: false,

          data: null,

          message: 'This challenge has already been answered.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    if (new Date(challenge.responseDeadline || 0).getTime() < Date.now()) {
      challenge.status = 'expired'

      challenge.expiredAt = new Date().toISOString()

      saveLadderState()

      return {
        data: {
          success: false,

          data: null,

          message: 'The response deadline has passed.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    const acceptedSchedule = body?.scheduledAt || challenge.scheduledAt || null

    challenge.status = acceptedSchedule ? 'scheduled' : 'accepted'

    challenge.acceptedAt = new Date().toISOString()

    challenge.scheduledAt = acceptedSchedule

    const existingMatch = mockDatabase.matches.find((item) => item.challengeId === challenge.id)

    const matchId =
      existingMatch?.id || `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    const match =
      existingMatch ||
      ensureMatchDefaults({
        id: matchId,

        challengeId: challenge.id,

        accountScope: challenge.accountScope || 'demo',

        challengerId: challenge.challengerId,

        defenderId: challenge.defenderId,

        status: challenge.status,

        scheduledAt: challenge.scheduledAt,

        score: null,

        winnerId: null,

        rulesSnapshot: challenge.rulesSnapshot
          ? freezeMatchRulesSnapshot(challenge.rulesSnapshot)
          : null,

        matchConfig: challenge.matchConfig,

        ladderConfigSnapshot: challenge.ladderConfigSnapshot,

        preMatchPositions: challenge.preMatchPositions,

        playDeadline: challenge.playDeadline,

        court: challenge.court || '',
      })

    if (existingMatch) {
      match.status = challenge.status

      match.scheduledAt = challenge.scheduledAt

      match.rulesSnapshot = match.rulesSnapshot
        ? freezeMatchRulesSnapshot(match.rulesSnapshot)
        : challenge.rulesSnapshot
          ? freezeMatchRulesSnapshot(challenge.rulesSnapshot)
          : null
    } else {
      mockDatabase.matches.push(match)
    }

    saveLadderState()

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

  /*
    |--------------------------------------------------------------------------
    | SCHEDULE CHALLENGE
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/schedule$/)) {
    const challengeId = path.split('/')[2]

    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)

    if (!challenge) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Challenge not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    if (![challenge.challengerId, challenge.defenderId].includes(body?.actorId)) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only a challenge player can schedule this match.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (!['accepted', 'scheduled'].includes(challenge.status)) {
      return {
        data: {
          success: false,

          data: null,

          message: 'This challenge is not ready to schedule.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    const scheduledTime = new Date(body?.scheduledAt || 0).getTime()

    if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Choose a future match date and time.',
        },

        status: 422,

        statusText: 'Unprocessable Entity',

        headers: {},

        config,

        request: {},
      }
    }

    challenge.status = 'scheduled'

    challenge.scheduledAt = new Date(scheduledTime).toISOString()

    challenge.court = sanitizePlainText(body?.court, 80)

    challenge.scheduledBy = body.actorId

    challenge.scheduleUpdatedAt = new Date().toISOString()

    let match = mockDatabase.matches.find((item) => item.challengeId === challenge.id)

    if (!match) {
      match = ensureMatchDefaults({
        id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,

        challengeId: challenge.id,

        accountScope: challenge.accountScope || 'demo',

        challengerId: challenge.challengerId,

        defenderId: challenge.defenderId,

        score: null,

        winnerId: null,

        rulesSnapshot: challenge.rulesSnapshot
          ? freezeMatchRulesSnapshot(challenge.rulesSnapshot)
          : null,

        matchConfig: challenge.matchConfig,

        ladderConfigSnapshot: challenge.ladderConfigSnapshot,

        preMatchPositions: challenge.preMatchPositions,

        playDeadline: challenge.playDeadline,
      })

      mockDatabase.matches.push(match)
    }

    match.status = 'scheduled'

    match.rulesSnapshot = match.rulesSnapshot
      ? freezeMatchRulesSnapshot(match.rulesSnapshot)
      : challenge.rulesSnapshot
        ? freezeMatchRulesSnapshot(challenge.rulesSnapshot)
        : null

    match.scheduledAt = challenge.scheduledAt

    match.court = challenge.court

    saveLadderState()

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

  /*
    |--------------------------------------------------------------------------
    | START MATCH
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/start$/)) {
    const challengeId = path.split('/')[2]

    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)

    const match = mockDatabase.matches.find((item) => item.challengeId === challengeId)

    if (!challenge || !match) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Scheduled match not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    if (
      ![challenge.challengerId, challenge.defenderId, match.scorerId]
        .filter(Boolean)
        .includes(body?.actorId)
    ) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only a match player or the assigned scorer can start this match.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (!['accepted', 'scheduled', 'ready'].includes(challenge.status)) {
      return {
        data: {
          success: false,

          data: null,

          message: 'This match cannot be started from its current state.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    const scheduledTime = new Date(challenge.scheduledAt || 0).getTime()

    if (Number.isFinite(scheduledTime) && scheduledTime > Date.now() + 30 * 60 * 1000) {
      return {
        data: {
          success: false,

          data: null,

          message: 'This match can be started thirty minutes before its scheduled time.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    const startedAt = new Date().toISOString()

    challenge.status = 'live'

    challenge.startedAt = startedAt

    match.status = 'live'

    match.startedAt = startedAt

    saveLadderState()

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

  /*
    |--------------------------------------------------------------------------
    | SUBMIT MATCH RESULT
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/matches\/[^/]+\/result$/)) {
    const matchId = path.split('/')[2]

    const match = mockDatabase.matches.find((item) => item.id === matchId)

    if (!match) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Match not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    /*
     * Tournament result.
     */

    if (match.type === 'tournament') {
      const resultId = String(body?.resultId || '')
      if (resultId && match.resultId === resultId) {
        return {
          data: buildResponse(buildMatchResponse(match)),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        }
      }

      match.p1Sets = body?.p1Sets

      match.p2Sets = body?.p2Sets

      match.p1Games = body?.p1Games ?? null

      match.p2Games = body?.p2Games ?? null

      match.sets = Array.isArray(body?.sets) ? body.sets : []

      match.winnerId = body?.winnerId

      match.winnerName = match.winnerId === match.player1Id ? match.player1Name : match.player2Name

      match.status = body?.status || 'completed'

      match.resultId = resultId || match.resultId || null

      match.completedAt =
        match.status === 'completed' ? match.completedAt || new Date().toISOString() : null

      match.score = formatTournamentMatchScore(match)

      const category = findCategory(
        match.tournamentId,

        match.categoryId,
      )

      if (category && match.groupId === null) {
        updateKnockoutMatch(category, match)

        const progressedCategory = progressKnockout(category)

        Object.assign(category, progressedCategory)

        syncCategoryKnockout(category)
      }

      saveTournamentState()

      return {
        data: buildResponse(buildMatchResponse(match)),

        status: 200,

        statusText: 'OK',

        headers: {},

        config,

        request: {},
      }
    }

    /*
     * Ladder result.
     */

    if (
      ![match.challengerId, match.defenderId, match.scorerId]
        .filter(Boolean)
        .includes(body?.submittedBy)
    ) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only a match player or the assigned scorer can submit this result.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (![match.challengerId, match.defenderId].includes(body?.winnerId)) {
      return {
        data: {
          success: false,

          data: null,

          message: 'The winner must be one of the challenge players.',
        },

        status: 422,

        statusText: 'Unprocessable Entity',

        headers: {},

        config,

        request: {},
      }
    }

    const resultId = sanitizePlainText(body?.resultId, 160) || `result-${match.id}`

    if (match.resultId) {
      if (match.resultId === resultId && ['pending_review', 'completed'].includes(match.status)) {
        return {
          data: buildResponse(buildMatchResponse(match)),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        }
      }
      return {
        data: {
          success: false,
          data: null,
          message: 'A different physical result has already been recorded for this Match.',
        },
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config,
        request: {},
      }
    }

    match.score = body?.score || '6-4, 6-4'

    match.sets = Array.isArray(body?.sets) ? body.sets : []

    match.winnerId = body?.winnerId

    match.resultId = resultId

    match.resultSubmittedBy = body?.submittedBy || match.challengerId

    match.resultSubmittedAt = new Date().toISOString()

    match.status = 'pending_review'

    const challenge = mockDatabase.challenges.find((item) => item.id === match.challengeId)

    if (challenge) {
      challenge.status = 'pending_review'

      challenge.resultSubmittedBy = match.resultSubmittedBy

      challenge.resultSubmittedAt = match.resultSubmittedAt

      challenge.resultId = resultId
    }

    saveLadderState()

    return {
      data: buildResponse(buildMatchResponse(match)),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | REVIEW RESULT
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/review$/)) {
    const challengeId = path.split('/')[2]

    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)

    if (!challenge) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Challenge not found',
        },

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
        data: {
          success: false,

          data: null,

          message: 'Match not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    const reviewActor = body?.actorId

    const isParticipant = [match.challengerId, match.defenderId].includes(reviewActor)

    const canConfirm = match.resultSubmittedBy
      ? isParticipant && reviewActor !== match.resultSubmittedBy
      : reviewActor === challenge.defenderId

    if (!canConfirm) {
      return {
        data: {
          success: false,

          data: null,

          message: 'The other match player must confirm this result.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (challenge.status !== 'pending_review' || match.status !== 'pending_review') {
      return {
        data: {
          success: false,

          data: null,

          message: 'This result is not waiting for confirmation.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    challenge.status = 'completed'

    challenge.confirmedAt = new Date().toISOString()

    match.status = 'completed'

    match.confirmedAt = challenge.confirmedAt

    updateRankingsForResult(match)

    saveLadderState()

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

  /*
    |--------------------------------------------------------------------------
    | ADMIN RESOLVE RESULT
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/resolve-result$/)) {
    const challengeId = path.split('/')[2]

    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)

    if (!challenge) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Challenge not found',
        },

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
        data: {
          success: false,

          data: null,

          message: 'Match not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    const actorIsAdmin = ['club_admin', 'super_admin'].includes(body?.actorRole)

    if (!actorIsAdmin) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only a club administrator can finalize this result.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (challenge.status !== 'pending_review' || match.status !== 'pending_review') {
      return {
        data: {
          success: false,

          data: null,

          message: 'This result is not waiting to be finalized.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    if (!match.winnerId || !match.score) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Record the match outcome before finalizing it.',
        },

        status: 422,

        statusText: 'Unprocessable Entity',

        headers: {},

        config,

        request: {},
      }
    }

    const finalizedAt = new Date().toISOString()

    challenge.status = 'completed'

    challenge.confirmedAt = finalizedAt

    challenge.resolvedByAdmin = body?.actorId || null

    challenge.resolutionType = 'admin_result'

    match.status = 'completed'

    match.confirmedAt = finalizedAt

    match.resolvedByAdmin = body?.actorId || null

    match.resolutionType = 'admin_result'

    updateRankingsForResult(match)

    saveLadderState()

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

  /*
    |--------------------------------------------------------------------------
    | DECLINE CHALLENGE
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/decline$/)) {
    const challengeId = path.split('/')[2]

    const challengeIndex = mockDatabase.challenges.findIndex((item) => item.id === challengeId)

    if (challengeIndex === -1) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Challenge not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    const challenge = mockDatabase.challenges[challengeIndex]

    if (body?.actorId !== challenge.defenderId) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only the challenged player can decline this challenge.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (challenge.status !== 'awaiting') {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only an unanswered challenge can be declined.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    challenge.status = 'declined'

    challenge.declinedAt = new Date().toISOString()

    saveLadderState()

    return {
      data: buildResponse(buildChallengeResponse(challenge)),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | WITHDRAW CHALLENGE
    |--------------------------------------------------------------------------
    */

  if (method === 'post' && path.match(/^\/challenges\/[^/]+\/withdraw$/)) {
    const challengeId = path.split('/')[2]

    const challenge = mockDatabase.challenges.find((item) => item.id === challengeId)

    if (!challenge) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Challenge not found',
        },

        status: 404,

        statusText: 'Not Found',

        headers: {},

        config,

        request: {},
      }
    }

    if (body?.actorId !== challenge.challengerId) {
      return {
        data: {
          success: false,

          data: null,

          message: 'Only the challenger can withdraw this challenge.',
        },

        status: 403,

        statusText: 'Forbidden',

        headers: {},

        config,

        request: {},
      }
    }

    if (!['awaiting', 'accepted', 'scheduled'].includes(challenge.status)) {
      return {
        data: {
          success: false,

          data: null,

          message: 'This challenge can no longer be withdrawn.',
        },

        status: 409,

        statusText: 'Conflict',

        headers: {},

        config,

        request: {},
      }
    }

    challenge.status = 'cancelled'

    challenge.cancelledAt = new Date().toISOString()

    const cancelledMatch = mockDatabase.matches.find((item) => item.challengeId === challenge.id)

    if (cancelledMatch) {
      cancelledMatch.status = 'cancelled'

      cancelledMatch.cancelledAt = challenge.cancelledAt
    }

    saveLadderState()

    return {
      data: buildResponse(buildChallengeResponse(challenge)),

      status: 200,

      statusText: 'OK',

      headers: {},

      config,

      request: {},
    }
  }

  /*
    |--------------------------------------------------------------------------
    | FALLBACK
    |--------------------------------------------------------------------------
    */

  return {
    data: {
      success: false,

      data: null,

      message: 'Route not implemented',
    },

    status: 400,

    statusText: 'Bad Request',

    headers: {},

    config,

    request: {},
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  adapter: mockAdapter,
})

export default api
