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
  return 'Live Game'
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
  background: radial-gradient(circle at top, #fff, #f5f5f5 70%);
  border-radius: 1.5rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  border: 2px solid #bf0a30;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
}
.tennis-scoreboard__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: center;
}
.tennis-scoreboard__status {
  font-weight: 700;
  font-size: 1.15rem;
  margin: 0;
}
.tennis-scoreboard__mode,
.tennis-scoreboard__winner {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(0, 0, 0, 0.65);
}
.tennis-scoreboard__players {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.tennis-scoreboard__player {
  background: #101820;
  color: #fff;
  border-radius: 1rem;
  padding: 1rem;
  text-align: center;
  box-shadow: inset 0 -4px 0 rgba(255, 255, 255, 0.2);
}
.tennis-scoreboard__player-label {
  margin: 0;
  font-size: 0.85rem;
  letter-spacing: 0.1rem;
  text-transform: uppercase;
}
.tennis-scoreboard__player-points {
  margin: 0.5rem 0 0;
  font-size: 1.5rem;
  font-weight: 800;
}
.tennis-scoreboard__sets {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.75rem;
}
.tennis-scoreboard__set {
  background: #fff;
  border-radius: 0.9rem;
  padding: 0.8rem;
  text-align: center;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.tennis-scoreboard__set-label {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.1rem;
  color: rgba(0, 0, 0, 0.6);
}
.tennis-scoreboard__set-score {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  font-weight: 700;
}
.tennis-scoreboard__set-tiebreak {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: #bf0a30;
}
.tennis-scoreboard__controls {
  display: flex;
  gap: 1rem;
}
.tennis-scoreboard__button {
  flex: 1;
  border-radius: 1rem;
  border: none;
  padding: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.tennis-scoreboard__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tennis-scoreboard__button--left {
  background: linear-gradient(135deg, #bf0a30, #fcd200);
  color: #101820;
}
.tennis-scoreboard__button--right {
  background: linear-gradient(135deg, #101820, #bf0a30);
  color: #fff;
}
.tennis-scoreboard__button:not(:disabled):hover {
  transform: translateY(-3px);
}
</style>
