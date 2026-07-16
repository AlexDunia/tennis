<script setup>
import EmptyState from '../EmptyState.vue'

defineProps({
  title: { type: String, required: true },
  message: { type: String, required: true },
  icon: { type: String, default: 'tournament' },
})
const emit = defineEmits({ action: null })
</script>

<template>
  <EmptyState class="tournament-empty-state" compact :illustration="icon.toLowerCase()" :title="title" :description="message">
    <template v-if="$slots.action" #actions>
      <button type="button" class="t-button t-button--primary" @click="emit('action')"><slot name="action" /></button>
    </template>
  </EmptyState>
</template>
