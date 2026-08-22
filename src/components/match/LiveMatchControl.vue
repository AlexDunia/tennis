<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  playerAName: {
    type: String,
    default: 'Player 1',
  },

  playerBName: {
    type: String,
    default: 'Player 2',
  },

  playerAPoint: {
    type: String,
    default: 'Love',
  },

  playerBPoint: {
    type: String,
    default: 'Love',
  },

  setsA: {
    type: Number,
    default: 0,
  },

  setsB: {
    type: Number,
    default: 0,
  },

  gamesA: {
    type: Number,
    default: 0,
  },

  gamesB: {
    type: Number,
    default: 0,
  },

  setScores: {
    type: Array,
    default: () => [],
  },

  currentSetNumber: {
    type: Number,
    default: 1,
  },

  matchFormatLabel: {
    type: String,
    default: 'Tennis match',
  },

  scoringFormatLabel: {
    type: String,
    default: 'Advantage',
  },

  statusText: {
    type: String,
    default: 'Love – Love',
  },

  currentServer: {
    type: String,
    default: 'playerA',
    validator: (value) => ['playerA', 'playerB'].includes(value),
  },

  pointsPlayed: {
    type: Number,
    default: 0,
  },

  startedAt: {
    type: String,
    default: '',
  },

  canScore: {
    type: Boolean,
    default: false,
  },

  canUndo: {
    type: Boolean,
    default: false,
  },

  inTieBreak: {
    type: Boolean,
    default: false,
  },

  isMatchTieBreak: {
    type: Boolean,
    default: false,
  },

  standaloneTieBreak: {
    type: Boolean,
    default: false,
  },

  finished: {
    type: Boolean,
    default: false,
  },

  announcement: {
    type: String,
    default: '',
  },

  announcementsEnabled: {
    type: Boolean,
    default: true,
  },

  announcementsSupported: {
    type: Boolean,
    default: true,
  },

  lastPointWinner: {
    type: String,
    default: '',
    validator: (value) => ['', 'you', 'opponent'].includes(value),
  },
})

const emit = defineEmits(['point', 'undo', 'set-server', 'toggle-announcements'])
const now = ref(Date.now())

/*
 * Correction UI is presentation state only.
 */
const correctionOpen = ref(false)

/*
 * Prevent a physical double tap from registering
 * as two tennis points.
 *
 * This is deliberately very short.
 *
 * It is not a scoring rule and does not replace
 * backend idempotency later.
 */
const pointInputLocked = ref(false)

let clockTimer = null
let pointInputTimer = null

const elapsedLabel = computed(() => {
  if (!props.startedAt) {
    return '00:00'
  }

  const started = new Date(props.startedAt).getTime()

  if (!Number.isFinite(started)) {
    return '00:00'
  }

  const totalSeconds = Math.max(0, Math.floor((now.value - started) / 1000))

  const hours = Math.floor(totalSeconds / 3600)

  const minutes = Math.floor((totalSeconds % 3600) / 60)

  const seconds = totalSeconds % 60

  if (hours > 0) {
    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(seconds).padStart(2, '0'),
    ].join(':')
  }

  return [String(minutes).padStart(2, '0'), String(seconds).padStart(2, '0')].join(':')
})

const gameContextLabel = computed(() => {
  if (props.isMatchTieBreak || props.standaloneTieBreak) {
    return 'Match tie-break'
  }

  if (props.inTieBreak) {
    return 'Tie-break'
  }

  return 'Current game'
})

const setColumns = computed(() => {
  const completed = props.setScores.map((set, index) => ({
    key: `completed-${index}`,
    label: set.isMatchTieBreak ? 'Match TB' : `Set ${index + 1}`,
    a: Number(set.a || 0),
    b: Number(set.b || 0),
    completed: true,
  }))

  if (!props.finished && !props.standaloneTieBreak) {
    completed.push({
      key: `current-${props.currentSetNumber}`,
      label: `Set ${props.currentSetNumber}`,
      a: props.gamesA,
      b: props.gamesB,
      current: true,
    })
  }

  return completed
})

const serverName = computed(() =>
  props.currentServer === 'playerB' ? props.playerBName : props.playerAName,
)

function initials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function awardPoint(side) {
  if (!props.canScore || props.finished || pointInputLocked.value) {
    return
  }

  /*
   * Human fingers double-tap.
   *
   * A second click inside this tiny window is much
   * more likely to be accidental than another real
   * tennis rally.
   *
   * Server-side idempotency still comes later in
   * the production backend.
   */
  pointInputLocked.value = true

  emit('point', side)

  if (pointInputTimer) {
    window.clearTimeout(pointInputTimer)
  }

  pointInputTimer = window.setTimeout(() => {
    pointInputLocked.value = false
    pointInputTimer = null
  }, 220)
}

function undoPoint() {
  if (!props.canScore || !props.canUndo) {
    return
  }

  emit('undo')
}

function openCorrections() {
  if (!props.canScore || props.finished) {
    return
  }

  correctionOpen.value = !correctionOpen.value
}

function closeCorrections() {
  correctionOpen.value = false
}

function undoFromCorrections() {
  if (!props.canScore || !props.canUndo) {
    return
  }

  emit('undo')

  correctionOpen.value = false
}

function correctServer(side) {
  if (!props.canScore || props.finished) {
    return
  }

  emit('set-server', side)

  correctionOpen.value = false
}

onMounted(() => {
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) {
    window.clearInterval(clockTimer)
  }

  if (pointInputTimer) {
    window.clearTimeout(pointInputTimer)
  }
})
</script>

<template>
  <section
    class="match-control"
    :class="{
      'match-control--view-only': !canScore,
    }"
    aria-labelledby="match-control-title"
  >
    <header class="match-control__header">
      <div class="match-control__heading">
        <span class="match-control__eyebrow"> Now playing </span>

        <h1 id="match-control-title">Live match control</h1>
      </div>

      <div class="match-control__header-status">
        <span
          class="match-control__live"
          :class="{
            'match-control__live--finished': finished,
          }"
        >
          <i aria-hidden="true"></i>

          {{ finished ? 'Finished' : 'Live' }}
        </span>

        <span class="match-control__runtime">
          <small>Match time</small>

          <strong>{{ elapsedLabel }}</strong>
        </span>
      </div>
    </header>

    <main class="match-control__workspace">
      <div class="match-control__context">
        <div>
          <span>Match format</span>
          <strong>{{ matchFormatLabel }}</strong>
        </div>

        <div>
          <span>Scoring</span>
          <strong>{{ scoringFormatLabel }}</strong>
        </div>
      </div>

      <article class="match-control__hero">
        <div class="match-player">
          <div
            class="match-player__avatar"
            :class="{
              'match-player__avatar--serving': currentServer === 'playerA',
            }"
          >
            {{ initials(playerAName) }}

            <span
              v-if="currentServer === 'playerA'"
              class="serve-ball"
              aria-label="Serving"
              title="Serving"
            ></span>
          </div>

          <strong class="match-player__name">
            {{ playerAName }}
          </strong>

          <span v-if="currentServer === 'playerA'" class="match-player__serve-text"> Serving </span>
        </div>

        <div class="match-control__current-score" aria-live="polite">
          <span>{{ gameContextLabel }}</span>

          <div>
            <strong
              :class="{
                'match-control__point--confirmed': lastPointWinner === 'you',
              }"
            >
              {{ playerAPoint }}
            </strong>

            <i aria-hidden="true">–</i>

            <strong
              :class="{
                'match-control__point--confirmed': lastPointWinner === 'opponent',
              }"
            >
              {{ playerBPoint }}
            </strong>
          </div>

          <small>{{ statusText }}</small>
        </div>

        <div class="match-player">
          <div
            class="match-player__avatar"
            :class="{
              'match-player__avatar--serving': currentServer === 'playerB',
            }"
          >
            {{ initials(playerBName) }}

            <span
              v-if="currentServer === 'playerB'"
              class="serve-ball"
              aria-label="Serving"
              title="Serving"
            ></span>
          </div>

          <strong class="match-player__name">
            {{ playerBName }}
          </strong>

          <span v-if="currentServer === 'playerB'" class="match-player__serve-text"> Serving </span>
        </div>
      </article>

      <Transition name="score-call">
        <div
          v-if="announcement"
          class="match-control__announcement"
          role="status"
          aria-live="polite"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 9v6h4l5 4V5L9 9H5Z" />

            <path d="M17 9.5c.7.7 1 1.5 1 2.5s-.3 1.8-1 2.5" />
          </svg>

          <span>
            {{ announcement }}
          </span>
        </div>
      </Transition>

      <section
        v-if="!standaloneTieBreak"
        class="match-control__score-panel"
        aria-label="Match score"
      >
        <div class="match-control__score-head">
          <div>
            <span>Match score</span>

            <strong> {{ setsA }}–{{ setsB }} sets </strong>
          </div>

          <span> Set {{ currentSetNumber }} </span>
        </div>

        <div
          class="match-score-table"
          :style="{
            '--set-columns': Math.max(setColumns.length, 1),
          }"
        >
          <div class="match-score-table__corner">Player</div>

          <div
            v-for="column in setColumns"
            :key="`head-${column.key}`"
            class="match-score-table__head"
            :class="{
              'match-score-table__head--current': column.current,
            }"
          >
            {{ column.label }}
          </div>

          <div class="match-score-table__player">
            {{ playerAName }}
          </div>

          <div
            v-for="column in setColumns"
            :key="`a-${column.key}`"
            class="match-score-table__value"
            :class="{
              'match-score-table__value--current': column.current,
            }"
          >
            {{ column.a }}
          </div>

          <div class="match-score-table__player">
            {{ playerBName }}
          </div>

          <div
            v-for="column in setColumns"
            :key="`b-${column.key}`"
            class="match-score-table__value"
            :class="{
              'match-score-table__value--current': column.current,
            }"
          >
            {{ column.b }}
          </div>
        </div>
      </section>

      <section v-else class="match-control__tie-break-panel">
        <span>10-point match tie-break</span>

        <strong> {{ playerAPoint }}–{{ playerBPoint }} </strong>

        <small> First to the target score, winning by two. </small>
      </section>

      <div class="match-control__match-state">
        <div>
          <span>Current server</span>

          <strong>{{ serverName }}</strong>
        </div>

        <div class="match-control__state-actions">
          <button
            v-if="canScore && !finished"
            type="button"
            class="match-control__correction-button"
            :class="{
              'match-control__correction-button--active': correctionOpen,
            }"
            :aria-expanded="correctionOpen"
            aria-controls="match-correction-panel"
            @click="openCorrections"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />
            </svg>

            <span>Corrections</span>
          </button>

          <button
            type="button"
            class="match-control__voice-button"
            :disabled="!announcementsSupported"
            :class="{
              'match-control__voice-button--active': announcementsEnabled,
            }"
            :aria-pressed="announcementsEnabled"
            :aria-label="
              !announcementsSupported
                ? 'Voice announcements are unavailable on this device'
                : announcementsEnabled
                  ? 'Turn score announcements off'
                  : 'Turn score announcements on'
            "
            @click="emit('toggle-announcements')"
          >
            <svg v-if="announcementsEnabled" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 9v6h4l5 4V5L9 9H5Z" />

              <path d="M17 9.5c.7.7 1 1.5 1 2.5s-.3 1.8-1 2.5" />
            </svg>

            <svg v-else viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 9v6h4l5 4V5L9 9H5Z" />

              <path d="m17 10 4 4m0-4-4 4" />
            </svg>

            <span>
              {{
                !announcementsSupported
                  ? 'Voice unavailable'
                  : announcementsEnabled
                    ? 'Voice on'
                    : 'Voice off'
              }}
            </span>
          </button>
        </div>
      </div>

      <Transition name="correction-panel">
        <section
          v-if="correctionOpen && canScore && !finished"
          id="match-correction-panel"
          class="match-correction"
          aria-label="Match corrections"
        >
          <header class="match-correction__header">
            <div>
              <span>Correction</span>

              <strong> Fix only what is wrong. </strong>
            </div>

            <button
              type="button"
              class="match-correction__close"
              aria-label="Close corrections"
              @click="closeCorrections"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
            </button>
          </header>

          <div class="match-correction__options">
            <button
              type="button"
              class="match-correction__option"
              :disabled="!canUndo"
              @click="undoFromCorrections"
            >
              <span class="match-correction__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />
                </svg>
              </span>

              <span>
                <strong>Undo last point</strong>

                <small> Restore the exact score before the previous point. </small>
              </span>
            </button>

            <div class="match-correction__server">
              <div class="match-correction__server-copy">
                <span>Who should be serving?</span>

                <small> Choose explicitly. This does not change the score. </small>
              </div>

              <div class="match-correction__server-options">
                <button
                  type="button"
                  :class="{
                    'is-selected': currentServer === 'playerA',
                  }"
                  @click="correctServer('you')"
                >
                  <span>
                    {{ initials(playerAName) }}
                  </span>

                  <strong>
                    {{ playerAName }}
                  </strong>

                  <small v-if="currentServer === 'playerA'"> Current server </small>

                  <small v-else> Set as server </small>
                </button>

                <button
                  type="button"
                  :class="{
                    'is-selected': currentServer === 'playerB',
                  }"
                  @click="correctServer('opponent')"
                >
                  <span>
                    {{ initials(playerBName) }}
                  </span>

                  <strong>
                    {{ playerBName }}
                  </strong>

                  <small v-if="currentServer === 'playerB'"> Current server </small>

                  <small v-else> Set as server </small>
                </button>
              </div>
            </div>
          </div>
        </section>
      </Transition>

      <p v-if="!canScore" class="match-control__authority" role="status">
        View only — only the assigned scorer can change this match.
      </p>

      <p class="match-control__points-played">
        {{ pointsPlayed }}
        {{ pointsPlayed === 1 ? 'point' : 'points' }}
        played
      </p>
    </main>

    <footer v-if="!finished" class="match-control__dock" aria-label="Scoring controls">
      <div class="match-control__dock-inner">
        <button
          type="button"
          :class="{
            'score-action--confirmed': lastPointWinner === 'you',
          }"
          :disabled="!canScore || pointInputLocked"
          :aria-label="`Add point for ${playerAName}`"
          @click="awardPoint('you')"
        >
          <span> Point to </span>

          <strong>
            {{ playerAName }}
          </strong>

          <small>
            {{ playerAPoint }}
          </small>
        </button>

        <button
          type="button"
          class="score-action"
          :class="{
            'score-action--confirmed': lastPointWinner === 'opponent',
          }"
          :disabled="!canScore || pointInputLocked"
          :aria-label="`Add point for ${playerBName}`"
          @click="awardPoint('opponent')"
        >
          <span> Point to </span>

          <strong>
            {{ playerBName }}
          </strong>

          <small>
            {{ playerBPoint }}
          </small>
        </button>

        <button
          type="button"
          class="undo-action"
          :disabled="!canScore || !canUndo"
          aria-label="Undo last point"
          @click="undoPoint"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6" />
          </svg>

          <span>Undo last point</span>
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.match-control {
  --control-green: #00b51a;
  --control-green-strong: #008f15;
  --control-dark-green: #073f30;
  --control-text: #16211b;
  --control-secondary: #66736b;
  --control-muted: #8a958e;
  --control-line: rgba(7, 63, 48, 0.09);
  --control-soft: #f5f9f6;
  --control-soft-green: #eef9f1;
  --control-white: #ffffff;

  min-height: 100dvh;
  padding-bottom: calc(126px + env(safe-area-inset-bottom));

  color: var(--control-text);
  background: var(--control-white);
}

.match-control__header {
  min-height: 72px;
  padding: 14px clamp(18px, 4vw, 34px);

  border-bottom: 0.5px solid var(--control-line);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;

  background: rgba(255, 255, 255, 0.98);
}

.match-control__heading {
  min-width: 0;
}

.match-control__eyebrow {
  display: block;

  margin-bottom: 2px;

  color: var(--control-green-strong);

  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.match-control__heading h1 {
  margin: 0;

  color: var(--control-dark-green);

  font-size: clamp(18px, 2vw, 22px);

  font-weight: 600;
  line-height: 1.25;
}

.match-control__header-status {
  flex: 0 0 auto;

  display: flex;
  align-items: center;
  gap: 12px;
}

.match-control__live {
  min-height: 34px;
  padding: 0 10px;

  border-radius: 999px;

  display: inline-flex;
  align-items: center;
  gap: 7px;

  color: var(--control-dark-green);
  background: var(--control-soft-green);

  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.match-control__live i {
  width: 6px;
  height: 6px;

  border-radius: 50%;

  background: var(--control-green);

  box-shadow: 0 0 0 4px rgba(0, 181, 26, 0.08);
}

.match-control__live--finished i {
  background: var(--control-muted);
  box-shadow: none;
}

.match-control__runtime {
  min-width: 68px;

  padding-left: 12px;

  border-left: 0.5px solid var(--control-line);
}

.match-control__runtime small,
.match-control__runtime strong {
  display: block;
}

.match-control__runtime small {
  color: var(--control-muted);

  font-size: 9px;
  font-weight: 500;
}

.match-control__runtime strong {
  margin-top: 1px;

  color: var(--control-dark-green);

  font-size: 13px;
  font-weight: 600;
}

.match-control__workspace {
  width: min(100% - 36px, 980px);

  margin: 0 auto;

  padding: 30px 0 42px;
}

.match-control__context {
  margin-bottom: 13px;

  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.match-control__context > div {
  min-width: 0;
}

.match-control__context > div:last-child {
  text-align: right;
}

.match-control__context span,
.match-control__context strong {
  display: block;
}

.match-control__context span {
  color: var(--control-muted);

  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.match-control__context strong {
  margin-top: 3px;

  color: var(--control-dark-green);

  font-size: 14px;
  font-weight: 600;
}

.match-control__hero {
  min-height: 194px;
  padding: 24px;

  border: 0.5px solid rgba(7, 63, 48, 0.07);

  border-radius: 10px;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(180px, 0.78fr)
    minmax(0, 1fr);

  align-items: center;
  gap: 24px;

  background: var(--control-white);

  box-shadow:
    0 1px 2px rgba(13, 45, 26, 0.025),
    0 8px 24px rgba(13, 45, 26, 0.025);

  transition:
    transform 140ms ease,
    box-shadow 180ms ease;
}

.match-player {
  min-width: 0;

  display: flex;
  flex-direction: column;
  align-items: center;

  text-align: center;
}

.match-player__avatar {
  width: 58px;
  height: 58px;

  position: relative;

  border: 0.5px solid rgba(7, 63, 48, 0.14);

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--control-dark-green);
  background: var(--control-soft-green);

  font-size: 16px;
  font-weight: 600;

  transition:
    background-color 150ms ease,
    color 150ms ease,
    border-color 150ms ease;
}

.match-player__avatar--serving {
  border-color: rgba(0, 181, 26, 0.4);
}

.serve-ball {
  width: 19px;
  height: 19px;

  position: absolute;
  right: -2px;
  bottom: -1px;

  border: 2.5px solid var(--control-white);

  border-radius: 50%;

  background: #d7ed43;

  box-shadow: 0 1px 3px rgba(8, 49, 27, 0.16);
}

.serve-ball::before,
.serve-ball::after {
  content: '';

  width: 12px;
  height: 7px;

  position: absolute;
  left: 1px;

  border: 1px solid rgba(62, 83, 28, 0.72);

  border-left-color: transparent;
  border-right-color: transparent;

  border-radius: 50%;
}

.serve-ball::before {
  top: 1px;

  transform: rotate(36deg);
}

.serve-ball::after {
  bottom: 1px;

  transform: rotate(-36deg);
}

.match-player__name {
  width: 100%;

  margin-top: 10px;

  overflow: hidden;

  color: var(--control-text);

  font-size: 15px;
  font-weight: 600;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-player__serve-text {
  margin-top: 3px;

  color: var(--control-green-strong);

  font-size: 10px;
  font-weight: 600;
}

.match-control__current-score {
  min-width: 0;

  display: flex;
  flex-direction: column;
  align-items: center;

  text-align: center;
}

.match-control__current-score > span {
  color: var(--control-muted);

  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.match-control__current-score > div {
  margin-top: 7px;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
}

.match-control__current-score strong {
  color: var(--control-dark-green);

  font-size: clamp(42px, 7vw, 68px);

  font-weight: 600;
  line-height: 0.95;
  letter-spacing: -0.045em;

  transition:
    transform 150ms ease,
    opacity 150ms ease;
}

.match-control__current-score i {
  color: #a0aaa4;

  font-size: 22px;
  font-style: normal;
  font-weight: 400;
}

.match-control__current-score small {
  max-width: 220px;

  margin-top: 9px;

  color: var(--control-secondary);

  font-size: 11px;
  font-weight: 500;
}

.match-control__score-panel {
  margin-top: 18px;

  overflow: hidden;

  border: 0.5px solid var(--control-line);

  border-radius: 10px;

  background: var(--control-white);
}

.match-control__score-head {
  min-height: 58px;
  padding: 12px 16px;

  border-bottom: 0.5px solid var(--control-line);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.match-control__score-head span,
.match-control__score-head strong {
  display: block;
}

.match-control__score-head span {
  color: var(--control-muted);

  font-size: 10px;
  font-weight: 500;
}

.match-control__score-head strong {
  margin-top: 2px;

  color: var(--control-dark-green);

  font-size: 14px;
  font-weight: 600;
}

.match-score-table {
  --set-columns: 1;

  display: grid;

  grid-template-columns:
    minmax(135px, 1.5fr)
    repeat(var(--set-columns), minmax(72px, 0.7fr));

  overflow-x: auto;
}

.match-score-table > * {
  min-height: 48px;

  padding: 10px 13px;

  border-right: 0.5px solid var(--control-line);

  border-bottom: 0.5px solid var(--control-line);

  display: flex;
  align-items: center;
}

.match-score-table__corner,
.match-score-table__head {
  color: var(--control-muted);
  background: #fbfcfb;

  font-size: 9px;
  font-weight: 600;

  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.match-score-table__head {
  justify-content: center;
}

.match-score-table__head--current {
  color: var(--control-green-strong);
}

.match-score-table__player {
  color: var(--control-text);

  font-size: 13px;
  font-weight: 600;
}

.match-score-table__value {
  justify-content: center;

  color: var(--control-dark-green);

  font-size: 18px;
  font-weight: 600;
}

.match-score-table__value--current {
  background: var(--control-soft-green);
}

.match-control__tie-break-panel {
  margin-top: 18px;
  padding: 24px;

  border: 0.5px solid var(--control-line);

  border-radius: 10px;

  text-align: center;
}

.match-control__tie-break-panel span,
.match-control__tie-break-panel strong,
.match-control__tie-break-panel small {
  display: block;
}

.match-control__tie-break-panel span {
  color: var(--control-muted);

  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.match-control__tie-break-panel strong {
  margin-top: 7px;

  color: var(--control-dark-green);

  font-size: 36px;
  font-weight: 600;
}

.match-control__tie-break-panel small {
  margin-top: 6px;

  color: var(--control-secondary);

  font-size: 11px;
}

.match-control__match-state {
  min-height: 66px;

  margin-top: 14px;
  padding: 11px 14px;

  border: 0.5px solid var(--control-line);

  border-radius: 10px;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;

  background: #fbfdfb;
}

.match-control__match-state span,
.match-control__match-state strong {
  display: block;
}

.match-control__match-state span {
  color: var(--control-muted);

  font-size: 10px;
}

.match-control__match-state strong {
  margin-top: 2px;

  color: var(--control-dark-green);

  font-size: 13px;
  font-weight: 600;
}

.match-control__state-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.match-control__correction-button {
  min-height: 44px;
  padding: 0 11px;

  border: 0.5px solid var(--control-line);

  border-radius: 7px;

  display: inline-flex;
  align-items: center;
  gap: 7px;

  color: var(--control-dark-green);
  background: var(--control-white);

  font-size: 11px;
  font-weight: 600;

  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 90ms ease;
}

.match-control__correction-button:hover {
  background: var(--control-soft);
}

.match-control__correction-button:active {
  transform: scale(0.97);
}

.match-control__correction-button--active {
  border-color: rgba(0, 181, 26, 0.2);

  background: var(--control-soft-green);
}

.match-control__correction-button svg {
  width: 16px;
  height: 16px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.match-control__server-button,
.match-control__voice-button {
  min-height: 44px;
  padding: 0 11px;

  border: 0.5px solid var(--control-line);

  border-radius: 7px;

  display: inline-flex;
  align-items: center;
  gap: 7px;

  color: var(--control-dark-green);
  background: var(--control-white);

  font-size: 11px;
  font-weight: 600;

  transition:
    background-color 120ms ease,
    transform 90ms ease;
}

.match-control__server-button:hover,
.match-control__voice-button:hover {
  background: var(--control-soft);
}

.match-control__server-button:active,
.match-control__voice-button:active {
  transform: scale(0.97);
}

.match-control__server-button svg,
.match-control__voice-button svg {
  width: 16px;
  height: 16px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.match-control__voice-button--active {
  border-color: rgba(0, 181, 26, 0.18);

  color: var(--control-green-strong);

  background: var(--control-soft-green);
}
.match-correction {
  margin-top: 10px;

  overflow: hidden;

  border: 0.5px solid rgba(7, 63, 48, 0.1);

  border-radius: 10px;

  background: var(--control-white);

  box-shadow: 0 8px 24px rgba(13, 45, 26, 0.035);
}

.match-correction__header {
  min-height: 62px;
  padding: 12px 14px;

  border-bottom: 0.5px solid var(--control-line);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.match-correction__header span,
.match-correction__header strong {
  display: block;
}

.match-correction__header span {
  color: var(--control-green-strong);

  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.match-correction__header strong {
  margin-top: 2px;

  color: var(--control-dark-green);

  font-size: 13px;
  font-weight: 600;
}

.match-correction__close {
  width: 34px;
  height: 34px;

  flex: 0 0 auto;

  border: 0.5px solid var(--control-line);

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--control-secondary);
  background: var(--control-white);
}

.match-correction__close svg {
  width: 15px;
  height: 15px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.match-correction__options {
  padding: 12px;
}

.match-correction__option {
  width: 100%;

  min-height: 64px;
  padding: 10px 12px;

  border: 0.5px solid var(--control-line);

  border-radius: 8px;

  display: flex;
  align-items: center;
  gap: 11px;

  color: var(--control-text);
  background: #fbfdfb;

  text-align: left;
}

.match-correction__option:not(:disabled):hover {
  background: var(--control-soft);
}

.match-correction__option:disabled {
  cursor: not-allowed;
  opacity: 0.44;
}

.match-correction__icon {
  width: 35px;
  height: 35px;

  flex: 0 0 auto;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--control-dark-green);
  background: var(--control-soft-green);
}

.match-correction__icon svg {
  width: 16px;
  height: 16px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.match-correction__option strong,
.match-correction__option small {
  display: block;
}

.match-correction__option strong {
  color: var(--control-dark-green);

  font-size: 12px;
  font-weight: 600;
}

.match-correction__option small {
  margin-top: 2px;

  color: var(--control-secondary);

  font-size: 10px;
  font-weight: 400;
}

.match-correction__server {
  margin-top: 12px;
  padding-top: 12px;

  border-top: 0.5px solid var(--control-line);
}

.match-correction__server-copy span,
.match-correction__server-copy small {
  display: block;
}

.match-correction__server-copy span {
  color: var(--control-dark-green);

  font-size: 11px;
  font-weight: 600;
}

.match-correction__server-copy small {
  margin-top: 2px;

  color: var(--control-muted);

  font-size: 9px;
}

.match-correction__server-options {
  margin-top: 9px;

  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 8px;
}

.match-correction__server-options button {
  min-height: 74px;
  padding: 9px 10px;

  border: 0.5px solid var(--control-line);

  border-radius: 8px;

  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);

  grid-template-rows: auto auto;

  align-items: center;
  column-gap: 9px;

  color: var(--control-text);
  background: var(--control-white);

  text-align: left;

  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 90ms ease;
}

.match-correction__server-options button > span {
  width: 32px;
  height: 32px;

  grid-row: 1 / span 2;

  border-radius: 50%;

  display: grid;
  place-items: center;

  color: var(--control-dark-green);
  background: var(--control-soft-green);

  font-size: 9px;
  font-weight: 600;
}

.match-correction__server-options button > strong {
  min-width: 0;

  overflow: hidden;

  color: var(--control-dark-green);

  font-size: 11px;
  font-weight: 600;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-correction__server-options button > small {
  color: var(--control-muted);

  font-size: 9px;
}

.match-correction__server-options button.is-selected {
  border-color: rgba(0, 181, 26, 0.22);

  background: var(--control-soft-green);
}

.match-correction__server-options button:active {
  transform: scale(0.98);
}

.correction-panel-enter-active,
.correction-panel-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms ease;
}

.correction-panel-enter-from,
.correction-panel-leave-to {
  opacity: 0;

  transform: translateY(-5px);
}

.match-control__authority {
  margin-top: 13px;
  padding: 12px 14px;

  border-radius: 8px;

  color: var(--control-secondary);
  background: var(--control-soft);

  font-size: 11px;
}

.match-control__points-played {
  margin: 13px 0 0;

  color: var(--control-muted);

  font-size: 10px;
  font-weight: 500;

  text-align: center;
}

.match-control__dock {
  width: 100%;

  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;

  z-index: 40;

  padding: 12px 18px calc(12px + env(safe-area-inset-bottom));

  border-top: 0.5px solid var(--control-line);

  background: rgba(255, 255, 255, 0.985);
}

.match-control__dock-inner {
  width: min(100%, 980px);

  margin: 0 auto;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr)
    minmax(150px, 0.48fr);

  gap: 10px;
}

.score-action,
.undo-action {
  min-height: 68px;

  border-radius: 8px;

  transition:
    transform 90ms ease,
    background-color 120ms ease,
    border-color 120ms ease;
}

.score-action {
  padding: 10px 15px;

  touch-action: manipulation;

  user-select: none;
  -webkit-user-select: none;

  -webkit-tap-highlight-color: transparent;

  border: 0.5px solid rgba(7, 63, 48, 0.12);

  color: var(--control-dark-green);
  background: var(--control-white);

  display: grid;
  grid-template-columns:
    minmax(0, 1fr)
    auto;

  align-items: center;
  column-gap: 10px;

  text-align: left;
}

.score-action--primary {
  border-color: rgba(0, 181, 26, 0.22);

  background: var(--control-soft-green);
}

.score-action > span {
  grid-column: 1;

  color: var(--control-muted);

  font-size: 9px;
  font-weight: 500;
}

.score-action > strong {
  grid-column: 1;

  min-width: 0;

  overflow: hidden;

  color: var(--control-dark-green);

  font-size: 14px;
  font-weight: 600;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-action > small {
  grid-column: 2;
  grid-row: 1 / span 2;

  color: var(--control-dark-green);

  font-size: 28px;
  font-weight: 600;
}

.score-action:not(:disabled):hover {
  border-color: rgba(0, 181, 26, 0.34);
}

.score-action:not(:disabled):active,
.undo-action:not(:disabled):active {
  transform: scale(0.975);
}

.undo-action {
  padding: 0 15px;

  border: 0;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  color: #ffffff;
  background: var(--control-dark-green);

  font-size: 11px;
  font-weight: 600;
}

.undo-action svg {
  width: 17px;
  height: 17px;

  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.score-action:disabled,
.undo-action:disabled,
.match-control__server-button:disabled,
.match-control__voice-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 720px) {
  .match-control {
    padding-bottom: calc(184px + env(safe-area-inset-bottom));
  }

  .match-control__header {
    min-height: 64px;
    padding: 11px 7.5vw;
  }

  .match-control__runtime small {
    display: none;
  }

  .match-control__workspace {
    width: 85%;
    padding-top: 22px;
  }

  .match-control__context {
    align-items: flex-start;
  }

  .match-control__hero {
    min-height: 168px;
    padding: 20px 13px;

    grid-template-columns:
      minmax(0, 1fr)
      minmax(110px, 0.82fr)
      minmax(0, 1fr);

    gap: 8px;
  }

  .match-player__avatar {
    width: 48px;
    height: 48px;

    font-size: 13px;
  }

  .serve-ball {
    width: 17px;
    height: 17px;
  }

  .match-player__name {
    font-size: 12px;
  }

  .match-control__current-score strong {
    font-size: clamp(34px, 10vw, 48px);
  }

  .match-control__current-score small {
    font-size: 9px;
  }

  .match-control__score-panel {
    overflow-x: auto;
  }

  .match-control__announcement {
    width: fit-content;
    max-width: min(100%, 520px);

    min-height: 38px;

    margin: 12px auto 0;

    padding: 8px 12px;

    border: 0.5px solid rgba(0, 181, 26, 0.14);

    border-radius: 999px;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    color: var(--control-dark-green);
    background: var(--control-soft-green);

    font-size: 11px;
    font-weight: 600;

    text-align: center;
  }

  .match-control__announcement svg {
    width: 15px;
    height: 15px;

    flex: 0 0 auto;

    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .match-control__announcement svg path:first-child {
    fill: currentColor;
    stroke: none;
  }

  .score-call-enter-active,
  .score-call-leave-active {
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  .score-call-enter-from,
  .score-call-leave-to {
    opacity: 0;

    transform: translateY(-3px);
  }

  .match-score-table {
    min-width: 390px;
  }

  .match-control__dock {
    padding: 10px 7.5vw calc(10px + env(safe-area-inset-bottom));
  }

  .match-control__dock-inner {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .undo-action {
    min-height: 44px;

    grid-column: 1 / -1;
  }

  .score-action {
    min-height: 72px;
    padding: 9px 11px;
  }

  .score-action > strong {
    font-size: 12px;
  }

  .score-action > small {
    font-size: 24px;
  }
}

@media (max-width: 410px) {
  .match-control__heading h1 {
    font-size: 16px;
  }

  .match-control__live {
    padding: 0 8px;
  }

  .match-control__runtime {
    min-width: auto;
    padding-left: 8px;
  }

  .match-control__hero {
    padding-left: 9px;
    padding-right: 9px;
  }

  .match-player__avatar {
    width: 43px;
    height: 43px;
  }

  .match-player__serve-text {
    display: none;
  }

  .match-control__current-score > span {
    font-size: 8px;
  }

  .match-control__current-score strong {
    font-size: 34px;
  }

  .match-control__match-state {
    align-items: flex-start;
  }

  .match-control__correction-button span,
  .match-control__voice-button span {
    display: none;
  }

  .match-control__correction-button,
  .match-control__voice-button {
    width: 44px;
    min-width: 44px;
    height: 44px;
    min-height: 44px;

    padding: 0;

    justify-content: center;
  }

  .match-correction__server-options {
    grid-template-columns: 1fr;
  }
.match-control button:focus-visible {
  outline:
    3px solid
    rgba(0, 181, 26, 0.2);

  outline-offset: 2px;
}

@media (max-width: 350px) {
  .match-control {
    --control-page-padding: 10px;
  }

  .match-control__state-actions {
    gap: 6px;
  }

  .match-control__dock-inner {
    gap: 6px;

    padding-left: 8px;
    padding-right: 8px;
  }

  .score-action {
    min-width: 0;

    padding-left: 8px;
    padding-right: 8px;
  }

  .match-control__correction-button,
  .match-control__voice-button {
    flex: 0 0 44px;
  }

  .match-correction {
    border-radius: 8px;
  }

  .match-correction__options {
    padding: 9px;
  }

  .match-correction__server-options {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
    .match-control *,
    .match-control *::before,
    .match-control *::after {
      scroll-behavior: auto !important;
      transition: none !important;
      animation: none !important;
    }
  }

  .match-control__point--confirmed {
    animation: point-confirmation 360ms cubic-bezier(0.22, 0.8, 0.22, 1);
  }

  @keyframes point-confirmation {
    0% {
      transform: translateY(0) scale(1);
    }

    38% {
      transform: translateY(-3px) scale(1.08);
    }

    100% {
      transform: translateY(0) scale(1);
    }
  }

  .score-action--confirmed {
    border-color: rgba(0, 181, 26, 0.34);

    background: var(--control-soft-green);
  }
}
</style>
