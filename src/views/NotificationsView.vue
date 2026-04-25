<script setup>
// 1. IMPORTS
import { computed } from 'vue'
import { useNotificationStore } from '../stores/notification'

// 2. STORE
const notificationStore = useNotificationStore()

// 3. SEED DATA (prototype only — remove when backend is live)
if (notificationStore.notifications.length === 0) {
  notificationStore.addNotification({
    title: 'New challenge received',
    message: 'Foster Ezenwelu has challenged you to a ladder match. You have 48 hours to respond.',
    type: 'info',
  })
  notificationStore.addNotification({
    title: 'Match scheduled',
    message: 'Your match against Nestor Madukaife is confirmed for tomorrow at 4 PM on Court 3.',
    type: 'success',
    read: true,
  })
  notificationStore.addNotification({
    title: 'Score review ready',
    message: 'A completed match is waiting for your confirmation before rankings update.',
    type: 'warning',
  })
  notificationStore.addNotification({
    title: 'Challenge expired',
    message: 'Your challenge to Chima Adamu was not accepted within 48 hours and has expired.',
    type: 'danger',
    read: true,
  })
}

// 4. COMPUTED
const notifications = computed(() =>
  [...notificationStore.notifications].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  ),
)

const unreadCount = computed(() => notificationStore.unreadCount)

// Group notifications by relative date label
const groupedNotifications = computed(() => {
  const groups = {}

  for (const notification of notifications.value) {
    const label = getDateGroupLabel(new Date(notification.time))
    if (!groups[label]) groups[label] = []
    groups[label].push(notification)
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }))
})

// 5. METHODS

const handleMarkRead = (id) => notificationStore.markRead(id)
const handleDismiss = (id) => notificationStore.dismissNotification(id)
const handleMarkAllRead = () => {
  for (const notification of notifications.value) {
    if (!notification.read) notificationStore.markRead(notification.id)
  }
}
const handleClearAll = () => notificationStore.clearNotifications()

// 6. HELPERS

const getDateGroupLabel = (date) => {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  if (date >= startOfToday) return 'Today'
  if (date >= startOfYesterday) return 'Yesterday'
  return 'Earlier'
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

<template>
  <section class="notifications-page">
    <!-- ── Page header ── -->
    <div class="page-header">
      <div class="page-header__text">
        <p class="page-header__kicker">Activity</p>
        <h1 class="page-header__title">Notifications</h1>
        <p class="page-header__desc">
          Challenge activity, score updates, and match reviews — all in one place.
        </p>
      </div>

      <div class="page-header__actions">
        <div v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }} unread</div>
        <button
          v-if="unreadCount > 0"
          type="button"
          class="action-btn action-btn--ghost"
          @click="handleMarkAllRead"
        >
          Mark all read
        </button>
        <button type="button" class="action-btn" @click="handleClearAll">Clear all</button>
      </div>
    </div>

    <!-- ── Empty state ── -->
    <div v-if="notifications.length === 0" class="empty-state">
      <div class="empty-state__icon">
        <!-- Bell icon -->
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <p class="empty-state__title">You're all caught up</p>
      <p class="empty-state__desc">
        Challenge invites, score updates, and match reviews will appear here.
      </p>
    </div>

    <!-- ── Notification groups ── -->
    <div v-else class="feed">
      <div v-for="group in groupedNotifications" :key="group.label" class="feed-group">
        <!-- Group label -->
        <p class="feed-group__label">{{ group.label }}</p>

        <!-- Notification cards -->
        <div class="feed-group__list">
          <article
            v-for="notification in group.items"
            :key="notification.id"
            :class="['notification-card', { 'notification-card--unread': !notification.read }]"
          >
            <!-- Type icon -->
            <div :class="['notif-icon', `notif-icon--${notification.type}`]">
              <!-- Info -->
              <svg
                v-if="notification.type === 'info'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <!-- Success -->
              <svg
                v-else-if="notification.type === 'success'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <!-- Warning -->
              <svg
                v-else-if="notification.type === 'warning'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <!-- Danger -->
              <svg
                v-else-if="notification.type === 'danger'"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>

            <!-- Content -->
            <div class="notification-card__body">
              <div class="notification-card__top">
                <div class="notification-card__title-row">
                  <span v-if="!notification.read" class="unread-dot" aria-label="Unread" />
                  <h2 class="notification-card__title">{{ notification.title }}</h2>
                </div>
                <span class="notification-card__time">{{ formatTime(notification.time) }}</span>
              </div>

              <p class="notification-card__message">{{ notification.message }}</p>

              <div class="notification-card__actions">
                <button
                  v-if="!notification.read"
                  type="button"
                  class="notif-btn notif-btn--primary"
                  @click="handleMarkRead(notification.id)"
                >
                  Mark as read
                </button>
                <button
                  type="button"
                  class="notif-btn notif-btn--ghost"
                  @click="handleDismiss(notification.id)"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── Page layout ── */
.notifications-page {
  display: grid;
  gap: 2rem;
}

/* ── Page header ── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}

.page-header__kicker {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}

.page-header__title {
  margin: 0.3rem 0 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.3px;
}

.page-header__desc {
  margin: 0.4rem 0 0;
  font-size: 0.88rem;
  color: var(--color-muted);
  max-width: 36rem;
  line-height: 1.55;
}

.page-header__actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-shrink: 0;
}

/* ── Unread badge ── */
.unread-badge {
  font-size: 0.78rem;
  font-weight: 600;
  color: #7a5a00;
  background: rgba(255, 211, 61, 0.18);
  border: 1px solid rgba(255, 211, 61, 0.4);
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
}

/* ── Header action buttons ── */
.action-btn {
  padding: 0.45rem 1rem;
  border-radius: 9px;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft, #f6f7f8);
  color: var(--color-text);
  transition:
    background 0.14s ease,
    transform 0.14s ease;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.action-btn--ghost {
  background: transparent;
  color: #007a32;
  border-color: rgba(0, 200, 83, 0.28);
}

.action-btn--ghost:hover {
  background: rgba(0, 200, 83, 0.05);
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  border-radius: 18px;
  border: 1px dashed rgba(0, 0, 0, 0.08);
  background: var(--color-surface-soft, #f6f7f8);
  text-align: center;
  gap: 0.75rem;
}

.empty-state__icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  margin-bottom: 0.25rem;
}

.empty-state__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.empty-state__desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-muted);
  max-width: 28rem;
  line-height: 1.55;
}

/* ── Feed ── */
.feed {
  display: grid;
  gap: 1.75rem;
}

/* ── Feed group ── */
.feed-group {
  display: grid;
  gap: 0.6rem;
}

.feed-group__label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
  padding: 0 0.25rem;
}

.feed-group__list {
  display: grid;
  gap: 0.5rem;
}

/* ── Notification card ── */
.notification-card {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 1rem;
  align-items: start;
  padding: 1.1rem 1.25rem;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.notification-card:hover {
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.07);
  transform: translateY(-1px);
}

.notification-card--unread {
  border-color: rgba(0, 200, 83, 0.18);
  background: rgba(0, 200, 83, 0.025);
}

/* ── Type icon ── */
.notif-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notif-icon--info {
  background: #e8f0fe;
  color: #1a56c4;
}

.notif-icon--success {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}

.notif-icon--warning {
  background: #fff3dc;
  color: #9a6700;
}

.notif-icon--danger {
  background: #fcebeb;
  color: #a32d2d;
}

/* ── Card body ── */
.notification-card__body {
  display: grid;
  gap: 0.45rem;
}

.notification-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.notification-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Unread dot */
.unread-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #00c853;
  flex-shrink: 0;
}

.notification-card__title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.notification-card__time {
  font-size: 0.76rem;
  color: var(--color-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.notification-card__message {
  margin: 0;
  font-size: 0.84rem;
  color: var(--color-muted);
  line-height: 1.55;
}

/* ── Card actions ── */
.notification-card__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
}

.notif-btn {
  padding: 0.38rem 0.85rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: none;
  transition:
    background 0.14s ease,
    transform 0.14s ease;
}

.notif-btn:active {
  transform: scale(0.97);
}

.notif-btn--primary {
  background: rgba(0, 200, 83, 0.1);
  color: #007a32;
}

.notif-btn--primary:hover {
  background: rgba(0, 200, 83, 0.18);
}

.notif-btn--ghost {
  background: transparent;
  color: var(--color-muted);
}

.notif-btn--ghost:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .notification-card {
    grid-template-columns: 36px 1fr;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
  }
}
</style>
