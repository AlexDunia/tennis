<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import TennisNavIcon from '../../components/compete/TennisNavIcon.vue'
import { useAdminStore } from '../../stores/admin'
import { useTournamentStore } from '../../stores/tournament'
import { formatAppDate, formatAppDateRange } from '../../utils/dateFormat'

const adminStore = useAdminStore()
const tournamentStore = useTournamentStore()
const selectedFilter = ref('all')
const searchQuery = ref('')

const canCreateTournament = computed(() => adminStore.hasActiveClubPermission('tournaments.manage'))
const clubTournaments = computed(() =>
  tournamentStore.tournaments.filter(
    (tournament) =>
      !tournament.clubId ||
      (Boolean(adminStore.activeClubId) && tournament.clubId === adminStore.activeClubId),
  ),
)

function statusKey(tournament) {
  const status = String(tournament.status || '').toLowerCase()
  if (status === 'completed') return 'completed'
  if (['active', 'open', 'registration_open', 'in_progress'].includes(status)) return 'active'
  return 'upcoming'
}

const activeTournaments = computed(() =>
  clubTournaments.value.filter((tournament) => statusKey(tournament) === 'active'),
)
const upcomingTournaments = computed(() =>
  clubTournaments.value.filter((tournament) => statusKey(tournament) === 'upcoming'),
)
const completedTournaments = computed(() =>
  clubTournaments.value.filter((tournament) => statusKey(tournament) === 'completed'),
)

const filters = computed(() => [
  { key: 'all', label: 'All', count: clubTournaments.value.length },
  { key: 'active', label: 'Open', count: activeTournaments.value.length },
  { key: 'upcoming', label: 'Upcoming', count: upcomingTournaments.value.length },
  { key: 'completed', label: 'Completed', count: completedTournaments.value.length },
])

const visibleTournaments = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const weight = { active: 0, upcoming: 1, completed: 2 }
  return clubTournaments.value
    .filter((tournament) => {
      if (selectedFilter.value !== 'all' && statusKey(tournament) !== selectedFilter.value) {
        return false
      }
      if (!query) return true
      const venue = tournament.venue?.name || tournament.location || ''
      return `${tournament.name || ''} ${venue}`.toLocaleLowerCase().includes(query)
    })
    .sort((left, right) => {
      const statusDifference = weight[statusKey(left)] - weight[statusKey(right)]
      if (statusDifference) return statusDifference
      return String(left.startDate || '').localeCompare(String(right.startDate || ''))
    })
})

function statusLabel(tournament) {
  const key = statusKey(tournament)
  if (key === 'completed') return 'Completed'
  if (key === 'active') return 'Open now'
  if (tournament.rules?.registrationStage) return 'Registration'
  return 'Upcoming'
}

function venueLabel(tournament) {
  return tournament.venue?.name || tournament.location || 'Venue to be announced'
}

function eventCount(tournament) {
  return (tournament.events || tournament.categories || []).length
}

function eventLabel(tournament) {
  const count = eventCount(tournament)
  return `${count} ${count === 1 ? 'event' : 'events'}`
}

function dateLabel(tournament) {
  return formatAppDateRange(tournament.startDate, tournament.endDate, {
    fallback: 'Dates to be announced',
  })
}

function registrationLabel(tournament) {
  if (!tournament.signupClose) return 'Registration details inside'
  return `Registration closes ${formatAppDate(tournament.signupClose, { includeYear: false })}`
}

const emptyTitle = computed(() =>
  searchQuery.value.trim() || selectedFilter.value !== 'all'
    ? 'No tournaments match this view'
    : 'No tournaments yet',
)

onMounted(() => tournamentStore.fetchTournaments())
</script>

<template>
  <section class="tournament-playground">
    <header class="tournament-hero">
      <div class="tournament-hero__copy">
        <p class="tournament-eyebrow">Compete</p>
        <h1>Tournament playground</h1>
        <p>Discover club events, follow active competitions, or prepare the next tournament.</p>
      </div>

      <RouterLink
        v-if="canCreateTournament"
        :to="{ name: 'TournamentCreate' }"
        class="button-primary tournament-hero__action"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
        <span>New tournament</span>
      </RouterLink>
    </header>

    <section class="tournament-metrics" aria-label="Tournament summary">
      <article>
        <span class="tournament-metric__icon tournament-metric__icon--active">
          <TennisNavIcon kind="trophy" :size="18" />
        </span>
        <div>
          <strong>{{ activeTournaments.length }}</strong>
          <span>Open now</span>
        </div>
      </article>
      <article>
        <span class="tournament-metric__icon">
          <TennisNavIcon kind="calendar" :size="18" />
        </span>
        <div>
          <strong>{{ upcomingTournaments.length }}</strong>
          <span>Upcoming</span>
        </div>
      </article>
      <article>
        <span class="tournament-metric__icon">
          <TennisNavIcon kind="trophy" :size="18" />
        </span>
        <div>
          <strong>{{ completedTournaments.length }}</strong>
          <span>Completed</span>
        </div>
      </article>
    </section>

    <section class="tournament-browser" aria-labelledby="tournament-browser-title">
      <div class="tournament-browser__heading">
        <div>
          <h2 id="tournament-browser-title">Club tournaments</h2>
          <p>Everything happening at {{ adminStore.activeClub?.name || 'your club' }}.</p>
        </div>
        <label class="tournament-search">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            aria-label="Search tournaments"
            placeholder="Search tournaments"
          />
        </label>
      </div>

      <nav class="tournament-filters" aria-label="Filter tournaments">
        <button
          v-for="filter in filters"
          :key="filter.key"
          type="button"
          :class="{ active: selectedFilter === filter.key }"
          :aria-pressed="selectedFilter === filter.key"
          @click="selectedFilter = filter.key"
        >
          <span>{{ filter.label }}</span>
          <strong>{{ filter.count }}</strong>
        </button>
      </nav>

      <div v-if="tournamentStore.loading" class="tournament-grid" aria-label="Loading tournaments">
        <article v-for="index in 3" :key="index" class="tournament-card tournament-card--loading">
          <span class="skeleton-line"></span>
          <span class="skeleton-line"></span>
          <span class="skeleton-line"></span>
        </article>
      </div>

      <section v-else-if="tournamentStore.error" class="tournament-state" role="alert">
        <TennisNavIcon kind="trophy" :size="24" />
        <h2>We could not load tournaments</h2>
        <p>{{ tournamentStore.error }}</p>
        <button class="button-secondary" type="button" @click="tournamentStore.fetchTournaments">
          Try again
        </button>
      </section>

      <div v-else-if="visibleTournaments.length" class="tournament-grid">
        <RouterLink
          v-for="tournament in visibleTournaments"
          :key="tournament.id"
          :to="{ name: 'TournamentOverview', params: { tournamentId: tournament.id } }"
          class="tournament-card"
        >
          <div class="tournament-card__topline">
            <span class="tournament-status" :class="`tournament-status--${statusKey(tournament)}`">
              {{ statusLabel(tournament) }}
            </span>
            <span class="tournament-card__arrow" aria-hidden="true">→</span>
          </div>

          <div class="tournament-card__title">
            <span class="tournament-card__mark"><TennisNavIcon kind="trophy" :size="20" /></span>
            <div>
              <h3>{{ tournament.name }}</h3>
              <p>{{ registrationLabel(tournament) }}</p>
            </div>
          </div>

          <dl class="tournament-card__details">
            <div>
              <dt>Date</dt>
              <dd>{{ dateLabel(tournament) }}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>{{ venueLabel(tournament) }}</dd>
            </div>
            <div>
              <dt>Format</dt>
              <dd>{{ eventLabel(tournament) }}</dd>
            </div>
          </dl>
        </RouterLink>
      </div>

      <section v-else class="tournament-state">
        <TennisNavIcon kind="trophy" :size="25" />
        <h2>{{ emptyTitle }}</h2>
        <p v-if="searchQuery.trim() || selectedFilter !== 'all'">
          Try another search or choose a different tournament status.
        </p>
        <p v-else-if="canCreateTournament">
          Create the first event for your club when you are ready.
        </p>
        <p v-else>Your club's tournaments will appear here when an admin publishes one.</p>
        <RouterLink
          v-if="canCreateTournament && !searchQuery.trim() && selectedFilter === 'all'"
          :to="{ name: 'TournamentCreate' }"
          class="button-primary tournament-state__action"
        >
          New tournament
        </RouterLink>
      </section>
    </section>
  </section>
</template>

<style scoped>
.tournament-playground {
  display: grid;
  gap: 24px;
  padding: 2px 0 36px;
}

.tournament-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  padding: 12px 0 6px;
}

.tournament-hero__copy {
  display: grid;
  max-width: 700px;
  gap: 10px;
}

.tournament-eyebrow,
.tournament-hero h1,
.tournament-hero p,
.tournament-browser__heading h2,
.tournament-browser__heading p,
.tournament-card h3,
.tournament-card p,
.tournament-state h2,
.tournament-state p {
  margin: 0;
}

.tournament-eyebrow {
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tournament-hero h1 {
  color: var(--color-text);
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.08;
  letter-spacing: -0.035em;
}

.tournament-hero__copy > p:last-child {
  color: var(--color-muted);
  font-size: 14px;
  line-height: 1.65;
}

.tournament-hero__action,
.tournament-state__action {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  text-decoration: none;
}

.tournament-hero__action svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.tournament-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.tournament-metrics article {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 13px;
  padding: 16px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
}

.tournament-metric__icon,
.tournament-card__mark {
  display: grid;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
}

.tournament-metric__icon--active {
  background: color-mix(in srgb, var(--color-primary) 9%, white);
  color: var(--color-primary-strong);
}

.tournament-metrics article > div {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.tournament-metrics strong {
  color: var(--color-text);
  font-size: 23px;
  line-height: 1.15;
}

.tournament-metrics article span:last-child {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.tournament-browser {
  display: grid;
  gap: 16px;
  padding-top: 8px;
}

.tournament-browser__heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.tournament-browser__heading h2 {
  color: var(--color-text);
  font-size: 20px;
  letter-spacing: -0.015em;
}

.tournament-browser__heading p {
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 12px;
}

.tournament-search {
  position: relative;
  display: block;
  width: min(300px, 100%);
}

.tournament-search svg {
  position: absolute;
  top: 50%;
  left: 13px;
  width: 17px;
  height: 17px;
  fill: none;
  stroke: var(--color-muted);
  stroke-width: 1.7;
  stroke-linecap: round;
  transform: translateY(-50%);
}

.tournament-search input {
  width: 100%;
  min-height: 43px;
  padding: 9px 13px 9px 40px;
  background: var(--color-surface);
  font-size: 12px;
}

.tournament-filters {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.tournament-filters::-webkit-scrollbar {
  display: none;
}

.tournament-filters button {
  display: inline-flex;
  min-height: 38px;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.tournament-filters button strong {
  display: grid;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  place-items: center;
  border-radius: 999px;
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  font-size: 10px;
}

.tournament-filters button.active {
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 7%, white);
  color: var(--color-primary-strong);
}

.tournament-filters button.active strong {
  background: var(--color-primary);
  color: white;
}

.tournament-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.tournament-card {
  display: grid;
  min-width: 0;
  gap: 19px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  box-shadow: var(--flow-shadow-quiet);
  color: inherit;
  text-decoration: none;
  transition:
    border-color var(--motion-card) var(--motion-curve),
    box-shadow var(--motion-card) var(--motion-curve),
    transform var(--motion-card) var(--motion-curve);
}

.tournament-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-soft);
  transform: translateY(-2px);
}

.tournament-card__topline,
.tournament-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tournament-status {
  display: inline-flex;
  min-height: 27px;
  align-items: center;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--color-surface-soft);
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
}

.tournament-status--active {
  background: color-mix(in srgb, var(--color-primary) 9%, white);
  color: var(--color-primary-strong);
}

.tournament-status--completed {
  color: var(--color-muted);
}

.tournament-card__arrow {
  color: var(--color-muted);
  font-size: 19px;
}

.tournament-card__title {
  justify-content: flex-start;
}

.tournament-card__title > div {
  min-width: 0;
}

.tournament-card h3 {
  overflow: hidden;
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-card__title p {
  overflow: hidden;
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-card__details {
  display: grid;
  grid-template-columns: 1.2fr 1fr auto;
  gap: 13px;
  margin: 0;
  padding-top: 15px;
  border-top: 1px solid var(--color-border);
}

.tournament-card__details div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.tournament-card__details dt {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tournament-card__details dd {
  overflow: hidden;
  margin: 0;
  color: var(--color-text-soft);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-card--loading {
  min-height: 220px;
  align-content: center;
}

.tournament-card--loading .skeleton-line {
  margin: 0;
}

.tournament-card--loading .skeleton-line:nth-child(2) {
  width: 74%;
}

.tournament-card--loading .skeleton-line:nth-child(3) {
  width: 48%;
}

.tournament-state {
  display: grid;
  min-height: 270px;
  align-content: center;
  justify-items: center;
  gap: 7px;
  padding: 28px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--app-card-radius);
  background: var(--color-surface-muted);
  color: var(--color-muted);
  text-align: center;
}

.tournament-state h2 {
  margin-top: 4px;
  color: var(--color-text);
  font-size: 16px;
}

.tournament-state p {
  max-width: 470px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.55;
}

.tournament-state .button-secondary,
.tournament-state__action {
  margin-top: 8px;
}

@media (max-width: 920px) {
  .tournament-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .tournament-playground {
    gap: 20px;
  }

  .tournament-hero,
  .tournament-browser__heading {
    align-items: stretch;
    flex-direction: column;
  }

  .tournament-hero__action,
  .tournament-search {
    width: 100%;
  }

  .tournament-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }

  .tournament-metrics article {
    min-height: 92px;
    align-items: flex-start;
    flex-direction: column;
    gap: 7px;
    padding: 12px;
  }

  .tournament-metric__icon {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
  }

  .tournament-metrics strong {
    font-size: 19px;
  }

  .tournament-card {
    padding: 16px;
  }

  .tournament-card__details {
    grid-template-columns: 1fr 1fr;
  }

  .tournament-card__details div:last-child {
    display: none;
  }
}

@media (max-width: 390px) {
  .tournament-hero h1 {
    font-size: 30px;
  }

  .tournament-card__details {
    grid-template-columns: 1fr;
  }

  .tournament-card__details div:nth-child(2) {
    display: none;
  }
}
</style>
