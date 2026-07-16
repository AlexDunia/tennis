<script setup>
import { computed } from 'vue'
import BaseButton from './BaseButton.vue'

const props = defineProps({
  variant: { type: String, default: 'first-use' },
  icon: { type: String, default: '' },
  illustration: { type: String, default: '' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  primaryActionLabel: { type: String, default: '' },
  secondaryActionLabel: { type: String, default: '' },
  showPrimaryAction: { type: Boolean, default: undefined },
  showSecondaryAction: { type: Boolean, default: undefined },
  compact: { type: Boolean, default: false },
  align: { type: String, default: 'center' },
  ariaLabel: { type: String, default: '' },
})

const emit = defineEmits(['primary-action', 'secondary-action'])

const hasPrimaryAction = computed(() =>
  props.showPrimaryAction === undefined
    ? Boolean(props.primaryActionLabel)
    : props.showPrimaryAction && Boolean(props.primaryActionLabel),
)
const hasSecondaryAction = computed(() =>
  props.showSecondaryAction === undefined
    ? Boolean(props.secondaryActionLabel)
    : props.showSecondaryAction && Boolean(props.secondaryActionLabel),
)
</script>

<template>
  <section
    class="empty-state-system"
    :class="[
      `empty-state-system--${variant}`,
      { 'empty-state-system--compact': compact, 'empty-state-system--left': align === 'left' },
    ]"
    :aria-label="ariaLabel || title"
  >
    <div class="empty-state-system__content">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>

    <div v-if="hasPrimaryAction || hasSecondaryAction || $slots.actions" class="empty-state-system__actions">
      <slot name="actions">
        <BaseButton v-if="hasPrimaryAction" @click="emit('primary-action')">{{ primaryActionLabel }}</BaseButton>
        <BaseButton v-if="hasSecondaryAction" variant="ghost" @click="emit('secondary-action')">{{ secondaryActionLabel }}</BaseButton>
      </slot>
    </div>
  </section>
</template>

<style scoped>
.empty-state-system {
  display: grid;
  width: 100%;
  min-height: 150px;
  place-items: center;
  align-content: center;
  gap: 12px;
  padding: 28px 22px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--color-text);
  text-align: center;
}

.empty-state-system--compact {
  min-height: 108px;
  gap: 9px;
  padding: 20px 16px;
}

.empty-state-system--left {
  justify-items: start;
  text-align: left;
}

.empty-state-system__content { max-width: 520px; }
.empty-state-system__content h3,
.empty-state-system__content p { margin: 0; }

.empty-state-system__content h3 {
  color: var(--color-text-soft);
  font-size: 17px;
  font-weight: 750;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.empty-state-system__content p {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 13.5px;
  line-height: 1.55;
}

.empty-state-system--compact .empty-state-system__content h3 { font-size: 15px; }
.empty-state-system--compact .empty-state-system__content p { font-size: 12.5px; }

.empty-state-system__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.empty-state-system__actions :deep(button) {
  min-height: 42px;
  font-size: 12px;
}

.empty-state-system--left .empty-state-system__actions { justify-content: flex-start; }

@media (max-width: 540px) {
  .empty-state-system { min-height: 132px; padding: 24px 14px; }
  .empty-state-system--compact { min-height: 100px; padding: 18px 12px; }
  .empty-state-system__actions { width: 100%; }
  .empty-state-system__actions :deep(button) { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .empty-state-system * { animation: none !important; transition: none !important; }
}
</style>
