import { belongsToHomeClub } from './homeChallengeContext.js'
import {
  challengeViewState,
  isChallengeParticipant,
} from '../challenge/challengeLifecycle.js'
import { formatAppDateTime } from '../dateFormat.js'

const UPCOMING_HERO_WINDOW_MS = 24 * 60 * 60 * 1000

function normalizeId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function timestamp(value) {
  const parsed = new Date(value || 0).getTime()
  return Number.isFinite(parsed)
    ? parsed
    : Number.POSITIVE_INFINITY
}

function firstName(value) {
  return (
    String(value || 'Opponent')
      .trim()
      .split(/\s+/)[0] || 'Opponent'
  )
}

function relatedMatch(matches, challengeId) {
  if (!challengeId || !Array.isArray(matches)) {
    return null
  }

  return (
    matches.find(
      (match) =>
        normalizeId(match?.challengeId) === challengeId,
    ) || null
  )
}


function opponentFor(challenge, match, actorId) {
  const actor = normalizeId(actorId)
  const challengerId = normalizeId(challenge?.challengerId)
  const defenderId = normalizeId(challenge?.defenderId)

  if (actor === challengerId) {
    return {
      id: defenderId,
      name:
        String(
          challenge?.defenderName ||
            match?.defenderName ||
            'Opponent',
        ).trim() || 'Opponent',
      image: String(
        challenge?.defenderImage ||
          challenge?.defenderImageUrl ||
          match?.defenderImage ||
          '',
      ).trim(),
    }
  }

  if (actor === defenderId) {
    return {
      id: challengerId,
      name:
        String(
          challenge?.challengerName ||
            match?.challengerName ||
            'Opponent',
        ).trim() || 'Opponent',
      image: String(
        challenge?.challengerImage ||
          challenge?.challengerImageUrl ||
          match?.challengerImage ||
          '',
      ).trim(),
    }
  }

  return {
    id: '',
    name: 'Opponent',
    image: '',
  }
}

function scheduleSummary(challenge, match) {
  const scheduledAt =
    challenge?.scheduledAt ||
    match?.scheduledAt ||
    ''

  const court = String(
    challenge?.court || match?.court || '',
  ).trim()

  const time = scheduledAt
    ? formatAppDateTime(scheduledAt)
    : 'Schedule agreed'

  return court ? `${time} · ${court}` : time
}

function candidateFor({
  challenge,
  match,
  actorId,
  now,
}) {
  const challengeId = normalizeId(challenge?.id)
  const state = challengeViewState(
    challenge,
    match,
    actorId,
    now,
  )
  const opponent = opponentFor(
    challenge,
    match,
    actorId,
  )
  const opponentFirstName = firstName(opponent.name)

  if (state === 'received') {
    return {
      id: `challenge-received-${challengeId}`,
      family: 'challenge',
      kind: 'challenge_received',
      priority: 85,
      sortAt: timestamp(
        challenge?.responseDeadline ||
          challenge?.expiresAt ||
          challenge?.createdAt,
      ),
      challengeId,
      matchId: normalizeId(match?.id),
      eyebrow: 'CHALLENGE RECEIVED',
      title: `${opponent.name} challenged you`,
      supportingText: 'They’re waiting for your response.',
      ctaLabel: `Respond to ${opponentFirstName}`,
      action: 'open_challenge',
      personName: opponent.name,
      personImage: opponent.image,
      attention: true,
    }
  }

  if (state === 'accepted_unscheduled') {
    return {
      id: `challenge-schedule-${challengeId}`,
      family: 'challenge',
      kind: 'challenge_needs_schedule',
      priority: 75,
      sortAt: timestamp(
        challenge?.updatedAt || challenge?.createdAt,
      ),
      challengeId,
      matchId: normalizeId(match?.id),
      eyebrow: 'CHALLENGE ACCEPTED',
      title: `Set a time with ${opponentFirstName}`,
      supportingText:
        'Your challenge is accepted. Choose when and where you’ll play.',
      ctaLabel: 'Schedule match',
      action: 'open_challenge',
      personName: opponent.name,
      personImage: opponent.image,
      attention: true,
    }
  }

  if (state === 'pending_review') {
    const submittedBy = normalizeId(
      match?.resultSubmittedBy ||
        challenge?.resultSubmittedBy,
    )

    if (submittedBy && submittedBy === normalizeId(actorId) && isChallengeParticipant(challenge, submittedBy)) {
      return {
        id: `challenge-waiting-review-${challengeId}`,
        family: 'challenge',
        kind: 'result_waiting_confirmation',
        priority: 70,
        sortAt: timestamp(
          match?.resultSubmittedAt ||
            challenge?.resultSubmittedAt,
        ),
        challengeId,
        matchId: normalizeId(match?.id),
        eyebrow: 'RESULT PENDING',
        title: `Waiting for ${opponentFirstName} to confirm`,
        supportingText:
          'Your ladder position stays the same until the result is confirmed.',
        ctaLabel: 'View result',
        action: 'open_challenge',
        personName: opponent.name,
        personImage: opponent.image,
        attention: false,
      }
    }
  }

  if (state === 'scheduled') {
    const scheduledAt =
      challenge?.scheduledAt ||
      match?.scheduledAt ||
      ''
    const scheduledTime = timestamp(scheduledAt)

    if (
      !Number.isFinite(scheduledTime) ||
      scheduledTime > now + UPCOMING_HERO_WINDOW_MS
    ) {
      return null
    }

    return {
      id: `challenge-upcoming-${challengeId}`,
      family: 'challenge',
      kind: 'scheduled_match',
      priority: 60,
      sortAt: scheduledTime,
      challengeId,
      matchId: normalizeId(match?.id),
      eyebrow: 'COMING UP',
      title: `You play ${opponentFirstName} next`,
      supportingText: scheduleSummary(challenge, match),
      ctaLabel: 'View match',
      action: 'open_challenge',
      personName: opponent.name,
      personImage: opponent.image,
      attention: false,
    }
  }

  return null
}

export function resolveChallengeActionPriority({
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

      if (
        !challengeId ||
        !isChallengeParticipant(challenge, actor)
      ) {
        return null
      }

      const match = relatedMatch(matches, challengeId)

      if (
        !belongsToHomeClub({
          challenge,
          match,
          clubId: activeClubId,
        })
      ) {
        return null
      }

      return candidateFor({
        challenge,
        match,
        actorId: actor,
        now: currentTime,
      })
    })
    .filter(Boolean)

  if (!candidates.length) {
    return null
  }

  return candidates.sort((left, right) => {
    const priorityDifference =
      Number(right.priority) - Number(left.priority)

    if (priorityDifference) {
      return priorityDifference
    }

    const leftTime = Number(left.sortAt)
    const rightTime = Number(right.sortAt)

    if (
      Number.isFinite(leftTime) &&
      Number.isFinite(rightTime) &&
      leftTime !== rightTime
    ) {
      return leftTime - rightTime
    }

    return String(left.id).localeCompare(String(right.id))
  })[0]
}
