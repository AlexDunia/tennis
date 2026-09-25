<script setup>
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import EmptyState from '../../components/EmptyState.vue'
import FlowIcon from '../../components/friendly/FlowIcon.vue'
import LadderAddClubMembersView from '../LadderAddClubMembersView.vue'
import LadderShareInviteView from '../LadderShareInviteView.vue'
import LadderImportView from '../LadderImportView.vue'
import PersonAvatar from '../../components/PersonAvatar.vue'
import LadderClubRail from '../../components/ladder/LadderClubRail.vue'
import LadderBulkScheduler from '../../components/ladder/LadderBulkScheduler.vue'
import AdminLadderMatchDrawer from '../../components/ladder/AdminLadderMatchDrawer.vue'
import LadderPlayerOptions from '../../components/ladder/LadderPlayerOptions.vue'
import MoveLadderPlayerDialog from '../../components/ladder/MoveLadderPlayerDialog.vue'
import RecordMissingMatchDialog from '../../components/ladder/RecordMissingMatchDialog.vue'
import RemoveLadderPlayerDialog from '../../components/ladder/RemoveLadderPlayerDialog.vue'
import LadderPlayerAccessDialog from '../../components/ladder/LadderPlayerAccessDialog.vue'
import { useAdminStore } from '../../stores/admin'
import { useChallengeStore } from '../../stores/challenge'
import { useMatchStore } from '../../stores/match'
import { useNotificationStore } from '../../stores/notification'
import { usePlayerStore } from '../../stores/player'
import { useLadderMatchWorkspaceStore } from '../../stores/ladderMatchWorkspace.js'
import {
  getActiveLadderConfig,
  isEligibleLadderOpponent,
  ladderMatchConfig,
  resolveLadderConfigFromSetup,
} from '../../config/ladder'
import {
  evaluateLadderMatchup,
  getActiveLadderChallengesForPlayer,
  getEligibleLadderOpponents,
  getLadderPlayerAvailability,
} from '../../services/LadderAccessService'
import { ladderRosterFromSetup } from '../../domain/competitionScope.js'
import { buildAdminLadderMatchCommitPayload, createLadderMatchCommitRequestId } from '../../domain/ladderMatchCommit.js'
import {
  clearLadderAdminTestState,
  effectiveLadderRoster,
  moveLadderPlayer,
  previewManualLadderMove,
  previewMissingMatchMovement,
  recordMissingLadderMatch,
  removePlayerFromLadder,
  setLadderChallengePaused,
} from '../../services/LadderAdminService.js'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()
const challengeStore = useChallengeStore()
const matchStore = useMatchStore()
const notificationStore = useNotificationStore()
const playerStore = usePlayerStore()
const ladderMatchWorkspaceStore = useLadderMatchWorkspaceStore()
const shell = inject('gorraShell', null)

const activeLadderId = ref('')
const ladderSwitching = ref(false)
const matchSetupMenuOpen = ref(false)
const playerAccessOpen = ref(false)

const individualSearchOpen = ref(false)
const individualSearchQuery = ref('')

const individualDeleteSelectionMode =
  ref(false)

const individualDeletePlayerIds =
  ref([])

const managedPlayerId = ref('')
const selectedPlayerId = ref('')
const selectedOpponentId = ref('')
const drawerResult = ref(null)
const individualCommitRequestId = ref('')
function newIndividualCommitRequestId() {
  individualCommitRequestId.value =
    createLadderMatchCommitRequestId({
      creationMode: 'individual',
    })

  return individualCommitRequestId.value
}

function ensureIndividualCommitRequestId() {
  if (!individualCommitRequestId.value) {
    return newIndividualCommitRequestId()
  }

  return individualCommitRequestId.value
}
const moveDialogOpen = ref(false)
const missingMatchDialogOpen = ref(false)
const removeDialogOpen = ref(false)
const pendingRemovalIds = ref([])
const dragChallengePlayerId = ref('')
const draggingChallengePlayerId = ref('')
const dragGhost = ref(null)
const dragDropTargetId = ref('')
const dragActionOpen = ref(false)
let pendingDrag = null
const ladderActionBusy = ref(false)
const clearTestBusy = ref(false)
const populateTestBusy = ref(false)
const populateTestConfirmOpen = ref(false)
const showDevTestControls =
  Boolean(import.meta.env?.DEV)
const ladderRevision = ref(0)

const ladderListRef = ref(null)
const addPeopleOptionsRef = ref(null)
const addPeopleFlows = ref({})

const playerRowRefs = new Map()

const challengeOriginScrollY = ref(0)

const challengeOriginListScrollTop = ref(0)

const currentPlayer = computed(() => playerStore.currentPlayer)
const basePlayers = computed(() => playerStore.sortedLadder)
const activeClub = computed(() => adminStore.activeClub)

const configuredLadders = computed(() => {
  if (!activeClub.value) return []
  return adminStore.activeLadders
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
  if (!ladder?.id) return []
  if (Array.isArray(ladder.entries)) return ladderRosterFromSetup({ setup: activeClub.value?.setup || {}, ladderId: ladder.id }).roster
  const hasExplicitMembership = Array.isArray(ladder?.playerIds) || Array.isArray(ladder?.memberIds) || basePlayers.value.some((player) => Array.isArray(player.ladderIds))
  if (!hasExplicitMembership) { const demoRosterLimit = ladder?.id === 'open-singles' ? 20 : 10; return basePlayers.value.slice(0, demoRosterLimit).map((player) => ({ ...player, ladderId: ladder.id })) }
  return basePlayers.value.filter((player) => ladderHasPlayer(ladder, player)).map((player) => ({ ...player, ladderId: ladder.id }))
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

const activeAddPeopleFlow = computed(() =>
  addPeopleFlows.value[activeLadder.value?.id] || { open: false, step: '' },
)
const addPeopleOpen = computed(() => activeAddPeopleFlow.value.open)
const addPeopleStep = computed(() => activeAddPeopleFlow.value.step)

function updateActiveAddPeopleFlow(patch) {
  const ladderId = activeLadder.value?.id
  if (!ladderId) return

  const nextFlow = {
    ...(addPeopleFlows.value[ladderId] || { open: false, step: '' }),
    ...patch,
  }
  addPeopleFlows.value = {
    ...addPeopleFlows.value,
    [ladderId]: nextFlow,
  }

  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    url.searchParams.set('ladder', ladderId)
    if (nextFlow.open) {
      url.searchParams.set('flow', 'add-people')
      if (nextFlow.step) url.searchParams.set('step', nextFlow.step)
      else url.searchParams.delete('step')
    } else {
      url.searchParams.delete('flow')
      url.searchParams.delete('step')
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
}

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
const individualWorkspaceDraft = computed(() => {
  const { clubId, ladderId } = ladderScope.value

  if (!clubId || !ladderId) {
    return { selectedPlayerId: '' }
  }

  return ladderMatchWorkspaceStore.getIndividualDraft(
    clubId,
    ladderId,
  )
})

const bulkWorkspaceDrafts = computed(() => {
  const { clubId, ladderId } = ladderScope.value

  if (!clubId || !ladderId) {
    return []
  }

  return ladderMatchWorkspaceStore.getBulkDrafts(
    clubId,
    ladderId,
  )
})

const ladderWorkspaceReservations = computed(() => ({
  bulkDrafts: bulkWorkspaceDrafts.value,
  individualSelectedPlayerId:
    individualWorkspaceDraft.value.selectedPlayerId,
}))

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
const ladderMode = computed(() => !canManageLadder.value ? 'individual' : (ladderMatchWorkspaceStore.mode === 'bulk' ? 'bulk' : 'individual'))
const bulkModeActive = computed(() => canManageLadder.value && ladderMode.value === 'bulk')

const canAdminSetUpMatch = computed(
  () =>
    canManageLadder.value &&
    adminStore.hasActiveClubPermission(
      'challenges.create',
    ),
)

const canManageLiveMatch = computed(
  () =>
    canManageLadder.value &&
    adminStore.hasActiveClubPermission(
      'matches.live_score',
    ),
)
function matchWorkspaceScope(ladderId = activeLadderId.value) { return { clubId: String(adminStore.activeClubId || '').trim(), ladderId: String(ladderId || '').trim() } }
function rememberIndividualSelection(playerId) { const scope = matchWorkspaceScope(); if (scope.clubId && scope.ladderId) ladderMatchWorkspaceStore.setIndividualSelectedPlayer({ ...scope, playerId }) }
function clearRememberedIndividualSelection() { const scope = matchWorkspaceScope(); if (scope.clubId && scope.ladderId) ladderMatchWorkspaceStore.clearIndividualDraft(scope.clubId, scope.ladderId) }
function restoreIndividualSelection() { if (bulkModeActive.value || !canAdminSetUpMatch.value) return; const scope = matchWorkspaceScope(); if (!scope.clubId || !scope.ladderId || !players.value.length) return; const draft = ladderMatchWorkspaceStore.getIndividualDraft(scope.clubId, scope.ladderId); const player = players.value.find((item) => item.id === draft.selectedPlayerId); if (!player) { if (draft.selectedPlayerId) ladderMatchWorkspaceStore.clearIndividualDraft(scope.clubId, scope.ladderId); return }; managedPlayerId.value = ''; selectedPlayerId.value = player.id; selectedOpponentId.value = ''; drawerResult.value = null }

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
    clubId: ladderScope.value.clubId,
    ladderId: ladderScope.value.ladderId,
    workspace: ladderWorkspaceReservations.value,
    challengerIgnoreWorkspaceKinds: ['individual'],
    opponentIgnoreWorkspaceKinds: ['individual'],
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
    !bulkModeActive.value && Boolean(
      selectedPlayer.value &&
      selectedOpponent.value,
    ),
)

const challengeSelectionActive = computed(
  () =>
    !bulkModeActive.value && Boolean(
      canAdminSetUpMatch.value &&
      selectedPlayer.value &&
      !selectedOpponent.value,
    ),
)

const challengeFocusPlayers = computed(() => {
  if (!selectedPlayer.value) return []

  return players.value.filter(
    (player) =>
      player.id === selectedPlayer.value.id ||
      eligiblePlayerIds.value.has(player.id),
  )
})

const challengeFocusActive = computed(() =>
  challengeSelectionActive.value || drawerOpen.value,
)

const displayPlayers = computed(() => {
  const source = challengeFocusActive.value
    ? challengeFocusPlayers.value
    : players.value
  const query = individualSearchQuery.value.trim().toLocaleLowerCase()
  return query
    ? source.filter((player) => String(player.name || '').toLocaleLowerCase().includes(query))
    : source
})

let challengeScrollFrame = 0

function pinLeavingPlayer(element) {
  element.style.top = `${element.offsetTop}px`
}

function clearLeavingPlayer(element) {
  element.style.removeProperty('top')
}



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

function availabilityFor(player) {
  return getLadderPlayerAvailability({
    player,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
    clubId: ladderScope.value.clubId,
    ladderId: ladderScope.value.ladderId,
    workspace: ladderWorkspaceReservations.value,
    ignoreWorkspaceKinds: ['individual'],
  })
}

function canMemberChallenge(player) {
  const currentAvailability = getLadderPlayerAvailability({
    player: currentLadderPlayer.value,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
  })

  const opponentAvailability = availabilityFor(player)

  return (
    !canManageLadder.value &&
    adminStore.hasActiveClubPermission('challenges.create') &&
    currentAvailability.available &&
    opponentAvailability.available &&
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
    clubId: ladderScope.value.clubId,
    ladderId: ladderScope.value.ladderId,
    workspace: ladderWorkspaceReservations.value,
    challengerIgnoreWorkspaceKinds: ['individual'],
    opponentIgnoreWorkspaceKinds: ['individual'],
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

function setPlayerRowRef(playerId, element) {
  if (!playerId) return

  if (element) {
    playerRowRefs.set(playerId, element)
    return
  }

  playerRowRefs.delete(playerId)
}

function prefersReducedMotion() {
  return Boolean(
    typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches,
  )
}

function challengeViewportInsets() {
  if (typeof document === 'undefined') {
    return {
      top: 88,
      bottom: 16,
    }
  }

  const header =
    document.querySelector('.app-header')

  const bottomNav =
    document.querySelector('.bottom-nav')

  return {
    top:
      Math.ceil(
        header?.getBoundingClientRect()
          ?.height || 76,
      ) + 10,
    bottom:
      Math.ceil(
        bottomNav?.getBoundingClientRect()
          ?.height || 0,
      ) + 12,
  }
}

function animateChallengePageTo(targetY) {
  if (typeof window === 'undefined') return

  if (challengeScrollFrame) {
    window.cancelAnimationFrame(
      challengeScrollFrame,
    )
    challengeScrollFrame = 0
  }

  const safeTarget = Math.max(
    0,
    Number(targetY) || 0,
  )

  if (prefersReducedMotion()) {
    window.scrollTo({ top: safeTarget, left: 0, behavior: 'instant' })
    return
  }

  const startY = window.scrollY
  const delta = safeTarget - startY

  if (Math.abs(delta) < 2) return

  const duration = 340
  const started = performance.now()

  const step = (now) => {
    const progress = Math.min(
      1,
      (now - started) / duration,
    )

    const eased =
      1 - Math.pow(1 - progress, 4)

    window.scrollTo({
      top: startY + delta * eased,
      left: 0,
      behavior: 'instant',
    })

    if (progress < 1) {
      challengeScrollFrame =
        window.requestAnimationFrame(step)
      return
    }

    challengeScrollFrame = 0
  }

  challengeScrollFrame =
    window.requestAnimationFrame(step)
}

async function focusChallengeViewport() {
  if (
    !challengeFocusActive.value ||
    typeof window === 'undefined'
  ) {
    return
  }

  /*
   * Let TransitionGroup first produce the compact relevant
   * stack. We then move that real stack, not the old full list.
   */
  await nextTick()

  const list = ladderListRef.value

  if (!list || !challengeFocusActive.value) return

  const { top, bottom } =
    challengeViewportInsets()

  const availableHeight = Math.max(
    220,
    window.innerHeight - top - bottom,
  )

  list.style.setProperty(
    '--challenge-window-max-height',
    `${availableHeight}px`,
  )

  /*
   * Start the focused list at its first relevant player.
   * Larger ranges remain scrollable inside this list.
   */
  list.scrollTop = 0

  const targetY = Math.max(
    0,
    window.scrollY +
      list.getBoundingClientRect().top -
      top,
  )

  animateChallengePageTo(targetY)

  list.focus({
    preventScroll: true,
  })
}

watch(
  challengeFocusActive,
  (active) => {
    if (!active) return

    void focusChallengeViewport()
  },
  {
    flush: 'post',
  },
)

function handleChallengeListClick(event) {
  if (
    !challengeSelectionActive.value ||
    typeof Element === 'undefined'
  ) {
    return
  }

  const target = event.target

  if (!(target instanceof Element)) {
    return
  }

  /*
   * Selected and eligible rows own their normal click behavior.
   * Anything else inside the focused Ladder area acts as
   * click-away and restores the player's options.
   */
  if (
    target.closest(
      '.ladder-row--selected, .ladder-row--eligible',
    )
  ) {
    return
  }

  void cancelChallengeSelection()
}

function startDragChallenge(player) {
  startAdminChallenge(player)
  dragChallengePlayerId.value =
    selectedPlayerId.value === player?.id
      ? player.id
      : ''
  draggingChallengePlayerId.value = dragChallengePlayerId.value
}

function startHandDrag(player, event) {
  if (event.button !== 0) return
  pendingDrag = { player, originX: event.clientX, originY: event.clientY, active: false }
  window.addEventListener('pointermove', moveHandDrag)
  window.addEventListener('pointerup', endHandDrag, { once: true })
}
function moveHandDrag(event) {
  if (!pendingDrag) return
  if (!pendingDrag.active) {
    if (Math.hypot(event.clientX - pendingDrag.originX, event.clientY - pendingDrag.originY) < 7) return
    startDragChallenge(pendingDrag.player)
    if (selectedPlayerId.value !== pendingDrag.player.id) { clearHandDrag(); return }
    pendingDrag.active = true
    draggingChallengePlayerId.value = pendingDrag.player.id
    const bounds = document.querySelector('.ladder-row--selected')?.getBoundingClientRect()
    dragGhost.value = { player: pendingDrag.player, x: bounds ? bounds.left + bounds.width / 2 : event.clientX, y: event.clientY, width: bounds?.width || 440 }
  }
  dragGhost.value = { ...dragGhost.value, player: pendingDrag.player, y: event.clientY }
}
function endHandDrag(event) {
  if (!pendingDrag?.active) { clearHandDrag(); return }
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-ladder-player-id]')
  const targetId = target?.getAttribute('data-ladder-player-id') || ''
  if (eligiblePlayerIds.value.has(targetId)) { dragDropTargetId.value = targetId; dragActionOpen.value = true } else { resetChallengeSelection() }
  clearHandDrag()
}
function clearHandDrag() {
  pendingDrag = null
  dragGhost.value = null
  draggingChallengePlayerId.value = ''
  window.removeEventListener('pointermove', moveHandDrag)
}
function beginChallengeDrag(player, event) {
  if (!challengeSelectionActive.value || player.id !== dragChallengePlayerId.value) {
    event.preventDefault()
    return
  }
event.dataTransfer?.setData('text/plain', player.id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    const row = event.currentTarget?.closest('.ladder-row')
    if (row) event.dataTransfer.setDragImage(row, Math.min(row.clientWidth / 2, 140), 28)
  }
}

function allowChallengeDrop(player, event) {
  if (!challengeSelectionActive.value || !eligiblePlayerIds.value.has(player.id)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function completeChallengeDrop(player, event) {
  if (!challengeSelectionActive.value || !eligiblePlayerIds.value.has(player.id)) return
  event.preventDefault()
  selectedOpponentId.value = player.id
  newIndividualCommitRequestId()
  drawerResult.value = null
  dragChallengePlayerId.value = ''
  draggingChallengePlayerId.value = ''
}
const individualDeleteCount = computed(() => individualDeletePlayerIds.value.length)
const allVisibleIndividualPlayersSelected = computed(() => displayPlayers.value.length > 0 && displayPlayers.value.every((player) => individualDeletePlayerIds.value.includes(player.id)))

function beginIndividualDeletion() {
  resetChallengeSelection()
  managedPlayerId.value = ''
  moveDialogOpen.value = false
  missingMatchDialogOpen.value = false
  individualDeletePlayerIds.value = []
  individualDeleteSelectionMode.value = true
}

function toggleIndividualDeletePlayer(playerId) {
  const selected = new Set(individualDeletePlayerIds.value)
  if (selected.has(playerId)) selected.delete(playerId)
  else selected.add(playerId)
  individualDeletePlayerIds.value = [...selected]
}

function exitIndividualDeletion() {
  individualDeleteSelectionMode.value = false
  individualDeletePlayerIds.value = []
}

function requestIndividualDeletion() {
  if (!individualDeletePlayerIds.value.length) return
  openBulkRemove(individualDeletePlayerIds.value)
  exitIndividualDeletion()
}
function handlePlayerRow(player) {
  if (!canManageLadder.value || isPlayingLive(player)) return

  if (individualDeleteSelectionMode.value) {
    toggleIndividualDeletePlayer(player.id)
    return
  }

  if (selectedPlayer.value) {
    if (
      player.id === selectedPlayer.value.id
    ) {
      cancelChallengeSelection()
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
    newIndividualCommitRequestId()
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
    query: { ladder: activeLadder.value?.id || '', opponent: player.id },
  })
}

function setLadderMode(mode) {
  if (!canManageLadder.value) return
  const next = mode === 'bulk' ? 'bulk' : 'individual'
  if (next === ladderMode.value) return
  if (next === 'bulk') { selectedOpponentId.value = ''; drawerResult.value = null; managedPlayerId.value = ''; moveDialogOpen.value = false; missingMatchDialogOpen.value = false; removeDialogOpen.value = false; individualDeleteSelectionMode.value = false; individualDeletePlayerIds.value = [] }
  ladderMatchWorkspaceStore.setMode(next)
  if (next === 'individual') void nextTick(restoreIndividualSelection)
}


function selectLadder(ladderId) {
  if (!ladderId || ladderId === activeLadderId.value) return

  // Keep selection local. Direct links can still set the initial ladder via
  // ?ladder=, but an ordinary rail click should not feel like navigation.
  ladderSwitching.value = true
  resetAllPlayerActions({ preserveWorkspaceDraft: true })
  activeLadderId.value = ladderId
  if (ladderMode.value === 'individual') void nextTick(restoreIndividualSelection)

  window.setTimeout(() => {
    ladderSwitching.value = false
  }, 180)
}

function closeDrawer() {
  selectedOpponentId.value = ''
  individualCommitRequestId.value = ''
  drawerResult.value = null
}

function resetChallengeSelection({ preserveWorkspaceDraft = false } = {}) {
  dragChallengePlayerId.value = ''
  selectedPlayerId.value = ''
  selectedOpponentId.value = ''
  drawerResult.value = null
  if (!preserveWorkspaceDraft) { clearRememberedIndividualSelection(); individualCommitRequestId.value = '' }
}

async function cancelChallengeSelection() {
  const playerId =
    selectedPlayerId.value

  selectedPlayerId.value = ''
  selectedOpponentId.value = ''
  drawerResult.value = null
  clearRememberedIndividualSelection()
  individualCommitRequestId.value = ''

  if (playerId) {
    managedPlayerId.value = playerId
  }

  await nextTick()

  const list = ladderListRef.value

  if (list) {
    list.style.removeProperty(
      '--challenge-window-max-height',
    )

    list.scrollTop =
      challengeOriginListScrollTop.value
  }

  if (
    typeof window !== 'undefined'
  ) {
    animateChallengePageTo(
      challengeOriginScrollY.value,
    )
  }
}

function resetAllPlayerActions({ preserveWorkspaceDraft = false } = {}) {
  managedPlayerId.value = ''
  moveDialogOpen.value = false
  missingMatchDialogOpen.value = false
  removeDialogOpen.value = false
  resetChallengeSelection({ preserveWorkspaceDraft })
}

function requestPopulateTestPlayers() {
  if (
    !showDevTestControls ||
    !canManageLadder.value ||
    populateTestBusy.value
  ) {
    return
  }

  populateTestConfirmOpen.value = true
}

async function populateTestPlayers() {
  if (
    !showDevTestControls ||
    !canManageLadder.value ||
    populateTestBusy.value
  ) {
    return
  }

  populateTestBusy.value = true

  try {
    resetAllPlayerActions()
    clearLadderAdminTestState({ clubId: adminStore.activeClubId })

    const result = await adminStore.populateTestPlayers()
    const firstPopulatedLadderId = result?.ladders?.[0]?.id || ''

    if (firstPopulatedLadderId) {
      activeLadderId.value = firstPopulatedLadderId
    }

    ladderRevision.value += 1
    populateTestConfirmOpen.value = false

    notificationStore.addToast({
      title: 'Test players added',
      message: '10 players are ready on each active Ladder.',
      type: 'success',
    })
  } catch (populateError) {
    notificationStore.addToast({
      title:
        populateError?.code === 'NO_ACTIVE_LADDER'
          ? 'No active Ladder to populate.'
          : 'Could not populate test players',
      message: populateError?.message || 'Try again.',
      type: 'warning',
    })
  } finally {
    populateTestBusy.value = false
  }
}
async function clearTestData() {
  if (
    !showDevTestControls ||
    clearTestBusy.value
  ) {
    return
  }

  clearTestBusy.value = true

  try {
    resetAllPlayerActions()

    clearLadderAdminTestState({
      clubId:
        adminStore.activeClubId,
    })

    await adminStore
      .clearActiveClubTestData()

    playerStore.clearPlayersForTest()

    activeLadderId.value = ''

    ladderRevision.value += 1

    notificationStore.addToast({
      title: 'Test data cleared',
      message:
        'Members and ladders are back to an empty test state.',
      type: 'success',
    })
  } catch (clearError) {
    notificationStore.addToast({
      title:
        'Could not clear test data',
      message:
        clearError?.message ||
        'Try again.',
      type: 'warning',
    })
  } finally {
    clearTestBusy.value = false
  }
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

  if (typeof window !== 'undefined') {
    challengeOriginScrollY.value =
      window.scrollY
  }

  challengeOriginListScrollTop.value =
    ladderListRef.value?.scrollTop || 0

  managedPlayerId.value = ''
  selectedPlayerId.value = player.id
  selectedOpponentId.value = ''
  drawerResult.value = null
  rememberIndividualSelection(player.id)
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
  pendingRemovalIds.value = [player.id]
  managedPlayerId.value = player.id
  removeDialogOpen.value = true
}

function openBulkRemove(playerIds) {
  const ids = [...new Set(playerIds || [])].filter(Boolean)
  if (!ids.length) return
  pendingRemovalIds.value = ids
  managedPlayerId.value = ids[0]
  removeDialogOpen.value = true
}

function confirmRemove() {
  const playerIds = pendingRemovalIds.value.length
    ? pendingRemovalIds.value
    : [managedPlayerId.value]
  const removablePlayers = players.value.filter((player) => playerIds.includes(player.id))

  if (!removablePlayers.length || ladderActionBusy.value) return

  ladderActionBusy.value = true

  try {
    for (const player of removablePlayers) {
      removePlayerFromLadder({
        scope: ladderScope.value,
        roster: rawPlayers.value,
        playerId: player.id,
        actorName: actorName(),
      })
    }

    if (playerIds.includes(selectedPlayerId.value) || playerIds.includes(selectedOpponentId.value)) {
      resetChallengeSelection()
    }

    removeDialogOpen.value = false
    managedPlayerId.value = ''
    pendingRemovalIds.value = []
    refreshLadder()

    notificationStore.addToast({
      title: removablePlayers.length === 1 ? 'Removed from ladder' : 'Players removed from ladder',
      message: removablePlayers.length === 1
        ? `${removablePlayers[0].name} is no longer on ${activeLadder.value?.name || 'this ladder'}. Add them again to restore access.`
        : `${removablePlayers.length} players are no longer on ${activeLadder.value?.name || 'this ladder'}. Add them again to restore access.`,
      type: 'success',
      duration: 9000,
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not remove player',
      message: error?.message || 'Try again.',
      type: 'warning',
      duration: 9000,
    })
  } finally {
    ladderActionBusy.value = false
  }
}

async function createAdminMatch(setup) {
  if (
    !activeLadder.value ||
    !selectedPlayer.value ||
    !selectedOpponent.value ||
    !ladderScope.value.clubId ||
    !ladderScope.value.ladderId
  ) {
    return
  }

  const decision = evaluateLadderMatchup({
    challenger: selectedPlayer.value,
    opponent: selectedOpponent.value,
    players: players.value,
    challenges: challengeStore.challenges,
    config: activeLadderConfig.value,
    clubId: ladderScope.value.clubId,
    ladderId: ladderScope.value.ladderId,
    workspace: ladderWorkspaceReservations.value,
    challengerIgnoreWorkspaceKinds: ['individual'],
    opponentIgnoreWorkspaceKinds: ['individual'],
  })

  if (!decision.allowed) {
    notificationStore.addToast({
      title: 'Match unavailable',
      message:
        decision.message ||
        'One of these players is not available for this Ladder match.',
      type: 'warning',
    })

    return
  }

  let payload

  try {
    payload = buildAdminLadderMatchCommitPayload({
      clubId: ladderScope.value.clubId,
      ladderId: ladderScope.value.ladderId,
      challengerPlayerId: selectedPlayer.value.id,
      opponentPlayerId: selectedOpponent.value.id,
      actorId: currentPlayer.value?.id || '',
      timing: setup.timing,
      scheduledAt: setup.scheduledAt,
      courtId: setup.courtId,
      matchRuleSource: setup.matchRuleSource,
      rulesSnapshot: setup.rulesSnapshot,
      creationMode: 'individual',
      clientRequestId: ensureIndividualCommitRequestId(),
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not create match',
      message:
        error?.message ||
        'Check the match details and try again.',
      type: 'warning',
    })

    return
  }

  const result =
    await challengeStore.createAdminLadderMatch(payload)

  if (!result) {
    notificationStore.addToast({
      title: 'Could not create match',
      message:
        challengeStore.error ||
        'Unable to create this Ladder match.',
      type: 'warning',
    })

    return
  }

  drawerResult.value = {
    ...result,
    timing: setup.timing,
  }

  notificationStore.addToast({
    title: 'Ladder match',
    message:
      setup.timing === 'scheduled'
        ? 'Ladder match scheduled.'
        : 'Ladder match ready to play.',
    type: 'success',
  })
}

async function viewMatch(result) {
  const matchId = result?.match?.id
  if (!matchId) return
  router.push({ name: 'MatchDetails', params: { matchId } })
}
function liveChallengeFor(player) {
  return getActiveLadderChallengesForPlayer({
    playerId: player?.id,
    challenges: challengeStore.challenges,
    clubId: ladderScope.value.clubId,
    ladderId: ladderScope.value.ladderId,
  }).find((challenge) => challenge.status === 'live') || null
}

function isPlayingLive(player) {
  return availabilityFor(player).reason === 'live'
}

function liveMatchFor(player) {
  const challenge = liveChallengeFor(player)

  if (!challenge?.id) return null

  return matchStore.matches.find(
    (match) => String(match?.challengeId || '') === String(challenge.id),
  ) || null
}

async function openLiveMatchControl(player) {
  if (!canManageLiveMatch.value) return

  let match = liveMatchFor(player)

  if (!match && !matchStore.isLoading) {
    await matchStore.loadMatches()
    match = liveMatchFor(player)
  }

  if (!match?.id) {
    notificationStore.addToast({
      title: 'Live match unavailable',
      message: 'The live match could not be opened. Try again.',
      type: 'warning',
    })
    return
  }

  router.push({
    name: 'LiveOperationDetail',
    params: { matchId: match.id },
  })
}

watch(
  [ladders, () => route.query.ladder],
  ([items, requestedLadderId]) => {
    if (!items.length) {
      activeLadderId.value = ''
      return
    }

    if (items.some((ladder) => ladder.id === requestedLadderId)) {
      activeLadderId.value = requestedLadderId
      if (route.query.flow === 'add-people') {
        addPeopleFlows.value = {
          ...addPeopleFlows.value,
          [requestedLadderId]: {
            open: true,
            step: ['members', 'invite', 'import'].includes(String(route.query.step || ''))
              ? String(route.query.step)
              : '',
          },
        }
      }
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

watch(
  [() => adminStore.activeClubId, activeLadderId],
  ([clubId, ladderId], [previousClubId, previousLadderId]) => {
    if (!clubId || !ladderId) return
    if (clubId !== previousClubId || ladderId !== previousLadderId) resetAllPlayerActions({ preserveWorkspaceDraft: true })
    if (ladderMode.value === 'individual') void nextTick(restoreIndividualSelection)
  },
  { flush: 'post' },
)
watch(
  [() => players.value.map((player) => player.id).join('|'), ladderMode],
  () => { if (ladderMode.value === 'individual' && !selectedPlayerId.value) void nextTick(restoreIndividualSelection) },
  { flush: 'post' },
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
  const requestedMode = String(route.query.mode || '').toLowerCase()
  if (requestedMode === 'bulk' || requestedMode === 'individual') setLadderMode(requestedMode)
  else if (ladderMode.value === 'individual') restoreIndividualSelection()
})

onUnmounted(() => {
  if (
    challengeScrollFrame &&
    typeof window !== 'undefined'
  ) {
    window.cancelAnimationFrame(
      challengeScrollFrame,
    )
  }

  challengeScrollFrame = 0
  shell?.endAdminMatchDrawer?.()
})
function createLadder() {
  router.push({ name: 'LadderCreate' })
}

function importLadder() {
  const ladderId = activeLadder.value?.id
  if (!ladderId) return

  router.push({
    name: 'LadderImport',
    params: {
      ladderId,
    },
    query: {
      from: 'ladder',
    },
  })
}

function scrollToAddPeople(step = false) {
  const flow = addPeopleOptionsRef.value
  if (!flow) return

  if (!step) {
    flow.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  const detail = flow.querySelector('.ladder-add-people__step')
  flow.scrollTo({
    top: Math.max(0, (detail?.offsetTop || 0) - 18),
    behavior: 'smooth',
  })
}

function revealAddPeopleOptions() {
  updateActiveAddPeopleFlow({ open: true, step: '' })
  nextTick(() => scrollToAddPeople())
}

function openAddPeopleStep(step) {
  updateActiveAddPeopleFlow({ open: true, step })
  nextTick(() => window.setTimeout(() => scrollToAddPeople(true), 40))
}

function openClubMemberPicker() {
  openAddPeopleStep('members')
}

function openLadderInvite() {
  openAddPeopleStep('invite')
}

function continueLadderSetup(ladder = activeLadder.value) {
  if (!ladder?.id) return

  const step = ['members', 'order', 'start'].includes(ladder.setupStep)
    ? ladder.setupStep
    : 'members'

  router.push({
    name: 'LadderSetup',
    params: {
      ladderId: ladder.id,
      step,
    },
  })
}

</script>

<template>
  <section
    class="ladder-view"
    :class="{
      'ladder-view--drawer': drawerOpen,
      'ladder-view--selection':
        challengeFocusActive,
      'ladder-view--switching': ladderSwitching,
    }"
  >
    <Transition name="challenge-backdrop">
      <button
        v-if="challengeSelectionActive"
        class="challenge-selection-backdrop"
        type="button"
        tabindex="-1"
        aria-label="Cancel challenge selection"
        @click="cancelChallengeSelection"
        @wheel.prevent
        @touchmove.prevent
      ></button>
    </Transition>
    <LadderClubRail
      :club="activeClub"
      :ladders="ladders"
      :active-ladder-id="activeLadder?.id || ''"
      :can-manage="canManageLadder"
      :mode="ladderMode"
      @select="selectLadder"
      @create="createLadder"
      @import="importLadder"
      @mode="setLadderMode"
    />

    <section
      v-if="activeLadder?.status === 'setup' && players.length"
      class="ladder-setup-gate"
    >
      <div>
        <span>Setup not finished</span>
        <h2>{{ activeLadder.name }}</h2>
        <p>
          Add members, set the starting order, then start the ladder.
        </p>
      </div>

      <button
        v-if="canManageLadder"
        type="button"
        class="button-primary"
        @click="continueLadderSetup(activeLadder)"
      >
        Continue setup
      </button>
    </section>

    <section
      v-else-if="!activeLadder"
      class="ladder-zero"
    >
      <EmptyState
        illustration="ladder"
        title="No ladders yet"
        :description="
          canManageLadder
            ? 'Create your first club ladder. You can add or import players in the next step.'
            : 'Your club has not started a ladder yet.'
        "
        :primary-action-label="canManageLadder ? 'Create ladder' : ''"
        @primary-action="createLadder"
      />
    </section>

    <section
      v-else-if="activeLadder && !players.length"
      class="ladder-empty-workspace"
    >
      <EmptyState
        illustration="ladder"
        title="This ladder is waiting for players"
        description="Add the first members to turn this ladder into a live playing order. Choose club members, share an invite, or bring in a list your club already uses."
      >
        <template v-if="canManageLadder" #actions>
          <button type="button" class="button-primary" @click="revealAddPeopleOptions">
            Add people
          </button>
        </template>
      </EmptyState>
    </section>

    <Transition name="ladder-add-options">
      <section
        v-if="activeLadder && addPeopleOpen"
        ref="addPeopleOptionsRef"
        class="ladder-add-people"
        aria-label="Add people to this ladder"
      >
        <div class="ladder-add-people__heading">
          <span>Next step</span>
          <h2>Add people to {{ activeLadder.name }}</h2>
          <p>Choose how you want to bring the first players into this ladder.</p>
        </div>

        <div class="ladder-add-people__choices">
          <button type="button" @click="openClubMemberPicker">
            <span class="ladder-add-people__icon"><FlowIcon name="users" /></span>
            <span><strong>Choose club members</strong><small>Pick eligible people already in your club.</small></span>
            <FlowIcon name="arrow-right" />
          </button>
          <button type="button" @click="openLadderInvite">
            <span class="ladder-add-people__icon"><FlowIcon name="send" /></span>
            <span><strong>Share ladder invite</strong><small>Send a secure link for players to request to join.</small></span>
            <FlowIcon name="arrow-right" />
          </button>
          <button type="button" @click="openAddPeopleStep('import')">
            <span class="ladder-add-people__icon"><FlowIcon name="upload" /></span>
            <span><strong>Bring your ladder list</strong><small>Import the player list and starting order you already use.</small></span>
            <FlowIcon name="arrow-right" />
          </button>
        </div>

        <section v-if="addPeopleStep" class="ladder-add-people__step">
          <button class="ladder-add-people__back" type="button" @click="updateActiveAddPeopleFlow({ step: '' })"><span aria-hidden="true">&larr;</span> Back to add people</button>
          <LadderAddClubMembersView
            v-if="addPeopleStep === 'members'"
            :ladder-id="activeLadder.id"
            embedded
            @back="updateActiveAddPeopleFlow({ step: '' })"
          />
          <LadderShareInviteView
            v-else-if="addPeopleStep === 'invite'"
            :ladder-id="activeLadder.id"
            embedded
            @back="updateActiveAddPeopleFlow({ step: '' })"
          />
          <LadderImportView
            v-else
            :ladder-id="activeLadder.id"
            embedded
            @back="updateActiveAddPeopleFlow({ step: '' })"
                      @complete="updateActiveAddPeopleFlow({ open: false, step: '' })"
          />
        </section>
      </section>
    </Transition>

    <LadderBulkScheduler v-if="bulkModeActive && activeLadder && activeLadder.status !== 'setup' && players.length" :key="`${adminStore.activeClubId || 'club'}:${activeLadder.id}`" :ladder="activeLadder" :club-id="adminStore.activeClubId || ''" :players="players" :config="activeLadderConfig" :courts="courts" :current-player-id="currentPlayer?.id || ''" @record-missing-match="openMissingMatch" @mode="setLadderMode" @remove-player="openRemove" @remove-players="openBulkRemove" />
    <main v-if="!bulkModeActive && activeLadder && activeLadder.status !== 'setup' && players.length" class="ladder-workspace">
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
        <header class="ladder-heading ladder-heading--setup">
          <div class="ladder-heading__top">
            <div class="ladder-heading__title">
              <h1>{{ activeLadder?.name || 'Ladder' }}</h1>
            </div>
            <div v-if="canManageLadder" class="ladder-heading__match-setup">
              <div class="ladder-header-tools">
                <button type="button" class="ladder-header-player-access" @click="playerAccessOpen = true">Player access</button>
                <button
                  v-if="showDevTestControls && canManageLadder"
                  type="button"
                  class="ladder-header-player-access"
                  :disabled="populateTestBusy"
                  @click="requestPopulateTestPlayers"
                >
                  Populate test players
                </button>
                <label class="ladder-player-search" :class="{ 'is-open': individualSearchOpen }" @click="window.innerWidth <= 640 && (individualSearchOpen = true)">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="4.5" /><path d="m12 12 4 4" /></svg>
                  <input v-model="individualSearchQuery" type="search" placeholder="Search player" aria-label="Search player in this ladder" />
                </label>
                <button type="button" class="ladder-header-delete" :class="{ active: individualDeleteSelectionMode }" aria-label="Select players to remove" title="Select players to remove" :aria-pressed="individualDeleteSelectionMode" @click="beginIndividualDeletion">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 6h10M8 6V4h4v2m-6 0 .7 10h6.6L14 6M8.5 9v4m3-4v4" /></svg>
                </button>
              </div>
            </div>
          </div>
          <nav v-if="canManageLadder" class="match-setup-tabs" aria-label="Ladder scheduling mode">
            <button type="button" :class="{ active: ladderMode === 'individual' }" :aria-pressed="ladderMode === 'individual'" @click="setLadderMode('individual')">Individual</button>
            <button type="button" :class="{ active: ladderMode === 'bulk' }" :aria-pressed="ladderMode === 'bulk'" @click="setLadderMode('bulk')">Bulk</button>
          </nav>
        </header>

        <section
          v-if="players.length" 
          ref="ladderListRef"
          class="ladder-list"
          :aria-label="
            challengeSelectionActive
              ? 'Choose an eligible Ladder opponent'
              : 'Club Ladder ranking'
          "
          :tabindex="
            challengeSelectionActive
              ? 0
              : undefined
          "
          @click="handleChallengeListClick"
          @keydown.esc.prevent="
            challengeSelectionActive &&
            cancelChallengeSelection()
          "
        >
          <TransitionGroup
            name="ladder-focus"
            @before-leave="pinLeavingPlayer"
            @after-leave="clearLeavingPlayer"
            @leave-cancelled="clearLeavingPlayer"
            @before-enter="clearLeavingPlayer"
            tag="div"
            class="ladder-list__rows"
          >
          <article
            v-for="player in displayPlayers"
            :key="player.id"
            :ref="
              (element) =>
                setPlayerRowRef(
                  player.id,
                  element,
                )
            "
            class="ladder-player-item"
          >
            <div
              class="ladder-row"
              :class="{
                'ladder-row--you':
                  isCurrentPlayer(player),
                'ladder-row--selected':
                  playerRowState(player).selected,
                'ladder-row--opponent':
                  player.id === selectedOpponentId,
                'ladder-row--managed':
                  playerRowState(player).managed,
                'ladder-row--eligible':
                  playerRowState(player).eligible,
                'ladder-row--quiet':
                  playerRowState(player).quiet,
                'ladder-row--paused':
                  Boolean(player.challengePaused),
                'ladder-row--live':
                  isPlayingLive(player),
                'ladder-row--interactive':
                  canManageLadder && !isPlayingLive(player),
              }"
              :role="
                canManageLadder && !isPlayingLive(player)
                  ? 'button'
                  : undefined
              "
              :tabindex="
                canManageLadder && !isPlayingLive(player) ? 0 : undefined
              "
:draggable="challengeSelectionActive && player.id === dragChallengePlayerId"
              :data-ladder-player-id="player.id"
              :style="player.id === draggingChallengePlayerId ? { opacity: .38 } : undefined"
              @click="handlePlayerRow(player)"
              @dragend="draggingChallengePlayerId = ''"
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

                <small v-if="isCurrentPlayer(player)">
                  You
                </small>

                <small
                  v-if="!availabilityFor(player).available"
                  class="ladder-row__paused"
                >
                  {{ availabilityFor(player).label }}
                </small>

                <small class="ladder-row__metric">
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
                </small>
              </span>

              <span
                v-if="canManageLadder"
                class="ladder-row__status"
              >
                <span
                  v-if="isPlayingLive(player)"
                  class="ladder-row__live-state"
                >
                  <small class="ladder-row__state ladder-row__state--live">
                    Playing now
                  </small>

                  <button
                    v-if="canManageLiveMatch"
                    class="ladder-row__live-control"
                    type="button"
                    @click.stop="openLiveMatchControl(player)"
                  >
                    Match control
                  </button>
                </span>

                <span
                  v-else-if="playerRowState(player).selected"
                  class="ladder-row__selected-controls"
                >
                  <small
                    class="ladder-row__state ladder-row__state--selected"
                  >
                    Challenger
                  </small>

                  <button
                    class="ladder-row__cancel-selection"
                    type="button"
                    aria-label="Deselect challenger"
                    title="Deselect challenger"
                    @click.stop="cancelChallengeSelection"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="m6 6 8 8M14 6l-8 8" />
                    </svg>
                  </button>
                </span>

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
                  <button class="ladder-row__drag-handle" type="button" data-tooltip="Hold and drag to choose an eligible opponent" :aria-label="`Hold and drag ${player.name} to an eligible opponent`" @click.stop.prevent @pointerdown.stop="startHandDrag(player, $event)">
                    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 10V5.6a1.25 1.25 0 0 1 2.5 0v3.15" /><path d="M10 8.75V4.5a1.25 1.25 0 0 1 2.5 0v4.25" /><path d="M12.5 8.75V5.9a1.25 1.25 0 0 1 2.5 0v5.1" /><path d="M7.5 8.65 6.7 8a1.28 1.28 0 0 0-1.75 1.87l3.4 3.2a3.8 3.8 0 0 0 2.6 1.04h1.5a3.8 3.8 0 0 0 3.8-3.8v-1.56" /></svg>
                  </button>
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
          </TransitionGroup>
        </section>
      </template>
    </main>

    <teleport to="body">
      <div
        v-if="populateTestConfirmOpen"
        class="ladder-test-populate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ladder-test-populate-title"
        @click.self="!populateTestBusy && (populateTestConfirmOpen = false)"
      >
        <section class="ladder-test-populate-dialog__panel">
          <h2 id="ladder-test-populate-title">Populate test players?</h2>
          <p>
            This will replace previously generated GORRA test players on the active
            Ladders. Your Club and Ladder settings will stay in place.
          </p>
          <div class="ladder-test-populate-dialog__actions">
            <button
              type="button"
              class="button-secondary"
              :disabled="populateTestBusy"
              @click="populateTestConfirmOpen = false"
            >
              {{ 'Cancel' }}
            </button>
            <button
              type="button"
              class="button-primary"
              :disabled="populateTestBusy"
              @click="populateTestPlayers"
            >
              {{ populateTestBusy ? 'Populating…' : 'Populate' }}
            </button>
          </div>
        </section>
      </div>
    </teleport>
    <teleport to="body">
      <article v-if="dragGhost" class="ladder-drag-ghost" :style="{ left: `${dragGhost.x}px`, top: `${dragGhost.y}px`, width: `${dragGhost.width}px` }"><strong>#{{ dragGhost.player.rank }}</strong><PersonAvatar :name="dragGhost.player.name" :image="dragGhost.player.imageUrl" :size="40" /><span>{{ dragGhost.player.name }}</span></article>
    </teleport>
    <teleport to="body">
      <div v-if="dragActionOpen" class="ladder-drag-action" @click.self="dragActionOpen = false; dragDropTargetId = ''; resetChallengeSelection()">
        <section class="ladder-drag-action__panel"><p>Choose an action</p><h2>{{ selectedPlayer?.name }} vs {{ players.find((player) => player.id === dragDropTargetId)?.name }}</h2><div><button class="button-primary" type="button" @click="selectedOpponentId = dragDropTargetId; dragActionOpen = false; dragDropTargetId = ''">Set up challenge</button><button type="button" @click="managedPlayerId = selectedPlayerId; missingMatchDialogOpen = true; dragActionOpen = false; dragDropTargetId = ''">Record missing match</button></div></section>
      </div>
    </teleport>
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
      :players="players.filter((player) => pendingRemovalIds.includes(player.id))"
      @close="removeDialogOpen = false"
      @confirm="confirmRemove"
    />

    <LadderPlayerAccessDialog
      :open="playerAccessOpen"
      :club-id="adminStore.activeClubId || ''"
      :club-name="activeClub?.name || 'Club'"
      :ladder="activeLadder"
      @close="playerAccessOpen = false"
    />
  </section>
</template>

<style scoped>
.ladder-test-populate-dialog {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(8, 13, 10, 0.5);
}

.ladder-test-populate-dialog__panel {
  width: min(100%, 440px);
  padding: 24px;
  border-radius: 14px;
  background: var(--color-surface, #fff);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}

.ladder-test-populate-dialog__panel h2,
.ladder-test-populate-dialog__panel p {
  margin: 0;
}

.ladder-test-populate-dialog__panel p {
  margin-top: 10px;
  color: var(--color-muted);
  line-height: 1.5;
}

.ladder-test-populate-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.ladder-view {
  display: grid;
  min-width: 0;
  min-height: calc(
    100vh - var(--app-header-height)
  );
  grid-template-columns:
    236px minmax(0, 1fr) 0;
  background: var(--color-bg);
  /* Avoid animating layout on every frame while the details panel opens. */
}

.ladder-view--drawer {
  grid-template-columns:
    236px minmax(0, 1fr) 390px;
}

.ladder-workspace {
  min-width: 0;
  padding: 24px 30px 46px;
}


.ladder-heading__match-setup { display: grid; justify-items: end; gap: 5px; margin-left: auto; }
.ladder-heading__match-setup > span { color: var(--color-muted); font-size: 9px; font-weight: var(--font-weight-semibold); letter-spacing: .07em; text-transform: uppercase; }
.ladder-heading__match-setup > div { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border-radius: 8px; background: var(--color-surface-soft); }
.ladder-heading__match-setup button { min-height: 30px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--color-muted); font-size: 10px; font-weight: var(--font-weight-semibold); }
.ladder-heading__match-setup button.active { background: #111; color: #fff; }

.ladder-heading--setup { align-items: end; }
.ladder-heading--setup > h1 { margin: 0; color: var(--color-text); font-size: 23px; line-height: 1.25; }
.ladder-heading--setup .ladder-heading__match-setup { margin-left: auto; }
.ladder-heading__match-setup p { margin: 0; color: var(--color-muted); font-size: 10px; line-height: 1.35; }
.ladder-heading__match-setup > div { padding: 4px; border-radius: 9px; }
.ladder-heading__match-setup button { min-width: 82px; min-height: 34px; font-size: 10px; }

.ladder-mode-menu { position: relative; }
.ladder-mode-menu__trigger { min-width: 150px; min-height: 36px; border: 1px solid var(--color-border); border-radius: 8px; background: #fff; color: var(--color-text); font-size: 11px; font-weight: var(--font-weight-semibold); }
.ladder-mode-menu__trigger span { margin-left: 8px; color: var(--color-muted); }
.ladder-mode-menu__options { position: absolute; z-index: 20; top: calc(100% + 7px); right: 0; display: grid; width: 220px; gap: 3px; padding: 5px; border: 1px solid var(--color-border); border-radius: 10px; background: #fff; box-shadow: 0 12px 30px rgba(20, 45, 27, .14); }
.ladder-mode-menu__options button { display: grid; justify-items: start; min-width: 0 !important; min-height: 0 !important; padding: 9px 10px; border-radius: 7px; text-align: left; }
.ladder-mode-menu__options button:hover { background: var(--color-surface-soft); }
.ladder-mode-menu__options strong { color: var(--color-text); font-size: 11px; }
.ladder-mode-menu__options small { margin-top: 2px; color: var(--color-muted); font-size: 9px; }

.ladder-heading--setup { align-items: center; min-width: 0; }
.ladder-heading__match-setup { width: auto !important; justify-self: end; }
.ladder-mode-menu__trigger { min-width: 132px; padding: 0 10px 0 12px; border-color: var(--color-border) !important; background: #fff !important; color: var(--color-text) !important; box-shadow: none; }
.ladder-mode-menu__trigger:hover, .ladder-mode-menu__trigger:focus-visible { border-color: var(--color-border-strong) !important; background: var(--color-surface-soft) !important; color: var(--color-text) !important; outline: none; }
.ladder-mode-menu__trigger span { display: inline-block; margin-left: 14px; padding-right: 2px; }
.ladder-mode-menu__options button { color: var(--color-text) !important; }
.ladder-mode-menu__options button:hover { background: var(--color-surface-soft) !important; color: var(--color-text) !important; }
.ladder-mode-menu__options button.active { background: var(--color-surface-soft) !important; color: var(--color-primary-dark) !important; }
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
  -webkit-backdrop-filter: blur(1px);
  cursor: default;
}

.ladder-list {
  position: relative;
  min-width: 0;
  padding: 2px 4px 5px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: auto;
  scrollbar-width: thin;
  overflow-anchor: none;
  scroll-behavior: auto;
  overscroll-behavior: contain;
}

.ladder-list::-webkit-scrollbar {
  width: 6px;
}

.ladder-list__rows {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  min-width: 0;
  gap: 9px;
}

.ladder-view--selection
  .ladder-list {
  position: relative;
  z-index: 72;
  max-height:
    var(
      --challenge-window-max-height,
      calc(
        100dvh -
        var(--app-header-height) -
        24px
      )
    );
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 4px 5px;
  border-radius:
    calc(
      var(--app-card-radius) +
      2px
    );
  overscroll-behavior: contain;
  scroll-padding-block: 6px 10px;
  scrollbar-width: thin;
  scrollbar-color:
    rgba(22, 61, 43, 0.2)
    transparent;
  -webkit-overflow-scrolling: touch;
}

.ladder-view--selection
  .ladder-list:focus {
  outline: none;
}

.ladder-view--selection
  .ladder-list:focus-visible {
  outline:
    1px solid
    rgba(22, 61, 43, 0.18);
  outline-offset: 3px;
}

.ladder-view--selection
  .ladder-list::-webkit-scrollbar {
  width: 6px;
}

.ladder-view--selection
  .ladder-list::-webkit-scrollbar-track {
  background: transparent;
}

.ladder-view--selection
  .ladder-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background:
    rgba(22, 61, 43, 0.18);
}

/* The same cards physically settle into their focus positions. */
.ladder-focus-move,
.ladder-focus-enter-active {
  transition:
    transform 340ms cubic-bezier(.22, 1, .36, 1),
    opacity 180ms ease;
  will-change: transform, opacity;
}

.ladder-focus-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 0;
  pointer-events: none;
  transition: opacity 120ms ease-out;
}

.ladder-focus-enter-from {
  opacity: 0;
  transform: translateY(2px);
}

.ladder-focus-leave-to {
  opacity: 0;
}

.challenge-backdrop-enter-active {
  transition: opacity 180ms ease-out;
}

.challenge-backdrop-leave-active {
  transition: opacity 140ms ease-in;
}

.challenge-backdrop-enter-from,
.challenge-backdrop-leave-to {
  opacity: 0;
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
    opacity 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    color 160ms ease;
}

.ladder-row--interactive {
  cursor: pointer;
}

.ladder-row--interactive:hover,
.ladder-row--interactive:focus-visible {
  border-color: var(--color-border-strong);
}

.ladder-row--live:not(.ladder-row--selected) {
  border-color: rgba(38, 113, 72, 0.26);
  background: #f3faf4;
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
  min-width: 128px;
  text-align: right;
}

.ladder-row__selected-controls {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.ladder-row__cancel-selection {
  display: grid;
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  place-items: center;
  padding: 0;
  border: 1px solid #fff;
  border-radius: 8px;
  background: #fff;
  color: var(--color-primary-strong);
}

.ladder-row__cancel-selection:hover {
  border-color: var(--color-primary);
  background: #fff;
}

.ladder-row__cancel-selection:focus-visible {
  outline: 2px solid
    rgba(185, 239, 120, 0.34);
  outline-offset: 2px;
}

.ladder-row__cancel-selection svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
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
.ladder-row__live-state {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.ladder-row__state--live {
  background: #dff1e2;
  color: #236841;
}

.ladder-row__live-control {
  min-height: 29px;
  padding: 0 8px;
  border: 1px solid rgba(35, 104, 65, 0.28);
  border-radius: var(--app-inner-radius);
  background: #fff;
  color: #236841;
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
}

.ladder-row__live-control:hover,
.ladder-row__live-control:focus-visible {
  border-color: #236841;
  background: #edf8ef;
  outline: none;
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
  .ladder-view--selection
    .ladder-list {
    max-height:
      var(
        --challenge-window-max-height,
        calc(
          100dvh -
          var(--app-header-height) -
          var(--app-bottom-nav-height) -
          18px
        )
      );
  }
  .ladder-row__status {
    min-width: 0;
  }

  .ladder-row__selected-controls {
    gap: 5px;
  }

  .ladder-row__state--selected {
    min-height: 27px;
    padding-inline: 6px;
    font-size: 8px;
  }

  .ladder-row__cancel-selection {
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
  }

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

}

@media (prefers-reduced-motion: reduce) {
  .ladder-view,
  .ladder-row {
    transition: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ladder-focus-move,
  .ladder-focus-enter-active,
  .ladder-focus-leave-active,
  .challenge-backdrop-enter-active,
  .challenge-backdrop-leave-active {
    transition: none !important;
  }
}
/* Focused players stay still while choosing a challenge opponent. */
.ladder-view--selection .ladder-row,
.ladder-view--selection .ladder-row:hover,
.ladder-view--selection .ladder-row :is(button, a, [role='button']) {
  transform: none !important;
  translate: none !important;
  scale: none !important;
}

.ladder-view--selection .ladder-row--eligible:hover {
  background: #fff;
}
.ladder-view .ladder-row.ladder-row--opponent,
.ladder-view .ladder-row.ladder-row--opponent:hover {
  border-color: #287a4b;
  background: #287a4b;
}

.ladder-row--opponent .ladder-row__player strong,
.ladder-row--opponent .ladder-row__rank,
.ladder-row--opponent .ladder-row__metric {
  color: #fff;
}

.ladder-row--opponent .ladder-row__player small,
.ladder-row--opponent .ladder-row__state,
.ladder-row--opponent .ladder-row__chevron {
  color: #d8ff47;
}
/* Keep the complete challenge card, including its controls, inside its track. */
.ladder-row {
  grid-template-columns: 38px 40px minmax(0, 1fr) auto auto;
}

.ladder-row__status {
  min-width: 0;
}

.ladder-row--selected .ladder-row__cancel-selection,
.ladder-row--selected .ladder-row__cancel-selection:hover {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border-color: transparent;
  background: rgba(216, 255, 71, 0.12);
  color: #d8ff47;
  flex: 0 0 44px;
}

@media (max-width: 767px) {
  .ladder-row {
    grid-template-columns: 27px 36px minmax(0, 1fr) auto;
  }

  .ladder-row--selected,
  .ladder-row--opponent {
    grid-template-columns: 27px 36px minmax(0, 1fr);
    padding: 12px;
    row-gap: 12px;
  }

  .ladder-row--selected .ladder-row__status,
  .ladder-row--opponent .ladder-row__status {
    grid-column: 2 / -1;
    justify-self: stretch;
  }

  .ladder-row__selected-controls {
    display: flex;
    justify-content: space-between;
    width: 100%;
  }
}
.ladder-setup-gate,
.ladder-zero {
  width: min(100%, 720px);
  margin: 40px auto;
  padding: 0 20px;
}

.ladder-empty-workspace {
  display: grid;
  width: min(100% - 64px, 860px);
  min-height: min(500px, calc(100vh - 250px));
  margin: 32px auto 24px;
  padding: 16px 32px;
  place-items: center;
}

.ladder-empty-workspace :deep(.empty-state-system) {
  min-height: 390px;
  max-width: 590px;
  gap: 18px;
  padding: 48px 32px 56px;
}

.ladder-empty-workspace :deep(.empty-state-system__visual) { width: 64px; height: 64px; border-radius: 18px; }
.ladder-empty-workspace :deep(.empty-state-system__visual .flow-icon) { width: 32px; height: 32px; }
.ladder-empty-workspace :deep(.empty-state-system__content h3) { color: var(--color-text); font-size: 23px; line-height: 1.25; }
.ladder-empty-workspace :deep(.empty-state-system__content p) { max-width: 500px; margin-top: 10px; font-size: 14px; line-height: 1.65; }
.ladder-empty-workspace :deep(.empty-state-system__actions) { margin-top: 10px; }
.ladder-empty-workspace :deep(.empty-state-system__actions button) { min-width: 144px; min-height: 46px; padding-inline: 22px; }
.ladder-add-people {
  position: fixed;
  z-index: 32;
  top: var(--app-header-height);
  right: 0;
  bottom: 0;
  left: calc(var(--app-sidebar-width) + 236px);
  box-sizing: border-box;
  width: auto;
  margin: 0;
  padding: 42px 56px 64px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: auto;
  scrollbar-width: thin;
  background: var(--color-bg);
}

.ladder-add-people__heading,
.ladder-add-people__choices,
.ladder-add-people__step { width: 100%; max-width: none; }

.ladder-add-people::-webkit-scrollbar { width: 6px; }
.ladder-add-people::-webkit-scrollbar-track { background: transparent; }
.ladder-add-people::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(22, 61, 43, .18); }

.ladder-add-people__heading { max-width: 470px; margin-bottom: 22px; }
.ladder-add-people__heading span { color: var(--color-primary-strong); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.ladder-add-people__heading h2 { margin: 7px 0 6px; color: var(--color-text); font-size: 21px; line-height: 1.25; }
.ladder-add-people__heading p { margin: 0; color: var(--color-muted); font-size: 13px; line-height: 1.55; }
.ladder-add-people__choices { display: grid; width: 100%; gap: 10px; }
.ladder-add-people__choices button { display: grid; grid-template-columns: 42px minmax(0, 1fr) 18px; width: 100%; align-items: center; gap: 14px; padding: 15px 16px; border: 1px solid var(--color-border); border-radius: 12px; background: #fff; color: var(--color-text); text-align: left; cursor: pointer; }
.ladder-add-people__choices button > span:nth-child(2) { display: grid; gap: 3px; }
.ladder-add-people__choices strong { font-size: 13px; font-weight: var(--font-weight-semibold); }
.ladder-add-people__choices small { color: var(--color-muted); font-size: 11px; line-height: 1.4; }
.ladder-add-people__choices > button > .flow-icon { width: 16px; height: 16px; color: var(--color-muted); }
.ladder-add-people__icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 10px; background: var(--color-surface-soft); color: var(--color-primary-strong); }
.ladder-add-people__icon .flow-icon { width: 20px; height: 20px; }
.ladder-add-options-enter-active, .ladder-add-options-leave-active { transition: opacity .2s ease, transform .2s ease; }
.ladder-add-options-enter-from, .ladder-add-options-leave-to { opacity: 0; transform: translateY(10px); }
.ladder-add-people__step { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--color-border); }
.ladder-add-people__back { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 18px; padding: 0; border: 0; background: transparent; color: var(--color-primary-strong); font-size: 12px; font-weight: var(--font-weight-semibold); cursor: pointer; }
.ladder-view--switching .ladder-empty-workspace,
.ladder-view--switching .ladder-workspace,
.ladder-view--switching :deep(.bulk-scheduler) { opacity: .72; transform: translateY(3px); }
.ladder-empty-workspace, .ladder-workspace, :deep(.bulk-scheduler) { transition: opacity .18s ease, transform .18s ease; }

.ladder-setup-gate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.ladder-setup-gate > div {
  display: grid;
  gap: 5px;
}

.ladder-setup-gate span {
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ladder-setup-gate h2 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--type-section-title, 18px);
  font-weight: var(--font-weight-semibold);
}

.ladder-setup-gate p {
  margin: 0;
  max-width: 520px;
  color: var(--color-muted);
  font-size: var(--type-page-description, 13px);
  line-height: 1.5;
}

@media (max-width: 640px) {
  .ladder-setup-gate {
    align-items: stretch;
    flex-direction: column;
    margin-top: 24px;
    padding: 0 16px;
  }

  .ladder-zero {
    margin-top: 24px;
    padding: 0 16px;
  }
}


.ladder-row__drag-handle { display: inline-grid; width: 28px; height: 28px; min-width: 28px; min-height: 28px; flex: 0 0 28px; aspect-ratio: 1 / 1; place-items: center; margin-right: 6px; border: 0; border-radius: 50%; background: #edf5ee; color: #387247; }
.ladder-row__drag-handle:hover { background: #dff0e2; }
.ladder-row__drag-handle { position: relative; }
.ladder-row__drag-handle::after { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 20; width: max-content; max-width: 180px; padding: 7px 9px; border-radius: 7px; background: #243128; color: #fff; content: attr(data-tooltip); font-size: 9px; font-weight: 600; line-height: 1.35; opacity: 0; pointer-events: none; transform: translateY(3px); transition: opacity .16s ease, transform .16s ease; }
.ladder-row__drag-handle:hover::after, .ladder-row__drag-handle:focus-visible::after { opacity: 1; transform: translateY(0); }
.ladder-row__drag-handle svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.45; stroke-linecap: round; stroke-linejoin: round; }
.ladder-row[draggable='true'] { cursor: grab; }
.ladder-row[draggable='true']:active { cursor: grabbing; }
.ladder-drag-ghost { position: fixed; z-index: 10040; display: grid; grid-template-columns: 42px 40px minmax(0,1fr); align-items: center; gap: 11px; width: min(440px,calc(100vw - 32px)); padding: 13px 16px; border: 1px solid rgba(8,173,43,.38); border-radius: 12px; background: #fff; box-shadow: 0 20px 44px rgba(20,38,25,.24); color: #334037; font-size: 12px; font-weight: 650; pointer-events: none; transform: translate(-50%,-50%) rotate(1deg); }
.ladder-drag-ghost > strong { color: var(--color-primary-strong); }

.ladder-drag-action{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:20px;background:rgba(17,28,20,.32)}.ladder-drag-action__panel{width:min(360px,100%);padding:20px;border-radius:14px;background:#fff;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.2)}.ladder-drag-action__panel p,.ladder-drag-action__panel h2{margin:0}.ladder-drag-action__panel p{color:var(--color-muted);font-size:10px;text-transform:uppercase}.ladder-drag-action__panel h2{margin-top:7px;font-size:16px}.ladder-drag-action__panel div{display:grid;gap:8px;margin-top:18px}.ladder-drag-action__panel button{min-height:40px;border:1px solid #dfe5e0;border-radius:8px;background:#fff;color:#526057;font-size:11px;font-weight:650}.ladder-drag-action__panel .button-primary{border:0;color:#fff}




/* One compact control: the menu wrapper must never read as a second button. */
.ladder-heading--setup { align-items: center; }
.ladder-heading__match-setup { display: block; margin-left: auto; padding: 0; background: transparent; }
.ladder-heading__match-setup > div { display: block; padding: 0; background: transparent; border-radius: 0; }
.ladder-mode-menu__trigger {
  display: inline-flex; align-items: center; gap: 7px; width: 190px; min-width: 190px; min-height: 36px;
  padding: 0 10px 0 12px; border: 1px solid var(--color-border) !important;
  border-radius: 8px; background: #fff !important; color: var(--color-text) !important;
}
.ladder-mode-menu__trigger::before { content: ''; width: 12px; height: 12px; flex: 0 0 12px; border: 1.5px solid currentColor; border-radius: 50%; opacity: .72; }
.ladder-mode-menu__trigger span { margin-left: auto; padding: 0; }
.ladder-mode-menu__options button {
  display: grid; grid-template-columns: 16px minmax(0, 1fr); column-gap: 8px; align-items: center;
  justify-items: start; width: 100%; padding: 9px 10px;
}
.ladder-mode-menu__options button::before { content: ''; grid-row: 1 / span 2; width: 12px; height: 12px; border: 1.5px solid currentColor; border-radius: 50%; opacity: .7; }
.ladder-mode-menu__options button strong, .ladder-mode-menu__options button small { grid-column: 2; }

/* Shared match-mode header: switching mode changes only the workspace below. */
.ladder-heading__match-setup { display: grid; justify-items: end; gap: 5px; margin-left: auto; }
.ladder-heading__match-setup > span { color: var(--color-muted); font-size: 9px; font-weight: var(--font-weight-semibold); letter-spacing: .07em; text-transform: uppercase; }
.ladder-mode-tabs { display: inline-grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; border-radius: 8px; background: var(--color-surface-soft); }
.ladder-mode-tabs button { min-width: 82px; min-height: 32px; padding: 0 11px; border: 0; border-radius: 6px; background: transparent; color: var(--color-muted); font-size: 10px; font-weight: var(--font-weight-semibold); cursor: pointer; }
.ladder-mode-tabs button.active { background: #111; color: #fff; }
.ladder-mode-tabs button:focus-visible { outline: 2px solid var(--color-primary-strong); outline-offset: 2px; }
/* Persistent hierarchy: the match mode stays visible below the app header while its workspace scrolls. */
.ladder-workspace > .ladder-heading--setup {
  position: sticky;
  top: 0;
  z-index: 30;
  margin: -24px -30px 14px;
  padding: 24px 30px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
  background: color-mix(in srgb, var(--color-bg) 96%, transparent);
  backdrop-filter: blur(10px);
}
/* Individual and Bulk are the primary fixed workspace headers; the ladder name is contextual. */
.ladder-workspace > .ladder-heading--setup { align-items: center; }
.ladder-workspace > .ladder-heading--setup > h1 { order: 2; color: var(--color-muted); font-size: 12px; font-weight: var(--font-weight-semibold); letter-spacing: 0; }
.ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup { order: 1; justify-items: start; margin-left: 0; }
.ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup > span { display: none; }
.ladder-workspace > .ladder-heading--setup .ladder-mode-tabs { gap: 0; padding: 0; border-radius: 0; background: transparent; }
.ladder-workspace > .ladder-heading--setup .ladder-mode-tabs button { min-width: 124px; min-height: 44px; padding: 0 18px; border-radius: 0; color: var(--color-muted); font-size: 15px; font-weight: var(--font-weight-bold); }
.ladder-workspace > .ladder-heading--setup .ladder-mode-tabs button.active { border-bottom: 3px solid var(--color-primary-strong); background: transparent; box-shadow: none; color: var(--color-text); }
/* Stable header: ladder title left, black shadowed mode toggle right. */
.ladder-workspace > .ladder-heading--setup > h1 { order: 0; color: var(--color-text); font-size: 23px; font-weight: var(--font-weight-bold); letter-spacing: -0.025em; }
.ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup { order: 0; justify-items: end; margin-left: auto; }
.ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup > span { display: none; }
.ladder-workspace > .ladder-heading--setup .ladder-mode-tabs { gap: 3px; padding: 3px; border-radius: 8px; background: var(--color-surface-soft); }
.ladder-workspace > .ladder-heading--setup .ladder-mode-tabs button { min-width: 82px; min-height: 34px; padding: 0 11px; border-radius: 6px; font-size: 10px; }
.ladder-workspace > .ladder-heading--setup .ladder-mode-tabs button.active { border-bottom: 0; background: #111; box-shadow: 0 2px 8px rgba(0, 0, 0, .16); color: #fff; }
/* Keep the ladder context and active selection mode together; controls stay at the far edge. */
.ladder-workspace > .ladder-heading--setup > .ladder-heading__title { display: flex; min-width: 0; align-items: center; gap: 10px; }
.ladder-workspace > .ladder-heading--setup > .ladder-heading__title h1 { margin: 0; color: var(--color-text); font-size: 23px; font-weight: var(--font-weight-bold); letter-spacing: -0.025em; }
.ladder-mode-tag { display: inline-flex; min-height: 24px; align-items: center; padding: 0 8px; border: 1px solid color-mix(in srgb, var(--color-primary) 22%, transparent); border-radius: var(--app-control-radius, 7px); background: color-mix(in srgb, var(--color-primary) 9%, transparent); color: var(--color-primary-strong); font-size: 10px; font-weight: var(--font-weight-semibold); white-space: nowrap; }
@media (max-width: 640px) { .ladder-workspace > .ladder-heading--setup { align-items: flex-start; } .ladder-workspace > .ladder-heading--setup > .ladder-heading__title { flex-wrap: wrap; gap: 6px 8px; } .ladder-mode-tag { white-space: normal; } }

/* Mobile keeps the same controls while allowing every player name and action to remain readable. */
@media (max-width: 767px) {
  .ladder-workspace > .ladder-heading--setup { display: flex; flex-wrap: wrap; gap: 10px; }
  .ladder-workspace > .ladder-heading--setup > .ladder-heading__title { width: 100%; }
  .ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup { margin-left: auto; }
  .ladder-mode-tag { display: none; }
  .ladder-row { align-items: start; min-height: 64px; }
  .ladder-row__player strong { display: block; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
  .ladder-row__state, .ladder-row__status small { max-width: none; white-space: normal; }
}
@media (max-width: 420px) {
  .ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup { width: 100%; margin-left: 0; }
  .ladder-workspace > .ladder-heading--setup .ladder-mode-tabs { display: inline-grid; }
}

/* Shared Individual header actions: same right-side track as Bulk. */
.ladder-heading__match-setup { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 8px; }
.ladder-header-tools { display: flex; align-items: center; gap: 6px; }
.ladder-player-search { display: inline-flex; align-items: center; width: 148px; height: 30px; padding: 0 8px; gap: 6px; border: 1px solid var(--color-border); border-radius: var(--app-control-radius, 7px); background: var(--color-surface); }
.ladder-player-search svg, .ladder-header-delete svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.ladder-player-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; font-size: 10px; }
.ladder-header-delete { display: grid; width: 30px; height: 30px; place-items: center; padding: 0; border: 1px solid transparent; border-radius: var(--app-control-radius, 7px); background: transparent; color: var(--color-muted); cursor: pointer; }
.ladder-header-delete:hover, .ladder-header-delete:focus-visible { border-color: var(--color-border); background: var(--color-surface-soft); color: #8d453e; outline: none; }
@media (max-width: 640px) {
  .ladder-heading__match-setup { gap: 4px; }
  .ladder-player-search { position: relative; width: 30px; padding: 0; justify-content: center; border-color: transparent; cursor: pointer; }
  .ladder-player-search input { display: none; }
  .ladder-player-search.is-open { position: absolute; z-index: 50; top: calc(100% + 8px); right: 86px; width: min(260px, calc(100vw - 32px)); padding: 0 9px; border-color: var(--color-border); box-shadow: 0 12px 28px rgba(20, 45, 27, .16); }
  .ladder-player-search.is-open input { display: block; }
}
/* Individual deliberately reuses Bulk’s compact header proportions. */
.ladder-mode-tag { display: inline-flex; flex-direction: column; justify-content: center; gap: 1px; min-height: 30px; padding: 3px 9px; line-height: 1.05; }
.ladder-mode-tag span { font-size: 8px; font-weight: var(--font-weight-medium); }
.ladder-mode-tag strong { font-size: 9px; font-weight: var(--font-weight-bold); }
.ladder-player-search { width: 118px; }
.ladder-heading__match-setup { margin-left: auto; }

/* ==========================================================
   LOCKED LADDER MODE HEADER — EXACT BULK GEOMETRY
   Switching Individual/Bulk may change active color only.
   ========================================================== */

.ladder-workspace
  > .ladder-heading--setup {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ladder-workspace
  > .ladder-heading--setup
  > .ladder-heading__title {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 10px;
}

.ladder-workspace
  > .ladder-heading--setup
  > .ladder-heading__title
  h1 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 23px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladder-mode-tag {
  display: inline-flex;
  min-height: 30px;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
  padding: 3px 9px;
  border: 1px solid
    color-mix(
      in srgb,
      var(--color-primary) 22%,
      transparent
    );
  border-radius: var(--app-control-radius, 7px);
  background:
    color-mix(
      in srgb,
      var(--color-primary) 9%,
      transparent
    );
  color: var(--color-primary-strong);
  line-height: 1.05;
  white-space: nowrap;
}

.ladder-mode-tag span {
  display: block;
  font-size: 8px;
  font-weight: var(--font-weight-medium);
}

.ladder-mode-tag strong {
  display: block;
  font-size: 9px;
  font-weight: var(--font-weight-bold);
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup {
  display: flex !important;
  flex: 0 0 auto;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  margin-left: auto !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup
  > span {
  display: none !important;
}

/*
  IMPORTANT:
  This selector intentionally beats the older
  ".ladder-heading__match-setup > div" grid rule.
*/
.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup
  > .ladder-header-tools {
  display: flex !important;
  min-width: 0;
  grid-template-columns: none !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  gap: 6px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

.ladder-player-search {
  width: 104px !important;
  min-width: 104px !important;
  height: 30px;
  flex: 0 0 104px !important;
}

.ladder-header-delete {
  width: 30px !important;
  min-width: 30px !important;
  height: 30px;
  flex: 0 0 30px !important;
}

/*
  IMPORTANT:
  Keep this as the second direct div in the same horizontal track.
*/
.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup
  > .ladder-mode-tabs {
  display: inline-grid !important;
  grid-template-columns: 1fr 1fr !important;
  flex: 0 0 auto;
  gap: 3px !important;
  padding: 3px !important;
  border-radius: 8px !important;
  background: var(--color-surface-soft) !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-mode-tabs
  button {
  min-width: 82px !important;
  min-height: 34px !important;
  padding: 0 11px !important;
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-muted) !important;
  font-size: 10px !important;
  font-weight: var(--font-weight-semibold) !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-mode-tabs
  button.active {
  background: #111 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16) !important;
  color: #fff !important;
}

@media (max-width: 640px) {
  .ladder-workspace
    > .ladder-heading--setup {
    align-items: center;
    gap: 8px;
  }

  .ladder-workspace
    > .ladder-heading--setup
    > .ladder-heading__title {
    min-width: 0;
  }

  .ladder-workspace
    > .ladder-heading--setup
    > .ladder-heading__title
    h1 {
    font-size: 18px;
  }

  .ladder-mode-tag {
    display: none;
  }

  .ladder-workspace
    > .ladder-heading--setup
    .ladder-heading__match-setup {
    width: auto !important;
    gap: 4px !important;
    margin-left: auto !important;
  }

  .ladder-player-search {
    width: 30px !important;
    min-width: 30px !important;
    flex-basis: 30px !important;
  }

  .ladder-player-search.is-open {
    width: min(260px, calc(100vw - 32px)) !important;
  }

  .ladder-workspace
    > .ladder-heading--setup
    .ladder-mode-tabs
    button {
    min-width: 58px !important;
    padding: 0 8px !important;
  }
}

/* ==========================================================
   FINAL LADDER HEADER VISUAL LOCK — INDIVIDUAL
   Keep this at the end of the scoped stylesheet.
   ========================================================== */

.ladder-workspace
  > .ladder-heading--setup {
  min-height: 72px;
  margin: -24px -30px 14px;
  padding: 18px 30px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow:
    0 7px 18px
    rgba(15, 34, 24, 0.035);
}

.ladder-workspace
  > .ladder-heading--setup
  > .ladder-heading__title {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 10px;
}

.ladder-workspace
  > .ladder-heading--setup
  > .ladder-heading__title
  h1 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 23px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Match-selection badge is context, not an action. */
.ladder-mode-tag {
  display: inline-flex !important;
  min-height: 30px !important;
  flex: 0 0 auto;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: center !important;
  gap: 1px !important;
  padding: 3px 9px !important;
  border: 1px solid
    rgba(17, 17, 17, 0.11) !important;
  border-radius:
    var(--app-control-radius, 9px) !important;
  background:
    rgba(17, 17, 17, 0.055) !important;
  color: #111 !important;
  line-height: 1.05 !important;
  white-space: nowrap !important;
}

.ladder-mode-tag span {
  display: block;
  color: #111 !important;
  font-size: 8px !important;
  font-weight: var(--font-weight-medium);
}

.ladder-mode-tag strong {
  display: block;
  color: #111 !important;
  font-size: 9px !important;
  font-weight: var(--font-weight-bold);
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup {
  display: flex !important;
  flex: 0 0 auto;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  margin-left: auto !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup
  > span {
  display: none !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-heading__match-setup
  > .ladder-header-tools {
  display: flex !important;
  min-width: 0;
  align-items: center !important;
  flex-wrap: nowrap !important;
  gap: 6px !important;
  padding: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

/* Search: exact same geometry as Bulk. */
.ladder-player-search {
  display: inline-flex !important;
  width: 170px !important;
  min-width: 170px !important;
  height: 36px !important;
  flex: 0 0 170px !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  padding: 0 11px !important;
  overflow: hidden;
  border: 1px solid var(--color-border) !important;
  border-radius:
    var(--app-control-radius, 9px) !important;
  background: var(--color-surface) !important;
  box-shadow: none !important;
}

.ladder-player-search svg {
  width: 15px !important;
  height: 15px !important;
  flex: 0 0 15px;
  fill: none;
  stroke: #4f5b52;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ladder-player-search input {
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  height: 100%;
  padding: 0 !important;
  border: 0 !important;
  border-radius: 0 !important;
  outline: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-text) !important;
  font: inherit;
  font-size: 10px !important;
  line-height: 1 !important;
}

.ladder-player-search input::placeholder {
  overflow: visible;
  color: var(--color-muted) !important;
  opacity: 1 !important;
  text-overflow: clip;
}

.ladder-player-search:focus-within {
  border-color:
    rgba(0, 181, 26, 0.38) !important;
  box-shadow:
    inset 0 0 0 1px
    rgba(0, 181, 26, 0.08) !important;
}

.ladder-player-search input:focus,
.ladder-player-search input:focus-visible {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
}

/* Delete: exact same geometry as Bulk. */
.ladder-header-delete {
  display: grid !important;
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  min-height: 36px !important;
  flex: 0 0 36px !important;
  place-items: center;
  padding: 0 !important;
  border: 1px solid var(--color-border) !important;
  border-radius:
    var(--app-control-radius, 9px) !important;
  background: var(--color-surface) !important;
  color: #5e6961 !important;
  opacity: 1 !important;
  box-shadow: none !important;
}

.ladder-header-delete svg {
  width: 16px !important;
  height: 16px !important;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.ladder-header-delete:hover,
.ladder-header-delete:focus-visible,
.ladder-header-delete.active {
  border-color:
    rgba(164, 71, 64, 0.22) !important;
  background:
    rgba(164, 71, 64, 0.05) !important;
  color: #94463f !important;
}

/* Same mode switch dimensions as Bulk. */
.ladder-workspace
  > .ladder-heading--setup
  .ladder-mode-tabs {
  display: inline-grid !important;
  grid-template-columns: 1fr 1fr !important;
  flex: 0 0 auto;
  gap: 3px !important;
  padding: 3px !important;
  border-radius:
    var(--app-control-radius, 9px) !important;
  background: var(--color-surface-soft) !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-mode-tabs
  button {
  min-width: 82px !important;
  min-height: 36px !important;
  padding: 0 11px !important;
  border: 0 !important;
  border-radius: 6px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-muted) !important;
  font-size: 10px !important;
  font-weight: var(--font-weight-semibold) !important;
}

.ladder-workspace
  > .ladder-heading--setup
  .ladder-mode-tabs
  button.active {
  background: #111 !important;
  box-shadow:
    0 2px 8px
    rgba(0, 0, 0, 0.14) !important;
  color: #fff !important;
}

@media (max-width: 640px) {
  .ladder-mode-tag {
    display: none !important;
  }

  .ladder-player-search {
    width: 36px !important;
    min-width: 36px !important;
    flex-basis: 36px !important;
    justify-content: center !important;
    padding: 0 !important;
    border-color: transparent !important;
  }

  .ladder-player-search input {
    display: none !important;
  }

  .ladder-player-search.is-open {
    position: absolute;
    z-index: 50;
    top: calc(100% + 8px);
    right: 90px;
    width:
      min(
        290px,
        calc(100vw - 32px)
      ) !important;
    min-width: 0 !important;
    padding: 0 11px !important;
    border-color: var(--color-border) !important;
    box-shadow:
      0 12px 28px
      rgba(20, 45, 27, 0.12) !important;
  }

  .ladder-player-search.is-open input {
    display: block !important;
  }

  .ladder-workspace
    > .ladder-heading--setup
    .ladder-mode-tabs
    button {
    min-width: 58px !important;
    padding: 0 8px !important;
  }
}
/* Rankings mode switch: plain text tabs on their own desktop row. */
.ladder-workspace > .ladder-heading--setup {
  display: block !important;
  min-height: 0;
  padding: 16px 30px 0;
}

.ladder-workspace > .ladder-heading--setup > .ladder-heading__top {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
}

.ladder-workspace > .ladder-heading--setup > .ladder-heading__top > .ladder-heading__title {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
}

.ladder-workspace > .ladder-heading--setup .ladder-heading__match-setup {
  display: flex !important;
  width: auto !important;
  flex: 0 0 auto;
  align-items: center !important;
  margin-left: auto !important;
}

.ladder-workspace > .ladder-heading--setup .match-setup-tabs {
  display: flex !important;
  gap: 26px !important;
  border-top: 1px solid var(--color-border);
}

.ladder-workspace > .ladder-heading--setup .match-setup-tabs button {
  position: relative;
  min-width: 0 !important;
  min-height: 44px !important;
  padding: 0 1px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-muted) !important;
  font-size: 13px !important;
  font-weight: var(--font-weight-semibold) !important;
}

.ladder-workspace > .ladder-heading--setup .match-setup-tabs button.active {
  background: transparent !important;
  box-shadow: none !important;
  color: var(--color-text) !important;
}

.ladder-workspace > .ladder-heading--setup .match-setup-tabs button.active::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--color-primary);
  content: '';
}

.ladder-workspace > .ladder-heading--setup .match-setup-tabs button:hover:not(.active) {
  color: var(--color-text-soft) !important;
}

@media (max-width: 767px) {
  .ladder-workspace > .ladder-heading--setup {
    padding: 14px 12px 0;
  }

  .ladder-workspace > .ladder-heading--setup > .ladder-heading__top {
    flex-wrap: wrap;
    row-gap: 8px;
  }

  .ladder-workspace > .ladder-heading--setup > .ladder-heading__top > .ladder-heading__title {
    width: 100%;
  }

  .ladder-workspace > .ladder-heading--setup .match-setup-tabs {
    display: none !important;
  }
}


/* Match the Bulk reference title scale. */
.ladder-workspace > .ladder-heading--setup > .ladder-heading__top > .ladder-heading__title h1 {
  font-size: 20px !important;
}

/* Individual adopts the Bulk reference header and static player-card layout. */
.ladder-workspace > .ladder-heading--setup > .ladder-heading__top > .ladder-heading__title h1 {
  color: var(--color-text) !important;
  font-size: 20px !important;
  font-weight: var(--font-weight-bold) !important;
}

.ladder-row {
  min-height: 65px;
  grid-template-columns: 42px 40px minmax(0, 1fr) auto;
  gap: 11px;
  padding: 10px 14px 10px 18px;
}

.ladder-row__player {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 3px;
}

.ladder-row__player strong {
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
}

.ladder-row__metric {
  display: block;
  color: var(--color-muted);
  font-size: 10px;
  font-weight: var(--font-weight-regular);
  line-height: 1.2;
}

.ladder-row__status {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.ladder-row__chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

/* Strict Bulk visual replica for the Individual list. */
.ladder-list {
  margin-right: 16px;
  padding: 0 !important;
}

.ladder-list__rows {
  gap: 8px !important;
}

.ladder-row {
  min-height: 65px !important;
  grid-template-columns: 42px 40px minmax(0, 1fr) auto !important;
  align-items: center !important;
  gap: 11px !important;
  padding: 10px 14px 10px 18px !important;
}

.ladder-row__rank {
  color: var(--color-text-soft) !important;
  font-size: 12px !important;
  font-weight: var(--font-weight-regular) !important;
}

.ladder-row__player {
  display: grid !important;
  min-width: 0;
  align-content: center;
  gap: 0 !important;
}

.ladder-row__player strong {
  overflow: hidden;
  color: var(--color-text) !important;
  font-size: 12px !important;
  font-weight: var(--font-weight-semibold) !important;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ladder-row__player .ladder-row__metric {
  display: block !important;
  margin-top: 2px !important;
  color: var(--color-muted) !important;
  font-size: 9.5px !important;
  font-weight: var(--font-weight-regular) !important;
  letter-spacing: 0 !important;
  line-height: normal !important;
  text-transform: none !important;
  white-space: nowrap;
}

.ladder-row__status {
  display: inline-flex !important;
  min-width: 0 !important;
  align-items: center;
  gap: 10px;
}

.ladder-row__manage-state {
  min-height: 30px;
  gap: 10px;
}

.ladder-row__drag-handle {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  flex: 0 0 30px;
  margin-right: 0;
  background: #edf5ee;
  color: #387247;
}

.ladder-row__drag-handle svg {
  width: 15px;
  height: 15px;
  stroke-width: 1.45;
}

.ladder-row__chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  stroke-width: 1.6;
}
</style>

<style scoped>
.ladder-header-player-access { min-height: 30px; padding: 0 9px; border: 1px solid var(--color-border); border-radius: var(--app-control-radius, 7px); background: var(--color-surface); color: var(--color-text); font-size: 10px; font-weight: var(--font-weight-semibold); white-space: nowrap; }
.ladder-header-player-access:hover, .ladder-header-player-access:focus-visible { border-color: var(--color-border-strong); background: var(--color-surface-soft); outline: none; }
</style>
