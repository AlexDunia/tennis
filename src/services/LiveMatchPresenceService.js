const CHANNEL_NAME = 'gorra.liveMatchPresence.v1'
const HEARTBEAT_MS = 5000
const STALE_AFTER_MS = 18000
const MATCH_ID_MAX_LENGTH = 120
const ACTOR_ID_MAX_LENGTH = 120
const ACTOR_NAME_MAX_LENGTH = 80

export const LIVE_MATCH_PRESENCE_ROLES = Object.freeze({
  SCORER: 'scorer',
  PARTICIPANT: 'participant',
  CLUB_CONTROL: 'club_control',
  VIEWER: 'viewer',
})

const validRoles = new Set(Object.values(LIVE_MATCH_PRESENCE_ROLES))
const rolePriority = Object.freeze({ scorer: 4, participant: 3, club_control: 2, viewer: 1 })
const runtimeServices = new Set()
let serviceSequence = 0

function clean(value, maxLength) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function normalizeRole(value) {
  return validRoles.has(value) ? value : LIVE_MATCH_PRESENCE_ROLES.VIEWER
}

function normalizeEntry(entry, currentTime) {
  const matchId = clean(entry?.matchId, MATCH_ID_MAX_LENGTH)
  const actorId = clean(entry?.actorId, ACTOR_ID_MAX_LENGTH)
  const presenceId = clean(entry?.presenceId, ACTOR_ID_MAX_LENGTH)
  if (!matchId || !actorId || !presenceId) return null

  const lastSeenAt = Number(entry?.lastSeenAt)
  return {
    presenceId,
    matchId,
    actorId,
    actorName: clean(entry?.actorName, ACTOR_NAME_MAX_LENGTH) || 'Someone',
    role: normalizeRole(entry?.role),
    lastSeenAt: Number.isFinite(lastSeenAt) && lastSeenAt > 0 ? lastSeenAt : currentTime,
  }
}

function clone(entry) {
  return entry ? { ...entry } : null
}

function makeChannel(factory) {
  if (factory) return factory(CHANNEL_NAME)
  if (typeof window !== 'undefined' && typeof BroadcastChannel === 'function') return new BroadcastChannel(CHANNEL_NAME)
  return null
}

/**
 * Ephemeral, tab-to-tab presence. This never grants scoring authority and never
 * persists identity or viewing history. Canonical scoring stays in LiveMatchSession.
 */
export function createLiveMatchPresenceService(options = {}) {
  const now = options.now || (() => Date.now())
  const interval = options.setInterval || globalThis.setInterval?.bind(globalThis)
  const clearInterval = options.clearInterval || globalThis.clearInterval?.bind(globalThis)
  const heartbeatMs = Number(options.heartbeatMs) || HEARTBEAT_MS
  const staleAfterMs = Number(options.staleAfterMs) || STALE_AFTER_MS
  const instanceId = `presence-service-${++serviceSequence}`
  const channel = options.channel === undefined ? makeChannel(options.createChannel) : options.channel
  const entries = new Map()
  const localPresenceIds = new Set()
  const subscribers = new Map()
  const seenMessages = new Set()
  let sequence = 0
  let timer = null
  let disposed = false

  function visibleEntries(matchId) {
    const wantedMatchId = clean(matchId, MATCH_ID_MAX_LENGTH)
    const byActor = new Map()
    for (const entry of entries.values()) {
      if (entry.matchId !== wantedMatchId) continue
      const existing = byActor.get(entry.actorId)
      if (!existing || entry.lastSeenAt > existing.lastSeenAt || (
        entry.lastSeenAt === existing.lastSeenAt && rolePriority[entry.role] > rolePriority[existing.role]
      )) {
        byActor.set(entry.actorId, entry)
      }
    }
    return [...byActor.values()].sort((left, right) => right.lastSeenAt - left.lastSeenAt).map(clone)
  }

  function notify(matchId, type, entry = null) {
    const listeners = subscribers.get(matchId)
    if (!listeners?.size) return
    const event = { type, entry: clone(entry) }
    const list = visibleEntries(matchId)
    listeners.forEach((listener) => listener(list, event))
  }

  function pruneExpired() {
    const currentTime = now()
    for (const [presenceId, entry] of entries) {
      if (currentTime - entry.lastSeenAt <= staleAfterMs) continue
      entries.delete(presenceId)
      localPresenceIds.delete(presenceId)
      notify(entry.matchId, 'expired', entry)
    }
  }

  function rememberMessage(messageId) {
    if (!messageId || seenMessages.has(messageId)) return false
    seenMessages.add(messageId)
    if (seenMessages.size > 400) seenMessages.delete(seenMessages.values().next().value)
    return true
  }

  function publish(type, entry = null, matchId = '') {
    const message = {
      kind: CHANNEL_NAME,
      type,
      messageId: `${instanceId}-${++sequence}`,
      senderId: instanceId,
      matchId: clean(matchId || entry?.matchId, MATCH_ID_MAX_LENGTH),
      entry: clone(entry),
    }
    rememberMessage(message.messageId)
    try { channel?.postMessage(message) } catch { /* Presence remains available in this tab. */ }
    runtimeServices.forEach((service) => {
      if (service !== api) service._receive(message)
    })
  }

  function receive(message) {
    if (disposed || !message || message.kind !== CHANNEL_NAME || message.senderId === instanceId) return
    if (!rememberMessage(message.messageId)) return
    const messageMatchId = clean(message.matchId || message.entry?.matchId, MATCH_ID_MAX_LENGTH)

    if (message.type === 'sync_request') {
      for (const presenceId of localPresenceIds) {
        const entry = entries.get(presenceId)
        if (entry?.matchId === messageMatchId) publish('sync_response', entry)
      }
      return
    }

    const entry = normalizeEntry(message.entry, now())
    if (!entry) return
    if (message.type === 'leave') {
      const existing = entries.get(entry.presenceId)
      if (existing) {
        entries.delete(entry.presenceId)
        localPresenceIds.delete(entry.presenceId)
        notify(existing.matchId, 'leave', existing)
      }
      return
    }

    const existing = entries.get(entry.presenceId)
    if (existing && entry.lastSeenAt < existing.lastSeenAt) return
    entries.set(entry.presenceId, entry)
    notify(entry.matchId, message.type === 'join' && !existing ? 'join' : message.type === 'sync_response' ? 'snapshot' : 'update', entry)
  }

  function ensureHeartbeat() {
    if (timer || !localPresenceIds.size || !interval) return
    timer = interval(() => {
      if (disposed) return
      const currentTime = now()
      for (const presenceId of localPresenceIds) {
        const entry = entries.get(presenceId)
        if (!entry) continue
        entry.lastSeenAt = currentTime
        publish('heartbeat', entry)
      }
      pruneExpired()
    }, heartbeatMs)
  }

  function stopHeartbeatIfIdle() {
    if (localPresenceIds.size || !timer) return
    clearInterval?.(timer)
    timer = null
  }

  function join({ matchId, actorId, actorName, role } = {}) {
    const entry = normalizeEntry({
      matchId,
      actorId,
      actorName,
      role,
      presenceId: `${instanceId}-${++sequence}`,
      lastSeenAt: now(),
    }, now())
    if (!entry || disposed) return { presenceId: '', updateRole() {}, leave() {} }
    entries.set(entry.presenceId, entry)
    localPresenceIds.add(entry.presenceId)
    notify(entry.matchId, 'join', entry)
    publish('join', entry)
    publish('sync_request', null, entry.matchId)
    ensureHeartbeat()
    let left = false
    return {
      presenceId: entry.presenceId,
      updateRole(nextRole) {
        if (left || disposed) return
        const current = entries.get(entry.presenceId)
        if (!current) return
        current.role = normalizeRole(nextRole)
        current.lastSeenAt = now()
        notify(current.matchId, 'update', current)
        publish('update', current)
      },
      leave() {
        if (left) return
        left = true
        const current = entries.get(entry.presenceId)
        localPresenceIds.delete(entry.presenceId)
        if (current) {
          entries.delete(entry.presenceId)
          notify(current.matchId, 'leave', current)
          publish('leave', current)
        }
        stopHeartbeatIfIdle()
      },
    }
  }

  function subscribe(matchId, listener) {
    const normalizedMatchId = clean(matchId, MATCH_ID_MAX_LENGTH)
    if (!normalizedMatchId || typeof listener !== 'function' || disposed) return () => {}
    const listeners = subscribers.get(normalizedMatchId) || new Set()
    listeners.add(listener)
    subscribers.set(normalizedMatchId, listeners)
    pruneExpired()
    listener(visibleEntries(normalizedMatchId), { type: 'snapshot', entry: null })
    publish('sync_request', null, normalizedMatchId)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) subscribers.delete(normalizedMatchId)
    }
  }

  function list(matchId) {
    pruneExpired()
    return visibleEntries(clean(matchId, MATCH_ID_MAX_LENGTH))
  }

  function dispose() {
    if (disposed) return
    for (const presenceId of [...localPresenceIds]) {
      const entry = entries.get(presenceId)
      if (entry) publish('leave', entry)
    }
    disposed = true
    localPresenceIds.clear()
    entries.clear()
    subscribers.clear()
    if (timer) clearInterval?.(timer)
    timer = null
    try { channel?.close?.() } catch { /* nothing to clean up */ }
    runtimeServices.delete(api)
  }

  const api = { join, subscribe, list, dispose, _receive: receive, _pruneExpired: pruneExpired }
  if (channel) {
    channel.onmessage = (event) => receive(event?.data)
  }
  runtimeServices.add(api)
  return api
}

export const liveMatchPresenceService = createLiveMatchPresenceService()