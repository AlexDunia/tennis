<template>
  <article class="player-card">
    <div>
      <p class="player-card__rank">#{{ player.rank }}</p>
      <h3 class="player-card__name">{{ player.name }}</h3>
      <p class="player-card__record">Record: {{ player.wins }}–{{ player.losses }}</p>
    </div>
    <BaseButton
      v-if="showChallenge"
      type="button"
      variant="secondary"
      @click="$emit('challenge', player.id)"
    >
      Challenge
    </BaseButton>
  </article>
</template>

<script setup>
import BaseButton from './BaseButton.vue'

const props = defineProps({
  player: { type: Object, required: true },
  showChallenge: { type: Boolean, default: false },
})
</script>

<style scoped>
.player-card {
  background: #ffffff;
  border-radius: 1.2rem;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  border: 1px solid #e2e8f0;
}
.player-card__rank {
  margin: 0;
  color: #4338ca;
  font-weight: 700;
}
.player-card__name {
  margin: 0.25rem 0 0;
  font-size: 1.05rem;
}
.player-card__record {
  margin: 0.5rem 0 0;
  color: #475569;
}
</style>
