<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TennisNavIcon from '../../components/compete/TennisNavIcon.vue'
import { useAdminStore } from '../../stores/admin'
import { useTournamentStore } from '../../stores/tournament'

const router = useRouter()
const adminStore = useAdminStore()
const tournamentStore = useTournamentStore()

const activeTournaments = computed(() =>
  tournamentStore.tournaments.filter((tournament) => tournament.status === 'active'),
)
const completedTournaments = computed(() =>
  tournamentStore.tournaments.filter((tournament) => tournament.status === 'completed'),
)
const orderedTournaments = computed(() => {
  const weight = { active: 0, upcoming: 1, completed: 2 }
  return [...tournamentStore.tournaments].sort(
    (left, right) => (weight[left.status] ?? 3) - (weight[right.status] ?? 3),
  )
})
const canCreateTournament = computed(() => adminStore.hasActiveClubPermission('tournaments.manage'))

function statusLine(tournament) {
  if (tournament.status === 'active') return 'In progress'
  if (tournament.status === 'completed') return 'Completed'
  if (tournament.status === 'upcoming') return 'Scheduled'
  return String(tournament.status || 'Tournament').replaceAll('_', ' ')
}

function openTournament(tournament) {
  router.push({ name: 'TournamentOverview', params: { tournamentId: tournament.id } })
}

onMounted(() => tournamentStore.fetchTournaments())
</script>

<template>
  <section class="tournaments-list">
    <div class="tournament-metrics" aria-label="Tournament summary">
      <article>
        <TennisNavIcon kind="calendar" :size="19" />
        <div>
          <strong>{{ activeTournaments.length }}</strong>
          <span>Active</span>
        </div>
      </article>
      <article>
        <TennisNavIcon kind="trophy" :size="19" />
        <div>
          <strong>{{ completedTournaments.length }}</strong>
          <span>Completed</span>
        </div>
      </article>
    </div>

    <div v-if="tournamentStore.loading" class="tournament-loading" aria-label="Loading tournaments">
      <span v-for="index in 3" :key="index" class="skeleton-line"></span>
    </div>

    <section v-else-if="tournamentStore.error" class="tournament-error" role="alert">
      <div>
        <h2>We could not load tournaments</h2>
        <p>{{ tournamentStore.error }}</p>
      </div>
      <button class="button-secondary" type="button" @click="tournamentStore.fetchTournaments">
        Try again
      </button>
    </section>

    <div v-else-if="orderedTournaments.length" class="tournament-rows">
      <article v-for="tournament in orderedTournaments" :key="tournament.id" class="tournament-row">
        <div class="tournament-row__icon" aria-hidden="true">
          <TennisNavIcon kind="trophy" :size="20" />
        </div>
        <div class="tournament-row__copy">
          <strong>{{ tournament.name }}</strong>
          <span>{{ statusLine(tournament) }}</span>
        </div>
        <button
          class="button-secondary tournament-row__action"
          type="button"
          @click="openTournament(tournament)"
        >
          View
        </button>
      </article>
    </div>

    <section v-else class="tournament-empty">
      <TennisNavIcon kind="trophy" :size="24" />
      <strong>No tournament yet</strong>
      <p v-if="canCreateTournament">Use New tournament above to create your club's first event.</p>
      <p v-else>Your club's tournaments will appear here when an admin creates one.</p>
    </section>
  </section>
</template>

<style scoped>
.tournaments-list {
  display: grid;
  gap: 18px;
}

.tournament-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.tournament-metrics article {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 16px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.tournament-metrics article > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.tournament-metrics strong {
  color: var(--color-text);
  font-size: 23px;
}

.tournament-metrics span {
  color: var(--color-muted);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.tournament-rows,
.tournament-loading {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--shadow-soft);
}

.tournament-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  min-height: 72px;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-border);
}

.tournament-row:last-child {
  border-bottom: 0;
}

.tournament-row__icon {
  display: grid;
  width: 42px;
  height: 42px;
  overflow: visible;
  place-items: center;
  border-radius: var(--app-inner-radius);
}

.tournament-row__copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.tournament-row__copy strong,
.tournament-row__copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-row__copy strong {
  color: var(--color-text);
  font-size: 15px;
}

.tournament-row__copy span {
  color: var(--color-muted);
  font-size: 14px;
}

.tournament-row__action {
  min-height: 38px;
  padding: 8px 14px;
}

.tournament-loading {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.tournament-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.tournament-error h2,
.tournament-error p,
.tournament-empty p {
  margin: 0;
}

.tournament-error h2 {
  font-size: 14px;
}

.tournament-error p,
.tournament-empty p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 12px;
}

.tournament-empty {
  display: grid;
  min-height: 240px;
  place-items: center;
  align-content: center;
  color: var(--color-muted);
  text-align: center;
}

.tournament-empty :deep(.tennis-nav-icon) {
  margin-bottom: 9px;
}

.tournament-empty strong {
  color: var(--color-text);
  font-size: 14px;
}

@media (max-width: 520px) {
  .tournaments-list {
    gap: 22px;
  }
  .tournament-metrics {
    gap: 12px;
  }
  .tournament-metrics article {
    gap: 10px;
    padding: 14px 12px;
  }
  .tournament-row {
    grid-template-columns: 38px minmax(0, 1fr) auto;
    min-height: 74px;
    gap: 11px;
    padding: 12px 13px;
  }
  .tournament-row__icon {
    width: 38px;
    height: 38px;
  }
  .tournament-error {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
