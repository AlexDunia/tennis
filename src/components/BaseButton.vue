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
  border-radius: 0.5rem;
  min-height: 38px;
  padding: 0 14px;
  font-size: 0.95rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition:
    background 0.12s ease-in-out,
    border-color 0.12s ease-in-out,
    color 0.12s ease-in-out,
    transform 0.12s ease-in-out,
    box-shadow 0.12s ease-in-out;
}

.base-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.base-button:active:not(:disabled) {
  transform: scale(0.98);
}

.base-button--primary {
  background: var(--color-accent-bright);
  color: var(--color-light);
  border-color: transparent;
}

.base-button--secondary {
  background: transparent;
  color: var(--color-accent-bright);
  border-color: var(--color-accent-bright);
}

.base-button--ghost {
  background: transparent;
  color: var(--color-text);
  border-color: var(--color-border);
}

.base-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
