import { collectClubMembers } from '../club/memberData.js'
import { ACTIVE_LADDER_CHALLENGE_STATUSES } from '../../config/ladder.js'
import { getEligibleLadderOpponents } from '../../services/LadderAccessService.js'

const id = (value) => String(value || '').trim()
const list = (value) => (Array.isArray(value) ? value : [])
const rankOf = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null
const identities = (person) =>
  [person?.id, person?.playerId, person?.userId].map(id).filter(Boolean)
const samePerson = (left, right) =>
  identities(left).some((value) => identities(right).includes(value))
const active = (record) =>
  record && !['removed', 'inactive', 'archived', 'cancelled'].includes(record.status)

export function resolveHomeFallbackPriority({
  club = null,
  activeLadders = [],
  players = [],
  actorId = '',
  userId = '',
  currentPlayerName = '',
  challenges = [],
  isAdmin = false,
  canCreateChallenge = false,
  challengeConfig = null,
  dataReady = true,
  ladderStateFor = () => ({}),
} = {}) {
  if (!club?.id) return null
  const clubName = id(club.name) || 'Your club'
  const name = id(currentPlayerName).split(/\s+/)[0] || 'Player'
  const candidate = (
    kind,
    priority,
    eyebrow,
    title,
    supportingText,
    ctaLabel,
    action,
    ladderId = '',
  ) => ({
    id: `${kind}-${ladderId || club.id}`,
    family: 'fallback',
    kind,
    priority,
    eyebrow,
    title,
    supportingText,
    ctaLabel,
    action,
    ladderId,
    personName: '',
    personImage: '',
    attention: false,
  })
  if (!dataReady || !club.setup) {
    return candidate(
      'club_overview',
      18,
      'YOUR CLUB',
      clubName,
      'Open your club to see its members and ladder activity.',
      'Open club',
      'open_club',
    )
  }

  const ladders = list(activeLadders).filter(
    (ladder) => ladder?.id && ladder.enabled !== false && !ladder.archived && active(ladder),
  )
  const selectedIds = list(club.setup.membership?.selectedPlayerIds).map(id).filter(Boolean)
  const memberRecords = collectClubMembers(club.setup)
  const records = memberRecords.filter(active)
  const sourcePlayers = list(players).filter(
    (player) => active(player) && (!player.clubId || id(player.clubId) === id(club.id)),
  )
  const clubPlayers = sourcePlayers.filter(
    (player) =>
      id(player.clubId) === id(club.id) ||
      list(player.clubIds).map(id).includes(id(club.id)) ||
      records.some((member) => samePerson(member, player)) ||
      selectedIds.includes(id(player.id)) ||
      ladders.some((ladder) =>
        [...list(ladder.playerIds), ...list(ladder.memberIds)].map(id).includes(id(player.id)),
      ),
  )
  const people = records.map((member) => {
    const player = clubPlayers.find((item) => samePerson(member, item))
    return {
      ...player,
      ...member,
      id: player?.id || member.id,
      aliases: identities(member),
      player,
    }
  })
  clubPlayers.forEach((player) => {
    if (
      !people.some((person) => samePerson(person, player) || person.aliases.includes(id(player.id)))
    ) {
      people.push({ ...player, aliases: identities(player), player })
    }
  })
  const hasMembers = memberRecords.length > 0 || people.length > 0 || selectedIds.length > 0
  const actorIds = [actorId, userId].map(id).filter(Boolean)
  const primaryId = id(club.setup.primaryLadderId) || ladders[0]?.id

  const contexts = ladders.map((ladder) => {
    const explicitIds = Array.isArray(ladder.playerIds) ? ladder.playerIds : ladder.memberIds
    const memberships = people
      .map((person) => {
        const aliases = [...identities(person), ...person.aliases]
        const membership = list(person.ladderMemberships).find((entry) =>
          entry.ladderId
            ? id(entry.ladderId) === id(ladder.id)
            : id(entry.ladderName).toLowerCase() === id(ladder.name).toLowerCase() &&
              ladders.filter(
                (item) => id(item.name).toLowerCase() === id(ladder.name).toLowerCase(),
              ).length === 1,
        )
        const playerLadders = list(person.player?.ladderIds).map(id)
        const explicit = Array.isArray(explicitIds)
          ? explicitIds.map(id).some((value) => aliases.includes(value))
          : null
        const legacyPrimary =
          !Array.isArray(person.ladderMemberships) &&
          !Array.isArray(person.player?.ladderIds) &&
          ladder.id === primaryId &&
          person.player &&
          rankOf(person.player.rank)
        if (
          explicit === false ||
          !(membership || explicit || playerLadders.includes(id(ladder.id)) || legacyPrimary)
        )
          return null
        const rank =
          rankOf(membership?.position) ||
          (explicit || legacyPrimary || playerLadders.length === 1
            ? rankOf(person.player?.rank)
            : null)
        return { ...person, aliases, rank }
      })
      .filter(Boolean)
    const state = ladderStateFor({ clubId: club.id, ladderId: ladder.id }) || {}
    const removed = list(state.removedPlayerIds).map(id)
    const roster = memberships
      .filter((person) => !person.aliases.some((value) => removed.includes(value)))
      .sort((left, right) => (left.rank || Infinity) - (right.rank || Infinity))
    const order = list(state.order).map(id)
    if (order.length) {
      roster.sort((left, right) => {
        const position = (person) => {
          const index = order.findIndex((value) => person.aliases.includes(value))
          return index < 0 ? Infinity : index
        }
        return position(left) - position(right)
      })
      roster.forEach((person, index) => {
        person.rank = index + 1
      })
    }
    roster.forEach((person) => {
      person.challengePaused = list(state.pausedPlayerIds).some((value) =>
        person.aliases.includes(id(value)),
      )
    })
    const current =
      roster.find((person) => actorIds.some((value) => person.aliases.includes(value))) || null
    return { ladder, roster, current }
  })
  const context =
    contexts.find((item) => item.current?.rank) ||
    contexts.find((item) => item.ladder.id === primaryId) ||
    contexts[0]
  if (context) {
    const { ladder, roster, current } = context
    const ladderName = ladder.name || 'Your ladder'
    if (current?.rank) {
      const alreadyPlaying = list(challenges).some(
        (challenge) =>
          ACTIVE_LADDER_CHALLENGE_STATUSES.includes(challenge.status) &&
          [challenge.challengerId, challenge.defenderId].includes(current.id),
      )
      const canUseCreationFlow =
        canCreateChallenge &&
        challengeConfig?.id === ladder.id &&
        current.player?.id === actorId &&
        current.player.rank === current.rank &&
        !current.challengePaused &&
        !alreadyPlaying &&
        !['paused', 'closed', 'completed'].includes(
          ladder.seasonStatus || ladder.rules?.seasonStatus,
        )
      const opponents = canUseCreationFlow
        ? getEligibleLadderOpponents({
            challenger: current,
            players: roster.filter(
              (person) => person.player?.rank === person.rank && !person.challengePaused,
            ),
            challenges: list(challenges),
            config: challengeConfig,
          })
        : []
      return candidate(
        'ladder_position',
        30,
        'YOUR LADDER',
        `You’re #${current.rank} in ${ladderName}`,
        opponents.length
          ? `${opponents.length} ${opponents.length === 1 ? 'player is' : 'players are'} available to challenge.`
          : `${roster.length} ${roster.length === 1 ? 'player is' : 'players are'} on this ladder.`,
        opponents.length ? 'Challenge someone' : 'Open ladder',
        opponents.length ? 'create_challenge' : 'open_ladder',
        ladder.id,
      )
    }
    if (roster.length) {
      return candidate(
        'ladder_available',
        22,
        'YOUR CLUB',
        `${ladderName} is active`,
        `${roster.length} ${roster.length === 1 ? 'player is' : 'players are'} on this ladder. Open it to see the standings.`,
        'Open ladder',
        'open_ladder',
        ladder.id,
      )
    }
    if (isAdmin && !hasMembers) {
      return candidate(
        'ladder_needs_players',
        24,
        'GET STARTED',
        `${ladderName} is ready for players`,
        'Add your club members, then place them on the ladder.',
        'Add members',
        'add_members',
        ladder.id,
      )
    }
    return candidate(
      'ladder_needs_placement',
      24,
      'YOUR LADDER',
      `${ladderName} has no players yet`,
      isAdmin
        ? 'Your club members are already added. Open the ladder to manage player placement.'
        : 'Club members have not been placed on this ladder yet.',
      'Open ladder',
      'open_ladder',
      ladder.id,
    )
  }
  if (hasMembers) {
    return candidate(
      'club_needs_ladder',
      20,
      'YOUR CLUB',
      'No active ladder yet',
      isAdmin
        ? 'Your members are already added. Open the ladder area to manage your club’s ladders.'
        : `${clubName} has no active ladder yet.`,
      isAdmin ? 'Open ladder' : 'Open club',
      isAdmin ? 'open_ladder' : 'open_club',
    )
  }
  return candidate(
    'fresh_club',
    18,
    'WELCOME TO GORRA',
    `Welcome to ${clubName}, ${name}`,
    isAdmin
      ? 'Your club is ready. Add members when you’re ready to get things moving.'
      : 'There’s nothing you need to do yet. Club activity will appear here.',
    isAdmin ? 'Add members' : 'Open club',
    isAdmin ? 'add_members' : 'open_club',
  )
}
