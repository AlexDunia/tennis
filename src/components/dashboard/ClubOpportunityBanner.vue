<script setup>
defineProps({
  opportunity: { type: Object, required: true },
})

const emit = defineEmits(['open'])
</script>

<template>
  <aside class="club-opportunity" aria-labelledby="club-opportunity-title">
    <span class="club-opportunity__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M6.2 7.1c2.1 1.3 3.1 3 3 5.1-.1 2.3-1.2 4-3.2 5.1M17.8 6.7c-2.1 1.3-3.1 3-3 5.1.1 2.3 1.2 4 3.2 5.1" />
      </svg>
    </span>

    <span class="club-opportunity__copy">
      <strong id="club-opportunity-title">{{ opportunity.title }}</strong>
      <span>{{ opportunity.supportingText }}</span>
    </span>

    <button type="button" @click="emit('open')">Enter now</button>
  </aside>
</template>

<style scoped>
.club-opportunity {
  display: grid;
  min-width: 0;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(0, 181, 26, 0.1);
  border-radius: calc(var(--app-card-radius) * 2);
  padding: 15px 18px;
  background: rgba(0, 181, 26, 0.075);
}

.club-opportunity__icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-light);
}

.club-opportunity__icon svg {
  width: 27px;
  height: 27px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.65;
}

.club-opportunity__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.club-opportunity__copy strong {
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-opportunity__copy span {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 11.5px;
  line-height: 1.4;
}

.club-opportunity button {
  min-height: 40px;
  border: 1px solid var(--color-primary);
  border-radius: var(--app-inner-radius);
  padding: 0 14px;
  background: var(--color-primary);
  color: var(--color-light);
  font-size: 11.5px;
  font-weight: var(--font-weight-bold);
}

@media (max-width: 480px) {
  .club-opportunity {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 9px;
    padding: 12px;
  }

  .club-opportunity__icon {
    width: 40px;
    height: 40px;
  }

  .club-opportunity__icon svg {
    width: 23px;
    height: 23px;
  }

  .club-opportunity__copy strong {
    font-size: 12.5px;
  }

  .club-opportunity__copy span {
    font-size: 9.5px;
  }

  .club-opportunity button {
    min-height: 38px;
    padding: 0 10px;
    font-size: 10px;
  }
}

@media (max-width: 335px) {
  .club-opportunity {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .club-opportunity button {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
