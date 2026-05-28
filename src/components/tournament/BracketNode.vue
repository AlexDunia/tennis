<script setup>
const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
  canManage: {
    type: Boolean,
    default: false,
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  score: (match) => Boolean(match),
})

function canScoreMatch(match) {
  return (
    props.canManage &&
    ['pending', 'completed', 'walkover'].includes(match.status) &&
    match.player1Id &&
    match.player2Id
  )
}

function scoreActionLabel(match) {
  return ['completed', 'walkover'].includes(match.status) ? 'Edit Result' : 'Enter Score'
}

function isCurrentPlayer(playerId) {
  return Boolean(props.currentPlayerId && playerId === props.currentPlayerId)
}

function isCurrentPlayerMatch(match) {
  return isCurrentPlayer(match.player1Id) || isCurrentPlayer(match.player2Id)
}
</script>

<template>
  <article
    class="bracket-node"
    :class="{
      'bracket-node--done': ['completed', 'walkover'].includes(match.status),
      'bracket-node--current-player': isCurrentPlayerMatch(match),
    }"
  >
    <span class="bracket-node__code">{{ match.matchCode }}</span>
    <div
      class="bracket-node__player"
      :class="{
        'bracket-node__player--winner': match.winnerId === match.player1Id,
        'bracket-node__player--current': isCurrentPlayer(match.player1Id),
      }"
    >
      <strong>{{ match.player1Name || 'TBD' }}</strong>
      <em v-if="isCurrentPlayer(match.player1Id)">You</em>
      <span v-if="match.p1Sets !== null">{{ match.p1Sets }}</span>
    </div>
    <div
      class="bracket-node__player"
      :class="{
        'bracket-node__player--winner': match.winnerId === match.player2Id,
        'bracket-node__player--current': isCurrentPlayer(match.player2Id),
      }"
    >
      <strong>{{ match.player2Name || 'TBD' }}</strong>
      <em v-if="isCurrentPlayer(match.player2Id)">You</em>
      <span v-if="match.p2Sets !== null">{{ match.p2Sets }}</span>
    </div>
    <button
      v-if="canScoreMatch(match)"
      class="t-button t-button--primary"
      type="button"
      @click="emit('score', match)"
    >
      {{ scoreActionLabel(match) }}
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

.bracket-node--current-player {
  border-color: rgba(0, 181, 26, 0.45);
  box-shadow: var(--tournament-card-shadow);
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

.bracket-node__player--current {
  background: rgba(0, 181, 26, 0.08);
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

.bracket-node__player em {
  margin-left: auto;
  border-radius: 999px;
  padding: 1px 6px;
  background: #ffffff;
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-style: normal;
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
