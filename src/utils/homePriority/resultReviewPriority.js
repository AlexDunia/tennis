import { belongsToHomeClub } from './homeChallengeContext.js'
import { challengeViewState, isChallengeParticipant } from '../challenge/challengeLifecycle.js'

// Pending review remains actionable until the lifecycle resolves it.
function normalizeId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function validTimestamp(value) {
  const parsed = new Date(value || 0).getTime()

  return Number.isFinite(parsed) ? parsed : 0
}

function relatedMatch(matches, challengeId) {
  if (!challengeId || !Array.isArray(matches)) {
    return null
  }

  return matches.find((match) => normalizeId(match?.challengeId) === challengeId) || null
}


function playerNames(challenge, match) {
  return {
    challenger:
      String(challenge?.challengerName || match?.challengerName || 'Player one').trim() ||
      'Player one',

    defender:
      String(challenge?.defenderName || match?.defenderName || 'Player two').trim() || 'Player two',
  }
}

function resultSummary(match) {
  const score = String(match?.score || '')
    .trim()
    .slice(0, 100)

  const winnerId = normalizeId(match?.winnerId)

  let winnerName = ''

  if (winnerId && winnerId === normalizeId(match?.challengerId)) {
    winnerName = String(match?.challengerName || '').trim()
  } else if (winnerId && winnerId === normalizeId(match?.defenderId)) {
    winnerName = String(match?.defenderName || '').trim()
  }

  if (winnerName && score) {
    return `${winnerName} won · ${score}`
  }

  if (score) {
    return score
  }

  return 'A result was submitted for review'
}

/*
 * V1-C — RESULT REVIEW
 *
 * Pure projection only.
 *
 * This function cannot:
 * - confirm a result
 * - alter rankings
 * - change match status
 * - grant review authority
 */
export function resolveResultReviewPriority({
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

      if (!match) {
        return null
      }

      if (
        !belongsToHomeClub({
          challenge,
          match,
          clubId: activeClubId,
        })
      ) {
        return null
      }

      /*
       * Reuse the real Challenge lifecycle rather
       * than redefining pending-review logic on Home.
       */
      const state = challengeViewState(challenge, match, actor, currentTime)

      if (state !== 'pending_review') {
        return null
      }

      const submittedBy = normalizeId(match.resultSubmittedBy || challenge.resultSubmittedBy)

      /*
       * The person who submitted the result is waiting.
       *
       * They do NOT have a review action, so Home must
       * not advertise one to them.
       */
      if (!submittedBy || submittedBy === actor || !isChallengeParticipant(challenge, submittedBy)) {
        return null
      }

      const submittedAt = validTimestamp(match.resultSubmittedAt || challenge.resultSubmittedAt)

      // Missing/old timestamps do not remove an outstanding review action.
      if (submittedAt > currentTime + 5 * 60 * 1000) return null

      return {
        challenge,
        match,
        challengeId,
        matchId: normalizeId(match.id),
        submittedAt,
      }
    })
    .filter(Boolean)
    /*
     * If somehow this user has multiple recent results
     * waiting, continue the most recent match first.
     */
    .sort((left, right) => right.submittedAt - left.submittedAt)

  const winner = candidates[0]

  if (!winner) {
    return null
  }

  const names = playerNames(
    winner.challenge,
    winner.match,
  )

  const submittedBy = normalizeId(
    winner.match.resultSubmittedBy ||
      winner.challenge.resultSubmittedBy,
  )

  const challengerId = normalizeId(
    winner.challenge.challengerId,
  )

  const defenderId = normalizeId(
    winner.challenge.defenderId,
  )

  const submitterName =
    submittedBy === challengerId
      ? names.challenger
      : submittedBy === defenderId
        ? names.defender
        : 'Your opponent'

  const submitterImage =
    submittedBy === challengerId
      ? String(
          winner.challenge.challengerImage ||
            winner.challenge.challengerImageUrl ||
            winner.match.challengerImage ||
            '',
        ).trim()
      : submittedBy === defenderId
        ? String(
            winner.challenge.defenderImage ||
              winner.challenge.defenderImageUrl ||
              winner.match.defenderImage ||
              '',
          ).trim()
        : ''

  return {
    id: `result-review-${winner.challengeId}`,

    family: 'match',

    kind: 'result_review',

    priority: 80,

    challengeId: winner.challengeId,

    matchId: winner.matchId,

    eyebrow: 'RESULT TO REVIEW',

    title: `${submitterName} submitted the result`,

    supportingText: resultSummary(winner.match),

    ctaLabel: 'Review result',

    action: 'open_result_review',

    personName: submitterName,

    personImage: submitterImage,

    attention: true,
  }
}
