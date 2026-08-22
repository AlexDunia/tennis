/*
 * GORRA — LIVE SCOREBOARD SNAPSHOT
 *
 * A scoreboard snapshot is a READ-ONLY projection
 * of authoritative match state.
 *
 * It is NOT:
 *
 * - another scoring model
 * - another match store
 * - an authorization record
 * - an invitation object
 *
 * The future Laravel/realtime backend can produce
 * this same contract without requiring the
 * scoreboard UI to be redesigned.
 */

export const LIVE_SCOREBOARD_SCHEMA_VERSION = 1

export const LIVE_SCOREBOARD_SNAPSHOT_KIND = 'gorra.live-scoreboard'

const MAX_PUBLIC_SETS = 10

function cleanText(value, fallback = '', maxLength = 100) {
  return String(value ?? fallback)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)

  return Number.isFinite(number) ? number : fallback
}

function safeNonNegativeNumber(value) {
  return Math.max(0, safeNumber(value))
}

function safeDateValue(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function safeServer(value) {
  return ['playerA', 'playerB'].includes(value) ? value : null
}

function safeStatus(value) {
  if (['live', 'finished', 'completed'].includes(value)) {
    return value
  }

  return 'live'
}

function playerName(value, fallback) {
  /*
   * liveState.players currently stores names.
   *
   * Completed results may instead contain:
   *
   * { id, name }
   *
   * Support both shapes while exporting ONLY name.
   */
  if (value && typeof value === 'object') {
    return cleanText(value.name, fallback)
  }

  return cleanText(value, fallback)
}

function sanitizeSetScores(setScores) {
  if (!Array.isArray(setScores)) {
    return []
  }

  return setScores.slice(0, MAX_PUBLIC_SETS).map((set) => ({
    a: safeNonNegativeNumber(set?.a),

    b: safeNonNegativeNumber(set?.b),

    isMatchTieBreak: Boolean(set?.isMatchTieBreak),
  }))
}

export function getLiveScoreboardMatchId(draft) {
  /*
   * Prefer the draft's real match identity.
   *
   * Ladder has additional linked IDs, so they are
   * fallback candidates only.
   */
  return cleanText(draft?.id || draft?.matchId || draft?.ladderMatchId || '', '', 120)
}

/*
 * ACTIVE MATCH → PUBLIC SCOREBOARD PROJECTION
 */
export function createLiveScoreboardSnapshot({
  draft,
  playerAPoint = 'Love',
  playerBPoint = 'Love',
  matchFormatLabel = '',
  scoringFormatLabel = '',
}) {
  if (!draft || !draft.liveState) {
    return null
  }

  const matchId = getLiveScoreboardMatchId(draft)

  if (!matchId) {
    return null
  }

  const live = draft.liveState

  const playerAName = playerName(live.players?.playerA, 'Player 1')

  const playerBName = playerName(live.players?.playerB, 'Player 2')

  return {
    kind: LIVE_SCOREBOARD_SNAPSHOT_KIND,

    schemaVersion: LIVE_SCOREBOARD_SCHEMA_VERSION,

    matchId,

    matchType: cleanText(draft.matchType, 'friendly', 20),

    /*
     * Finished here means:
     *
     * the scoring engine has found a winner,
     * but result finalization may still be completing.
     */
    status: safeStatus(draft.over ? 'finished' : draft.status),

    revision: safeNonNegativeNumber(live.revision),

    startedAt: safeDateValue(draft.startedAt),

    updatedAt: safeDateValue(live.updatedAt || draft.updatedAt),

    players: {
      playerA: {
        name: playerAName,
      },

      playerB: {
        name: playerBName,
      },
    },

    score: {
      /*
       * Public display labels.
       *
       * 15 / 30 / 40 / Ad
       * or numeric tie-break values.
       */
      points: {
        a: cleanText(playerAPoint, 'Love', 20),

        b: cleanText(playerBPoint, 'Love', 20),
      },

      games: {
        a: safeNonNegativeNumber(draft.gamesA),

        b: safeNonNegativeNumber(draft.gamesB),
      },

      sets: {
        a: safeNonNegativeNumber(draft.setsA),

        b: safeNonNegativeNumber(draft.setsB),
      },

      setScores: sanitizeSetScores(draft.setScores),

      currentSetNumber: safeNonNegativeNumber(live.currentSetIndex) + 1,
    },

    server: safeServer(live.currentServer),

    game: {
      inTieBreak: Boolean(live.currentGame?.inTieBreak),

      isMatchTieBreak: Boolean(live.currentGame?.isMatchTieBreak),

      standaloneTieBreak: live.config?.mode === 'tiebreak',
    },

    pointsPlayed: safeNonNegativeNumber(live.pointsPlayed),

    display: {
      matchFormat: cleanText(matchFormatLabel, 'Tennis match', 80),

      scoringFormat: cleanText(scoringFormatLabel, '', 40),
    },

    /*
     * winnerSide is presentation information only.
     *
     * We deliberately do NOT expose player IDs.
     */
    winnerSide: draft.over ? cleanText(draft.winner, '', 20) : '',

    finalScore: '',
  }
}

/*
 * COMPLETED RESULT → FINAL SCOREBOARD PROJECTION
 *
 * The completed scoreboard remains displayable after
 * the active draft is destroyed.
 */
export function createCompletedScoreboardSnapshot({ result, matchId = '' }) {
  if (!result || result.status !== 'completed') {
    return null
  }

  const resolvedMatchId = cleanText(matchId || result.matchId || result.id || '', '', 120)

  if (!resolvedMatchId) {
    return null
  }

  const rawPlayerA = result.players?.playerA

  const rawPlayerB = result.players?.playerB

  const playerAName = playerName(rawPlayerA, 'Player 1')

  const playerBName = playerName(rawPlayerB, 'Player 2')

  /*
   * Determine winner before stripping private IDs.
   */
  const playerAId = typeof rawPlayerA === 'object' ? rawPlayerA?.id : result.ownerId

  const playerBId = typeof rawPlayerB === 'object' ? rawPlayerB?.id : result.opponentId

  let winnerSide = ''

  if (result.winnerId && result.winnerId === playerAId) {
    winnerSide = 'you'
  }

  if (result.winnerId && result.winnerId === playerBId) {
    winnerSide = 'opponent'
  }

  return {
    kind: LIVE_SCOREBOARD_SNAPSHOT_KIND,

    schemaVersion: LIVE_SCOREBOARD_SCHEMA_VERSION,

    matchId: resolvedMatchId,

    matchType: cleanText(result.matchType, 'friendly', 20),

    status: 'completed',

    revision: safeNonNegativeNumber(result.liveState?.revision),

    startedAt: safeDateValue(result.startedAt),

    updatedAt: safeDateValue(result.completedAt),

    players: {
      playerA: {
        name: playerAName,
      },

      playerB: {
        name: playerBName,
      },
    },

    score: {
      /*
       * Point score is no longer meaningful once the
       * completed match is terminal.
       */
      points: {
        a: '',
        b: '',
      },

      games: {
        a: 0,
        b: 0,
      },

      sets: {
        a: safeNonNegativeNumber(result.setsA),

        b: safeNonNegativeNumber(result.setsB),
      },

      setScores: sanitizeSetScores(result.setScores),

      currentSetNumber: Math.max(1, sanitizeSetScores(result.setScores).length),
    },

    server: null,

    game: {
      inTieBreak: false,

      isMatchTieBreak: false,

      standaloneTieBreak: false,
    },

    pointsPlayed: safeNonNegativeNumber(result.liveState?.pointsPlayed),

    display: {
      matchFormat: cleanText(result.matchFormatLabel, 'Tennis match', 80),

      scoringFormat: cleanText(
        result.scoringFormat || (result.scoring === 'noad' ? 'No-Ad' : 'Advantage'),
        '',
        40,
      ),
    },

    winnerSide,

    finalScore: cleanText(result.score, '', 120),
  }
}
