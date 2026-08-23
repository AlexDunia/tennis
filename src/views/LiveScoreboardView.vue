<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import LiveScoreboard from '../components/match/LiveScoreboard.vue'

import {
  isLiveMatchSnapshotNewer,
  readLiveMatchSnapshot,
  requestLiveMatchSnapshot,
  subscribeToLiveMatch,
} from '../services/liveMatchRealtime'

const props = defineProps({
  matchId: {
    type: String,
    default: '',
  },
})

const snapshot = ref(null)

const viewState = ref('loading')

const connectionState = ref('connecting')

const now = ref(Date.now())

/*
 * DISPLAY STATE
 *
 * None of this state belongs to the match.
 *
 * It is local presentation preference only.
 */
const sunlightMode = ref(readSunlightPreference())

const fullscreenActive = ref(false)

const fullscreenSupported = ref(false)

const wakeLockSupported = ref(false)

const keepAwakeWanted = ref(false)

const wakeLockActive = ref(false)

const controlsVisible = ref(true)

const displayNotice = ref('')

const scoreboardRootRef = ref(null)

const displayControlsRef = ref(null)

let unsubscribe = () => {}

let clockTimer = null

let controlsTimer = null

let noticeTimer = null

let wakeLock = null

const SUNLIGHT_STORAGE_KEY = 'gorra.liveScoreboardSunlight.v1'

const CONTROLS_HIDE_DELAY_MS = 5000

function readSunlightPreference() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  try {
    return window.localStorage.getItem(SUNLIGHT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function normalizeMatchId(value) {
  const raw = String(value || '').trim()

  /*
   * Route params are identifiers,
   * not authorization credentials.
   *
   * Still reject pathological input.
   */
  if (!raw || raw.length > 120) {
    return ''
  }

  return raw
}

function stopSubscription() {
  unsubscribe()

  unsubscribe = () => {}
}

function acceptRecoveredSnapshot(candidate) {
  if (!candidate) {
    return
  }

  if (snapshot.value && !isLiveMatchSnapshotNewer(candidate, snapshot.value)) {
    return
  }

  snapshot.value = candidate

  viewState.value = 'ready'
}

function recoverFromCache() {
  const matchId = normalizeMatchId(props.matchId)

  if (!matchId) {
    return
  }

  /* Fast local recovery first. */
  acceptRecoveredSnapshot(readLiveMatchSnapshot(matchId))

  requestLiveMatchSnapshot(matchId)
}

function connectToMatch(rawMatchId) {
  stopSubscription()

  snapshot.value = null

  connectionState.value = 'connecting'

  const matchId = normalizeMatchId(rawMatchId)

  if (!matchId) {
    viewState.value = 'invalid'

    return
  }

  const cached = readLiveMatchSnapshot(matchId)

  if (cached) {
    snapshot.value = cached

    viewState.value = 'ready'
  } else {
    /*
     * A display can legitimately open before
     * Match Control publishes its first snapshot.
     */
    viewState.value = 'waiting'
  }

  unsubscribe = subscribeToLiveMatch(
    matchId,

    (nextSnapshot) => {
      snapshot.value = nextSnapshot

      viewState.value = 'ready'
    },

    {
      emitCurrent: true,

      onConnectionState: (nextState) => {
        connectionState.value = nextState
      },
    },
  )
}

/*
 * SUNLIGHT MODE
 *
 * Pure visual preference.
 *
 * No match-state mutation.
 */
function toggleSunlightMode() {
  sunlightMode.value = !sunlightMode.value

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(SUNLIGHT_STORAGE_KEY, String(sunlightMode.value))
    } catch {
      /*
       * Restricted/private browsers may reject storage.
       * The current display can still use the mode.
       */
    }
  }

  showDisplayControls()
}

/*
 * DISPLAY NOTICES
 *
 * Short-lived capability feedback.
 */
function showDisplayNotice(message) {
  displayNotice.value = message

  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }

  noticeTimer = window.setTimeout(
    () => {
      displayNotice.value = ''

      noticeTimer = null
    },

    3000,
  )
}

/*
 * FULLSCREEN
 *
 * Native Fullscreen API only.
 *
 * No transform/scale/zoom hacks.
 */
async function toggleFullscreen() {
  showDisplayControls()

  if (!fullscreenSupported.value || !scoreboardRootRef.value) {
    return
  }

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()

      return
    }

    await scoreboardRootRef.value.requestFullscreen()
  } catch {
    showDisplayNotice('Fullscreen is unavailable in this browser.')
  }
}

function handleFullscreenChange() {
  fullscreenActive.value = document.fullscreenElement === scoreboardRootRef.value

  /*
   * Entering fullscreen starts with controls visible.
   *
   * They may then settle out of the spectator's view.
   */
  controlsVisible.value = true

  scheduleControlsHide()
}

/*
 * DISPLAY CONTROLS
 *
 * Normal browser:
 *   always available.
 *
 * Fullscreen spectator mode:
 *   settle away after inactivity.
 */
function cancelControlsHide() {
  if (!controlsTimer) {
    return
  }

  window.clearTimeout(controlsTimer)

  controlsTimer = null
}

function scheduleControlsHide() {
  cancelControlsHide()

  if (!fullscreenActive.value) {
    controlsVisible.value = true

    return
  }

  controlsTimer = window.setTimeout(
    () => {
      /*
       * Never hide controls while the keyboard user
       * is actively focused inside them.
       */
      if (displayControlsRef.value?.contains(document.activeElement)) {
        scheduleControlsHide()

        return
      }

      controlsVisible.value = false

      controlsTimer = null
    },

    CONTROLS_HIDE_DELAY_MS,
  )
}

function showDisplayControls() {
  controlsVisible.value = true

  scheduleControlsHide()
}

/*
 * SCREEN WAKE LOCK
 *
 * Best effort only.
 *
 * Browser support and battery policy belong to the
 * operating system/browser, not Gorra.
 */
async function acquireWakeLock() {
  if (
    !keepAwakeWanted.value ||
    !wakeLockSupported.value ||
    document.visibilityState !== 'visible' ||
    wakeLock
  ) {
    return
  }

  try {
    const lock = await navigator.wakeLock.request('screen')

    wakeLock = lock

    wakeLockActive.value = true

    lock.addEventListener(
      'release',

      () => {
        if (wakeLock === lock) {
          wakeLock = null
        }

        wakeLockActive.value = false
      },

      {
        once: true,
      },
    )
  } catch {
    wakeLock = null

    wakeLockActive.value = false

    keepAwakeWanted.value = false

    showDisplayNotice('Keep awake is unavailable on this device.')
  }
}

async function releaseWakeLock() {
  const lock = wakeLock

  wakeLock = null

  wakeLockActive.value = false

  if (!lock) {
    return
  }

  try {
    await lock.release()
  } catch {
    // Browser may already have released it.
  }
}

async function toggleWakeLock() {
  showDisplayControls()

  if (!wakeLockSupported.value) {
    return
  }

  if (keepAwakeWanted.value) {
    keepAwakeWanted.value = false

    await releaseWakeLock()

    return
  }

  keepAwakeWanted.value = true

  await acquireWakeLock()
}

/*
 * RETURNING TO THE TAB
 *
 * Two independent recoveries happen:
 *
 * 1. latest scoreboard snapshot
 * 2. wake lock, if the user explicitly requested it
 */
function handleWindowFocus() {
  recoverFromCache()

  showDisplayControls()
}

async function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') {
    return
  }

  recoverFromCache()

  if (keepAwakeWanted.value) {
    await acquireWakeLock()
  }
}

watch(
  () => props.matchId,

  (matchId) => {
    connectToMatch(matchId)
  },

  {
    immediate: true,
  },
)

onMounted(() => {
  fullscreenSupported.value = Boolean(
    document.fullscreenEnabled && scoreboardRootRef.value?.requestFullscreen,
  )

  wakeLockSupported.value = Boolean(
    navigator.wakeLock && typeof navigator.wakeLock.request === 'function',
  )

  window.addEventListener('focus', handleWindowFocus)

  document.addEventListener('visibilitychange', handleVisibilityChange)

  document.addEventListener('fullscreenchange', handleFullscreenChange)

  /*
   * Display clock only.
   *
   * Match score transport remains event-driven.
   */
  clockTimer = window.setInterval(
    () => {
      now.value = Date.now()
    },

    1000,
  )
})

onBeforeUnmount(() => {
  stopSubscription()

  window.removeEventListener('focus', handleWindowFocus)

  document.removeEventListener('visibilitychange', handleVisibilityChange)

  document.removeEventListener('fullscreenchange', handleFullscreenChange)

  if (clockTimer) {
    window.clearInterval(clockTimer)
  }

  cancelControlsHide()

  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }

  /*
   * Never leave a device wake lock behind after the
   * scoreboard route no longer owns the display.
   */
  releaseWakeLock()

  clockTimer = null
  noticeTimer = null
})
</script>

<template>
  <div
    ref="scoreboardRootRef"
    class="scoreboard-page"
    :class="{
      'scoreboard-page--sunlight': sunlightMode,

      'scoreboard-page--fullscreen': fullscreenActive,
    }"
    @pointermove.passive="showDisplayControls"
    @pointerdown="showDisplayControls"
    @keydown="showDisplayControls"
    @focusin="showDisplayControls"
  >
    <!--
      DISPLAY CONTROLS

      These operate only on the browser/display.
      None of these controls can change tennis state.
    -->
    <nav
      ref="displayControlsRef"
      class="scoreboard-display-controls"
      :class="{
        'scoreboard-display-controls--hidden': fullscreenActive && !controlsVisible,
      }"
      aria-label="Scoreboard display controls"
    >
      <button
        type="button"
        class="scoreboard-display-control"
        :class="{
          'is-active': sunlightMode,
        }"
        :aria-pressed="sunlightMode"
        aria-label="Toggle sunlight mode"
        @click="toggleSunlightMode"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" />

          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </svg>

        <span> Sunlight </span>
      </button>

      <button
        type="button"
        class="scoreboard-display-control"
        :class="{
          'is-active': wakeLockActive,
        }"
        :disabled="!wakeLockSupported"
        :aria-pressed="wakeLockActive"
        :title="wakeLockSupported ? '' : 'Keep awake is unavailable in this browser'"
        @click="toggleWakeLock"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="3" width="14" height="18" rx="2" />

          <path d="M9 7h6M9 11h6" />

          <path d="M10 17h4" />
        </svg>

        <span>
          {{ wakeLockActive ? 'Awake' : 'Keep awake' }}
        </span>
      </button>

      <button
        type="button"
        class="scoreboard-display-control"
        :class="{
          'is-active': fullscreenActive,
        }"
        :disabled="!fullscreenSupported"
        :aria-pressed="fullscreenActive"
        :title="fullscreenSupported ? '' : 'Fullscreen is unavailable in this browser'"
        @click="toggleFullscreen"
      >
        <svg v-if="!fullscreenActive" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
        </svg>

        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 8H3V3M16 8h5V3M8 16H3v5M16 16h5v5" />
        </svg>

        <span>
          {{ fullscreenActive ? 'Exit full screen' : 'Full screen' }}
        </span>
      </button>
    </nav>

    <Transition name="display-notice">
      <p v-if="displayNotice" class="scoreboard-display-notice" role="status" aria-live="polite">
        {{ displayNotice }}
      </p>
    </Transition>

    <LiveScoreboard
      v-if="viewState === 'ready' && snapshot"
      :snapshot="snapshot"
      :now="now"
      :connection-state="connectionState"
      :sunlight-mode="sunlightMode"
    />

    <main v-else class="scoreboard-waiting" :aria-busy="viewState === 'waiting'">
      <div class="scoreboard-waiting__brand" aria-label="Gorra">
        <span aria-hidden="true"></span>

        <strong>GORRA</strong>
      </div>

      <section class="scoreboard-waiting__content">
        <div class="scoreboard-waiting__mark" aria-hidden="true">
          <span></span>
        </div>

        <template v-if="viewState === 'invalid'">
          <p>Live scoreboard</p>

          <h1>This scoreboard link isn’t valid.</h1>

          <span> Return to the match and open its scoreboard again. </span>
        </template>

        <template v-else>
          <p>Live scoreboard</p>

          <template v-if="connectionState === 'unavailable'">
            <h1>Live updates aren't available here.</h1>

            <span>
              This browser cannot provide Gorra's local live-display connection. Try opening the
              scoreboard in a current browser.
            </span>
          </template>

          <template v-else>
            <h1>Waiting for the match.</h1>

            <span>
              Keep this display open. Gorra will show the score here as soon as the live match
              becomes available.
            </span>
          </template>
        </template>
      </section>

      <footer>Read-only match display</footer>
    </main>
  </div>
</template>

<style scoped>
.scoreboard-page {
  position: relative;

  min-width: 0;
  min-height: 100svh;

  overflow-x: hidden;

  background: #032f24;

  font-family: inherit;
}

.scoreboard-page:fullscreen {
  width: 100%;
  height: 100%;

  overflow: auto;

  background: #032f24;
}

.scoreboard-page--sunlight,
.scoreboard-page--sunlight:fullscreen {
  background: #f7faf7;
}

/*
 * DISPLAY TOOLBAR
 *
 * This deliberately stays compact.
 *
 * A spectator is here to watch tennis,
 * not operate a settings dashboard.
 */
.scoreboard-display-controls {
  position: fixed;

  top: 88px;
  right: 18px;

  z-index: 100;

  display: flex;
  align-items: center;
  gap: 6px;

  padding: 5px;

  border: 1px solid rgba(255, 255, 255, 0.12);

  border-radius: 12px;

  background: rgba(4, 39, 29, 0.84);

  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);

  backdrop-filter: blur(10px);

  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.scoreboard-display-controls--hidden {
  opacity: 0;

  transform: translateY(-5px);

  pointer-events: none;
}

.scoreboard-display-control {
  min-height: 40px;

  padding: 0 10px;

  border: 0;

  border-radius: 8px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  color: rgba(255, 255, 255, 0.76);

  background: transparent;

  font: inherit;

  font-size: 10px;
  font-weight: 650;

  cursor: pointer;

  touch-action: manipulation;

  user-select: none;
  -webkit-user-select: none;

  -webkit-tap-highlight-color: transparent;

  transition:
    color 120ms ease,
    background-color 120ms ease,
    transform 90ms ease;
}

.scoreboard-display-control:hover:not(:disabled) {
  color: #fff;

  background: rgba(255, 255, 255, 0.08);
}

.scoreboard-display-control:active:not(:disabled) {
  transform: scale(0.97);
}

.scoreboard-display-control.is-active {
  color: #d9ed9b;

  background: rgba(184, 223, 99, 0.11);
}

.scoreboard-display-control:disabled {
  cursor: not-allowed;

  opacity: 0.36;
}

.scoreboard-display-control:focus-visible {
  outline: 3px solid rgba(184, 223, 99, 0.25);

  outline-offset: 2px;
}

.scoreboard-display-control svg {
  width: 16px;
  height: 16px;

  flex: 0 0 auto;

  fill: none;

  stroke: currentColor;

  stroke-width: 1.7;

  stroke-linecap: round;
  stroke-linejoin: round;
}

.scoreboard-page--sunlight .scoreboard-display-controls {
  border-color: rgba(4, 73, 49, 0.12);

  background: rgba(255, 255, 255, 0.92);

  box-shadow: 0 4px 14px rgba(5, 48, 32, 0.08);
}

.scoreboard-page--sunlight .scoreboard-display-control {
  color: #52655a;
}

.scoreboard-page--sunlight .scoreboard-display-control:hover:not(:disabled) {
  color: #073f30;

  background: #f1f6f2;
}

.scoreboard-page--sunlight .scoreboard-display-control.is-active {
  color: #087a35;

  background: #eaf6ed;
}

.scoreboard-page--sunlight .scoreboard-display-control:focus-visible {
  outline-color: rgba(8, 122, 53, 0.22);
}

.scoreboard-display-notice {
  position: fixed;

  top: 142px;
  right: 18px;

  z-index: 101;

  max-width: 310px;

  margin: 0;

  padding: 9px 12px;

  border: 1px solid rgba(255, 255, 255, 0.1);

  border-radius: 9px;

  color: rgba(255, 255, 255, 0.84);

  background: rgba(4, 39, 29, 0.88);

  font-size: 9px;
  font-weight: 600;

  line-height: 1.45;

  backdrop-filter: blur(8px);
}

.scoreboard-page--sunlight .scoreboard-display-notice {
  border-color: rgba(7, 63, 48, 0.1);

  color: #29483a;

  background: rgba(255, 255, 255, 0.94);
}

/*
 * WAITING / INVALID STATE
 */
.scoreboard-waiting {
  min-height: 100svh;

  display: grid;

  grid-template-rows:
    auto
    1fr
    auto;

  padding: 0 max(22px, 6vw);

  color: #fff;

  background: #032f24;

  font-family: inherit;
}

.scoreboard-waiting__brand {
  min-height: 74px;

  display: flex;
  align-items: center;
  gap: 8px;

  border-bottom: 1px solid rgba(255, 255, 255, 0.09);

  font-size: 20px;
  font-weight: 800;

  letter-spacing: 0.07em;
}

.scoreboard-waiting__brand > span {
  position: relative;

  width: 19px;
  height: 19px;

  border: 1.5px solid rgba(255, 255, 255, 0.86);

  border-radius: 50%;
}

.scoreboard-waiting__content {
  width: min(560px, 100%);

  margin: auto;

  text-align: center;
}

.scoreboard-waiting__mark {
  width: 58px;
  height: 58px;

  margin: 0 auto 22px;

  display: grid;
  place-items: center;

  border: 1px solid rgba(255, 255, 255, 0.12);

  border-radius: 50%;

  background: rgba(255, 255, 255, 0.025);
}

.scoreboard-waiting__mark span {
  width: 17px;
  height: 17px;

  border: 2px solid #b8df63;

  border-radius: 50%;
}

.scoreboard-waiting__content p {
  margin: 0;

  color: #b8df63;

  font-size: 10px;
  font-weight: 700;

  letter-spacing: 0.12em;

  text-transform: uppercase;
}

.scoreboard-waiting__content h1 {
  margin: 9px 0 0;

  color: #fff;

  font-size: clamp(28px, 6vw, 46px);

  font-weight: 700;

  letter-spacing: -0.035em;
}

.scoreboard-waiting__content > span {
  display: block;

  max-width: 450px;

  margin: 13px auto 0;

  color: rgba(255, 255, 255, 0.58);

  font-size: 13px;

  line-height: 1.65;
}

.scoreboard-waiting footer {
  min-height: 48px;

  display: flex;
  align-items: center;

  border-top: 1px solid rgba(255, 255, 255, 0.07);

  color: rgba(255, 255, 255, 0.42);

  font-size: 9px;
}

/*
 * SUNLIGHT WAITING STATE
 */
.scoreboard-page--sunlight .scoreboard-waiting {
  color: #173126;

  background: #f7faf7;
}

.scoreboard-page--sunlight .scoreboard-waiting__brand {
  border-bottom-color: rgba(7, 63, 48, 0.1);

  color: #073f30;
}

.scoreboard-page--sunlight .scoreboard-waiting__brand > span {
  border-color: #087a35;
}

.scoreboard-page--sunlight .scoreboard-waiting__mark {
  border-color: rgba(7, 63, 48, 0.12);

  background: #fff;
}

.scoreboard-page--sunlight .scoreboard-waiting__mark span {
  border-color: #087a35;
}

.scoreboard-page--sunlight .scoreboard-waiting__content p {
  color: #087a35;
}

.scoreboard-page--sunlight .scoreboard-waiting__content h1 {
  color: #073f30;
}

.scoreboard-page--sunlight .scoreboard-waiting__content > span {
  color: #607268;
}

.scoreboard-page--sunlight .scoreboard-waiting footer {
  border-top-color: rgba(7, 63, 48, 0.08);

  color: #738178;
}

/*
 * MOBILE CONTROL SURFACE
 *
 * Labels disappear before touch targets shrink.
 */
@media (max-width: 620px) {
  .scoreboard-display-controls {
    top: 72px;
    right: 10px;

    gap: 4px;

    padding: 4px;
  }

  .scoreboard-display-control {
    width: 44px;
    min-width: 44px;
    height: 44px;
    min-height: 44px;

    padding: 0;
  }

  .scoreboard-display-control span {
    display: none;
  }

  .scoreboard-display-notice {
    top: 126px;
    right: 10px;
    left: 10px;

    max-width: none;
  }
}

@media (max-width: 350px) {
  .scoreboard-display-controls {
    right: 7px;
  }

  .scoreboard-display-control {
    width: 42px;
    min-width: 42px;
  }
}

.display-notice-enter-active,
.display-notice-leave-active {
  transition:
    opacity 150ms ease,
    transform 170ms ease;
}

.display-notice-enter-from,
.display-notice-leave-to {
  opacity: 0;

  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .scoreboard-display-controls,
  .scoreboard-display-control,
  .scoreboard-display-notice {
    transition: none !important;
    animation: none !important;
  }
}
</style>
