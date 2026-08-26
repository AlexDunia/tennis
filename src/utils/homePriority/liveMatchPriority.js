function normalizeId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function timestamp(value) {
  const parsed = new Date(value || 0).getTime()

  return Number.isFinite(parsed) ? parsed : 0
}

function liveActivityTime(match) {
  return Math.max(
    timestamp(match?.liveState?.updatedAt),
    timestamp(match?.scorerChangedAt),
    timestamp(match?.startedAt),
  )
}

function actorRelationship(match, actorId) {
  const actor = normalizeId(actorId)

  if (!actor) {
    return null
  }

  if (normalizeId(match?.scorerId) === actor) {
    return 'scorer'
  }

  if (normalizeId(match?.ownerId) === actor) {
    return 'owner'
  }

  if (normalizeId(match?.opponent?.id) === actor) {
    return 'participant'
  }

  return null
}

function relationshipWeight(relationship) {
  return (
    {
      scorer: 3,
      owner: 2,
      participant: 1,
    }[relationship] || 0
  )
}

function liveMatchId(match) {
  return normalizeId(match?.matchId || match?.ladderMatchId)
}

function livePlayerNames(match) {
  return {
    playerA: String(match?.liveState?.players?.playerA || 'Player one').trim() || 'Player one',

    playerB:
      String(match?.liveState?.players?.playerB || match?.opponent?.name || 'Player two').trim() ||
      'Player two',
  }
}

function liveMatchSummary(match) {
  const liveState = match?.liveState

  if (!liveState) {
    return 'Live now'
  }

  if (liveState.currentGame?.isMatchTieBreak) {
    return 'Match tie-break · Live'
  }

  const setIndex = Math.max(0, Number(liveState.currentSetIndex) || 0)

  const currentSet = Array.isArray(liveState.sets) ? liveState.sets[setIndex] : null

  const games = currentSet?.games

  const score = games
    ? `Set ${setIndex + 1} · ${Number(games.playerA) || 0}–${Number(games.playerB) || 0}`
    : 'Live now'

  const court = String(match?.schedule?.court || '').trim()

  return court ? `${score} · ${court}` : score
}

/*
 * V1-A
 *
 * Pure decision function:
 *
 * data in → Priority candidate out.
 *
 * No router.
 * No localStorage.
 * No mutations.
 * No permissions are granted here.
 */
export function resolveLiveMatchPriority({ matches = [], actorId = '' } = {}) {
  const actor = normalizeId(actorId)

  if (!actor || !Array.isArray(matches)) {
    return null
  }

  const candidates = matches
    .map((match) => {
      const matchId = liveMatchId(match)

      const relationship = actorRelationship(match, actor)

      if (
        !matchId ||
        !relationship ||
        match?.status !== 'live' ||
        !match?.liveState ||
        match?.liveState?.matchWinner ||
        match?.over
      ) {
        return null
      }

      return {
        match,
        matchId,
        relationship,
        relationshipWeight: relationshipWeight(relationship),
        activityAt: liveActivityTime(match),
      }
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.relationshipWeight - left.relationshipWeight || right.activityAt - left.activityAt,
    )

  const winner = candidates[0]

  if (!winner) {
    return null
  }

  const names = livePlayerNames(winner.match)

  const isCurrentScorer = winner.relationship === 'scorer'

  return {
    id: `live-${winner.matchId}`,

    family: 'match',

    kind: 'live_match',

    /*
     * Other Priority families will eventually compete
     * against this score.
     *
     * A live personal match sits at the top.
     */
    priority: 100,

    matchId: winner.matchId,

    matchType: winner.match.matchType || 'friendly',

    relationship: winner.relationship,

    eyebrow: isCurrentScorer ? 'RETURN TO YOUR MATCH' : 'MATCH IN PROGRESS',

    title: `${names.playerA} vs ${names.playerB}`,

    supportingText: liveMatchSummary(winner.match),

    ctaLabel: isCurrentScorer ? 'Return to match' : 'Open match',

    action: 'open_live_match',
  }
}
