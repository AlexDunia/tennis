<template>
  <label class="field">
    <span v-if="label" class="field__label">{{ label }}</span>
    <input
      :type="type"
      :placeholder="placeholder"
      :value="modelValue"
      :disabled="disabled"
      class="field__input"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  </label>
</template>

<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  disabled: { type: Boolean, default: false },
})
</script>

<style scoped>
.field {
  display: grid;
  gap: 0.45rem;
}

.field__label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
}

.field__input {
  width: 100%;
  border: 1px solid rgba(19, 35, 22, 0.12);
  border-radius: 1rem;
  padding: 0.95rem 1rem;
  background: rgba(255, 252, 240, 0.88);
  color: var(--color-text);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.field__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(15, 107, 63, 0.12);
  transform: translateY(-1px);
}
</style>
