<script setup>
// 1. IMPORTS
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../stores/challenge'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'

// 2. PROPS
// none

// 3. EMITS
// none

// 4. ROUTER / ROUTE
const router = useRouter()

// 5. STORES
const playerStore = usePlayerStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()

// 6. REACTIVE STATE
// none

// 7. COMPUTED PROPERTIES
const stats = computed(() => ({
  players: playerStore.players.length,
  ladder: playerStore.players.length,
  matches: matchStore.matches.length,
}))

const currentPlayer = computed(() => playerStore.currentPlayer)

const featuredMatch = computed(() => {
  return matchStore.scheduledMatches[0] || matchStore.pendingReviewMatches[0] || null
})

const pendingActions = computed(() => {
  const awaitingChallengeActions = challengeStore.challenges
    .filter((challenge) => challenge.status === 'awaiting')
    .slice(0, 2)
    .map((challenge) => ({
      id: `challenge-${challenge.id}`,
      title: `Accept challenge from ${challenge.challengerName}`,
      meta: `Rank ${challenge.challengerRank} wants a ladder match with ${challenge.defenderName}.`,
      cta: 'Open challenges',
      route: { name: 'Challenges' },
    }))

  const reviewMatchActions = matchStore.pendingReviewMatches.slice(0, 2).map((match) => ({
    id: `match-${match.id}`,
    title: `Confirm match vs ${match.defenderName}`,
    meta: `${match.challengerName} vs ${match.defenderName} is waiting for score review.`,
    cta: 'Review result',
    route: { name: 'MatchDetails', params: { matchId: match.id } },
  }))

  return [...awaitingChallengeActions, ...reviewMatchActions].slice(0, 4)
})

const recentChallenges = computed(() => challengeStore.challenges.slice(0, 3))
const recentMatches = computed(() => matchStore.matches.slice(0, 3))
const hasPendingActions = computed(() => pendingActions.value.length > 0)

// 8. METHODS
const formatDateTime = (value) => {
  if (!value) {
    return 'Schedule pending'
  }

  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const openRoute = (targetRoute) => {
  router.push(targetRoute)
}

const openCreateView = () => {
  router.push({ name: 'CreateChallenge' })
}

const openFeaturedMatch = () => {
  if (!featuredMatch.value) {
    return
  }

  router.push({ name: 'PlayMatch', params: { matchId: featuredMatch.value.id } })
}

const openRecentChallenge = (challenge) => {
  const relatedMatch = matchStore.matches.find((match) => match.challengeId === challenge.id)
  if (relatedMatch) {
    router.push({ name: 'MatchDetails', params: { matchId: relatedMatch.id } })
    return
  }

  router.push({ name: 'Challenges' })
}

const openRecentMatch = (match) => {
  const routeName = match.status === 'scheduled' ? 'PlayMatch' : 'MatchDetails'
  router.push({ name: routeName, params: { matchId: match.id } })
}

const loadDashboard = async () => {
  try {
    await Promise.all([
      playerStore.loadPlayers(),
      challengeStore.loadChallenges(),
      matchStore.loadMatches(),
    ])
  } catch (error) {
    console.error('Dashboard load failed:', error)
  }
}

// 9. WATCHERS
// none

// 10. LIFECYCLE HOOKS
onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <section class="dashboard">
    <section class="dashboard__intro section-card">
      <div>
        <p class="dashboard__greeting">Hello {{ currentPlayer?.name || 'Player' }}</p>
        <p class="dashboard__subline">
          Rank #{{ currentPlayer?.rank || '-' }} • {{ currentPlayer?.wins || 0 }}-{{
            currentPlayer?.losses || 0
          }}
        </p>
      </div>

      <div class="dashboard__actions">
        <button class="dashboard__action-button" type="button" @click="openCreateView">
          New challenge
        </button>
      </div>
    </section>

    <div class="stats-grid">
      <article class="stat-card section-card stat-card--tier1">
        <p class="stat-card__label">Players</p>
        <p class="stat-card__value">{{ stats.players }}</p>
      </article>
      <article class="stat-card section-card stat-card--tier1">
        <p class="stat-card__label">Matches</p>
        <p class="stat-card__value">{{ stats.matches }}</p>
      </article>
      <article class="stat-card section-card stat-card--tier1">
        <p class="stat-card__label">Ladder</p>
        <p class="stat-card__value">{{ stats.ladder }}</p>
      </article>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <h2>Pending actions</h2>
        </div>

        <div v-if="hasPendingActions" class="action-list">
          <button
            v-for="action in pendingActions"
            :key="action.id"
            class="action-card"
            type="button"
            @click="openRoute(action.route)"
          >
            <span class="action-card__title">{{ action.title }}</span>
            <span class="action-card__meta">{{ action.meta }}</span>
            <span class="action-card__cta">{{ action.cta }}</span>
          </button>
        </div>

        <div v-else class="empty-panel">
          No pending actions. Create a challenge or review the ladder.
        </div>
      </section>

      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <h2>Featured match</h2>
        </div>

        <div v-if="featuredMatch" class="feature-card">
          <p class="feature-card__status">{{ featuredMatch.statusLabel }}</p>
          <p class="feature-card__copy">
            {{ featuredMatch.challengerName }} vs {{ featuredMatch.defenderName }}
          </p>
          <p class="feature-card__copy">{{ formatDateTime(featuredMatch.scheduledAt) }}</p>
          <button class="feature-card__button" type="button" @click="openFeaturedMatch">
            View match
          </button>
        </div>

        <div v-else class="empty-panel">
          No active match yet. Your next scheduled match will appear here.
        </div>
      </section>
    </div>

    <div class="activity-grid">
      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <h2>Recent challenges</h2>
        </div>

        <div v-if="recentChallenges.length" class="activity-list">
          <button
            v-for="challenge in recentChallenges"
            :key="challenge.id"
            class="activity-item"
            type="button"
            @click="openRecentChallenge(challenge)"
          >
            <span class="activity-item__title">
              {{ challenge.challengerName }} vs {{ challenge.defenderName }}
            </span>
            <span class="activity-item__meta">
              {{ challenge.statusLabel }} ·
              {{ formatDateTime(challenge.scheduledAt || challenge.requestedAt) }}
            </span>
          </button>
        </div>

        <div v-else class="empty-panel">
          Recent challenges will appear after a challenge is created.
        </div>
      </section>

      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <h2>Recent matches</h2>
        </div>

        <div v-if="recentMatches.length" class="activity-list">
          <button
            v-for="match in recentMatches"
            :key="match.id"
            class="activity-item"
            type="button"
            @click="openRecentMatch(match)"
          >
            <span class="activity-item__title">
              {{ match.challengerName }} vs {{ match.defenderName }}
            </span>
            <span class="activity-item__meta">
              {{ match.statusLabel }} · {{ match.score || formatDateTime(match.scheduledAt) }}
            </span>
          </button>
        </div>

        <div v-else class="empty-panel">
          Recent match entries will appear after scheduling begins.
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 2rem;
}

.dashboard__intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.4rem;
}

.dashboard__greeting {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 800;
}

.dashboard__subline {
  margin: 0.55rem 0 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.dashboard__actions {
  display: flex;
  justify-content: flex-end;
}

.dashboard__action-button {
  border: none;
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: var(--color-accent-bright);
  color: var(--color-light);
  font-weight: 700;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.dashboard__action-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.stats-grid,
.dashboard-grid,
.activity-grid {
  display: grid;
  gap: 1rem;
}

.stats-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-grid,
.activity-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stat-card,
.dashboard-panel {
  padding: 1.4rem;
}

.stat-card--tier1 {
  background: rgba(255, 202, 58, 0.4);
  color: #2f2f2f;
  border-color: rgba(255, 202, 58, 0.35);
  box-shadow: 0 14px 32px rgba(45, 45, 45, 0.08);
}

.stat-card__label {
  margin: 0;
  color: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stat-card__value {
  margin: 0.85rem 0 0;
  font-size: 2rem;
  font-weight: 800;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.panel-header h2 {
  margin: 0;
  font-size: 1rem;
}

.action-list,
.activity-list {
  display: grid;
  gap: 0.75rem;
}

.action-card,
.activity-item {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-surface);
  text-align: left;
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out,
    border-color 0.12s ease-in-out;
}

.action-card:hover,
.activity-item:hover,
.dashboard__action-button:hover,
.feature-card__button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.action-card__title,
.activity-item__title,
.feature-card__status {
  font-weight: 700;
  color: var(--color-text);
}

.action-card__meta,
.activity-item__meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.action-card__cta {
  margin-top: 0.35rem;
  color: var(--color-accent-bright);
  font-weight: 700;
  font-size: 0.88rem;
}

.feature-card {
  display: grid;
  gap: 0.75rem;
}

.feature-card__status {
  margin: 0;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.feature-card__copy {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.feature-card__button {
  justify-self: start;
  max-width: 14rem;
  border: 1px solid rgba(0, 181, 26, 0.14);
  border-radius: 0.5rem;
  padding: 0 14px;
  min-height: 38px;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-accent-bright);
  font-weight: 700;
}

.empty-panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--color-surface-muted);
  color: var(--color-muted);
}

@media (max-width: 1100px) {
  .stats-grid,
  .dashboard-grid,
  .activity-grid {
    grid-template-columns: 1fr;
  }

  .dashboard__intro {
    flex-direction: column;
  }

  .dashboard__actions {
    justify-content: stretch;
  }

  .feature-card__button {
    max-width: none;
  }
}
</style>
