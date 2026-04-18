<template>
  <article class="challenge-card">
    <div class="challenge-card__identity">
      <div class="challenge-card__ladder">{{ challengeLabel }}</div>
      <div>
        <h3 class="challenge-card__title">{{ challengerName }} vs {{ defenderName }}</h3>
        <p class="challenge-card__meta">
          Status: <strong>{{ challenge.statusLabel }}</strong>
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
  background: rgba(255, 249, 231, 0.84);
  border: 1px solid rgba(19, 35, 22, 0.08);
  border-radius: 1.5rem;
  padding: 1.35rem;
  display: grid;
  gap: 1rem;
  box-shadow: 0 18px 36px rgba(60, 47, 18, 0.1);
}

.challenge-card__identity {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.challenge-card__ladder {
  min-width: 4.7rem;
  padding: 0.7rem 0.8rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(15, 107, 63, 0.14), rgba(15, 107, 63, 0.24));
  color: var(--color-primary-strong);
  font-size: 0.82rem;
  font-weight: 900;
  text-align: center;
}

.challenge-card__title {
  margin: 0;
  font-size: 1.06rem;
  color: var(--color-text);
}

.challenge-card__details {
  display: grid;
  gap: 0.2rem;
}

.challenge-card__meta {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

.challenge-card__note {
  margin: 0.25rem 0 0;
  color: var(--color-text);
  font-size: 0.95rem;
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
