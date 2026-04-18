<template>
  <label class="field">
    <span class="field__label" v-if="label">{{ label }}</span>
    <input
      :type="type"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      :disabled="disabled"
      class="field__input"
    />
  </label>
</template>

<script setup>
const props = defineProps({
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
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 1rem;
  padding: 0.95rem 1rem;
  background: var(--color-surface);
  color: var(--color-text);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.field__input:focus {
  outline: none;
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
}
</style>
