import {
  canStartChallenge,
  challengeViewState,
  isChallengeParticipant,
} from '../challenge/challengeLifecycle'

import { formatAppDateTime } from '../dateFormat'

function normalizeId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function timestamp(value) {
  const parsed = new Date(value || 0).getTime()

  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

function relatedMatch(matches, challengeId) {
  if (!challengeId || !Array.isArray(matches)) {
    return null
  }

  return matches.find((match) => normalizeId(match?.challengeId) === challengeId) || null
}

function recordBelongsToClub({ challenge, match, clubId }) {
  const activeClubId = normalizeId(clubId)

  /*
   * Home Priority is club-contextual.
   * Without an active club there is no safe club
   * projection to make.
   */
  if (!activeClubId) {
    return false
  }

  /*
   * The older ladder mock records pre-date proper
   * clubId ownership.
   *
   * If the record DOES expose clubId, enforce it.
   *
   * Missing clubId remains temporarily compatible
   * with the legacy single-club mock. Laravel will
   * make club ownership mandatory server-side.
   */
  const recordClubId = normalizeId(challenge?.clubId || match?.clubId)

  if (recordClubId && recordClubId !== activeClubId) {
    return false
  }

  return true
}

function opponentNameFor(challenge, match, actorId) {
  const actor = normalizeId(actorId)

  const challengerId = normalizeId(challenge?.challengerId)

  const defenderId = normalizeId(challenge?.defenderId)

  if (actor === challengerId) {
    return String(challenge?.defenderName || match?.defenderName || 'Opponent').trim() || 'Opponent'
  }

  if (actor === defenderId) {
    return (
      String(challenge?.challengerName || match?.challengerName || 'Opponent').trim() || 'Opponent'
    )
  }

  return 'Opponent'
}

function scheduleSummary(challenge, match) {
  const scheduledAt = challenge?.scheduledAt || match?.scheduledAt || ''

  const court = String(challenge?.court || match?.court || '').trim()

  const time = scheduledAt ? formatAppDateTime(scheduledAt) : 'Ready to start'

  return court ? `${time} · ${court}` : time
}

/*
 * V1-B — READY MATCH
 *
 * This intentionally asks the existing challenge
 * lifecycle whether the match is ready.
 *
 * Home does NOT calculate a second definition of
 * readiness.
 */
export function resolveReadyMatchPriority({
  challenges = [],
  matches = [],
  actorId = '',
  clubId = '',
  now = Date.now(),
} = {}) {
  const actor = normalizeId(actorId)

  const activeClubId = normalizeId(clubId)

  const currentTime = Number(now)

  if (
    !actor ||
    !activeClubId ||
    !Array.isArray(challenges) ||
    !Array.isArray(matches) ||
    !Number.isFinite(currentTime)
  ) {
    return null
  }

  const candidates = challenges
    .map((challenge) => {
      const challengeId = normalizeId(challenge?.id)

      if (!challengeId || !isChallengeParticipant(challenge, actor)) {
        return null
      }

      const match = relatedMatch(matches, challengeId)

      if (
        !recordBelongsToClub({
          challenge,
          match,
          clubId: activeClubId,
        })
      ) {
        return null
      }

      /*
       * Reuse the SAME lifecycle that powers the
       * actual Challenge Details screen.
       */
      const state = challengeViewState(challenge, match, actor, currentTime)

      if (state !== 'ready') {
        return null
      }

      /*
       * "Ready" on Home must also mean the current
       * participant can legitimately enter the start
       * flow.
       *
       * This prevents Home from advertising an action
       * the real domain would reject.
       */
      if (!canStartChallenge(challenge, match, actor, currentTime)) {
        return null
      }

      const scheduledAt = challenge?.scheduledAt || match?.scheduledAt || ''

      return {
        challenge,
        match,

        challengeId,

        matchId: normalizeId(match?.id),

        scheduledAt,

        sortAt: timestamp(scheduledAt),
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.sortAt - right.sortAt)

  const winner = candidates[0]

  if (!winner) {
    return null
  }

  const opponentName = opponentNameFor(winner.challenge, winner.match, actor)

  return {
    id: `ready-${winner.challengeId}`,

    family: 'match',

    kind: 'ready_match',

    /*
     * Live/current match remains above this.
     */
    priority: 90,

    sortAt: winner.sortAt,

    challengeId: winner.challengeId,

    matchId: winner.matchId,

    eyebrow: 'YOUR MATCH IS READY',

    title: `You vs ${opponentName}`,

    supportingText: scheduleSummary(winner.challenge, winner.match),

    ctaLabel: 'Open match',

    action: 'open_ready_match',
  }
}
