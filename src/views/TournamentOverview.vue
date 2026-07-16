<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import CategoryCard from '../components/tournament/CategoryCard.vue'
import CategoryStatusBadge from '../components/tournament/CategoryStatusBadge.vue'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'
import { useTournamentLiveRefresh } from '../composables/useTournamentLiveRefresh'
import { formatAppDateRange } from '../utils/dateFormat'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
const tournamentStore = useTournamentStore()
const hasLoaded = ref(false)

const tournamentId = computed(() => route.params.tournamentId)
const tournament = computed(() =>
  tournamentStore.activeTournament?.id === tournamentId.value ? tournamentStore.activeTournament : null,
)
const tournamentMatches = computed(() =>
  matchStore.matches.filter((match) => match.tournamentId === tournamentId.value),
)
const playableTournamentMatches = computed(() =>
  tournamentMatches.value.filter((match) => !match.isBye),
)
const completedCount = computed(
  () => playableTournamentMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)).length,
)
const pendingCount = computed(() => playableTournamentMatches.value.filter((match) => match.status === 'pending').length)
const liveMatchCount = computed(
  () => playableTournamentMatches.value.filter((match) => match.liveState?.startedAt && match.status === 'pending').length,
)
const currentPlayer = computed(() => playerStore.currentPlayer)
const currentPlayerId = computed(() => currentPlayer.value?.id || '')
const currentPlayerFirstName = computed(() => currentPlayer.value?.name?.split(' ')[0] || 'Player')
const currentPlayerPlacements = computed(() => {
  if (!tournament.value || !currentPlayerId.value) {
    return []
  }

  return tournament.value.categories.flatMap((category) =>
    category.groups.flatMap((group) => {
      const player = group.players.find((entry) => entry.playerId === currentPlayerId.value)
      return player ? [{ category, group, player }] : []
    }),
  )
})
const overviewPersonalCopy = computed(() => {
  const name = currentPlayerFirstName.value
  const completed = completedCount.value
  const pending = pendingCount.value
  const live = liveMatchCount.value
  const placement = currentPlayerPlacements.value[0]

  if (placement) {
    return `${name}, you are in ${placement.category.name}, ${placement.group.name}, seed #${placement.player.seed}. ${completed} scores are in and ${pending} matches still need attention.`
  }

  if (live) {
    return `${name}, ${live} match${live === 1 ? ' is' : 'es are'} live now. ${pending} matches still need scores.`
  }

  return `${name}, ${completed} scores are in and ${pending} matches still need attention.`
})

useTournamentLiveRefresh(tournamentId)

function matchesForCategory(categoryId) {
  return tournamentMatches.value.filter((match) => match.categoryId === categoryId)
}

watch(tournamentId, async (nextTournamentId) => {
  hasLoaded.value = false
  await Promise.all([tournamentStore.fetchTournament(nextTournamentId), matchStore.loadMatches(), playerStore.loadPlayers()])
  hasLoaded.value = true
}, { immediate: true })
</script>

<template>
  <section v-if="tournament" class="tournament-overview">
    <header class="t-hero">
      <div class="t-hero__top">
        <div>
          <CategoryStatusBadge :status="tournament.status" />
          <h2 class="t-hero__title">{{ tournament.name }}</h2>
          <p class="t-hero__copy">{{ tournament.description }}</p>
        </div>
        <div class="tournament-overview__actions">
          <RouterLink class="t-button t-button--secondary" to="/tournaments">
            Back to Tournaments
          </RouterLink>
          <RouterLink class="t-button t-button--secondary" :to="`/tournaments/${tournament.id}/gallery`">
            View Gallery
          </RouterLink>
          <RouterLink class="t-button t-button--primary" :to="`/tournaments/${tournament.id}/schedule`">
            View Schedule
          </RouterLink>
        </div>
      </div>

      <div class="t-hero__stats">
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ tournament.categories.length }}</span>
          <span class="t-stat-tile__label">Divisions</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ completedCount }}</span>
          <span class="t-stat-tile__label">Completed</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ pendingCount }}</span>
          <span class="t-stat-tile__label">Pending</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ liveMatchCount }}</span>
          <span class="t-stat-tile__label">Live now</span>
        </div>
      </div>
    </header>

    <section class="t-shell-card tournament-overview__info">
      <div>
        <span class="t-section-kicker">Group Stage</span>
        <strong>{{ formatAppDateRange(tournament.roundRobinStart, tournament.roundRobinEnd) }}</strong>
      </div>
      <div>
        <span class="t-section-kicker">Knockout</span>
        <strong>{{ formatAppDateRange(tournament.knockoutStart, tournament.finalDate) }}</strong>
      </div>
      <div>
        <span class="t-section-kicker">Managed by</span>
        <strong>{{ tournament.officials.join(', ') }}</strong>
      </div>
    </section>

    <section class="t-shell-card tournament-overview__pulse">
      <span class="t-section-kicker">Your tournament view</span>
      <strong>{{ overviewPersonalCopy }}</strong>
      <p v-if="currentPlayerPlacements.length > 1">
        You also appear in {{ currentPlayerPlacements.length - 1 }} other division{{ currentPlayerPlacements.length - 1 === 1 ? '' : 's' }}.
      </p>
      <p v-else-if="!currentPlayerPlacements.length">
        You are not listed in this tournament draw yet.
      </p>
    </section>

    <section class="tournament-overview__categories">
      <div class="t-section-header">
        <div>
          <h3 class="t-section-title">Divisions</h3>
          <p class="t-muted">Open a category to see matches, standings, and knockout.</p>
        </div>
        <RouterLink class="t-button t-button--ghost" :to="`/tournaments/${tournament.id}/schedule`">
          Full schedule
        </RouterLink>
      </div>

      <div v-if="tournament.categories.length" class="t-card-grid t-card-grid--two">
        <CategoryCard
          v-for="category in tournament.categories"
          :key="category.id"
          :category="category"
          :current-player-id="currentPlayerId"
          :matches="matchesForCategory(category.id)"
        />
      </div>
      <TournamentEmptyState
        v-else
        icon="Fixtures"
        title="No categories added"
        message="Divisions will appear here after the tournament structure has been confirmed."
      />
    </section>
  </section>
  <section v-else-if="!hasLoaded || tournamentStore.loading" class="tournament-overview">
    <div class="t-shell-card tournament-overview__loading">
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
    </div>
  </section>
  <section v-else class="tournament-overview">
    <TournamentEmptyState
      title="Tournament not found"
      message="This tournament is no longer available in the local app data. Open the tournaments page and choose an available tournament."
      @action="router.push('/tournaments')"
    >
      <template #action>Back to tournaments</template>
    </TournamentEmptyState>
  </section>
</template>

<style scoped>
.tournament-overview__info {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 18px 20px;
}

.tournament-overview__info div {
  display: grid;
  gap: 4px;
}

.tournament-overview__info strong {
  color: var(--tournament-ink);
  font-size: 14px;
}

.tournament-overview__categories,
.tournament-overview__pulse,
.tournament-overview__loading {
  display: grid;
  gap: 16px;
}

.tournament-overview__pulse {
  gap: 6px;
  padding: 16px 18px;
  border-color: rgba(0, 181, 26, 0.24);
  background: linear-gradient(180deg, #ffffff 0%, rgba(0, 181, 26, 0.04) 100%);
}

.tournament-overview__pulse strong {
  color: var(--tournament-ink);
  font-size: 14px;
  line-height: 1.45;
}

.tournament-overview__pulse p {
  margin: 0;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: 700;
}

.tournament-overview__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.tournament-overview__loading {
  padding: 20px;
}

@media (max-width: 800px) {
  .tournament-overview__info {
    grid-template-columns: 1fr;
  }
}
</style>
