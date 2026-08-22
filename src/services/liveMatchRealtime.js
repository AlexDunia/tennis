/*
 * GORRA — LOCAL LIVE MATCH TRANSPORT
 *
 * Current implementation:
 *
 * BroadcastChannel
 *        +
 * localStorage fallback/cache
 *
 * Future implementation:
 *
 * Laravel + WebSocket/SSE/realtime provider
 *
 * Consumers should not need to know which transport
 * produced the snapshot.
 */

import {
  LIVE_SCOREBOARD_SCHEMA_VERSION,
  LIVE_SCOREBOARD_SNAPSHOT_KIND,
} from '../utils/liveScoreboardSnapshot'

const CHANNEL_NAME = 'gorra.liveScoreboard.v1'

const STORAGE_PREFIX = 'gorra.liveScoreboardSnapshot.v1.'

const LOCAL_EVENT_NAME = 'gorra:live-scoreboard-snapshot'

let publisherChannel = null

let lastPublishedAt = 0

function browserAvailable() {
  return typeof window !== 'undefined'
}

function normalizedMatchId(matchId) {
  return String(matchId || '').trim()
}

function storageKey(matchId) {
  return STORAGE_PREFIX + encodeURIComponent(normalizedMatchId(matchId))
}

function cloneSerializable(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function validSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return false
  }

  if (snapshot.kind !== LIVE_SCOREBOARD_SNAPSHOT_KIND) {
    return false
  }

  if (snapshot.schemaVersion !== LIVE_SCOREBOARD_SCHEMA_VERSION) {
    return false
  }

  if (!normalizedMatchId(snapshot.matchId)) {
    return false
  }

  if (!['live', 'finished', 'completed'].includes(snapshot.status)) {
    return false
  }

  return true
}

function parseStoredSnapshot(raw) {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)

    return validSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

function getPublisherChannel() {
  if (!browserAvailable() || !('BroadcastChannel' in window)) {
    return null
  }

  if (publisherChannel) {
    return publisherChannel
  }

  try {
    publisherChannel = new window.BroadcastChannel(CHANNEL_NAME)

    return publisherChannel
  } catch {
    return null
  }
}

/*
 * READ MOST RECENT CACHED PUBLIC SNAPSHOT
 */
export function readLiveMatchSnapshot(matchId) {
  if (!browserAvailable() || !window.localStorage) {
    return null
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return null
  }

  try {
    return parseStoredSnapshot(window.localStorage.getItem(storageKey(id)))
  } catch {
    return null
  }
}

/*
 * PUBLISH AUTHORITATIVE STATE PROJECTION
 *
 * This does not alter match state.
 *
 * It only distributes an already-decided state.
 */
export function publishLiveMatchSnapshot(snapshot) {
  if (!browserAvailable() || !validSnapshot(snapshot)) {
    return false
  }

  const cloned = cloneSerializable(snapshot)

  if (!cloned) {
    return false
  }

  /*
   * Keep timestamps monotonic inside the active
   * publisher even if two events happen in the same
   * millisecond.
   */
  const now = Date.now()

  lastPublishedAt = Math.max(now, lastPublishedAt + 1)

  const payload = {
    ...cloned,

    publishedAt: lastPublishedAt,
  }

  let delivered = false

  /*
   * Persistent local cache + old-browser cross-tab
   * fallback.
   */
  if (window.localStorage) {
    try {
      window.localStorage.setItem(
        storageKey(payload.matchId),

        JSON.stringify(payload),
      )

      delivered = true
    } catch {
      /*
       * Storage may be unavailable in private/restricted
       * browsing. BroadcastChannel can still work.
       */
    }
  }

  /*
   * Fast same-origin tab-to-tab path.
   */
  const channel = getPublisherChannel()

  if (channel) {
    try {
      channel.postMessage(payload)

      delivered = true
    } catch {
      // localStorage remains fallback
    }
  }

  /*
   * Same-page consumers do not receive the browser's
   * storage event, so provide a tiny local event too.
   */
  try {
    window.dispatchEvent(
      new CustomEvent(LOCAL_EVENT_NAME, {
        detail: payload,
      }),
    )

    delivered = true
  } catch {
    // no-op
  }

  return delivered
}

function isNewerSnapshot(incoming, current) {
  if (!current) {
    return true
  }

  const incomingRevision = Number(incoming.revision || 0)

  const currentRevision = Number(current.revision || 0)

  if (incomingRevision > currentRevision) {
    return true
  }

  if (incomingRevision < currentRevision) {
    return false
  }

  return Number(incoming.publishedAt || 0) > Number(current.publishedAt || 0)
}

/*
 * READ-ONLY SUBSCRIPTION
 *
 * Returns an unsubscribe function.
 */
export function subscribeToLiveMatch(matchId, onSnapshot, options = {}) {
  if (!browserAvailable() || typeof onSnapshot !== 'function') {
    return () => {}
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return () => {}
  }

  const { emitCurrent = true } = options

  let current = null

  let subscriberChannel = null

  function accept(candidate) {
    if (!validSnapshot(candidate)) {
      return
    }

    if (candidate.matchId !== id) {
      return
    }

    if (!isNewerSnapshot(candidate, current)) {
      return
    }

    current = cloneSerializable(candidate)

    if (!current) {
      return
    }

    onSnapshot(current)
  }

  function handleStorage(event) {
    if (event.key !== storageKey(id)) {
      return
    }

    accept(parseStoredSnapshot(event.newValue))
  }

  function handleLocalEvent(event) {
    accept(event.detail)
  }

  window.addEventListener('storage', handleStorage)

  window.addEventListener(LOCAL_EVENT_NAME, handleLocalEvent)

  if ('BroadcastChannel' in window) {
    try {
      subscriberChannel = new window.BroadcastChannel(CHANNEL_NAME)

      subscriberChannel.onmessage = (event) => {
        accept(event.data)
      }
    } catch {
      subscriberChannel = null
    }
  }

  if (emitCurrent) {
    accept(readLiveMatchSnapshot(id))
  }

  return () => {
    window.removeEventListener('storage', handleStorage)

    window.removeEventListener(LOCAL_EVENT_NAME, handleLocalEvent)

    if (subscriberChannel) {
      subscriberChannel.close()
    }
  }
}
