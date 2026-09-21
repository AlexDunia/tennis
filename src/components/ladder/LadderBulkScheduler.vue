<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import PersonAvatar from '../PersonAvatar.vue'
import {
  ACTIVE_LADDER_CHALLENGE_STATUSES,
} from '../../config/ladder.js'
import {
  getEligibleLadderOpponents,
  getLadderPlayerAvailability,
} from '../../services/LadderAccessService.js'
import { useChallengeStore } from '../../stores/challenge'
import { useNotificationStore } from '../../stores/notification'

const props = defineProps({
  ladder: {
    type: Object,
    required: true,
  },
  players: {
    type: Array,
    default: () => [],
  },
  config: {
    type: Object,
    required: true,
  },
  courts: {
    type: Array,
    default: () => [],
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'record-missing-match',
])

const challengeStore = useChallengeStore()
const notificationStore = useNotificationStore()

const playerListRef = ref(null)
const calendarScrollRef = ref(null)
const queueRef = ref(null)
const zoomCalendarScrollRef = ref(null)

const selectedPlayerId = ref('')
const pendingPair = ref(null)
const dragGhost = ref(null)
let pendingPlayerDrag = null

const queue = ref([])
const queueDragId = ref('')
const queuePulseId = ref('')

const rangeMonths = ref(2)
const customMonthsDraft = ref(6)
const rangeMenuOpen = ref(false)
const customRangeOpen = ref(false)

const scheduleOpen = ref(false)
const scheduleDraftId = ref('')
const scheduleChallengeId = ref('')
const scheduleDate = ref('')
const scheduleTime = ref('18:00')
const scheduleCourtId = ref('')
const scheduleBusy = ref(false)

const conflict = ref(null)

const zoomOpen = ref(false)
const zoomExpanded = ref(false)
const zoomSelectedDateKey = ref('')
const zoomRangeMenuOpen = ref(false)

const ACTIVE_WEIGHT = Object.freeze({
  pending_review: 6,
  live: 5,
  ready: 4,
  scheduled: 3,
  accepted: 2,
  awaiting: 1,
})

function localToday() {
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  return value
}

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localDateFromKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null

  const [year, month, day] = value
    .split('-')
    .map(Number)

  const date = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0,
  )

  return Number.isNaN(date.getTime())
    ? null
    : date
}

function combineLocalDateTime(dateValue, timeValue) {
  const date = localDateFromKey(dateValue)
  const match = /^(\d{2}):(\d{2})$/.exec(String(timeValue || ''))

  if (!date || !match) return null

  date.setHours(
    Number(match[1]),
    Number(match[2]),
    0,
    0,
  )

  return date
}

function formatDay(value) {
  const date =
    value instanceof Date
      ? value
      : localDateFromKey(value)

  if (!date) return ''

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatTime(value) {
  const date = new Date(value || 0)

  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function challengeLadderId(challenge) {
  return (
    challenge?.ladderId ||
    challenge?.ladderConfigSnapshot?.id ||
    ''
  )
}

const ladderChallenges = computed(() =>
  challengeStore.challenges.filter(
    (challenge) =>
      challengeLadderId(challenge) ===
      props.ladder?.id,
  ),
)

const activeChallenges = computed(() =>
  ladderChallenges.value.filter(
    (challenge) =>
      ACTIVE_LADDER_CHALLENGE_STATUSES.includes(
        challenge.status,
      ),
  ),
)

const playerById = computed(
  () =>
    new Map(
      props.players.map((player) => [
        player.id,
        player,
      ]),
    ),
)

function playerFor(id, fallbackName = 'Player') {
  return (
    playerById.value.get(id) || {
      id,
      name: fallbackName,
      imageUrl: '',
    }
  )
}

function challengePlayers(challenge) {
  return {
    challenger: playerFor(
      challenge?.challengerId,
      challenge?.challengerName || 'Player',
    ),
    opponent: playerFor(
      challenge?.defenderId,
      challenge?.defenderName || 'Player',
    ),
  }
}

function pairName(challenger, opponent) {
  return `${challenger?.name || 'Player'} vs ${opponent?.name || 'Player'}`
}

function shortInitials(name) {
  return String(name || 'P')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function challengeForPlayer(playerId) {
  return [...activeChallenges.value]
    .filter((challenge) =>
      [
        challenge.challengerId,
        challenge.defenderId,
      ].includes(playerId),
    )
    .sort(
      (left, right) =>
        (ACTIVE_WEIGHT[right.status] || 0) -
        (ACTIVE_WEIGHT[left.status] || 0),
    )[0] || null
}

function queuedDraftForPlayer(playerId) {
  return (
    queue.value.find((draft) =>
      [
        draft.challengerId,
        draft.opponentId,
      ].includes(playerId),
    ) || null
  )
}

function actualAvailability(player) {
  return getLadderPlayerAvailability({
    player,
    challenges: challengeStore.challenges,
    config: {
      ...props.config,
      maxActiveChallenges: 1,
    },
  })
}

function bulkAvailability(player) {
  const actual = actualAvailability(player)

  if (!actual.available) return actual

  const draft =
    queuedDraftForPlayer(player?.id)

  if (draft) {
    return {
      available: false,
      label: 'Match set',
      reason: 'bulk_queue',
      activeCount: 1,
      limit: 1,
    }
  }

  return actual
}

const selectedPlayer = computed(
  () =>
    playerById.value.get(
      selectedPlayerId.value,
    ) || null,
)

const eligiblePlayers = computed(() => {
  const challenger =
    selectedPlayer.value

  if (!challenger) return []

  return getEligibleLadderOpponents({
    challenger,
    players: props.players,
    challenges: challengeStore.challenges,
    config: {
      ...props.config,
      maxActiveChallenges: 1,
    },
  }).filter(
    (opponent) =>
      !queuedDraftForPlayer(opponent.id),
  )
})

const eligiblePlayerIds = computed(
  () =>
    new Set(
      eligiblePlayers.value.map(
        (player) => player.id,
      ),
    ),
)

const displayPlayers = computed(() => {
  if (!selectedPlayer.value) {
    return props.players
  }

  return props.players.filter(
    (player) =>
      player.id === selectedPlayer.value.id ||
      eligiblePlayerIds.value.has(player.id),
  )
})

function queueStorageKey() {
  return [
    'gorra',
    'bulk-ladder-queue',
    'v1',
    props.config?.clubId || 'club',
    props.ladder?.id || 'ladder',
  ].join(':')
}

function hydrateQueue() {
  queue.value = []

  if (
    typeof window === 'undefined' ||
    !props.ladder?.id
  ) {
    return
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(
        queueStorageKey(),
      ) || '[]',
    )

    if (!Array.isArray(parsed)) return

    queue.value = parsed
      .map((draft) => ({
        id: String(draft?.id || ''),
        challengerId: String(
          draft?.challengerId || '',
        ),
        opponentId: String(
          draft?.opponentId || '',
        ),
        createdAt: String(
          draft?.createdAt || '',
        ),
      }))
      .filter(
        (draft) =>
          draft.id &&
          playerById.value.has(
            draft.challengerId,
          ) &&
          playerById.value.has(
            draft.opponentId,
          ),
      )
  } catch {
    queue.value = []
  }

  pruneQueue()
}

function persistQueue() {
  if (
    typeof window === 'undefined' ||
    !props.ladder?.id
  ) {
    return
  }

  try {
    window.localStorage.setItem(
      queueStorageKey(),
      JSON.stringify(queue.value),
    )
  } catch {
    // Queue persistence is a convenience only.
  }
}

function pruneQueue() {
  const used = new Set()

  queue.value = queue.value.filter(
    (draft) => {
      const challenger =
        playerById.value.get(
          draft.challengerId,
        )

      const opponent =
        playerById.value.get(
          draft.opponentId,
        )

      if (!challenger || !opponent) {
        return false
      }

      const challengerActual =
        actualAvailability(challenger)

      const opponentActual =
        actualAvailability(opponent)

      if (
        !challengerActual.available ||
        !opponentActual.available ||
        used.has(challenger.id) ||
        used.has(opponent.id)
      ) {
        return false
      }

      used.add(challenger.id)
      used.add(opponent.id)

      return true
    },
  )
}

watch(
  () => props.ladder?.id,
  () => {
    selectedPlayerId.value = ''
    pendingPair.value = null
    rangeMenuOpen.value = false
    zoomSelectedDateKey.value = ''
    hydrateQueue()
  },
  {
    immediate: true,
  },
)

watch(
  queue,
  persistQueue,
  {
    deep: true,
  },
)

watch(
  [
    () => props.players,
    () => challengeStore.challenges,
  ],
  () => {
    pruneQueue()
  },
  {
    deep: true,
  },
)

function showConflictFor(player) {
  const draft =
    queuedDraftForPlayer(player.id)

  if (draft) {
    const challenger =
      playerFor(draft.challengerId)

    const opponent =
      playerFor(draft.opponentId)

    conflict.value = {
      kind: 'queue',
      player,
      draft,
      title: 'Player already has a match set',
      message:
        `${pairName(challenger, opponent)} is already waiting to be scheduled.`,
    }

    return
  }

  const challenge =
    challengeForPlayer(player.id)

  if (!challenge) {
    notificationStore.addToast({
      title: 'Not available',
      message:
        'This player cannot be used for another Ladder match right now.',
      type: 'info',
    })

    return
  }

  const {
    challenger,
    opponent,
  } = challengePlayers(challenge)

  conflict.value = {
    kind: 'challenge',
    player,
    challenge,
    title: 'Player already has an active Ladder match',
    message:
      challenge.scheduledAt
        ? `${pairName(challenger, opponent)} is scheduled for ${formatDay(new Date(challenge.scheduledAt))} at ${formatTime(challenge.scheduledAt)}.`
        : `${pairName(challenger, opponent)} must be finished or cancelled before another challenge can be created.`,
  }
}

function resetPlayerDrag() {
  selectedPlayerId.value = ''
  dragGhost.value = null
  pendingPlayerDrag = null

  window.removeEventListener(
    'pointermove',
    movePlayerDrag,
  )
}

function beginPlayerDrag(player, event) {
  if (
    event.button !== 0 &&
    event.pointerType !== 'touch'
  ) {
    return
  }

  const availability =
    bulkAvailability(player)

  if (!availability.available) {
    event.preventDefault()
    showConflictFor(player)
    return
  }

  const row =
    event.currentTarget
      ?.closest('.bulk-player-row')

  const bounds =
    row?.getBoundingClientRect?.()

  pendingPlayerDrag = {
    player,
    originX: event.clientX,
    originY: event.clientY,
    bounds,
    active: false,
  }

  window.addEventListener(
    'pointermove',
    movePlayerDrag,
  )

  window.addEventListener(
    'pointerup',
    endPlayerDrag,
    {
      once: true,
    },
  )
}

function clampPlayerGhostY(clientY) {
  const list =
    playerListElement()

  if (!list) return clientY

  const bounds =
    list.getBoundingClientRect()

  const half =
    Math.max(
      28,
      Number(
        pendingPlayerDrag
          ?.bounds?.height,
      ) / 2 || 30,
    )

  return Math.max(
    bounds.top + half,
    Math.min(
      clientY,
      bounds.bottom - half,
    ),
  )
}

async function movePlayerDrag(event) {
  if (!pendingPlayerDrag) return

  if (!pendingPlayerDrag.active) {
    const distance =
      Math.hypot(
        event.clientX -
          pendingPlayerDrag.originX,
        event.clientY -
          pendingPlayerDrag.originY,
      )

    if (distance < 7) return

    selectedPlayerId.value =
      pendingPlayerDrag.player.id

    await nextTick()

    if (!eligiblePlayers.value.length) {
      notificationStore.addToast({
        title: 'No opponent available',
        message:
          'There is no eligible player in this challenge window right now.',
        type: 'info',
      })

      resetPlayerDrag()
      return
    }

    pendingPlayerDrag.active = true

    const selectedRow =
      playerListElement()
        ?.querySelector(
          '.bulk-player-row--selected',
        )

    const bounds =
      selectedRow
        ?.getBoundingClientRect?.() ||
      pendingPlayerDrag.bounds

    dragGhost.value = {
      player:
        pendingPlayerDrag.player,
      left:
        bounds?.left ||
        event.clientX,
      top:
        clampPlayerGhostY(
          event.clientY,
        ),
      width:
        bounds?.width || 420,
    }

    return
  }

  dragGhost.value = {
    ...dragGhost.value,
    top:
      clampPlayerGhostY(
        event.clientY,
      ),
  }
}

function endPlayerDrag(event) {
  if (!pendingPlayerDrag?.active) {
    resetPlayerDrag()
    return
  }

  const target =
    document
      .elementFromPoint(
        event.clientX,
        event.clientY,
      )
      ?.closest(
        '[data-bulk-player-id]',
      )

  const targetId =
    target?.getAttribute(
      'data-bulk-player-id',
    ) || ''

  if (
    eligiblePlayerIds.value.has(
      targetId,
    )
  ) {
    pendingPair.value = {
      challengerId:
        pendingPlayerDrag.player.id,
      opponentId:
        targetId,
    }

    dragGhost.value = null
    pendingPlayerDrag = null

    window.removeEventListener(
      'pointermove',
      movePlayerDrag,
    )

    return
  }

  resetPlayerDrag()
}

function pairFromDraft(draft) {
  return {
    challenger:
      playerFor(
        draft?.challengerId,
      ),
    opponent:
      playerFor(
        draft?.opponentId,
      ),
  }
}

function newDraftId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
}

function addPendingPairToQueue() {
  if (!pendingPair.value) return

  const challenger =
    playerFor(
      pendingPair.value.challengerId,
    )

  const opponent =
    playerFor(
      pendingPair.value.opponentId,
    )

  const challengerState =
    bulkAvailability(challenger)

  const opponentState =
    bulkAvailability(opponent)

  if (
    !challengerState.available ||
    !opponentState.available
  ) {
    pendingPair.value = null
    selectedPlayerId.value = ''

    showConflictFor(
      !challengerState.available
        ? challenger
        : opponent,
    )

    return
  }

  const draft = {
    id: newDraftId(),
    challengerId:
      challenger.id,
    opponentId:
      opponent.id,
    createdAt:
      new Date().toISOString(),
  }

  queue.value = [
    ...queue.value,
    draft,
  ]

  queuePulseId.value =
    draft.id

  pendingPair.value = null
  selectedPlayerId.value = ''

  window.setTimeout(
    () => {
      if (
        queuePulseId.value ===
        draft.id
      ) {
        queuePulseId.value = ''
      }
    },
    900,
  )
}

function recordMissingFromPair() {
  const player =
    selectedPlayer.value

  pendingPair.value = null
  selectedPlayerId.value = ''

  if (player) {
    emit(
      'record-missing-match',
      player,
    )
  }
}

function removeDraft(draftId) {
  queue.value =
    queue.value.filter(
      (draft) =>
        draft.id !== draftId,
    )

  if (
    scheduleDraftId.value ===
    draftId
  ) {
    closeSchedule()
  }
}

function rangeEndDate() {
  const today =
    localToday()

  return new Date(
    today.getFullYear(),
    today.getMonth() +
      rangeMonths.value,
    0,
    23,
    59,
    59,
    999,
  )
}

const minimumDate = computed(
  () =>
    dateKey(
      localToday(),
    ),
)

const maximumDate = computed(
  () =>
    dateKey(
      rangeEndDate(),
    ),
)

function monthBlock(offset) {
  const today =
    localToday()

  const firstOfMonth =
    new Date(
      today.getFullYear(),
      today.getMonth() +
        offset,
      1,
      12,
    )

  const year =
    firstOfMonth.getFullYear()

  const month =
    firstOfMonth.getMonth()

  const startDay =
    offset === 0
      ? today.getDate()
      : 1

  const firstVisible =
    new Date(
      year,
      month,
      startDay,
      12,
    )

  const lastDay =
    new Date(
      year,
      month + 1,
      0,
      12,
    ).getDate()

  const cells = []

  for (
    let index = 0;
    index <
      firstVisible.getDay();
    index += 1
  ) {
    cells.push({
      blank: true,
      key:
        `blank-${year}-${month}-${index}`,
    })
  }

  for (
    let day = startDay;
    day <= lastDay;
    day += 1
  ) {
    const date =
      new Date(
        year,
        month,
        day,
        12,
      )

    cells.push({
      blank: false,
      key: dateKey(date),
      date,
      day,
      today:
        dateKey(date) ===
        minimumDate.value,
    })
  }

  return {
    key:
      `${year}-${month}`,
    label:
      new Intl.DateTimeFormat(
        undefined,
        {
          month: 'long',
          year: 'numeric',
        },
      ).format(firstOfMonth),
    cells,
  }
}

const calendarMonths = computed(
  () =>
    Array.from(
      {
        length:
          rangeMonths.value,
      },
      (_, index) =>
        monthBlock(index),
    ),
)

const scheduledChallenges = computed(
  () =>
    ladderChallenges.value.filter(
      (challenge) =>
        ['scheduled', 'ready'].includes(
          challenge.status,
        ) &&
        Boolean(
          challenge.scheduledAt,
        ),
    ),
)

function challengeDateKey(challenge) {
  const date =
    new Date(
      challenge?.scheduledAt || 0,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return ''
  }

  return dateKey(date)
}

function scheduledForDate(key) {
  return scheduledChallenges.value
    .filter(
      (challenge) =>
        challengeDateKey(
          challenge,
        ) === key,
    )
    .sort(
      (left, right) =>
        new Date(
          left.scheduledAt,
        ).getTime() -
        new Date(
          right.scheduledAt,
        ).getTime(),
    )
}

function setRangeMonths(value) {
  const next =
    Math.max(
      1,
      Math.min(
        6,
        Number(value) || 1,
      ),
    )

  rangeMonths.value = next
  rangeMenuOpen.value = false
  zoomRangeMenuOpen.value = false

  if (
    scheduleDate.value &&
    scheduleDate.value >
      maximumDate.value
  ) {
    scheduleDate.value =
      maximumDate.value
  }
}

function openCustomRange() {
  customMonthsDraft.value =
    rangeMonths.value

  rangeMenuOpen.value = false
  zoomRangeMenuOpen.value = false
  customRangeOpen.value = true
}

function applyCustomRange() {
  setRangeMonths(
    customMonthsDraft.value,
  )

  customRangeOpen.value = false
}

function openScheduleDraft(
  draft,
  key = '',
) {
  if (!draft) return

  scheduleDraftId.value =
    draft.id

  scheduleChallengeId.value = ''

  scheduleDate.value =
    key || minimumDate.value

  scheduleTime.value =
    nextSafeTime(
      scheduleDate.value,
    )

  scheduleCourtId.value = ''
  scheduleOpen.value = true
}

function openScheduleChallenge(
  challenge,
) {
  if (!challenge) return

  const date =
    new Date(
      challenge.scheduledAt || 0,
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return
  }

  const neededMonths =
    monthDistanceFromToday(
      date,
    ) + 1

  if (
    neededMonths >
      rangeMonths.value &&
    neededMonths <= 6
  ) {
    setRangeMonths(
      neededMonths,
    )
  }

  scheduleDraftId.value = ''
  scheduleChallengeId.value =
    challenge.id

  scheduleDate.value =
    dateKey(date)

  scheduleTime.value =
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  scheduleCourtId.value =
    challenge.court || ''

  scheduleOpen.value = true
}

function monthDistanceFromToday(date) {
  const today =
    localToday()

  return (
    (
      date.getFullYear() -
      today.getFullYear()
    ) *
      12 +
    (
      date.getMonth() -
      today.getMonth()
    )
  )
}

function nextSafeTime(key) {
  if (
    key !==
    minimumDate.value
  ) {
    return '18:00'
  }

  const now =
    new Date()

  const rounded =
    new Date(
      now.getTime() +
        30 * 60 * 1000,
    )

  rounded.setMinutes(
    Math.ceil(
      rounded.getMinutes() / 15,
    ) * 15,
    0,
    0,
  )

  if (
    rounded.getDate() !==
    now.getDate()
  ) {
    return '18:00'
  }

  return `${String(rounded.getHours()).padStart(2, '0')}:${String(rounded.getMinutes()).padStart(2, '0')}`
}

const scheduledDateTime = computed(
  () =>
    combineLocalDateTime(
      scheduleDate.value,
      scheduleTime.value,
    ),
)

const scheduleIsValid = computed(
  () => {
    const value =
      scheduledDateTime.value

    return Boolean(
      value &&
      value.getTime() >
        Date.now() &&
      scheduleDate.value >=
        minimumDate.value &&
      scheduleDate.value <=
        maximumDate.value,
    )
  },
)

const schedulingDraft = computed(
  () =>
    queue.value.find(
      (draft) =>
        draft.id ===
        scheduleDraftId.value,
    ) || null,
)

const schedulingChallenge = computed(
  () =>
    ladderChallenges.value.find(
      (challenge) =>
        challenge.id ===
        scheduleChallengeId.value,
    ) || null,
)

const schedulingPair = computed(
  () => {
    if (schedulingDraft.value) {
      return pairFromDraft(
        schedulingDraft.value,
      )
    }

    if (
      schedulingChallenge.value
    ) {
      return challengePlayers(
        schedulingChallenge.value,
      )
    }

    return {
      challenger: null,
      opponent: null,
    }
  },
)

function closeSchedule() {
  if (scheduleBusy.value) return

  scheduleOpen.value = false
  scheduleDraftId.value = ''
  scheduleChallengeId.value = ''
}

async function saveSchedule() {
  if (
    scheduleBusy.value ||
    !scheduleIsValid.value
  ) {
    return
  }

  scheduleBusy.value = true

  try {
    if (
      schedulingDraft.value
    ) {
      const draft =
        schedulingDraft.value

      const result =
        await challengeStore
          .createAdminLadderMatch({
            ladderId:
              props.ladder.id,
            challengerPlayerId:
              draft.challengerId,
            opponentPlayerId:
              draft.opponentId,
            actorId:
              props.currentPlayerId ||
              '',
            timing:
              'scheduled',
            scheduledAt:
              scheduledDateTime.value
                .toISOString(),
            courtId:
              scheduleCourtId.value ||
              null,
            matchRuleSource:
              'ladder_default',
          })

      if (!result) {
        throw new Error(
          challengeStore.error ||
            'Unable to schedule this Ladder match.',
        )
      }

      removeDraft(
        draft.id,
      )
    } else if (
      schedulingChallenge.value
    ) {
      const result =
        await challengeStore
          .updateAdminLadderMatchSchedule(
            schedulingChallenge.value.id,
            {
              actorId:
                props.currentPlayerId ||
                '',
              scheduledAt:
                scheduledDateTime.value
                  .toISOString(),
              courtId:
                scheduleCourtId.value ||
                null,
            },
          )

      if (!result) {
        throw new Error(
          challengeStore.error ||
            'Unable to update this Ladder match.',
        )
      }
    }

    scheduleOpen.value = false
    scheduleDraftId.value = ''
    scheduleChallengeId.value = ''

    notificationStore.addToast({
      title: 'Ladder match',
      message:
        'Match scheduled.',
      type: 'success',
    })

    await nextTick()

    const key =
      dateKey(
        scheduledDateTime.value ||
          localToday(),
      )

    scrollCalendarToDate(
      key,
    )

    if (
      zoomOpen.value &&
      zoomSelectedDateKey.value
    ) {
      zoomSelectedDateKey.value =
        key
    }
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not schedule match',
      message:
        error?.message ||
        'Check the date and try again.',
      type: 'warning',
    })
  } finally {
    scheduleBusy.value = false
  }
}

async function cancelScheduledChallenge(
  challenge,
) {
  if (
    !challenge?.id ||
    scheduleBusy.value
  ) {
    return
  }

  scheduleBusy.value = true

  try {
    const result =
      await challengeStore
        .cancelAdminLadderMatch(
          challenge.id,
          {
            actorId:
              props.currentPlayerId ||
              '',
          },
        )

    if (!result) {
      throw new Error(
        challengeStore.error ||
          'Unable to cancel this Ladder match.',
      )
    }

    notificationStore.addToast({
      title: 'Schedule cancelled',
      message:
        'The players are available again.',
      type: 'success',
    })
  } catch (error) {
    notificationStore.addToast({
      title: 'Could not cancel match',
      message:
        error?.message ||
        'Try again.',
      type: 'warning',
    })
  } finally {
    scheduleBusy.value = false
  }
}

function startQueueDrag(
  draft,
  event,
) {
  queueDragId.value =
    draft.id

  if (
    event.dataTransfer
  ) {
    event.dataTransfer.effectAllowed =
      'move'

    event.dataTransfer.setData(
      'text/plain',
      draft.id,
    )
  }
}

function stopQueueDrag() {
  queueDragId.value = ''
}

function allowDateDrop(event) {
  if (!queueDragId.value) return

  event.preventDefault()

  if (
    event.dataTransfer
  ) {
    event.dataTransfer.dropEffect =
      'move'
  }
}

function dropQueueOnDate(
  key,
  event,
) {
  if (!queueDragId.value) return

  event.preventDefault()

  const draft =
    queue.value.find(
      (item) =>
        item.id ===
        queueDragId.value,
    )

  queueDragId.value = ''

  if (draft) {
    openScheduleDraft(
      draft,
      key,
    )
  }
}

function autoScrollCalendar(
  event,
  zoom = false,
) {
  if (!queueDragId.value) return

  const pane =
    zoom
      ? zoomCalendarScrollRef.value
      : calendarScrollRef.value

  if (!pane) return

  const bounds =
    pane.getBoundingClientRect()

  const edge = 96

  if (
    event.clientY >
    bounds.bottom - edge
  ) {
    const pressure =
      Math.min(
        1,
        (
          event.clientY -
          (
            bounds.bottom -
            edge
          )
        ) /
          edge,
      )

    pane.scrollTop +=
      6 +
      pressure * 20
  } else if (
    event.clientY <
    bounds.top + edge
  ) {
    const pressure =
      Math.min(
        1,
        (
          (
            bounds.top +
            edge
          ) -
          event.clientY
        ) /
          edge,
      )

    pane.scrollTop -=
      6 +
      pressure * 20
  }
}

function playerListElement() {
  return (
    playerListRef.value?.$el ||
    playerListRef.value ||
    null
  )
}

function scrollCalendarToDate(
  key,
  zoom = false,
) {
  nextTick(() => {
    const root =
      zoom
        ? zoomCalendarScrollRef.value
        : calendarScrollRef.value

    const element =
      root?.querySelector(
        `[data-bulk-date="${key}"]`,
      )

    element?.scrollIntoView({
      behavior:
        window.matchMedia?.(
          '(prefers-reduced-motion: reduce)',
        ).matches
          ? 'auto'
          : 'smooth',
      block: 'center',
    })

    if (element) {
      element.classList.add(
        'bulk-date--pulse',
      )

      window.setTimeout(
        () =>
          element.classList.remove(
            'bulk-date--pulse',
          ),
        1200,
      )
    }
  })
}

function viewConflict() {
  const value =
    conflict.value

  conflict.value = null

  if (!value) return

  if (
    value.kind === 'queue'
  ) {
    queuePulseId.value =
      value.draft.id

    queueRef.value
      ?.scrollIntoView?.({
        behavior: 'smooth',
        block: 'nearest',
      })

    window.setTimeout(
      () => {
        if (
          queuePulseId.value ===
          value.draft.id
        ) {
          queuePulseId.value = ''
        }
      },
      1200,
    )

    return
  }

  const challenge =
    value.challenge

  if (
    challenge?.scheduledAt
  ) {
    const date =
      new Date(
        challenge.scheduledAt,
      )

    const months =
      monthDistanceFromToday(
        date,
      ) + 1

    if (
      months >
        rangeMonths.value &&
      months <= 6
    ) {
      setRangeMonths(
        months,
      )
    }

    const key =
      dateKey(date)

    scrollCalendarToDate(
      key,
    )

    return
  }

  notificationStore.addToast({
    title: 'Active challenge',
    message:
      'This challenge has to be finished or cancelled before another one can be created.',
    type: 'info',
  })
}

function openZoom(
  key = '',
) {
  zoomOpen.value = true
  zoomSelectedDateKey.value =
    key

  if (key) {
    scrollCalendarToDate(
      key,
      true,
    )
  }
}

function closeZoom() {
  zoomOpen.value = false
  zoomExpanded.value = false
  zoomSelectedDateKey.value = ''
  zoomRangeMenuOpen.value = false
}

function openZoomDay(key) {
  zoomSelectedDateKey.value =
    key

  scrollCalendarToDate(
    key,
    true,
  )
}

function closeZoomDay() {
  zoomSelectedDateKey.value = ''
}

function compactPair(draft) {
  const {
    challenger,
    opponent,
  } = pairFromDraft(draft)

  return `${shortInitials(challenger.name)} vs ${shortInitials(opponent.name)}`
}

const zoomDayChallenges = computed(
  () =>
    zoomSelectedDateKey.value
      ? scheduledForDate(
          zoomSelectedDateKey.value,
        )
      : [],
)

function scheduleTitle() {
  const {
    challenger,
    opponent,
  } = schedulingPair.value

  return pairName(
    challenger,
    opponent,
  )
}

function courtLabel(challenge) {
  return (
    challenge?.court ||
    'Court not set'
  )
}

onBeforeUnmount(() => {
  window.removeEventListener(
    'pointermove',
    movePlayerDrag,
  )
})
</script>

<template>
  <main class="bulk-scheduler">
    <section class="bulk-players">
      <header class="bulk-players__head">
        <div>
          <h1>{{ ladder.name }}</h1>
          <p>
            {{ players.length }} players · drag a player onto an eligible opponent
          </p>
        </div>

        <span>Bulk mode</span>
      </header>

      <TransitionGroup
        ref="playerListRef"
        name="bulk-player"
        tag="section"
        class="bulk-player-list"
      >
        <article
          v-for="player in displayPlayers"
          :key="player.id"
          class="bulk-player-row"
          :class="{
            'bulk-player-row--selected':
              selectedPlayer?.id === player.id,
            'bulk-player-row--eligible':
              eligiblePlayerIds.has(player.id),
            'bulk-player-row--blocked':
              !bulkAvailability(player).available &&
              selectedPlayer?.id !== player.id,
          }"
          :data-bulk-player-id="player.id"
          @click="
            !bulkAvailability(player).available &&
            showConflictFor(player)
          "
        >
          <strong class="bulk-player-row__rank">
            #{{ player.rank }}
          </strong>

          <PersonAvatar
            :name="player.name"
            :image="player.imageUrl || player.photoUrl || ''"
            :size="40"
          />

          <span class="bulk-player-row__copy">
            <strong>
              <template
                v-if="eligiblePlayerIds.has(player.id)"
              >
                <small>You can challenge</small>
              </template>
              {{ player.name }}
            </strong>

            <small>
              {{
                player.matches ??
                player.matchesPlayed ??
                0
              }}
              matches
            </small>
          </span>

          <span class="bulk-player-row__state">
            <small
              v-if="selectedPlayer?.id === player.id"
              class="bulk-player-row__challenger"
            >
              Challenger
            </small>

            <small
              v-else-if="eligiblePlayerIds.has(player.id)"
              class="bulk-player-row__drop"
            >
              Drop here
            </small>

            <small
              v-else-if="!bulkAvailability(player).available"
              class="bulk-player-row__blocked-copy"
            >
              {{ bulkAvailability(player).label }}
            </small>

            <button
              v-else
              class="bulk-player-row__drag"
              type="button"
              :aria-label="`Hold and drag ${player.name}`"
              title="Hold and drag"
              @click.stop.prevent
              @pointerdown.stop="
                beginPlayerDrag(
                  player,
                  $event,
                )
              "
            >
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M7.5 10V5.6a1.25 1.25 0 0 1 2.5 0v3.15" />
                <path d="M10 8.75V4.5a1.25 1.25 0 0 1 2.5 0v4.25" />
                <path d="M12.5 8.75V5.9a1.25 1.25 0 0 1 2.5 0v5.1" />
                <path d="M7.5 8.65 6.7 8a1.28 1.28 0 0 0-1.75 1.87l3.4 3.2a3.8 3.8 0 0 0 2.6 1.04h1.5a3.8 3.8 0 0 0 3.8-3.8v-1.56" />
              </svg>
            </button>
          </span>
        </article>
      </TransitionGroup>
    </section>

    <aside class="bulk-calendar">
      <section class="bulk-queue-shell">
        <header class="bulk-queue-head">
          <div>
            <h2>Unscheduled matches</h2>
            <p>
              Drag a tennis ball onto a date, or schedule it manually.
            </p>
          </div>

          <button
            type="button"
            class="bulk-view-calendar"
            @click="openZoom()"
          >
            View calendar
          </button>
        </header>

        <TransitionGroup
          ref="queueRef"
          name="bulk-ball"
          tag="div"
          class="bulk-queue"
        >
          <article
            v-for="draft in queue"
            :key="draft.id"
            class="bulk-queue-item"
            :data-tooltip="pairName(pairFromDraft(draft).challenger, pairFromDraft(draft).opponent)"
            :class="{
              'bulk-queue-item--pulse':
                queuePulseId === draft.id,
            }"
          >
            <button
              class="bulk-queue-remove"
              type="button"
              :aria-label="`Remove ${pairName(pairFromDraft(draft).challenger, pairFromDraft(draft).opponent)}`"
              @click="
                removeDraft(
                  draft.id,
                )
              "
            >
              ×
            </button>

            <div
              class="bulk-tennis-ball"
              draggable="true"
               :data-tooltip="
                pairName(
                  pairFromDraft(draft).challenger,
                  pairFromDraft(draft).opponent,
                )
              "
              @dragstart="
                startQueueDrag(
                  draft,
                  $event,
                )
              "
              @dragend="stopQueueDrag"
            >
              <span>
                {{
                  shortInitials(
                    pairFromDraft(draft).challenger.name,
                  )
                }}
              </span>

              <small>VS</small>

              <span>
                {{
                  shortInitials(
                    pairFromDraft(draft).opponent.name,
                  )
                }}
              </span>
            </div>

            <button
              type="button"
              class="bulk-queue-schedule"
              aria-label="Schedule this match"
              data-tooltip="Schedule match"
              @click="
                openScheduleDraft(
                  draft,
                )
              "
            >
              Schedule
            </button>
          </article>

          <p
            v-if="!queue.length"
            key="empty"
            class="bulk-queue-empty"
          >
            Matches you set up will appear here.
          </p>
        </TransitionGroup>
      </section>

      <section class="bulk-calendar-shell">
        <header class="bulk-calendar-head">
          <strong>
            Next {{ rangeMonths }}
            {{ rangeMonths === 1 ? 'month' : 'months' }}
          </strong>

          <div class="bulk-range">
            <button
              type="button"
              @click.stop="
                rangeMenuOpen =
                  !rangeMenuOpen
              "
            >
              Set time frame
              <span aria-hidden="true">⌄</span>
            </button>

            <Transition name="bulk-menu">
              <div
                v-if="rangeMenuOpen"
                class="bulk-range__menu"
              >
                <button
                  v-for="months in [1, 2, 3]"
                  :key="months"
                  type="button"
                  :class="{
                    active:
                      rangeMonths === months,
                  }"
                  @click="
                    setRangeMonths(
                      months,
                    )
                  "
                >
                  Next {{ months }}
                  {{ months === 1 ? 'month' : 'months' }}
                </button>

                <button
                  type="button"
                  @click="openCustomRange"
                >
                  Custom…
                </button>
              </div>
            </Transition>
          </div>
        </header>

        <div
          ref="calendarScrollRef"
          class="bulk-calendar-scroll"
          @dragover="
            autoScrollCalendar(
              $event,
            )
          "
        >
          <section
            v-for="month in calendarMonths"
            :key="month.key"
            class="bulk-month"
          >
            <h3>{{ month.label }}</h3>

            <div class="bulk-weekdays">
              <span
                v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                :key="day"
              >
                {{ day }}
              </span>
            </div>

            <div class="bulk-days">
              <template
                v-for="cell in month.cells"
                :key="cell.key"
              >
                <span
                  v-if="cell.blank"
                  class="bulk-date bulk-date--blank"
                ></span>

                <button
                  v-else
                  type="button"
                  class="bulk-date"
                  :class="{
                    'bulk-date--today':
                      cell.today,
                  }"
                  :data-bulk-date="cell.key"
                  @dragover="
                    allowDateDrop
                  "
                  @drop="
                    dropQueueOnDate(
                      cell.key,
                      $event,
                    )
                  "
                  @click="
                    openZoom(
                      cell.key,
                    )
                  "
                >
                  <strong>
                    {{ cell.day }}
                  </strong>

                  <small
                    v-if="cell.today"
                  >
                    Today
                  </small>

                  <span
                    v-for="challenge in scheduledForDate(cell.key).slice(0, 2)"
                    :key="challenge.id"
                    class="bulk-date-match"
                    @click.stop="
                      openScheduleChallenge(
                        challenge,
                      )
                    "
                  >
                    <span class="bulk-date-match__avatars">
                      <PersonAvatar
                        :name="challengePlayers(challenge).challenger.name"
                        :image="challengePlayers(challenge).challenger.imageUrl || challengePlayers(challenge).challenger.photoUrl || ''"
                        :size="18"
                      />
                      <PersonAvatar
                        :name="challengePlayers(challenge).opponent.name"
                        :image="challengePlayers(challenge).opponent.imageUrl || challengePlayers(challenge).opponent.photoUrl || ''"
                        :size="18"
                      />
                    </span>

                    <span>
                      {{ formatTime(challenge.scheduledAt) }}
                    </span>

                    <button
                      type="button"
                      aria-label="Cancel scheduled match"
                      @click.stop="
                        cancelScheduledChallenge(
                          challenge,
                        )
                      "
                    >
                      ×
                    </button>
                  </span>

                  <em
                    v-if="scheduledForDate(cell.key).length > 2"
                  >
                    +{{ scheduledForDate(cell.key).length - 2 }} more
                  </em>
                </button>
              </template>
            </div>
          </section>
        </div>
      </section>
    </aside>

    <Teleport to="body">
      <article
        v-if="dragGhost"
        class="bulk-player-ghost"
        :style="{
          left: `${dragGhost.left}px`,
          top: `${dragGhost.top}px`,
          width: `${dragGhost.width}px`,
        }"
      >
        <strong>
          #{{ dragGhost.player.rank }}
        </strong>

        <PersonAvatar
          :name="dragGhost.player.name"
          :image="dragGhost.player.imageUrl || dragGhost.player.photoUrl || ''"
          :size="40"
        />

        <span>
          {{ dragGhost.player.name }}
        </span>
      </article>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="pendingPair"
        class="bulk-modal"
        @click.self="
          pendingPair = null;
          selectedPlayerId = ''
        "
      >
        <section class="bulk-modal__card">
          <button
            type="button"
            class="bulk-modal__close"
            aria-label="Close"
            @click="
              pendingPair = null;
              selectedPlayerId = ''
            "
          >
            ×
          </button>

          <small>Choose an action</small>

          <h2>
            {{
              pairName(
                playerFor(pendingPair.challengerId),
                playerFor(pendingPair.opponentId),
              )
            }}
          </h2>

          <div class="bulk-modal__actions">
            <button
              type="button"
              class="button-primary"
              @click="addPendingPairToQueue"
            >
              Set challenge
            </button>

            <button
              type="button"
              @click="recordMissingFromPair"
            >
              Record missing match
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="conflict"
        class="bulk-modal"
        @click.self="conflict = null"
      >
        <section class="bulk-modal__card">
          <button
            type="button"
            class="bulk-modal__close"
            aria-label="Close"
            @click="conflict = null"
          >
            ×
          </button>

          <small>Already in use</small>

          <h2>{{ conflict.title }}</h2>

          <p>{{ conflict.message }}</p>

          <div class="bulk-modal__actions">
            <button
              type="button"
              class="button-primary"
              @click="viewConflict"
            >
              View match
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="scheduleOpen"
        class="bulk-modal"
        @click.self="closeSchedule"
      >
        <section class="bulk-modal__card bulk-schedule-card">
          <button
            type="button"
            class="bulk-modal__close"
            aria-label="Close"
            :disabled="scheduleBusy"
            @click="closeSchedule"
          >
            ×
          </button>

          <small>
            {{
              scheduleChallengeId
                ? 'Edit schedule'
                : 'Schedule match'
            }}
          </small>

          <h2>{{ scheduleTitle() }}</h2>

          <p>
            Choose a future date, time and court.
          </p>

          <div class="bulk-schedule-form">
            <label>
              <span>Date</span>
              <input
                v-model="scheduleDate"
                type="date"
                :min="minimumDate"
                :max="maximumDate"
              />
            </label>

            <label>
              <span>Time</span>
              <input
                v-model="scheduleTime"
                type="time"
              />
            </label>

            <label>
              <span>Court</span>
              <select
                v-model="scheduleCourtId"
              >
                <option value="">
                  No court selected
                </option>

                <option
                  v-for="court in courts"
                  :key="court.id || court.name || court"
                  :value="court.id || court.name || court"
                >
                  {{ court.name || court.label || court }}
                </option>
              </select>
            </label>
          </div>

          <p
            v-if="
              scheduleDate &&
              scheduleTime &&
              !scheduleIsValid
            "
            class="bulk-schedule-warning"
          >
            Choose a future time inside this calendar range.
          </p>

          <div class="bulk-modal__actions">
            <button
              type="button"
              class="button-primary"
              :disabled="
                !scheduleIsValid ||
                scheduleBusy
              "
              @click="saveSchedule"
            >
              {{
                scheduleBusy
                  ? 'Saving…'
                  : scheduleChallengeId
                    ? 'Save changes'
                    : 'Schedule match'
              }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="customRangeOpen"
        class="bulk-modal"
        @click.self="customRangeOpen = false"
      >
        <section class="bulk-modal__card">
          <button
            type="button"
            class="bulk-modal__close"
            aria-label="Close"
            @click="customRangeOpen = false"
          >
            ×
          </button>

          <small>Calendar range</small>
          <h2>Set time frame</h2>

          <p>
            Bulk scheduling can show up to six months.
          </p>

          <div class="bulk-schedule-form">
            <label>
              <span>Months</span>
              <input
                v-model.number="customMonthsDraft"
                type="number"
                min="1"
                max="6"
              />
            </label>
          </div>

          <div class="bulk-modal__actions">
            <button
              type="button"
              class="button-primary"
              @click="applyCustomRange"
            >
              Show calendar
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="zoomOpen"
        class="bulk-zoom"
        @click.self="closeZoom"
      >
        <section
          class="bulk-zoom__card"
          :class="{
            'bulk-zoom__card--detail':
              zoomSelectedDateKey,
            'bulk-zoom__card--expanded':
              zoomExpanded,
          }"
        >
          <header class="bulk-zoom__head">
            <div>
              <small>Bulk scheduling</small>
              <h2>View calendar</h2>
              <p>
                Next {{ rangeMonths }}
                {{ rangeMonths === 1 ? 'month' : 'months' }}
              </p>
            </div>

            <div>
              <button
                type="button"
                @click="
                  zoomExpanded =
                    !zoomExpanded
                "
              >
                {{
                  zoomExpanded
                    ? 'Reduce'
                    : 'Expand'
                }}
              </button>

              <button
                type="button"
                aria-label="Close calendar"
                @click="closeZoom"
              >
                ×
              </button>
            </div>
          </header>

          <div class="bulk-zoom__body">
            <section class="bulk-zoom-pane bulk-zoom-queue">
              <header>
                <strong>Unscheduled matches</strong>
                <small>
                  Drag a match onto a date.
                </small>
              </header>

              <div class="bulk-zoom-queue__scroll">
                <article
                  v-for="draft in queue"
                  :key="draft.id"
                  class="bulk-zoom-queue__item"
                  :class="{
                    compact:
                      zoomSelectedDateKey,
                  }"
                  draggable="true"
                   :data-tooltip="
                    pairName(
                      pairFromDraft(draft).challenger,
                      pairFromDraft(draft).opponent,
                    )
                  "
                  @dragstart="
                    startQueueDrag(
                      draft,
                      $event,
                    )
                  "
                  @dragend="stopQueueDrag"
                >
                  <span class="bulk-avatar-stack">
                    <PersonAvatar
                      :name="pairFromDraft(draft).challenger.name"
                      :image="pairFromDraft(draft).challenger.imageUrl || pairFromDraft(draft).challenger.photoUrl || ''"
                      :size="30"
                    />
                    <PersonAvatar
                      :name="pairFromDraft(draft).opponent.name"
                      :image="pairFromDraft(draft).opponent.imageUrl || pairFromDraft(draft).opponent.photoUrl || ''"
                      :size="30"
                    />
                  </span>

                  <span class="bulk-zoom-queue__copy">
                    <strong>
                      {{
                        pairName(
                          pairFromDraft(draft).challenger,
                          pairFromDraft(draft).opponent,
                        )
                      }}
                    </strong>
                    <small>Waiting for a date</small>
                  </span>

                  <span class="bulk-zoom-queue__short">
                    {{ compactPair(draft) }}
                  </span>

                  <button
                    type="button"
                    aria-label="Remove match"
                    @click.stop="
                      removeDraft(
                        draft.id,
                      )
                    "
                  >
                    ×
                  </button>
                </article>

                <p
                  v-if="!queue.length"
                  class="bulk-zoom-empty"
                >
                  No matches are waiting for a date.
                </p>
              </div>
            </section>

            <section class="bulk-zoom-pane bulk-zoom-calendar">
              <header>
                <div>
                  <strong>
                    Next {{ rangeMonths }}
                    {{ rangeMonths === 1 ? 'month' : 'months' }}
                  </strong>
                  <small>
                    Click a day to see its matches.
                  </small>
                </div>

                <div class="bulk-range">
                  <button
                    type="button"
                    @click.stop="
                      zoomRangeMenuOpen =
                        !zoomRangeMenuOpen
                    "
                  >
                    Set time frame
                    <span aria-hidden="true">⌄</span>
                  </button>

                  <Transition name="bulk-menu">
                    <div
                      v-if="zoomRangeMenuOpen"
                      class="bulk-range__menu"
                    >
                      <button
                        v-for="months in [1, 2, 3]"
                        :key="months"
                        type="button"
                        :class="{
                          active:
                            rangeMonths === months,
                        }"
                        @click="
                          setRangeMonths(
                            months,
                          )
                        "
                      >
                        Next {{ months }}
                        {{ months === 1 ? 'month' : 'months' }}
                      </button>

                      <button
                        type="button"
                        @click="openCustomRange"
                      >
                        Custom…
                      </button>
                    </div>
                  </Transition>
                </div>
              </header>

              <div
                ref="zoomCalendarScrollRef"
                class="bulk-zoom-calendar__scroll"
                @dragover="
                  autoScrollCalendar(
                    $event,
                    true,
                  )
                "
              >
                <section
                  v-for="month in calendarMonths"
                  :key="month.key"
                  class="bulk-month"
                >
                  <h3>{{ month.label }}</h3>

                  <div class="bulk-weekdays">
                    <span
                      v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                      :key="day"
                    >
                      {{ day }}
                    </span>
                  </div>

                  <div class="bulk-days">
                    <template
                      v-for="cell in month.cells"
                      :key="cell.key"
                    >
                      <span
                        v-if="cell.blank"
                        class="bulk-date bulk-date--blank"
                      ></span>

                      <button
                        v-else
                        type="button"
                        class="bulk-date"
                        :class="{
                          'bulk-date--today':
                            cell.today,
                          'bulk-date--selected':
                            zoomSelectedDateKey === cell.key,
                        }"
                        :data-bulk-date="cell.key"
                        @dragover="allowDateDrop"
                        @drop="
                          dropQueueOnDate(
                            cell.key,
                            $event,
                          )
                        "
                        @click="
                          openZoomDay(
                            cell.key,
                          )
                        "
                      >
                        <strong>
                          {{ cell.day }}
                        </strong>

                        <small
                          v-if="cell.today"
                        >
                          Today
                        </small>

                        <span
                          v-for="challenge in scheduledForDate(cell.key).slice(0, 2)"
                          :key="challenge.id"
                          class="bulk-date-match"
                          @click.stop="
                            openScheduleChallenge(
                              challenge,
                            )
                          "
                        >
                          <span class="bulk-date-match__avatars">
                            <PersonAvatar
                              :name="challengePlayers(challenge).challenger.name"
                              :image="challengePlayers(challenge).challenger.imageUrl || challengePlayers(challenge).challenger.photoUrl || ''"
                              :size="18"
                            />
                            <PersonAvatar
                              :name="challengePlayers(challenge).opponent.name"
                              :image="challengePlayers(challenge).opponent.imageUrl || challengePlayers(challenge).opponent.photoUrl || ''"
                              :size="18"
                            />
                          </span>

                          <span>
                            {{ formatTime(challenge.scheduledAt) }}
                          </span>
                        </span>
                      </button>
                    </template>
                  </div>
                </section>
              </div>
            </section>

            <section
              v-if="zoomSelectedDateKey"
              class="bulk-zoom-pane bulk-zoom-detail"
            >
              <header>
                <div>
                  <strong>
                    {{ formatDay(zoomSelectedDateKey) }}
                  </strong>
                  <small>
                    {{ zoomDayChallenges.length }}
                    {{
                      zoomDayChallenges.length === 1
                        ? 'match'
                        : 'matches'
                    }}
                  </small>
                </div>

                <button
                  type="button"
                  aria-label="Close day"
                  @click="closeZoomDay"
                >
                  ×
                </button>
              </header>

              <div class="bulk-zoom-detail__scroll">
                <article
                  v-for="challenge in zoomDayChallenges"
                  :key="challenge.id"
                  class="bulk-day-row"
                  @click="
                    openScheduleChallenge(
                      challenge,
                    )
                  "
                >
                  <span class="bulk-avatar-stack">
                    <PersonAvatar
                      :name="challengePlayers(challenge).challenger.name"
                      :image="challengePlayers(challenge).challenger.imageUrl || challengePlayers(challenge).challenger.photoUrl || ''"
                      :size="32"
                    />

                    <PersonAvatar
                      :name="challengePlayers(challenge).opponent.name"
                      :image="challengePlayers(challenge).opponent.imageUrl || challengePlayers(challenge).opponent.photoUrl || ''"
                      :size="32"
                    />
                  </span>

                  <span>
                    <strong>
                      {{
                        pairName(
                          challengePlayers(challenge).challenger,
                          challengePlayers(challenge).opponent,
                        )
                      }}
                    </strong>

                    <small>
                      {{ courtLabel(challenge) }}
                    </small>
                  </span>

                  <b>
                    {{ formatTime(challenge.scheduledAt) }}
                  </b>

                  <button
                    type="button"
                    aria-label="Cancel scheduled match"
                    @click.stop="
                      cancelScheduledChallenge(
                        challenge,
                      )
                    "
                  >
                    ×
                  </button>
                </article>

                <p
                  v-if="!zoomDayChallenges.length"
                  class="bulk-zoom-empty"
                >
                  No matches are scheduled for this day.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.bulk-scheduler {
  display: grid;
  min-width: 0;
  min-height: calc(
    100dvh -
    var(--app-header-height)
  );
  grid-template-columns:
    minmax(0, 1fr)
    390px;
  background:
    var(--color-bg);
}

.bulk-players {
  min-width: 0;
  min-height: 0;
  padding: 0 30px 46px;
}

.bulk-players__head {
  position: sticky;
  top: 0;
  z-index: 8;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  margin: 0 -30px 14px;
  padding: 24px 30px 14px;
  border-bottom: 1px solid
    color-mix(
      in srgb,
      var(--color-border) 72%,
      transparent
    );
  background:
    color-mix(
      in srgb,
      var(--color-bg) 96%,
      transparent
    );
  backdrop-filter: blur(10px);
}

.bulk-players__head h1,
.bulk-players__head p {
  margin: 0;
}

.bulk-players__head h1 {
  color: var(--color-text);
  font-size: 23px;
  font-weight:
    var(--font-weight-bold);
  letter-spacing: -0.02em;
}

.bulk-players__head p {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 11px;
}

.bulk-players__head > span {
  color: var(--color-muted);
  font-size: 10px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-player-list {
  position: relative;
  display: grid;
  gap: 8px;
  max-height: calc(
    100dvh -
    var(--app-header-height) -
    104px
  );
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.bulk-player-row {
  display: grid;
  min-height: 65px;
  grid-template-columns:
    42px
    40px
    minmax(0, 1fr)
    auto;
  align-items: center;
  gap: 11px;
  padding: 10px 14px 10px 18px;
  border: 1px solid
    var(--color-border);
  border-radius:
    var(--app-card-radius);
  background:
    var(--color-surface);
  color: var(--color-text);
  transition:
    border-color
      var(--motion-fast)
      var(--motion-curve),
    background
      var(--motion-fast)
      var(--motion-curve),
    transform
      var(--motion-medium)
      var(--motion-curve);
}

.bulk-player-row:hover {
  border-color:
    var(--color-border-strong);
}

.bulk-player-row--selected {
  border-color:
    #163d2b;
  background:
    #163d2b;
  color: #fff;
}

.bulk-player-row--eligible {
  border-color:
    color-mix(
      in srgb,
      var(--color-primary) 25%,
      var(--color-border)
    );
}

.bulk-player-row--blocked {
  background:
    color-mix(
      in srgb,
      var(--color-text) 1.7%,
      white
    );
}

.bulk-player-row__rank {
  color:
    var(--color-text-soft);
  font-size: 12px;
}

.bulk-player-row--selected
  .bulk-player-row__rank {
  color: #dce8df;
}

.bulk-player-row__copy {
  display: grid;
  min-width: 0;
}

.bulk-player-row__copy > strong {
  overflow: hidden;
  color: inherit;
  font-size: 12px;
  font-weight:
    var(--font-weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bulk-player-row__copy > strong small {
  margin-right: 5px;
  color:
    var(--color-primary-strong);
  font-size: 9.5px;
  font-weight:
    var(--font-weight-bold);
}

.bulk-player-row__copy > small {
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 9.5px;
}

.bulk-player-row--selected
  .bulk-player-row__copy > small {
  color: #dce8df;
}

.bulk-player-row__state {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.bulk-player-row__drag {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: #edf5ee;
  color: #387247;
}

.bulk-player-row__drag:hover {
  background: #dff0e2;
}

.bulk-player-row__drag svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bulk-player-row__challenger,
.bulk-player-row__drop,
.bulk-player-row__blocked-copy {
  font-size: 9px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-player-row__challenger {
  color: #d8ff47;
}

.bulk-player-row__drop {
  color:
    var(--color-primary-strong);
}

.bulk-player-row__blocked-copy {
  color: var(--color-muted);
}

.bulk-calendar {
  display: flex;
  height: calc(
    100dvh -
    var(--app-header-height)
  );
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-left: 1px solid
    var(--color-border);
  background:
    var(--color-surface);
}

.bulk-queue-shell {
  flex: 0 0 auto;
  padding: 18px 20px 14px;
  border-bottom: 1px solid
    var(--color-border);
}

.bulk-queue-head,
.bulk-calendar-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.bulk-queue-head h2,
.bulk-queue-head p {
  margin: 0;
}

.bulk-queue-head h2 {
  font-size: 11px;
  font-weight:
    var(--font-weight-bold);
}

.bulk-queue-head p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 9.5px;
  line-height: 1.45;
}

.bulk-view-calendar {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid
    var(--color-border);
  border-radius:
    var(--app-control-radius, 9px);
  background: #fff;
  color:
    var(--color-primary-strong);
  font-size: 9px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-view-calendar:hover {
  border-color:
    var(--color-border-strong);
  background:
    var(--color-surface-soft);
}

.bulk-queue {
  display: flex;
  min-height: 92px;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
  padding: 10px 12px;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid
    color-mix(
      in srgb,
      var(--color-primary) 16%,
      var(--color-border)
    );
  border-radius: 18px;
  background:
    linear-gradient(
      180deg,
      #fcfffc,
      #f2faf3
    );
  overscroll-behavior-x: contain;
}

.bulk-queue-empty {
  width: 100%;
  margin: 0;
  color: var(--color-muted);
  font-size: 9px;
  text-align: center;
}

.bulk-queue-item {
  position: relative;
  display: grid;
  flex: 0 0 74px;
  justify-items: center;
  gap: 5px;
}

.bulk-queue-item--pulse {
  animation:
    bulkQueuePulse
    700ms
    var(--motion-curve)
    1;
}

.bulk-queue-remove {
  position: absolute;
  top: -4px;
  right: 0;
  z-index: 4;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  padding: 0;
  border: 1px solid
    var(--color-border);
  border-radius: 50%;
  background: #fff;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1;
  box-shadow:
    0 2px 7px
    rgba(25, 45, 31, 0.09);
}

.bulk-queue-remove:hover {
  color: #9a514c;
}

.bulk-tennis-ball {
  position: relative;
  display: grid;
  width: 66px;
  height: 66px;
  grid-template-columns:
    1fr auto 1fr;
  place-items: center;
  border-radius: 50%;
  background:
    radial-gradient(
      circle at 35% 30%,
      #d9ff56 0,
      #aeda22 42%,
      #83be14 100%
    );
  color: #15361f;
  box-shadow:
    inset -7px -9px 12px
      rgba(60, 105, 0, 0.12),
    inset 6px 6px 10px
      rgba(255, 255, 255, 0.18),
    0 7px 16px
      rgba(52, 95, 15, 0.18);
  cursor: grab;
  user-select: none;
}

.bulk-tennis-ball::before,
.bulk-tennis-ball::after {
  position: absolute;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  content: '';
  pointer-events: none;
}

.bulk-tennis-ball::before {
  top: 5px;
  left: -28px;
  border-right: 3px solid
    rgba(255, 255, 255, 0.88);
}

.bulk-tennis-ball::after {
  right: -28px;
  bottom: 5px;
  border-left: 3px solid
    rgba(255, 255, 255, 0.88);
}

.bulk-tennis-ball > span {
  position: relative;
  z-index: 2;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background:
    rgba(255, 255, 255, 0.95);
  color:
    var(--color-primary-strong);
  font-size: 7px;
  font-weight:
    var(--font-weight-bold);
}

.bulk-tennis-ball > small {
  position: relative;
  z-index: 2;
  font-size: 6px;
  font-weight:
    var(--font-weight-bold);
}

.bulk-queue-schedule {
  display: inline-flex;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: 4px 9px;
  border: 0;
  border-radius: 7px;
  background: #fff;
  color:
    var(--color-primary-strong);
  font-size: 8px;
  font-weight:
    var(--font-weight-bold);
  box-shadow:
    0 1px 6px
    rgba(20, 45, 28, 0.07);
}

.bulk-calendar-shell {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.bulk-calendar-head {
  position: relative;
  z-index: 7;
  flex: 0 0 auto;
  align-items: center;
  padding: 13px 20px 9px;
  background:
    color-mix(
      in srgb,
      var(--color-surface) 96%,
      transparent
    );
  backdrop-filter: blur(8px);
}

.bulk-calendar-head > strong {
  font-size: 11px;
}

.bulk-range {
  position: relative;
}

.bulk-range > button {
  display: inline-flex;
  min-height: 31px;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border: 1px solid
    var(--color-border);
  border-radius: 8px;
  background: #fff;
  color:
    var(--color-text-soft);
  font-size: 8.8px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-range__menu {
  position: absolute;
  top: calc(100% + 5px);
  right: 0;
  z-index: 30;
  display: grid;
  width: 154px;
  padding: 5px;
  border: 1px solid
    var(--color-border);
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 14px 34px
    rgba(25, 45, 31, 0.13);
}

.bulk-range__menu button {
  min-height: 34px;
  padding: 0 9px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color:
    var(--color-text-soft);
  font-size: 9px;
  font-weight:
    var(--font-weight-medium);
  text-align: left;
}

.bulk-range__menu button:hover,
.bulk-range__menu button.active {
  background:
    var(--color-surface-soft);
  color:
    var(--color-primary-strong);
}

.bulk-calendar-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 20px 24px;
  scroll-behavior: smooth;
}

.bulk-month {
  margin-top: 6px;
  padding: 10px;
  border: 1px solid
    var(--color-border);
  border-radius: 11px;
  background: #fff;
}

.bulk-month + .bulk-month {
  margin-top: 14px;
}

.bulk-month h3 {
  margin: 0 0 8px;
  font-size: 11px;
}

.bulk-weekdays,
.bulk-days {
  display: grid;
  grid-template-columns:
    repeat(
      7,
      minmax(0, 1fr)
    );
  gap: 5px;
}

.bulk-weekdays span {
  padding: 0 2px 3px;
  color: var(--color-muted);
  font-size: 7.5px;
  font-weight:
    var(--font-weight-bold);
  text-align: center;
  text-transform: uppercase;
}

.bulk-date {
  position: relative;
  min-height: 76px;
  padding: 6px 5px;
  border: 1px solid
    var(--color-border);
  border-radius: 8px;
  background: #fff;
  color: var(--color-text);
  text-align: left;
  transition:
    border-color
      var(--motion-fast)
      var(--motion-curve),
    background
      var(--motion-fast)
      var(--motion-curve),
    transform
      var(--motion-fast)
      var(--motion-curve);
}

.bulk-date:not(.bulk-date--blank):hover {
  border-color:
    var(--color-border-strong);
}

.bulk-date--blank {
  border-color: transparent;
  background: transparent;
  pointer-events: none;
}

.bulk-date--today {
  border-color:
    color-mix(
      in srgb,
      var(--color-primary) 18%,
      var(--color-border)
    );
  background:
    color-mix(
      in srgb,
      var(--color-primary) 7.5%,
      white
    );
}

.bulk-date--selected {
  border-color:
    var(--color-primary);
  box-shadow:
    0 0 0 2px
    color-mix(
      in srgb,
      var(--color-primary) 8%,
      transparent
    );
}

.bulk-date > strong {
  display: block;
  font-size: 11px;
}

.bulk-date > small {
  display: block;
  margin-top: 1px;
  color:
    var(--color-primary-strong);
  font-size: 7px;
  font-weight:
    var(--font-weight-bold);
  text-transform: uppercase;
}

.bulk-date > em {
  display: block;
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 7px;
  font-style: normal;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-date-match {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
  padding: 4px 18px 4px 4px;
  border-radius: 6px;
  background:
    var(--color-surface-soft);
  color:
    var(--color-primary-strong);
  font-size: 7px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-date-match__avatars {
  display: flex;
  align-items: center;
}

.bulk-date-match__avatars > * + * {
  margin-left: -6px;
}

.bulk-date-match > button {
  position: absolute;
  top: 3px;
  right: 3px;
  display: grid;
  width: 14px;
  height: 14px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background:
    rgba(255, 255, 255, 0.88);
  color: var(--color-muted);
  font-size: 9px;
}

.bulk-player-ghost {
  position: fixed;
  z-index: 10040;
  display: grid;
  min-height: 65px;
  grid-template-columns:
    42px
    40px
    minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  padding: 10px 14px 10px 18px;
  border: 1px solid
    color-mix(
      in srgb,
      var(--color-primary) 38%,
      var(--color-border)
    );
  border-radius:
    var(--app-card-radius);
  background:
    var(--color-surface);
  box-shadow:
    0 18px 40px
    rgba(20, 38, 25, 0.18);
  color: var(--color-text);
  font-size: 12px;
  font-weight:
    var(--font-weight-semibold);
  pointer-events: none;
  transform: translateY(-50%);
}

.bulk-player-ghost > strong {
  color:
    var(--color-primary-strong);
}

.bulk-modal {
  position: fixed;
  inset: 0;
  z-index: 10100;
  display: grid;
  place-items: center;
  padding: 20px;
  background:
    rgba(17, 28, 20, 0.32);
}

.bulk-modal__card {
  position: relative;
  width: min(360px, 100%);
  padding: 42px 20px 20px;
  border-radius: 14px;
  background: #fff;
  box-shadow:
    0 24px 60px
    rgba(0, 0, 0, 0.2);
  text-align: center;
}

.bulk-modal__card > small {
  color: var(--color-muted);
  font-size: 9px;
  font-weight:
    var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bulk-modal__card h2,
.bulk-modal__card p {
  margin: 0;
}

.bulk-modal__card h2 {
  margin-top: 7px;
  font-size: 16px;
}

.bulk-modal__card p {
  margin-top: 7px;
  color: var(--color-muted);
  font-size: 10px;
  line-height: 1.5;
}

.bulk-modal__close {
  position: absolute;
  top: 11px;
  right: 11px;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background:
    var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 18px;
}

.bulk-modal__actions {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}

.bulk-modal__actions button {
  min-height: 40px;
  border: 1px solid
    var(--color-border);
  border-radius:
    var(--app-control-radius, 9px);
  background: #fff;
  color: var(--color-text);
  font-size: 11px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-modal__actions
  .button-primary {
  border-color:
    var(--color-primary);
  background:
    var(--color-primary);
  color: #fff;
}

.bulk-schedule-card {
  width: min(390px, 100%);
}

.bulk-schedule-form {
  display: grid;
  gap: 11px;
  margin-top: 18px;
  text-align: left;
}

.bulk-schedule-form label {
  display: grid;
  gap: 5px;
}

.bulk-schedule-form label > span {
  color:
    var(--color-text-soft);
  font-size: 9.5px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-schedule-form input,
.bulk-schedule-form select {
  width: 100%;
  min-height: 42px;
  padding: 0 11px;
  border: 1px solid
    var(--color-border);
  border-radius:
    var(--app-control-radius, 9px);
  background: #fff;
  color: var(--color-text);
  font: inherit;
  font-size: 12px;
}

.bulk-schedule-warning {
  color: #9a514c !important;
}

.bulk-zoom {
  position: fixed;
  top:
    var(--app-header-height);
  right: 0;
  bottom: 0;
  left:
    var(--app-sidebar-width);
  z-index: 10080;
  display: grid;
  place-items: center;
  padding: 16px;
  background:
    rgba(24, 36, 27, 0.25);
  backdrop-filter: blur(3px);
}

.bulk-zoom__card {
  display: flex;
  width:
    min(
      1160px,
      calc(100% - 10px)
    );
  height:
    min(
      86dvh,
      840px
    );
  min-height: 520px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid
    var(--color-border);
  border-radius: 16px;
  background: #fff;
  box-shadow:
    0 28px 80px
    rgba(24, 42, 29, 0.2);
  transition:
    width
      var(--motion-medium)
      var(--motion-curve),
    height
      var(--motion-medium)
      var(--motion-curve);
}

.bulk-zoom__card--detail {
  width:
    min(
      1260px,
      calc(100% - 4px)
    );
}

.bulk-zoom__card--expanded {
  width:
    min(
      1420px,
      calc(100% - 2px)
    );
  height:
    calc(
      100dvh -
      var(--app-header-height) -
      24px
    );
}

.bulk-zoom__head {
  display: flex;
  flex: 0 0 auto;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px 13px;
  border-bottom: 1px solid
    var(--color-border);
}

.bulk-zoom__head h2,
.bulk-zoom__head p {
  margin: 0;
}

.bulk-zoom__head small {
  color:
    var(--color-primary-strong);
  font-size: 8px;
  font-weight:
    var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bulk-zoom__head h2 {
  margin-top: 3px;
  font-size: 17px;
}

.bulk-zoom__head p {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 9px;
}

.bulk-zoom__head > div:last-child {
  display: flex;
  gap: 7px;
}

.bulk-zoom__head button {
  min-height: 33px;
  padding: 0 10px;
  border: 1px solid
    var(--color-border);
  border-radius: 9px;
  background: #fff;
  color:
    var(--color-text-soft);
  font-size: 8.5px;
  font-weight:
    var(--font-weight-semibold);
}

.bulk-zoom__head button:last-child {
  width: 33px;
  padding: 0;
  border: 0;
  background: #f0f2f0;
  font-size: 18px;
}

.bulk-zoom__body {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  grid-template-columns:
    310px
    minmax(0, 1fr);
  overflow: hidden;
  transition:
    grid-template-columns
      var(--motion-medium)
      var(--motion-curve);
}

.bulk-zoom__card--detail
  .bulk-zoom__body {
  grid-template-columns:
    210px
    minmax(0, 1fr)
    310px;
}

.bulk-zoom__card--expanded.bulk-zoom__card--detail
  .bulk-zoom__body {
  grid-template-columns:
    260px
    minmax(0, 1fr)
    360px;
}

.bulk-zoom-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #fff;
}

.bulk-zoom-pane + .bulk-zoom-pane {
  border-left: 1px solid
    var(--color-border);
}

.bulk-zoom-pane > header {
  display: flex;
  min-height: 63px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid
    var(--color-border);
}

.bulk-zoom-pane > header strong {
  display: block;
  font-size: 10px;
}

.bulk-zoom-pane > header small {
  display: block;
  margin-top: 2px;
  color: var(--color-muted);
  font-size: 8px;
}

.bulk-zoom-queue {
  display: flex;
  flex-direction: column;
}

.bulk-zoom-queue__scroll,
.bulk-zoom-detail__scroll {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px;
}

.bulk-zoom-queue__item {
  position: relative;
  display: grid;
  min-height: 62px;
  grid-template-columns:
    auto
    minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 9px 30px 9px 9px;
  border: 1px solid
    var(--color-border);
  border-radius: 10px;
  background: #fbfcfb;
  cursor: grab;
}

.bulk-zoom-queue__item
  > button {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: #f0f2f0;
  color: var(--color-muted);
}

.bulk-zoom-queue__copy {
  display: grid;
  min-width: 0;
}

.bulk-zoom-queue__copy strong {
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bulk-zoom-queue__copy small {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 7.5px;
}

.bulk-zoom-queue__short {
  display: none;
  color:
    var(--color-primary-strong);
  font-size: 7px;
  font-weight:
    var(--font-weight-bold);
}

.bulk-zoom__card--detail
  .bulk-zoom-queue__item {
  grid-template-columns: 1fr;
  justify-items: center;
  min-height: 60px;
  padding: 8px 27px 8px 8px;
}

.bulk-zoom__card--detail
  .bulk-zoom-queue__copy {
  display: none;
}

.bulk-zoom__card--detail
  .bulk-zoom-queue__short {
  display: block;
}

.bulk-avatar-stack {
  display: flex;
  align-items: center;
}

.bulk-avatar-stack > * + * {
  margin-left: -7px;
}

.bulk-zoom-calendar {
  display: flex;
  flex-direction: column;
}

.bulk-zoom-calendar__scroll {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px;
  scroll-behavior: smooth;
}

.bulk-zoom-calendar__scroll
  .bulk-month {
  margin-top: 0;
}

.bulk-zoom-detail {
  display: flex;
  flex-direction: column;
}

.bulk-zoom-detail
  > header
  > button {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: #f0f2f0;
  color: var(--color-muted);
  font-size: 15px;
}

.bulk-day-row {
  position: relative;
  display: grid;
  min-height: 68px;
  grid-template-columns:
    auto
    minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 10px 35px 10px 10px;
  border: 1px solid
    var(--color-border);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}

.bulk-day-row:hover {
  border-color:
    var(--color-border-strong);
  background: #fbfcfb;
}

.bulk-day-row > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.bulk-day-row > span:nth-child(2)
  strong {
  overflow: hidden;
  font-size: 9.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bulk-day-row > span:nth-child(2)
  small {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 7.5px;
}

.bulk-day-row > b {
  grid-column: 2;
  color:
    var(--color-primary-strong);
  font-size: 8px;
}

.bulk-day-row > button {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: #f0f2f0;
  color: var(--color-muted);
  font-size: 12px;
}

.bulk-zoom-empty {
  display: grid;
  min-height: 64px;
  place-items: center;
  margin: 0;
  border: 1px dashed
    var(--color-border-strong);
  border-radius: 9px;
  color: var(--color-muted);
  font-size: 8.5px;
  text-align: center;
}

.bulk-player-move,
.bulk-player-enter-active {
  transition:
    transform 340ms
      cubic-bezier(.22, 1, .36, 1),
    opacity 180ms ease;
}

.bulk-player-enter-from,
.bulk-player-leave-to {
  opacity: 0;
  transform: translateY(2px);
}

.bulk-player-leave-active {
  position: absolute;
  right: 0;
  left: 0;
  pointer-events: none;
  transition:
    opacity 120ms ease-out;
}

.bulk-ball-enter-active {
  animation:
    bulkBallIn
    460ms
    cubic-bezier(.22, 1, .36, 1);
}

.bulk-ball-leave-active {
  transition:
    opacity
      var(--motion-fast)
      ease,
    transform
      var(--motion-fast)
      var(--motion-curve);
}

.bulk-ball-leave-to {
  opacity: 0;
  transform: scale(0.72);
}

.bulk-menu-enter-active,
.bulk-menu-leave-active {
  transition:
    opacity
      var(--motion-fast)
      ease,
    transform
      var(--motion-fast)
      var(--motion-curve);
}

.bulk-menu-enter-from,
.bulk-menu-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.bulk-date--pulse {
  animation:
    bulkDatePulse
    950ms
    var(--motion-curve)
    1;
}

@keyframes bulkBallIn {
  0% {
    opacity: 0;
    transform:
      translateX(-36px)
      scale(0.62)
      rotate(-38deg);
  }

  72% {
    transform:
      translateX(4px)
      scale(1.06)
      rotate(10deg);
  }

  100% {
    opacity: 1;
    transform: none;
  }
}

@keyframes bulkQueuePulse {
  50% {
    transform:
      translateY(-3px)
      scale(1.04);
  }
}

@keyframes bulkDatePulse {
  45% {
    border-color:
      var(--color-primary);
    box-shadow:
      0 0 0 4px
      color-mix(
        in srgb,
        var(--color-primary) 12%,
        transparent
      );
  }
}

@media (max-width: 1080px) {
  .bulk-scheduler {
    grid-template-columns:
      minmax(0, 1fr)
      350px;
  }

  .bulk-zoom {
    left: 76px;
  }
}

@media (max-width: 767px) {
  .bulk-scheduler {
    height:
      calc(
        100dvh -
        var(--app-header-height) -
        var(--app-bottom-nav-height) -
        112px
      );
    min-height: 520px;
    grid-template-columns: 1fr;
    grid-template-rows:
      minmax(220px, 42%)
      minmax(300px, 58%);
    overflow: hidden;
  }

  .bulk-players {
    min-height: 0;
    padding: 0 12px;
    overflow: hidden;
  }

  .bulk-players__head {
    margin: 0 -12px 10px;
    padding: 14px 12px 10px;
  }

  .bulk-players__head h1 {
    font-size: 18px;
  }

  .bulk-player-list {
    max-height: none;
    height:
      calc(100% - 74px);
  }

  .bulk-calendar {
    height: auto;
    min-height: 0;
    border-top: 1px solid
      var(--color-border);
    border-left: 0;
  }

  .bulk-queue-shell {
    padding: 12px;
  }

  .bulk-calendar-head {
    padding: 10px 12px 8px;
  }

  .bulk-calendar-scroll {
    padding: 0 12px 18px;
  }

  .bulk-player-row {
    min-height: 60px;
    grid-template-columns:
      34px
      38px
      minmax(0, 1fr)
      auto;
    gap: 9px;
    padding: 9px 10px;
  }

  .bulk-date {
    min-height: 66px;
    padding: 5px 4px;
  }

  .bulk-weekdays span {
    font-size: 7px;
  }

  .bulk-zoom {
    top:
      var(--app-header-height);
    left: 0;
    padding: 8px;
  }

  .bulk-zoom__card,
  .bulk-zoom__card--detail,
  .bulk-zoom__card--expanded {
    width: 100%;
    height:
      calc(
        100dvh -
        var(--app-header-height) -
        var(--app-bottom-nav-height) -
        12px
      );
    min-height: 0;
  }

  .bulk-zoom__body,
  .bulk-zoom__card--detail
    .bulk-zoom__body {
    grid-template-columns:
      150px
      minmax(430px, 1fr)
      250px;
    overflow-x: auto;
  }

  .bulk-zoom__card:not(.bulk-zoom__card--detail)
    .bulk-zoom-detail {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bulk-player-row,
  .bulk-player-move,
  .bulk-player-enter-active,
  .bulk-ball-enter-active,
  .bulk-ball-leave-active,
  .bulk-menu-enter-active,
  .bulk-menu-leave-active,
  .bulk-zoom__card,
  .bulk-zoom__body {
    animation: none !important;
    transition: none !important;
  }

  .bulk-calendar-scroll,
  .bulk-zoom-calendar__scroll {
    scroll-behavior: auto;
  }
}

/* Queue arrival and compact player rows stay legible at every width. */
.bulk-queue-remove,
.bulk-player-row__drag { aspect-ratio: 1; border-radius: 50%; }
@keyframes bulkBallIn {
  0% { opacity: 0; transform: translateX(-44px) translateY(-6px) scale(.62) rotate(-32deg); }
  48% { opacity: 1; transform: translateX(-4px) translateY(7px) scale(1.04) rotate(7deg); }
  70% { transform: translateX(2px) translateY(-3px) scale(.98) rotate(-2deg); }
  100% { opacity: 1; transform: none; }
}
@media (max-width: 767px) {
  .bulk-player-row { grid-template-columns: 30px 38px minmax(0, 1fr) 32px; gap: 8px; padding: 9px; }
  .bulk-player-row__rank { font-size: 10px; white-space: nowrap; }
  .bulk-player-row__copy { min-width: 0; }
  .bulk-player-row__copy > strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bulk-player-row__copy > small { display: none; }
  .bulk-player-row__drag { width: 32px; height: 32px; }
}

.bulk-queue-remove { box-sizing:border-box; width:24px; height:24px; min-width:24px; min-height:24px; aspect-ratio:1/1; border-radius:50%; }
.bulk-queue-schedule { box-sizing:border-box; min-height:30px; padding-inline:10px; border-radius:999px; white-space:nowrap; }
@media (max-width:767px) { .bulk-player-row { min-width:0; grid-template-columns:28px 36px minmax(0,1fr) 32px; gap:7px; padding:9px 8px; } .bulk-player-row__rank { overflow:hidden; font-size:9px; text-overflow:ellipsis; white-space:nowrap; } .bulk-player-row__copy > strong { font-size:11px; } .bulk-player-row__state { min-width:32px; } .bulk-queue { min-height:102px; padding:10px 8px; border-radius:15px; } .bulk-queue-item { flex-basis:70px; } .bulk-queue-remove { width:24px; height:24px; min-width:24px; min-height:24px; } .bulk-queue-schedule { min-height:29px; padding-inline:8px; font-size:8px; } }
/* Every queued matchup gets its own stable hit area; horizontal scrolling is
   preferable to shrinking the ball or losing the Schedule label. */
.bulk-queue { align-items: flex-start; }
.bulk-queue-item { flex: 0 0 94px; grid-template-rows: 52px 30px; gap: 7px; padding-top: 2px; }
.bulk-tennis-ball { width: 52px; height: 52px; min-width: 52px; min-height: 52px; box-sizing: border-box; }
.bulk-queue-remove { top: 0; right: 3px; width: 24px !important; height: 24px !important; min-width: 24px !important; min-height: 24px !important; border-radius: 50% !important; line-height: 1; }
.bulk-queue-schedule { display: inline-flex; width: 72px; min-width: 72px; min-height: 30px; align-items: center; justify-content: center; padding: 0 8px; overflow: visible; border-radius: 999px; font-size: 9px; line-height: 1; white-space: nowrap; }
@media (max-width: 767px) { .bulk-queue { overflow-x: auto; overflow-y: visible; } .bulk-queue-item { flex-basis: 94px; } .bulk-tennis-ball { width: 50px; height: 50px; min-width: 50px; min-height: 50px; } .bulk-queue-schedule { width: 72px; min-width: 72px; } }
@media (max-width:767px){.bulk-player-row{min-height:72px;grid-template-columns:28px 38px minmax(0,1fr) 36px;gap:8px;padding:10px}.bulk-player-row__copy>strong{display:-webkit-box;overflow:visible;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.25}.bulk-player-row__copy>small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bulk-player-row__drag{width:36px;height:36px;min-width:36px;min-height:36px}.bulk-queue-item{grid-template-rows:52px 52px}.bulk-queue-schedule{width:48px;min-width:48px;height:48px;min-height:48px;padding:0;border-radius:50%;font-size:22px}}.bulk-queue-schedule{position:relative}.bulk-queue-schedule::after{position:absolute;z-index:15;bottom:calc(100% + 8px);left:50%;padding:7px 9px;border:1px solid rgba(8,173,43,.18);border-radius:8px;background:#fff;box-shadow:0 8px 20px rgba(20,45,28,.12);color:var(--color-primary-strong);content:attr(data-tooltip);font-size:9px;font-weight:var(--font-weight-semibold);opacity:0;pointer-events:none;transform:translate(-50%,4px);transition:opacity var(--motion-fast) ease,transform var(--motion-fast) var(--motion-curve);white-space:nowrap}.bulk-queue-schedule:hover::after,.bulk-queue-schedule:focus-visible::after{opacity:1;transform:translate(-50%,0)}

/* Preserve the original tennis-ball seams; the name tooltip belongs to the queue item. */
.bulk-queue-item { position: relative; flex: 0 0 74px; grid-template-rows: 66px 28px; align-items: start; }
.bulk-queue-item::after { position:absolute; z-index:20; bottom:calc(100% + 8px); left:50%; width:max-content; max-width:min(250px,calc(100vw - 32px)); padding:8px 10px; border:1px solid rgba(8,173,43,.18); border-radius:9px; background:#fff; box-shadow:0 8px 24px rgba(20,45,28,.12); color:var(--color-primary-strong); content:attr(data-tooltip); font-size:10px; font-weight:var(--font-weight-semibold); opacity:0; pointer-events:none; transform:translate(-50%,4px); transition:opacity var(--motion-fast) ease,transform var(--motion-fast) var(--motion-curve); white-space:nowrap; }
.bulk-queue-item:hover::after { opacity:1; transform:translate(-50%,0); }
.bulk-tennis-ball { width:66px !important; height:66px !important; min-width:66px !important; min-height:66px !important; }
.bulk-queue-remove { width:20px !important; height:20px !important; min-width:20px !important; min-height:20px !important; aspect-ratio:1/1; border-radius:50% !important; }
.bulk-queue-schedule { display:inline-flex; width:auto; min-width:66px; min-height:28px; align-items:center; justify-content:center; padding:0 8px; border-radius:7px !important; font-size:8px !important; line-height:1; white-space:nowrap; }
@media (max-width:767px) { .bulk-queue-item { flex-basis:74px; grid-template-rows:66px 28px; } .bulk-tennis-ball { width:66px !important; height:66px !important; min-width:66px !important; min-height:66px !important; } .bulk-queue-schedule { min-width:66px; min-height:28px; border-radius:7px !important; font-size:8px !important; } } .bulk-queue-item:has(.bulk-tennis-ball:hover)::after{opacity:1;transform:translate(-50%,0)} .bulk-queue-item:hover::after{opacity:0;transform:translate(-50%,4px)} .bulk-queue-item{grid-template-rows:66px 25px;gap:5px}.bulk-queue-schedule{width:auto!important;min-width:0!important;min-height:25px!important;height:25px!important;padding:0 7px!important;border-radius:7px!important;font-size:8px!important}@media(max-width:767px){.bulk-queue-item{grid-template-rows:66px 25px}.bulk-queue-schedule{min-height:25px!important;height:25px!important;padding:0 7px!important}}</style>




