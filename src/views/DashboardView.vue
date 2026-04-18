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
const sectionLabels = {
  create: '+ New Match',
  pending: 'Pending Actions',
}

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
    <header class="hero section-card">
      <div class="hero__copy">
        <p class="eyebrow">Tennis Ladder</p>
        <h1>Overview first. Actions where they belong.</h1>
        <p class="hero__text">
          Track what matters now, then jump into the right flow for creating, confirming, and
          playing matches.
        </p>
        <div class="hero__meta">
          <span class="hero__badge">Current player: {{ currentPlayer?.name || 'Loading' }}</span>
          <span class="hero__badge">Port Harcourt court rotation</span>
        </div>
      </div>

      <button class="hero__action" type="button" @click="openCreateView">
        {{ sectionLabels.create }}
      </button>
    </header>

    <div class="stats-grid">
      <article class="stat-card section-card">
        <p class="stat-card__label">Players</p>
        <p class="stat-card__value">{{ stats.players }}</p>
        <p class="stat-card__hint">Active ladder spots on the court board.</p>
      </article>
      <article class="stat-card section-card">
        <p class="stat-card__label">Matches</p>
        <p class="stat-card__value">{{ stats.matches }}</p>
        <p class="stat-card__hint">Scheduled and review-ready fixtures.</p>
      </article>
      <article class="stat-card section-card">
        <p class="stat-card__label">Ladder</p>
        <p class="stat-card__value">{{ stats.ladder }}</p>
        <p class="stat-card__hint">Competitive positions available to climb.</p>
      </article>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">{{ sectionLabels.pending }}</p>
            <h2>Most important things waiting on you</h2>
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
          No urgent actions right now. Create a new challenge or check current rankings.
        </div>
      </section>

      <section class="dashboard-panel dashboard-panel--feature section-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Featured Match</p>
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
          <p class="feature-card__copy">
            Court time:
            <strong>{{ formatDateTime(featuredMatch.scheduledAt) }}</strong>
          </p>
          <p class="feature-card__copy">
            Open the full play screen for live scoring and match focus.
          </p>
          <button class="feature-card__button" type="button" @click="openFeaturedMatch">
            Go to Play Screen
          </button>
        </div>

        <div v-else class="empty-panel">
          Your next scheduled match will surface here with a direct route into play.
        </div>
      </section>
    </div>

    <div class="activity-grid">
      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Recent Challenges</p>
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
          Recent challenges will show up here once the ladder gets moving.
        </div>
      </section>

      <section class="dashboard-panel section-card">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Recent Matches</p>
            <h2>Direct links into match details</h2>
          </div>
        </div>

        <div v-if="recentMatches.length" class="activity-list">
          <button
            v-for="match in recentMatches"
            :key="match.id"
            class="activity-item activity-item--match"
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
          Recent match entries will appear here after scheduling begins.
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 1.5rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.5rem;
  padding: 1.75rem;
  background:
    linear-gradient(135deg, rgba(255, 248, 221, 0.96), rgba(243, 233, 177, 0.88)),
    linear-gradient(120deg, rgba(217, 31, 47, 0.08), rgba(15, 107, 63, 0.14));
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  right: -2rem;
  bottom: -5rem;
  width: 18rem;
  height: 18rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(15, 107, 63, 0.15), transparent 72%);
}

.hero__copy {
  position: relative;
  z-index: 1;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: var(--color-secondary);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
}

.hero h1,
.panel-header h2 {
  margin: 0;
}

.hero__text {
  max-width: 40rem;
  margin: 0.8rem 0 0;
  color: var(--color-muted);
}

.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.1rem;
}

.hero__badge {
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 252, 240, 0.82);
  border: 1px solid rgba(19, 35, 22, 0.08);
  font-weight: 700;
  color: var(--color-primary-strong);
}

.hero__action {
  align-self: start;
  border: none;
  border-radius: 1.15rem;
  padding: 0.95rem 1.2rem;
  background: linear-gradient(135deg, var(--color-secondary), #ef5543);
  color: #fffdf5;
  font-weight: 800;
  box-shadow: 0 16px 36px rgba(159, 17, 32, 0.22);
}

.stats-grid,
.dashboard-grid,
.activity-grid {
  display: grid;
  gap: 1.25rem;
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

.stat-card {
  background: linear-gradient(180deg, rgba(255, 250, 230, 0.9), rgba(252, 243, 209, 0.76));
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
  font-size: 0.95rem;
  font-weight: 700;
}

.stat-card__value {
  margin: 0.5rem 0 0;
  font-size: 2.35rem;
  line-height: 1;
  font-weight: 900;
  color: var(--color-primary-strong);
}

.stat-card__hint {
  margin: 0.65rem 0 0;
  font-size: 0.95rem;
}

.panel-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.action-list,
.activity-list {
  display: grid;
  gap: 0.9rem;
}

.action-card,
.activity-item,
.feature-card__button {
  width: 100%;
}

.action-card,
.activity-item {
  display: grid;
  gap: 0.25rem;
  padding: 1rem 1.05rem;
  border: 1px solid rgba(19, 35, 22, 0.08);
  border-radius: 1.2rem;
  background: rgba(255, 252, 241, 0.88);
  text-align: left;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.action-card:hover,
.activity-item:hover,
.hero__action:hover,
.feature-card__button:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 34px rgba(60, 47, 18, 0.15);
}

.action-card:hover,
.activity-item:hover {
  border-color: rgba(15, 107, 63, 0.18);
}

.action-card__title,
.activity-item__title,
.feature-card__status {
  font-weight: 800;
  color: var(--color-text);
}

.action-card__cta {
  margin-top: 0.25rem;
  color: var(--color-secondary);
  font-weight: 800;
}

.dashboard-panel--feature {
  background:
    linear-gradient(180deg, rgba(13, 85, 51, 0.92), rgba(10, 61, 36, 0.95)),
    linear-gradient(145deg, rgba(245, 198, 45, 0.08), rgba(255, 255, 255, 0));
  color: #fdf5d7;
}

.dashboard-panel--feature .eyebrow,
.dashboard-panel--feature h2,
.dashboard-panel--feature .feature-card__status,
.dashboard-panel--feature strong {
  color: #fff8dd;
}

.dashboard-panel--feature .feature-card__copy,
.dashboard-panel--feature .empty-panel {
  color: rgba(255, 248, 221, 0.82);
}

.feature-card {
  display: grid;
  gap: 0.8rem;
}

.feature-card__status {
  margin: 0;
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.feature-card__copy {
  margin: 0;
}

.feature-card__button {
  justify-self: start;
  max-width: 14rem;
  border: none;
  border-radius: 1rem;
  padding: 0.95rem 1.15rem;
  background: linear-gradient(135deg, var(--color-accent), #ffe07b);
  color: #3d2f10;
  font-weight: 900;
}

.empty-panel {
  padding: 1rem 1.1rem;
  border-radius: 1rem;
  background: rgba(255, 252, 241, 0.72);
}

.dashboard-panel--feature .empty-panel {
  background: rgba(255, 248, 221, 0.12);
}

.activity-item--match {
  background: rgba(247, 242, 221, 0.96);
}

@media (max-width: 900px) {
  .stats-grid,
  .dashboard-grid,
  .activity-grid,
  .hero {
    grid-template-columns: 1fr;
  }

  .hero__action,
  .feature-card__button {
    max-width: none;
  }
}
</style>
