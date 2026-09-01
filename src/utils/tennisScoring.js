const POINT_LABELS = Object.freeze(['Love', '15', '30', '40'])
import { MATCH_RULE_LIMITS } from '../domain/matchRules.js'

const PLAYER_KEYS = Object.freeze(['playerA', 'playerB'])
const HISTORY_LIMIT = 40
const SCHEMA_VERSION = 3

function nowIso() {
  return new Date().toISOString()
}

function isPlayerKey(value) {
  return PLAYER_KEYS.includes(value)
}

function opponentOf(playerKey) {
  return playerKey === 'playerA' ? 'playerB' : 'playerA'
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(max, Math.max(min, parsed))
}

/*
 * Live scoring state is deliberately plain serialisable data.
 *
 * Do not put browser APIs, DOM nodes, Vue refs, class instances,
 * functions or other non-serialisable values inside the scoring state.
 *
 * This keeps the state compatible with:
 * - Pinia
 * - localStorage
 * - BroadcastChannel
 * - REST
 * - WebSockets
 * - Laravel JSON payloads
 * - future event/audit storage
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeConfig(input = {}) {
  const source = input?.config && typeof input.config === 'object' ? input.config : input

  const mode = source.mode === 'tiebreak' ? 'tiebreak' : 'sets'

  const scoring = source.scoring === 'noad' ? 'noad' : 'ad'
  const gameMode = source.gameMode === 'numeric' ? 'numeric' : 'traditional'

  /*
   * A standalone match tie-break has no normal games or sets.
   *
   * Example:
   * First to 10, win by two.
   */
  if (mode === 'tiebreak') {
    return {
      mode: 'tiebreak',
      scoring,
      gameMode,
      setsToWin: 1,
      bestOfSets: 1,
      gamesPerSet: 0,
      setWinBy: 2,
      tieBreakBehavior: 'continue',
      tieBreakAt: 0,
      tieBreakPoints: clampInteger(
        source.tieBreakPoints,
        MATCH_RULE_LIMITS.tieBreakPointsToWin.min,
        MATCH_RULE_LIMITS.tieBreakPointsToWin.max,
        10,
      ),
      tieBreakWinBy: clampInteger(
        source.tieBreakWinBy,
        MATCH_RULE_LIMITS.tieBreakWinBy.min,
        MATCH_RULE_LIMITS.tieBreakWinBy.max,
        2,
      ),
      numericGamePoints: clampInteger(
        source.numericGamePoints,
        MATCH_RULE_LIMITS.numericGamePointsToWin.min,
        MATCH_RULE_LIMITS.numericGamePointsToWin.max,
        4,
      ),
      numericGameWinBy: clampInteger(
        source.numericGameWinBy,
        MATCH_RULE_LIMITS.numericGameWinBy.min,
        MATCH_RULE_LIMITS.numericGameWinBy.max,
        2,
      ),
      decidingMatchTieBreak: false,
      decidingTieBreakPoints: clampInteger(
        source.decidingTieBreakPoints,
        MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin.min,
        MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin.max,
        10,
      ),
      decidingTieBreakWinBy: clampInteger(
        source.decidingTieBreakWinBy,
        MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy.min,
        MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy.max,
        2,
      ),
    }
  }

  const explicitBestOf = clampInteger(
    source.bestOfSets,
    1,
    MATCH_RULE_LIMITS.setsToWin.max * 2 - 1,
    0,
  )

  const setsToWin = clampInteger(
    source.setsToWin,
    MATCH_RULE_LIMITS.setsToWin.min,
    MATCH_RULE_LIMITS.setsToWin.max,
    explicitBestOf ? Math.ceil(explicitBestOf / 2) : 2,
  )

  const bestOfSets = explicitBestOf || setsToWin * 2 - 1

  const gamesPerSet = clampInteger(
    source.gamesPerSet,
    MATCH_RULE_LIMITS.gamesToWin.min,
    MATCH_RULE_LIMITS.gamesToWin.max,
    6,
  )
  const legacyTieBreakAt = Number.parseInt(source.tieBreakAt, 10)
  const tieBreakBehavior =
    source.tieBreakBehavior === 'continue' ||
    (source.tieBreakBehavior === undefined &&
      Number.isFinite(legacyTieBreakAt) &&
      legacyTieBreakAt <= 0)
      ? 'continue'
      : 'tiebreak'

  return {
    mode: 'sets',
    scoring,
    gameMode,
    setsToWin,
    bestOfSets,
    gamesPerSet,
    setWinBy: clampInteger(
      source.setWinBy,
      MATCH_RULE_LIMITS.setWinBy.min,
      MATCH_RULE_LIMITS.setWinBy.max,
      2,
    ),
    tieBreakBehavior,
    tieBreakAt:
      tieBreakBehavior === 'tiebreak'
        ? clampInteger(source.tieBreakAt, 1, gamesPerSet, gamesPerSet)
        : 0,
    tieBreakPoints: clampInteger(
      source.tieBreakPoints,
      MATCH_RULE_LIMITS.tieBreakPointsToWin.min,
      MATCH_RULE_LIMITS.tieBreakPointsToWin.max,
      7,
    ),
    tieBreakWinBy: clampInteger(
      source.tieBreakWinBy,
      MATCH_RULE_LIMITS.tieBreakWinBy.min,
      MATCH_RULE_LIMITS.tieBreakWinBy.max,
      2,
    ),
    numericGamePoints: clampInteger(
      source.numericGamePoints,
      MATCH_RULE_LIMITS.numericGamePointsToWin.min,
      MATCH_RULE_LIMITS.numericGamePointsToWin.max,
      4,
    ),
    numericGameWinBy: clampInteger(
      source.numericGameWinBy,
      MATCH_RULE_LIMITS.numericGameWinBy.min,
      MATCH_RULE_LIMITS.numericGameWinBy.max,
      2,
    ),
    decidingMatchTieBreak: Boolean(source.decidingMatchTieBreak),
    decidingTieBreakPoints: clampInteger(
      source.decidingTieBreakPoints,
      MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin.min,
      MATCH_RULE_LIMITS.decidingMatchTieBreakPointsToWin.max,
      10,
    ),
    decidingTieBreakWinBy: clampInteger(
      source.decidingTieBreakWinBy,
      MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy.min,
      MATCH_RULE_LIMITS.decidingMatchTieBreakWinBy.max,
      2,
    ),
  }
}

function createSetState() {
  return {
    games: {
      playerA: 0,
      playerB: 0,
    },

    winner: null,

    /*
     * Populated only when this set ended through
     * a tie-break.
     */
    tieBreak: null,

    /*
     * True when this "set" is actually a deciding
     * match tie-break such as the Ladder time-smart
     * decider.
     */
    isMatchTieBreak: false,
  }
}

function createGameState(options = {}) {
  return {
    /*
     * Raw point counts.
     *
     * We store numbers internally instead of
     * "15", "30", "40", "AD".
     *
     * Presentation is derived using describePoint().
     */
    points: {
      playerA: 0,
      playerB: 0,
    },

    advantage: null,

    inTieBreak: Boolean(options.inTieBreak),

    isMatchTieBreak: Boolean(options.isMatchTieBreak),

    tieBreakPoints: {
      playerA: 0,
      playerB: 0,
    },

    /*
     * Tennis tie-break service rotation depends on
     * who served the first point of the tie-break.
     */
    tieBreakInitialServer: options.tieBreakInitialServer || null,
  }
}

function snapshotForHistory(scoreboard) {
  const snapshot = clone(scoreboard)

  /*
   * Never recursively copy the entire history
   * into every history entry.
   */
  snapshot.history = []

  return snapshot
}

function pushHistory(scoreboard) {
  const entry = snapshotForHistory(scoreboard)

  scoreboard.history = [
    ...(Array.isArray(scoreboard.history) ? scoreboard.history : []),
    entry,
  ].slice(-HISTORY_LIMIT)
}

function markAction(scoreboard, action) {
  scoreboard.revision = Math.max(0, Number(scoreboard.revision) || 0) + 1

  scoreboard.updatedAt = nowIso()

  scoreboard.lastAction = {
    ...action,
    revision: scoreboard.revision,
    at: scoreboard.updatedAt,
  }
}

function setMatchFinished(scoreboard, playerKey, outcome = 'match') {
  scoreboard.matchWinner = playerKey
  scoreboard.status = 'finished'

  scoreboard.completedAt = scoreboard.completedAt || nowIso()

  return outcome
}

function calculateSetWins(scoreboard, playerKey) {
  return scoreboard.completedSets.filter((set) => set.winner === playerKey).length
}

function ensureSetCapacity(scoreboard, index) {
  while (scoreboard.sets.length <= index) {
    scoreboard.sets.push(createSetState())
  }
}

function shouldUseDecidingMatchTieBreak(scoreboard) {
  if (!scoreboard.config.decidingMatchTieBreak) {
    return false
  }

  if (scoreboard.config.mode !== 'sets') {
    return false
  }

  const winsNeededBeforeDecider = scoreboard.config.setsToWin - 1

  if (winsNeededBeforeDecider < 1) {
    return false
  }

  /*
   * Example:
   *
   * Best of 3:
   * playerA = 1 set
   * playerB = 1 set
   *
   * Instead of playing a normal third set,
   * start the configured deciding match tie-break.
   */
  return PLAYER_KEYS.every(
    (playerKey) => calculateSetWins(scoreboard, playerKey) === winsNeededBeforeDecider,
  )
}

function startTieBreak(scoreboard, { isMatchTieBreak = false } = {}) {
  const initialServer = scoreboard.currentServer || 'playerA'

  scoreboard.currentGame = createGameState({
    inTieBreak: true,
    isMatchTieBreak,
    tieBreakInitialServer: initialServer,
  })

  ensureSetCapacity(scoreboard, scoreboard.currentSetIndex)

  scoreboard.sets[scoreboard.currentSetIndex].isMatchTieBreak = isMatchTieBreak
}

/*
 * Official tie-break service pattern:
 *
 * Point 1:
 * Initial server
 *
 * Points 2–3:
 * Opponent
 *
 * Points 4–5:
 * Initial server
 *
 * Points 6–7:
 * Opponent
 *
 * Then continue in blocks of two.
 */
function serverForTieBreakPoint(initialServer, pointNumber) {
  const safeInitial = isPlayerKey(initialServer) ? initialServer : 'playerA'

  if (pointNumber <= 1) {
    return safeInitial
  }

  const blockIndex = Math.floor((pointNumber - 2) / 2)

  return blockIndex % 2 === 0 ? opponentOf(safeInitial) : safeInitial
}

function updateTieBreakServerForNextPoint(scoreboard) {
  const game = scoreboard.currentGame

  const totalPoints = game.tieBreakPoints.playerA + game.tieBreakPoints.playerB

  const nextPointNumber = totalPoints + 1

  scoreboard.currentServer = serverForTieBreakPoint(
    game.tieBreakInitialServer || scoreboard.currentServer,
    nextPointNumber,
  )
}

function finalizeSet(scoreboard, playerKey, { tieBreak = null, isMatchTieBreak = false } = {}) {
  ensureSetCapacity(scoreboard, scoreboard.currentSetIndex)

  const set = scoreboard.sets[scoreboard.currentSetIndex]

  set.winner = playerKey

  set.tieBreak = tieBreak ? clone(tieBreak) : null

  set.isMatchTieBreak = Boolean(isMatchTieBreak)

  scoreboard.completedSets = [
    ...scoreboard.completedSets,
    {
      winner: playerKey,

      games: {
        ...set.games,
      },

      tieBreak: set.tieBreak ? clone(set.tieBreak) : null,

      isMatchTieBreak: set.isMatchTieBreak,
    },
  ]

  if (calculateSetWins(scoreboard, playerKey) >= scoreboard.config.setsToWin) {
    setMatchFinished(scoreboard, playerKey)

    return 'match'
  }

  scoreboard.currentSetIndex += 1

  ensureSetCapacity(scoreboard, scoreboard.currentSetIndex)

  if (shouldUseDecidingMatchTieBreak(scoreboard)) {
    startTieBreak(scoreboard, {
      isMatchTieBreak: true,
    })

    return 'set'
  }

  scoreboard.currentGame = createGameState()

  return 'set'
}

function awardGame(scoreboard, playerKey) {
  const set = scoreboard.sets[scoreboard.currentSetIndex]

  if (!set || set.winner) {
    return 'point'
  }

  set.games[playerKey] += 1

  /*
   * The server changes after a normal game.
   *
   * This is intentionally independent of
   * who won the game.
   */
  scoreboard.currentServer = opponentOf(scoreboard.currentServer || 'playerA')

  scoreboard.currentGame = createGameState()

  const opponentKey = opponentOf(playerKey)

  const playerGames = set.games[playerKey]

  const opponentGames = set.games[opponentKey]

  const { gamesPerSet, setWinBy, tieBreakAt, tieBreakBehavior } = scoreboard.config

  /*
   * Examples:
   * 6–0
   * 6–4
   * 7–5
   */
  if (playerGames >= gamesPerSet && playerGames - opponentGames >= setWinBy) {
    return finalizeSet(scoreboard, playerKey)
  }

  /*
   * Standard example:
   * 6–6 begins a tie-break.
   *
   * Because currentServer was already rotated
   * after the completed game, it now correctly
   * represents the person who serves the first
   * tie-break point.
   */
  if (
    tieBreakBehavior === 'tiebreak' &&
    tieBreakAt > 0 &&
    set.games.playerA === tieBreakAt &&
    set.games.playerB === tieBreakAt
  ) {
    startTieBreak(scoreboard)
  }

  return 'game'
}

function recordStandardPoint(scoreboard, playerKey) {
  const opponentKey = opponentOf(playerKey)

  const game = scoreboard.currentGame

  game.points[playerKey] += 1

  const playerPoints = game.points[playerKey]

  const opponentPoints = game.points[opponentKey]

  /*
   * NO-AD
   *
   * First player to win the fourth point
   * wins the game.
   *
   * Therefore:
   *
   * 40–30 → next point can win game
   * 40–40 → next point is deciding point
   */
  if (scoreboard.config.scoring === 'noad') {
    game.advantage = null

    if (playerPoints >= 4) {
      return awardGame(scoreboard, playerKey)
    }

    return 'point'
  }

  /*
   * ADVANTAGE
   *
   * A game is won when the player has at
   * least four points and leads by two.
   */
  if (playerPoints >= 4 && playerPoints - opponentPoints >= 2) {
    return awardGame(scoreboard, playerKey)
  }

  /*
   * Keep the convenience `advantage` field
   * for existing UI components and future
   * presentation logic.
   */
  if (game.points.playerA >= 3 && game.points.playerB >= 3) {
    if (game.points.playerA === game.points.playerB) {
      game.advantage = null
    } else if (Math.abs(game.points.playerA - game.points.playerB) === 1) {
      game.advantage = game.points.playerA > game.points.playerB ? 'playerA' : 'playerB'
    }
  } else {
    game.advantage = null
  }

  return 'point'
}

function recordNumericPoint(scoreboard, playerKey) {
  const opponentKey = opponentOf(playerKey)
  const game = scoreboard.currentGame

  game.advantage = null
  game.points[playerKey] += 1

  const playerPoints = game.points[playerKey]
  const opponentPoints = game.points[opponentKey]

  if (
    playerPoints >= scoreboard.config.numericGamePoints &&
    playerPoints - opponentPoints >= scoreboard.config.numericGameWinBy
  ) {
    return awardGame(scoreboard, playerKey)
  }

  return 'point'
}

function recordTieBreakPoint(scoreboard, playerKey) {
  const game = scoreboard.currentGame

  const opponentKey = opponentOf(playerKey)

  game.tieBreakPoints[playerKey] += 1

  /*
   * Standalone match tie-break:
   * use tieBreakPoints.
   *
   * Deciding match tie-break inside a
   * sets match:
   * use decidingTieBreakPoints.
   */
  const target =
    scoreboard.config.mode === 'tiebreak'
      ? scoreboard.config.tieBreakPoints
      : game.isMatchTieBreak
        ? scoreboard.config.decidingTieBreakPoints
        : scoreboard.config.tieBreakPoints

  const playerPoints = game.tieBreakPoints[playerKey]

  const opponentPoints = game.tieBreakPoints[opponentKey]

  const winBy =
    scoreboard.config.mode === 'tiebreak'
      ? scoreboard.config.tieBreakWinBy
      : game.isMatchTieBreak
        ? scoreboard.config.decidingTieBreakWinBy
        : scoreboard.config.tieBreakWinBy

  if (playerPoints >= target && playerPoints - opponentPoints >= winBy) {
    const tieBreak = {
      winner: playerKey,

      score: {
        ...game.tieBreakPoints,
      },

      initialServer: game.tieBreakInitialServer,
    }

    /*
     * Entire match is one tie-break.
     */
    if (scoreboard.config.mode === 'tiebreak') {
      const set = scoreboard.sets[scoreboard.currentSetIndex]

      set.tieBreak = clone(tieBreak)

      set.winner = playerKey

      set.isMatchTieBreak = true

      scoreboard.completedSets = [
        {
          winner: playerKey,

          games: {
            playerA: 0,
            playerB: 0,
          },

          tieBreak: clone(tieBreak),

          isMatchTieBreak: true,
        },
      ]

      setMatchFinished(scoreboard, playerKey)

      return 'match'
    }

    const set = scoreboard.sets[scoreboard.currentSetIndex]

    /*
     * Deciding 10-point match tie-break.
     */
    if (game.isMatchTieBreak) {
      /*
       * The player who served first in a tie-break
       * receives first in the next set.
       *
       * A next normal set normally does not follow
       * a deciding match tie-break, but keeping the
       * server correct gives us a complete state.
       */
      scoreboard.currentServer = opponentOf(game.tieBreakInitialServer || scoreboard.currentServer)

      return finalizeSet(scoreboard, playerKey, {
        tieBreak,
        isMatchTieBreak: true,
      })
    }

    /*
     * Standard set tie-break:
     *
     * Example:
     * 6–6 → 7–6.
     */
    set.games[playerKey] += 1

    scoreboard.currentServer = opponentOf(game.tieBreakInitialServer || scoreboard.currentServer)

    return finalizeSet(scoreboard, playerKey, {
      tieBreak,
    })
  }

  /*
   * Prepare service state for the NEXT
   * tie-break point.
   */
  updateTieBreakServerForNextPoint(scoreboard)

  return 'point'
}

function createInitialScoreboard(players, config, options = {}) {
  const setCount = config.mode === 'sets' ? config.bestOfSets : 1

  const scoreboard = {
    schemaVersion: SCHEMA_VERSION,

    players: {
      playerA: players.playerA || 'Player 1',

      playerB: players.playerB || 'Player 2',
    },

    config,

    /*
     * Preserve this legacy top-level field because
     * TennisScoreboard.vue currently reads it.
     */
    bestOfSets: config.bestOfSets,

    sets: Array.from(
      {
        length: setCount,
      },
      createSetState,
    ),

    currentSetIndex: 0,

    currentGame: createGameState(),

    completedSets: [],

    matchWinner: null,

    status: options.status || 'live',

    currentServer: isPlayerKey(options.currentServer) ? options.currentServer : 'playerA',

    startedAt: options.startedAt || null,

    completedAt: null,

    pointClockStartedAt: options.pointClockStartedAt || null,

    /*
     * Monotonic version number.
     *
     * Later the Laravel backend will use a
     * server-authoritative version for stale-write
     * protection/idempotency.
     */
    revision: 0,

    updatedAt: options.updatedAt || null,

    /*
     * Describes the last successful state change.
     *
     * UI, animation and voice may REACT to this.
     * They must never own scoring logic themselves.
     */
    lastAction: null,

    /*
     * Bounded local undo history.
     *
     * Production audit history will eventually
     * live server-side and is conceptually
     * different from this client undo buffer.
     */
    history: [],

    pointsPlayed: 0,
  }

  if (config.mode === 'tiebreak') {
    startTieBreak(scoreboard, {
      isMatchTieBreak: true,
    })
  }

  return scoreboard
}

/*
 * BACKWARD COMPATIBILITY
 * ----------------------
 *
 * Existing code can continue doing:
 *
 * createScoreboard(
 *   'Player A',
 *   'Player B',
 *   3
 * )
 *
 * New code can do:
 *
 * createScoreboard({
 *   players: {
 *     playerA: 'Henry',
 *     playerB: 'James',
 *   },
 *   scoring: 'noad',
 *   setsToWin: 2,
 *   gamesPerSet: 6,
 *   tieBreakAt: 6,
 *   tieBreakPoints: 7,
 * })
 */
export function createScoreboard(playerA = 'Server', playerB = 'Returner', options = 3) {
  /*
   * New object-based API.
   */
  if (playerA && typeof playerA === 'object' && !Array.isArray(playerA)) {
    const input = playerA

    const players = {
      playerA: input.players?.playerA || input.playerA || 'Player 1',

      playerB: input.players?.playerB || input.playerB || 'Player 2',
    }

    const config = normalizeConfig(input.config || input)

    return createInitialScoreboard(players, config, input)
  }

  /*
   * Existing API.
   */
  const configInput =
    typeof options === 'number'
      ? {
          mode: 'sets',
          bestOfSets: options,
          setsToWin: Math.ceil(options / 2),
        }
      : options || {}

  return createInitialScoreboard(
    {
      playerA: String(playerA || 'Player 1'),

      playerB: String(playerB || 'Player 2'),
    },

    normalizeConfig(configInput),

    typeof options === 'object' && options ? options : {},
  )
}

/*
 * Safely upgrades an older stored scoreboard into
 * the current schema.
 *
 * This is important because users may refresh while
 * a match is active and because localStorage may
 * contain state created before this engine version.
 */
export function normalizeScoreboard(input, fallback = {}) {
  if (!input || typeof input !== 'object') {
    return createScoreboard(fallback)
  }

  const config = normalizeConfig({
    ...(fallback.config || fallback || {}),

    ...(input.config || {}),

    bestOfSets: input.config?.bestOfSets ?? input.bestOfSets ?? fallback.bestOfSets,
  })

  const base = createInitialScoreboard(
    {
      playerA: input.players?.playerA || fallback.players?.playerA || 'Player 1',

      playerB: input.players?.playerB || fallback.players?.playerB || 'Player 2',
    },

    config,

    {
      currentServer: input.currentServer || fallback.currentServer,

      status: input.status || fallback.status || 'live',

      startedAt: input.startedAt || fallback.startedAt || null,

      pointClockStartedAt: input.pointClockStartedAt || fallback.pointClockStartedAt || null,

      updatedAt: input.updatedAt || fallback.updatedAt || null,
    },
  )

  const normalized = {
    ...base,

    ...clone(input),

    schemaVersion: SCHEMA_VERSION,

    config,

    bestOfSets: config.bestOfSets,

    players: {
      ...base.players,
      ...(input.players || {}),
    },

    sets: Array.isArray(input.sets) && input.sets.length ? clone(input.sets) : base.sets,

    currentGame: {
      ...base.currentGame,
      ...(input.currentGame || {}),

      points: {
        ...base.currentGame.points,

        ...(input.currentGame?.points || {}),
      },

      tieBreakPoints: {
        ...base.currentGame.tieBreakPoints,

        ...(input.currentGame?.tieBreakPoints || {}),
      },
    },

    completedSets: Array.isArray(input.completedSets) ? clone(input.completedSets) : [],

    history: Array.isArray(input.history) ? clone(input.history).slice(-HISTORY_LIMIT) : [],

    revision: Math.max(0, Number(input.revision) || 0),

    pointsPlayed: Math.max(0, Number(input.pointsPlayed) || 0),
  }

  ensureSetCapacity(normalized, normalized.currentSetIndex || 0)

  if (normalized.currentGame.inTieBreak && !normalized.currentGame.tieBreakInitialServer) {
    normalized.currentGame.tieBreakInitialServer = normalized.currentServer || 'playerA'
  }

  return normalized
}

/*
 * THE AUTHORITATIVE SCORING ACTION
 * --------------------------------
 *
 * Every scoring UI eventually calls this.
 *
 * Friendly Match
 * Ladder
 * Challenge
 * Tournament
 * Match Control
 *
 * should NOT implement their own tennis arithmetic.
 */
export function recordPoint(originalScoreboard, playerKey) {
  const scoreboard = normalizeScoreboard(originalScoreboard)

  if (!isPlayerKey(playerKey)) {
    return scoreboard
  }

  if (scoreboard.matchWinner || scoreboard.status === 'finished') {
    return scoreboard
  }

  const set = scoreboard.sets[scoreboard.currentSetIndex]

  if (!set || set.winner) {
    return scoreboard
  }

  /*
   * Snapshot BEFORE the action.
   */
  pushHistory(scoreboard)

  const outcome = scoreboard.currentGame.inTieBreak
    ? recordTieBreakPoint(scoreboard, playerKey)
    : scoreboard.config.gameMode === 'numeric'
      ? recordNumericPoint(scoreboard, playerKey)
      : recordStandardPoint(scoreboard, playerKey)

  scoreboard.pointsPlayed += 1

  scoreboard.pointClockStartedAt = nowIso()

  markAction(scoreboard, {
    type: 'point',
    playerKey,
    outcome,
  })

  return scoreboard
}

/*
 * Undo restores the entire pre-point state:
 *
 * - points
 * - games
 * - sets
 * - tie-break
 * - server
 * - match completion
 * - winner
 *
 * Revision does NOT move backwards.
 */
export function undoLastPoint(originalScoreboard) {
  const scoreboard = normalizeScoreboard(originalScoreboard)

  if (!scoreboard.history.length) {
    return scoreboard
  }

  const revisionBeforeUndo = scoreboard.revision

  const previous = scoreboard.history[scoreboard.history.length - 1]

  const remainingHistory = scoreboard.history.slice(0, -1)

  const restored = normalizeScoreboard(previous)

  restored.history = remainingHistory

  /*
   * Never reuse an old revision number.
   */
  restored.revision = revisionBeforeUndo + 1

  restored.updatedAt = nowIso()

  restored.lastAction = {
    type: 'undo',

    revision: restored.revision,

    at: restored.updatedAt,
  }

  return restored
}

/*
 * Server corrections are deliberately explicit.
 *
 * A scorer may need to correct the server if
 * the original selection was wrong.
 */
export function setServer(originalScoreboard, playerKey) {
  const scoreboard = normalizeScoreboard(originalScoreboard)

  if (!isPlayerKey(playerKey) || scoreboard.matchWinner) {
    return scoreboard
  }

  if (scoreboard.currentServer === playerKey) {
    return scoreboard
  }

  scoreboard.currentServer = playerKey

  /*
   * During a tie-break the service sequence is
   * derived from the initial tie-break server.
   */
  if (scoreboard.currentGame.inTieBreak) {
    scoreboard.currentGame.tieBreakInitialServer = playerKey

    updateTieBreakServerForNextPoint(scoreboard)
  }

  markAction(scoreboard, {
    type: 'server-correction',
    playerKey,
  })

  return scoreboard
}

export function toggleServer(originalScoreboard) {
  const scoreboard = normalizeScoreboard(originalScoreboard)

  return setServer(scoreboard, opponentOf(scoreboard.currentServer || 'playerA'))
}

/*
 * Compatibility-sensitive presentation helper.
 *
 * Existing TennisScoreboard.vue expects BOTH sides
 * to read "Deuce" at a tied Advantage deuce.
 *
 * Keep that behaviour.
 */
export function describePoint(scoreboardInput, playerKey) {
  const scoreboard = normalizeScoreboard(scoreboardInput)

  if (!isPlayerKey(playerKey)) {
    return ''
  }

  const opponentKey = opponentOf(playerKey)

  const game = scoreboard.currentGame

  if (game.inTieBreak) {
    return String(game.tieBreakPoints[playerKey] || 0)
  }

  const own = Number(game.points[playerKey] || 0)

  const other = Number(game.points[opponentKey] || 0)

  /*
   * Numeric games store and display raw points.
   * UI labels remain derived and never drive scoring.
   */
  if (scoreboard.config.gameMode === 'numeric') {
    return String(own)
  }

  /*
   * No-Ad has no Advantage state.
   */
  if (scoreboard.config.scoring === 'noad') {
    return POINT_LABELS[Math.min(own, 3)] || '40'
  }

  if (own >= 3 && other >= 3) {
    if (own === other) {
      return 'Deuce'
    }

    if (own - other === 1) {
      return 'Advantage'
    }

    if (other - own === 1) {
      return '40'
    }
  }

  return POINT_LABELS[Math.min(own, 3)] || '40'
}

/*
 * One plain-language state string for UI,
 * accessibility and later voice announcements.
 */
export function getPointStatus(scoreboardInput) {
  const scoreboard = normalizeScoreboard(scoreboardInput)

  if (scoreboard.matchWinner) {
    return 'Finished'
  }

  const game = scoreboard.currentGame

  if (game.inTieBreak) {
    const label = game.isMatchTieBreak ? 'Match tie-break' : 'Tie-break'

    return `${label} · ${game.tieBreakPoints.playerA}–${game.tieBreakPoints.playerB}`
  }

  const pointA = describePoint(scoreboard, 'playerA')

  const pointB = describePoint(scoreboard, 'playerB')

  if (scoreboard.config.gameMode === 'numeric') {
    return `${pointA} – ${pointB}`
  }

  if (scoreboard.config.scoring === 'noad') {
    const rawA = game.points.playerA

    const rawB = game.points.playerB

    if (rawA >= 3 && rawB >= 3 && rawA === rawB) {
      return 'Deciding point'
    }
  }

  if (pointA === 'Deuce' && pointB === 'Deuce') {
    return 'Deuce'
  }

  if (pointA === 'Advantage') {
    return `Advantage · ${scoreboard.players.playerA}`
  }

  if (pointB === 'Advantage') {
    return `Advantage · ${scoreboard.players.playerB}`
  }

  return `${pointA} – ${pointB}`
}

/*
 * Existing TennisScoreboard.vue uses this shape,
 * so preserve it while making the engine richer.
 */
export function formatSetSummary(scoreboardInput) {
  const scoreboard = normalizeScoreboard(scoreboardInput)

  return scoreboard.sets.map((set, index) => ({
    label: set.isMatchTieBreak ? 'Match tie-break' : `Set ${index + 1}`,

    playerAGames: Number(set.games?.playerA || 0),

    playerBGames: Number(set.games?.playerB || 0),

    winner: set.winner || null,

    tieBreak: set.tieBreak ? clone(set.tieBreak) : null,

    isMatchTieBreak: Boolean(set.isMatchTieBreak),
  }))
}

export function formatMatchScore(scoreboardInput) {
  const scoreboard = normalizeScoreboard(scoreboardInput)

  const completed = scoreboard.completedSets.map((set) => {
    if (set.isMatchTieBreak && set.tieBreak) {
      return `${set.tieBreak.score.playerA}–${set.tieBreak.score.playerB}`
    }

    return `${set.games.playerA}–${set.games.playerB}`
  })

  /*
   * While the match is live, include the
   * active set score.
   */
  if (!scoreboard.matchWinner && scoreboard.config.mode === 'sets') {
    const active = scoreboard.sets[scoreboard.currentSetIndex]

    if (active && !active.winner) {
      completed.push(`${active.games.playerA}–${active.games.playerB}`)
    }
  }

  if (scoreboard.config.mode === 'tiebreak' && !scoreboard.matchWinner) {
    completed.push(
      `${scoreboard.currentGame.tieBreakPoints.playerA}–${scoreboard.currentGame.tieBreakPoints.playerB}`,
    )
  }

  return completed.join(', ') || '0–0'
}

/*
 * IMPORTANT:
 *
 * This produces announcement TEXT only.
 *
 * The tennis engine must never call:
 * window.speechSynthesis
 * Audio
 * Web Speech APIs
 * DOM APIs
 *
 * Actual voice playback belongs to
 * Separation 2 — Match Control Experience.
 */
export function getScoreAnnouncement(scoreboardInput) {
  const scoreboard = normalizeScoreboard(scoreboardInput)

  const action = scoreboard.lastAction

  if (!action || action.type !== 'point' || !isPlayerKey(action.playerKey)) {
    return ''
  }

  const playerName = scoreboard.players[action.playerKey]

  if (scoreboard.matchWinner) {
    return `Game, set and match, ${playerName}.`
  }

  if (action.outcome === 'set') {
    return `Set, ${playerName}.`
  }

  if (action.outcome === 'game') {
    return `Game, ${playerName}.`
  }

  if (scoreboard.currentGame.inTieBreak) {
    return `${scoreboard.currentGame.tieBreakPoints.playerA}–${scoreboard.currentGame.tieBreakPoints.playerB}.`
  }

  return getPointStatus(scoreboard)
}
