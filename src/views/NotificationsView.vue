<template>
  <section class="notifications-page section-card">
    <div class="notifications-header">
      <div>
        <p class="subtitle">Notifications</p>
        <h1>Activity feed</h1>
        <p class="description">
          All app alerts, invitations, score updates, and challenge activity in one place.
        </p>
      </div>

      <div class="notifications-actions">
        <span class="notifications-badge">Unread {{ unreadCount }}</span>
        <button class="button-secondary" type="button" @click="handleClearAll">Clear all</button>
      </div>
    </div>

    <div class="notifications-grid">
      <article v-if="notifications.length === 0" class="notification-card notification-card--empty">
        <p class="notification-empty-title">No notifications yet</p>
        <p class="notification-empty-copy">
          Your activity feed will surface challenge invites, score updates, and match reviews.
        </p>
      </article>

      <article
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification-card', { 'notification-card--unread': !notification.read }]"
      >
        <div
          class="notification-card__icon"
          :class="`notification-card__icon--${notification.type}`"
        >
          <span>{{ notification.type[0].toUpperCase() }}</span>
        </div>
        <div class="notification-card__content">
          <div class="notification-card__top">
            <h2>{{ notification.title }}</h2>
            <span class="notification-card__time">{{ formatTime(notification.time) }}</span>
          </div>
          <p class="notification-card__message">{{ notification.message }}</p>
          <div class="notification-card__actions">
            <button class="notification-action" type="button" @click="markRead(notification.id)">
              {{ notification.read ? 'Read' : 'Mark as read' }}
            </button>
            <button
              class="notification-action notification-action--ghost"
              type="button"
              @click="dismiss(notification.id)"
            >
              Dismiss
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

const notificationStore = useNotificationStore()

const notifications = computed(() =>
  [...notificationStore.notifications].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  ),
)
const unreadCount = computed(() => notificationStore.unreadCount)

const handleClearAll = () => notificationStore.clearNotifications()
const markRead = (id) => notificationStore.markRead(id)
const dismiss = (id) => notificationStore.dismissNotification(id)

if (notificationStore.notifications.length === 0) {
  notificationStore.addNotification({
    title: 'New challenge received',
    message: 'A fresh ladder invite is waiting for action in your challenge queue.',
    type: 'info',
  })
  notificationStore.addNotification({
    title: 'Match scheduled',
    message:
      'A match has been scheduled and you can assign a scorer when you create a new challenge.',
    type: 'success',
    read: true,
  })
  notificationStore.addNotification({
    title: 'Score review ready',
    message: 'A completed match is waiting for your review to update the ladder.',
    type: 'warning',
  })
}

const formatTime = (value) => {
  const date = new Date(value)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.notifications-page {
  display: grid;
  gap: 1.5rem;
}

.notifications-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.notifications-header h1 {
  margin: 0.4rem 0 0;
  font-size: 2rem;
}

.description {
  margin: 0.75rem 0 0;
  color: var(--color-muted);
  max-width: 38rem;
}

.notifications-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.notifications-badge {
  font-weight: 700;
  color: var(--color-text);
  background: rgba(255, 211, 61, 0.14);
  padding: 0.55rem 0.9rem;
  border-radius: 999px;
}

.button-secondary {
  color: var(--color-text);
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 0.75rem;
  padding: 0.8rem 1rem;
  cursor: pointer;
}

.notifications-grid {
  display: grid;
  gap: 1rem;
}

.notification-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: start;
  padding: 1.25rem;
  border-radius: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-soft);
}

.notification-card--unread {
  border-color: rgba(255, 211, 61, 0.45);
  background: rgba(255, 248, 227, 0.9);
}

.notification-card--empty {
  grid-template-columns: 1fr;
  text-align: center;
}

.notification-card__icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 1rem;
  font-weight: 700;
  color: #fff;
}

.notification-card__icon--success {
  background: #16a34a;
}

.notification-card__icon--warning {
  background: #d97706;
}

.notification-card__icon--info {
  background: #2563eb;
}

.notification-card__content {
  display: grid;
  gap: 0.55rem;
}

.notification-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.notification-card__top h2 {
  margin: 0;
  font-size: 1.05rem;
}

.notification-card__time {
  color: var(--color-muted);
  font-size: 0.85rem;
  white-space: nowrap;
}

.notification-card__message {
  margin: 0;
  color: var(--color-text);
}

.notification-card__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.notification-action {
  border: none;
  background: rgba(0, 181, 26, 0.08);
  color: var(--color-accent-bright);
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
}

.notification-action--ghost {
  background: transparent;
  color: var(--color-muted);
}

.notification-empty-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.notification-empty-copy {
  margin: 0.75rem 0 0;
  color: var(--color-muted);
}
</style>
