<script setup>
defineProps({
  priority: {
    type: Object,
    required: true,
  },
})

defineEmits(['open'])
</script>

<template>
  <section class="home-priority" aria-labelledby="home-priority-title">
    <div class="home-priority__copy">
      <p class="home-priority__eyebrow">
        <span class="home-priority__live-dot" aria-hidden="true"></span>

        {{ priority.eyebrow }}
      </p>

      <h2 id="home-priority-title">
        {{ priority.title }}
      </h2>

      <p class="home-priority__supporting">
        {{ priority.supportingText }}
      </p>
    </div>

    <button class="home-priority__action" type="button" @click="$emit('open', priority)">
      <span>
        {{ priority.ctaLabel }}
      </span>

      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m7 4 6 6-6 6" />
      </svg>
    </button>
  </section>
</template>

<style scoped>
.home-priority {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  min-width: 0;
  padding: 20px 22px;
  border: 1px solid rgba(0, 181, 26, 0.18);
  border-radius: calc(var(--app-card-radius) * 1.35);
  background: var(--color-surface);
  box-shadow: 0 10px 30px rgba(20, 35, 25, 0.055);
}

.home-priority::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--color-primary-strong);
  content: '';
}

.home-priority__copy {
  min-width: 0;
}

.home-priority__eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 7px;
  color: var(--color-primary-strong);
  font-size: 10.5px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.home-priority__live-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--color-primary-strong);
}

.home-priority h2 {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(19px, 2vw, 24px);
  letter-spacing: -0.025em;
  line-height: 1.15;
}

.home-priority__supporting {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 12.5px;
  line-height: 1.45;
}

.home-priority__action {
  display: inline-flex;
  min-height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: var(--app-inner-radius);
  padding: 0 16px;
  background: var(--color-primary-strong);
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.home-priority__action:hover {
  transform: translateY(-1px);
}

.home-priority__action:active {
  transform: translateY(0);
}

.home-priority__action:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 3px;
}

.home-priority__action svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

@media (max-width: 640px) {
  .home-priority {
    align-items: flex-start;
    gap: 15px;
    padding: 17px 16px 17px 18px;
  }

  .home-priority__action {
    padding-inline: 13px;
  }
}

@media (max-width: 430px) {
  .home-priority {
    display: grid;
  }

  .home-priority__action {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-priority__action {
    transition: none;
  }

  .home-priority__action:hover {
    transform: none;
  }
}
</style>
