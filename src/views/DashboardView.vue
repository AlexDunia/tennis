<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { useNotificationStore } from '../stores/notification'
import { usePlayerStore } from '../stores/player'
import { useBookingStore } from '../stores/booking'
import { useTournamentStore } from '../stores/tournament'
import { formatAppDateWithTime } from '../utils/dateFormat'
import PerformanceChart from '@/components/charts/PerformanceChart.vue'

const router = useRouter()

const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const notificationStore = useNotificationStore()
const bookingStore = useBookingStore()
const tournamentStore = useTournamentStore()
const hasLoaded = ref(false)

const currentPlayer = computed(() => playerStore.currentPlayer)
const isDashboardLoading = computed(() => !hasLoaded.value)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const firstName = computed(() => {
  const name = currentPlayer.value?.name || ''
  return name.split(' ')[0] || 'Player'
})

const matchesPlayed = computed(() => {
  if (currentPlayer.value) {
    return (currentPlayer.value.wins || 0) + (currentPlayer.value.losses || 0)
  }
  return matchStore.matches.length
})

const winRate = computed(() => {
  const total = (currentPlayer.value?.wins || 0) + (currentPlayer.value?.losses || 0)
  return total ? Math.round((currentPlayer.value.wins / total) * 100) : 0
})

const winStreak = computed(() => {
  const playerMatches = [...matchStore.matches].reverse()
  let streak = 0
  for (const m of playerMatches) {
    if (m.winnerId === playerStore.currentPlayerId) streak++
    else break
  }
  return streak
})

const performanceNote = computed(() => {
  if (winRate.value >= 70)
    return `You're on fire 🔥 — top ${100 - winRate.value}% of players this month.`
  if (winRate.value >= 50) return `Solid form. One more push and you crack the top 10.`
  return `Every loss is data. Your comeback arc starts here.`
})

const upcomingMatches = computed(() => matchStore.scheduledMatches.length)
const challengeSummary = computed(() => challengeStore.summaryCounts)
const activeTournament = computed(() => tournamentStore.activeTournament)
const activeTournamentMatches = computed(() =>
  activeTournament.value
    ? matchStore.matches.filter((match) => match.tournamentId === activeTournament.value.id && !match.isBye)
    : [],
)
const completedTournamentMatches = computed(() =>
  activeTournamentMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)),
)
const pendingTournamentMatches = computed(() =>
  activeTournamentMatches.value.filter((match) => ['pending', 'scheduled', 'waiting'].includes(match.status)),
)
const currentPlayerTournamentEntry = computed(() => {
  if (!activeTournament.value || !playerStore.currentPlayerId) {
    return null
  }

  for (const category of activeTournament.value.categories || []) {
    for (const group of category.groups || []) {
      const player = group.players.find((entry) => entry.playerId === playerStore.currentPlayerId)
      if (player) {
        return { category, group, player }
      }
    }
  }

  return null
})
const currentPlayerTournamentMatches = computed(() =>
  activeTournamentMatches.value.filter(
    (match) => match.player1Id === playerStore.currentPlayerId || match.player2Id === playerStore.currentPlayerId,
  ),
)
const currentPlayerPendingTournamentMatches = computed(() =>
  currentPlayerTournamentMatches.value.filter((match) => ['pending', 'scheduled'].includes(match.status)),
)
const currentPlayerCompletedTournamentMatches = computed(() =>
  currentPlayerTournamentMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)),
)
const nextTournamentMatch = computed(() => {
  const source = currentPlayerTournamentMatches.value.length
    ? currentPlayerTournamentMatches.value
    : activeTournamentMatches.value

  return [...source]
    .filter((match) => ['pending', 'scheduled'].includes(match.status))
    .sort((matchA, matchB) => {
      const timeA = matchA.scheduledAt ? new Date(matchA.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER
      const timeB = matchB.scheduledAt ? new Date(matchB.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER
      return timeA - timeB
    })[0] || null
})
const tournamentDashboardCopy = computed(() => {
  if (!activeTournament.value) {
    return 'No active tournament is running right now.'
  }

  if (currentPlayerTournamentEntry.value) {
    return `${firstName.value}, you are in ${currentPlayerTournamentEntry.value.category.name}, ${currentPlayerTournamentEntry.value.group.name}, seed #${currentPlayerTournamentEntry.value.player.seed}.`
  }

  if (playerStore.isCurrentPlayerAdmin) {
    return `${firstName.value}, your admin view has ${pendingTournamentMatches.value.length} matches still waiting for action.`
  }

  return `${firstName.value}, you are not listed in this draw yet, but you can follow the tournament live.`
})
const tournamentDashboardStats = computed(() => {
  if (currentPlayerTournamentEntry.value) {
    return [
      { label: 'Your pending', value: currentPlayerPendingTournamentMatches.value.length },
      { label: 'Your completed', value: currentPlayerCompletedTournamentMatches.value.length },
      { label: 'Seed', value: `#${currentPlayerTournamentEntry.value.player.seed}` },
    ]
  }

  return [
    { label: 'Needs scores', value: pendingTournamentMatches.value.length },
    { label: 'Completed', value: completedTournamentMatches.value.length },
    { label: 'Divisions', value: activeTournament.value?.categories.length || 0 },
  ]
})
const tournamentProgress = computed(() => {
  const total = activeTournamentMatches.value.length
  return total ? Math.round((completedTournamentMatches.value.length / total) * 100) : 0
})

const urgentActions = computed(() => [
  { label: 'Pending challenges', value: challengeSummary.value.awaiting },
  { label: 'Matches to play', value: upcomingMatches.value },
  { label: 'Awaiting review', value: challengeSummary.value.pendingReview },
])
const dashboardUnreadCount = computed(() => notificationStore.unreadCount)

const isCurrentPlayerMatch = (match) =>
  Boolean(
    playerStore.currentPlayerId &&
      (match.player1Id === playerStore.currentPlayerId ||
        match.player2Id === playerStore.currentPlayerId ||
        match.challengerId === playerStore.currentPlayerId ||
        match.defenderId === playerStore.currentPlayerId),
  )

const getEventTime = (item) =>
  item.updatedAt || item.completedAt || item.scheduledAt || item.createdAt || item.time || new Date(0).toISOString()

const dashboardNotifications = computed(() => {
  const storedNotifications = notificationStore.recentNotifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    time: notification.time,
    read: notification.read,
    meta: notification.meta || {},
  }))

  const matchEvents = matchStore.matches
    .filter((match) => !match.isBye)
    .filter((match) => {
      if (isCurrentPlayerMatch(match)) {
        return ['scheduled', 'pending_review', 'completed', 'walkover'].includes(match.status)
      }

      return match.type === 'tournament' && ['completed', 'walkover'].includes(match.status)
    })
    .map((match) => {
      const personal = isCurrentPlayerMatch(match)
      const winnerName =
        match.winnerName || (match.winnerId === match.player1Id ? match.player1Name : match.player2Name)
      const categoryLabel = match.categoryName || match.categoryId || 'Tournament'

      return {
        id: `match-${match.id}-${match.status}`,
        title: personal ? 'Your match updated' : `${categoryLabel} score update`,
        message: personal
          ? `${match.player1Name || match.challengerName} vs ${match.player2Name || match.defenderName} is ${match.statusLabel || match.status}.`
          : `${winnerName || 'A player'} won ${match.score || 'the match'}.`,
        type: personal ? 'success' : 'info',
        time: getEventTime(match),
        read: true,
        meta: {
          matchId: match.id,
          tournamentId: match.tournamentId,
          categoryId: match.categoryId,
        },
      }
    })

  const challengeEvents = challengeStore.challenges
    .filter(
      (challenge) =>
        challenge.challengerId === playerStore.currentPlayerId ||
        challenge.defenderId === playerStore.currentPlayerId,
    )
    .map((challenge) => ({
      id: `challenge-${challenge.id}-${challenge.status}`,
      title: 'Challenge update',
      message: `${challenge.challengerName} vs ${challenge.defenderName} is ${challenge.statusLabel || challenge.status}.`,
      type: challenge.status === 'pending' ? 'warning' : 'info',
      time: getEventTime(challenge),
      read: true,
      meta: {
        challengeId: challenge.id,
      },
    }))

  const seen = new Set()
  return [...storedNotifications, ...matchEvents, ...challengeEvents]
    .filter((item) => {
      const key = item.meta?.matchId ? `match:${item.meta.matchId}:${item.title}` : item.id
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6)
})

const openCreate = () => router.push({ name: 'CreateChallenge' })
const openTournament = () => {
  if (activeTournament.value) {
    router.push(`/tournaments/${activeTournament.value.id}`)
  }
}
const openTournamentCategory = () => {
  if (!activeTournament.value) {
    return
  }

  if (currentPlayerTournamentEntry.value) {
    router.push(`/tournaments/${activeTournament.value.id}/category/${currentPlayerTournamentEntry.value.category.id}`)
    return
  }

  router.push(`/tournaments/${activeTournament.value.id}`)
}
const openTournamentMatch = (match) => {
  if (match?.id && match?.tournamentId) {
    router.push(`/tournaments/${match.tournamentId}/match/${match.id}`)
  }
}
const openDashboardNotification = (notification) => {
  if (notification?.meta?.tournamentId && notification?.meta?.matchId) {
    router.push(`/tournaments/${notification.meta.tournamentId}/match/${notification.meta.matchId}`)
    return
  }

  if (notification?.meta?.matchId) {
    router.push({ name: 'MatchDetails', params: { matchId: notification.meta.matchId } })
    return
  }

  if (notification?.meta?.tournamentId) {
    router.push(`/tournaments/${notification.meta.tournamentId}`)
    return
  }

  if (notification?.meta?.challengeId) {
    router.push('/challenges')
  }
}
const getTournamentCategoryName = (categoryId) =>
  activeTournament.value?.categories.find((category) => category.id === categoryId)?.name || categoryId
const formatTournamentMatchDate = (match) =>
  formatAppDateWithTime(match?.scheduledDate, match?.scheduledTime, { fallback: 'Schedule pending' })

onMounted(async () => {
  try {
    await Promise.all([
      playerStore.loadPlayers(),
      challengeStore.loadChallenges(),
      matchStore.loadMatches(),
      bookingStore.loadBookings(),
      tournamentStore.fetchTournaments(),
    ])
  } finally {
    hasLoaded.value = true
  }
})
</script>

<template>
  <section class="dashboard">
    <!-- ── HERO SECTION ─────────────────────────────────
         No section label here — the greeting IS the header.
         World-class pattern: hero speaks for itself.
    ──────────────────────────────────────────────────── -->
    <section class="hero">
      <div class="hero-scrim"></div>
      <div class="hero-top">
        <div class="hero-copy">
          <!-- <p class="hero__eyebrow">{{ greeting }}, {{ currentPlayer?.name }} 👋</p> -->
          <h1 class="hero__title">{{ greeting }}, {{ firstName }} 👋</h1>
          <p class="hero__subtitle">
            You are Ranked <strong class="rank-badge">#{{ currentPlayer?.rank }}</strong>
          </p>
          <div class="hero__stats" v-if="winStreak > 1">
            <div class="stat-pill">
              <span>Streak</span>
              <strong class="streak">{{ winStreak }} wins 🔥</strong>
            </div>
          </div>
        </div>

        <button class="cta button-primary" @click="openCreate">
          <span class="cta-icon">⚡</span> Start Challenge
        </button>
      </div>

      <!-- slight breathing room above the glass row -->
      <div class="kpi inside">
        <div class="card glass">
          <span class="kpi-label">Matches</span>
          <strong class="kpi-number">{{ matchesPlayed }}</strong>
          <span class="kpi-trend">+2 this week</span>
        </div>

        <div class="card glass">
          <span class="kpi-label">Wins</span>
          <strong class="kpi-number">{{ currentPlayer?.wins }}</strong>
        </div>

        <div class="card glass">
          <span class="kpi-label">Losses</span>
          <strong class="kpi-number">{{ currentPlayer?.losses }}</strong>
        </div>

        <div class="card glass">
          <span class="kpi-label">Win Rate</span>
          <strong class="kpi-number">{{ winRate }}%</strong>
        </div>
      </div>
    </section>

    <section class="stats-source-panel">
      <article>
        <span>Ladder profile</span>
        <strong>Rank #{{ currentPlayer?.rank || '-' }} · {{ winRate }}% win rate</strong>
        <small>Source: player profile and ladder match history.</small>
      </article>
      <article>
        <span>Tournament draw</span>
        <strong>
          {{
            currentPlayerTournamentEntry
              ? `${currentPlayerTournamentEntry.category.name}, seed #${currentPlayerTournamentEntry.player.seed}`
              : playerStore.isCurrentPlayerAdmin
                ? 'Admin control view'
                : 'Not listed in active draw'
          }}
        </strong>
        <small>Source: tournament groups, fixtures, and standings.</small>
      </article>
    </section>

    <!-- ── OVERVIEW SECTION ────────────────────────────
         Section label added: groups Action Required +
         Performance chart under one named category.
    ──────────────────────────────────────────────────── -->
    <div class="section-group">
      <div class="section-group__header">
        <span class="section-group__label">Overview</span>
      </div>

      <section v-if="isDashboardLoading" class="grid dashboard-skeleton-grid">
        <section class="card dashboard-skeleton-card">
          <span class="dashboard-skeleton-line"></span>
          <span class="dashboard-skeleton-line"></span>
          <span class="dashboard-skeleton-line"></span>
        </section>
        <section class="card dashboard-skeleton-card">
          <span class="dashboard-skeleton-line"></span>
          <span class="dashboard-skeleton-line"></span>
          <span class="dashboard-skeleton-line"></span>
        </section>
        <section class="card dashboard-skeleton-card">
          <span class="dashboard-skeleton-line"></span>
          <span class="dashboard-skeleton-line"></span>
          <span class="dashboard-skeleton-line"></span>
        </section>
      </section>

      <section v-else class="grid">
        <section class="card">
          <h3 class="section-title">Action Required</h3>
          <div class="divider"></div>

          <div class="action-row" v-for="item in urgentActions" :key="item.label">
            <span class="action-left">
              <span :class="['dot', item.value ? 'dot-danger' : 'dot-muted']"></span>
              {{ item.label }}
            </span>
            <strong :class="item.value ? 'val-danger' : 'val-muted'">{{ item.value }}</strong>
          </div>

          <div class="action-footer">
            <span
              >{{ challengeSummary.awaiting + challengeSummary.pendingReview }} items need your
              attention</span
            >
          </div>
        </section>

        <section v-if="activeTournament" class="card tournament-action-card">
          <div class="tournament-action-card__top">
            <div>
              <span class="tournament-action-card__kicker">Tournament pulse</span>
              <h3 class="section-title">Your tournament lane</h3>
            </div>
            <strong>{{ tournamentProgress }}%</strong>
          </div>
          <div class="divider"></div>
          <strong>{{ activeTournament.name }}</strong>
          <span>{{ tournamentDashboardCopy }}</span>

          <div class="tournament-action-card__stats">
            <div v-for="item in tournamentDashboardStats" :key="item.label">
              <small>{{ item.label }}</small>
              <b>{{ item.value }}</b>
            </div>
          </div>

          <button
            v-if="nextTournamentMatch"
            class="tournament-action-card__next"
            type="button"
            @click="openTournamentMatch(nextTournamentMatch)"
          >
            <span>
              Next: {{ getTournamentCategoryName(nextTournamentMatch.categoryId) }}
              {{ nextTournamentMatch.groupId ? `Group ${nextTournamentMatch.groupId}` : nextTournamentMatch.matchCode || '' }}
            </span>
            <strong>{{ formatTournamentMatchDate(nextTournamentMatch) }}</strong>
          </button>

          <div class="tournament-action-card__actions">
            <button type="button" class="button-primary" @click="openTournamentCategory">
              {{ currentPlayerTournamentEntry ? 'Open my division' : 'Open tournament' }}
            </button>
            <button type="button" class="button-secondary tournament-action-card__ghost" @click="openTournament">
              Overview
            </button>
          </div>
        </section>

        <section class="card dashboard-performance-card">
          <PerformanceChart
            :matches="matchStore.matches"
            :currentPlayerId="playerStore.currentPlayerId"
          />
          <div class="insights">
            <span>📊 {{ matchStore.matches.length }} total matches</span>
            <span>🗓 {{ upcomingMatches }} upcoming</span>
          </div>
        </section>
      </section>
    </div>

    <section v-if="!isDashboardLoading" class="card dashboard-alerts">
      <div class="activity-header">
        <div>
          <span class="dashboard-alerts__kicker">Notifications</span>
          <h3 class="section-title">Recent activity</h3>
        </div>
        <span class="activity-count">{{ dashboardUnreadCount }} unread</span>
      </div>
      <div class="divider"></div>

      <div v-if="dashboardNotifications.length" class="dashboard-alerts__list">
        <article
          v-for="notification in dashboardNotifications"
          :key="notification.id"
          :class="['dashboard-alerts__item', { 'dashboard-alerts__item--unread': !notification.read }]"
          @click="openDashboardNotification(notification)"
        >
          <span>{{ notification.type === 'success' ? 'Score' : notification.type }}</span>
          <div>
            <strong>{{ notification.title }}</strong>
            <small>{{ notification.message }}</small>
          </div>
        </article>
      </div>
      <p v-else class="dashboard-alerts__empty">
        Score updates, ranking changes, and tournament notices will appear here.
      </p>
    </section>

  </section>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');

/*
  TYPE SCALE — all Poppins
  ─────────────────────────────────────────────────────
  Hero title            800  #fff                  full
  Section title h3      600  #111827               full
  Body / row label      500  #374151               87%
  Supporting / sub      500  #6b7280               55%
  Meta / ghost          400  #9ca3af               38%
  Eyebrow caps (hero)   600  rgba(255,255,255,.72)
  ─────────────────────────────────────────────────────
*/

* {
  font-family: 'Poppins', sans-serif;
}

.dashboard {
  display: grid;
  gap: 32px;
  width: 100%;
  max-width: 1140px;
  margin: 0 auto;
  padding: 8px 0 40px;
}

/* ─── HERO ──────────────────────────────────────────── */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: clamp(180px, 34vw, 300px);
  /* tighter bottom padding for a sharper hero layout */
  padding: 10px 28px 2px 28px;
  border-radius: 16px;
  overflow: hidden;
  border: 0.5px solid rgba(255, 255, 255, 0.16);
  box-shadow: none;
  color: #fff;
}

/* background image layer */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('https://res.cloudinary.com/dnuhjsckk/image/upload/v1777007467/tennis-court-render-3d-illustration-_2_do7vjj.jpg');
  background-size: cover;
  background-position: center;
  filter: brightness(0.75);
  z-index: 0;
}

/* green brand gradient overlay at ~4% opacity */
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 184, 74, 0.04);
  z-index: 0;
}

/* dark scrim for text readability — sits on top of green overlay */
.hero .hero-scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.34);
  z-index: 0;
}

.hero * {
  position: relative;
  z-index: 1;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  /* keep the top section balanced while tightening the hero height */
  padding-top: 28px;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Eyebrow — supporting, clearly secondary */
.hero__eyebrow {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  margin: 0 0 2px;
}

/* Title — primary, strongest element on page */
.hero__title {
  font-size: clamp(18px, 5vw, 32px);
  font-weight: 800;
  color: #ffffff;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0;
  text-shadow: none;
}

/* Subtitle — mid-tier, one step below title */
.hero__subtitle {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  margin: 2px 0 0;
  line-height: 1.5;
  text-shadow: none;
}

.rank-badge {
  color: #4ade80;
  font-weight: 700;
  text-shadow: none;
}

.hero__stats {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 10px;
  padding: 7px 13px;
  min-width: 72px;
}

.stat-pill span {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
  text-shadow: none;
}

.stat-pill strong {
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
  text-shadow: none;
  margin-top: 1px;
}

.streak {
  color: #fde68a !important;
}

/* ─── CTA — green brand gradient ───────────────────── */
.cta {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 38px;
  padding: 0 20px;
  border-radius: 8px;
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
  cursor: pointer;
  white-space: nowrap;
  margin-top: 18px;
}

.cta:hover {
  box-shadow: none;
}

.cta-icon {
  font-size: 13px;
}

/* ─── KPI GLASS ROW ─────────────────────────────────
   margin-top adds the breathing room above the 4 cards
──────────────────────────────────────────────────── */
.kpi.inside {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 6px; /* breathing space between hero text and glass cards */
  padding-bottom: 12px; /* tighter hero bottom padding */
}

/* Glass cards — more transparent, tighter height */
.card.glass {
  min-width: 0;
  /* brand green tint at ~4% opacity instead of plain white */
  background: rgba(0, 184, 74, 0.04);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(2.5px);
  border: 0.5px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  padding: 8px 14px 10px; /* asymmetric: less top, slightly more bottom */
  display: flex;
  flex-direction: column;
  gap: 1px;
  box-shadow: none;
}

/* KPI label — ghost, lowest tier */
.kpi-label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
  text-shadow: none;
}

/* KPI number — all white, bold */
.kpi-number {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-shadow: none;
}

/* KPI trend — faintest */
.kpi-trend {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.52);
  text-shadow: none;
  margin-top: 1px;
}

/* ─── NORMAL CARDS ──────────────────────────────────── */
.card {
  min-width: 0;
  background: #ffffff;
  padding: 22px;
  border-radius: 14px;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  box-shadow: none;
  animation: dashboardCardIn 260ms ease both;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.card:hover {
  border-color: rgba(0, 200, 83, 0.22);
  box-shadow: none;
  transform: none;
}

/* ─── SECTION GROUP (Overview label row) ───────────────
   Lightweight label + divider that categorises the
   Action Required + Performance grid beneath it.
   Pattern used by Linear, Vercel, Stripe dashboards.
──────────────────────────────────────────────────── */
.section-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-group__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-group__label {
  margin-top: 27px;
  margin-bottom: 20px;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #b8b1b1;
}

.section-group__header::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0, 0, 0, 0.07);
}

/* ─── GRID ──────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: minmax(240px, 0.9fr) minmax(320px, 1fr) minmax(360px, 1.25fr);
  gap: 24px;
  align-items: start;
}

.stats-source-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.stats-source-panel article {
  display: grid;
  gap: 0.35rem;
  border: 0.5px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  padding: 1.25rem;
  background: #ffffff;
}

.stats-source-panel span,
.dashboard-alerts__kicker {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stats-source-panel strong {
  color: #111827;
  font-size: 14px;
}

.stats-source-panel small {
  color: #6b7280;
  font-size: 13px;
  line-height: 1.45;
}

/* ─── SECTION TITLES (inside white cards) ───────────── */
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  letter-spacing: -0.01em;
  margin: 0;
}

.divider {
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  margin: 12px 0 16px;
}

/* ─── ACTION ROWS ───────────────────────────────────── */
.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.action-row:last-of-type {
  border-bottom: none;
}

.action-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-danger {
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}
.dot-muted {
  background: #d1d5db;
}

.val-danger {
  color: #ef4444;
  font-size: 15px;
  font-weight: 700;
}
.val-muted {
  color: #9ca3af;
  font-size: 15px;
  font-weight: 600;
}

.action-footer {
  margin-top: 14px;
  padding: 10px 12px;
  background: #f9fafb;
  border: 0.5px solid rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 500;
  color: #9ca3af;
  text-align: center;
  overflow-wrap: anywhere;
}

.tournament-action-card {
  display: grid;
  align-content: start;
  gap: 0.75rem;
  overflow: hidden;
  position: relative;
}

.tournament-action-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: #00c853;
}

.tournament-action-card__top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.tournament-action-card__top > strong {
  border-radius: 999px;
  padding: 0.32rem 0.58rem;
  background: rgba(0, 200, 83, 0.08);
  color: #087524;
  font-size: 0.8rem;
  white-space: nowrap;
}

.tournament-action-card__kicker {
  display: block;
  margin-bottom: 0.25rem;
  color: #9ca3af;
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tournament-action-card > strong {
  color: #111827;
  font-size: 0.98rem;
}

.tournament-action-card > span {
  color: #6b7280;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.45;
}

.tournament-action-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.tournament-action-card__stats div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  border: 0.5px solid rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 0.7rem;
  background: #f8fafc;
  overflow: hidden;
}

.tournament-action-card__stats small {
  color: #9ca3af;
  font-size: 0.67rem;
  font-weight: 800;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.tournament-action-card__stats b {
  color: #111827;
  font-size: 1rem;
}

.tournament-action-card__next {
  display: grid;
  justify-items: start;
  width: 100%;
  border: 0.5px solid rgba(29, 111, 181, 0.16) !important;
  border-radius: 8px !important;
  padding: 0.75rem !important;
  background: #e8f0fb !important;
  color: #1d6fb5 !important;
  text-align: left;
  overflow: hidden;
}

.tournament-action-card__next span {
  color: #1d6fb5;
  font-size: 0.78rem;
  font-weight: 900;
}

.tournament-action-card__next strong {
  margin-top: 0.2rem;
  color: #23415f;
  font-size: 0.78rem;
}

.tournament-action-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tournament-action-card button {
  justify-self: start;
  min-width: 0;
  flex: 1 1 136px;
  padding: 0.65rem 0.85rem;
  font-weight: 800;
  transition:
    background 0.16s ease;
}

.tournament-action-card button:hover {
  box-shadow: none;
  transform: none;
}

.tournament-action-card__ghost {
  background: #f3f4f6 !important;
  color: #374151 !important;
}

.dashboard-skeleton-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-skeleton-card {
  display: grid;
  gap: 0.8rem;
}

.dashboard-skeleton-card--wide {
  min-height: 170px;
}

.dashboard-skeleton-line {
  display: block;
  height: 15px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f3f4f6 20%, #e5e7eb 42%, #f8fafc 62%, #f3f4f6 84%);
  background-size: 200% 100%;
  animation: dashboardShimmer 1.4s linear infinite;
}

.dashboard-skeleton-line:nth-child(1) {
  width: 74%;
}

.dashboard-skeleton-line:nth-child(2) {
  width: 92%;
}

.dashboard-skeleton-line:nth-child(3) {
  width: 56%;
}

.dashboard-alerts {
  display: grid;
}

.dashboard-alerts__list {
  display: grid;
  gap: 0.65rem;
}

.dashboard-alerts__item {
  display: grid;
  grid-template-columns: minmax(54px, auto) 1fr;
  gap: 0.8rem;
  align-items: start;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 0.8rem 0.9rem;
  background: #f8faf8;
  cursor: pointer;
  transition:
    background 0.16s ease,
    border-color 0.16s ease;
}

.dashboard-alerts__item:hover {
  border-color: rgba(0, 200, 83, 0.2);
  background: #f3fbf3;
}

.dashboard-alerts__item > span {
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  padding: 0.22rem 0.5rem;
  background: rgba(0, 200, 83, 0.1);
  color: #087524;
  font-size: 11px;
  font-weight: 800;
  text-transform: capitalize;
}

.dashboard-alerts__item strong,
.dashboard-alerts__item small {
  display: block;
}

.dashboard-alerts__item strong {
  color: #111827;
  font-size: 13px;
}

.dashboard-alerts__item small {
  margin-top: 0.15rem;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.dashboard-alerts__item--unread {
  border-color: rgba(0, 200, 83, 0.28);
  background: #f3fbf3;
}

.dashboard-alerts__empty {
  margin: 0;
  border-radius: 12px;
  padding: 1rem;
  background: #f8faf8;
  color: #6b7280;
  font-size: 13px;
}

/* ─── INSIGHTS ──────────────────────────────────────── */
.insights {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  font-weight: 500;
  color: #9ca3af;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

/* ─── ACTIVITY ──────────────────────────────────────── */
.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activity-count {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 3px 10px;
  border-radius: 99px;
}

/* ─── RESPONSIVE ────────────────────────────────────── */
@keyframes dashboardCardIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes dashboardShimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (max-width: 1120px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid > .card:last-child {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .dashboard {
    padding: 0 16px 32px;
  }
  .stats-source-panel {
    grid-template-columns: 1fr;
  }
  .kpi.inside {
    grid-template-columns: repeat(2, 1fr);
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .hero-top {
    flex-direction: column;
  }
  .cta {
    margin-top: 0;
  }
}

@media (max-width: 480px) {
  .action-row {
    flex-wrap: wrap;
    gap: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .cta,
  .activity-item,
  .tournament-action-card button,
  .dashboard-skeleton-line {
    animation: none !important;
    transition: none !important;
  }
}
</style>
