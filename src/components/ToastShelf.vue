<template>
  <div
    v-if="toasts.length"
    class="toast-shelf"
    aria-live="polite"
    aria-relevant="additions removals"
  >
    <transition-group name="toast-stack" tag="div" class="toast-stack">
      <article
        v-for="toast in visibleToasts"
        :key="toast.id"
        :class="['toast', `toast--${toast.type}`]"
        role="status"
      >
        <span class="toast__icon" aria-hidden="true">
          <svg v-if="toast.type === 'warning'" viewBox="0 0 20 20">
            <path d="M10 3.2 17 16H3L10 3.2Z" />
            <path d="M10 7.2v4.4M10 14.1h.01" />
          </svg>

          <svg v-else-if="toast.type === 'error'" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7" />
            <path d="m7.4 7.4 5.2 5.2M12.6 7.4l-5.2 5.2" />
          </svg>

          <svg v-else-if="toast.type === 'info'" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7" />
            <path d="M10 9v4M10 6.5h.01" />
          </svg>

          <svg v-else viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7" />
            <path d="m6.8 10.1 2.1 2.1 4.4-4.6" />
          </svg>
        </span>

        <div class="toast__content">
          <strong v-if="toast.title">{{ toast.title }}</strong>
          <p>{{ toast.message }}</p>
        </div>

        <button
          class="toast__close"
          type="button"
          aria-label="Dismiss notification"
          @click="dismiss(toast.id)"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m6 6 8 8M14 6l-8 8" />
          </svg>
        </button>
      </article>
    </transition-group>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()

const toasts = computed(() => notificationStore.toasts)
const visibleToasts = computed(() => toasts.value.slice(0, 4))
const dismiss = (id) => notificationStore.dismissToast(id)
</script>

<style scoped>
.toast-shelf {
  position: fixed;
  z-index: 10000;
  top: 18px;
  right: 18px;
  width: min(326px, 85vw);
  pointer-events: none;
}

.toast-stack {
  display: grid;
  gap: 8px;
}

.toast {
  --toast-signal: #b9ef78;

  display: grid;
  min-height: 64px;
  grid-template-columns: 34px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 10px;
  padding: 11px 10px 11px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: #163d2b;
  color: #f7fbf8;
  box-shadow:
    0 16px 38px rgba(7, 36, 22, 0.18),
    0 3px 10px rgba(7, 36, 22, 0.08);
  pointer-events: auto;
  transform-origin: top right;
}

.toast--info {
  --toast-signal: #d7e4da;
}

.toast--warning {
  --toast-signal: #f1ca72;
}

.toast--error {
  --toast-signal: #ef9a93;
}

.toast__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--toast-signal) 17%, transparent);
  color: var(--toast-signal);
}

.toast__icon svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.toast__content {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.toast__content strong {
  overflow: hidden;
  font-size: 11.5px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast__content p {
  margin: 0;
  color: rgba(247, 251, 248, 0.86);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
}

.toast__close {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.68);
}

.toast__close svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
}

.toast__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.toast__close:focus-visible {
  outline: 1px solid rgba(216, 255, 71, 0.6);
  outline-offset: 2px;
}

.toast-stack-move,
.toast-stack-enter-active,
.toast-stack-leave-active {
  transition:
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms ease;
}

.toast-stack-enter-from {
  opacity: 0;
  transform: translate3d(14px, -10px, 0) scale(0.975);
}

.toast-stack-leave-to {
  opacity: 0;
  transform: translate3d(12px, -5px, 0) scale(0.98);
}

.toast-stack-leave-active {
  position: absolute;
  width: 100%;
}

@media (max-width: 620px) {
  .toast-shelf {
    top: 12px;
    right: 7.5vw;
    width: 85vw;
  }

  .toast {
    min-height: 60px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast-stack-move,
  .toast-stack-enter-active,
  .toast-stack-leave-active {
    transition-duration: 1ms;
  }
}
</style>

