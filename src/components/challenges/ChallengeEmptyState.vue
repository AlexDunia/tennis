<script setup>
import { computed } from 'vue'
import EmptyState from '../EmptyState.vue'
import FreshAccountSetupGuide from './FreshAccountSetupGuide.vue'

const props = defineProps({
  state: {
    type: String,
    required: true,
    validator: (value) => ['no-club', 'no-opponents', 'ready'].includes(value),
  },
})

defineEmits(['primary-action'])

const content = computed(() => {
  if (props.state === 'no-opponents') {
    return {
      title: 'No players are available to challenge right now',
      description:
        'Your club is ready, but the ladder rules do not currently place anyone within your challenge range.',
      action: 'Return to home',
      variant: 'quiet',
    }
  }

  if (props.state === 'ready') {
    return {
      title: 'You are ready to challenge someone',
      description:
        'Players within your challenge range are available. Choose one to set up your next match.',
      action: 'See who I can challenge',
      variant: 'first-use',
    }
  }

  return {
    title: 'Your club is still getting ready',
    description:
      'Once the club adds its players and prepares the ladder, you will be able to challenge someone here.',
    action: 'View my profile',
    variant: 'data-dependent',
  }
})
</script>

<template>
  <div class="challenge-empty">
    <EmptyState
      class="challenge-empty__focus"
      compact
      :variant="content.variant"
      illustration="challenge"
      :title="content.title"
      :description="content.description"
      :primary-action-label="content.action"
      :aria-label="content.title"
      @primary-action="$emit('primary-action')"
    />

    <FreshAccountSetupGuide v-if="state === 'no-club'" />
  </div>
</template>

<style scoped>
.challenge-empty {
  display: grid;
  gap: 18px;
  width: min(760px, 100%);
  margin: 0 auto;
  padding: 6px 0 30px;
}

.challenge-empty__focus {
  min-height: 190px;
  background: color-mix(in srgb, var(--color-surface) 97%, var(--color-surface-soft));
}

.challenge-empty__focus :deep(.empty-state-system__content) {
  max-width: 520px;
}

.challenge-empty__focus :deep(.empty-state-system__content h3) {
  font-size: 14px;
  opacity: 0.8;
}

.challenge-empty__focus :deep(.empty-state-system__content p) {
  max-width: 500px;
  margin-right: auto;
  margin-left: auto;
  font-size: 11.5px;
  opacity: 0.66;
}

.challenge-empty__focus :deep(.empty-state-system__visual) {
  opacity: 0.24;
}
</style>
