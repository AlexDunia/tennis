<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { useTournamentStore } from '../stores/tournament'
import BracketTree from '../components/tournament/BracketTree.vue'
import BracketTreeMobile from '../components/tournament/BracketTreeMobile.vue'
import CategoryStatusBadge from '../components/tournament/CategoryStatusBadge.vue'
import KnockoutChampionCard from '../components/tournament/KnockoutChampionCard.vue'
import MatchFixtureCard from '../components/tournament/MatchFixtureCard.vue'
import StandingsTable from '../components/tournament/StandingsTable.vue'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'
import TournamentMatchModal from '../components/tournament/TournamentMatchModal.vue'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const tournamentStore = useTournamentStore()

const selectedTab = ref('overview')
const selectedMatch = ref(null)
const groupFilter = ref('all')
const statusFilter = ref('all')
const hasLoaded = ref(false)
const tabs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Groups', value: 'groups' },
  { label: 'Matches', value: 'fixtures' },
  { label: 'Standings', value: 'standings' },
  { label: 'Knockout', value: 'knockout' },
]
const statusFilters = [
  { label: 'All Status', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Walkover', value: 'walkover' },
]

const tournamentId = computed(() => route.params.tournamentId)
const categoryId = computed(() => route.params.categoryId)
const tournament = computed(() =>
  tournamentStore.activeTournament?.id === tournamentId.value ? tournamentStore.activeTournament : null,
)
const category = computed(() => tournamentStore.activeCategoryById(categoryId.value))
const categoryMatches = computed(() =>
  matchStore.matches.filter(
    (match) => match.tournamentId === tournamentId.value && match.categoryId === categoryId.value,
  ),
)
const groupMatches = computed(() => categoryMatches.value.filter((match) => match.round === 'group'))
const completedGroupMatches = computed(() =>
  groupMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)),
)
const pendingGroupMatchCount = computed(
  () => groupMatches.value.filter((match) => !match.isBye && match.status === 'pending').length,
)
const filteredMatches = computed(() =>
  categoryMatches.value.filter((match) => {
    const matchesGroup =
      groupFilter.value === 'all' ||
      match.groupId === groupFilter.value ||
      match.stage === groupFilter.value
    const matchesStatus = statusFilter.value === 'all' || match.status === statusFilter.value
    return matchesGroup && matchesStatus
  }),
)
const groupFilters = computed(() => [
  { label: 'All Groups', value: 'all' },
  ...(category.value?.groups.map((group) => ({
    label: group.name,
    value: group.id,
  })) || []),
  { label: 'Quarterfinal', value: 'quarterfinal' },
  { label: 'Semifinal', value: 'semifinal' },
  { label: 'Final', value: 'final' },
])
const groupStandings = computed(() =>
  category.value?.groups.map((group) => ({
    group,
    standings: tournamentStore.standingsForGroup(categoryId.value, group.id),
  })) || [],
)
const champion = computed(() => tournamentStore.championForCategory(categoryId.value))
const progress = computed(() =>
  groupMatches.value.length
    ? Math.round((completedGroupMatches.value.length / groupMatches.value.length) * 100)
    : 0,
)
const formatSummary = computed(() => {
  const settings = category.value?.settings || {}
  if (settings.playerTitle) {
    return settings.playerTitle
  }

  if (settings.formatSummary) {
    return settings.formatSummary
  }

  return 'Play group matches. Best players qualify for knockout.'
})
const qualifierCopy = computed(() => {
  const qualifiers = category.value?.settings?.qualifiersPerGroup || tournament.value?.rules?.qualifiersPerGroup || 0
  if (!qualifiers) {
    return 'Best record wins.'
  }

  return category.value?.settings?.groupCount === 1
    ? `Top ${qualifiers} go through.`
    : `Top ${qualifiers} in each group go through.`
})

function countPlayed(groupId) {
  return categoryMatches.value.filter(
    (match) => match.groupId === groupId && ['completed', 'walkover'].includes(match.status),
  ).length
}

function countRemaining(groupId) {
  return categoryMatches.value.filter((match) => match.groupId === groupId && match.status === 'pending')
    .length
}

function getGroupStandings(groupId) {
  return tournamentStore.standingsForGroup(categoryId.value, groupId)
}

function openScore(match) {
  selectedMatch.value = match
}

function viewMatch(match) {
  router.push(`/tournaments/${tournamentId.value}/match/${match.id}`)
}

async function saveScore(payload) {
  await tournamentStore.enterMatchResult(selectedMatch.value.id, payload)
  selectedMatch.value = null
}

async function saveSchedule(payload) {
  await tournamentStore.updateMatchSchedule(selectedMatch.value.id, payload)
}

async function closeRoundRobin() {
  const canContinue =
    pendingGroupMatchCount.value === 0 ||
    window.confirm(
      `${pendingGroupMatchCount.value} group match${
        pendingGroupMatchCount.value === 1 ? ' is' : 'es are'
      } not yet complete. The standings may change. Generate the knockout anyway?`,
    )

  if (canContinue) {
    await tournamentStore.closeRoundRobin(tournamentId.value, categoryId.value)
  }
}

watch(tournamentId, async (nextTournamentId) => {
  hasLoaded.value = false
  selectedTab.value = 'overview'
  groupFilter.value = 'all'
  statusFilter.value = 'all'
  selectedMatch.value = null
  await Promise.all([tournamentStore.fetchTournament(nextTournamentId), matchStore.loadMatches()])
  hasLoaded.value = true
}, { immediate: true })

watch(categoryId, () => {
  selectedTab.value = 'overview'
  groupFilter.value = 'all'
  statusFilter.value = 'all'
})
</script>

<template>
  <section v-if="category && tournament" class="tournament-category">
    <header class="t-hero tournament-category__hero">
      <div class="t-hero__top">
        <div>
          <CategoryStatusBadge :status="category.status" />
          <h2 class="t-hero__title">{{ category.name }}</h2>
          <p class="t-hero__copy">
            Play matches, enter scores, and see who stays alive.
          </p>
        </div>
        <RouterLink class="t-button t-button--secondary" :to="`/tournaments/${tournamentId}`">
          Back to Overview
        </RouterLink>
      </div>

      <div class="t-hero__stats">
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ completedGroupMatches.length }}/{{ groupMatches.length }}</span>
          <span class="t-stat-tile__label">Group matches</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ pendingGroupMatchCount }}</span>
          <span class="t-stat-tile__label">Pending</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ progress }}%</span>
          <span class="t-stat-tile__label">Complete</span>
        </div>
        <div class="t-stat-tile">
          <span class="t-stat-tile__value">{{ champion?.name || 'TBD' }}</span>
          <span class="t-stat-tile__label">Champion</span>
        </div>
      </div>
    </header>

    <nav class="tournament-category__tabs" aria-label="Tournament category tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tournament-category__tab"
        type="button"
        :class="{ 'tournament-category__tab--active': selectedTab === tab.value }"
        @click="selectedTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="selectedTab === 'overview'" class="tournament-category__stack">
      <div class="t-card-grid t-card-grid--two">
        <article v-for="group in category.groups" :key="group.id" class="t-shell-card tournament-category__group-summary">
          <div class="t-section-header">
            <div>
              <h3 class="t-section-title">{{ group.name }}</h3>
              <p class="t-muted">
                {{ group.players.filter((player) => !player.isBye).length }} players /
                {{ countPlayed(group.id) }} played / {{ countRemaining(group.id) }} left
              </p>
            </div>
          </div>
          <div class="t-progress">
            <span
              class="t-progress__fill"
              :style="{
                width: `${
                  countPlayed(group.id) + countRemaining(group.id)
                    ? Math.round((countPlayed(group.id) / (countPlayed(group.id) + countRemaining(group.id))) * 100)
                    : 0
                }%`,
              }"
            ></span>
          </div>
          <div class="tournament-category__mini-table">
            <div v-for="standing in getGroupStandings(group.id).slice(0, 2)" :key="standing.playerId">
              <span>{{ standing.rank }}. {{ standing.name }}</span>
              <strong>{{ standing.points }} pts</strong>
            </div>
          </div>
        </article>
      </div>

      <article class="t-shell-card tournament-category__explainer">
        <span class="t-section-kicker">Simple tournament guide</span>
        <h3 class="t-section-title">How this category works</h3>
        <p class="t-copy">
          {{ formatSummary }} {{ qualifierCopy }}
        </p>
      </article>
    </section>

    <section v-else-if="selectedTab === 'groups'" class="t-card-grid t-card-grid--two">
      <article v-for="group in category.groups" :key="group.id" class="t-shell-card tournament-category__group-card">
        <div class="t-section-header">
          <div>
            <h3 class="t-section-title">{{ group.name }}</h3>
            <p class="t-muted">{{ qualifierCopy }}</p>
          </div>
          <span class="category-status-badge category-status-badge--active">
            {{ group.players.length }} places
          </span>
        </div>

        <div class="tournament-category__players">
          <div
            v-for="player in group.players"
            :key="player.playerId"
            class="tournament-category__player"
            :class="{ 'tournament-category__player--bye': player.isBye }"
          >
            <span>{{ player.isBye ? '-' : player.seed }}</span>
            <strong>{{ player.isBye ? 'BYE' : player.name }}</strong>
          </div>
        </div>

        <p class="t-copy tournament-category__helper">
          Everyone here plays each other once. {{ qualifierCopy }}
        </p>
      </article>
    </section>

    <section v-else-if="selectedTab === 'fixtures'" class="tournament-category__stack">
      <div class="t-filter-bar">
        <button
          v-for="filter in groupFilters"
          :key="filter.value"
          class="t-filter-pill"
          :class="{ 't-filter-pill--active': groupFilter === filter.value }"
          type="button"
          @click="groupFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
      <div class="t-filter-bar">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          class="t-filter-pill"
          :class="{ 't-filter-pill--active': statusFilter === filter.value }"
          type="button"
          @click="statusFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>

      <MatchFixtureCard
        v-for="match in filteredMatches"
        :key="match.id"
        :match="match"
        @score="openScore"
        @view="viewMatch"
      />
      <TournamentEmptyState
        v-if="!filteredMatches.length"
        title="No matches found"
        message="Try another group or status filter."
      />
    </section>

    <section v-else-if="selectedTab === 'standings'" class="t-card-grid t-card-grid--two">
      <StandingsTable
        v-for="entry in groupStandings"
        :key="entry.group.id"
        :title="`${entry.group.name} Standings`"
        :standings="entry.standings"
        :qualifiers="category.settings?.qualifiersPerGroup || tournament.rules.qualifiersPerGroup"
      />
      <TournamentEmptyState
        v-if="!groupStandings.length"
        title="No table"
        message="This category goes straight to knockout, so there is no group table."
      />
    </section>

    <section v-else class="tournament-category__stack">
      <KnockoutChampionCard
        v-if="champion"
        :champion="champion"
        :category-name="category.name"
        :tournament-name="tournament.name"
      />
      <TournamentEmptyState
        v-if="category.status === 'round-robin'"
        title="Complete the group stage first"
        :message="`${pendingGroupMatchCount} group match${
          pendingGroupMatchCount === 1 ? ' is' : 'es are'
        } still pending. Finish those matches, then generate the knockout.`"
        @action="closeRoundRobin"
      >
        <template #action>Generate Knockout</template>
      </TournamentEmptyState>
      <template v-else>
        <article class="t-shell-card tournament-category__ko-note">
          <strong>Knockout is live.</strong>
          <span>{{ formatSummary }}</span>
        </article>
        <BracketTree :knockout="category.knockout" @score="openScore" />
        <BracketTreeMobile :knockout="category.knockout" @score="openScore" />
      </template>
    </section>

    <TournamentMatchModal
      v-if="selectedMatch"
      :match="selectedMatch"
      @close="selectedMatch = null"
      @save="saveScore"
      @schedule="saveSchedule"
    />
  </section>
  <section v-else-if="!hasLoaded || tournamentStore.loading" class="tournament-category">
    <div class="t-shell-card tournament-category__loading">
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
      <span class="t-skeleton"></span>
    </div>
  </section>
  <section v-else class="tournament-category">
    <TournamentEmptyState
      title="Tournament not found"
      message="This tournament may have been created before the app refreshed. Open the tournaments page and choose an available tournament."
      @action="router.push('/tournaments')"
    >
      <template #action>Back to tournaments</template>
    </TournamentEmptyState>
  </section>
</template>

<style scoped>
.tournament-category__tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 2px solid var(--tournament-line);
}

.tournament-category__tab {
  flex: 0 0 auto;
  min-height: 42px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 10px 10px 0 0;
  padding: 10px 16px;
  margin-bottom: -2px;
  background: transparent;
  color: var(--tournament-muted);
  font-size: 13px;
  font-weight: 800;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.tournament-category__tab:hover {
  background: var(--tournament-shell);
  color: var(--tournament-ink);
}

.tournament-category__tab--active {
  border-bottom-color: var(--tournament-green);
  color: var(--tournament-green-dark);
}

.tournament-category__stack,
.tournament-category__group-summary,
.tournament-category__group-card,
.tournament-category__explainer,
.tournament-category__loading {
  display: grid;
  gap: 16px;
}

.tournament-category__group-summary,
.tournament-category__group-card,
.tournament-category__explainer,
.tournament-category__ko-note,
.tournament-category__loading {
  padding: 18px;
}

.tournament-category__mini-table {
  display: grid;
  gap: 0;
}

.tournament-category__mini-table div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--tournament-line);
  font-size: 13px;
}

.tournament-category__mini-table div:last-child {
  border-bottom: none;
}

.tournament-category__mini-table strong {
  color: var(--tournament-green-dark);
}

.tournament-category__players {
  display: grid;
  gap: 6px;
}

.tournament-category__player {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 10px;
  padding: 8px 10px;
  background: var(--tournament-shell);
}

.tournament-category__player span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  color: var(--tournament-muted);
  font-size: 10px;
  font-weight: 800;
}

.tournament-category__player strong {
  min-width: 0;
  overflow: hidden;
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-category__player--bye {
  opacity: 0.72;
}

.tournament-category__helper {
  border-left: 3px solid var(--tournament-green);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--tournament-green-soft);
}

.tournament-category__ko-note {
  display: grid;
  gap: 4px;
  border-color: rgba(29, 111, 181, 0.25);
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
  font-size: 13px;
}

.tournament-category__ko-note strong {
  font-size: 14px;
}
</style>
