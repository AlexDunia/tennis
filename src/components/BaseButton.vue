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
  border-radius: 0.9rem;
  padding: 0.78rem 1.15rem;
  font-size: 0.92rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.base-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(20, 34, 24, 0.08);
}

.base-button--primary {
  background: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(0, 181, 26, 0.18);
}

.base-button--secondary {
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-primary-strong);
  border-color: rgba(0, 181, 26, 0.14);
}

.base-button--ghost {
  background: #ffffff;
  color: var(--color-text);
  border-color: var(--color-border);
}

.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
