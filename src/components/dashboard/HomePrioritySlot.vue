<script setup>
import { computed } from 'vue'
import PersonAvatar from '../PersonAvatar.vue'
import { isSafeImageSource } from '../../utils/formSafety'

const props = defineProps({
  priority: {
    type: Object,
    default: null,
  },
  clubName: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['open'])

const personName = computed(() =>
  String(props.priority?.personName || '').trim(),
)

const personImage = computed(() => {
  const image = String(props.priority?.personImage || '').trim()
  return image && isSafeImageSource(image) ? image : ''
})

const contextLabel = computed(() => {
  const parts = [
    String(props.clubName || '').trim(),
    String(props.priority?.eyebrow || '').trim(),
  ].filter(Boolean)

  return parts.join(' · ')
})

function openPriority() {
  if (!props.priority) return
  emit('open', props.priority)
}
</script>

<template>
  <Transition name="home-hero-state" mode="out-in">
    <section
      v-if="priority"
      :key="priority.id || priority.kind || priority.title"
      class="home-priority"
      :class="{ 'home-priority--attention': priority.attention }"
      aria-live="polite"
      aria-labelledby="home-priority-title"
    >
      <div class="home-priority__court" aria-hidden="true">
        <svg viewBox="0 0 520 210" fill="none">
          <rect x="38" y="24" width="444" height="162" rx="2" />
          <path d="M82 24v162M438 24v162M38 105h444M82 66h356M82 144h356M260 66v78" />
        </svg>
      </div>

      <div class="home-priority__visual" aria-hidden="true">
        <span
          v-if="priority.attention"
          class="home-priority__signal"
        ></span>

        <PersonAvatar
          v-if="personName"
          :name="personName"
          :image="personImage"
          :size="64"
        />

        <span v-else class="home-priority__ball-mark">
          <svg viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="17" />
            <path d="M7.8 13.4c6.3 3.1 8.5 9.2 8.5 8.6s-2.2 5.5-8.5 8.6" />
            <path d="M36.2 13.4c-6.3 3.1-8.5 9.2-8.5 8.6s2.2 5.5 8.5 8.6" />
          </svg>
        </span>
      </div>

      <div class="home-priority__copy">
        <p v-if="contextLabel" class="home-priority__context">
          {{ contextLabel }}
        </p>

        <h2 id="home-priority-title">
          {{ priority.title }}
        </h2>

        <p v-if="priority.supportingText" class="home-priority__supporting">
          {{ priority.supportingText }}
        </p>
      </div>

      <button
        v-if="priority.ctaLabel"
        class="home-priority__cta"
        type="button"
        @click="openPriority"
      >
        <span>{{ priority.ctaLabel }}</span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 10h11M11 6l4 4-4 4" />
        </svg>
      </button>
    </section>
  </Transition>
</template>

<style scoped>
.home-priority {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  min-height: 188px;
  align-items: center;
  gap: 22px;
  overflow: hidden;
  padding: 28px;
  border-radius: 12px;
  background: #163d2b;
  color: #fff;
}

.home-priority__court {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.home-priority__court svg {
  position: absolute;
  top: 50%;
  right: -62px;
  width: min(52%, 520px);
  transform: translateY(-50%);
  stroke: rgba(255, 255, 255, 0.11);
  stroke-width: 1.25;
}

.home-priority__visual {
  position: relative;
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
}

.home-priority__visual :deep(.person-avatar) {
  position: relative;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.24);
  background: #fff;
  color: #163d2b;
  font-size: 19px;
  box-shadow: 0 12px 30px rgba(5, 35, 22, 0.16);
}

.home-priority__signal {
  position: absolute;
  z-index: 1;
  inset: 2px;
  border: 1px solid rgba(216, 255, 71, 0.72);
  border-radius: 999px;
  animation: home-priority-signal 900ms ease-out 2;
}

.home-priority__ball-mark {
  position: relative;
  z-index: 2;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border: 1px solid rgba(216, 255, 71, 0.2);
  border-radius: 999px;
  background: rgba(216, 255, 71, 0.08);
  color: #d8ff47;
}

.home-priority__ball-mark svg {
  width: 38px;
  height: 38px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

.home-priority__copy {
  position: relative;
  z-index: 2;
  min-width: 0;
}

.home-priority__context {
  margin: 0 0 7px;
  color: #d8ff47;
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  letter-spacing: 0.025em;
}

.home-priority h2 {
  max-width: 720px;
  margin: 0;
  color: #fff;
  font-size: clamp(23px, 3vw, 30px);
  font-weight: var(--font-weight-semibold);
  line-height: 1.18;
  letter-spacing: -0.025em;
}

.home-priority__supporting {
  max-width: 670px;
  margin: 9px 0 0;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
  line-height: 1.55;
}

.home-priority__cta {
  position: relative;
  z-index: 2;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 16px;
  border: 1px solid #d8ff47;
  border-radius: 9px;
  background: #d8ff47;
  color: #163d2b;
  font: inherit;
  font-size: 13px;
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition:
    transform 140ms var(--motion-curve),
    background-color 140ms var(--motion-curve),
    border-color 140ms var(--motion-curve);
}

.home-priority__cta svg {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.home-priority__cta:active {
  transform: translateY(1px);
}

.home-priority__cta:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.home-hero-state-enter-active,
.home-hero-state-leave-active {
  transition:
    opacity 180ms var(--motion-curve),
    transform 180ms var(--motion-curve);
}

.home-hero-state-enter-from,
.home-hero-state-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@keyframes home-priority-signal {
  from {
    opacity: 0.65;
    transform: scale(0.86);
  }

  to {
    opacity: 0;
    transform: scale(1.28);
  }
}

@media (hover: hover) and (pointer: fine) {
  .home-priority__cta:hover {
    border-color: #e9ff9b;
    background: #e9ff9b;
  }
}

@media (max-width: 720px) {
  .home-priority {
    grid-template-columns: 58px minmax(0, 1fr);
    min-height: 0;
    gap: 16px;
    padding: 22px;
  }

  .home-priority__visual {
    width: 58px;
    height: 58px;
  }

  .home-priority__visual :deep(.person-avatar),
  .home-priority__ball-mark {
    width: 54px !important;
    height: 54px !important;
  }

  .home-priority__ball-mark svg {
    width: 32px;
    height: 32px;
  }

  .home-priority__signal {
    inset: 2px;
  }

  .home-priority h2 {
    font-size: clamp(21px, 6vw, 26px);
  }

  .home-priority__cta {
    grid-column: 1 / -1;
    width: 100%;
    margin-top: 2px;
  }

  .home-priority__court svg {
    right: -110px;
    width: 98%;
    opacity: 0.72;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-priority__signal {
    animation: none;
  }

  .home-priority__cta,
  .home-hero-state-enter-active,
  .home-hero-state-leave-active {
    transition: none;
  }
}
</style>
