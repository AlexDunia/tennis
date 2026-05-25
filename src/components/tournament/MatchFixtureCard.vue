<script setup>
import CategoryStatusBadge from './CategoryStatusBadge.vue'

defineProps({
  match: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits({
  score: (match) => Boolean(match),
  view: (match) => Boolean(match),
})
</script>

<template>
  <article class="match-fixture-card t-fade-up" :class="{ 'match-fixture-card--bye': match.isBye }">
    <div class="match-fixture-card__top">
      <div class="match-fixture-card__badges">
        <span class="match-fixture-card__round">
          {{ match.groupId ? `Group ${match.groupId}` : match.matchCode || match.round }}
        </span>
        <CategoryStatusBadge :status="match.status" />
      </div>
      <strong v-if="match.score" class="match-fixture-card__score">{{ match.score }}</strong>
    </div>

    <div v-if="match.isBye" class="match-fixture-card__bye">
      {{ match.player1Name === 'BYE' ? match.player2Name : match.player1Name }} - BYE (Walkover)
    </div>

    <div v-else class="match-fixture-card__body">
      <div class="match-fixture-card__player">
        <span>{{ match.player1Seed || '-' }}</span>
        <strong>{{ match.player1Name || 'TBD' }}</strong>
      </div>
      <small>vs</small>
      <div class="match-fixture-card__player">
        <span>{{ match.player2Seed || '-' }}</span>
        <strong>{{ match.player2Name || 'TBD' }}</strong>
      </div>
    </div>

    <footer class="match-fixture-card__footer">
      <div class="match-fixture-card__meta">
        <span>{{ match.scheduledDate ? `${match.scheduledDate} ${match.scheduledTime || ''}` : 'Not yet scheduled' }}</span>
        <span>{{ match.court || 'No court' }}</span>
      </div>
      <div v-if="!match.isBye" class="match-fixture-card__actions">
        <button
          v-if="match.status === 'pending'"
          class="t-button t-button--primary"
          type="button"
          @click="emit('score', match)"
        >
          Enter Score
        </button>
        <button v-else class="t-button t-button--secondary" type="button" @click="emit('view', match)">
          View Match
        </button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.match-fixture-card {
  display: grid;
  gap: 12px;
  border: 1px solid var(--tournament-line);
  border-radius: 10px;
  background: #ffffff;
  padding: 14px 16px;
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.match-fixture-card:hover {
  border-color: rgba(0, 181, 26, 0.28);
  box-shadow: var(--tournament-card-shadow);
}

.match-fixture-card--bye {
  background: var(--tournament-shell);
  opacity: 0.78;
}

.match-fixture-card__top,
.match-fixture-card__footer,
.match-fixture-card__badges,
.match-fixture-card__actions,
.match-fixture-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.match-fixture-card__top,
.match-fixture-card__footer {
  justify-content: space-between;
}

.match-fixture-card__round {
  border-radius: 20px;
  padding: 3px 9px;
  background: var(--tournament-blue-soft);
  color: var(--tournament-blue);
  font-size: 11px;
  font-weight: 800;
}

.match-fixture-card__score {
  color: var(--tournament-green-dark);
  font-size: 16px;
}

.match-fixture-card__body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.match-fixture-card__player {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
}

.match-fixture-card__player span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--tournament-shell);
  color: var(--tournament-muted);
  font-size: 10px;
  font-weight: 800;
}

.match-fixture-card__player strong {
  min-width: 0;
  color: var(--tournament-ink);
  font-weight: 800;
}

.match-fixture-card__body small {
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.match-fixture-card__meta {
  flex-wrap: wrap;
  color: var(--tournament-faint);
  font-size: 11px;
  font-weight: 700;
}

.match-fixture-card__meta span + span::before {
  content: '.';
  margin-right: 8px;
}

.match-fixture-card__bye {
  color: var(--tournament-muted);
  font-size: 13px;
  font-weight: 700;
}

@media (max-width: 640px) {
  .match-fixture-card__top,
  .match-fixture-card__footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
