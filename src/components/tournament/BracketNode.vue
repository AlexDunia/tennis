<script setup>
defineProps({
  match: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  score: (match) => Boolean(match),
})
</script>

<template>
  <article class="bracket-node" :class="{ 'bracket-node--done': match.status === 'completed' }">
    <span class="bracket-node__code">{{ match.matchCode }}</span>
    <div class="bracket-node__player" :class="{ 'bracket-node__player--winner': match.winnerId === match.player1Id }">
      <strong>{{ match.player1Name || 'TBD' }}</strong>
      <span v-if="match.p1Sets !== null">{{ match.p1Sets }}</span>
    </div>
    <div class="bracket-node__player" :class="{ 'bracket-node__player--winner': match.winnerId === match.player2Id }">
      <strong>{{ match.player2Name || 'TBD' }}</strong>
      <span v-if="match.p2Sets !== null">{{ match.p2Sets }}</span>
    </div>
    <button
      v-if="match.status === 'pending' && match.player1Id && match.player2Id"
      class="t-button t-button--primary"
      type="button"
      @click="emit('score', match)"
    >
      Enter Score
    </button>
  </article>
</template>

<style scoped>
.bracket-node {
  position: relative;
  min-width: 180px;
  overflow: hidden;
  border: 1.5px solid var(--tournament-line);
  border-radius: 10px;
  background: #ffffff;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.bracket-node:hover {
  border-color: rgba(0, 181, 26, 0.38);
  box-shadow: var(--tournament-card-shadow);
}

.bracket-node--done {
  border-color: rgba(0, 181, 26, 0.42);
}

.bracket-node__code {
  position: absolute;
  top: 4px;
  right: 7px;
  color: var(--tournament-faint);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.bracket-node__player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--tournament-line);
  padding: 9px 10px;
}

.bracket-node__player:last-of-type {
  border-bottom: none;
}

.bracket-node__player--winner {
  background: var(--tournament-green-soft);
}

.bracket-node__player strong {
  min-width: 0;
  overflow: hidden;
  color: var(--tournament-ink);
  font-size: 12px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bracket-node__player span {
  color: var(--tournament-green-dark);
  font-size: 13px;
  font-weight: 900;
}

.bracket-node button {
  width: calc(100% - 16px);
  min-height: 30px;
  margin: 8px;
  padding: 5px 10px;
  font-size: 11px;
}
</style>
