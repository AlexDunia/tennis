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
        <p class="dashboard__eyebrow">Current Player</p>
        <h2>{{ currentPlayer?.name || 'Loading player...' }}</h2>
        <p class="dashboard__intro-copy">
          The dashboard stays lightweight: review priorities, jump into the right page, and keep
          the ladder moving.
        </p>
      </div>

      <div class="dashboard__intro-meta">
        <span class="dashboard__chip">Rank #{{ currentPlayer?.rank || '-' }}</span>
        <span class="dashboard__chip">
          Record {{ currentPlayer?.wins || 0 }}-{{ currentPlayer?.losses || 0 }}
        </span>
        <button class="dashboard__quick-action" type="button" @click="openCreateView">
          Create challenge
        </button>
      </div>
    </section>

    <div class="stats-grid">
      <article class="stat-card section-card">
        <p class="stat-card__label">Players</p>
        <p class="stat-card__value">{{ stats.players }}</p>
        <p class="stat-card__hint">Active ladder spots.</p>
      </article>
      <article class="stat-card section-card">
        <p class="stat-card__label">Matches</p>
        <p class="stat-card__value">{{ stats.matches }}</p>
        <p class="stat-card__hint">Scheduled and review-ready.</p>
      </article>
      <article class="stat-card section-card">
        <p class="stat-card__label">Ladder</p>
        <p class="stat-card__value">{{ stats.ladder }}</p>
        <p class="stat-card__hint">Current competitive positions.</p>
      </article>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="dashboard__eyebrow">Pending Actions</p>
            <h2>What needs attention now</h2>
          </div>
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
          No urgent actions right now. You can start the next move from Create Challenge.
        </div>
      </section>

      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="dashboard__eyebrow">Featured Match</p>
            <h2>
              {{
                featuredMatch
                  ? `${featuredMatch.challengerName} vs ${featuredMatch.defenderName}`
                  : 'No active match'
              }}
            </h2>
          </div>
        </div>

        <div v-if="featuredMatch" class="feature-card">
          <p class="feature-card__status">{{ featuredMatch.statusLabel }}</p>
          <p class="feature-card__copy">{{ formatDateTime(featuredMatch.scheduledAt) }}</p>
          <p class="feature-card__copy">Open the play screen for live scoring.</p>
          <button class="feature-card__button" type="button" @click="openFeaturedMatch">
            Open play screen
          </button>
        </div>

        <div v-else class="empty-panel">
          Your next scheduled match will appear here with a direct route into live play.
        </div>
      </section>
    </div>

    <div class="activity-grid">
      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="dashboard__eyebrow">Recent Challenges</p>
            <h2>Latest ladder movement</h2>
          </div>
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
              {{
                `${challenge.statusLabel} - ${formatDateTime(challenge.scheduledAt || challenge.requestedAt)}`
              }}
            </span>
          </button>
        </div>

        <div v-else class="empty-panel">
          Recent challenges will show here once the ladder gets moving.
        </div>
      </section>

      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="dashboard__eyebrow">Recent Matches</p>
            <h2>Open the right match flow</h2>
          </div>
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
              {{ match.statusLabel }} - {{ match.score || formatDateTime(match.scheduledAt) }}
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
  gap: 1.25rem;
}

.dashboard__intro {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.35rem 1.4rem;
}

.dashboard__eyebrow {
  margin: 0 0 0.3rem;
  color: var(--color-primary-strong);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.76rem;
}

.dashboard__intro h2,
.panel-header h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: -0.03em;
}

.dashboard__intro-copy {
  max-width: 40rem;
  margin: 0.55rem 0 0;
  color: var(--color-muted);
  font-size: 0.94rem;
}

.dashboard__intro-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: end;
}

.dashboard__chip {
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 0.82rem;
  font-weight: 600;
}

.dashboard__quick-action {
  border: 1px solid rgba(255, 127, 50, 0.18);
  border-radius: 0.9rem;
  padding: 0.72rem 0.95rem;
  background: rgba(255, 127, 50, 0.08);
  color: #b15a21;
  font-size: 0.9rem;
  font-weight: 700;
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
  padding: 1.2rem;
}

.stat-card__label,
.stat-card__hint,
.feature-card__copy,
.activity-item__meta,
.action-card__meta,
.empty-panel {
  color: var(--color-muted);
}

.stat-card__label {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
}

.stat-card__value {
  margin: 0.45rem 0 0;
  font-size: 2rem;
  line-height: 1;
  font-weight: 800;
}

.stat-card__hint {
  margin: 0.45rem 0 0;
  font-size: 0.88rem;
}

.panel-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.95rem;
}

.action-list,
.activity-list {
  display: grid;
  gap: 0.8rem;
}

.action-card,
.activity-item,
.feature-card__button {
  width: 100%;
}

.action-card,
.activity-item {
  display: grid;
  gap: 0.22rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-surface-muted);
  text-align: left;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.action-card:hover,
.activity-item:hover,
.dashboard__quick-action:hover,
.feature-card__button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.action-card:hover,
.activity-item:hover {
  border-color: rgba(0, 181, 26, 0.14);
}

.action-card__title,
.activity-item__title,
.feature-card__status {
  font-weight: 700;
  color: var(--color-text);
}

.action-card__cta {
  margin-top: 0.25rem;
  color: var(--color-primary-strong);
  font-weight: 700;
  font-size: 0.88rem;
}

.feature-card {
  display: grid;
  gap: 0.75rem;
}

.feature-card__status {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.feature-card__copy {
  margin: 0;
  font-size: 0.9rem;
}

.feature-card__button {
  justify-self: start;
  max-width: 13rem;
  border: 1px solid rgba(0, 181, 26, 0.14);
  border-radius: 0.9rem;
  padding: 0.82rem 1rem;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
  font-weight: 700;
}

.empty-panel {
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  background: var(--color-surface-muted);
  font-size: 0.9rem;
}

@media (max-width: 1100px) {
  .dashboard__intro,
  .stats-grid,
  .dashboard-grid,
  .activity-grid {
    grid-template-columns: 1fr;
  }

  .dashboard__intro {
    flex-direction: column;
  }

  .dashboard__intro-meta {
    justify-content: start;
  }

  .feature-card__button {
    max-width: none;
  }
}
</style>
