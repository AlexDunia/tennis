<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useBookingStore } from '../stores/booking'
import PerformanceChart from '@/components/charts/PerformanceChart.vue'

const router = useRouter()

const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const bookingStore = useBookingStore()

const currentPlayer = computed(() => playerStore.currentPlayer)

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
  { label: 'Pending challenges', value: challengeSummary.value.awaiting },
  { label: 'Matches to play', value: upcomingMatches.value },
  { label: 'Awaiting review', value: challengeSummary.value.pendingReview },
])

const activityFeed = computed(() => {
  const matches = matchStore.matches.map((m) => ({
    title: `${m.challengerName} vs ${m.defenderName}`,
    meta: m.statusLabel,
    id: m.id,
  }))

  const challenges = challengeStore.challenges.map((c) => ({
    title: `${c.challengerName} vs ${c.defenderName}`,
    meta: c.statusLabel,
    id: c.id,
  }))

  return [...matches, ...challenges].slice(0, 6)
})

const openMatch = (id) => {
  router.push({ name: 'MatchDetails', params: { matchId: id } })
}

const openCreate = () => {
  router.push({ name: 'CreateChallenge' })
}

onMounted(async () => {
  await Promise.all([
    playerStore.loadPlayers(),
    challengeStore.loadChallenges(),
    matchStore.loadMatches(),
    bookingStore.loadBookings(),
  ])

  console.log('MATCHES:', matchStore.matches)
})

onMounted(async () => {
  await Promise.all([
    playerStore.loadPlayers(),
    challengeStore.loadChallenges(),
    matchStore.loadMatches(),
    bookingStore.loadBookings(),
  ])
})
</script>

<template>
  <section class="dashboard">
    <!-- HERO -->
    <section class="hero">
      <div>
        <p class="hero__eyebrow">Player overview</p>
        <h1 class="hero__title">{{ currentPlayer?.name }}</h1>

        <p class="hero__subtitle">
          Ranked #{{ currentPlayer?.rank }} — keep playing to stay on top.
        </p>

        <div class="hero__stats">
          <div>
            <span>Record</span>
            <strong>{{ currentPlayer?.wins }} - {{ currentPlayer?.losses }}</strong>
          </div>

          <div>
            <span>Upcoming</span>
            <strong>{{ upcomingMatches }}</strong>
          </div>
        </div>
      </div>

      <button class="cta" @click="openCreate">Start challenge</button>
    </section>

    <!-- KPI -->
    <section class="kpi">
      <div class="card">
        <span class="kpi-label">Matches</span>
        <strong class="kpi-number">{{ matchesPlayed }}</strong>
        <span class="kpi-trend">+2 this week</span>
      </div>

      <div class="card">
        <span class="kpi-label">Wins</span>
        <strong class="kpi-number success">{{ currentPlayer?.wins }}</strong>
      </div>

      <div class="card">
        <span class="kpi-label">Losses</span>
        <strong class="kpi-number danger">{{ currentPlayer?.losses }}</strong>
      </div>

      <div class="card">
        <span class="kpi-label">Win rate</span>
        <strong class="kpi-number">{{ winRate }}%</strong>
      </div>
    </section>

    <!-- GRID -->
    <section class="grid">
      <!-- ACTION -->
      <section class="card">
        <h3 class="section-title">Action required</h3>
        <div class="divider"></div>

        <div class="action-row" v-for="item in urgentActions" :key="item.label">
          <span class="action-left">
            <span :class="['dot', item.value ? 'dot-danger' : 'dot-muted']"></span>
            {{ item.label }}
          </span>

          <strong>{{ item.value }}</strong>
        </div>
      </section>

      <!-- PERFORMANCE -->
      <section class="card">
        <!-- <div class="section-header">
          <div>
            <h3 class="section-title">Performance</h3>
            <p class="section-sub">Match trends and performance over time</p>
          </div>

          <div class="metric">
            <strong>{{ winRate }}%</strong>
            <span>Win rate</span>
          </div>
        </div>

        <div class="divider"></div>

        <div class="chart-header">
          <span class="muted">Last matches</span>

          <div class="filter">
            <button class="active">7D</button>
            <button>30D</button>
            <button>All</button>
          </div>
        </div> -->

        <PerformanceChart
          :matches="matchStore.matches"
          :currentPlayerId="playerStore.currentPlayerId"
        />

        <div class="insights">
          <span>{{ matchStore.matches.length }} matches</span>
          <span>{{ upcomingMatches }} upcoming</span>
        </div>
      </section>
    </section>

    <!-- ACTIVITY -->
    <section class="card">
      <h3 class="section-title">Recent activity</h3>
      <div class="divider"></div>

      <div class="activity">
        <div v-for="item in activityFeed" :key="item.id" @click="openMatch(item.id)">
          <strong>{{ item.title }}</strong>
          <span class="muted">{{ item.meta }}</span>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 24px;
}

/* HERO */
.hero {
  display: flex;
  justify-content: space-between;
  padding: 24px;
  border-radius: 12px;
  background: linear-gradient(to bottom, #ffffff, #f9fafb);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.hero__title {
  font-size: 28px;
  font-weight: 700;
}

.hero__subtitle {
  font-size: 14px;
  color: #6b7280;
}

.hero__stats {
  display: flex;
  gap: 24px;
  margin-top: 12px;
}

/* CTA */
.cta {
  height: 48px;
  padding: 0 20px;
  border-radius: 20px;
  background: #16a34a;
  color: white;
  border: none;
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

/* KPI */
.kpi {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.card:hover {
  transform: translateY(-2px);
}

.kpi-label {
  font-size: 12px;
  color: #6b7280;
}

.kpi-number {
  font-size: 24px;
  font-weight: 700;
  display: block;
  margin-top: 4px;
}

.kpi-trend {
  font-size: 12px;
  color: #16a34a;
  margin-top: 2px;
}

.success {
  color: #22c55e;
}
.danger {
  color: #ef4444;
}

/* GRID */
.grid {
  display: grid;
  grid-template-columns: 0.9fr 1.4fr;
  gap: 24px;
}

/* SECTION */
.section-title {
  font-size: 20px;
  font-weight: 600;
}

.section-sub {
  font-size: 12px;
  color: #6b7280;
}

.divider {
  height: 1px;
  background: #eef2f7;
  margin: 10px 0 14px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

/* METRIC */
.metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.metric strong {
  font-size: 18px;
}

.metric span {
  font-size: 11px;
  color: #6b7280;
}

/* ACTION */
.action-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  transition: all 0.15s ease;
}

.action-row:hover {
  transform: translateX(4px);
}

.action-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-danger {
  background: #ef4444;
}
.dot-muted {
  background: #d1d5db;
}

/* FILTER */
.filter {
  display: inline-flex;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 20px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.filter button {
  border: none;
  background: transparent;
  padding: 6px 12px;
  border-radius: 20px;
}

.filter .active {
  background: white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

/* ACTIVITY */
.activity {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.activity > div {
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.activity > div:hover {
  background: #f9fafb;
  transform: translateY(-1px);
}

.muted {
  color: #6b7280;
}

.insights {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eef2f7;
}
</style>
