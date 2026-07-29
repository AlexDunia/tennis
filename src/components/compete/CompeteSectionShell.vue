<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import TennisNavIcon from './TennisNavIcon.vue'

const route = useRoute()
const motion = ref({ active: false, from: 0, to: 0, revision: 0 })
let motionTimer = null

const tabs = Object.freeze([
  { label: 'Ladder', icon: 'ladder', to: { name: 'Rankings' }, routeName: 'Rankings' },
  {
    label: 'Challenges',
    icon: 'challenge',
    to: { name: 'Challenges' },
    routeName: 'Challenges',
  },
  {
    label: 'Tournaments',
    icon: 'trophy',
    to: { name: 'Tournaments' },
    routeName: 'Tournaments',
  },
])

const activeIndex = computed(() => tabs.findIndex((tab) => tab.routeName === route.name))
const motionStyle = computed(() => ({
  '--motion-from': motion.value.from,
  '--motion-to': motion.value.to,
  '--motion-count': tabs.length,
}))

watch(activeIndex, (to, from) => {
  if (from < 0 || to < 0 || from === to) return
  if (motionTimer) window.clearTimeout(motionTimer)
  motion.value = { active: true, from, to, revision: motion.value.revision + 1 }
  motionTimer = window.setTimeout(() => {
    motion.value = { ...motion.value, active: false }
    motionTimer = null
  }, 620)
})

onUnmounted(() => {
  if (motionTimer) window.clearTimeout(motionTimer)
})
</script>

<template>
  <section class="compete-shell" aria-label="Compete sections">
    <nav class="compete-tabs" aria-label="Compete navigation" :style="motionStyle">
      <span
        v-if="motion.active"
        :key="`compete-motion-${motion.revision}`"
        class="compete-tabs__motion"
        aria-hidden="true"
      ></span>
      <RouterLink
        v-for="tab in tabs"
        :key="tab.routeName"
        :to="tab.to"
        :class="{ active: route.name === tab.routeName }"
        :aria-current="route.name === tab.routeName ? 'page' : undefined"
      >
        <TennisNavIcon :kind="tab.icon" :size="17" />
        <span>{{ tab.label }}</span>
      </RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.compete-shell {
  margin-bottom: 24px;
}

.compete-tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  scrollbar-width: none;
}

.compete-tabs__motion {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(100% / var(--motion-count));
  pointer-events: none;
  background: linear-gradient(100deg, transparent, rgba(0, 181, 26, 0.14), transparent);
  animation: competeNavTrack 580ms var(--motion-curve) both;
}

.compete-tabs::-webkit-scrollbar {
  display: none;
}

.compete-tabs a {
  position: relative;
  display: flex;
  overflow: hidden;
  z-index: 1;
  min-width: max-content;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: var(--app-inner-radius) var(--app-inner-radius) 0 0;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
}

.compete-tabs a::after {
  content: '';
  position: absolute;
  inset: auto 12px -1px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: transparent;
}

.compete-tabs a.active {
  color: var(--color-primary-strong);
}

.compete-tabs a.active::after {
  background: var(--color-primary);
}

.compete-tabs a.active {
  animation: tennisOptionSettle 620ms var(--motion-spring);
}

.compete-tabs a.active :deep(.tennis-nav-icon) {
  animation: tennisSwing 650ms var(--motion-spring);
}

@keyframes tennisSwing {
  0%,
  100% {
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
  24% {
    transform: translate3d(-3px, 1px, 0) rotate(-19deg) scale(0.96);
  }
  50% {
    transform: translate3d(6px, -4px, 0) rotate(15deg) scale(1.16);
  }
  72% {
    transform: translate3d(0, 1px, 0) rotate(-5deg) scale(0.96);
  }
  88% {
    transform: translate3d(0, -2px, 0) rotate(2deg) scale(1.08);
  }
}

@keyframes tennisOptionSettle {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }
  32% {
    transform: translate3d(-3px, 0, 0) rotate(-1deg);
  }
  62% {
    transform: translate3d(5px, -1px, 0) rotate(1deg);
  }
  82% {
    transform: translate3d(-1px, 0, 0);
  }
}

@keyframes competeNavTrack {
  from {
    opacity: 0.14;
    transform: translateX(calc(var(--motion-from) * 100%));
  }
  48% {
    opacity: 0.72;
  }
  to {
    opacity: 0;
    transform: translateX(calc(var(--motion-to) * 100%));
  }
}

@media (max-width: 640px) {
  .compete-shell {
    margin-bottom: 18px;
  }
  .compete-tabs {
  }
  .compete-tabs a {
    min-width: 0;
    min-height: 46px;
    gap: 5px;
    padding-inline: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .compete-tabs a.active,
  .compete-tabs a.active :deep(.tennis-nav-icon) {
    animation: none;
  }
}
</style>
