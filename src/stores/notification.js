import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { playScoreUpdateClick } from '../utils/notificationSound'

const NOTIFICATION_STORAGE_KEY = 'tennis.local.notifications.v1'
const MATCH_EVENT_STORAGE_KEY = 'tennis.local.matchEventSignatures.v1'

function createId() {
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function loadStoredJson(key, fallback) {
  if (!canUseStorage()) {
    return fallback
  }

  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

function saveStoredJson(key, value) {
  if (canUseStorage()) {
    window.localStorage.setItem(key, JSON.stringify(value))
  }
}

function getMatchSignature(match) {
  return [match.status, match.score || '', match.winnerId || '', match.updatedAt || ''].join('|')
}

function getRoundLabel(match) {
  if (match.groupId) {
    return `Group ${match.groupId}`
  }

  return match.matchCode || match.round || 'Tournament match'
}

function buildTournamentScoreNotification(match, currentPlayerId = '') {
  const isParticipant = Boolean(
    currentPlayerId && (match.player1Id === currentPlayerId || match.player2Id === currentPlayerId),
  )
  const winnerName = match.winnerName || (match.winnerId === match.player1Id ? match.player1Name : match.player2Name)
  const categoryLabel = match.categoryName || match.categoryId || 'Tournament'
  const isFinal = match.stage === 'final' || match.round === 'final' || match.matchCode === 'Final'

  if (isFinal) {
    return {
      title: isParticipant ? 'Your final is complete' : `${categoryLabel} has a champion`,
      message: `${winnerName} won ${match.player1Name} vs ${match.player2Name}, ${match.score}.`,
      type: 'success',
    }
  }

  if (isParticipant) {
    return {
      title: 'Your tournament match updated',
      message: `${match.player1Name} vs ${match.player2Name} is now ${match.score}. Winner: ${winnerName}.`,
      type: 'success',
    }
  }

  return {
    title: `${categoryLabel} score update`,
    message: `${getRoundLabel(match)} finished. ${winnerName} won ${match.score}.`,
    type: 'info',
  }
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref(loadStoredJson(NOTIFICATION_STORAGE_KEY, []))
  const toasts = ref([])
  const matchEventSignatures = ref(loadStoredJson(MATCH_EVENT_STORAGE_KEY, {}))

  const unreadCount = computed(() => notifications.value.filter((item) => !item.read).length)
  const recentNotifications = computed(() =>
    [...notifications.value].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
  )

  const addNotification = ({
    title,
    message,
    type = 'info',
    time = new Date().toISOString(),
    read = false,
    eventKey = '',
    meta = {},
  }) => {
    if (eventKey && notifications.value.some((notification) => notification.eventKey === eventKey)) {
      return null
    }

    const id = createId()
    const notification = {
      id,
      title,
      message,
      type,
      time,
      read,
      eventKey,
      meta,
    }
    notifications.value.unshift(notification)
    saveStoredJson(NOTIFICATION_STORAGE_KEY, notifications.value)
    return notification
  }

  const addToast = ({ message, type = 'success', duration = 4000, sound = false }) => {
    const id = createId()
    toasts.value.push({ id, message, type, duration, sound })

    if (sound) {
      playScoreUpdateClick().catch(() => {})
    }

    window.setTimeout(() => {
      dismissToast(id)
    }, duration)

    return id
  }

  const markRead = (id) => {
    const item = notifications.value.find((notification) => notification.id === id)
    if (item) {
      item.read = true
      saveStoredJson(NOTIFICATION_STORAGE_KEY, notifications.value)
    }
  }

  const dismissNotification = (id) => {
    notifications.value = notifications.value.filter((notification) => notification.id !== id)
    saveStoredJson(NOTIFICATION_STORAGE_KEY, notifications.value)
  }

  const clearNotifications = () => {
    notifications.value = []
    saveStoredJson(NOTIFICATION_STORAGE_KEY, notifications.value)
  }

  const dismissToast = (id) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  const rememberMatchEvent = (match) => {
    if (!match?.id) {
      return
    }

    matchEventSignatures.value = {
      ...matchEventSignatures.value,
      [match.id]: getMatchSignature(match),
    }
    saveStoredJson(MATCH_EVENT_STORAGE_KEY, matchEventSignatures.value)
  }

  const addTournamentScoreNotification = (match, currentPlayerId = '') => {
    if (!match?.id || match.type !== 'tournament' || !['completed', 'walkover'].includes(match.status)) {
      return null
    }

    const signature = getMatchSignature(match)
    const notification = addNotification({
      ...buildTournamentScoreNotification(match, currentPlayerId),
      eventKey: `tournament-score:${match.id}:${signature}`,
      meta: {
        matchId: match.id,
        tournamentId: match.tournamentId,
        categoryId: match.categoryId,
        winnerId: match.winnerId,
      },
    })
    rememberMatchEvent(match)
    return notification
  }

  const syncTournamentMatchEvents = (matchList = [], currentPlayerId = '') => {
    matchList
      .filter((match) => match.type === 'tournament' && !match.isBye)
      .filter((match) => ['completed', 'walkover'].includes(match.status))
      .forEach((match) => {
        const signature = getMatchSignature(match)
        const previousSignature = matchEventSignatures.value[match.id]

        if (!previousSignature) {
          rememberMatchEvent(match)
          return
        }

        if (previousSignature !== signature) {
          addTournamentScoreNotification(match, currentPlayerId)
        }
      })
  }

  return {
    notifications,
    toasts,
    unreadCount,
    recentNotifications,
    addNotification,
    addToast,
    addTournamentScoreNotification,
    syncTournamentMatchEvents,
    rememberMatchEvent,
    markRead,
    dismissNotification,
    clearNotifications,
    dismissToast,
  }
})
