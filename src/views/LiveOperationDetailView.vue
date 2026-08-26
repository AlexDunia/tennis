<script setup>
import QRCode from 'qrcode'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import { useFriendlyMatchStore } from '../stores/friendlyMatch'
import { usePlayerStore } from '../stores/player'
import {
  dismissAbandonedLiveOperation,
  LIVE_OPERATIONS_ABANDONED_AFTER_MS,
  publishLiveOperationsSnapshot,
  subscribeToLiveOperationsRegistry,
} from '../services/liveOperationsRegistry'
import {
  cancelPairingSession,
  createPairingSession,
  getManageablePairingSessionForMatch,
  revokePairedDisplay,
  subscribeToPairingSession,
} from '../services/tvPairingService'
import { createLiveOperationsSnapshot } from '../utils/liveOperationsSnapshot'
import { createLiveScoreboardSnapshot } from '../utils/liveScoreboardSnapshot'
import {
  formatPairingCode,
} from '../utils/tvPairing'

const route = useRoute()
const router = useRouter()

const adminStore = useAdminStore()
const authStore = useAuthStore()
const playerStore = usePlayerStore()
const friendlyMatchStore = useFriendlyMatchStore()

const operation = ref(null)
const loading = ref(true)
const message = ref('')
const takeoverOpen = ref(false)
const takeoverBusy = ref(false)
const pairingSession =
  ref(null)

const pairingQrDataUrl =
  ref('')

const displayBusy =
  ref(false)

const displayMessage =
  ref('')

const localRecoveryAvailable =
  ref(false)

const recoveryMessage =
  ref('')

const recoveryBusy =
  ref(false)

const recoveryNow =
  ref(Date.now())

let recoveryClockTimer =
  null

let stopPairingSubscription =
  () => {}

let stopOperationsSubscription = () => {}

const matchId = computed(() =>
  String(route.params.matchId || '')
    .trim()
    .slice(0, 120),
)

const currentActorId = computed(
  () => authStore.user?.playerId || playerStore.currentPlayer?.id || authStore.user?.id || '',
)

const currentActorName = computed(
  () => playerStore.currentPlayer?.name || authStore.user?.name || 'Club admin',
)

const isOwner = computed(() =>
  Boolean(operation.value?.ownerId && operation.value.ownerId === currentActorId.value),
)

const isScorer = computed(() =>
  Boolean(operation.value?.scorerId && operation.value.scorerId === currentActorId.value),
)

const canOpenControl = computed(() => isOwner.value || isScorer.value)

const canEmergencyTakeControl = computed(() => {
  const match = operation.value

  if (!match || match.status !== 'live' || !currentActorId.value) {
    return false
  }

  /*
   * Existing owner/scorer does not need an
   * emergency authority operation.
   */
  if (isOwner.value || isScorer.value) {
    return false
  }

  if (!match.clubId || !adminStore.activeClubId || match.clubId !== adminStore.activeClubId) {
    return false
  }

  return Boolean(adminStore.hasActiveClubPermission('matches.live_score'))
})

const canManageDisplay =
  computed(() => {
    const match =
      operation.value

    if (
      !match ||
      !currentActorId.value ||
      !adminStore.activeClubId
    ) {
      return false
    }

    if (
      match.clubId !==
      adminStore.activeClubId
    ) {
      return false
    }

    /*
     * Display access is read-only.
     *
     * Managing a display does NOT grant
     * scoring authority.
     */
    return Boolean(
      adminStore.hasActiveClubPermission(
        'matches.live_score',
      ),
    )
  })

const recoveryAgeMs =
  computed(() => {
    const lastSignalAt =
      Number(
        operation.value
          ?.connection
          ?.lastSignalAt ||
          0,
      )

    if (lastSignalAt > 0) {
      return Math.max(
        0,
        recoveryNow.value -
          lastSignalAt,
      )
    }

    return Math.max(
      0,
      Number(
        operation.value
          ?.connection?.ageMs ||
          0,
      ),
    )
  })

const connectionNeedsRecovery =
  computed(() =>
    [
      'stale',
      'unavailable',
    ].includes(
      operation.value
        ?.connection?.state,
    ),
  )

const abandonedLongEnough =
  computed(
    () =>
      connectionNeedsRecovery.value &&
      recoveryAgeMs.value >=
        LIVE_OPERATIONS_ABANDONED_AFTER_MS,
  )

const canManageRecovery =
  computed(() => {
    const match =
      operation.value

    if (
      !match ||
      !adminStore.activeClubId
    ) {
      return false
    }

    if (
      match.clubId !==
      adminStore.activeClubId
    ) {
      return false
    }

    return Boolean(
      adminStore.hasActiveClubPermission(
        'matches.live_score',
      ),
    )
  })

const pairingCodeLabel =
  computed(() =>
    formatPairingCode(
      pairingSession.value
        ?.pairingCode ||
        '',
    ),
  )

const displayConnected =
  computed(
    () =>
      pairingSession.value
        ?.status ===
      'claimed',
  )

const displayPairingWaiting =
  computed(
    () =>
      pairingSession.value
        ?.status ===
      'waiting',
  )

const scoreboardHref = computed(() => {
  if (!matchId.value) {
    return ''
  }

  return router.resolve({
    name: 'LiveScoreboard',

    params: {
      matchId: matchId.value,
    },
  }).href
})

const displayPairingUrl =
  computed(() => {
    const session =
      pairingSession.value

    if (
      !session?.qrClaimToken ||
      session.status !==
        'waiting' ||
      typeof window ===
        'undefined'
    ) {
      return ''
    }

    const href =
      router.resolve({
        name:
          'TvDisplayPairing',

        query: {
          ticket:
            session.qrClaimToken,
        },
      }).href

    return new URL(
      href,
      window.location.href,
    ).href
  })

function connectionLabel(state) {
  return (
    {
      fresh: 'Connected',
      stale: 'Needs attention',
      unavailable: 'Connection unavailable',
      connecting: 'Connecting',
      unknown: 'Connection uncertain',
      complete: 'Complete',
    }[state] || 'Connecting'
  )
}

function formatStartedAt(value) {
  if (!value) {
    return 'Start time unavailable'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Start time unavailable'
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function pointValue(side) {
  return operation.value?.score?.points?.[side] || '0'
}

function gamesValue(side) {
  return Number(operation.value?.score?.games?.[side] || 0)
}

function setsValue(side) {
  return Number(operation.value?.score?.sets?.[side] || 0)
}

function serving(side) {
  return operation.value?.server === (side === 'a' ? 'playerA' : 'playerB')
}

function stopSubscription() {
  stopOperationsSubscription()

  stopOperationsSubscription = () => {}
}

function subscribeToMatch() {
  stopSubscription()

  loading.value = true

  const clubId = adminStore.activeClubId

  if (!clubId || !matchId.value) {
    loading.value = false
    operation.value = null

    return
  }

  stopOperationsSubscription = subscribeToLiveOperationsRegistry(
    (matches) => {
      operation.value = matches.find((match) => match.matchId === matchId.value) || null

      refreshRecoveryState()

      loading.value = false
    },

    {
      clubId,

      /*
       * A match finishing while this screen
       * is open can still briefly be represented
       * as a terminal operational record.
       */
      includeTerminal: true,
    },
  )
}

async function openMatchControl() {
  if (!canOpenControl.value || !matchId.value) {
    return
  }

  await router.push({
    name: 'FriendlyMatchLive',

    params: {
      matchId: matchId.value,
    },
  })
}

function openTakeoverConfirmation() {
  if (!canEmergencyTakeControl.value) {
    return
  }

  message.value = ''

  takeoverOpen.value = true
}

function closeTakeoverConfirmation() {
  if (takeoverBusy.value) {
    return
  }

  takeoverOpen.value = false
}

function publishAuthorityUpdate() {
  const draft = friendlyMatchStore.draft

  const scoreboard = createLiveScoreboardSnapshot({
    draft,

    playerAPoint: friendlyMatchStore.pointLabel('you'),

    playerBPoint: friendlyMatchStore.pointLabel('opponent'),

    matchFormatLabel: friendlyMatchStore.matchFormatLabel,

    scoringFormatLabel: friendlyMatchStore.formatLabel,

    event: {
      type: 'authority',
      side: null,
    },
  })

  if (!scoreboard) {
    return false
  }

  const operations = createLiveOperationsSnapshot({
    scoreboard,

    draft,

    scorerName: currentActorName.value,

    displayConnected:
      typeof operation.value?.display?.connected === 'boolean'
        ? operation.value.display.connected
        : null,

    eventType: 'authority',
  })

  if (!operations) {
    return false
  }

  return publishLiveOperationsSnapshot(operations)
}

async function takeMatchControl() {
  if (takeoverBusy.value || !matchId.value) {
    return
  }

  takeoverBusy.value = true

  message.value = ''

  try {
    /*
     * Refresh club membership at the moment
     * authority is about to change.
     *
     * Do not rely entirely on the screen state
     * that may have been open for several minutes.
     */
    try {
      await adminStore.loadClubs()
    } catch {
      message.value = 'Gorra could not verify your club access.'

      return
    }

    const actorId = currentActorId.value

    const activeClubId = adminStore.activeClubId

    if (!actorId || !activeClubId || !adminStore.hasActiveClubPermission('matches.live_score')) {
      message.value = 'You no longer have permission to take Match Control.'

      return
    }

    /*
     * Only NOW do we bind the mutable Friendly
     * store to this live court.
     *
     * Simply opening Operations never loaded a
     * writable match.
     */
    const liveMatch = friendlyMatchStore.loadLiveMatch(matchId.value)

    if (!liveMatch) {
      message.value = 'This live match is no longer available.'

      return
    }

    if (liveMatch.clubId !== activeClubId) {
      message.value = 'This match belongs to another club.'

      return
    }

    if (liveMatch.status !== 'live' || !liveMatch.liveState || liveMatch.over) {
      message.value = 'This match is no longer accepting scoring control.'

      return
    }

    /*
     * State may have changed since the operations
     * snapshot was displayed.
     *
     * If this user has since become owner/scorer,
     * no override is needed.
     */
    if (friendlyMatchStore.canManageMatch(actorId) || friendlyMatchStore.canScoreMatch(actorId)) {
      takeoverOpen.value = false

      await router.push({
        name: 'FriendlyMatchLive',

        params: {
          matchId: matchId.value,
        },
      })

      return
    }

    const overridden = friendlyMatchStore.emergencyOverrideScoringAuthority({
      actorId,

      clubId: activeClubId,

      authorized: true,
    })

    if (!overridden) {
      message.value = 'Match Control could not be transferred.'

      return
    }

    /*
     * Scoreboard state did not change.
     *
     * Only the private Operations authority
     * projection needs an immediate update.
     */
    publishAuthorityUpdate()

    takeoverOpen.value = false

    await router.push({
      name: 'FriendlyMatchLive',

      params: {
        matchId: matchId.value,
      },
    })
  } finally {
    takeoverBusy.value = false
  }
}

function stopPairingWatch() {
  stopPairingSubscription()

  stopPairingSubscription =
    () => {}
}

async function generateDisplayQr() {
  pairingQrDataUrl.value =
    ''

  if (
    !displayPairingUrl.value
  ) {
    return
  }

  try {
    pairingQrDataUrl.value =
      await QRCode.toDataURL(
        displayPairingUrl.value,

        {
          width: 220,

          margin: 2,

          color: {
            dark: '#172319',

            light: '#ffffff',
          },

          errorCorrectionLevel:
            'M',
        },
      )
  } catch {
    pairingQrDataUrl.value =
      ''
  }
}

function watchPairingSession(
  sessionId,
) {
  stopPairingWatch()

  stopPairingSubscription =
    subscribeToPairingSession(
      sessionId,

      async (next) => {
        pairingSession.value =
          next

        if (!next) {
          pairingQrDataUrl.value =
            ''

          return
        }

        if (
          next.status ===
          'waiting'
        ) {
          await generateDisplayQr()
        } else {
          pairingQrDataUrl.value =
            ''
        }
      },
    )
}

async function syncDisplayPairing() {
  if (
    !matchId.value ||
    !canManageDisplay.value
  ) {
    pairingSession.value =
      null

    return
  }

  const existing =
    getManageablePairingSessionForMatch({
      matchId:
        matchId.value,

      actorId:
        currentActorId.value,

      clubId:
        adminStore.activeClubId,

      authorized: true,
    })

  pairingSession.value =
    existing

  if (!existing) {
    return
  }

  watchPairingSession(
    existing.sessionId,
  )

  if (
    existing.status ===
    'waiting'
  ) {
    await generateDisplayQr()
  }
}

async function createDisplayPairing() {
  if (
    displayBusy.value ||
    !canManageDisplay.value
  ) {
    return
  }

  displayBusy.value =
    true

  displayMessage.value =
    ''

  try {
    const session =
      createPairingSession({
        matchId:
          matchId.value,

        createdBy:
          currentActorId.value,

        clubId:
          adminStore.activeClubId,

        authorized: true,
      })

    if (!session) {
      displayMessage.value =
        'Gorra could not create this display pairing.'

      return
    }

    pairingSession.value =
      session

    watchPairingSession(
      session.sessionId,
    )

    if (
      session.status ===
      'waiting'
    ) {
      await generateDisplayQr()
    }
  } finally {
    displayBusy.value =
      false
  }
}

function cancelDisplayPairing() {
  const session =
    pairingSession.value

  if (
    !session ||
    session.status !==
      'waiting' ||
    !canManageDisplay.value
  ) {
    return
  }

  const cancelled =
    cancelPairingSession(
      session.sessionId,

      currentActorId.value,

      {
        clubId:
          adminStore.activeClubId,

        authorized: true,
      },
    )

  if (!cancelled) {
    displayMessage.value =
      'This display pairing could not be cancelled.'

    return
  }

  stopPairingWatch()

  pairingSession.value =
    null

  pairingQrDataUrl.value =
    ''

  displayMessage.value =
    'Pairing cancelled.'
}

function disconnectDisplay() {
  const session =
    pairingSession.value

  if (
    !session ||
    session.status !==
      'claimed' ||
    !canManageDisplay.value
  ) {
    return
  }

  const revoked =
    revokePairedDisplay(
      session.sessionId,

      currentActorId.value,

      {
        clubId:
          adminStore.activeClubId,

        authorized: true,
      },
    )

  if (!revoked) {
    displayMessage.value =
      'Gorra could not disconnect this display.'

    return
  }

  stopPairingWatch()

  pairingSession.value =
    null

  pairingQrDataUrl.value =
    ''

  displayMessage.value =
    'Display disconnected.'
}

function refreshRecoveryState() {
  localRecoveryAvailable.value =
    Boolean(
      matchId.value &&
        friendlyMatchStore.hasLiveMatch(
          matchId.value,
        ),
    )

  return localRecoveryAvailable.value
}

async function recoverMatch() {
  if (
    recoveryBusy.value ||
    !canManageRecovery.value
  ) {
    return
  }

  recoveryBusy.value = true

  recoveryMessage.value = ''

  try {
    const available =
      refreshRecoveryState()

    if (!available) {
      recoveryMessage.value =
        'This browser no longer has recoverable live match state for this court.'

      return
    }

    /*
     * Owner/current scorer:
     *
     * reopening Match Control is enough.
     * No authority mutation is required.
     */
    if (canOpenControl.value) {
      await router.push({
        name: 'FriendlyMatchLive',

        params: {
          matchId:
            matchId.value,
        },
      })

      return
    }

    /*
     * Another authorized admin must explicitly
     * take authority.
     *
     * Reuse the confirmation workflow built in 5C.
     */
    if (
      canEmergencyTakeControl.value
    ) {
      openTakeoverConfirmation()

      return
    }

    recoveryMessage.value =
      'You can review this match, but you cannot recover its scoring control.'
  } finally {
    recoveryBusy.value = false
  }
}

function dismissAbandonedMatch() {
  recoveryMessage.value = ''

  if (
    !canManageRecovery.value ||
    !abandonedLongEnough.value
  ) {
    return
  }

  /*
   * If the actual score still exists, do NOT destroy it.
   *
   * This action removes only the stale Operations card.
   */
  const removed =
    dismissAbandonedLiveOperation({
      matchId:
        matchId.value,

      clubId:
        adminStore.activeClubId,
    })

  if (!removed) {
    recoveryMessage.value =
      'This match is not yet eligible to be removed from Live Operations.'

    return
  }

  operation.value = null

  router.replace({
    name: 'LiveOperations',
  })
}

async function preparePage() {
  message.value = ''

  try {
    if (!adminStore.activeClubId) {
      await adminStore.loadClubs()
    }

    if (!playerStore.players.length && !playerStore.isLoading) {
      await playerStore.loadPlayers()
    }
  } catch (error) {
    message.value = error?.message || 'Gorra could not load this live match.'
  }

  subscribeToMatch()

  await syncDisplayPairing()

  refreshRecoveryState()
}

onMounted(() => {
  preparePage()

  recoveryClockTimer =
    window.setInterval(
      () => {
        if (
          document.visibilityState ===
          'visible'
        ) {
          recoveryNow.value =
            Date.now()
        }
      },

      10000,
    )
})

onUnmounted(() => {
  stopSubscription()
  stopPairingWatch()

  if (
    recoveryClockTimer
  ) {
    window.clearInterval(
      recoveryClockTimer,
    )

    recoveryClockTimer =
      null
  }
})
</script>

<template>
  <main class="operation-detail" aria-labelledby="operation-detail-title">
    <button
      type="button"
      class="operation-detail__back"
      @click="
        router.push({
          name: 'LiveOperations',
        })
      "
    >
      <span aria-hidden="true"> ← </span>

      Live operations
    </button>

    <section v-if="loading" class="operation-detail__state">Checking live match…</section>

    <section v-else-if="!operation" class="operation-detail__state">
      <h1>This match is no longer live</h1>

      <p>It may have finished, been closed, or no longer belong to the active club.</p>

      <button
        type="button"
        @click="
          router.push({
            name: 'LiveOperations',
          })
        "
      >
        Back to live operations
      </button>
    </section>

    <template v-else>
      <header class="operation-detail__header">
        <div>
          <p>
            {{ operation.court || 'Court not set' }}
          </p>

          <h1 id="operation-detail-title">
            {{ operation.players?.playerA?.name || 'Player 1' }}
            <span>vs</span>
            {{ operation.players?.playerB?.name || 'Player 2' }}
          </h1>

          <div class="operation-detail__meta">
            <span>
              {{ operation.matchType === 'ladder' ? 'Ladder match' : 'Friendly match' }}
            </span>

            <span>
              {{ formatStartedAt(operation.startedAt) }}
            </span>
          </div>
        </div>

        <span
          class="operation-detail__connection"
          :class="`operation-detail__connection--${operation.connection?.state || 'connecting'}`"
        >
          <i aria-hidden="true"></i>

          {{ connectionLabel(operation.connection?.state) }}
        </span>
      </header>

      <p v-if="message" class="operation-detail__notice" role="status">
        {{ message }}
      </p>

      <section class="operation-detail__score" aria-label="Current score">
        <div class="operation-detail-player">
          <div>
            <span
              class="operation-detail-player__serve"
              :class="{
                'operation-detail-player__serve--active': serving('a'),
              }"
              aria-hidden="true"
            ></span>

            <strong>
              {{ operation.players?.playerA?.name || 'Player 1' }}
            </strong>
          </div>

          <div class="operation-detail-player__numbers">
            <span>
              {{ setsValue('a') }}
              <small>sets</small>
            </span>

            <span>
              {{ gamesValue('a') }}
              <small>games</small>
            </span>

            <strong>
              {{ pointValue('a') }}
            </strong>
          </div>
        </div>

        <div class="operation-detail-player">
          <div>
            <span
              class="operation-detail-player__serve"
              :class="{
                'operation-detail-player__serve--active': serving('b'),
              }"
              aria-hidden="true"
            ></span>

            <strong>
              {{ operation.players?.playerB?.name || 'Player 2' }}
            </strong>
          </div>

          <div class="operation-detail-player__numbers">
            <span>
              {{ setsValue('b') }}
              <small>sets</small>
            </span>

            <span>
              {{ gamesValue('b') }}
              <small>games</small>
            </span>

            <strong>
              {{ pointValue('b') }}
            </strong>
          </div>
        </div>
      </section>

      <section class="operation-detail__information">
        <div>
          <span> Current scorer </span>

          <strong>
            {{ operation.scorerName || 'Assigned scorer' }}
          </strong>
        </div>

        <div>
          <span> Current set </span>

          <strong>
            Set
            {{ operation.score?.currentSetNumber || 1 }}
          </strong>
        </div>

        <div>
          <span> Display </span>

          <strong>
            {{
              displayConnected
                ? 'Connected'
                : displayPairingWaiting
                  ? 'Waiting to pair'
                  : 'Not connected'
            }}
          </strong>
        </div>

        <div>
          <span> Authority revision </span>

          <strong>
            {{ operation.authorityRevision || 0 }}
          </strong>
        </div>
      </section>

      <section
        class="operation-display"
        aria-labelledby="operation-display-title"
      >
        <div
          class="operation-display__heading"
        >
          <div>
            <p>
              Venue display
            </p>

            <h2
              id="operation-display-title"
            >
              {{
                displayConnected
                  ? 'Display connected'
                  : displayPairingWaiting
                    ? 'Waiting for display'
                    : 'Put this match on a screen'
              }}
            </h2>

            <p>
              A paired TV, projector or venue
              screen receives the live scoreboard
              only. It cannot change this match.
            </p>
          </div>

          <span
            class="operation-display__status"
            :class="{
              'operation-display__status--connected':
                displayConnected,
            }"
          >
            <i aria-hidden="true"></i>

            {{
              displayConnected
                ? 'Connected'
                : displayPairingWaiting
                  ? 'Pairing'
                  : 'No display'
            }}
          </span>
        </div>

        <template
          v-if="
            canManageDisplay &&
            displayPairingWaiting
          "
        >
          <div
            class="operation-display__pairing"
          >
            <img
              v-if="pairingQrDataUrl"
              :src="pairingQrDataUrl"
              alt="Display pairing QR code"
            />

            <div>
              <span>
                Pairing code
              </span>

              <strong>
                {{ pairingCodeLabel }}
              </strong>

              <p>
                Scan the QR code or open Gorra
                on the venue display and enter
                this temporary code.
              </p>
            </div>
          </div>

          <button
            type="button"
            class="operation-display__secondary"
            @click="cancelDisplayPairing"
          >
            Cancel pairing
          </button>
        </template>

        <button
          v-else-if="
            canManageDisplay &&
            displayConnected
          "
          type="button"
          class="operation-display__danger"
          @click="disconnectDisplay"
        >
          Disconnect display
        </button>

        <button
          v-else-if="canManageDisplay"
          type="button"
          class="operation-display__primary"
          :disabled="displayBusy"
          @click="createDisplayPairing"
        >
          {{
            displayBusy
              ? 'Creating pairing…'
              : 'Pair display'
          }}
        </button>

        <p
          v-if="displayMessage"
          class="operation-display__message"
          role="status"
        >
          {{ displayMessage }}
        </p>
      </section>

      <section
        v-if="connectionNeedsRecovery"
        class="operation-recovery"
        aria-labelledby="operation-recovery-title"
      >
        <div
          class="operation-recovery__heading"
        >
          <span
            class="operation-recovery__icon"
            aria-hidden="true"
          >
            !
          </span>

          <div>
            <p>
              Needs attention
            </p>

            <h2
              id="operation-recovery-title"
            >
              Scoring updates have stopped
            </h2>

            <p>
              Gorra has kept the latest recorded
              score. The scoring device may have
              closed, lost connection, or gone
              offline.
            </p>
          </div>
        </div>

        <div
          class="operation-recovery__facts"
        >
          <div>
            <span>
              Saved match state
            </span>

            <strong>
              {{
                localRecoveryAvailable
                  ? 'Available'
                  : 'Unavailable'
              }}
            </strong>
          </div>

          <div>
            <span>
              Last signal
            </span>

            <strong>
              {{
                Math.max(
                  0,
                  Math.floor(
                    recoveryAgeMs / 1000
                  )
                )
              }}
              sec ago
            </strong>
          </div>
        </div>

        <p
          v-if="localRecoveryAvailable"
          class="operation-recovery__copy"
        >
          The score, sets, server and match
          clock can be recovered without
          starting another match.
        </p>

        <p
          v-else
          class="operation-recovery__copy operation-recovery__copy--warning"
        >
          Do not recreate the score manually
          from this screen. The live session
          must be recovered from its real match
          record.
        </p>

        <div
          class="operation-recovery__actions"
        >
          <button
            v-if="localRecoveryAvailable"
            type="button"
            class="operation-recovery__primary"
            :disabled="recoveryBusy"
            @click="recoverMatch"
          >
            {{
              recoveryBusy
                ? 'Checking match…'
                : canOpenControl
                  ? 'Recover Match Control'
                  : 'Recover this match'
            }}
          </button>

          <button
            type="button"
            class="operation-recovery__secondary"
            @click="refreshRecoveryState"
          >
            Check again
          </button>

          <button
            v-if="
              !localRecoveryAvailable &&
              abandonedLongEnough &&
              canManageRecovery
            "
            type="button"
            class="operation-recovery__remove"
            @click="dismissAbandonedMatch"
          >
            Remove stale listing
          </button>
        </div>

        <p
          v-if="recoveryMessage"
          class="operation-recovery__message"
          role="status"
        >
          {{ recoveryMessage }}
        </p>
      </section>

      <section class="operation-detail__control">
        <div>
          <p>Match Control</p>

          <h2>
            {{
              canOpenControl
                ? 'You already have access to this match.'
                : canEmergencyTakeControl
                  ? 'Intervene only when the current scorer needs to be replaced.'
                  : 'This match is view-only for your account.'
            }}
          </h2>

          <p>Viewing this page does not change the match owner or active scorer.</p>
        </div>

        <div class="operation-detail__actions">
          <a
            v-if="scoreboardHref"
            :href="scoreboardHref"
            target="_blank"
            rel="noopener noreferrer"
            class="operation-button operation-button--quiet"
          >
            View scoreboard
          </a>

          <button
            v-if="canOpenControl"
            type="button"
            class="operation-button operation-button--primary"
            @click="openMatchControl"
          >
            Open Match Control
          </button>

          <button
            v-else-if="canEmergencyTakeControl"
            type="button"
            class="operation-button operation-button--primary"
            @click="openTakeoverConfirmation"
          >
            Take Match Control
          </button>
        </div>
      </section>
    </template>

    <div v-if="takeoverOpen" class="operation-takeover" @click.self="closeTakeoverConfirmation">
      <section
        class="operation-takeover__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operation-takeover-title"
      >
        <span> Club operations </span>

        <h2 id="operation-takeover-title">Take Match Control?</h2>

        <p>You will immediately become the active scorer for this match.</p>

        <div class="operation-takeover__facts">
          <p>
            <strong>Score</strong>
            stays exactly the same.
          </p>

          <p>
            <strong>Server</strong>
            stays exactly the same.
          </p>

          <p>
            <strong>Match owner</strong>
            does not change.
          </p>

          <p>
            <strong>Current scorer</strong>
            loses scoring access.
          </p>
        </div>

        <div class="operation-takeover__actions">
          <button type="button" :disabled="takeoverBusy" @click="closeTakeoverConfirmation">
            Cancel
          </button>

          <button type="button" :disabled="takeoverBusy" @click="takeMatchControl">
            {{ takeoverBusy ? 'Taking control…' : 'Take control' }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.operation-detail {
  width: min(1000px, 92%);
  margin: 0 auto;
  padding: 28px 0 80px;
  color: #17231b;
}

.operation-detail__back {
  border: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #68736b;
  background: transparent;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.operation-detail__header {
  margin-top: 34px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.operation-detail__header p {
  margin: 0 0 8px;
  color: #277844;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.operation-detail__header h1 {
  max-width: 700px;
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1;
  letter-spacing: -0.045em;
}

.operation-detail__header h1 span {
  color: #929b95;
  font-weight: 400;
}

.operation-detail__meta {
  margin-top: 13px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: #778079;
  font-size: 0.78rem;
}

.operation-detail__connection {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  padding: 7px 10px;
  border: 1px solid #e0e6e1;
  border-radius: 999px;
  color: #68736b;
  font-size: 0.72rem;
  font-weight: 700;
}

.operation-detail__connection i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a3aba5;
}

.operation-detail__connection--fresh i {
  background: #287d46;
}

.operation-detail__connection--stale i,
.operation-detail__connection--unavailable i {
  background: #b08431;
}

.operation-detail__notice {
  margin: 20px 0 0;
  padding: 12px 14px;
  border: 1px solid #e8ddd3;
  border-radius: 10px;
  background: #fffaf6;
  color: #86513d;
  font-size: 0.8rem;
}

.operation-detail__score {
  margin-top: 34px;
  overflow: hidden;
  border: 1px solid #dfe6e1;
  border-radius: 18px;
  background: #fff;
}

.operation-detail-player {
  min-height: 92px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.operation-detail-player + .operation-detail-player {
  border-top: 1px solid #edf1ee;
}

.operation-detail-player > div:first-child {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.operation-detail-player > div:first-child strong {
  overflow: hidden;
  font-size: 1.05rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operation-detail-player__serve {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border: 1px solid #c9d2cc;
  border-radius: 50%;
}

.operation-detail-player__serve--active {
  border-color: #287d46;
  background: #287d46;
}

.operation-detail-player__numbers {
  display: flex;
  align-items: center;
  gap: 22px;
}

.operation-detail-player__numbers span {
  color: #49554d;
  font-size: 1rem;
  font-weight: 650;
  text-align: center;
}

.operation-detail-player__numbers small {
  display: block;
  margin-top: 2px;
  color: #909993;
  font-size: 0.6rem;
  font-weight: 500;
  text-transform: uppercase;
}

.operation-detail-player__numbers > strong {
  min-width: 52px;
  color: #176837;
  font-size: 2rem;
  text-align: right;
}

.operation-detail__information {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid #e2e8e4;
  border-radius: 14px;
  background: #fff;
}

.operation-detail__information > div {
  min-width: 0;
  padding: 14px 15px;
}

.operation-detail__information > div + div {
  border-left: 1px solid #edf1ee;
}

.operation-detail__information span,
.operation-detail__information strong {
  display: block;
}

.operation-detail__information span {
  color: #859088;
  font-size: 0.68rem;
}

.operation-detail__information strong {
  margin-top: 5px;
  overflow: hidden;
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.operation-detail__control {
  margin-top: 24px;
  padding: 20px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  border-radius: 16px;
  background: #f5f8f5;
}

.operation-detail__control > div:first-child {
  max-width: 570px;
}

.operation-detail__control p {
  margin: 0;
  color: #748078;
  font-size: 0.76rem;
  line-height: 1.55;
}

.operation-detail__control > div:first-child > p:first-child {
  margin-bottom: 5px;
  color: #277844;
  font-weight: 700;
}

.operation-detail__control h2 {
  margin: 0 0 7px;
  font-size: 1rem;
}

.operation-detail__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.operation-button {
  min-height: 42px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.operation-button--quiet {
  border: 1px solid #d9e2db;
  color: #253129;
  background: #fff;
}

.operation-button--primary {
  border: 0;
  color: #fff;
  background: #247a43;
}

.operation-detail__state {
  min-height: 400px;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
  color: #737d76;
}

.operation-detail__state h1 {
  margin: 0;
  color: #1c2921;
}

.operation-detail__state p {
  max-width: 420px;
  margin: 10px auto 18px;
  line-height: 1.55;
}

.operation-detail__state button {
  min-height: 42px;
  padding: 0 14px;
  border: 0;
  border-radius: 9px;
  color: #fff;
  background: #247a43;
  font: inherit;
  cursor: pointer;
}

.operation-takeover {
  position: fixed;
  inset: 0;
  z-index: 160;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(13, 31, 21, 0.22);
}

.operation-takeover__dialog {
  width: min(100%, 430px);
  padding: 21px;
  border: 1px solid #e0e6e1;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 16px 40px rgba(16, 40, 25, 0.09);
}

.operation-takeover__dialog > span {
  color: #277844;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.operation-takeover__dialog h2 {
  margin: 7px 0 5px;
  font-size: 1.25rem;
}

.operation-takeover__dialog > p {
  margin: 0;
  color: #718078;
  font-size: 0.8rem;
  line-height: 1.55;
}

.operation-takeover__facts {
  margin-top: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f5f8f5;
}

.operation-takeover__facts p {
  margin: 0;
  color: #68746d;
  font-size: 0.75rem;
  line-height: 1.55;
}

.operation-takeover__facts p + p {
  margin-top: 5px;
}

.operation-takeover__facts strong {
  color: #253129;
}

.operation-takeover__actions {
  margin-top: 17px;
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 8px;
}

.operation-takeover__actions button {
  min-height: 43px;
  border-radius: 9px;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.operation-takeover__actions button:first-child {
  border: 1px solid #dce4de;
  color: #526159;
  background: #fff;
}

.operation-takeover__actions button:last-child {
  border: 0;
  color: #fff;
  background: #247a43;
}

.operation-takeover__actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.operation-display {
  margin-top: 18px;

  padding: 19px;

  border: 1px solid #dfe7e1;

  border-radius: 16px;

  background: #fff;
}

.operation-display__heading {
  display: flex;

  align-items: flex-start;

  justify-content:
    space-between;

  gap: 24px;
}

.operation-display__heading
  > div {
  max-width: 590px;
}

.operation-display__heading p {
  margin: 0;

  color: #748078;

  font-size: 0.76rem;

  line-height: 1.55;
}

.operation-display__heading
  > div
  > p:first-child {
  color: #277844;

  font-weight: 700;
}

.operation-display__heading h2 {
  margin: 5px 0 6px;

  font-size: 1rem;
}

.operation-display__status {
  display: inline-flex;

  align-items: center;

  gap: 7px;

  flex-shrink: 0;

  padding: 7px 10px;

  border-radius: 999px;

  background: #f3f5f3;

  color: #727c75;

  font-size: 0.7rem;

  font-weight: 700;
}

.operation-display__status i {
  width: 7px;

  height: 7px;

  border-radius: 50%;

  background: #a1aaa4;
}

.operation-display__status--connected {
  color: #277844;

  background: #eff7f1;
}

.operation-display__status--connected
  i {
  background: #287d46;
}

.operation-display__pairing {
  margin-top: 18px;

  display: grid;

  grid-template-columns:
    140px minmax(0, 1fr);

  align-items: center;

  gap: 18px;
}

.operation-display__pairing
  img {
  width: 140px;

  border: 1px solid #e0e6e1;

  border-radius: 10px;
}

.operation-display__pairing
  span {
  display: block;

  color: #818b84;

  font-size: 0.68rem;
}

.operation-display__pairing
  strong {
  display: block;

  margin-top: 4px;

  color: #173126;

  font-size: 2rem;

  letter-spacing: 0.12em;

  white-space: nowrap;
}

.operation-display__pairing
  p {
  max-width: 380px;

  margin: 9px 0 0;

  color: #748078;

  font-size: 0.75rem;

  line-height: 1.55;
}

.operation-display__primary,
.operation-display__secondary,
.operation-display__danger {
  min-height: 42px;

  margin-top: 16px;

  padding: 0 14px;

  border-radius: 9px;

  font: inherit;

  font-size: 0.75rem;

  font-weight: 700;

  cursor: pointer;
}

.operation-display__primary {
  border: 0;

  color: #fff;

  background: #247a43;
}

.operation-display__secondary {
  border: 1px solid #dbe3dd;

  color: #526158;

  background: #fff;
}

.operation-display__danger {
  border: 1px solid #ead6d2;

  color: #91463b;

  background: #fffafa;
}

.operation-display__primary:disabled {
  opacity: 0.5;

  cursor: not-allowed;
}

.operation-display__message {
  margin: 10px 0 0;

  color: #6e7a72;

  font-size: 0.72rem;
}

.operation-recovery {
  margin-top: 18px;

  padding: 19px;

  border: 1px solid #e4d8bc;

  border-radius: 16px;

  background: #fffdf7;
}

.operation-recovery__heading {
  display: flex;

  align-items: flex-start;

  gap: 13px;
}

.operation-recovery__icon {
  width: 30px;

  height: 30px;

  display: grid;

  place-items: center;

  flex: 0 0 auto;

  border-radius: 50%;

  background: #f5ead0;

  color: #89631f;

  font-size: 0.8rem;

  font-weight: 800;
}

.operation-recovery__heading
  p {
  margin: 0;

  color: #7b766a;

  font-size: 0.75rem;

  line-height: 1.55;
}

.operation-recovery__heading
  > div
  > p:first-child {
  color: #9a7025;

  font-weight: 700;
}

.operation-recovery__heading
  h2 {
  margin: 4px 0 5px;

  color: #30291d;

  font-size: 1rem;
}

.operation-recovery__facts {
  margin-top: 16px;

  display: grid;

  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );

  overflow: hidden;

  border: 1px solid #ebe2cf;

  border-radius: 10px;

  background: #fff;
}

.operation-recovery__facts
  > div {
  padding: 11px 13px;
}

.operation-recovery__facts
  > div + div {
  border-left: 1px solid #eee6d7;
}

.operation-recovery__facts
  span,
.operation-recovery__facts
  strong {
  display: block;
}

.operation-recovery__facts
  span {
  color: #8c867a;

  font-size: 0.66rem;
}

.operation-recovery__facts
  strong {
  margin-top: 4px;

  color: #3e382d;

  font-size: 0.78rem;
}

.operation-recovery__copy {
  margin: 13px 0 0;

  color: #6e6b63;

  font-size: 0.76rem;

  line-height: 1.55;
}

.operation-recovery__copy--warning {
  color: #895447;
}

.operation-recovery__actions {
  margin-top: 14px;

  display: flex;

  flex-wrap: wrap;

  gap: 8px;
}

.operation-recovery__actions
  button {
  min-height: 40px;

  padding: 0 13px;

  border-radius: 9px;

  font: inherit;

  font-size: 0.73rem;

  font-weight: 700;

  cursor: pointer;
}

.operation-recovery__primary {
  border: 0;

  color: #fff;

  background: #247a43;
}

.operation-recovery__secondary {
  border: 1px solid #ded8ca;

  color: #625d53;

  background: #fff;
}

.operation-recovery__remove {
  border: 1px solid #ead8d2;

  color: #91483e;

  background: #fffafa;
}

.operation-recovery__actions
  button:disabled {
  opacity: 0.5;

  cursor: not-allowed;
}

.operation-recovery__message {
  margin: 10px 0 0;

  color: #74594c;

  font-size: 0.72rem;
}

@media (max-width: 560px) {
  .operation-display__heading {
    flex-direction: column;
  }

  .operation-display__pairing {
    grid-template-columns: 1fr;

    text-align: center;
  }

  .operation-display__pairing
    img {
    margin: 0 auto;
  }

  .operation-display__pairing
    p {
    margin-left: auto;
    margin-right: auto;
  }

  .operation-display__primary,
  .operation-display__secondary,
  .operation-display__danger {
    width: 100%;
  }

  .operation-recovery__actions {
    flex-direction: column;
  }

  .operation-recovery__actions
    button {
    width: 100%;
  }
}

@media (max-width: 700px) {
  .operation-detail__header {
    flex-direction: column;
  }

  .operation-detail__information {
    grid-template-columns: 1fr 1fr;
  }

  .operation-detail__information > div + div {
    border-left: 0;
  }

  .operation-detail__information > div:nth-child(even) {
    border-left: 1px solid #edf1ee;
  }

  .operation-detail__information > div:nth-child(n + 3) {
    border-top: 1px solid #edf1ee;
  }

  .operation-detail__control {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 470px) {
  .operation-detail {
    width: 94%;
  }

  .operation-detail-player {
    align-items: flex-start;
    flex-direction: column;
    gap: 13px;
  }

  .operation-detail-player__numbers {
    width: 100%;
    justify-content: space-between;
  }

  .operation-detail__information {
    grid-template-columns: 1fr;
  }

  .operation-detail__information > div:nth-child(even) {
    border-left: 0;
  }

  .operation-detail__information > div + div {
    border-top: 1px solid #edf1ee;
  }

  .operation-detail__actions {
    width: 100%;
    flex-direction: column;
  }

  .operation-button {
    width: 100%;
  }

  .operation-takeover__actions {
    grid-template-columns: 1fr;
  }
}
</style>
