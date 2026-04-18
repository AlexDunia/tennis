<template>
  <article class="player-card">
    <div class="player-card__identity">
      <div class="player-card__rank-badge">#{{ player.rank }}</div>
      <div>
        <h3 class="player-card__name">{{ player.name }}</h3>
        <p class="player-card__record">Record: {{ player.wins }}-{{ player.losses }}</p>
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
  background: rgba(255, 249, 231, 0.84);
  border-radius: 1.35rem;
  padding: 1.15rem 1.2rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid rgba(19, 35, 22, 0.08);
  box-shadow: 0 18px 36px rgba(60, 47, 18, 0.1);
}

.player-card__identity {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.player-card__rank-badge {
  min-width: 3.1rem;
  height: 3.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-strong));
  color: #fff8dd;
  font-weight: 900;
}

.player-card__name {
  margin: 0;
  font-size: 1.05rem;
}

.player-card__record {
  margin: 0.35rem 0 0;
  color: var(--color-muted);
}

.player-card__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: end;
}

.player-card__meta-pill {
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 252, 240, 0.82);
  border: 1px solid rgba(19, 35, 22, 0.08);
  color: var(--color-primary-strong);
  font-size: 0.88rem;
  font-weight: 700;
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
