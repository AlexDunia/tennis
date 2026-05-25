<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { useTournamentStore } from '../stores/tournament'
import MatchFixtureRow from '../components/tournament/MatchFixtureRow.vue'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'
import TournamentMatchModal from '../components/tournament/TournamentMatchModal.vue'

const route = useRoute()
const matchStore = useMatchStore()
const tournamentStore = useTournamentStore()

const categoryFilter = ref('all')
const statusFilter = ref('all')
const courtFilter = ref('all')
const selectedMatch = ref(null)

const tournamentId = computed(() => route.params.tournamentId)
const tournament = computed(() => tournamentStore.activeTournament)
const matches = computed(() =>
  matchStore.matches.filter((match) => match.tournamentId === tournamentId.value),
)
const categoryFilters = computed(() => [
  { label: 'All Categories', value: 'all' },
  ...(tournament.value?.categories.map((category) => ({
    label: category.name,
    value: category.id,
  })) || []),
])
const filteredMatches = computed(() =>
  matches.value.filter((match) => {
    const matchesCategory = categoryFilter.value === 'all' || match.categoryId === categoryFilter.value
    const matchesStatus = statusFilter.value === 'all' || match.status === statusFilter.value
    const matchesCourt = courtFilter.value === 'all' || match.court === courtFilter.value
    return matchesCategory && matchesStatus && matchesCourt
  }),
)
const scheduledGroups = computed(() =>
  filteredMatches.value
    .filter((match) => match.scheduledDate)
    .reduce((groups, match) => {
      const group = groups[match.scheduledDate] || []
      group.push(match)
      return { ...groups, [match.scheduledDate]: group }
    }, {}),
)
const unscheduledMatches = computed(() => filteredMatches.value.filter((match) => !match.scheduledDate))

function categoryName(categoryId) {
  return tournament.value?.categories.find((category) => category.id === categoryId)?.name || categoryId
}

async function saveScore(payload) {
  await tournamentStore.enterMatchResult(selectedMatch.value.id, payload)
  selectedMatch.value = null
}

async function saveSchedule(payload) {
  await tournamentStore.updateMatchSchedule(selectedMatch.value.id, payload)
}

onMounted(async () => {
  await Promise.all([tournamentStore.fetchTournament(tournamentId.value), matchStore.loadMatches()])
})
</script>

<template>
  <section v-if="tournament" class="tournament-schedule">
    <header class="t-hero">
      <div class="t-hero__top">
        <div>
          <span class="t-section-kicker">Tournament Schedule</span>
          <h2 class="t-hero__title">Full Schedule</h2>
          <p class="t-hero__copy">
            Every match across every category. Filter by category, status, or court, then open any
            match to schedule it or enter the result.
          </p>
        </div>
        <RouterLink class="t-button t-button--secondary" :to="`/tournaments/${tournament.id}`">
          Back to Overview
        </RouterLink>
      </div>
    </header>

    <section class="tournament-schedule__filters">
      <div class="t-filter-bar">
        <button
          v-for="filter in categoryFilters"
          :key="filter.value"
          class="t-filter-pill"
          :class="{ 't-filter-pill--active': categoryFilter === filter.value }"
          type="button"
          @click="categoryFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
      <div class="t-filter-bar">
        <button
          v-for="status in ['all', 'pending', 'completed', 'walkover']"
          :key="status"
          class="t-filter-pill"
          :class="{ 't-filter-pill--active': statusFilter === status }"
          type="button"
          @click="statusFilter = status"
        >
          {{ status === 'all' ? 'All Status' : status }}
        </button>
      </div>
      <div class="t-filter-bar">
        <button
          v-for="court in ['all', 'Court 1', 'Court 2', 'Court 3', 'Court 4']"
          :key="court"
          class="t-filter-pill"
          :class="{ 't-filter-pill--active': courtFilter === court }"
          type="button"
          @click="courtFilter = court"
        >
          {{ court === 'all' ? 'All Courts' : court }}
        </button>
      </div>
    </section>

    <section
      v-for="(dayMatches, day) in scheduledGroups"
      :key="day"
      class="t-shell-card tournament-schedule__day"
    >
      <h3 class="t-section-title">{{ day }}</h3>
      <div class="tournament-schedule__scroll">
        <MatchFixtureRow
          v-for="match in dayMatches"
          :key="match.id"
          :match="match"
          :category-name="categoryName(match.categoryId)"
          @open="selectedMatch = $event"
        />
      </div>
    </section>

    <section class="t-shell-card tournament-schedule__day">
      <div class="t-section-header">
        <div>
          <h3 class="t-section-title">Unscheduled</h3>
          <p class="t-muted">{{ unscheduledMatches.length }} matches still need a time and court.</p>
        </div>
      </div>
      <div v-if="unscheduledMatches.length" class="tournament-schedule__scroll">
        <MatchFixtureRow
          v-for="match in unscheduledMatches"
          :key="match.id"
          :match="match"
          :category-name="categoryName(match.categoryId)"
          @open="selectedMatch = $event"
        />
      </div>
      <TournamentEmptyState
        v-else
        title="Everything is scheduled"
        message="No unscheduled matches match the current filters."
      />
    </section>

    <TournamentMatchModal
      v-if="selectedMatch"
      :match="selectedMatch"
      @close="selectedMatch = null"
      @save="saveScore"
      @schedule="saveSchedule"
    />
  </section>
  <section v-else class="tournament-schedule">
    <div class="t-shell-card tournament-schedule__day">
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
    </div>
  </section>
</template>

<style scoped>
.tournament-schedule__filters,
.tournament-schedule__day {
  display: grid;
  gap: 12px;
}

.tournament-schedule__day {
  padding: 18px 20px;
}

.tournament-schedule__scroll {
  overflow-x: auto;
}
</style>
