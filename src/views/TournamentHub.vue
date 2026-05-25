<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { useTournamentStore } from '../stores/tournament'
import TournamentCard from '../components/tournament/TournamentCard.vue'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'

const router = useRouter()
const matchStore = useMatchStore()
const tournamentStore = useTournamentStore()

const activeTournaments = computed(() =>
  tournamentStore.tournaments.filter((tournament) => tournament.status === 'active'),
)
const upcomingTournaments = computed(() =>
  tournamentStore.tournaments.filter((tournament) => tournament.status === 'upcoming'),
)
const completedTournaments = computed(() =>
  tournamentStore.tournaments.filter((tournament) => tournament.status === 'completed'),
)
const activeTournamentMatches = computed(() =>
  activeTournaments.value.flatMap((tournament) => matchesForTournament(tournament.id)),
)
const completedMatchCount = computed(
  () =>
    activeTournamentMatches.value.filter((match) =>
      ['completed', 'walkover'].includes(match.status),
    ).length,
)
const pendingMatchCount = computed(
  () => activeTournamentMatches.value.filter((match) => match.status === 'pending').length,
)

function matchesForTournament(tournamentId) {
  return matchStore.matches.filter((match) => match.tournamentId === tournamentId)
}

function openTournament(tournament) {
  router.push(`/tournaments/${tournament.id}`)
}

onMounted(async () => {
  await Promise.all([tournamentStore.fetchTournaments(), matchStore.loadMatches()])
})
</script>

<template>
  <section class="tournament-hub">
    <header class="t-hero">
      <div class="t-hero__top">
        <div>
          <span class="t-section-kicker">Tournament Control</span>
          <h2 class="t-hero__title">Tournaments</h2>
          <p class="t-hero__copy">
            Create events, enter scores, watch standings move, then generate the knockout.
          </p>
        </div>
        <button class="t-button t-button--primary" type="button" @click="router.push('/tournaments/create')">
          Create Tournament
        </button>
      </div>

      <div class="t-hero__stats">
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ activeTournaments.length }}</span>
          <span class="t-stat-tile__label">Active</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ activeTournamentMatches.length }}</span>
          <span class="t-stat-tile__label">Matches</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ completedMatchCount }}</span>
          <span class="t-stat-tile__label">Completed</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ pendingMatchCount }}</span>
          <span class="t-stat-tile__label">Pending</span>
        </div>
      </div>
    </header>

    <section v-if="tournamentStore.loading" class="t-card-grid t-card-grid--two">
      <div class="t-shell-card tournament-hub__skeleton">
        <span class="t-skeleton"></span>
        <span class="t-skeleton"></span>
        <span class="t-skeleton"></span>
      </div>
      <div class="t-shell-card tournament-hub__skeleton">
        <span class="t-skeleton"></span>
        <span class="t-skeleton"></span>
        <span class="t-skeleton"></span>
      </div>
    </section>

    <p v-else-if="tournamentStore.error" class="t-shell-card tournament-hub__error">
      {{ tournamentStore.error }}
      <button class="t-button t-button--secondary" type="button" @click="tournamentStore.fetchTournaments">
        Retry
      </button>
    </p>

    <template v-else>
      <section class="tournament-hub__section">
        <div class="t-section-header">
          <div>
            <h3 class="t-section-title">Active Tournaments</h3>
            <p class="t-muted">Currently running</p>
          </div>
        </div>

        <div v-if="activeTournaments.length" class="t-card-grid t-card-grid--two">
          <TournamentCard
            v-for="tournament in activeTournaments"
            :key="tournament.id"
            :tournament="tournament"
            :matches="matchesForTournament(tournament.id)"
            @view="openTournament"
          />
        </div>
        <TournamentEmptyState
          v-else
          title="No active tournaments"
          message="Create one when the club is ready to play."
        />
      </section>

      <section class="tournament-hub__section">
        <div class="t-section-header">
          <h3 class="t-section-title">Upcoming</h3>
        </div>
        <TournamentEmptyState
          v-if="!upcomingTournaments.length"
          icon="Calendar"
          title="No upcoming tournaments"
          message="Future tournaments will appear here after they are created."
        />
      </section>

      <section class="tournament-hub__section">
        <div class="t-section-header">
          <h3 class="t-section-title">Completed</h3>
        </div>
        <TournamentEmptyState
          v-if="!completedTournaments.length"
          icon="Trophy"
          title="No completed tournaments yet"
          message="Finished tournaments and champions will appear here."
        />
      </section>
    </template>
  </section>
</template>

<style scoped>
.tournament-hub__section {
  display: grid;
  gap: 14px;
}

.tournament-hub__skeleton {
  display: grid;
  gap: 12px;
  padding: 20px;
}

.tournament-hub__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  color: var(--tournament-red);
  font-size: 13px;
  font-weight: 700;
}
</style>
