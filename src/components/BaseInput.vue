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
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.field__input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 0.9rem;
  padding: 0.88rem 0.95rem;
  background: #ffffff;
  color: var(--color-text);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.field__input:focus {
  outline: none;
  border-color: rgba(0, 181, 26, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 181, 26, 0.08);
}
</style>
