<template>
  <div class="toast-shelf" v-if="toasts.length">
    <transition-group name="toast" tag="div">
      <div v-for="toast in toasts" :key="toast.id" :class="['toast', `toast--${toast.type}`]">
        <div class="toast__content">
          <p class="toast__message">{{ toast.message }}</p>
        </div>
        <button class="toast__close" type="button" @click="dismiss(toast.id)">×</button>
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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border-radius: 1rem;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.14);
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.toast--success {
  background: #ecfdf5;
  border-color: rgba(16, 185, 129, 0.2);
}

.toast--warning {
  background: #fffbeb;
  border-color: rgba(234, 179, 8, 0.3);
}

.toast--info {
  background: #eff6ff;
  border-color: rgba(59, 130, 246, 0.25);
}

.toast__message {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
}

.toast__close {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
</style>
