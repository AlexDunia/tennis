<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import PersonAvatar from '../../components/PersonAvatar.vue'
import LadderClubRail from '../../components/ladder/LadderClubRail.vue'
import AdminLadderMatchDrawer from '../../components/ladder/AdminLadderMatchDrawer.vue'
import { useAdminStore } from '../../stores/admin'
import { useChallengeStore } from '../../stores/challenge'
import { useNotificationStore } from '../../stores/notification'
import { usePlayerStore } from '../../stores/player'
import {
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
} from '../../config/ladder'
import { getEligibleLadderOpponents } from '../../services/LadderAccessService'
import { startOrResumeLadderMatch } from '../../services/LadderLiveMatchService.js'

const router = useRouter()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const shell = inject('gorraShell', null)

const activeLadderId = ref('')
const selectedPlayerId = ref('')
const selectedOpponentId = ref('')
const drawerResult = ref(null)

const currentPlayer = computed(() => playerStore.currentPlayer)
const basePlayers = computed(() => playerStore.sortedLadder)
const activeClub = computed(() => adminStore.activeClub)
const configuredLadders = computed(() => {
  if (!activeClub.value) return []
  if (adminStore.activeLadders.length) return adminStore.activeLadders
  const config = getActiveLadderConfig()
  return [{ id: config.id, name: config.name, matchType: 'singles' }]
})

function ladderHasPlayer(ladder, player) {
  const explicitIds = ladder.playerIds || ladder.memberIds
  if (Array.isArray(explicitIds)) return explicitIds.includes(player?.id)
  if (Array.isArray(player?.ladderIds)) return player.ladderIds.includes(ladder.id)
  return ladder.id === (activeClub.value?.setup?.primaryLadderId || configuredLadders.value[0]?.id)
}

function rosterFor(ladder) {
  const hasExplicitMembership =
    Array.isArray(ladder?.playerIds) ||
    Array.isArray(ladder?.memberIds) ||
    basePlayers.value.some((player) => Array.isArray(player.ladderIds))
  if (!hasExplicitMembership) return basePlayers.value
  return basePlayers.value.filter((player) => ladderHasPlayer(ladder, player))
}

const ladders = computed(() =>
  configuredLadders.value.map((ladder) => ({
    ...ladder,
    isMember: ladderHasPlayer(ladder, currentPlayer.value),
    playerCount: rosterFor(ladder).length,
  })),
)
const activeLadder = computed(
  () =>
    ladders.value.find((ladder) => ladder.id === activeLadderId.value) || ladders.value[0] || null,
)
const players = computed(() => (activeLadder.value ? rosterFor(activeLadder.value) : []))
const activeLadderConfig = computed(() => ({
  ...getActiveLadderConfig(),
  id: activeLadder.value?.id || getActiveLadderConfig().id,
  name: activeLadder.value?.name || getActiveLadderConfig().name,
}))
const defaultMatchRules = computed(() => ladderMatchConfig(activeLadderConfig.value))
const courts = computed(() => activeClub.value?.setup?.workspace?.courts || [])
const canAdminSetUpMatch = computed(
  () =>
    adminStore.hasActiveClubPermission('club.manage') &&
    adminStore.hasActiveClubPermission('challenges.create'),
)
const selectedPlayer = computed(
  () => players.value.find((player) => player.id === selectedPlayerId.value) || null,
)
const selectedOpponent = computed(
  () => players.value.find((player) => player.id === selectedOpponentId.value) || null,
)
const eligiblePlayers = computed(() =>
  getEligibleLadderOpponents({
    challenger: selectedPlayer.value,
    players: players.value,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
  }),
)
const eligiblePlayerIds = computed(() => new Set(eligiblePlayers.value.map((player) => player.id)))
const drawerOpen = computed(() => Boolean(selectedPlayer.value && selectedOpponent.value))
const guideTitle = computed(() => {
  if (!selectedPlayer.value) return 'Choose a player'
  if (selectedOpponent.value)
    return `${selectedPlayer.value.name} vs ${selectedOpponent.value.name}`
  return `${selectedPlayer.value.name} selected`
})
const guideText = computed(() => {
  if (!selectedPlayer.value) return 'Then choose someone highlighted as eligible.'
  if (!eligiblePlayers.value.length) return 'No eligible opponents are available right now.'
  if (!selectedOpponent.value) return 'Choose one highlighted opponent.'
  return 'Finish setting up the match in the panel.'
})

function pointsFor(player) {
  return Math.max(0, Number(player?.points ?? player?.ladderPoints ?? 0))
}

function isCurrentPlayer(player) {
  return player?.id === playerStore.currentPlayerId
}

function canMemberChallenge(player) {
  return (
    !canAdminSetUpMatch.value &&
    adminStore.hasActiveClubPermission('challenges.create') &&
    isEligibleLadderOpponent(currentPlayer.value, player, activeLadderConfig.value)
  )
}

function playerRowState(player) {
  if (!canAdminSetUpMatch.value || !selectedPlayer.value) return {}
  return {
    selected: player.id === selectedPlayer.value.id,
    eligible: eligiblePlayerIds.value.has(player.id),
    quiet: player.id !== selectedPlayer.value.id && !eligiblePlayerIds.value.has(player.id),
  }
}

function handlePlayerRow(player) {
  if (!canAdminSetUpMatch.value) return
  if (!selectedPlayer.value || player.id === selectedPlayer.value.id) {
    selectedPlayerId.value = player.id === selectedPlayer.value?.id ? '' : player.id
    selectedOpponentId.value = ''
    drawerResult.value = null
    return
  }
  if (!eligiblePlayerIds.value.has(player.id)) {
    notificationStore.addToast({
      message: 'That player is outside the current challenge window.',
      type: 'info',
    })
    return
  }
  selectedOpponentId.value = player.id
  drawerResult.value = null
}

function handlePlayerKeydown(player, event) {
  if (!canAdminSetUpMatch.value || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  handlePlayerRow(player)
}

function openMemberChallenge(player) {
  router.push({ name: 'CreateChallenge', query: { opponent: player.id } })
}

function selectLadder(ladderId) {
  activeLadderId.value = ladderId
  resetSelection()
}

function closeDrawer() {
  selectedOpponentId.value = ''
  drawerResult.value = null
}

function resetSelection() {
  selectedPlayerId.value = ''
  selectedOpponentId.value = ''
  drawerResult.value = null
}

async function createAdminMatch(setup) {
  const result = await challengeStore.createAdminLadderMatch({
    ladderId: activeLadder.value.id,
    challengerPlayerId: selectedPlayer.value.id,
    opponentPlayerId: selectedOpponent.value.id,
    actorId: currentPlayer.value?.id || '',
    ...setup,
  })
  if (!result) return
  drawerResult.value = { ...result, timing: setup.timing }
  notificationStore.addToast({
    message: setup.timing === 'scheduled' ? 'Ladder match scheduled.' : 'Ladder match ready.',
    type: 'success',
  })
}

async function viewMatch(result) {
  const matchId = result?.match?.id
  if (!matchId) return
  if (result.timing !== 'now') {
    router.push({ name: 'MatchDetails', params: { matchId } })
    return
  }
  const started = await startOrResumeLadderMatch({
    match: result.match,
    actorId: currentPlayer.value?.id || '',
    clubId: adminStore.activeClubId || '',
    explicitStart: true,
  })
  if (!started.ok) {
    notificationStore.addToast({
      message: started.message || 'The canonical live Match could not be started.',
      type: 'warning',
    })
    return
  }
  router.push({ name: 'LiveMatch', params: { matchId: started.match.id } })
}

watch(
  ladders,
  (items) => {
    if (!items.length) {
      activeLadderId.value = ''
      return
    }
    if (!items.some((ladder) => ladder.id === activeLadderId.value)) {
      activeLadderId.value =
        items.find((ladder) => ladder.isMember)?.id ||
        activeClub.value?.setup?.primaryLadderId ||
        items[0].id
    }
  },
  { immediate: true },
)

watch(drawerOpen, (isOpen) => {
  if (isOpen) shell?.beginAdminMatchDrawer?.()
  else shell?.endAdminMatchDrawer?.()
})

watch(canAdminSetUpMatch, (canSetUp) => {
  if (canSetUp && !challengeStore.challenges.length && !challengeStore.isLoading) {
    challengeStore.loadChallenges()
  }
})

onMounted(async () => {
  const tasks = []
  if (!playerStore.players.length) tasks.push(playerStore.loadPlayers())
  if (!adminStore.activeClub) tasks.push(adminStore.loadClubs())
  if (canAdminSetUpMatch.value && !challengeStore.challenges.length) {
    tasks.push(challengeStore.loadChallenges())
  }
  await Promise.allSettled(tasks)
})

onUnmounted(() => shell?.endAdminMatchDrawer?.())
</script>

<template>
  <section
    class="gorra-compete-ref gorra-ladder-ref ladder-view"
    :class="{ 'ladder-view--drawer': drawerOpen }"
  >
    <LadderClubRail
      :club="activeClub"
      :ladders="ladders"
      :active-ladder-id="activeLadder?.id || ''"
      @select="selectLadder"
    />

    <main class="ladder-workspace">
      <div v-if="playerStore.isLoading" class="ladder-loading" aria-label="Loading ladder">
        <span v-for="index in 6" :key="index" class="skeleton-card skeleton-line"></span>
      </div>

      <section v-else-if="playerStore.error" class="ladder-error" role="alert">
        <div>
          <h2>We could not load the Ladder</h2>
          <p>{{ playerStore.error }}</p>
        </div>
        <button class="button-secondary" type="button" @click="playerStore.loadPlayers">
          Try again
        </button>
      </section>

      <template v-else>

        <header class="ladder-heading">
          <div>
            <h1>{{ activeLadder?.name || 'Ladder' }}</h1>
            <p>
              {{ players.length }} {{ players.length === 1 ? 'player' : 'players' }}
              <template v-if="activeClub?.name">
                · {{ activeClub.name }}
              </template>
            </p>
          </div>

          <div class="ladder-heading__actions">
            <RouterLink
              class="compete-secondary"
              :to="{ name: 'Challenges' }"
            >
              Challenges
            </RouterLink>

            <RouterLink
              v-if="!canAdminSetUpMatch"
              class="compete-primary"
              :to="{ name: 'CreateChallenge' }"
            >
              New challenge
            </RouterLink>
          </div>
        </header>

        <section v-if="canAdminSetUpMatch && players.length" class="selection-guide">
          <span>
            <strong>{{ guideTitle }}</strong>
            <small>{{ guideText }}</small>
          </span>
          <button v-if="selectedPlayer" type="button" @click="resetSelection">Clear</button>
        </section>

        <section v-if="players.length" class="ladder-list" aria-label="Club Ladder ranking">
          <div
            v-for="player in players"
            :key="player.id"
            class="ladder-row"
            :class="{
              'ladder-row--you': isCurrentPlayer(player),
              'ladder-row--selected': playerRowState(player).selected,
              'ladder-row--eligible': playerRowState(player).eligible,
              'ladder-row--quiet': playerRowState(player).quiet,
              'ladder-row--interactive': canAdminSetUpMatch,
            }"
            :role="canAdminSetUpMatch ? 'button' : undefined"
            :tabindex="canAdminSetUpMatch ? 0 : undefined"
            @click="handlePlayerRow(player)"
            @keydown="handlePlayerKeydown(player, $event)"
          >
            <strong class="ladder-row__rank">#{{ player.rank }}</strong>
            <PersonAvatar :name="player.name" :image="player.imageUrl" :size="40" />
            <span class="ladder-row__player">
              <strong>{{ player.name }}</strong>
              <small v-if="isCurrentPlayer(player)">You</small>
            </span>
            <span class="ladder-row__points">{{ pointsFor(player) }} pts</span>
            <span v-if="canAdminSetUpMatch" class="ladder-row__status">
              <small v-if="playerRowState(player).selected">Selected</small>
              <small v-else-if="playerRowState(player).eligible">Can challenge</small>
              <small v-else-if="selectedPlayer">Not eligible</small>
              <small v-else>Select</small>
            </span>
            <button
              v-else-if="canMemberChallenge(player)"
              class="button-primary ladder-row__action"
              type="button"
              :aria-label="`Challenge ${player.name}`"
              @click.stop="openMemberChallenge(player)"
            >
              Challenge
            </button>
          </div>
        </section>

        <EmptyState
          v-else
          illustration="ladder"
          title="This Ladder is waiting for players"
          description="Club members will appear here once they are placed on this Ladder."
        />
      </template>
    </main>

    <AdminLadderMatchDrawer
      :open="drawerOpen"
      :ladder="activeLadder"
      :player-a="selectedPlayer"
      :player-b="selectedOpponent"
      :ladder-rules="defaultMatchRules"
      :rules-editable="canAdminSetUpMatch"
      :courts="courts"
      :submitting="challengeStore.isLoading"
      :error="challengeStore.error"
      :result="drawerResult"
      @close="closeDrawer"
      @submit="createAdminMatch"
      @view="viewMatch"
      @done="resetSelection"
    />
  </section>
</template>

<style scoped>
.ladder-view {
  display: grid;
  min-width: 0;
  min-height: calc(100vh - var(--app-header-height));
  grid-template-columns: 236px minmax(0, 1fr) 0;
  background: var(--color-bg);
  transition: grid-template-columns var(--motion-medium) var(--motion-curve);
}

.ladder-view--drawer {
  grid-template-columns: 236px minmax(0, 1fr) 390px;
}

.ladder-workspace {
  min-width: 0;
  padding: 24px 30px 46px;
}

.ladder-loading {
  display: grid;
  gap: 10px;
}

.ladder-loading .skeleton-card {
  display: block;
  min-height: 66px;
  border-radius: var(--app-card-radius);
}

.ladder-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.ladder-error h2,
.ladder-error p {
  margin: 0;
}

.ladder-error h2 {
  font-size: 15px;
}

.ladder-error p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 12px;
}

.ladder-breadcrumb {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 9px;
  color: color-mix(in srgb, var(--color-muted) 75%, white);
  font-size: 10px;
  font-weight: var(--font-weight-regular);
  line-height: 1.25;
}

.ladder-breadcrumb a {
  color: var(--color-muted);
  text-decoration: none;
}

.ladder-breadcrumb a:hover {
  color: var(--color-text-soft);
}

.ladder-breadcrumb i {
  color: var(--color-border-strong);
  font-style: normal;
}

.ladder-breadcrumb strong {
  color: var(--color-muted);
  font-weight: var(--font-weight-medium);
}

.ladder-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.ladder-heading h1,
.ladder-heading p {
  margin: 0;
}

.ladder-heading h1 {
  color: var(--color-text);
  font-size: 23px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
}

.ladder-heading > div p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 12px;
}

.ladder-heading > p {
  max-width: 290px;
  color: var(--color-muted);
  font-size: 11px;
  line-height: 1.45;
  text-align: right;
}

.selection-guide {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
}

.selection-guide > span {
  display: grid;
  gap: 2px;
}

.selection-guide strong {
  font-size: 12px;
}

.selection-guide small {
  color: var(--color-muted);
  font-size: 10px;
}

.selection-guide button {
  min-height: 32px;
  padding: 0 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius);
  background: var(--color-surface);
  color: var(--color-text-soft);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
}

.ladder-list {
  display: grid;
  gap: 9px;
}

.ladder-row {
  display: grid;
  min-width: 0;
  min-height: 65px;
  grid-template-columns: 38px 40px minmax(120px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 9px 14px 9px 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--app-card-radius);
  background: var(--color-surface);
  transition:
    opacity var(--motion-short) ease,
    border-color var(--motion-short) ease,
    background var(--motion-short) ease;
}

.ladder-row--interactive {
  cursor: pointer;
}

.ladder-row--interactive:hover,
.ladder-row--interactive:focus-visible {
  border-color: var(--color-border-strong);
}

.ladder-row--selected {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, white);
}

.ladder-row--eligible {
  border-color: color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
  background: color-mix(in srgb, var(--color-primary) 2%, white);
}

.ladder-row--quiet {
  opacity: 0.42;
}

.ladder-row--you:not(.ladder-row--selected) {
  background: color-mix(in srgb, var(--color-primary) 4%, white);
}

.ladder-row__rank {
  color: var(--color-text-soft);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.ladder-row__player {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.ladder-row__player strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladder-row__player small {
  color: var(--color-primary-strong);
  font-size: 9px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
}

.ladder-row__points {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.ladder-row__status {
  min-width: 92px;
  text-align: right;
}

.ladder-row__status small {
  display: inline-flex;
  min-height: 29px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: var(--app-inner-radius);
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
}

.ladder-row--selected .ladder-row__status small,
.ladder-row--eligible .ladder-row__status small {
  background: color-mix(in srgb, var(--color-primary) 10%, white);
  color: var(--color-primary-strong);
}

.ladder-row__action {
  min-height: 36px;
  padding: 7px 11px;
  font-size: 11px;
}

@media (max-width: 1180px) {
  .ladder-view--drawer {
    grid-template-columns: 214px minmax(0, 1fr) 0;
  }

  .ladder-view :deep(.ladder-rail) {
    width: 214px;
  }

  .ladder-workspace {
    padding-inline: 22px;
  }
}

@media (max-width: 900px) {
  .ladder-heading > p {
    display: none;
  }

  .ladder-row {
    grid-template-columns: 34px 40px minmax(0, 1fr) auto;
  }

  .ladder-row__points {
    display: none;
  }
}

@media (max-width: 767px) {
  .ladder-view,
  .ladder-view--drawer {
    display: block;
    min-height: auto;
  }

  .ladder-workspace {
    width: 85%;
    margin-inline: auto;
    padding: 17px 0 30px;
  }

  .ladder-heading h1 {
    font-size: 21px;
  }

  .ladder-row {
    min-height: 62px;
    grid-template-columns: 27px 36px minmax(0, 1fr) auto;
    gap: 8px;
    padding: 9px 10px;
  }

  .ladder-row :deep(.person-avatar) {
    width: 36px !important;
    height: 36px !important;
  }

  .ladder-row__status {
    min-width: 0;
  }

  .ladder-row__status small {
    min-height: 27px;
    padding-inline: 6px;
    font-size: 8px;
  }

  .ladder-row__player small {
    display: none;
  }

  .ladder-error {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 420px) {
  .ladder-workspace {
    width: calc(100% - 24px);
  }

  .selection-guide {
    align-items: flex-start;
  }

  .selection-guide small {
    line-height: 1.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ladder-view,
  .ladder-row {
    transition: none;
  }
}
</style>
