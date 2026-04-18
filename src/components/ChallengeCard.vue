<template>
  <article class="challenge-card">
    <div>
      <h3 class="challenge-card__title">{{ challengeLabel }}</h3>
      <p class="challenge-card__meta">
        Status: <strong>{{ challenge.statusLabel }}</strong>
      </p>
      <p class="challenge-card__meta">Challenger: {{ challengerName }}</p>
      <p class="challenge-card__meta">Defender: {{ defenderName }}</p>
      <p class="challenge-card__meta" v-if="challenge.scheduledAt">
        Scheduled: {{ challenge.scheduledAt }}
      </p>
      <p class="challenge-card__note" v-if="challenge.note">{{ challenge.note }}</p>
    </div>
    <div class="challenge-card__actions">
      <BaseButton
        v-if="showAccept"
        variant="primary"
        type="button"
        @click="$emit('accept', challenge.id)"
      >
        Accept
      </BaseButton>
      <BaseButton
        v-if="showReview"
        variant="secondary"
        type="button"
        @click="$emit('review', challenge.id)"
      >
        Review
      </BaseButton>
      <BaseButton
        v-if="showDetails"
        variant="ghost"
        type="button"
        @click="$emit('details', challenge.id)"
      >
        Details
      </BaseButton>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import BaseButton from './BaseButton.vue'

const props = defineProps({
  challenge: { type: Object, required: true },
  challengerName: { type: String, default: '' },
  defenderName: { type: String, default: '' },
  showAccept: { type: Boolean, default: false },
  showReview: { type: Boolean, default: false },
  showDetails: { type: Boolean, default: true },
})

const challengeLabel = computed(
  () => `${props.challenge.challengerRank} vs ${props.challenge.defenderRank}`,
)
</script>

<style scoped>
.challenge-card {
  background: var(--color-surface);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 1.5rem;
  padding: 1.4rem;
  display: grid;
  gap: 1rem;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.challenge-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 24px 50px rgba(15, 23, 42, 0.09);
}
.challenge-card__title {
  margin: 0;
  font-size: 1.08rem;
  color: var(--color-text);
}
.challenge-card__meta {
  margin: 0.3rem 0;
  color: var(--color-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}
.challenge-card__note {
  margin: 0.4rem 0 0;
  color: var(--color-text);
  font-size: 0.95rem;
}
.challenge-card__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
