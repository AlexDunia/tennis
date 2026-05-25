<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  icon: {
    type: String,
    default: 'Trophy',
  },
})

const emit = defineEmits({
  action: null,
})
</script>

<template>
  <div class="tournament-empty-state">
    <span class="tournament-empty-state__icon">{{ icon }}</span>
    <h3>{{ title }}</h3>
    <p>{{ message }}</p>
    <button v-if="$slots.action" type="button" class="tournament-empty-state__button" @click="emit('action')">
      <slot name="action" />
    </button>
  </div>
</template>

<style scoped>
.tournament-empty-state {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 28px 20px;
  border: 1px dashed var(--tournament-line);
  border-radius: 14px;
  background: #fff;
  box-shadow: none !important;
  text-align: center;
}

.tournament-empty-state__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--tournament-shell);
  color: var(--tournament-faint);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tournament-empty-state h3,
.tournament-empty-state p {
  margin: 0;
}

.tournament-empty-state p {
  max-width: 34rem;
  color: var(--tournament-muted);
  line-height: 1.5;
}

.tournament-empty-state__button {
  border: 0;
  border-radius: 10px;
  padding: 9px 16px;
  background: var(--tournament-green);
  color: #fff;
  font-weight: 800;
}
</style>
