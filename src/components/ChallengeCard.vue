<template>
  <article class="challenge-card">
    <div class="challenge-card__identity">
      <div class="challenge-card__ladder">{{ challengeLabel }}</div>
      <div>
        <h3 class="challenge-card__title">{{ challengerName }} vs {{ defenderName }}</h3>
        <p class="challenge-card__meta">
          Status <strong>{{ challenge.statusLabel }}</strong>
        </p>
      </div>
    </div>

    <div class="challenge-card__details">
      <p class="challenge-card__meta">Challenger: {{ challengerName }}</p>
      <p class="challenge-card__meta">Defender: {{ defenderName }}</p>
      <p v-if="challenge.scheduledAt" class="challenge-card__meta">
        Scheduled: {{ challenge.scheduledAt }}
      </p>
      <p v-if="challenge.note" class="challenge-card__note">{{ challenge.note }}</p>
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
  () => `#${props.challenge.challengerRank} -> #${props.challenge.defenderRank}`,
)
</script>

<style scoped>
.challenge-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: grid;
  gap: 1rem;
  box-shadow: var(--shadow-soft);
  transition:
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.challenge-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-strong);
}

.challenge-card__identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.challenge-card__ladder {
  min-width: 4.5rem;
  padding: 0.65rem 0.8rem;
  border-radius: 0.5rem;
  background: rgba(255, 211, 61, 0.12);
  color: #845f00;
  font-size: 0.8rem;
  font-weight: 800;
  text-align: center;
}

.challenge-card__title {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text);
}

.challenge-card__details {
  display: grid;
  gap: 0.3rem;
}

.challenge-card__meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.challenge-card__note {
  margin: 0.25rem 0 0;
  color: var(--color-text-soft);
  font-size: 0.9rem;
}

.challenge-card__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .challenge-card__identity {
    align-items: start;
    flex-direction: column;
  }
}
</style>
