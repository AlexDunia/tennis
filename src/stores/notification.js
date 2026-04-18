import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

function createId() {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref([])
  const toasts = ref([])

  const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length)

  const addNotification = ({
    title,
    message,
    type = 'info',
    time = new Date().toISOString(),
    read = false,
  }) => {
    const id = createId()
    const notification = {
      id,
      title,
      message,
      type,
      time,
      read,
    }
    notifications.value.unshift(notification)
    return notification
  }

  const addToast = ({ message, type = 'success', duration = 4000 }) => {
    const id = createId()
    toasts.value.push({ id, message, type })

    window.setTimeout(() => {
      dismissToast(id)
    }, duration)

    return id
  }

  const markRead = (id) => {
    const item = notifications.value.find((notification) => notification.id === id)
    if (item) {
      item.read = true
    }
  }

  const dismissNotification = (id) => {
    notifications.value = notifications.value.filter((notification) => notification.id !== id)
  }

  const clearNotifications = () => {
    notifications.value = []
  }

  const dismissToast = (id) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    notifications,
    toasts,
    unreadCount,
    addNotification,
    addToast,
    markRead,
    dismissNotification,
    clearNotifications,
    dismissToast,
  }
})
