<template>
  <article class="player-card">
    <div class="player-card__identity">
      <div class="player-card__rank-badge">#{{ player.rank }}</div>
      <div>
        <h3 class="player-card__name">{{ player.name }}</h3>
        <p class="player-card__record">Record {{ player.wins }}-{{ player.losses }}</p>
      </div>
    </div>

    <div class="player-card__meta">
      <span class="player-card__meta-pill">{{ player.matchesPlayed }} matches</span>
      <BaseButton
        v-if="showChallenge"
        type="button"
        variant="secondary"
        @click="$emit('challenge', player.id)"
      >
        Challenge
      </BaseButton>
    </div>
  </article>
</template>

<script setup>
import BaseButton from './BaseButton.vue'

defineProps({
  player: { type: Object, required: true },
  showChallenge: { type: Boolean, default: false },
})
</script>

<style scoped>
.player-card {
  background: #ffffff;
  border-radius: 1rem;
  padding: 1rem 1.1rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.player-card__identity {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.player-card__rank-badge {
  min-width: 2.9rem;
  height: 2.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
  font-size: 0.92rem;
  font-weight: 800;
}

.player-card__name {
  margin: 0;
  font-size: 0.98rem;
}

.player-card__record {
  margin: 0.25rem 0 0;
  color: var(--color-muted);
  font-size: 0.88rem;
}

.player-card__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: end;
}

.player-card__meta-pill {
  padding: 0.42rem 0.72rem;
  border-radius: 999px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 0.82rem;
  font-weight: 600;
}

@media (max-width: 720px) {
  .player-card {
    flex-direction: column;
    align-items: start;
  }

  .player-card__meta {
    justify-content: start;
  }
}
</style>
