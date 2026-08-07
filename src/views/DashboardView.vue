<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ClubActivityCard from '../components/dashboard/ClubActivityCard.vue'
import ClubOpportunityBanner from '../components/dashboard/ClubOpportunityBanner.vue'
import MemberLadderSnapshot from '../components/dashboard/MemberLadderSnapshot.vue'
import EmptyState from '../components/EmptyState.vue'
import { getActiveLadderConfig, isEligibleLadderOpponent } from '../config/ladder'
import { useAdminStore } from '../stores/admin'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import { isSafeImageSource } from '../utils/formSafety'

const COURT_IMAGES = Object.freeze([
  'https://res.cloudinary.com/dnuhjsckk/image/upload/v1777007467/tennis-court-render-3d-illustration-_2_do7vjj.jpg',
  'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=80',
])
const ACTIVE_CHALLENGE_STATES = new Set(['awaiting', 'scheduled', 'pending_review'])

const router = useRouter()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()

const hasLoaded = ref(false)
const loadNotice = ref('')

const currentPlayer = computed(() => playerStore.currentPlayer)
const sortedLadder = computed(() => playerStore.sortedLadder.filter((player) => Number(player.rank) > 0))
const isDashboardLoading = computed(() => !hasLoaded.value)
const ladderError = computed(() => playerStore.error || '')

const activeClub = computed(() => adminStore.activeClub)
const clubName = computed(() => activeClub.value?.name || 'Your tennis club')
const clubLogo = computed(() => {
  const logoUrl = activeClub.value?.setup?.workspace?.logoUrl || ''
  return isSafeImageSource(logoUrl) ? logoUrl : ''
})
const clubInitials = computed(() =>
  clubName.value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join(''),
)

function playerById(playerId) {
  return playerStore.players.find((player) => player.id === playerId) || null
}

function usableAvatar(player) {
  const image = player?.imageUrl || player?.image || ''
  return image && !image.includes('ui-avatars.com') ? image : ''
}

function firstName(name) {
  return String(name || 'Player').trim().split(/\s+/)[0]
}

function ladderMetric(player) {
  if (Number.isFinite(Number(player?.rating))) return `${Number(player.rating).toLocaleString()} rating`
  if (Number.isFinite(Number(player?.elo))) return `${Number(player.elo).toLocaleString()} rating`
  if (Number.isFinite(Number(player?.points))) return `${Number(player.points).toLocaleString()} points`
  return `${Number(player?.wins) || 0} wins`
}

function activeChallengeWith(playerId) {
  const currentId = playerStore.currentPlayerId
  return challengeStore.challenges.find(
    (challenge) =>
      ACTIVE_CHALLENGE_STATES.has(challenge.status) &&
      [challenge.challengerId, challenge.defenderId].includes(currentId) &&
      [challenge.challengerId, challenge.defenderId].includes(playerId),
  )
}

const ladderRows = computed(() => {
  const current = currentPlayer.value
  if (!current?.id || !Number(current.rank)) return []

  const currentIndex = sortedLadder.value.findIndex((player) => player.id === current.id)
  if (currentIndex < 0) return []

  const nearbyPlayers = [
    ...sortedLadder.value.slice(Math.max(0, currentIndex - 2), currentIndex),
    current,
    ...sortedLadder.value.slice(currentIndex + 1, currentIndex + 2),
  ]
  const eligibleIds = new Set(playerStore.availableOpponents.map((player) => player.id))
  const ladderConfig = getActiveLadderConfig()

  return nearbyPlayers.map((player) => {
    const isCurrent = player.id === current.id
    const existingChallenge = !isCurrent ? activeChallengeWith(player.id) : null
    const canChallenge = !isCurrent && eligibleIds.has(player.id) && !existingChallenge
    const canChallengeCurrent =
      !isCurrent && isEligibleLadderOpponent(player, current, ladderConfig)

    let status = 'Outside challenge range'
    if (isCurrent) status = 'Your position'
    else if (existingChallenge) status = 'Challenge active'
    else if (canChallengeCurrent) status = 'Can challenge you'

    return {
      id: player.id,
      rank: player.rank,
      name: isCurrent ? 'You' : player.name,
      avatarName: player.name,
      image: usableAvatar(player),
      metric: ladderMetric(player),
      isCurrent,
      canChallenge,
      status,
    }
  })
})

function activityPerson(playerId, fallbackName, fallbackImage = '') {
  const player = playerById(playerId)
  return {
    id: player?.id || playerId || fallbackName,
    name: player?.name || fallbackName || 'Club member',
    image: usableAvatar(player) || (fallbackImage?.includes('ui-avatars.com') ? '' : fallbackImage),
  }
}

function formatActivityTime(value) {
  if (!value) return 'Schedule pending'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Schedule pending'

  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const time = new Intl.DateTimeFormat('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  if (isToday) return `Today · ${time}`
  const day = new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' }).format(date)
  return `${day} · ${time}`
}

const activityCards = computed(() => {
  const currentId = playerStore.currentPlayerId
  const challenges = [...challengeStore.challenges]
  const matches = matchStore.matches.filter((match) => !match.isBye)

  if (!challenges.length && !matches.length) return []

  const challenge =
    challenges.find(
      (item) => item.defenderId === currentId && ACTIVE_CHALLENGE_STATES.has(item.status),
    ) ||
    challenges.find((item) => ACTIVE_CHALLENGE_STATES.has(item.status)) ||
    challenges[0]

  const personalScheduledMatch = matches.find(
    (match) =>
      ['scheduled', 'pending'].includes(match.status) &&
      [match.challengerId, match.defenderId, match.player1Id, match.player2Id].includes(currentId),
  )
  const scheduledMatch =
    personalScheduledMatch ||
    matches.find((match) => ['scheduled', 'pending'].includes(match.status)) ||
    matches[0]

  const challengePeople = challenge
    ? [
        activityPerson(challenge.challengerId, challenge.challengerName, challenge.challengerImage),
        activityPerson(challenge.defenderId, challenge.defenderName, challenge.defenderImage),
      ]
    : [
        activityPerson(scheduledMatch?.challengerId, scheduledMatch?.challengerName),
        activityPerson(scheduledMatch?.defenderId, scheduledMatch?.defenderName),
      ]

  const matchPlayerOneId = scheduledMatch?.player1Id || scheduledMatch?.challengerId
  const matchPlayerTwoId = scheduledMatch?.player2Id || scheduledMatch?.defenderId
  const matchPlayerOneName = scheduledMatch?.player1Name || scheduledMatch?.challengerName || 'Player one'
  const matchPlayerTwoName = scheduledMatch?.player2Name || scheduledMatch?.defenderName || 'Player two'
  const movementPlayer = sortedLadder.value[2] || currentPlayer.value || sortedLadder.value[0]
  const movementPartner = sortedLadder.value.find((player) => player.id !== movementPlayer?.id)

  return [
    {
      id: `challenge-${challenge?.id || scheduledMatch?.id || 'club'}`,
      type: 'challenge',
      category: 'Best of 3',
      title: `${firstName(challengePeople[0]?.name)} vs ${firstName(challengePeople[1]?.name)}`,
      location: challenge?.court || 'Emerald Courts',
      chip:
        challenge?.defenderId === currentId && challenge?.status === 'awaiting'
          ? 'Challenge received'
          : challenge?.statusLabel || 'Challenge update',
      tone: 'amber',
      image: COURT_IMAGES[0],
      people: challengePeople,
      to: { name: 'Challenges' },
    },
    {
      id: `match-${scheduledMatch?.id || 'club'}`,
      type: 'match',
      category: scheduledMatch?.type === 'tournament' ? 'Tournament match' : 'Friendly match',
      title: `${firstName(matchPlayerOneName)} vs ${firstName(matchPlayerTwoName)}`,
      location: scheduledMatch?.court || 'Center Court',
      chip: formatActivityTime(
        scheduledMatch?.scheduledAt ||
          (scheduledMatch?.scheduledDate
            ? `${scheduledMatch.scheduledDate}T${scheduledMatch.scheduledTime || '16:00'}:00`
            : ''),
      ),
      tone: 'green',
      image: COURT_IMAGES[1],
      people: [
        activityPerson(matchPlayerOneId, matchPlayerOneName, scheduledMatch?.challengerImage),
        activityPerson(matchPlayerTwoId, matchPlayerTwoName, scheduledMatch?.defenderImage),
      ],
      to: scheduledMatch?.tournamentId
        ? {
            name: 'TournamentMatchDetails',
            params: {
              tournamentId: scheduledMatch.tournamentId,
              matchId: scheduledMatch.id,
            },
          }
        : scheduledMatch?.id
          ? { name: 'MatchDetails', params: { matchId: scheduledMatch.id } }
          : { name: 'Challenges' },
    },
    {
      id: `movement-${movementPlayer?.id || 'club'}`,
      type: 'movement',
      category: 'Ladder movement',
      title: `${firstName(movementPlayer?.name)} moved to Rank #${movementPlayer?.rank || '—'}`,
      location: '',
      chip: 'View movement',
      tone: 'green',
      image: COURT_IMAGES[2],
      people: [
        activityPerson(movementPlayer?.id, movementPlayer?.name),
        activityPerson(movementPartner?.id, movementPartner?.name),
      ],
      to: { name: 'Rankings' },
    },
  ]
})

const openTournament = computed(
  () =>
    tournamentStore.tournaments.find((tournament) =>
      ['active', 'open', 'registration_open'].includes(tournament.status),
    ) ||
    (['active', 'open', 'registration_open'].includes(tournamentStore.activeTournament?.status)
      ? tournamentStore.activeTournament
      : null),
)

function formatOpportunityDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric' }).format(date)
}

const clubOpportunity = computed(() => {
  const tournament = openTournament.value
  if (!tournament) return null

  const start = formatOpportunityDate(
    tournament.registrationStart || tournament.entryStart || tournament.roundRobinStart,
  )
  const end = formatOpportunityDate(
    tournament.registrationEnd || tournament.entryEnd || tournament.finalDate || tournament.roundRobinEnd,
  )
  const range = start && end ? `${start} – ${end}` : start || end

  return {
    id: tournament.id,
    title: tournament.name?.toLowerCase().includes('championship')
      ? tournament.name
      : 'Club Championship',
    supportingText: range ? `Entries open · ${range}` : 'Entries are open now',
  }
})

function startChallenge(player) {
  if (!player?.id) return
  router.push({ name: 'CreateChallenge', query: { opponent: player.id } })
}

function openActivity(activity) {
  if (activity?.to) router.push(activity.to)
}

function enterOpportunity() {
  if (clubOpportunity.value?.id) {
    router.push({ name: 'TournamentOverview', params: { tournamentId: clubOpportunity.value.id } })
  }
}

onMounted(async () => {
  const tasks = [
    playerStore.loadPlayers(),
    challengeStore.loadChallenges(),
    matchStore.loadMatches(),
    tournamentStore.fetchTournaments(),
  ]
  if (!adminStore.clubs.length) tasks.push(adminStore.loadClubs())

  await Promise.allSettled(tasks)
  const errors = [
    playerStore.error,
    challengeStore.error,
    matchStore.error,
    tournamentStore.error,
    adminStore.error,
  ].filter(Boolean)
  loadNotice.value = errors.length
    ? 'Some club updates could not be refreshed. The latest available information is shown.'
    : ''
  hasLoaded.value = true
})
</script>

<template>
  <main class="member-home">
    <header class="member-home__identity">
      <div class="member-home__badge">
        <img v-if="clubLogo" :src="clubLogo" :alt="`${clubName} logo`" />
        <span v-else aria-hidden="true">{{ clubInitials || 'G' }}</span>
      </div>
      <div>
        <p>{{ clubName }}</p>
        <h1>Home</h1>
      </div>
    </header>

    <p v-if="loadNotice" class="member-home__notice" role="status">{{ loadNotice }}</p>

    <MemberLadderSnapshot
      :rows="ladderRows"
      :loading="isDashboardLoading"
      :error="ladderError"
      @challenge="startChallenge"
    />

    <section class="member-home__activity" aria-labelledby="club-activity-title">
      <header class="member-home__section-header">
        <h2 id="club-activity-title">What’s happening</h2>
        <RouterLink :to="{ name: 'Notifications' }">See all</RouterLink>
      </header>

      <div v-if="isDashboardLoading" class="member-home__activity-skeleton" aria-label="Club activity loading">
        <span v-for="card in 3" :key="card"></span>
      </div>

      <div
        v-else-if="activityCards.length"
        class="member-home__activity-rail"
        role="region"
        aria-label="Recent club activity"
        tabindex="0"
      >
        <ClubActivityCard
          v-for="activity in activityCards"
          :key="activity.id"
          :activity="activity"
          @open="openActivity"
        />
      </div>

      <div v-else class="member-home__activity-empty">
        <EmptyState
          compact
          icon="matches"
          title="No club activity yet"
          description="Challenges, match times, and ladder movement will appear here."
        />
      </div>
    </section>

    <ClubOpportunityBanner
      v-if="clubOpportunity"
      :opportunity="clubOpportunity"
      @open="enterOpportunity"
    />
  </main>
</template>

<style scoped>
.member-home {
  display: grid;
  width: min(100%, 960px);
  margin-inline: auto;
  gap: 26px;
  padding: 6px 0 30px;
}

.member-home__identity {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 2px 2px 0;
}

.member-home__badge {
  display: grid;
  width: 54px;
  height: 54px;
  flex: 0 0 54px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(0, 181, 26, 0.16);
  border-radius: 50%;
  background: rgba(0, 181, 26, 0.09);
  color: var(--color-primary-strong);
  font-size: 15px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
}

.member-home__badge img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-home__identity p,
.member-home__identity h1 {
  margin: 0;
}

.member-home__identity p {
  overflow: hidden;
  color: var(--color-primary-strong);
  font-size: 12.5px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-home__identity h1 {
  margin-top: 2px;
  color: var(--color-text);
  font-size: clamp(32px, 4vw, 42px);
  letter-spacing: -0.045em;
  line-height: 1.05;
}

.member-home__notice {
  margin: -10px 0 0;
  border: 1px solid rgba(255, 180, 0, 0.24);
  border-radius: var(--app-inner-radius);
  padding: 10px 12px;
  background: rgba(255, 211, 61, 0.12);
  color: #6c570e;
  font-size: 12px;
  line-height: 1.45;
}

.member-home__activity {
  min-width: 0;
}

.member-home__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 13px;
  padding-inline: 2px;
}

.member-home__section-header h2 {
  margin: 0;
  font-size: clamp(19px, 2vw, 23px);
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.member-home__section-header a {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  color: var(--color-primary-strong);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.member-home__section-header a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.member-home__activity-rail,
.member-home__activity-skeleton {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}

.member-home__activity-rail:focus-visible {
  border-radius: var(--app-card-radius);
  outline: 2px solid var(--focus-ring);
  outline-offset: 4px;
}

.member-home__activity-skeleton span {
  display: block;
  min-height: 246px;
  border-radius: calc(var(--app-card-radius) * 1.8);
  background: var(--color-skeleton);
}

.member-home__activity-empty {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--app-card-radius) * 1.8);
  background: var(--color-surface);
}

@media (max-width: 767px) {
  .member-home {
    gap: 22px;
    padding: 2px 0 22px;
  }

  .member-home__identity {
    gap: 11px;
  }

  .member-home__badge {
    width: 48px;
    height: 48px;
    flex-basis: 48px;
    font-size: 13px;
  }

  .member-home__identity p {
    font-size: 11px;
  }

  .member-home__identity h1 {
    font-size: 33px;
  }

  .member-home__activity-rail,
  .member-home__activity-skeleton {
    display: flex;
    width: 100%;
    gap: 9px;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }

  .member-home__activity-rail::-webkit-scrollbar,
  .member-home__activity-skeleton::-webkit-scrollbar {
    display: none;
  }

  .member-home__activity-rail > *,
  .member-home__activity-skeleton > * {
    width: 43.5%;
    min-width: 43.5%;
    flex: 0 0 43.5%;
  }

  .member-home__activity-skeleton span {
    min-height: 226px;
  }
}

@media (max-width: 390px) {
  .member-home__activity-rail > *,
  .member-home__activity-skeleton > * {
    width: 44%;
    min-width: 44%;
    flex-basis: 44%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .member-home__activity-rail {
    scroll-behavior: auto;
  }
}
</style>
