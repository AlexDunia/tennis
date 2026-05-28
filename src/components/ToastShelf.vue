<template>
  <div v-if="toasts.length" class="toast-shelf">
    <transition-group name="toast" tag="div">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast', `toast--${toast.type}`]">
        <span class="toast__signal" aria-hidden="true"></span>
        <div class="toast__content">
          <p class="toast__message">{{ toast.message }}</p>
          <span
            class="toast__progress"
            :style="{ '--toast-duration': `${toast.duration || 4000}ms` }"
            aria-hidden="true"
          ></span>
        </div>
        <button class="toast__close" type="button" aria-label="Dismiss notification" @click="dismiss(toast.id)">
          x
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()
const toasts = computed(() => notificationStore.toasts)
const dismiss = (id) => notificationStore.dismissToast(id)
</script>

<style scoped>
.toast-shelf {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: grid;
  gap: 0.75rem;
  z-index: 10000;
  width: min(360px, calc(100vw - 2rem));
}

.toast {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  align-items: center;
  overflow: hidden;
  padding: 0.95rem 1rem;
  border: 0.5px solid rgba(15, 23, 42, 0.08);
  border-radius: 0.85rem;
  background: #f8fafc;
  color: #0f172a;
  box-shadow: none;
  transform-origin: top right;
  animation: toastPop 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.toast--success {
  border-color: rgba(16, 185, 129, 0.2);
  background: #ecfdf5;
}

.toast--warning {
  border-color: rgba(234, 179, 8, 0.3);
  background: #fffbeb;
}

.toast--info {
  border-color: rgba(59, 130, 246, 0.25);
  background: #eff6ff;
}

.toast__signal {
  width: 11px;
  height: 38px;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.12);
}

.toast--warning .toast__signal {
  background: #d97706;
  box-shadow: 0 0 0 6px rgba(217, 119, 6, 0.13);
}

.toast--info .toast__signal {
  background: #2563eb;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.12);
}

.toast__content {
  display: grid;
  gap: 0.6rem;
}

.toast__message {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
}

.toast__progress {
  display: block;
  width: 100%;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
}

.toast__progress::before {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: currentColor;
  opacity: 0.35;
  transform-origin: left;
  animation: toastProgress var(--toast-duration, 4000ms) linear forwards;
}

.toast__close {
  border: none;
  border-radius: 50%;
  padding: 0.25rem 0.35rem;
  background: transparent;
  color: inherit;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background 120ms ease,
    transform 120ms ease;
}

.toast__close:hover {
  background: rgba(15, 23, 42, 0.07);
  transform: scale(1.04);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(18px) translateY(-8px) scale(0.98);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 220ms ease,
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toastPop {
  from {
    opacity: 0;
    transform: translateX(18px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes toastProgress {
  from {
    transform: scaleX(1);
  }

  to {
    transform: scaleX(0);
  }
}
</style>
