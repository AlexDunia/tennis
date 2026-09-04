<template>
  <div class="person-avatar" :style="avatarStyle">
    <img v-if="image" :src="image" :alt="name" />
    <span v-else>{{ initials }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  image: { type: String, default: '' },
  size: { type: Number, default: 44 },
})

const initials = computed(() => {
  return props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
})

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))
</script>

<style scoped>
.person-avatar {
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary-strong);
}

.person-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
