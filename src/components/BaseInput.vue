<template>
  <label class="field">
    <span v-if="label" class="field__label">{{ label }}</span>
    <input
      v-bind="$attrs"
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
defineOptions({ inheritAttrs: false })

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
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-soft);
}

.field__input {
  width: 100%;
  min-height: var(--app-button-height, 44px);
  border: 1px solid var(--color-border);
  border-radius: var(--app-inner-radius, 9px);
  padding: 10px 12px;
  background: #ffffff;
  color: var(--color-text);
  font-size: 13px;
  transition:
    border-color var(--motion-short, 150ms) var(--motion-curve, ease),
    box-shadow var(--motion-short, 150ms) var(--motion-curve, ease);
}

.field__input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--focus-ring);
}
</style>
