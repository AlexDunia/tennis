<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  priorities: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['open'])
const rotationDuration = 7000
const activeIndex = ref(0)
const isPaused = ref(false)
const reducedMotion = ref(false)
const progressKey = ref(0)
const activePriority = computed(() => props.priorities[activeIndex.value] || null)
const shouldRotate = computed(() => props.priorities.length > 1 && !reducedMotion.value)

let rotationTimer = null
let motionQuery = null
let cycleStartedAt = 0
let remainingDuration = rotationDuration

function matchupLabel(priority) {
  return (priority.players || []).map((player) => player.name).join(' versus ')
}

function clearRotationTimer() {
  if (!rotationTimer) return
  window.clearTimeout(rotationTimer)
  rotationTimer = null
}

function scheduleRotation() {
  clearRotationTimer()
  if (!shouldRotate.value || isPaused.value) return

  cycleStartedAt = Date.now()
  rotationTimer = window.setTimeout(showNextPriority, remainingDuration)
}

function showNextPriority() {
  clearRotationTimer()
  if (!props.priorities.length) return

  activeIndex.value = (activeIndex.value + 1) % props.priorities.length
  remainingDuration = rotationDuration
  progressKey.value += 1
  scheduleRotation()
}

function pauseRotation() {
  if (!shouldRotate.value || isPaused.value) return
  isPaused.value = true
  remainingDuration = Math.max(160, remainingDuration - (Date.now() - cycleStartedAt))
  clearRotationTimer()
}

function resumeRotation() {
  if (!shouldRotate.value || !isPaused.value) return
  isPaused.value = false
  scheduleRotation()
}

function handleFocusOut(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return
  resumeRotation()
}

function handleMotionChange(event) {
  reducedMotion.value = event.matches
  remainingDuration = rotationDuration
  progressKey.value += 1
  scheduleRotation()
}

function openPriority(priority) {
  emit('open', priority)
}

watch(
  () => props.priorities.map((priority) => priority.id).join('|'),
  () => {
    activeIndex.value = 0
    remainingDuration = rotationDuration
    progressKey.value += 1
    scheduleRotation()
  },
)

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener?.('change', handleMotionChange)
  scheduleRotation()
})

onUnmounted(() => {
  clearRotationTimer()
  motionQuery?.removeEventListener?.('change', handleMotionChange)
})
</script>

<template>
  <div
    class="home-priority-viewport"
    :class="{ isPaused }"
    @mouseenter="pauseRotation"
    @mouseleave="resumeRotation"
    @focusin="pauseRotation"
    @focusout="handleFocusOut"
  >
    <Transition name="priority-slide" mode="out-in">
      <article
        v-if="activePriority"
        :key="activePriority.id"
        class="home-priority"
        :aria-label="activePriority.title"
      >
        <span class="home-priority__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m13 2-7 11h6l-1 9 7-12h-6Z" />
          </svg>
        </span>

        <div class="home-priority__copy">
          <h3>{{ activePriority.title }}</h3>
          <p v-if="activePriority.supportingText" class="home-priority__supporting">
            {{ activePriority.supportingText }}
          </p>

          <div class="home-priority__meta">
            <span v-if="activePriority.category">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="3" />
                <path d="M6 20a6 6 0 0 1 12 0" />
              </svg>
              {{ activePriority.category }}
            </span>
            <span v-if="activePriority.court">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="1" />
                <path d="M12 5v14M3 12h18M7 5v14M17 5v14" />
              </svg>
              {{ activePriority.court }}
            </span>
            <span v-if="activePriority.time">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {{ activePriority.time }}
            </span>
          </div>
        </div>

        <div
          v-if="activePriority.players?.length"
          class="home-priority__players"
          :aria-label="matchupLabel(activePriority)"
        >
          <template v-for="(player, index) in activePriority.players" :key="player.id">
            <span v-if="index" class="home-priority__versus" aria-hidden="true">vs</span>
            <img :src="player.image" :alt="player.name" />
          </template>
        </div>

        <div class="home-priority__action-wrap">
          <button type="button" @click="openPriority(activePriority)">
            {{ activePriority.ctaLabel }}
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>
          </button>
          <p v-if="activePriority.dateLabel">{{ activePriority.dateLabel }}</p>
        </div>
      </article>
    </Transition>

    <span
      v-if="shouldRotate"
      :key="progressKey"
      class="home-priority__progress"
      :class="{ isPaused }"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.home-priority-viewport {
  position: relative;
  min-height: 152px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface));
  box-shadow: var(--flow-shadow-quiet);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.home-priority-viewport:hover,
.home-priority-viewport:focus-within {
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border));
  box-shadow: var(--flow-shadow-hover);
  transform: translateY(-1px);
}

.home-priority {
  display: grid;
  min-height: 150px;
  grid-template-columns: 48px minmax(0, 1fr) auto minmax(148px, auto);
  align-items: center;
  gap: 20px;
  padding: 22px 24px 24px;
}

.home-priority__icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: 0 7px 18px rgba(15, 34, 24, 0.04);
  color: var(--color-primary-strong);
}

.home-priority__icon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.75;
}

.home-priority h3,
.home-priority__supporting {
  margin: 0;
}

.home-priority h3 {
  color: var(--color-text-soft);
  font-size: 20px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: -0.018em;
  line-height: 1.25;
}

.home-priority__supporting {
  margin-top: 5px;
  color: var(--color-muted);
  font-size: 13px;
  font-weight: var(--font-weight-regular);
  line-height: 1.55;
}

.home-priority__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 11px;
  color: var(--color-muted);
  font-size: 11px;
}

.home-priority__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.home-priority__meta svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.home-priority__players {
  display: flex;
  align-items: center;
  gap: 7px;
  border-left: 1px solid var(--color-border);
  padding-left: 20px;
}

.home-priority__players img {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border: 3px solid var(--color-surface);
  border-radius: 50%;
  background: var(--color-surface-soft);
  box-shadow: 0 0 0 1px var(--color-border-strong);
  object-fit: cover;
}

.home-priority__versus {
  color: var(--color-muted);
  font-size: 9px;
  font-weight: var(--font-weight-semibold);
}

.home-priority__action-wrap {
  display: grid;
  gap: 6px;
}

.home-priority__action-wrap button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--color-primary-strong);
  border-radius: var(--app-inner-radius);
  padding: 0 15px;
  background: var(--color-primary-strong);
  color: var(--color-light);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  transition:
    box-shadow 160ms ease,
    transform 160ms ease;
}

.home-priority__action-wrap button svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.home-priority__action-wrap button:hover {
  box-shadow: 0 9px 22px rgba(0, 143, 21, 0.12);
  transform: translateY(-1px);
}

.home-priority__action-wrap button:focus-visible {
  outline: 3px solid rgba(0, 181, 26, 0.14);
  outline-offset: 3px;
}

.home-priority__action-wrap p {
  margin: 0;
  color: var(--color-muted);
  font-size: 10px;
  text-align: center;
}

.home-priority__progress {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--color-primary-strong);
  transform: scaleX(0);
  transform-origin: left center;
  animation: priority-progress 7000ms linear forwards;
  pointer-events: none;
}

.home-priority__progress.isPaused {
  animation-play-state: paused;
}

.priority-slide-enter-active,
.priority-slide-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms ease;
}

.priority-slide-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.priority-slide-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

@keyframes priority-progress {
  to {
    transform: scaleX(1);
  }
}

@media (max-width: 860px) {
  .home-priority {
    grid-template-columns: 48px minmax(0, 1fr) auto;
  }

  .home-priority__icon {
    grid-row: 1 / span 2;
  }

  .home-priority__players {
    grid-column: 2;
    border-left: 0;
    padding-left: 0;
  }

  .home-priority__action-wrap {
    grid-row: 1 / span 2;
    grid-column: 3;
  }
}

@media (max-width: 620px) {
  .home-priority {
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 14px;
    padding: 19px 18px 21px;
  }

  .home-priority__icon {
    width: 42px;
    height: 42px;
    grid-row: auto;
    border-radius: 12px;
  }

  .home-priority__players {
    grid-column: 2;
  }

  .home-priority__action-wrap {
    grid-row: auto;
    grid-column: 1 / -1;
  }

  .home-priority__action-wrap button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-priority-viewport,
  .home-priority__action-wrap button,
  .priority-slide-enter-active,
  .priority-slide-leave-active {
    animation: none;
    transition: none;
  }

  .home-priority-viewport:hover,
  .home-priority-viewport:focus-within,
  .home-priority__action-wrap button:hover {
    transform: none;
  }

  .home-priority__progress {
    display: none;
  }
}
</style>
