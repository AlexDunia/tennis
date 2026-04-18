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
  background: var(--color-surface);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.player-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-strong);
}

.player-card__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.player-card__rank-badge {
  min-width: 3rem;
  height: 3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  background: rgba(0, 181, 26, 0.12);
  color: var(--color-primary-strong);
  font-size: 0.95rem;
  font-weight: 800;
}

.player-card__name {
  margin: 0;
  font-size: 1rem;
}

.player-card__record {
  margin: 0.3rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.player-card__meta {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
  justify-content: end;
}

.player-card__meta-pill {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-text-soft);
  font-size: 0.84rem;
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
