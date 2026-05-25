<script setup>
import CategoryStatusBadge from './CategoryStatusBadge.vue'

defineProps({
  match: {
    type: Object,
    required: true,
  },
  categoryName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits({
  open: (match) => Boolean(match),
})
</script>

<template>
  <button type="button" class="match-fixture-row" @click="emit('open', match)">
    <span class="match-fixture-row__time">{{ match.scheduledTime || '-' }}</span>
    <span>{{ match.court || '-' }}</span>
    <span class="match-fixture-row__category">{{ categoryName }}</span>
    <span>{{ match.groupId ? `Group ${match.groupId}` : match.matchCode || match.round }}</span>
    <strong>{{ match.player1Name || 'TBD' }} vs {{ match.player2Name || 'TBD' }}</strong>
    <CategoryStatusBadge :status="match.status" />
    <span class="match-fixture-row__score">{{ match.score || '-' }}</span>
  </button>
</template>

<style scoped>
.match-fixture-row {
  display: grid;
  grid-template-columns: 70px 80px 120px 90px minmax(220px, 1fr) 100px 70px;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-width: 760px;
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

.match-fixture-row span {
  color: var(--tournament-muted);
  font-weight: 600;
}

.match-fixture-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--tournament-ink);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-fixture-row__category {
  color: var(--tournament-blue) !important;
  font-weight: 800 !important;
}

.match-fixture-row__score {
  color: var(--tournament-green-dark) !important;
  font-weight: 800 !important;
}
</style>
