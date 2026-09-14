function firstName(value) {
  return (
    String(value || 'Player')
      .trim()
      .split(/\s+/)[0] || 'Player'
  )
}

function validRank(value) {
  const rank = Number(value)
  return Number.isFinite(rank) && rank > 0
    ? rank
    : null
}

function hasClubMemberEvidence(club) {
  const membership = club?.setup?.membership || {}

  return [
    membership.roster,
    membership.importedMembers,
    membership.manualMembers,
    membership.selectedPlayerIds,
  ].some(
    (collection) =>
      Array.isArray(collection) && collection.length > 0,
  )
}

export function resolveHomeFallbackPriority({
  club = null,
  activeLadders = [],
  currentPlayer = null,
  currentPlayerName = '',
  availableOpponents = [],
  playerCount = 0,
  isAdmin = false,
} = {}) {
  if (!club?.id) {
    return null
  }

  const clubName =
    String(club.name || 'Your club').trim() ||
    'Your club'
  const name = firstName(
    currentPlayerName || currentPlayer?.name,
  )
  const ladders = Array.isArray(activeLadders)
    ? activeLadders.filter(Boolean)
    : []
  const ladder = ladders[0] || null
  const rank = validRank(currentPlayer?.rank)
  const opponents = Array.isArray(availableOpponents)
    ? availableOpponents
    : []
  const safePlayerCount = Math.max(
    0,
    Number(playerCount) || 0,
  )

  if (ladder && rank) {
    const opponentCount = opponents.length

    return {
      id: `ladder-position-${ladder.id || 'active'}`,
      family: 'fallback',
      kind: 'ladder_position',
      priority: 30,
      eyebrow: 'YOUR LADDER',
      title: `You’re #${rank} in ${ladder.name || 'your ladder'}`,
      supportingText:
        opponentCount > 0
          ? `${opponentCount} ${
              opponentCount === 1
                ? 'player is'
                : 'players are'
            } available to challenge.`
          : safePlayerCount > 1
            ? `${safePlayerCount} players are on this ladder.`
            : 'Your position is ready when you want to check the ladder.',
      ctaLabel:
        opponentCount > 0
          ? 'Challenge someone'
          : 'Open ladder',
      action:
        opponentCount > 0
          ? 'create_challenge'
          : 'open_ladder',
      personName: '',
      personImage: '',
      attention: false,
    }
  }

  if (ladder) {
    if (isAdmin && safePlayerCount === 0) {
      return {
        id: `ladder-needs-players-${ladder.id || 'active'}`,
        family: 'fallback',
        kind: 'ladder_needs_players',
        priority: 24,
        eyebrow: 'GET STARTED',
        title: `${ladder.name || 'Your ladder'} is ready for players`,
        supportingText:
          'Add your club members, then place them on the ladder.',
        ctaLabel: 'Add members',
        action: 'add_members',
        personName: '',
        personImage: '',
        attention: false,
      }
    }

    return {
      id: `ladder-open-${ladder.id || 'active'}`,
      family: 'fallback',
      kind: 'ladder_available',
      priority: 22,
      eyebrow: 'YOUR CLUB',
      title: `${ladder.name || 'Your ladder'} is active`,
      supportingText:
        'Open the ladder to see the standings and activity.',
      ctaLabel: 'Open ladder',
      action: 'open_ladder',
      personName: '',
      personImage: '',
      attention: false,
    }
  }

  const hasMembers = hasClubMemberEvidence(club)

  if (isAdmin) {
    if (hasMembers) {
      return {
        id: 'club-needs-ladder',
        family: 'fallback',
        kind: 'club_needs_ladder',
        priority: 20,
        eyebrow: 'NEXT STEP',
        title: 'Ready to start your first ladder?',
        supportingText:
          'Your members are in. Set up a ladder when the club is ready to compete.',
        ctaLabel: 'Open ladder',
        action: 'open_ladder',
        personName: '',
        personImage: '',
        attention: false,
      }
    }

    return {
      id: 'fresh-admin-club',
      family: 'fallback',
      kind: 'fresh_club',
      priority: 18,
      eyebrow: 'WELCOME TO GORRA',
      title: `Welcome to ${clubName}, ${name}`,
      supportingText:
        'Your club is ready. Add members when you’re ready to get things moving.',
      ctaLabel: 'Add members',
      action: 'add_members',
      personName: '',
      personImage: '',
      attention: false,
    }
  }

  return {
    id: hasMembers
      ? 'member-no-ladder'
      : 'fresh-member-club',
    family: 'fallback',
    kind: hasMembers
      ? 'no_ladder'
      : 'fresh_club',
    priority: 18,
    eyebrow: 'YOUR CLUB',
    title: hasMembers
      ? 'No ladder yet'
      : `Welcome to ${clubName}, ${name}`,
    supportingText: hasMembers
      ? `${clubName} hasn’t started a ladder yet.`
      : 'There’s nothing you need to do yet. Club activity will appear here.',
    ctaLabel: 'Open club',
    action: 'open_club',
    personName: '',
    personImage: '',
    attention: false,
  }
}
