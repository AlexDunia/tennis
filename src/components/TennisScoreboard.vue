<script setup>
// IMPORTS
import { computed } from 'vue'
import { describePoint, formatSetSummary } from '../utils/tennisScoring'

// PROPS
const props = defineProps({
  scoreboard: {
    type: Object,
    required: true,
  },
})

// EMITS
const emit = defineEmits(['point'])

// ROUTER / ROUTE
// none

// STORES
// none

// REACTIVE STATE
const playerKeys = ['playerA', 'playerB']

// COMPUTED PROPERTIES
const setSummary = computed(() => formatSetSummary(props.scoreboard))
const scoreboardPlayers = computed(() => ({
  playerA: props.scoreboard.players?.playerA ?? 'Server',
  playerB: props.scoreboard.players?.playerB ?? 'Returner',
}))
const isTieBreakActive = computed(() => props.scoreboard.currentGame.inTieBreak)
const matchWinner = computed(() => props.scoreboard.matchWinner)
const statusLabel = computed(() => {
  if (matchWinner.value) {
    return `${getPlayerName(matchWinner.value)} wins the match`
  }
  if (isTieBreakActive.value) {
    return 'Tie-break in progress'
  }
  return 'Live game'
})

// METHODS
function getPlayerName(playerKey) {
  return scoreboardPlayers.value[playerKey] ?? ''
}
function handlePointAward(playerKey) {
  emit('point', playerKey)
}

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <section class="tennis-scoreboard">
    <header class="tennis-scoreboard__header">
      <p class="tennis-scoreboard__status">{{ statusLabel }}</p>
      <p class="tennis-scoreboard__mode">Best of {{ props.scoreboard.bestOfSets }}</p>
      <p v-if="matchWinner" class="tennis-scoreboard__winner">
        Winner: {{ getPlayerName(matchWinner) }}
      </p>
    </header>

    <div class="tennis-scoreboard__players">
      <article class="tennis-scoreboard__player" v-for="key in playerKeys" :key="key">
        <p class="tennis-scoreboard__player-label">{{ getPlayerName(key) }}</p>
        <p class="tennis-scoreboard__player-points">{{ describePoint(props.scoreboard, key) }}</p>
      </article>
    </div>

    <div class="tennis-scoreboard__sets">
      <article class="tennis-scoreboard__set" v-for="set in setSummary" :key="set.label">
        <p class="tennis-scoreboard__set-label">{{ set.label }}</p>
        <p class="tennis-scoreboard__set-score">{{ set.playerAGames }} - {{ set.playerBGames }}</p>
        <p v-if="set.tieBreak" class="tennis-scoreboard__set-tiebreak">
          TB {{ set.tieBreak.score.playerA }} - {{ set.tieBreak.score.playerB }}
        </p>
      </article>
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
  width: min(100%, 860px);
  background: #ffffff;
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.tennis-scoreboard__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: center;
}

.tennis-scoreboard__status {
  margin: 0;
  color: var(--color-primary-strong);
  font-size: 0.95rem;
  font-weight: 700;
}

.tennis-scoreboard__mode,
.tennis-scoreboard__winner {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-muted);
}

.tennis-scoreboard__players {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.tennis-scoreboard__player {
  background: var(--color-surface-muted);
  color: var(--color-text);
  border-radius: 1rem;
  padding: 1rem;
  text-align: center;
  border: 1px solid var(--color-border);
}

.tennis-scoreboard__player-label {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08rem;
  text-transform: uppercase;
  color: var(--color-muted);
}

.tennis-scoreboard__player-points {
  margin: 0.5rem 0 0;
  font-size: 1.7rem;
  font-weight: 800;
}

.tennis-scoreboard__sets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.75rem;
}

.tennis-scoreboard__set {
  background: #ffffff;
  border-radius: 0.95rem;
  padding: 0.9rem;
  text-align: center;
  border: 1px solid var(--color-border);
}

.tennis-scoreboard__set-label {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.08rem;
  color: var(--color-muted);
}

.tennis-scoreboard__set-score {
  margin: 0.35rem 0 0;
  font-size: 1rem;
  font-weight: 700;
}

.tennis-scoreboard__set-tiebreak {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--color-clay);
  font-weight: 700;
}

.tennis-scoreboard__controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.tennis-scoreboard__button {
  border-radius: 0.95rem;
  border: 1px solid var(--color-border);
  padding: 0.85rem 0.95rem;
  font-size: 0.95rem;
  font-weight: 700;
  transition:
    transform 0.15s ease-in-out,
    box-shadow 0.15s ease-in-out,
    border-color 0.15s ease-in-out;
}

.tennis-scoreboard__button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tennis-scoreboard__button--left {
  background: rgba(0, 181, 26, 0.1);
  color: var(--color-primary-strong);
}

.tennis-scoreboard__button--right {
  background: rgba(255, 127, 50, 0.1);
  color: #b35a1f;
}

.tennis-scoreboard__button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

@media (max-width: 720px) {
  .tennis-scoreboard__players,
  .tennis-scoreboard__controls {
    grid-template-columns: 1fr;
  }
}

.tennis-scoreboard__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tennis-scoreboard__button--left {
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
}

.tennis-scoreboard__button--right {
  background: rgba(255, 127, 50, 0.1);
  color: #b35a1f;
}

.tennis-scoreboard__button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

@media (max-width: 720px) {
  .tennis-scoreboard__players,
  .tennis-scoreboard__controls {
    grid-template-columns: 1fr;
    display: grid;
  }
}
</style>
