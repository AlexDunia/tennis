<script setup>
defineProps({
  currentStep: {
    type: Number,
    default: 1,
  },
})

const steps = [
  {
    title: 'Check your player profile',
    description: 'Make sure your name is ready for the club administrator.',
  },
  {
    title: 'Wait for the club ladder',
    description: 'The administrator will add members and prepare the player rankings.',
  },
  {
    title: 'Challenge a player',
    description: 'Available opponents will appear here when the ladder is ready.',
  },
]
</script>

<template>
  <section class="setup-guide" aria-labelledby="setup-guide-title">
    <div class="setup-guide__heading">
      <p class="setup-guide__eyebrow">What happens next</p>
      <h2 id="setup-guide-title">Three simple steps</h2>
    </div>

    <ol class="setup-guide__list">
      <li
        v-for="(step, index) in steps"
        :key="step.title"
        class="setup-guide__item"
        :class="{
          'setup-guide__item--current': currentStep === index + 1,
          'setup-guide__item--done': currentStep > index + 1,
        }"
      >
        <span class="setup-guide__marker" aria-hidden="true">
          <svg v-if="currentStep > index + 1" viewBox="0 0 20 20">
            <path d="m5 10 3 3 7-7" />
          </svg>
          <span v-else>{{ index + 1 }}</span>
        </span>
        <span class="setup-guide__copy">
          <strong>{{ step.title }}</strong>
          <small>{{ step.description }}</small>
        </span>
        <span v-if="currentStep === index + 1" class="setup-guide__status">Now</span>
        <span v-else-if="currentStep > index + 1" class="setup-guide__status">Done</span>
        <span v-else class="setup-guide__status">Later</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.setup-guide {
  width: min(680px, 100%);
  margin: 0 auto;
  padding: clamp(20px, 4vw, 28px);
  border: var(--app-hairline);
  border-radius: var(--app-card-radius);
  background: color-mix(in srgb, var(--color-surface) 96%, var(--color-surface-soft));
}

.setup-guide__heading {
  margin-bottom: 18px;
}

.setup-guide__eyebrow {
  margin: 0 0 3px;
  color: var(--color-primary-strong);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.setup-guide h2 {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(18px, 3vw, 22px);
  line-height: 1.25;
}

.setup-guide__list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.setup-guide__item {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  min-height: 76px;
  padding: 12px 0;
  border-top: var(--app-hairline);
}

.setup-guide__item:not(.setup-guide__item--current):not(.setup-guide__item--done) {
  opacity: 0.58;
}

.setup-guide__marker {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: var(--app-hairline);
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-muted);
  font-size: 14px;
  font-weight: var(--font-weight-semibold);
}

.setup-guide__item--current .setup-guide__marker,
.setup-guide__item--done .setup-guide__marker {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-light);
}

.setup-guide__marker svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.setup-guide__copy strong,
.setup-guide__copy small {
  display: block;
}

.setup-guide__copy strong {
  color: var(--color-text);
  font-size: 14px;
  line-height: 1.35;
}

.setup-guide__copy small {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 12px;
  line-height: 1.5;
}

.setup-guide__status {
  color: var(--color-muted);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
}

.setup-guide__item--current .setup-guide__status {
  color: var(--color-primary-strong);
}

@media (max-width: 520px) {
  .setup-guide__item {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .setup-guide__status {
    grid-column: 2;
    margin-top: -8px;
  }
}
</style>
