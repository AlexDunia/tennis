<script setup>
import { computed } from 'vue'
import { describePoint, formatSetSummary } from '../utils/tennisScoring'

const props = defineProps({
  scoreboard: {
    type: Object,
    required: true,
  },
  elapsedSeconds: {
    type: Number,
    default: 0,
  },
  pointClockSeconds: {
    type: Number,
    default: 0,
  },
  serverKey: {
    type: String,
    default: 'playerA',
  },
  projector: {
    type: Boolean,
    default: false,
  },
  theme: {
    type: String,
    default: 'light',
    validator: (value) => ['light', 'dark'].includes(value),
  },
})

const emit = defineEmits({
  point: (playerKey) => ['playerA', 'playerB'].includes(playerKey),
})

const playerKeys = ['playerA', 'playerB']
const setSummary = computed(() => formatSetSummary(props.scoreboard))
const scoreboardPlayers = computed(() => ({
  playerA: props.scoreboard.players?.playerA ?? 'Player 1',
  playerB: props.scoreboard.players?.playerB ?? 'Player 2',
}))
const isTieBreakActive = computed(() => props.scoreboard.currentGame?.inTieBreak)
const matchWinner = computed(() => props.scoreboard.matchWinner)
const pointColumnLabel = computed(() => (isTieBreakActive.value ? 'Tie-break' : 'Game'))
const pointClockRemaining = computed(() => Math.max(0, 25 - Number(props.pointClockSeconds || 0)))
const pointClockState = computed(() => {
  if (pointClockRemaining.value <= 5) {
    return 'danger'
  }

  if (pointClockRemaining.value <= 10) {
    return 'warn'
  }

  return 'ok'
})
const statusLabel = computed(() => {
  if (matchWinner.value) {
    return `${getPlayerName(matchWinner.value)} wins the match`
  }

  if (isTieBreakActive.value) {
    return 'Tie-break'
  }

  return 'Live'
})
const liveStateCopy = computed(() => {
  if (matchWinner.value) {
    return 'Final score saved from completed sets.'
  }

  if (isTieBreakActive.value) {
    return 'Tie-break: first to 7, win by 2.'
  }

  const pointA = describePoint(props.scoreboard, 'playerA')
  const pointB = describePoint(props.scoreboard, 'playerB')
  if (pointA === 'Deuce' && pointB === 'Deuce') {
    return 'Deuce: win two points in a row.'
  }

  if (pointA === 'Advantage' || pointB === 'Advantage') {
    return `Advantage ${pointA === 'Advantage' ? getPlayerName('playerA') : getPlayerName('playerB')}.`
  }

  return 'Point-by-point scoring is live.'
})

function getPlayerName(playerKey) {
  return scoreboardPlayers.value[playerKey] ?? ''
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function handlePointAward(playerKey) {
  emit('point', playerKey)
}
</script>

<template>
  <section
    class="tennis-scoreboard"
    :class="{
      'tennis-scoreboard--projector': projector,
      'tennis-scoreboard--dark': theme === 'dark',
      'tennis-scoreboard--light': theme === 'light',
    }"
  >
    <header class="tennis-scoreboard__header">
      <div>
        <p class="tennis-scoreboard__status">{{ statusLabel }}</p>
        <p class="tennis-scoreboard__mode">Best of {{ scoreboard.bestOfSets }}</p>
      </div>
      <div class="tennis-scoreboard__clocks" aria-label="Match clocks">
        <span>
          <small>Match time</small>
          <strong>{{ formatDuration(elapsedSeconds) }}</strong>
        </span>
        <span :class="`tennis-scoreboard__shot-clock--${pointClockState}`">
          <small>Point clock</small>
          <strong>{{ pointClockRemaining }}</strong>
        </span>
      </div>
    </header>

    <div class="tennis-scoreboard__table">
      <div class="tennis-scoreboard__table-head">
        <span>Player</span>
        <span
          v-for="set in setSummary"
          :key="set.label"
        >
          {{ set.label.replace('Set ', 'S') }}
        </span>
        <span>{{ pointColumnLabel }}</span>
      </div>

      <article
        v-for="key in playerKeys"
        :key="key"
        class="tennis-scoreboard__player-row"
        :class="{
          'tennis-scoreboard__player-row--serving': serverKey === key,
          'tennis-scoreboard__player-row--winner': matchWinner === key,
        }"
      >
        <div class="tennis-scoreboard__player-name">
          <span v-if="serverKey === key" aria-label="Serving">S</span>
          <strong>{{ getPlayerName(key) }}</strong>
        </div>
        <span
          v-for="set in setSummary"
          :key="`${key}-${set.label}`"
          class="tennis-scoreboard__set-score"
        >
          <strong>{{ key === 'playerA' ? set.playerAGames : set.playerBGames }}</strong>
          <small v-if="set.tieBreak">
            TB {{ key === 'playerA' ? set.tieBreak.score.playerA : set.tieBreak.score.playerB }}
          </small>
        </span>
        <span
          :key="`${key}-${describePoint(scoreboard, key)}-${scoreboard.currentGame?.tieBreakPoints?.[key]}`"
          class="tennis-scoreboard__point-score"
        >
          {{ describePoint(scoreboard, key) }}
        </span>
      </article>
    </div>

    <p class="tennis-scoreboard__state-copy">{{ liveStateCopy }}</p>

    <div v-if="matchWinner" class="tennis-scoreboard__winner">
      Winner: {{ getPlayerName(matchWinner) }}
    </div>

    <div class="tennis-scoreboard__controls">
      <button
        class="tennis-scoreboard__button tennis-scoreboard__button--left"
        type="button"
        :disabled="matchWinner"
        @click="handlePointAward('playerA')"
      >
        Point for {{ scoreboardPlayers.playerA }}
      </button>
      <button
        class="tennis-scoreboard__button tennis-scoreboard__button--right"
        type="button"
        :disabled="matchWinner"
        @click="handlePointAward('playerB')"
      >
        Point for {{ scoreboardPlayers.playerB }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.tennis-scoreboard {
  display: grid;
  gap: 16px;
  width: min(100%, 980px);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 18px;
  background: #ffffff;
  box-shadow: var(--shadow-soft);
}

.tennis-scoreboard--projector {
  width: min(100%, 1180px);
  border-color: rgba(0, 181, 26, 0.24);
  background: #07110d;
  color: #ffffff;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
}

.tennis-scoreboard--projector.tennis-scoreboard--light {
  border-color: rgba(0, 181, 26, 0.2);
  background: #f8faf8;
  color: #07110d;
}

.tennis-scoreboard__header,
.tennis-scoreboard__clocks,
.tennis-scoreboard__controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tennis-scoreboard__header {
  justify-content: space-between;
}

.tennis-scoreboard__status,
.tennis-scoreboard__mode,
.tennis-scoreboard__state-copy,
.tennis-scoreboard__winner,
.tennis-scoreboard__clocks small,
.tennis-scoreboard__clocks strong {
  margin: 0;
}

.tennis-scoreboard__status {
  color: var(--color-primary-strong);
  font-size: clamp(14px, 2vw, 18px);
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tennis-scoreboard--projector .tennis-scoreboard__status {
  color: #5cff93;
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__status {
  color: var(--color-primary-strong);
}

.tennis-scoreboard__mode {
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 700;
}

.tennis-scoreboard--projector .tennis-scoreboard__mode {
  color: rgba(255, 255, 255, 0.72);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__mode {
  color: var(--color-muted);
}

.tennis-scoreboard__clocks span {
  display: grid;
  min-width: 112px;
  border-radius: 10px;
  padding: 9px 12px;
  background: var(--color-surface-muted);
  text-align: center;
}

.tennis-scoreboard--projector .tennis-scoreboard__clocks span {
  background: rgba(255, 255, 255, 0.1);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__clocks span {
  background: #ffffff;
}

.tennis-scoreboard__clocks small {
  color: var(--color-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tennis-scoreboard--projector .tennis-scoreboard__clocks small {
  color: rgba(255, 255, 255, 0.66);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__clocks small {
  color: var(--color-muted);
}

.tennis-scoreboard__clocks strong {
  color: var(--color-text);
  font-size: clamp(22px, 4vw, 36px);
  line-height: 1;
}

.tennis-scoreboard--projector .tennis-scoreboard__clocks strong {
  color: #ffffff;
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__clocks strong {
  color: var(--color-text);
}

.tennis-scoreboard__shot-clock--warn strong {
  color: #f59e0b;
}

.tennis-scoreboard__shot-clock--danger strong {
  color: #ef4444;
}

.tennis-scoreboard__table {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  animation: scoreboardSlideIn 260ms ease both;
}

.tennis-scoreboard--projector .tennis-scoreboard__table {
  border-color: rgba(255, 255, 255, 0.14);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__table {
  border-color: var(--color-border);
}

.tennis-scoreboard__table-head,
.tennis-scoreboard__player-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) repeat(3, minmax(62px, 0.24fr)) minmax(96px, 0.34fr);
  align-items: center;
  gap: 8px;
}

.tennis-scoreboard__table-head {
  min-height: 42px;
  padding: 0 14px;
  background: var(--color-surface-muted);
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tennis-scoreboard--projector .tennis-scoreboard__table-head {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.58);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__table-head {
  background: #edf2f7;
  color: var(--color-muted);
}

.tennis-scoreboard__player-row {
  min-height: clamp(74px, 12vw, 118px);
  border-top: 1px solid var(--color-border);
  padding: 12px 14px;
  background: #ffffff;
}

.tennis-scoreboard--projector .tennis-scoreboard__player-row {
  border-top-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.045);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__player-row {
  border-top-color: var(--color-border);
  background: #ffffff;
}

.tennis-scoreboard__player-row--serving {
  box-shadow: inset 5px 0 0 var(--color-accent-bright);
}

.tennis-scoreboard__player-row--winner {
  background: rgba(0, 181, 26, 0.08);
}

.tennis-scoreboard__player-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.tennis-scoreboard__player-name span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-accent-bright);
  color: #ffffff;
  font-size: 11px;
  font-weight: 900;
}

.tennis-scoreboard__player-name strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: clamp(17px, 3vw, 32px);
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tennis-scoreboard--projector .tennis-scoreboard__player-name strong {
  color: #ffffff;
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__player-name strong {
  color: var(--color-text);
}

.tennis-scoreboard__set-score,
.tennis-scoreboard__point-score {
  color: var(--color-text);
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.tennis-scoreboard__set-score {
  display: grid;
  justify-items: center;
  gap: 4px;
}

.tennis-scoreboard__set-score strong {
  color: inherit;
  font: inherit;
}

.tennis-scoreboard__set-score small {
  border-radius: 999px;
  padding: 2px 6px;
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.tennis-scoreboard--projector .tennis-scoreboard__set-score,
.tennis-scoreboard--projector .tennis-scoreboard__point-score {
  color: #ffffff;
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__set-score {
  color: var(--color-text);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__point-score {
  color: var(--color-primary-strong);
}

.tennis-scoreboard__set-score {
  font-size: clamp(24px, 5vw, 52px);
}

.tennis-scoreboard__point-score {
  color: var(--color-primary-strong);
  font-size: clamp(25px, 6vw, 64px);
  animation: pointPulse 180ms ease both;
}

.tennis-scoreboard--projector .tennis-scoreboard__point-score {
  color: #5cff93;
}

.tennis-scoreboard__winner {
  border-radius: 12px;
  padding: 12px;
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
  font-size: clamp(18px, 4vw, 34px);
  font-weight: 900;
  text-align: center;
  animation: scoreboardSlideIn 240ms ease both;
}

.tennis-scoreboard__state-copy {
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(0, 181, 26, 0.07);
  color: var(--color-muted);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.tennis-scoreboard--projector .tennis-scoreboard__state-copy {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.78);
}

.tennis-scoreboard--projector.tennis-scoreboard--light .tennis-scoreboard__state-copy {
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-muted);
}

.tennis-scoreboard__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tennis-scoreboard__button {
  min-height: 56px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: clamp(13px, 2vw, 16px);
  font-weight: 900;
  cursor: pointer;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    border-color 120ms ease;
}

.tennis-scoreboard__button:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.tennis-scoreboard__button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.tennis-scoreboard__button:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
}

.tennis-scoreboard__button--left {
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
}

.tennis-scoreboard__button--right {
  background: rgba(255, 127, 50, 0.1);
  color: #b35a1f;
}

@media (max-width: 720px) {
  .tennis-scoreboard__header,
  .tennis-scoreboard__clocks {
    align-items: stretch;
    flex-direction: column;
  }

  .tennis-scoreboard__controls {
    grid-template-columns: 1fr;
  }

  .tennis-scoreboard__table-head,
  .tennis-scoreboard__player-row {
    grid-template-columns: minmax(120px, 1fr) repeat(3, minmax(36px, 0.22fr)) minmax(64px, 0.34fr);
  }
}

@keyframes pointPulse {
  from {
    opacity: 0.62;
    transform: translateY(4px) scale(0.96);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes scoreboardSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
