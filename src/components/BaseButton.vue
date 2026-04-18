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
  border-radius: 1rem;
  padding: 0.85rem 1.4rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.01em;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.base-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 18px 36px rgba(86, 59, 17, 0.18);
}

.base-button--primary {
  background: linear-gradient(135deg, var(--color-secondary), #ef5543);
  color: #fffdf6;
  box-shadow: 0 14px 28px rgba(159, 17, 32, 0.22);
}

.base-button--secondary {
  background: linear-gradient(135deg, rgba(15, 107, 63, 0.14), rgba(15, 107, 63, 0.22));
  color: var(--color-primary-strong);
  border-color: rgba(15, 107, 63, 0.14);
}

.base-button--ghost {
  background: rgba(255, 250, 234, 0.72);
  color: var(--color-text);
  border-color: rgba(19, 35, 22, 0.12);
}

.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>
