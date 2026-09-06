<script setup>
import {
  computed,
  inject,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import PersonAvatar from '../../components/PersonAvatar.vue'
import LadderClubRail from '../../components/ladder/LadderClubRail.vue'
import AdminLadderMatchDrawer from '../../components/ladder/AdminLadderMatchDrawer.vue'
import LadderPlayerOptions from '../../components/ladder/LadderPlayerOptions.vue'
import MoveLadderPlayerDialog from '../../components/ladder/MoveLadderPlayerDialog.vue'
import RecordMissingMatchDialog from '../../components/ladder/RecordMissingMatchDialog.vue'
import RemoveLadderPlayerDialog from '../../components/ladder/RemoveLadderPlayerDialog.vue'
import { useAdminStore } from '../../stores/admin'
import { useChallengeStore } from '../../stores/challenge'
import { useNotificationStore } from '../../stores/notification'
import { usePlayerStore } from '../../stores/player'
import {
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
  resolveLadderConfigFromSetup,
} from '../../config/ladder'
import { getEligibleLadderOpponents } from '../../services/LadderAccessService'
import { startOrResumeLadderMatch } from '../../services/LadderLiveMatchService.js'
import {
  effectiveLadderRoster,
  moveLadderPlayer,
  previewManualLadderMove,
  previewMissingMatchMovement,
  recordMissingLadderMatch,
  removePlayerFromLadder,
  setLadderChallengePaused,
} from '../../services/LadderAdminService.js'

const router = useRouter()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const shell = inject('gorraShell', null)

const activeLadderId = ref('')
const managedPlayerId = ref('')
const selectedPlayerId = ref('')
const selectedOpponentId = ref('')
const drawerResult = ref(null)
const moveDialogOpen = ref(false)
const missingMatchDialogOpen = ref(false)
const removeDialogOpen = ref(false)
const ladderActionBusy = ref(false)
const ladderRevision = ref(0)

const currentPlayer = computed(() => playerStore.currentPlayer)
const basePlayers = computed(() => playerStore.sortedLadder)
const activeClub = computed(() => adminStore.activeClub)

const configuredLadders = computed(() => {
  if (!activeClub.value) return []

  if (adminStore.activeLadders.length) {
    return adminStore.activeLadders
  }

  const config = getActiveLadderConfig()

  return [
    {
      id: config.id,
      name: config.name,
      matchType: config.matchType || 'singles',
    },
  ]
})

function ladderHasPlayer(ladder, player) {
  const explicitIds = ladder.playerIds || ladder.memberIds

  if (Array.isArray(explicitIds)) {
    return explicitIds.includes(player?.id)
  }

  if (Array.isArray(player?.ladderIds)) {
    return player.ladderIds.includes(ladder.id)
  }

  return (
    ladder.id ===
    (
      activeClub.value?.setup?.primaryLadderId ||
      configuredLadders.value[0]?.id
    )
  )
}

function rawRosterFor(ladder) {
  const hasExplicitMembership =
    Array.isArray(ladder?.playerIds) ||
    Array.isArray(ladder?.memberIds) ||
    basePlayers.value.some(
      (player) => Array.isArray(player.ladderIds),
    )

  if (!hasExplicitMembership) {
    return basePlayers.value
  }

  return basePlayers.value.filter(
    (player) => ladderHasPlayer(ladder, player),
  )
}

function scopeFor(ladder) {
  return {
    clubId: adminStore.activeClubId || activeClub.value?.id || '',
    ladderId: ladder?.id || '',
  }
}

function effectiveRosterFor(ladder) {
  // Keeps local ladder administration state reactive without
  // duplicating the roster in this view.
  ladderRevision.value

  return effectiveLadderRoster(
    scopeFor(ladder),
    rawRosterFor(ladder),
  )
}

const ladders = computed(() =>
  configuredLadders.value.map((ladder) => ({
    ...ladder,
    isMember: ladderHasPlayer(
      ladder,
      currentPlayer.value,
    ),
    playerCount: effectiveRosterFor(ladder).length,
  })),
)

const activeLadder = computed(
  () =>
    ladders.value.find(
      (ladder) => ladder.id === activeLadderId.value,
    ) ||
    ladders.value[0] ||
    null,
)

const rawPlayers = computed(() =>
  activeLadder.value
    ? rawRosterFor(activeLadder.value)
    : [],
)

const players = computed(() =>
  activeLadder.value
    ? effectiveRosterFor(activeLadder.value)
    : [],
)

const ladderScope = computed(() =>
  scopeFor(activeLadder.value),
)

const activeLadderConfig = computed(() => {
  const resolved = resolveLadderConfigFromSetup(
    activeClub.value?.setup || {},
    activeLadder.value?.id || '',
  )

  return {
    ...resolved,
    id:
      activeLadder.value?.id ||
      resolved.id,
    name:
      activeLadder.value?.name ||
      resolved.name,
    matchType:
      activeLadder.value?.matchType ||
      resolved.matchType ||
      'singles',
  }
})

const defaultMatchRules = computed(() =>
  ladderMatchConfig(activeLadderConfig.value),
)

const courts = computed(
  () =>
    activeClub.value?.setup?.workspace?.courts || [],
)

const canManageLadder = computed(() =>
  adminStore.hasActiveClubPermission('club.manage'),
)

const canAdminSetUpMatch = computed(
  () =>
    canManageLadder.value &&
    adminStore.hasActiveClubPermission(
      'challenges.create',
    ),
)

const managedPlayer = computed(
  () =>
    players.value.find(
      (player) => player.id === managedPlayerId.value,
    ) || null,
)

const selectedPlayer = computed(
  () =>
    players.value.find(
      (player) => player.id === selectedPlayerId.value,
    ) || null,
)

const selectedOpponent = computed(
  () =>
    players.value.find(
      (player) => player.id === selectedOpponentId.value,
    ) || null,
)

const currentLadderPlayer = computed(
  () =>
    players.value.find(
      (player) =>
        player.id === playerStore.currentPlayerId,
    ) || currentPlayer.value,
)

const eligiblePlayers = computed(() => {
  if (
    !selectedPlayer.value ||
    selectedPlayer.value.challengePaused
  ) {
    return []
  }

  return getEligibleLadderOpponents({
    challenger: selectedPlayer.value,
    players: players.value,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
  }).filter((player) => !player.challengePaused)
})

const eligiblePlayerIds = computed(
  () =>
    new Set(
      eligiblePlayers.value.map((player) => player.id),
    ),
)

const drawerOpen = computed(
  () =>
    Boolean(
      selectedPlayer.value &&
      selectedOpponent.value,
    ),
)

const challengeSelectionActive = computed(
  () =>
    Boolean(
      canAdminSetUpMatch.value &&
      selectedPlayer.value &&
      !selectedOpponent.value,
    ),
)

const guideTitle = computed(() => {
  if (!selectedPlayer.value) return ''

  if (selectedOpponent.value) {
    return `${selectedPlayer.value.name} vs ${selectedOpponent.value.name}`
  }

  return `Choose an opponent for ${selectedPlayer.value.name}`
})

const guideText = computed(() => {
  if (!selectedPlayer.value) return ''

  if (selectedPlayer.value.challengePaused) {
    return 'Challenges are paused for this player.'
  }

  if (!eligiblePlayers.value.length) {
    return 'No eligible opponents are available right now.'
  }

  if (!selectedOpponent.value) {
    return 'Only eligible players are highlighted.'
  }

  return 'Finish setting up the match in the panel.'
})

const usesPoints = computed(
  () =>
    activeLadderConfig.value.movementSystem ===
    'points',
)

function pointsFor(player) {
  return Math.max(
    0,
    Number(
      player?.points ??
        player?.ladderPoints ??
        0,
    ),
  )
}

function matchesFor(player) {
  return Math.max(
    0,
    Number(
      player?.matches ??
        player?.matchesPlayed ??
        0,
    ),
  )
}

function isCurrentPlayer(player) {
  return (
    player?.id === playerStore.currentPlayerId
  )
}

function canMemberChallenge(player) {
  return (
    !canManageLadder.value &&
    adminStore.hasActiveClubPermission(
      'challenges.create',
    ) &&
    !currentLadderPlayer.value?.challengePaused &&
    !player?.challengePaused &&
    isEligibleLadderOpponent(
      currentLadderPlayer.value,
      player,
      activeLadderConfig.value,
    )
  )
}

function adminEligibleOpponentsFor(player) {
  if (
    !canAdminSetUpMatch.value ||
    !player ||
    player.challengePaused
  ) {
    return []
  }

  return getEligibleLadderOpponents({
    challenger: player,
    players: players.value,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
  }).filter(
    (opponent) => !opponent.challengePaused,
  )
}

function canSetUpChallengeFor(player) {
  return adminEligibleOpponentsFor(player).length > 0
}

function playerRowState(player) {
  if (!canManageLadder.value) return {}

  if (selectedPlayer.value) {
    return {
      selected:
        player.id === selectedPlayer.value.id,
      eligible:
        eligiblePlayerIds.value.has(player.id),
      quiet:
        player.id !== selectedPlayer.value.id &&
        !eligiblePlayerIds.value.has(player.id),
      managed: false,
    }
  }

  return {
    selected: false,
    eligible: false,
    quiet: false,
    managed:
      player.id === managedPlayerId.value,
  }
}

function handlePlayerRow(player) {
  if (!canManageLadder.value) return

  if (selectedPlayer.value) {
    if (
      player.id === selectedPlayer.value.id
    ) {
      resetChallengeSelection()
      return
    }

    if (
      !eligiblePlayerIds.value.has(player.id)
    ) {
      notificationStore.addToast({
        title: 'Not available',
        message:
          'That player is outside the current challenge window.',
        type: 'info',
      })
      return
    }

    selectedOpponentId.value = player.id
    drawerResult.value = null
    return
  }

  managedPlayerId.value =
    managedPlayerId.value === player.id
      ? ''
      : player.id
}

function handlePlayerKeydown(player, event) {
  if (
    !canManageLadder.value ||
    !['Enter', ' '].includes(event.key)
  ) {
    return
  }

  event.preventDefault()
  handlePlayerRow(player)
}

function openMemberChallenge(player) {
  if (
    currentLadderPlayer.value?.challengePaused
  ) {
    notificationStore.addToast({
      title: 'Challenges are paused',
      message:
        'Resume challenges before creating a new one.',
      type: 'info',
    })
    return
  }

  router.push({
    name: 'CreateChallenge',
    query: { opponent: player.id },
  })
}

function selectLadder(ladderId) {
  activeLadderId.value = ladderId
  resetAllPlayerActions()
}

function closeDrawer() {
  selectedOpponentId.value = ''
  drawerResult.value = null
}

function resetChallengeSelection() {
  selectedPlayerId.value = ''
  selectedOpponentId.value = ''
  drawerResult.value = null
}

function resetAllPlayerActions() {
  managedPlayerId.value = ''
  moveDialogOpen.value = false
  missingMatchDialogOpen.value = false
  removeDialogOpen.value = false
  resetChallengeSelection()
}

function startAdminChallenge(player) {
  if (!canAdminSetUpMatch.value) {
    notificationStore.addToast({
      title: 'Challenge unavailable',
      message:
        'Your club role cannot create ladder challenges.',
      type: 'warning',
    })
    return
  }

  if (player?.challengePaused) {
    notificationStore.addToast({
      title: 'Challenges are paused',
      message: `Resume challenges for ${player.name} first.`,
      type: 'info',
    })
    return
  }

  const available =
    adminEligibleOpponentsFor(player)

  if (!available.length) {
    notificationStore.addToast({
      title: 'No opponent available',
      message:
        'There is no eligible player in this challenge window right now.',
      type: 'info',
    })
    return
  }

  managedPlayerId.value = ''
  selectedPlayerId.value = player.id
  selectedOpponentId.value = ''
  drawerResult.value = null
}

function actorName() {
  return (
    currentPlayer.value?.name ||
    adminStore.activeClubRoleLabel ||
    'Club admin'
  )
}

function refreshLadder() {
  ladderRevision.value += 1
}

function manualMove(player, targetRank) {
  if (
    !canManageLadder.value ||
    !player ||
    ladderActionBusy.value
  ) {
    return
  }

  ladderActionBusy.value = true

  try {
    const result = moveLadderPlayer({
      scope: ladderScope.value,
      roster: rawPlayers.value,
      playerId: player.id,
      targetRank,
      actorName: actorName(),
    })

    refreshLadder()

    if (!result.changed) {
      notificationStore.addToast({
        title: 'No change',
        message: result.message,
        type: 'info',
      })
      return
    }

    notificationStore.addToast({
      title: 'Position updated',
      message: `${player.name} moved from #${result.fromRank} to #${result.toRank}.`,
      type: 'success',
      sound: 'move',
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not move player',
      message:
        error?.message ||
        'Try that position again.',
      type: 'warning',
    })
  } finally {
    ladderActionBusy.value = false
  }
}

function moveUp(player) {
  manualMove(
    player,
    Math.max(1, Number(player.rank) - 1),
  )
}

function moveDown(player) {
  manualMove(
    player,
    Math.min(
      players.value.length,
      Number(player.rank) + 1,
    ),
  )
}

function openMoveTo(player) {
  managedPlayerId.value = player.id
  moveDialogOpen.value = true
}

function previewMoveTo(targetRank) {
  if (!managedPlayer.value) return null

  return previewManualLadderMove({
    scope: ladderScope.value,
    roster: rawPlayers.value,
    playerId: managedPlayer.value.id,
    targetRank,
  })
}

function confirmMoveTo(targetRank) {
  const player = managedPlayer.value
  if (!player) return

  manualMove(player, targetRank)
  moveDialogOpen.value = false
}

function toggleChallenges(player) {
  if (
    !canManageLadder.value ||
    !player ||
    ladderActionBusy.value
  ) {
    return
  }

  ladderActionBusy.value = true

  try {
    const paused = !player.challengePaused

    setLadderChallengePaused({
      scope: ladderScope.value,
      roster: rawPlayers.value,
      playerId: player.id,
      paused,
      actorName: actorName(),
    })

    if (
      paused &&
      selectedPlayerId.value === player.id
    ) {
      resetChallengeSelection()
    }

    refreshLadder()

    notificationStore.addToast({
      title: paused
        ? 'Challenges paused'
        : 'Challenges resumed',
      message: paused
        ? `${player.name} stays on the ladder, but cannot be challenged right now.`
        : `${player.name} can take part in challenges again.`,
      type: 'success',
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not update challenges',
      message:
        error?.message ||
        'Try again.',
      type: 'warning',
    })
  } finally {
    ladderActionBusy.value = false
  }
}

function openMissingMatch(player) {
  managedPlayerId.value = player.id
  missingMatchDialogOpen.value = true
}

function previewMissingMatch(input) {
  if (!managedPlayer.value) return null

  return previewMissingMatchMovement({
    scope: ladderScope.value,
    roster: rawPlayers.value,
    movementSystem:
      activeLadderConfig.value.movementSystem,
    matchType:
      activeLadder.value?.matchType ||
      activeLadderConfig.value.matchType ||
      'singles',
    ...input,
  })
}

function recordMissingMatch(input) {
  if (
    !managedPlayer.value ||
    ladderActionBusy.value
  ) {
    return
  }

  ladderActionBusy.value = true

  try {
    const result = recordMissingLadderMatch({
      scope: ladderScope.value,
      roster: rawPlayers.value,
      movementSystem:
        activeLadderConfig.value.movementSystem,
      matchType:
        activeLadder.value?.matchType ||
        activeLadderConfig.value.matchType ||
        'singles',
      actorName: actorName(),
      ...input,
    })

    refreshLadder()
    missingMatchDialogOpen.value = false

    notificationStore.addToast({
      title: 'Match recorded',
      message: result.movement?.moved
        ? `${result.match.score} saved. ${result.movement.message}`
        : `${result.match.score} saved.`,
      type: 'success',
      sound:
        result.movement?.moved
          ? 'move'
          : 'toast',
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not record match',
      message:
        error?.message ||
        'Check the result and try again.',
      type: 'warning',
    })
  } finally {
    ladderActionBusy.value = false
  }
}

function openRemove(player) {
  managedPlayerId.value = player.id
  removeDialogOpen.value = true
}

function confirmRemove() {
  const player = managedPlayer.value

  if (
    !player ||
    ladderActionBusy.value
  ) {
    return
  }

  ladderActionBusy.value = true

  try {
    removePlayerFromLadder({
      scope: ladderScope.value,
      roster: rawPlayers.value,
      playerId: player.id,
      actorName: actorName(),
    })

    if (
      selectedPlayerId.value === player.id ||
      selectedOpponentId.value === player.id
    ) {
      resetChallengeSelection()
    }

    removeDialogOpen.value = false
    managedPlayerId.value = ''
    refreshLadder()

    notificationStore.addToast({
      title: 'Removed from ladder',
      message: `${player.name} is no longer on ${activeLadder.value?.name || 'this ladder'}.`,
      type: 'success',
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not remove player',
      message:
        error?.message || 'Try again.',
      type: 'warning',
    })
  } finally {
    ladderActionBusy.value = false
  }
}

async function createAdminMatch(setup) {
  const result =
    await challengeStore.createAdminLadderMatch({
      ladderId: activeLadder.value.id,
      challengerPlayerId:
        selectedPlayer.value.id,
      opponentPlayerId:
        selectedOpponent.value.id,
      actorId: currentPlayer.value?.id || '',
      ...setup,
    })

  if (!result) return

  drawerResult.value = {
    ...result,
    timing: setup.timing,
  }

  notificationStore.addToast({
    title: 'Ladder match',
    message:
      setup.timing === 'scheduled'
        ? 'Ladder match scheduled.'
        : 'Ladder match ready.',
    type: 'success',
  })
}

async function viewMatch(result) {
  const matchId = result?.match?.id
  if (!matchId) return

  if (result.timing !== 'now') {
    router.push({
      name: 'MatchDetails',
      params: { matchId },
    })
    return
  }

  const started =
    await startOrResumeLadderMatch({
      match: result.match,
      actorId:
        currentPlayer.value?.id || '',
      clubId:
        adminStore.activeClubId || '',
      explicitStart: true,
    })

  if (!started.ok) {
    notificationStore.addToast({
      title: 'Match unavailable',
      message:
        started.message ||
        'The canonical live Match could not be started.',
      type: 'warning',
    })
    return
  }

  router.push({
    name: 'LiveMatch',
    params: { matchId: started.match.id },
  })
}

watch(
  ladders,
  (items) => {
    if (!items.length) {
      activeLadderId.value = ''
      return
    }

    if (
      !items.some(
        (ladder) =>
          ladder.id === activeLadderId.value,
      )
    ) {
      activeLadderId.value =
        items.find((ladder) => ladder.isMember)
          ?.id ||
        activeClub.value?.setup
          ?.primaryLadderId ||
        items[0].id
    }
  },
  { immediate: true },
)

watch(drawerOpen, (isOpen) => {
  if (isOpen) {
    shell?.beginAdminMatchDrawer?.()
  } else {
    shell?.endAdminMatchDrawer?.()
  }
})

watch(canAdminSetUpMatch, (canSetUp) => {
  if (
    canSetUp &&
    !challengeStore.challenges.length &&
    !challengeStore.isLoading
  ) {
    challengeStore.loadChallenges()
  }
})

onMounted(async () => {
  const tasks = []

  if (!playerStore.players.length) {
    tasks.push(playerStore.loadPlayers())
  }

  if (!adminStore.activeClub) {
    tasks.push(adminStore.loadClubs())
  }

  if (
    canAdminSetUpMatch.value &&
    !challengeStore.challenges.length
  ) {
    tasks.push(challengeStore.loadChallenges())
  }

  await Promise.allSettled(tasks)
})

onUnmounted(() =>
  shell?.endAdminMatchDrawer?.(),
)
</script>

<template>
  <section
    class="ladder-view"
    :class="{
      'ladder-view--drawer': drawerOpen,
      'ladder-view--selection': challengeSelectionActive,
    }"
  >
    <button
      v-if="challengeSelectionActive"
      class="challenge-selection-backdrop"
      type="button"
      tabindex="-1"
      aria-label="Cancel challenge selection"
      @click="resetChallengeSelection"
    ></button>
    <LadderClubRail
      :club="activeClub"
      :ladders="ladders"
      :active-ladder-id="activeLadder?.id || ''"
      @select="selectLadder"
    />

    <main class="ladder-workspace">
      <div
        v-if="playerStore.isLoading"
        class="ladder-loading"
        aria-label="Loading ladder"
      >
        <span
          v-for="index in 6"
          :key="index"
          class="skeleton-card skeleton-line"
        ></span>
      </div>

      <section
        v-else-if="playerStore.error"
        class="ladder-error"
        role="alert"
      >
        <div>
          <h2>We could not load the Ladder</h2>
          <p>{{ playerStore.error }}</p>
        </div>

        <button
          class="button-secondary"
          type="button"
          @click="playerStore.loadPlayers"
        >
          Try again
        </button>
      </section>

      <template v-else>
        <header class="ladder-heading">
          <div>
            <h1>
              {{ activeLadder?.name || 'Ladder' }}
            </h1>

            <p>
              {{ players.length }}
              {{
                players.length === 1
                  ? 'player'
                  : 'players'
              }}

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
              v-if="canManageLadder && activeLadder"
              class="compete-secondary"
              :to="{
                name: 'LadderSettings',
                params: {
                  ladderId: activeLadder.id,
                },
              }"
            >
              Settings
            </RouterLink>

            <RouterLink
              v-if="!canManageLadder"
              class="compete-primary"
              :to="{ name: 'CreateChallenge' }"
            >
              New challenge
            </RouterLink>
          </div>
        </header>

        <section
          v-if="challengeSelectionActive"
          class="mobile-selection-context"
          aria-live="polite"
        >
          <PersonAvatar
            :name="selectedPlayer.name"
            :image="selectedPlayer.imageUrl"
            :size="34"
          />

          <span>
            <strong>
              {{ selectedPlayer.name }} selected
            </strong>
            <small>Choose one of the available players.</small>
          </span>

          <button
            type="button"
            aria-label="Cancel challenge selection"
            title="Cancel challenge selection"
            @click.stop="resetChallengeSelection"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m6 6 8 8M14 6l-8 8" />
            </svg>
          </button>
        </section>

        <section
          v-if="challengeSelectionActive && players.length"
          class="selection-guide"
          @click.stop
        >
          <span>
            <strong>{{ guideTitle }}</strong>
            <small>Choose one of the available players.</small>
          </span>

          <button
            type="button"
            aria-label="Cancel challenge selection"
            title="Cancel challenge selection"
            @click.stop="resetChallengeSelection"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m6 6 8 8M14 6l-8 8" />
            </svg>
          </button>
        </section>

        <section
          v-if="players.length"
          class="ladder-list"
          aria-label="Club Ladder ranking"
        >
          <article
            v-for="player in players"
            :key="player.id"
            class="ladder-player-item"
          >
            <div
              class="ladder-row"
              :class="{
                'ladder-row--you':
                  isCurrentPlayer(player),
                'ladder-row--selected':
                  playerRowState(player).selected,
                'ladder-row--managed':
                  playerRowState(player).managed,
                'ladder-row--eligible':
                  playerRowState(player).eligible,
                'ladder-row--quiet':
                  playerRowState(player).quiet,
                'ladder-row--paused':
                  Boolean(player.challengePaused),
                'ladder-row--interactive':
                  canManageLadder,
              }"
              :role="
                canManageLadder
                  ? 'button'
                  : undefined
              "
              :tabindex="
                canManageLadder ? 0 : undefined
              "
              @click="handlePlayerRow(player)"
              @keydown="
                handlePlayerKeydown(
                  player,
                  $event,
                )
              "
            >
              <strong class="ladder-row__rank">
                #{{ player.rank }}
              </strong>

              <PersonAvatar
                :name="player.name"
                :image="player.imageUrl"
                :size="40"
              />

              <span class="ladder-row__player">
                <strong>{{ player.name }}</strong>

                <small
                  v-if="isCurrentPlayer(player)"
                >
                  You
                </small>

                <small
                  v-else-if="player.challengePaused"
                  class="ladder-row__paused"
                >
                  Paused
                </small>
              </span>

              <span class="ladder-row__metric">
                <template v-if="usesPoints">
                  {{ pointsFor(player) }} pts
                </template>

                <template v-else>
                  {{ matchesFor(player) }}
                  {{
                    matchesFor(player) === 1
                      ? 'match'
                      : 'matches'
                  }}
                </template>
              </span>

              <span
                v-if="canManageLadder"
                class="ladder-row__status"
              >
                <small
                  v-if="
                    playerRowState(player).selected
                  "
                  class="ladder-row__state ladder-row__state--selected"
                >
                  Challenger
                </small>

                <small
                  v-else-if="
                    playerRowState(player).eligible
                  "
                  class="ladder-row__state ladder-row__state--eligible"
                >
                  Can challenge
                </small>

                <small
                  v-else-if="selectedPlayer"
                  class="ladder-row__state ladder-row__state--quiet"
                >
                  Not eligible
                </small>

                <span
                  v-else
                  class="ladder-row__manage-state"
                >
                  <small
                    v-if="player.challengePaused"
                    class="ladder-row__paused-state"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M7.5 6.5v7M12.5 6.5v7" />
                    </svg>
                    Paused
                  </small>

                  <svg
                    class="ladder-row__chevron"
                    :class="{
                      'ladder-row__chevron--open':
                        playerRowState(player).managed,
                    }"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="m6 8 4 4 4-4" />
                  </svg>
                </span>
              </span>

              <button
                v-else-if="
                  canMemberChallenge(player)
                "
                class="button-primary ladder-row__action"
                type="button"
                :aria-label="`Challenge ${player.name}`"
                @click.stop="
                  openMemberChallenge(player)
                "
              >
                Challenge
              </button>
            </div>

            <LadderPlayerOptions
              v-if="
                canManageLadder &&
                managedPlayerId === player.id &&
                !selectedPlayer
              "
              :player="player"
              :position="Number(player.rank)"
              :player-count="players.length"
              :challenge-paused="
                Boolean(player.challengePaused)
              "
              :can-challenge="
                canSetUpChallengeFor(player)
              "
              @move-up="moveUp(player)"
              @move-down="moveDown(player)"
              @move-to="openMoveTo(player)"
              @record-missing-match="
                openMissingMatch(player)
              "
              @toggle-challenges="
                toggleChallenges(player)
              "
              @set-up-challenge="
                startAdminChallenge(player)
              "
              @remove="openRemove(player)"
            />
          </article>
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
      @done="resetChallengeSelection"
    />

    <MoveLadderPlayerDialog
      :open="moveDialogOpen"
      :player="managedPlayer"
      :roster="players"
      :preview="previewMoveTo"
      :busy="ladderActionBusy"
      @close="moveDialogOpen = false"
      @confirm="confirmMoveTo"
    />

    <RecordMissingMatchDialog
      :open="missingMatchDialogOpen"
      :anchor-player="managedPlayer"
      :roster="players"
      :match-type="
        activeLadder?.matchType ||
        activeLadderConfig.matchType ||
        'singles'
      "
      :movement-preview="previewMissingMatch"
      :busy="ladderActionBusy"
      @close="missingMatchDialogOpen = false"
      @record="recordMissingMatch"
    />

    <RemoveLadderPlayerDialog
      :open="removeDialogOpen"
      :player="managedPlayer"
      :ladder-name="
        activeLadder?.name || 'this ladder'
      "
      :busy="ladderActionBusy"
      @close="removeDialogOpen = false"
      @confirm="confirmRemove"
    />
  </section>
</template>

<style scoped>
.ladder-view {
  display: grid;
  min-width: 0;
  min-height: calc(
    100vh - var(--app-header-height)
  );
  grid-template-columns:
    236px minmax(0, 1fr) 0;
  background: var(--color-bg);
  transition:
    grid-template-columns
    var(--motion-medium)
    var(--motion-curve);
}

.ladder-view--drawer {
  grid-template-columns:
    236px minmax(0, 1fr) 390px;
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

.challenge-selection-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: rgba(8, 13, 10, 0.15);
  backdrop-filter: blur(1px);
  cursor: default;
}

.selection-guide {
  position: sticky;
  z-index: 74;
  top: calc(var(--app-header-height) + 10px);
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 11px 10px 13px;
  border: 1px solid rgba(22, 61, 43, 0.16);
  border-radius: var(--app-card-radius);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 10px 24px rgba(10, 28, 18, 0.08);
  backdrop-filter: blur(10px);
}

.selection-guide > span {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.selection-guide strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-guide small {
  overflow: hidden;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-guide > button {
  display: grid;
  width: 34px;
  height: 34px;
  min-width: 34px;
  min-height: 34px;
  place-items: center;
  padding: 0;
  border: 1px solid rgba(22, 61, 43, 0.12);
  border-radius: 9px;
  background: #f5f9f6;
  color: #163d2b;
}

.selection-guide > button:hover { background: #eef5f0; }

.selection-guide > button:focus-visible {
  outline: 2px solid rgba(22, 61, 43, 0.2);
  outline-offset: 2px;
}

.selection-guide > button svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.ladder-list {
  display: grid;
  gap: 9px;
}

.ladder-player-item {
  min-width: 0;
}

.ladder-row {
  display: grid;
  min-width: 0;
  min-height: 65px;
  grid-template-columns:
    38px 40px minmax(120px, 1fr)
    auto auto;
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

.ladder-row--managed {
  border-color:
    color-mix(
      in srgb,
      var(--color-primary) 20%,
      var(--color-border)
    );
  border-radius:
    var(--app-card-radius)
    var(--app-card-radius)
    0 0;
  background:
    color-mix(
      in srgb,
      var(--color-primary) 2%,
      white
    );
}

.ladder-row--selected {
  position: relative;
  z-index: 72;
  border-color: #163d2b;
  background: #163d2b;
  box-shadow:
    0 10px 24px rgba(7, 36, 22, 0.14),
    0 0 0 1px rgba(22, 61, 43, 0.12);
}

.ladder-row--selected .ladder-row__rank,
.ladder-row--selected .ladder-row__player strong,
.ladder-row--selected .ladder-row__metric {
  color: #f7fbf8;
}

.ladder-row--selected .ladder-row__player small {
  color: #b9ef78;
}

.ladder-row--selected .ladder-row__state--selected {
  background: rgba(185, 239, 120, 0.14);
  color: #b9ef78;
}

.ladder-row--selected .ladder-row__chevron {
  color: rgba(247, 251, 248, 0.78);
}

.ladder-row--eligible {
  position: relative;
  z-index: 72;
  border-color: rgba(22, 61, 43, 0.28);
  background: #fff;
  box-shadow: 0 0 0 1px rgba(22, 61, 43, 0.025);
}

.ladder-row--eligible:hover {
  border-color: rgba(22, 61, 43, 0.42);
  background: #fff;
}

.ladder-row--eligible .ladder-row__state--eligible {
  background: rgba(185, 239, 120, 0.18);
  color: #163d2b;
}

.ladder-row--eligible .ladder-row__rank {
  color:
    color-mix(
      in srgb,
      var(--color-primary-strong) 74%,
      var(--color-text-soft)
    );
}

.ladder-row--quiet {
  opacity: 0.1;
  filter: blur(1.15px) saturate(0.72);
  transform: scale(0.997);
  pointer-events: none;
  transition:
    opacity 140ms ease,
    filter 140ms ease,
    transform 140ms ease;
}

.ladder-row--paused:not(.ladder-row--selected) {
  border-color: rgba(177, 132, 54, 0.24);
  background: #fffaf1;
}

.ladder-row--paused:not(.ladder-row--selected)
  .ladder-row__player strong,
.ladder-row--paused:not(.ladder-row--selected)
  .ladder-row__rank {
  color: #79663e;
}

.ladder-row--you:not(
  .ladder-row--selected
):not(.ladder-row--eligible) {
  background:
    color-mix(
      in srgb,
      var(--color-primary) 4%,
      white
    );
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

.ladder-row__player .ladder-row__paused {
  color: #9b6b2c;
}

.ladder-row__metric {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.ladder-row__status {
  min-width: 92px;
  text-align: right;
}

.ladder-row__state {
  display: inline-flex;
  min-height: 29px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: var(--app-inner-radius);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
}

.ladder-row__state--selected {
  background:
    color-mix(
      in srgb,
      var(--color-primary) 14%,
      white
    );
  color: var(--color-primary-strong);
}

.ladder-row__state--eligible {
  background:
    color-mix(
      in srgb,
      var(--color-primary) 8%,
      white
    );
  color:
    color-mix(
      in srgb,
      var(--color-primary-strong) 78%,
      var(--color-muted)
    );
}

.ladder-row__state--quiet {
  background: var(--color-surface-soft);
  color: var(--color-muted);
}

.ladder-row__manage-state {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.ladder-row__paused-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8b6b32;
  font-size: 8.8px;
  font-weight: 650;
}

.ladder-row__paused-state svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.ladder-row__chevron {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--color-muted);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    transform var(--motion-short) var(--motion-curve),
    color var(--motion-short) ease;
}

.ladder-row__chevron--open {
  color: var(--color-primary-strong);
  transform: rotate(180deg);
}

.ladder-row__action {
  min-height: 36px;
  padding: 7px 11px;
  font-size: 11px;
}

.mobile-selection-context {
  display: none;
}

@media (max-width: 1180px) {
  .ladder-view--drawer {
    grid-template-columns:
      214px minmax(0, 1fr) 0;
  }

  .ladder-view :deep(.ladder-rail) {
    width: 214px;
  }

  .ladder-workspace {
    padding-inline: 22px;
  }
}

@media (max-width: 900px) {
  .ladder-row {
    grid-template-columns:
      34px 40px minmax(0, 1fr) auto;
  }

  .ladder-row__metric {
    display: none;
  }
}

@media (max-width: 767px) {
  .ladder-row,
  .ladder-row__player {
    min-width: 0;
  }

  .ladder-row__player strong {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ladder-row__status { min-width: 0; }

  .ladder-row__state {
    max-width: 100%;
    white-space: nowrap;
  }

  .selection-guide {
    display: none;
  }

  .mobile-selection-context {
    position: fixed;
    z-index: 74;
    top: var(--app-header-height);
    left: 50%;
    display: grid;
    width: 85vw;
    min-height: 56px;
    grid-template-columns:
      34px minmax(0, 1fr) 30px;
    align-items: center;
    gap: 9px;
    padding: 9px 10px;
    border: 1px solid
      color-mix(
        in srgb,
        var(--color-primary) 22%,
        var(--color-border)
      );
    border-radius: 0 0 12px 12px;
    background: rgba(250, 253, 250, 0.98);
    box-shadow: 0 8px 22px rgba(18, 49, 29, 0.08);
    transform: translateX(-50%);
    backdrop-filter: blur(10px);
  }

  .mobile-selection-context > span {
    display: grid;
    min-width: 0;
    gap: 2px;
  }

  .mobile-selection-context strong {
    overflow: hidden;
    color: var(--color-primary-strong);
    font-size: 10.5px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-selection-context small {
    overflow: hidden;
    color: var(--color-muted);
    font-size: 8.8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-selection-context > button {
    display: grid;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(22, 61, 43, 0.12);
    border-radius: 9px;
    background: #f5f9f6;
    color: #163d2b;
  }

  .mobile-selection-context > button:active {
    background: var(--color-surface-soft);
  }

  .mobile-selection-context > button svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
  }

  .ladder-view--selection .ladder-workspace {
    padding-top: 83px;
  }

  .ladder-view,
  .ladder-view--drawer {
    display: block;
    min-height: auto;
  }

  .ladder-workspace {
    width: 100%;
    margin-inline: 0;
    padding: 17px 0 30px;
  }

  .ladder-heading {
    align-items: flex-start;
  }

  .ladder-heading h1 {
    font-size: 21px;
  }

  .ladder-row {
    min-height: 62px;
    grid-template-columns:
      27px 36px minmax(0, 1fr) auto;
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

  .ladder-heading {
    display: grid;
  }

  .ladder-heading__actions {
    justify-content: flex-start;
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

