<script setup>
import CategoryStatusBadge from './CategoryStatusBadge.vue'
import { formatAppDate } from '../../utils/dateFormat'

const props = defineProps({
  match: {
    type: Object,
    required: true,
  },
  categoryName: {
    type: String,
    default: '',
  },
  currentPlayerId: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  open: (match) => Boolean(match),
})

function isCurrentPlayerMatch(match) {
  return Boolean(
    props.currentPlayerId &&
      (match.player1Id === props.currentPlayerId || match.player2Id === props.currentPlayerId),
  )
}
</script>

<template>
  <button
    type="button"
    class="match-fixture-row"
    :class="{ 'match-fixture-row--current-player': isCurrentPlayerMatch(match) }"
    @click="emit('open', match)"
  >
    <span class="match-fixture-row__time">{{ match.scheduledTime || '-' }}</span>
    <span>{{ match.court || '-' }}</span>
    <span class="match-fixture-row__category">{{ categoryName }}</span>
    <span>{{ match.scheduledDate ? formatAppDate(match.scheduledDate, { includeYear: false }) : '-' }}</span>
    <span>{{ match.groupId ? `Group ${match.groupId}` : match.matchCode || match.round }}</span>
    <strong>
      {{ match.player1Name || 'TBD' }} vs {{ match.player2Name || 'TBD' }}
      <em v-if="isCurrentPlayerMatch(match)">You</em>
    </strong>
    <CategoryStatusBadge :status="match.status" />
    <span class="match-fixture-row__score">{{ match.score || '-' }}</span>
  </button>
</template>

<style scoped>
.match-fixture-row {
  display: grid;
  grid-template-columns: 70px 80px 120px 110px 90px minmax(220px, 1fr) 100px 70px;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-width: 890px;
  min-height: 52px;
  border: 0;
  border-bottom: 1px solid var(--tournament-line);
  padding: 10px 0;
  background: transparent;
  color: var(--tournament-ink);
  text-align: left;
  font-size: 13px;
}

.match-fixture-row:hover {
  background: #fafbfc;
}

.match-fixture-row--current-player {
  background: rgba(0, 181, 26, 0.045);
  box-shadow: inset 4px 0 0 var(--tournament-green);
}

.match-fixture-row span {
  color: var(--tournament-muted);
  font-weight: var(--font-weight-semibold);
}

.match-fixture-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--tournament-ink);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-fixture-row strong em {
  display: inline-flex;
  margin-left: 6px;
  border-radius: 999px;
  padding: 1px 6px;
  background: var(--tournament-green-soft);
  color: var(--tournament-green-dark);
  font-size: 10px;
  font-style: normal;
  font-weight: var(--font-weight-bold);
}

.match-fixture-row__category {
  color: var(--tournament-blue) !important;
  font-weight: var(--font-weight-semibold) !important;
}

.match-fixture-row__score {
  color: var(--tournament-green-dark) !important;
  font-weight: var(--font-weight-semibold) !important;
}
</style>
