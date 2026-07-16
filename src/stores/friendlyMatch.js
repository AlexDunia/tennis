import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const RESULT_STORAGE_KEY = 'gorra.friendlyMatchResults.v1'

export const CLUB_OPPONENTS = Object.freeze([
  { id: 'club-farah-a', name: 'Farah A.', rank: 3, division: 'Open Division' },
  { id: 'club-david-o', name: 'David O.', rank: 4, division: 'Open Division' },
  { id: 'club-tunde-k', name: 'Tunde K.', rank: 5, division: 'Open Division' },
  { id: 'friendly-sam-t', name: 'Sam T.', rank: 7, division: 'Open Division' },
  { id: 'friendly-maya-o', name: 'Maya O.', rank: 8, division: 'Open Division' },
  { id: 'friendly-chris-a', name: 'Chris A.', rank: null, division: 'Club Member' },
  { id: 'friendly-jordan-k', name: 'Jordan K.', rank: null, division: 'Club Member' },
])

export const CURRENT_LADDER_RANK = 6
export const LADDER_ELIGIBLE_OPPONENTS = Object.freeze(
  CLUB_OPPONENTS.filter(
    (player) => player.rank && player.rank < CURRENT_LADDER_RANK && CURRENT_LADDER_RANK - player.rank <= 3,
  ),
)

function createDraft() {
  return {
    matchType: '',
    opponent: null,
    format: '',
    pointsA: 0,
    pointsB: 0,
    pointHistory: [],
    over: false,
    winner: '',
  }
}

function readResults() {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(RESULT_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export const useFriendlyMatchStore = defineStore('friendlyMatch', () => {
  const draft = ref(createDraft())
  const results = ref(readResults())

  const formatLabel = computed(() => (draft.value.format === 'noad' ? 'No-Ad' : 'Advantage'))
  const matchTypeLabel = computed(() => (draft.value.matchType === 'ladder' ? 'Ladder challenge' : 'Friendly match'))
  const canUndo = computed(() => draft.value.pointHistory.length > 0)

  const statusText = computed(() => {
    const { pointsA, pointsB, format, over, winner } = draft.value
    const opponentName = draft.value.opponent?.name || 'Opponent'
    if (over) return winner === 'you' ? 'You win the game' : `${opponentName} wins the game`

    if (pointsA >= 3 && pointsB >= 3) {
      if (format === 'noad' && pointsA === pointsB) return 'Deciding point'
      if (format === 'ad' && pointsA === pointsB) return 'Deuce'
      if (format === 'ad' && Math.abs(pointsA - pointsB) === 1) {
        return `Advantage — ${pointsA > pointsB ? 'You' : opponentName}`
      }
    }
    return `${pointLabel('you')} – ${pointLabel('opponent')}`
  })

  watch(results, (value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(value))
    }
  }, { deep: true })

  function beginMatch() { draft.value = createDraft() }

  function chooseMatchType(matchType) {
    if (!['friendly', 'ladder'].includes(matchType)) return
    if (draft.value.matchType !== matchType) draft.value.opponent = null
    draft.value.matchType = matchType
  }

  function chooseOpponent(opponent) { draft.value.opponent = opponent ? { ...opponent } : null }

  function chooseFormat(format) {
    draft.value.format = format
    resetScore()
  }

  function pointLabel(side) {
    const ownPoints = side === 'you' ? draft.value.pointsA : draft.value.pointsB
    const otherPoints = side === 'you' ? draft.value.pointsB : draft.value.pointsA
    if (draft.value.over) return draft.value.winner === side ? 'Won' : 'Game'
    if (draft.value.format === 'ad' && ownPoints >= 3 && otherPoints >= 3) {
      if (ownPoints === otherPoints) return '40'
      if (ownPoints === otherPoints + 1) return 'Ad'
      if (otherPoints === ownPoints + 1) return '40'
    }
    return ['Love', '15', '30', '40'][Math.min(ownPoints, 3)]
  }

  function recordPoint(side) {
    if (draft.value.over || !['you', 'opponent'].includes(side)) return
    draft.value.pointHistory.push({
      pointsA: draft.value.pointsA,
      pointsB: draft.value.pointsB,
      over: draft.value.over,
      winner: draft.value.winner,
    })

    if (side === 'you') draft.value.pointsA += 1
    else draft.value.pointsB += 1

    const ownPoints = side === 'you' ? draft.value.pointsA : draft.value.pointsB
    const otherPoints = side === 'you' ? draft.value.pointsB : draft.value.pointsA
    const margin = draft.value.format === 'noad' ? 1 : 2
    if (ownPoints >= 4 && ownPoints - otherPoints >= margin) {
      draft.value.over = true
      draft.value.winner = side
    }
  }

  function undoPoint() {
    const previous = draft.value.pointHistory.pop()
    if (!previous) return
    draft.value.pointsA = previous.pointsA
    draft.value.pointsB = previous.pointsB
    draft.value.over = previous.over
    draft.value.winner = previous.winner
  }

  function resetScore() {
    draft.value.pointsA = 0
    draft.value.pointsB = 0
    draft.value.pointHistory = []
    draft.value.over = false
    draft.value.winner = ''
  }

  function endMatch() {
    const opponentName = draft.value.opponent?.name || 'Opponent'
    const yourScore = draft.value.pointsA
    const opponentScore = draft.value.pointsB
    const winnerScore = Math.max(yourScore, opponentScore)
    const loserScore = Math.min(yourScore, opponentScore)
    let summary = `${matchTypeLabel.value} with ${opponentName} ended, ${yourScore}–${opponentScore}`
    if (draft.value.winner === 'you') summary = `You beat ${opponentName}, ${winnerScore}–${loserScore}`
    else if (draft.value.winner === 'opponent') summary = `${opponentName} beat you, ${winnerScore}–${loserScore}`

    const result = {
      id: `match-result-${Date.now()}`,
      opponent: opponentName,
      matchType: draft.value.matchType,
      matchTypeLabel: matchTypeLabel.value,
      format: formatLabel.value,
      pointsA: yourScore,
      pointsB: opponentScore,
      winner: draft.value.winner,
      summary,
      completedAt: new Date().toISOString(),
    }
    results.value = [result, ...results.value]
    draft.value = createDraft()
    return result
  }

  return {
    draft,
    results,
    opponents: CLUB_OPPONENTS,
    ladderOpponents: LADDER_ELIGIBLE_OPPONENTS,
    currentLadderRank: CURRENT_LADDER_RANK,
    formatLabel,
    matchTypeLabel,
    statusText,
    canUndo,
    beginMatch,
    chooseMatchType,
    chooseOpponent,
    chooseFormat,
    pointLabel,
    recordPoint,
    undoPoint,
    endMatch,
  }
})
