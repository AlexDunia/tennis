import {
  applyLiveMatchSessionCommand,
  createLiveMatchSessionContract,
} from '../domain/liveMatchSession.js'

const STORAGE_PREFIX = 'gorra.liveMatchSession.v1.'
const CHANNEL_NAME = 'gorra.liveMatchSession.v1'
const localSubscribers = new Map()

function cleanId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function storageKey(matchId) {
  const id = cleanId(matchId)
  return id ? `${STORAGE_PREFIX}${encodeURIComponent(id)}` : ''
}

function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

function browserEvents() {
  return typeof window !== 'undefined' ? window : null
}

function createChannel() {
  try {
    return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL_NAME)
      : null
  } catch {
    return null
  }
}

function notifyLocal(matchId, session, source) {
  const listeners = localSubscribers.get(cleanId(matchId))
  if (!listeners) return
  listeners.forEach((listener) => listener(session, { source }))
}

export function createLiveMatchSessionRepository(options = {}) {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const eventTarget = options.eventTarget === undefined ? browserEvents() : options.eventTarget
  const channel = options.channel === undefined ? createChannel() : options.channel
  const instanceId =
    options.instanceId ||
    `session-repository-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  let disposed = false
  const memory = new Map()

  function get(matchId) {
    const key = storageKey(matchId)
    if (!key) return null
    try {
      const raw = storage ? storage.getItem(key) : memory.get(key)
      const parsed = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw || null
      const result = createLiveMatchSessionContract(parsed || {})
      return result.ok && result.session.matchId === cleanId(matchId) ? result.session : null
    } catch {
      return null
    }
  }

  function emit(session, source = 'repository') {
    if (!session?.matchId) return
    notifyLocal(session.matchId, session, source)
    try {
      channel?.postMessage({
        type: 'session',
        sender: instanceId,
        matchId: session.matchId,
        session,
      })
    } catch {
      // localStorage and same-runtime subscribers remain available.
    }
  }

  function save(inputSession, saveOptions = {}) {
    const normalized = createLiveMatchSessionContract(inputSession)
    if (!normalized.ok) {
      return { ok: false, session: null, code: 'invalid_session', issues: normalized.issues }
    }
    const session = normalized.session
    const current = get(session.matchId)
    if (
      saveOptions.expectedScoreRevision !== undefined &&
      current &&
      current.scoreRevision !== Number(saveOptions.expectedScoreRevision)
    ) {
      return {
        ok: false,
        session: current,
        code: 'stale_score_revision',
        issues: [],
      }
    }
    if (
      saveOptions.expectedAuthorityRevision !== undefined &&
      current &&
      current.authorityRevision !== Number(saveOptions.expectedAuthorityRevision)
    ) {
      return {
        ok: false,
        session: current,
        code: 'stale_authority_revision',
        issues: [],
      }
    }
    memory.set(storageKey(session.matchId), session)
    if (!storage) {
      emit(session, 'memory')
      return { ok: true, session, code: '', issues: [] }
    }
    try {
      storage.setItem(storageKey(session.matchId), JSON.stringify(session))
      emit(session, 'save')
      return { ok: true, session, code: '', issues: [] }
    } catch {
      return { ok: false, session: current, code: 'persistence_failed', issues: [] }
    }
  }

  function create(session) {
    const existing = get(session?.matchId)
    if (existing) return { ok: true, session: existing, created: false, code: '' }
    const saved = save(session)
    return { ...saved, created: Boolean(saved.ok) }
  }

  function applyCommand(matchId, command) {
    const current = get(matchId)
    if (!current) {
      return {
        ok: false,
        session: null,
        code: 'session_not_found',
        message: 'The live session could not be found.',
      }
    }
    const result = applyLiveMatchSessionCommand(current, command)
    if (!result.ok || result.duplicate) return result
    const saved = save(result.session, {
      expectedScoreRevision: current.scoreRevision,
      expectedAuthorityRevision: current.authorityRevision,
    })
    return saved.ok
      ? { ...result, session: saved.session }
      : {
          ok: false,
          session: saved.session || current,
          code: saved.code,
          message: 'The live session changed before this command could be saved.',
        }
  }

  function subscribe(matchId, listener) {
    const id = cleanId(matchId)
    if (!id || typeof listener !== 'function') return () => {}
    const listeners = localSubscribers.get(id) || new Set()
    listeners.add(listener)
    localSubscribers.set(id, listeners)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) localSubscribers.delete(id)
    }
  }

  function refresh(matchId) {
    const session = get(matchId)
    if (session) notifyLocal(matchId, session, 'refresh')
    return session
  }

  function handleStorage(event) {
    if (!event?.key?.startsWith(STORAGE_PREFIX)) return
    const matchId = decodeURIComponent(event.key.slice(STORAGE_PREFIX.length))
    const session = get(matchId)
    if (session) notifyLocal(matchId, session, 'storage')
  }

  function handleChannel(event) {
    const message = event?.data
    if (
      !message ||
      message.type !== 'session' ||
      message.sender === instanceId ||
      !message.matchId
    ) {
      return
    }
    const normalized = createLiveMatchSessionContract(message.session || {})
    if (normalized.ok) notifyLocal(message.matchId, normalized.session, 'broadcast')
  }

  eventTarget?.addEventListener?.('storage', handleStorage)
  channel?.addEventListener?.('message', handleChannel)

  function dispose() {
    if (disposed) return
    disposed = true
    eventTarget?.removeEventListener?.('storage', handleStorage)
    channel?.removeEventListener?.('message', handleChannel)
    channel?.close?.()
  }

  return {
    get,
    create,
    save,
    applyCommand,
    subscribe,
    refresh,
    dispose,
    storageKey,
  }
}

export const liveMatchSessionRepository = createLiveMatchSessionRepository()
