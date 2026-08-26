import {
  LIVE_SCOREBOARD_SCHEMA_VERSION,
  LIVE_SCOREBOARD_SNAPSHOT_KIND,
} from './liveScoreboardSnapshot'

export const LIVE_OPERATIONS_SCHEMA_VERSION = 1

export const LIVE_OPERATIONS_MATCH_KIND = 'gorra.live-operations-match'

function cleanText(value, fallback = '', maxLength = 120) {
  return String(value ?? fallback)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

function safeNonNegativeNumber(value) {
  return Math.max(0, safeNumber(value))
}

function validPublicScoreboard(scoreboard) {
  return Boolean(
    scoreboard &&
    scoreboard.kind === LIVE_SCOREBOARD_SNAPSHOT_KIND &&
    scoreboard.schemaVersion === LIVE_SCOREBOARD_SCHEMA_VERSION &&
    scoreboard.matchId,
  )
}

export function isLiveOperationsSnapshot(value) {
  if (!value || typeof value !== 'object') {
    return false
  }

  if (value.kind !== LIVE_OPERATIONS_MATCH_KIND) {
    return false
  }

  if (value.schemaVersion !== LIVE_OPERATIONS_SCHEMA_VERSION) {
    return false
  }

  if (!cleanText(value.matchId) || !cleanText(value.clubId)) {
    return false
  }

  return ['live', 'finished', 'completed'].includes(value.status)
}

/*
 * AUTHORITATIVE MATCH
 * → PRIVATE OPERATIONS PROJECTION
 *
 * This is still read-only.
 *
 * It cannot mutate tennis state or award authority.
 */
export function createLiveOperationsSnapshot({
  scoreboard,
  draft,
  scorerName = '',
  displayConnected = null,
  eventType = '',
}) {
  if (!draft || !validPublicScoreboard(scoreboard)) {
    return null
  }

  const matchId = cleanText(scoreboard.matchId)

  const clubId = cleanText(draft.clubId)

  /*
   * Operations are club-scoped.
   *
   * An unbound development match may still
   * have a public scoreboard, but it does
   * not belong in Club Operations.
   */
  if (!matchId || !clubId) {
    return null
  }

  return {
    kind: LIVE_OPERATIONS_MATCH_KIND,

    schemaVersion: LIVE_OPERATIONS_SCHEMA_VERSION,

    matchId,

    clubId,

    matchType: cleanText(scoreboard.matchType, 'friendly', 30),

    status: ['live', 'finished', 'completed'].includes(scoreboard.status)
      ? scoreboard.status
      : 'live',

    /*
     * Tennis-state ordering.
     */
    revision: safeNonNegativeNumber(scoreboard.revision),

    /*
     * Authority-state ordering.
     *
     * This remains separate from the
     * tennis scoring revision.
     */
    authorityRevision: safeNonNegativeNumber(draft.scorerRevision),

    eventType: cleanText(eventType || scoreboard.event?.type, 'sync', 30),

    startedAt: scoreboard.startedAt || null,

    updatedAt: scoreboard.updatedAt || null,

    court: cleanText(draft.schedule?.court, '', 80),

    players: {
      playerA: {
        name: cleanText(scoreboard.players?.playerA?.name, 'Player 1', 100),
      },

      playerB: {
        name: cleanText(scoreboard.players?.playerB?.name, 'Player 2', 100),
      },
    },

    /*
     * Lightweight score only.
     *
     * Do not copy the tennis engine or
     * undo history into Operations.
     */
    score: {
      points: {
        a: cleanText(scoreboard.score?.points?.a, '', 20),

        b: cleanText(scoreboard.score?.points?.b, '', 20),
      },

      games: {
        a: safeNonNegativeNumber(scoreboard.score?.games?.a),

        b: safeNonNegativeNumber(scoreboard.score?.games?.b),
      },

      sets: {
        a: safeNonNegativeNumber(scoreboard.score?.sets?.a),

        b: safeNonNegativeNumber(scoreboard.score?.sets?.b),
      },

      currentSetNumber: Math.max(1, safeNonNegativeNumber(scoreboard.score?.currentSetNumber)),
    },

    server: ['playerA', 'playerB'].includes(scoreboard.server) ? scoreboard.server : null,

    ownerId: cleanText(draft.ownerId),

    scorerId: cleanText(draft.scorerId),

    scorerName: cleanText(scorerName, 'Assigned scorer', 100),

    display: {
      /*
       * null means:
       * "this publisher does not currently
       * know display state."
       *
       * Better than lying with false.
       */
      connected: typeof displayConnected === 'boolean' ? displayConnected : null,
    },
  }
}
