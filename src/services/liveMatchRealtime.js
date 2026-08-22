/*
 * GORRA — LOCAL LIVE MATCH TRANSPORT
 *
 * CURRENT:
 *
 * BroadcastChannel
 * + localStorage cache/fallback
 * + tiny publisher heartbeat
 *
 * FUTURE:
 *
 * Laravel authoritative match state
 * + WebSocket/SSE/realtime provider
 *
 * The scoreboard does not care which transport
 * produced the public snapshot.
 */

import {
  LIVE_SCOREBOARD_SCHEMA_VERSION,
  LIVE_SCOREBOARD_SNAPSHOT_KIND,
} from '../utils/liveScoreboardSnapshot'

const CHANNEL_NAME = 'gorra.liveScoreboard.v1'

const STORAGE_PREFIX = 'gorra.liveScoreboardSnapshot.v1.'

const HEARTBEAT_STORAGE_PREFIX = 'gorra.liveScoreboardHeartbeat.v1.'

const LOCAL_EVENT_NAME = 'gorra:live-scoreboard-snapshot'

const LOCAL_HEARTBEAT_EVENT_NAME = 'gorra:live-scoreboard-heartbeat'

const HEARTBEAT_KIND = 'gorra.live-scoreboard-heartbeat'

export const LIVE_SCOREBOARD_HEARTBEAT_INTERVAL_MS = 8000

export const LIVE_SCOREBOARD_STALE_AFTER_MS = 24000

const CONNECTION_CHECK_INTERVAL_MS = 4000

let publisherChannel = null

let lastPublishedAt = 0

function browserAvailable() {
  return typeof window !== 'undefined'
}

function normalizedMatchId(matchId) {
  return String(matchId || '')
    .trim()
    .slice(0, 120)
}

function storageKey(matchId) {
  return STORAGE_PREFIX + encodeURIComponent(normalizedMatchId(matchId))
}

function heartbeatStorageKey(matchId) {
  return HEARTBEAT_STORAGE_PREFIX + encodeURIComponent(normalizedMatchId(matchId))
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

function validHeartbeat(heartbeat) {
  if (!heartbeat || typeof heartbeat !== 'object') {
    return false
  }

  if (heartbeat.kind !== HEARTBEAT_KIND) {
    return false
  }

  if (!normalizedMatchId(heartbeat.matchId)) {
    return false
  }

  return Number.isFinite(Number(heartbeat.sentAt))
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
 * PUBLIC SNAPSHOT ORDERING
 *
 * Revision is authoritative first.
 *
 * publishedAt only resolves multiple transport
 * deliveries of the same authoritative revision.
 */
export function isLiveMatchSnapshotNewer(incoming, current) {
  if (!current) {
    return true
  }

  const incomingRevision = Number(incoming?.revision || 0)

  const currentRevision = Number(current?.revision || 0)

  if (incomingRevision > currentRevision) {
    return true
  }

  if (incomingRevision < currentRevision) {
    return false
  }

  return Number(incoming?.publishedAt || 0) > Number(current?.publishedAt || 0)
}

/*
 * READ MOST RECENT PUBLIC SNAPSHOT
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
 * READ MOST RECENT PUBLISHER HEARTBEAT
 */
export function readLiveMatchHeartbeat(matchId) {
  if (!browserAvailable() || !window.localStorage) {
    return 0
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return 0
  }

  try {
    const value = Number(window.localStorage.getItem(heartbeatStorageKey(id)) || 0)

    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

/*
 * PUBLISH ALREADY-AUTHORITATIVE STATE.
 *
 * No score is calculated here.
 */
export function publishLiveMatchSnapshot(snapshot) {
  if (!browserAvailable() || !validSnapshot(snapshot)) {
    return false
  }

  const cloned = cloneSerializable(snapshot)

  if (!cloned) {
    return false
  }

  const now = Date.now()

  lastPublishedAt = Math.max(now, lastPublishedAt + 1)

  const payload = {
    ...cloned,

    publishedAt: lastPublishedAt,
  }

  let delivered = false

  /*
   * Durable same-origin cache.
   *
   * Useful after:
   *
   * - refresh
   * - browser sleep
   * - missed BroadcastChannel event
   */
  if (window.localStorage) {
    try {
      window.localStorage.setItem(
        storageKey(payload.matchId),

        JSON.stringify(payload),
      )

      delivered = true
    } catch {
      // restricted storage
    }
  }

  const channel = getPublisherChannel()

  if (channel) {
    try {
      channel.postMessage(payload)

      delivered = true
    } catch {
      // storage remains fallback
    }
  }

  /*
   * BroadcastChannel/storage events do not notify
   * subscribers in the same document.
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

/*
 * HEARTBEAT
 *
 * This does NOT duplicate the full score snapshot.
 *
 * It writes only a timestamp to localStorage and sends
 * a tiny transport signal.
 *
 * This keeps liveness separate from tennis state.
 */
export function publishLiveMatchHeartbeat(matchId) {
  if (!browserAvailable()) {
    return false
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return false
  }

  const sentAt = Date.now()

  const heartbeat = {
    kind: HEARTBEAT_KIND,

    matchId: id,

    sentAt,
  }

  let delivered = false

  if (window.localStorage) {
    try {
      window.localStorage.setItem(heartbeatStorageKey(id), String(sentAt))

      delivered = true
    } catch {
      // BroadcastChannel may still work.
    }
  }

  const channel = getPublisherChannel()

  if (channel) {
    try {
      channel.postMessage(heartbeat)

      delivered = true
    } catch {
      // storage remains fallback
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent(LOCAL_HEARTBEAT_EVENT_NAME, {
        detail: heartbeat,
      }),
    )

    delivered = true
  } catch {
    // no-op
  }

  return delivered
}

/*
 * Starts one low-cost heartbeat for an ACTIVE match.
 *
 * Returns a cleanup function.
 */
export function startLiveMatchHeartbeat(matchId) {
  if (!browserAvailable()) {
    return () => {}
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return () => {}
  }

  publishLiveMatchHeartbeat(id)

  const timer = window.setInterval(
    () => {
      publishLiveMatchHeartbeat(id)
    },

    LIVE_SCOREBOARD_HEARTBEAT_INTERVAL_MS,
  )

  return () => {
    window.clearInterval(timer)
  }
}

/*
 * READ-ONLY SCOREBOARD SUBSCRIPTION
 *
 * Connection states:
 *
 * connecting
 * fresh
 * stale
 * complete
 *
 * `stale` means:
 *
 * "keep showing the last confirmed score,
 * but do not pretend that the live source is fresh."
 */
export function subscribeToLiveMatch(matchId, onSnapshot, options = {}) {
  if (!browserAvailable() || typeof onSnapshot !== 'function') {
    return () => {}
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return () => {}
  }

  const {
    emitCurrent = true,

    onConnectionState = null,
  } = options

  let current = null

  let lastSignalAt = 0

  let subscriberChannel = null

  let connectionTimer = null

  let connectionState = ''

  function setConnectionState(nextState) {
    if (nextState === connectionState) {
      return
    }

    connectionState = nextState

    if (typeof onConnectionState === 'function') {
      onConnectionState(nextState)
    }
  }

  function matchIsTerminal() {
    return ['finished', 'completed'].includes(current?.status)
  }

  function markSignal(timestamp = Date.now()) {
    const numericTimestamp = Number(timestamp)

    if (Number.isFinite(numericTimestamp)) {
      lastSignalAt = Math.max(lastSignalAt, numericTimestamp)
    } else {
      lastSignalAt = Date.now()
    }

    if (matchIsTerminal()) {
      setConnectionState('complete')

      return
    }

    setConnectionState('fresh')
  }

  function accept(candidate) {
    if (!validSnapshot(candidate)) {
      return
    }

    if (candidate.matchId !== id) {
      return
    }

    if (!isLiveMatchSnapshotNewer(candidate, current)) {
      return
    }

    current = cloneSerializable(candidate)

    if (!current) {
      return
    }

    markSignal(candidate.publishedAt || Date.now())

    onSnapshot(current)
  }

  function acceptHeartbeat(heartbeat) {
    if (!validHeartbeat(heartbeat)) {
      return
    }

    if (heartbeat.matchId !== id) {
      return
    }

    markSignal(heartbeat.sentAt)
  }

  function handleStorage(event) {
    if (event.key === storageKey(id)) {
      accept(parseStoredSnapshot(event.newValue))

      return
    }

    if (event.key === heartbeatStorageKey(id)) {
      const sentAt = Number(event.newValue || 0)

      if (Number.isFinite(sentAt) && sentAt > 0) {
        acceptHeartbeat({
          kind: HEARTBEAT_KIND,

          matchId: id,

          sentAt,
        })
      }
    }
  }

  function handleLocalEvent(event) {
    accept(event.detail)
  }

  function handleLocalHeartbeat(event) {
    acceptHeartbeat(event.detail)
  }

  window.addEventListener('storage', handleStorage)

  window.addEventListener(LOCAL_EVENT_NAME, handleLocalEvent)

  window.addEventListener(LOCAL_HEARTBEAT_EVENT_NAME, handleLocalHeartbeat)

  if ('BroadcastChannel' in window) {
    try {
      subscriberChannel = new window.BroadcastChannel(CHANNEL_NAME)

      subscriberChannel.onmessage = (event) => {
        if (validHeartbeat(event.data)) {
          acceptHeartbeat(event.data)

          return
        }

        accept(event.data)
      }
    } catch {
      subscriberChannel = null
    }
  }

  /*
   * Recover the last liveness signal before evaluating
   * a cached snapshot.
   */
  const cachedHeartbeat = readLiveMatchHeartbeat(id)

  if (cachedHeartbeat) {
    lastSignalAt = cachedHeartbeat
  }

  setConnectionState('connecting')

  if (emitCurrent) {
    accept(readLiveMatchSnapshot(id))
  }

  /*
   * This interval does NOT poll score data.
   *
   * It only compares two timestamps already held in
   * memory.
   */
  connectionTimer = window.setInterval(
    () => {
      if (matchIsTerminal()) {
        setConnectionState('complete')

        return
      }

      if (!current) {
        setConnectionState('connecting')

        return
      }

      if (!lastSignalAt) {
        setConnectionState('connecting')

        return
      }

      const age = Date.now() - lastSignalAt

      if (age > LIVE_SCOREBOARD_STALE_AFTER_MS) {
        setConnectionState('stale')

        return
      }

      setConnectionState('fresh')
    },

    CONNECTION_CHECK_INTERVAL_MS,
  )

  return () => {
    window.removeEventListener('storage', handleStorage)

    window.removeEventListener(LOCAL_EVENT_NAME, handleLocalEvent)

    window.removeEventListener(LOCAL_HEARTBEAT_EVENT_NAME, handleLocalHeartbeat)

    if (connectionTimer) {
      window.clearInterval(connectionTimer)
    }

    if (subscriberChannel) {
      subscriberChannel.close()
    }
  }
}
