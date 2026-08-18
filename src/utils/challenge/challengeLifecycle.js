export const TERMINAL_CHALLENGE_STATUSES = Object.freeze([
  'completed',
  'declined',
  'cancelled',
  'expired',
])

export function challengeViewState(challenge, match, currentPlayerId, now = Date.now()) {
  if (!challenge) return 'missing'

  const status = String(challenge.status || '')
  if (TERMINAL_CHALLENGE_STATUSES.includes(status)) return status
  if (status === 'pending_review' || match?.status === 'pending_review') return 'pending_review'
  if (status === 'live' || match?.status === 'live' || match?.liveState?.startedAt) return 'live'
  if (status === 'awaiting') {
    return currentPlayerId === challenge.defenderId ? 'received' : 'sent'
  }
  if (status === 'accepted' || (status === 'scheduled' && !challenge.scheduledAt)) {
    return 'accepted_unscheduled'
  }
  if (status === 'ready') return 'ready'

  if (status === 'scheduled') {
    const scheduledTime = new Date(challenge.scheduledAt || match?.scheduledAt || 0).getTime()
    if (!Number.isFinite(scheduledTime) || scheduledTime <= 0) return 'accepted_unscheduled'
    return scheduledTime <= Number(now) + 30 * 60 * 1000 ? 'ready' : 'scheduled'
  }

  return status || 'missing'
}

export function isChallengeParticipant(challenge, playerId) {
  return Boolean(
    challenge && playerId && [challenge.challengerId, challenge.defenderId].includes(playerId),
  )
}

export function canStartChallenge(challenge, match, currentPlayerId, now = Date.now()) {
  return (
    isChallengeParticipant(challenge, currentPlayerId) &&
    ['ready', 'live'].includes(challengeViewState(challenge, match, currentPlayerId, now))
  )
}

export function challengeStateCopy(state) {
  const copy = {
    sent: {
      label: 'Challenge sent',
      title: 'Waiting for a response',
      description: 'Your opponent has been notified. You can withdraw before they accept.',
    },
    received: {
      label: 'Challenge received',
      title: 'Your response is needed',
      description: 'Accept to agree the match details, or decline to release both players.',
    },
    accepted_unscheduled: {
      label: 'Challenge accepted',
      title: 'Agree a date and time',
      description: 'Choose when and where you will play. Either player can confirm the schedule.',
    },
    scheduled: {
      label: 'Match scheduled',
      title: 'Your match is confirmed',
      description: 'The match will become ready shortly before the scheduled start.',
    },
    ready: {
      label: 'Ready to play',
      title: 'Start your Ladder match',
      description: 'Both players are confirmed. Open the live scoreboard when you are on court.',
    },
    live: {
      label: 'In progress',
      title: 'Continue your match',
      description: 'Return to the live scoreboard to keep scoring or record the final result.',
    },
    pending_review: {
      label: 'Result submitted',
      title: 'Final score awaiting confirmation',
      description: 'The other player must confirm the result before the Ladder updates.',
    },
    completed: {
      label: 'Completed',
      title: 'Result confirmed',
      description: 'The final score is official and the Ladder positions have been updated.',
    },
    declined: {
      label: 'Declined',
      title: 'Challenge declined',
      description: 'This challenge is closed. You can now challenge another eligible player.',
    },
    cancelled: {
      label: 'Cancelled',
      title: 'Challenge cancelled',
      description: 'This challenge is closed. You can now create another challenge.',
    },
    expired: {
      label: 'Expired',
      title: 'Response window expired',
      description: 'This challenge is closed. You can now challenge another eligible player.',
    },
  }
  return copy[state] || { label: 'Challenge', title: 'Challenge update', description: '' }
}
