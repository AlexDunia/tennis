<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMatchStore } from '../stores/match'
import { usePlayerStore } from '../stores/player'
import { useTournamentStore } from '../stores/tournament'
import BracketTree from '../components/tournament/BracketTree.vue'
import BracketTreeMobile from '../components/tournament/BracketTreeMobile.vue'
import CategoryStatusBadge from '../components/tournament/CategoryStatusBadge.vue'
import KnockoutChampionCard from '../components/tournament/KnockoutChampionCard.vue'
import MatchFixtureCard from '../components/tournament/MatchFixtureCard.vue'
import StandingsTable from '../components/tournament/StandingsTable.vue'
import TournamentEmptyState from '../components/tournament/TournamentEmptyState.vue'
import TournamentMatchModal from '../components/tournament/TournamentMatchModal.vue'
import { useTournamentLiveRefresh } from '../composables/useTournamentLiveRefresh'

const route = useRoute()
const router = useRouter()
const matchStore = useMatchStore()
const playerStore = usePlayerStore()
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
const playableCategoryMatches = computed(() => categoryMatches.value.filter((match) => !match.isBye))
const groupMatches = computed(() =>
  playableCategoryMatches.value.filter((match) => match.round === 'group'),
)
const completedGroupMatches = computed(() =>
  groupMatches.value.filter((match) => ['completed', 'walkover'].includes(match.status)),
)
const pendingGroupMatchCount = computed(
  () => groupMatches.value.filter((match) => match.status === 'pending').length,
)
const filteredMatches = computed(() =>
  playableCategoryMatches.value.filter((match) => {
    const matchesGroup =
      groupFilter.value === 'all' ||
      match.groupId === groupFilter.value ||
      match.stage === groupFilter.value
    const matchesStatus = statusFilter.value === 'all' || match.status === statusFilter.value
    return matchesGroup && matchesStatus
  }),
)
const groupFilters = computed(() => {
  const baseFilters = [
    { label: 'All Groups', value: 'all' },
    ...(category.value?.groups.map((group) => ({
      label: group.name,
      value: group.id,
    })) || []),
    { label: 'Quarterfinal', value: 'quarterfinal' },
    { label: 'Semifinal', value: 'semifinal' },
    { label: 'Final', value: 'final' },
  ]

  return baseFilters.map((filter) => ({
    ...filter,
    count: countMatchesForGroupFilter(filter.value),
  }))
})
const statusFilters = computed(() => {
  const filters = [
    { label: 'All Status', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Completed', value: 'completed' },
    { label: 'Walkover', value: 'walkover' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Waiting', value: 'waiting' },
  ]

  return filters
    .map((filter) => ({
      ...filter,
      count: countMatchesForStatusFilter(filter.value),
    }))
    .filter((filter) => filter.value === 'all' || filter.count > 0 || filter.value === statusFilter.value)
})
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
const canManageTournament = computed(() => playerStore.currentPlayerCan('tournaments.score.update'))
const currentPlayer = computed(() => playerStore.currentPlayer)
const currentPlayerId = computed(() => currentPlayer.value?.id || '')
const currentPlayerFirstName = computed(() => currentPlayer.value?.name?.split(' ')[0] || 'Player')
const currentPlayerGroupEntry = computed(() => {
  if (!category.value || !currentPlayerId.value) {
    return null
  }

  for (const group of category.value.groups || []) {
    const player = group.players.find((entry) => entry.playerId === currentPlayerId.value)
    if (player) {
      return { group, player }
    }
  }

  return null
})
const currentPlayerMatches = computed(() =>
  playableCategoryMatches.value.filter(
    (match) => match.player1Id === currentPlayerId.value || match.player2Id === currentPlayerId.value,
  ),
)
const currentPlayerPendingCount = computed(
  () => currentPlayerMatches.value.filter((match) => match.status === 'pending').length,
)
const activeGroupFilter = computed(
  () => groupFilters.value.find((filter) => filter.value === groupFilter.value) || groupFilters.value[0],
)
const activeStatusFilter = computed(
  () => statusFilters.value.find((filter) => filter.value === statusFilter.value) || statusFilters.value[0],
)
const filterSummaryTitle = computed(() => {
  const count = filteredMatches.value.length
  const noun = count === 1 ? 'match' : 'matches'
  return `${count} ${noun} showing`
})
const filterSummaryCopy = computed(() => {
  const groupLabel = activeGroupFilter.value?.label || 'All Groups'
  const statusLabel = activeStatusFilter.value?.label || 'All Status'
  const name = currentPlayerFirstName.value
  const playerCount = filteredMatches.value.filter(
    (match) => match.player1Id === currentPlayerId.value || match.player2Id === currentPlayerId.value,
  ).length

  if (!filteredMatches.value.length) {
    return `${name}, there are no ${statusLabel.toLowerCase()} matches in ${groupLabel} right now.`
  }

  if (canManageTournament.value && statusFilter.value === 'pending') {
    return `${name}, these are ready for live scoring or score entry. ${playerCount ? `${playerCount} includes you.` : 'Scores refresh for everyone after saving.'}`
  }

  if (playerCount) {
    return `${name}, ${playerCount} of these ${filteredMatches.value.length} matches include you.`
  }

  return `${name}, you are viewing ${statusLabel.toLowerCase()} matches in ${groupLabel}. Updates refresh here as scores change.`
})
const personalCategoryCopy = computed(() => {
  const name = currentPlayerFirstName.value
  const entry = currentPlayerGroupEntry.value

  if (!entry) {
    return `${name}, you are not listed in this division. You can still follow every score as it updates.`
  }

  return `${name}, you are in ${entry.group.name} as seed #${entry.player.seed}. ${currentPlayerPendingCount.value} of your matches still need a result.`
})

useTournamentLiveRefresh(tournamentId)

function isCurrentPlayer(playerId) {
  return Boolean(currentPlayerId.value && playerId === currentPlayerId.value)
}

function countMatchesForGroupFilter(filterValue) {
  if (filterValue === 'all') {
    return playableCategoryMatches.value.length
  }

  return playableCategoryMatches.value.filter(
    (match) => match.groupId === filterValue || match.stage === filterValue,
  ).length
}

function countMatchesForStatusFilter(filterValue) {
  if (filterValue === 'all') {
    return playableCategoryMatches.value.length
  }

  return playableCategoryMatches.value.filter((match) => match.status === filterValue).length
}

function countPlayed(groupId) {
  return categoryMatches.value.filter(
    (match) => !match.isBye && match.groupId === groupId && ['completed', 'walkover'].includes(match.status),
  ).length
}

function countRemaining(groupId) {
  return categoryMatches.value.filter((match) => !match.isBye && match.groupId === groupId && match.status === 'pending')
    .length
}

function getGroupStandings(groupId) {
  return tournamentStore.standingsForGroup(categoryId.value, groupId)
}

function openScore(match) {
  if (!canManageTournament.value) {
    return
  }

  selectedMatch.value = match
}

function viewMatch(match) {
  router.push(`/tournaments/${tournamentId.value}/match/${match.id}`)
}

function openLiveBoard(match) {
  if (!canManageTournament.value) {
    return
  }

  router.push(`/play/${match.id}`)
}

async function saveScore(payload) {
  await tournamentStore.enterMatchResult(selectedMatch.value.id, payload)
  selectedMatch.value = null
}

async function saveSchedule(payload) {
  await tournamentStore.updateMatchSchedule(selectedMatch.value.id, payload)
}

async function closeRoundRobin() {
  if (!playerStore.currentPlayerCan('tournaments.knockout.manage')) {
    return
  }

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
  await Promise.all([tournamentStore.fetchTournament(nextTournamentId), matchStore.loadMatches(), playerStore.loadPlayers()])
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

    <section class="t-shell-card tournament-category__personal">
      <span class="t-section-kicker">Your place here</span>
      <strong>{{ personalCategoryCopy }}</strong>
      <p>
        {{ canManageTournament ? 'Admin changes refresh for viewers automatically.' : 'You will see score changes here automatically.' }}
      </p>
    </section>

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
        <article
          v-for="group in category.groups"
          :key="group.id"
          class="t-shell-card tournament-category__group-summary"
          :class="{ 'tournament-category__group-summary--current': currentPlayerGroupEntry?.group.id === group.id }"
        >
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
            <div
              v-for="standing in getGroupStandings(group.id).slice(0, 2)"
              :key="standing.playerId"
              :class="{ 'tournament-category__mini-row--current': isCurrentPlayer(standing.playerId) }"
            >
              <span>{{ standing.rank }}. {{ standing.name }} <em v-if="isCurrentPlayer(standing.playerId)">You</em></span>
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
      <article
        v-for="group in category.groups"
        :key="group.id"
        class="t-shell-card tournament-category__group-card"
        :class="{ 'tournament-category__group-card--current': currentPlayerGroupEntry?.group.id === group.id }"
      >
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
            :class="{
              'tournament-category__player--bye': player.isBye,
              'tournament-category__player--current': isCurrentPlayer(player.playerId),
            }"
          >
            <span>{{ player.isBye ? '-' : player.seed }}</span>
            <strong>{{ player.isBye ? 'BYE' : player.name }}</strong>
            <em v-if="isCurrentPlayer(player.playerId)">You</em>
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
          {{ filter.label }} <span>{{ filter.count }}</span>
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
          {{ filter.label }} <span>{{ filter.count }}</span>
        </button>
      </div>

      <article class="t-shell-card tournament-category__filter-summary">
        <span class="t-section-kicker">{{ activeGroupFilter?.label }} / {{ activeStatusFilter?.label }}</span>
        <strong>{{ filterSummaryTitle }}</strong>
        <p>{{ filterSummaryCopy }}</p>
      </article>

      <MatchFixtureCard
        v-for="match in filteredMatches"
        :key="match.id"
        :can-manage="canManageTournament"
        :current-player-id="currentPlayerId"
        :match="match"
        @live="openLiveBoard"
        @score="openScore"
        @view="viewMatch"
      />
      <TournamentEmptyState
        v-if="!filteredMatches.length"
        :title="groupMatches.length ? 'No fixtures match this view' : 'Fixtures have not been generated'"
        :message="groupMatches.length ? 'Try changing the group or status filter.' : 'Confirm the players and competition format before generating fixtures.'"
      />
    </section>

    <section v-else-if="selectedTab === 'standings'" class="t-card-grid t-card-grid--two">
      <StandingsTable
        v-for="entry in groupStandings"
        :key="entry.group.id"
        :current-player-id="currentPlayerId"
        :title="`${entry.group.name} Standings`"
        :standings="entry.standings"
        :qualifiers="category.settings?.qualifiersPerGroup || tournament.rules.qualifiersPerGroup"
      />
      <TournamentEmptyState
        v-if="!groupStandings.length"
        title="Standings are not applicable"
        message="This category goes straight to knockout, so a group standings table is not used."
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
        title="The bracket has not been created"
        :message="`${pendingGroupMatchCount} group match${
          pendingGroupMatchCount === 1 ? ' is' : 'es are'
        } still pending. Finish those matches, then generate the knockout.`"
        @action="closeRoundRobin"
      >
        <template v-if="playerStore.currentPlayerCan('tournaments.knockout.manage')" #action>
          Generate Knockout
        </template>
      </TournamentEmptyState>
      <template v-else>
        <article class="t-shell-card tournament-category__ko-note">
          <strong>Knockout is live.</strong>
          <span>{{ formatSummary }}</span>
        </article>
        <BracketTree
          :can-manage="canManageTournament"
          :current-player-id="currentPlayerId"
          :knockout="category.knockout"
          @score="openScore"
        />
        <BracketTreeMobile
          :can-manage="canManageTournament"
          :current-player-id="currentPlayerId"
          :knockout="category.knockout"
          @score="openScore"
        />
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
  font-weight: var(--font-weight-semibold);
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
.tournament-category__personal,
.tournament-category__filter-summary,
.tournament-category__loading {
  display: grid;
  gap: 16px;
}

.tournament-category__group-summary,
.tournament-category__group-card,
.tournament-category__explainer,
.tournament-category__ko-note,
.tournament-category__personal,
.tournament-category__filter-summary,
.tournament-category__loading {
  padding: 18px;
}

.tournament-category__personal,
.tournament-category__filter-summary {
  gap: 6px;
  border-color: rgba(0, 181, 26, 0.24);
  background: linear-gradient(180deg, #ffffff 0%, rgba(0, 181, 26, 0.04) 100%);
}

.tournament-category__personal strong,
.tournament-category__filter-summary strong {
  color: var(--tournament-ink);
  font-size: 14px;
  line-height: 1.45;
}

.tournament-category__personal p,
.tournament-category__filter-summary p {
  margin: 0;
  color: var(--tournament-muted);
  font-size: 12px;
  font-weight: var(--font-weight-bold);
}

.tournament-category__group-summary--current,
.tournament-category__group-card--current {
  border-color: rgba(0, 181, 26, 0.38);
  background: linear-gradient(180deg, #ffffff 0%, rgba(0, 181, 26, 0.045) 100%);
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

.tournament-category__mini-row--current {
  border-radius: 8px;
  padding-inline: 8px !important;
  background: var(--tournament-green-soft);
}

.tournament-category__mini-table em,
.tournament-category__player em {
  display: inline-flex;
  margin-left: 6px;
  border-radius: 999px;
  padding: 1px 6px;
  background: #ffffff;
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-style: normal;
  font-weight: var(--font-weight-bold);
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
  font-weight: var(--font-weight-semibold);
}

.tournament-category__player strong {
  min-width: 0;
  overflow: hidden;
  color: var(--tournament-ink);
  font-size: 13px;
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tournament-category__player--bye {
  opacity: 0.72;
}

.tournament-category__player--current {
  background: var(--tournament-green-soft);
  box-shadow: inset 4px 0 0 var(--tournament-green);
}

.t-filter-pill span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  margin-left: 4px;
  border-radius: 999px;
  padding: 0 6px;
  background: rgba(15, 23, 32, 0.08);
  color: inherit;
  font-size: 11px;
  font-weight: var(--font-weight-bold);
}

.t-filter-pill--active span {
  background: #ffffff;
  color: var(--tournament-green-dark);
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
