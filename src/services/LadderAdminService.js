const STORAGE_KEY = 'gorra.ladder.adminState.v1'
const MAX_ACTIVITY = 120
const MAX_MISSING_MATCHES = 120

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function cleanText(value, max = 160) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function loadState() {
  if (!canUseStorage()) return { ladders: {} }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || '{"ladders":{}}',
    )

    return {
      ladders:
        parsed && typeof parsed.ladders === 'object'
          ? parsed.ladders
          : {},
    }
  } catch {
    return { ladders: {} }
  }
}

function saveState(state) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function scopeKey({ clubId = '', ladderId = '' } = {}) {
  return `${cleanText(clubId, 80) || 'club'}::${cleanText(ladderId, 80) || 'ladder'}`
}

function emptyLadderState() {
  return {
    order: [],
    pausedPlayerIds: [],
    removedPlayerIds: [],
    activity: [],
    missingMatches: [],
  }
}

function stateFor(scope) {
  const state = loadState()
  const key = scopeKey(scope)

  return {
    root: state,
    key,
    ladder: {
      ...emptyLadderState(),
      ...(state.ladders[key] || {}),
      order: Array.isArray(state.ladders[key]?.order)
        ? state.ladders[key].order
        : [],
      pausedPlayerIds: Array.isArray(
        state.ladders[key]?.pausedPlayerIds,
      )
        ? state.ladders[key].pausedPlayerIds
        : [],
      removedPlayerIds: Array.isArray(
        state.ladders[key]?.removedPlayerIds,
      )
        ? state.ladders[key].removedPlayerIds
        : [],
      activity: Array.isArray(state.ladders[key]?.activity)
        ? state.ladders[key].activity
        : [],
      missingMatches: Array.isArray(
        state.ladders[key]?.missingMatches,
      )
        ? state.ladders[key].missingMatches
        : [],
    },
  }
}

function persist(scope, nextLadderState) {
  const current = stateFor(scope)

  const next = {
    ...current.root,
    ladders: {
      ...current.root.ladders,
      [current.key]: {
        ...emptyLadderState(),
        ...nextLadderState,
        updatedAt: new Date().toISOString(),
      },
    },
  }

  saveState(next)
  return next.ladders[current.key]
}

function playerId(player) {
  return cleanText(player?.id, 100)
}

function normalizeOrder(order = []) {
  return [...new Set(order.map((id) => cleanText(id, 100)).filter(Boolean))]
}

function appendActivity(ladderState, event) {
  return {
    ...ladderState,
    activity: [
      {
        id: `ladder-event-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        at: new Date().toISOString(),
        ...event,
      },
      ...(ladderState.activity || []),
    ].slice(0, MAX_ACTIVITY),
  }
}

function baseRoster(roster = [], removedPlayerIds = []) {
  const removed = new Set(removedPlayerIds)

  return roster
    .filter((player) => playerId(player) && !removed.has(playerId(player)))
    .map((player) => ({ ...player }))
}

function orderedRoster(order = [], roster = []) {
  const byId = new Map(roster.map((player) => [playerId(player), player]))
  const used = new Set()
  const arranged = []

  normalizeOrder(order).forEach((id) => {
    const player = byId.get(id)
    if (!player) return
    used.add(id)
    arranged.push(player)
  })

  roster.forEach((player) => {
    const id = playerId(player)
    if (!used.has(id)) arranged.push(player)
  })

  return arranged
}

export function getLadderAdminState(scope) {
  return stateFor(scope).ladder
}

export function effectiveLadderRoster(scope, roster = []) {
  const ladderState = getLadderAdminState(scope)
  const paused = new Set(ladderState.pausedPlayerIds)

  const available = baseRoster(roster, ladderState.removedPlayerIds)
  const arranged = orderedRoster(ladderState.order, available)

  return arranged.map((player, index) => ({
    ...player,
    rank: index + 1,
    ladderRank: index + 1,
    challengePaused: paused.has(playerId(player)),
  }))
}

function currentIds(scope, roster) {
  return effectiveLadderRoster(scope, roster).map(playerId)
}

function rankOf(ids, id) {
  const index = ids.indexOf(id)
  return index === -1 ? null : index + 1
}

function movementDescription(ids, playerIdValue, targetRank, roster = []) {
  const fromRank = rankOf(ids, playerIdValue)
  const targetIndex = Number(targetRank) - 1

  if (
    !fromRank ||
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= ids.length
  ) {
    return null
  }

  const player = roster.find((item) => playerId(item) === playerIdValue)
  const occupantId = ids[targetIndex]
  const occupant = roster.find((item) => playerId(item) === occupantId)

  if (fromRank === targetRank) {
    return {
      fromRank,
      toRank: fromRank,
      player,
      occupant,
      direction: 'same',
      message: `${player?.name || 'This player'} is already #${fromRank}.`,
    }
  }

  const low = Math.min(fromRank, targetRank)
  const high = Math.max(fromRank, targetRank)
  const direction = targetRank < fromRank ? 'down' : 'up'

  return {
    fromRank,
    toRank: targetRank,
    player,
    occupant,
    direction,
    message:
      `${player?.name || 'This player'} will become #${targetRank}. ` +
      `Players currently between #${low} and #${high} will move ${direction} one place.`,
  }
}

export function previewManualLadderMove({
  scope,
  roster,
  playerId: id,
  targetRank,
}) {
  const current = effectiveLadderRoster(scope, roster)
  const ids = current.map(playerId)

  return movementDescription(
    ids,
    cleanText(id, 100),
    Number(targetRank),
    current,
  )
}

export function moveLadderPlayer({
  scope,
  roster,
  playerId: id,
  targetRank,
  actorName = '',
}) {
  const current = effectiveLadderRoster(scope, roster)
  const ids = current.map(playerId)
  const normalizedId = cleanText(id, 100)
  const preview = movementDescription(
    ids,
    normalizedId,
    Number(targetRank),
    current,
  )

  if (!preview) {
    throw new Error('Choose a position that exists on this ladder.')
  }

  if (preview.fromRank === preview.toRank) {
    return {
      changed: false,
      ...preview,
      players: current,
    }
  }

  const fromIndex = preview.fromRank - 1
  const toIndex = preview.toRank - 1
  const nextIds = [...ids]
  const [movedId] = nextIds.splice(fromIndex, 1)
  nextIds.splice(toIndex, 0, movedId)

  const existing = getLadderAdminState(scope)

  const nextState = appendActivity(
    {
      ...existing,
      order: nextIds,
    },
    {
      type: 'manual-position-change',
      playerId: normalizedId,
      playerName: cleanText(preview.player?.name, 100),
      fromRank: preview.fromRank,
      toRank: preview.toRank,
      actorName: cleanText(actorName, 100),
      message: `${cleanText(preview.player?.name, 100)} moved from #${preview.fromRank} to #${preview.toRank}.`,
    },
  )

  persist(scope, nextState)

  return {
    changed: true,
    ...preview,
    players: effectiveLadderRoster(scope, roster),
  }
}

export function setLadderChallengePaused({
  scope,
  roster,
  playerId: id,
  paused,
  actorName = '',
}) {
  const normalizedId = cleanText(id, 100)
  const currentRoster = effectiveLadderRoster(scope, roster)
  const player = currentRoster.find(
    (item) => playerId(item) === normalizedId,
  )

  if (!player) throw new Error('That player is not on this ladder.')

  const existing = getLadderAdminState(scope)
  const pausedIds = new Set(existing.pausedPlayerIds)

  if (paused) pausedIds.add(normalizedId)
  else pausedIds.delete(normalizedId)

  const nextState = appendActivity(
    {
      ...existing,
      pausedPlayerIds: [...pausedIds],
    },
    {
      type: paused ? 'challenges-paused' : 'challenges-resumed',
      playerId: normalizedId,
      playerName: cleanText(player.name, 100),
      actorName: cleanText(actorName, 100),
      message: paused
        ? `Challenges paused for ${cleanText(player.name, 100)}.`
        : `Challenges resumed for ${cleanText(player.name, 100)}.`,
    },
  )

  persist(scope, nextState)

  return {
    player: {
      ...player,
      challengePaused: Boolean(paused),
    },
    paused: Boolean(paused),
  }
}

export function removePlayerFromLadder({
  scope,
  roster,
  playerId: id,
  actorName = '',
}) {
  const normalizedId = cleanText(id, 100)
  const currentRoster = effectiveLadderRoster(scope, roster)
  const player = currentRoster.find(
    (item) => playerId(item) === normalizedId,
  )

  if (!player) throw new Error('That player is not on this ladder.')

  const existing = getLadderAdminState(scope)
  const removed = new Set(existing.removedPlayerIds)
  removed.add(normalizedId)

  const nextOrder = currentRoster
    .map(playerId)
    .filter((itemId) => itemId !== normalizedId)

  const nextState = appendActivity(
    {
      ...existing,
      order: nextOrder,
      removedPlayerIds: [...removed],
      pausedPlayerIds: existing.pausedPlayerIds.filter(
        (itemId) => itemId !== normalizedId,
      ),
    },
    {
      type: 'player-removed',
      playerId: normalizedId,
      playerName: cleanText(player.name, 100),
      fromRank: Number(player.rank) || null,
      actorName: cleanText(actorName, 100),
      message: `${cleanText(player.name, 100)} was removed from this ladder.`,
    },
  )

  persist(scope, nextState)

  return {
    player,
    players: effectiveLadderRoster(scope, roster),
  }
}

function validCompletedTennisSet(sideA, sideB) {
  const high = Math.max(sideA, sideB)
  const low = Math.min(sideA, sideB)
  const gap = high - low

  // Standard tie-break set.
  if (high === 6 && low <= 4) return true
  if (high === 7 && (low === 5 || low === 6)) return true

  // Match tie-break / super tie-break. Gorra accepts this
  // because some club ladders use it instead of a third set.
  if (high >= 10 && gap >= 2) return true

  return false
}

function parsedSets(sets = []) {
  const validSets = []
  const invalidSetNumbers = []

  sets.forEach((set, index) => {
    const rawA = String(set?.sideA ?? '').trim()
    const rawB = String(set?.sideB ?? '').trim()

    if (!rawA && !rawB) return

    const sideA = Number.parseInt(rawA, 10)
    const sideB = Number.parseInt(rawB, 10)

    if (
      !Number.isInteger(sideA) ||
      !Number.isInteger(sideB) ||
      sideA < 0 ||
      sideB < 0 ||
      !validCompletedTennisSet(sideA, sideB)
    ) {
      invalidSetNumbers.push(index + 1)
      return
    }

    validSets.push({
      number: index + 1,
      sideA,
      sideB,
    })
  })

  return {
    validSets,
    invalidSetNumbers,
  }
}

export function missingMatchWinner(sets = []) {
  const {
    validSets,
    invalidSetNumbers,
  } = parsedSets(sets)

  if (!validSets.length || invalidSetNumbers.length) {
    return {
      winnerSide: '',
      sideASets: 0,
      sideBSets: 0,
      validSets,
      invalidSetNumbers,
    }
  }

  const sideASets = validSets.filter(
    (set) => set.sideA > set.sideB,
  ).length

  const sideBSets = validSets.filter(
    (set) => set.sideB > set.sideA,
  ).length

  return {
    winnerSide:
      sideASets === sideBSets
        ? ''
        : sideASets > sideBSets
          ? 'A'
          : 'B',
    sideASets,
    sideBSets,
    validSets,
    invalidSetNumbers,
  }
}

function scoreLabel(validSets = []) {
  return validSets
    .map((set) => `${set.sideA}-${set.sideB}`)
    .join(', ')
}

function moveForMatchResult({
  ids,
  winnerId,
  loserId,
  movementSystem,
}) {
  const winnerIndex = ids.indexOf(winnerId)
  const loserIndex = ids.indexOf(loserId)

  if (winnerIndex === -1 || loserIndex === -1) {
    return {
      ids,
      moved: false,
      winnerFrom: null,
      winnerTo: null,
    }
  }

  const winnerFrom = winnerIndex + 1
  const loserFrom = loserIndex + 1

  // If the player who was already above wins, the order stays.
  if (winnerFrom < loserFrom) {
    return {
      ids,
      moved: false,
      winnerFrom,
      winnerTo: winnerFrom,
    }
  }

  if (movementSystem === 'points') {
    // Gorra intentionally does not invent a points formula.
    return {
      ids,
      moved: false,
      winnerFrom,
      winnerTo: winnerFrom,
    }
  }

  const next = [...ids]

  if (movementSystem === 'bump-rank') {
    const [winner] = next.splice(winnerIndex, 1)
    next.splice(loserIndex, 0, winner)

    return {
      ids: next,
      moved: true,
      winnerFrom,
      winnerTo: loserFrom,
    }
  }

  // Current Gorra default: position swap.
  ;[next[winnerIndex], next[loserIndex]] = [
    next[loserIndex],
    next[winnerIndex],
  ]

  return {
    ids: next,
    moved: true,
    winnerFrom,
    winnerTo: loserFrom,
  }
}

export function previewMissingMatchMovement({
  scope,
  roster,
  movementSystem = 'position-swap',
  matchType = 'singles',
  sideAIds = [],
  sideBIds = [],
  sets = [],
}) {
  const winner = missingMatchWinner(sets)
  const current = effectiveLadderRoster(scope, roster)

  if (winner.invalidSetNumbers?.length) {
    return {
      valid: false,
      message:
        `Check set ${winner.invalidSetNumbers.join(', ')}. ` +
        'A completed tennis set is normally 6–0 to 6–4, 7–5, 7–6, or a 10-point match tie-break won by two.',
      score: scoreLabel(winner.validSets),
      winnerSide: '',
      moved: false,
    }
  }

  if (!winner.winnerSide) {
    return {
      valid: false,
      message: 'Add the completed set scores so Gorra can see who won.',
      score: scoreLabel(winner.validSets),
      winnerSide: '',
      moved: false,
    }
  }

  if (matchType === 'doubles') {
    return {
      valid: sideAIds.length === 2 && sideBIds.length === 2,
      message:
        'This doubles result can be recorded. This current ladder roster ranks people, not permanent teams, so Gorra will not invent a team-position move.',
      score: scoreLabel(winner.validSets),
      winnerSide: winner.winnerSide,
      moved: false,
    }
  }

  const winnerId =
    winner.winnerSide === 'A'
      ? cleanText(sideAIds[0], 100)
      : cleanText(sideBIds[0], 100)

  const loserId =
    winner.winnerSide === 'A'
      ? cleanText(sideBIds[0], 100)
      : cleanText(sideAIds[0], 100)

  const ids = current.map(playerId)

  const movement = moveForMatchResult({
    ids,
    winnerId,
    loserId,
    movementSystem,
  })

  const winnerPlayer = current.find(
    (player) => playerId(player) === winnerId,
  )

  if (movementSystem === 'points') {
    return {
      valid: true,
      message:
        'The result can be recorded. This Points ladder needs an explicit points formula before Gorra changes the order.',
      score: scoreLabel(winner.validSets),
      winnerSide: winner.winnerSide,
      moved: false,
      winnerPlayer,
      ...movement,
    }
  }

  return {
    valid: true,
    message: movement.moved
      ? `${cleanText(winnerPlayer?.name, 100)} will move from #${movement.winnerFrom} to #${movement.winnerTo}.`
      : 'The result will be recorded. The current order does not change.',
    score: scoreLabel(winner.validSets),
    winnerSide: winner.winnerSide,
    winnerPlayer,
    ...movement,
  }
}

export function recordMissingLadderMatch({
  scope,
  roster,
  movementSystem = 'position-swap',
  matchType = 'singles',
  sideAIds = [],
  sideBIds = [],
  sets = [],
  playedOn = '',
  actorName = '',
}) {
  const preview = previewMissingMatchMovement({
    scope,
    roster,
    movementSystem,
    matchType,
    sideAIds,
    sideBIds,
    sets,
  })

  if (!preview.valid) {
    throw new Error(preview.message || 'Finish the match result first.')
  }

  const current = effectiveLadderRoster(scope, roster)
  const byId = new Map(current.map((player) => [playerId(player), player]))
  const validSets = missingMatchWinner(sets).validSets

  const cleanSideA = sideAIds
    .map((id) => cleanText(id, 100))
    .filter(Boolean)

  const cleanSideB = sideBIds
    .map((id) => cleanText(id, 100))
    .filter(Boolean)

  if (
    matchType === 'singles' &&
    (cleanSideA.length !== 1 || cleanSideB.length !== 1)
  ) {
    throw new Error('Choose both players.')
  }

  if (
    matchType === 'doubles' &&
    (cleanSideA.length !== 2 || cleanSideB.length !== 2)
  ) {
    throw new Error('Choose all four players.')
  }

  const allIds = [...cleanSideA, ...cleanSideB]
  if (new Set(allIds).size !== allIds.length) {
    throw new Error('A player can only appear once in this match.')
  }

  const winnerSide = preview.winnerSide
  const winnerIds = winnerSide === 'A' ? cleanSideA : cleanSideB

  const missingMatch = {
    id: `missing-match-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    matchType,
    sideAIds: cleanSideA,
    sideBIds: cleanSideB,
    sideANames: cleanSideA.map(
      (id) => cleanText(byId.get(id)?.name, 100) || id,
    ),
    sideBNames: cleanSideB.map(
      (id) => cleanText(byId.get(id)?.name, 100) || id,
    ),
    winnerSide,
    winnerIds,
    sets: validSets,
    score: scoreLabel(validSets),
    playedOn: cleanText(playedOn, 20),
    recordedAt: new Date().toISOString(),
    recordedBy: cleanText(actorName, 100),
  }

  const existing = getLadderAdminState(scope)
  const nextOrder =
    matchType === 'singles' &&
    preview.moved &&
    Array.isArray(preview.ids)
      ? preview.ids
      : current.map(playerId)

  const winnerNames = winnerIds
    .map((id) => cleanText(byId.get(id)?.name, 100))
    .filter(Boolean)
    .join(' + ')

  const opponentNames =
    (winnerSide === 'A' ? cleanSideB : cleanSideA)
      .map((id) => cleanText(byId.get(id)?.name, 100))
      .filter(Boolean)
      .join(' + ')

  const nextState = appendActivity(
    {
      ...existing,
      order: nextOrder,
      missingMatches: [
        missingMatch,
        ...(existing.missingMatches || []),
      ].slice(0, MAX_MISSING_MATCHES),
    },
    {
      type: 'missing-match-recorded',
      matchId: missingMatch.id,
      playerIds: allIds,
      winnerIds,
      score: missingMatch.score,
      playedOn: missingMatch.playedOn,
      actorName: cleanText(actorName, 100),
      message:
        `${winnerNames || 'Winner'} beat ` +
        `${opponentNames || 'opponent'} ${missingMatch.score}.`,
    },
  )

  persist(scope, nextState)

  return {
    match: missingMatch,
    movement: preview,
    players: effectiveLadderRoster(scope, roster),
  }
}

export function ladderAdminActivity(scope) {
  return getLadderAdminState(scope).activity
}

