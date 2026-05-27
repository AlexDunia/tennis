<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { useTournamentStore } from '../stores/tournament'
import CategoryCard from '../components/tournament/CategoryCard.vue'
import CategoryStatusBadge from '../components/tournament/CategoryStatusBadge.vue'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const tournamentStore = useTournamentStore()
const hasLoaded = ref(false)

const tournamentId = computed(() => route.params.tournamentId)
const tournament = computed(() =>
  tournamentStore.activeTournament?.id === tournamentId.value ? tournamentStore.activeTournament : null,
)
const tournamentMatches = computed(() =>
  matchStore.matches.filter((match) => match.tournamentId === tournamentId.value),
)
const completedCount = computed(
  () => tournamentMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)).length,
)
const pendingCount = computed(() => tournamentMatches.value.filter((match) => match.status === 'pending').length)

function matchesForCategory(categoryId) {
  return tournamentMatches.value.filter((match) => match.categoryId === categoryId)
}

watch(tournamentId, async (nextTournamentId) => {
  hasLoaded.value = false
  await Promise.all([tournamentStore.fetchTournament(nextTournamentId), matchStore.loadMatches()])
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
          <span class="t-stat-tile__value">{{ tournament.officials.length }}</span>
          <span class="t-stat-tile__label">Officials</span>
        </div>
      </div>
    </header>

    <section class="t-shell-card tournament-overview__info">
      <div>
        <span class="t-section-kicker">Group Stage</span>
        <strong>{{ tournament.roundRobinStart }} - {{ tournament.roundRobinEnd }}</strong>
      </div>
      <div>
        <span class="t-section-kicker">Knockout</span>
        <strong>{{ tournament.knockoutStart }} - {{ tournament.finalDate }}</strong>
      </div>
      <div>
        <span class="t-section-kicker">Managed by</span>
        <strong>{{ tournament.officials.join(', ') }}</strong>
      </div>
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

      <div class="t-card-grid t-card-grid--two">
        <CategoryCard
          v-for="category in tournament.categories"
          :key="category.id"
          :category="category"
          :matches="matchesForCategory(category.id)"
        />
      </div>
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
.tournament-overview__loading {
  display: grid;
  gap: 16px;
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
