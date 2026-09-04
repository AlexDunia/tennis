<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="['base-button', `base-button--${variant}`]"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup>
const emit = defineEmits({
  click: (event) => Boolean(event),
})

defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  disabled: { type: Boolean, default: false },
})
</script>

<style scoped>
.base-button {
  border: 1px solid transparent;
  border-radius: var(--app-inner-radius, 9px);
  min-height: var(--app-button-height, 44px);
  padding: 0 16px;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    background var(--motion-short, 150ms) var(--motion-curve, ease),
    border-color var(--motion-short, 150ms) var(--motion-curve, ease),
    color var(--motion-short, 150ms) var(--motion-curve, ease),
    transform var(--motion-short, 150ms) var(--motion-curve, ease);
}

.base-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.base-button:active:not(:disabled) {
  transform: scale(0.98);
}

.base-button--primary {
  background: var(--button-primary-bg, var(--color-accent-bright));
  color: var(--color-light);
  border-color: var(--button-primary-bg, var(--color-accent-bright));
}

.base-button--primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hover, var(--color-primary-strong));
  border-color: var(--button-primary-bg-hover, var(--color-primary-strong));
}

.base-button--secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

.base-button--ghost {
  background: transparent;
  color: var(--color-primary-strong);
  border-color: transparent;
}

.base-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}
</style>
