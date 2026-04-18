<script setup>
// IMPORTS
import { computed } from 'vue'
import { formatSetSummary } from '../utils/tennisScoring'

// PROPS
const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
})

// EMITS
const emit = defineEmits(['join'])

// ROUTER / ROUTE
// none

// STORES
// none

// REACTIVE STATE
const isJoining = computed(() => props.match.status === 'live')

// COMPUTED PROPERTIES
const playerList = computed(() => props.match.players.join(' • '))
const setSummary = computed(() => formatSetSummary(props.match.scoreboard).slice(0, props.match.bestOfSets ?? 3))
const playersNeeded = computed(() => props.match.maxPlayers - props.match.players.length)
const statusLabel = computed(() => {
  if (props.match.status === 'live') {
    return 'Live Match'
  }
  if (playersNeeded.value <= 0) {
    return 'Waiting for score'
  }
  return `${playersNeeded.value} slot${playersNeeded.value === 1 ? '' : 's'} open`
})
const formattedMatchTime = computed(() => {
  return new Date(props.match.time).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

// METHODS
function handleJoin() {
  emit('join', props.match.id)
}

// WATCHERS
// none

// LIFECYCLE HOOKS
// none
</script>

<template>
  <article class="match-card">
    <header class="match-card__header">
      <h3 class="match-card__title">{{ props.match.title }}</h3>
      <span class="match-card__status">{{ statusLabel }}</span>
    </header>
    <p class="match-card__meta">
      {{ props.match.type }} · {{ props.match.level }} · {{ formattedMatchTime }}
    </p>
    <p class="match-card__players">{{ playerList }}</p>
    <div class="match-card__sets">
      <div class="match-card__set" v-for="set in setSummary" :key="set.label">
        <span class="match-card__set-label">{{ set.label }}</span>
        <span class="match-card__set-score">{{ set.playerAGames }} - {{ set.playerBGames }}</span>
      </div>
    </div>
    <div class="match-card__footer">
      <div class="match-card__court">Court: {{ props.match.court }}</div>
      <button class="match-card__button" type="button" @click="handleJoin">
        {{ isJoining ? 'Track Live' : 'Join Match' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.match-card {
  border-radius: 1.25rem;
  background: #101820;
  color: #fff;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}
.match-card__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.match-card__title {
  margin: 0;
  font-size: 1.1rem;
}
.match-card__status {
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.6);
}
.match-card__meta,
.match-card__players {
  margin: 0;
  font-size: 0.95rem;
}
.match-card__sets {
  display: flex;
  gap: 0.5rem;
}
.match-card__set {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.35rem 0.6rem;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.match-card__set-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1rem;
}
.match-card__set-score {
  font-size: 1rem;
  font-weight: 600;
}
.match-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.match-card__button {
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1.25rem;
  background: #bf0a30;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.match-card__court {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.75);
}
</style>
