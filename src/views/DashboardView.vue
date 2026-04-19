<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useBookingStore } from '../stores/booking'
import PerformanceChart from '@/components/charts/PerformanceChart.vue'

// 2. STORES
const router = useRouter()
const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const bookingStore = useBookingStore()

// 3. STATE
const currentPlayer = computed(() => playerStore.currentPlayer)

// 4. COMPUTED
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

const upcomingMatches = computed(() => matchStore.scheduledMatches.length)

const challengeSummary = computed(() => challengeStore.summaryCounts)

const urgentActions = computed(() => [
  {
    label: 'Pending challenges',
    value: challengeSummary.value.awaiting,
  },
  {
    label: 'Matches to play',
    value: upcomingMatches.value,
  },
  {
    label: 'Awaiting review',
    value: challengeSummary.value.pendingReview,
  },
])

const activityFeed = computed(() => {
  const matches = matchStore.matches.map((m) => ({
    type: 'match',
    title: `${m.challengerName} vs ${m.defenderName}`,
    meta: m.statusLabel,
    date: m.scheduledAt,
    id: m.id,
  }))

  const challenges = challengeStore.challenges.map((c) => ({
    type: 'challenge',
    title: `${c.challengerName} vs ${c.defenderName}`,
    meta: c.statusLabel,
    date: c.requestedAt,
    id: c.id,
  }))

  return [...matches, ...challenges].slice(0, 6)
})

// 5. METHODS
const openMatch = (id) => {
  router.push({ name: 'MatchDetails', params: { matchId: id } })
}

const openCreate = () => {
  router.push({ name: 'CreateChallenge' })
}

const loadDashboard = async () => {
  await Promise.all([
    playerStore.loadPlayers(),
    challengeStore.loadChallenges(),
    matchStore.loadMatches(),
    bookingStore.loadBookings(),
  ])
}

// 6. LIFECYCLE
onMounted(loadDashboard)
</script>

<template>
  <section class="dashboard">
    <!-- HERO -->
    <section class="hero">
      <div class="hero__content">
        <p class="hero__eyebrow">Player overview</p>

        <h1 class="hero__title">
          {{ currentPlayer?.name || 'Player' }}
        </h1>

        <p class="hero__subtitle">
          You’re currently ranked <strong>#{{ currentPlayer?.rank ?? '-' }}</strong
          >. Stay active to defend your position and climb higher.
        </p>

        <div class="hero__stats">
          <div class="hero__stat">
            <span>Record</span>
            <strong>{{ currentPlayer?.wins || 0 }} - {{ currentPlayer?.losses || 0 }}</strong>
          </div>

          <div class="hero__stat">
            <span>Upcoming</span>
            <strong>{{ upcomingMatches }}</strong>
          </div>
        </div>
      </div>

      <button class="hero__cta" @click="openCreate">Start challenge</button>
    </section>

    <!-- KPI -->
    <section class="kpi">
      <div class="kpi__card">
        <span>Matches</span>
        <strong>{{ matchesPlayed }}</strong>
      </div>

      <div class="kpi__card">
        <span>Wins</span>
        <strong>{{ currentPlayer?.wins || 0 }}</strong>
      </div>

      <div class="kpi__card">
        <span>Losses</span>
        <strong>{{ currentPlayer?.losses || 0 }}</strong>
      </div>

      <div class="kpi__card">
        <span>Win rate</span>
        <strong>{{ winRate }}%</strong>
      </div>
    </section>

    <!-- GRID -->
    <section class="grid">
      <!-- ACTION -->
      <div class="panel panel--tight">
        <div class="panel__header">
          <h2>Action required</h2>
        </div>

        <div class="action">
          <div v-for="item in urgentActions" :key="item.label" class="action__row">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>

      <!-- PERFORMANCE -->
      <div class="panel panel--performance">
        <div class="panel__header panel__header--stack">
          <div>
            <h2>Performance</h2>
            <p class="panel__subtext">
              Your match results over time. Track momentum, identify streaks, and adjust your play.
            </p>
          </div>

          <div class="panel__highlight">
            <strong>{{ winRate }}%</strong>
            <span>win rate</span>
          </div>
        </div>

        <PerformanceChart
          :matches="matchStore.matches"
          :currentPlayerId="playerStore.currentPlayerId"
        />

        <div class="panel__insights">
          <span> {{ matchStore.matches.length }} matches played </span>
          <span> {{ upcomingMatches }} upcoming matches </span>
        </div>
      </div>
    </section>

    <!-- ACTIVITY -->
    <section class="panel panel--activity">
      <div class="panel__header">
        <h2>Recent activity</h2>
      </div>

      <div class="activity">
        <div
          v-for="item in activityFeed"
          :key="item.id"
          class="activity__row"
          @click="openMatch(item.id)"
        >
          <div class="activity__main">
            <strong>{{ item.title }}</strong>
            <span>{{ item.meta }}</span>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 2rem;
}

/* HERO */
.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem;
  border-radius: var(--radius-lg);
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
}

.hero__eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--color-muted);
}

.hero__title {
  margin: 0.25rem 0;
  font-size: 2rem;
  letter-spacing: -0.03em;
}

.hero__subtitle {
  margin: 0;
  color: var(--color-muted);
  max-width: 32rem;
}

.hero__stats {
  display: flex;
  gap: 2rem;
  margin-top: 1.25rem;
}

.hero__stat span {
  font-size: 0.8rem;
  color: var(--color-muted);
}

.hero__cta {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.85rem 1.4rem;
  border-radius: 999px;
  font-weight: 700;
  transition: transform 0.15s ease;
}

.hero__cta:hover {
  transform: translateY(-1px);
}

/* KPI */
.kpi {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

.kpi__card {
  padding: 1.4rem;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.kpi__card span {
  font-size: 0.75rem;
  color: var(--color-muted);
  text-transform: uppercase;
}

.kpi__card strong {
  font-size: 1.8rem;
  display: block;
  margin-top: 0.5rem;
}

/* GRID */
.grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 1.5rem;
}

/* PANELS */
.panel {
  padding: 1.5rem;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.panel--airy {
  display: grid;
  gap: 1rem;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel__meta {
  font-size: 0.85rem;
  color: var(--color-muted);
}

/* ACTION */
.action {
  display: grid;
  gap: 1rem;
}

.action__row {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
}

/* PERFORMANCE */
.track {
  height: 10px;
  background: var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--color-primary);
}

/* ACTIVITY */
.activity {
  display: grid;
  gap: 0.5rem;
}

.activity__row {
  padding: 1rem;
  border-radius: var(--radius);
  transition: background 0.15s ease;
}

.activity__row:hover {
  background: var(--color-surface-soft);
}

.activity__main span {
  display: block;
  font-size: 0.85rem;
  color: var(--color-muted);
}

/* PERFORMANCE PANEL */
.panel--performance {
  display: grid;
  gap: 1.25rem;
}

/* HEADER STACK */
.panel__header--stack {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

/* SUBTEXT */
.panel__subtext {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: var(--color-muted);
  max-width: 28rem;
  line-height: 1.5;
}

/* HIGHLIGHT METRIC */
.panel__highlight {
  text-align: right;
}

.panel__highlight strong {
  display: block;
  font-size: 1.6rem;
  letter-spacing: -0.02em;
}

.panel__highlight span {
  font-size: 0.8rem;
  color: var(--color-muted);
}

/* INSIGHTS ROW */
.panel__insights {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--color-muted);
  border-top: 1px solid var(--color-border);
  padding-top: 0.75rem;
}
</style>
