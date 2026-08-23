/*
 * GORRA — LOCAL LIVE MATCH TRANSPORT
 *
 * CURRENT:
 *
 * - BroadcastChannel
 * - localStorage cache/fallback
 * - publisher heartbeat
 * - late-subscriber snapshot recovery
 *
 * FUTURE:
 *
 * Laravel authoritative state
 * + WebSocket/SSE/realtime provider
 *
 * Consumers depend on the public snapshot contract,
 * not on this transport implementation.
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

const SNAPSHOT_REQUEST_KIND = 'gorra.live-scoreboard-request'

const STORAGE_PROBE_KEY = 'gorra.liveScoreboardStorageProbe'

const MAX_MEMORY_SNAPSHOTS = 24

const REQUEST_RESPONSE_MIN_INTERVAL_MS = 500

export const LIVE_SCOREBOARD_HEARTBEAT_INTERVAL_MS = 8000

export const LIVE_SCOREBOARD_STALE_AFTER_MS = 24000

const CONNECTION_CHECK_INTERVAL_MS = 4000

let publisherChannel = null

let requestChannel = null

let storageCapability = null

let lastPublishedAt = 0

const memorySnapshots = new Map()

const requestResponseTimes = new Map()

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

/*
 * Merely having window.localStorage does not mean
 * storage is writable.
 *
 * Some private/restricted browser modes expose the API
 * but throw as soon as it is used.
 */
function localStorageAvailable() {
  if (!browserAvailable()) {
    return false
  }

  if (storageCapability !== null) {
    return storageCapability
  }

  try {
    window.localStorage.setItem(STORAGE_PROBE_KEY, '1')

    window.localStorage.removeItem(STORAGE_PROBE_KEY)

    storageCapability = true
  } catch {
    storageCapability = false
  }

  return storageCapability
}

export function getLiveMatchTransportCapabilities() {
  if (!browserAvailable()) {
    return {
      broadcastChannel: false,
      localStorage: false,
      crossContext: false,
    }
  }

  const broadcastChannel = 'BroadcastChannel' in window

  const localStorage = localStorageAvailable()

  return {
    broadcastChannel,

    localStorage,

    crossContext: broadcastChannel || localStorage,
  }
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

function nextPublishedTimestamp() {
  const now = Date.now()

  lastPublishedAt = Math.max(now, lastPublishedAt + 1)

  return lastPublishedAt
}

/*
 * SMALL IN-MEMORY PUBLIC CACHE
 *
 * This is particularly useful when BroadcastChannel
 * works but localStorage is unavailable.
 *
 * It contains ONLY sanitized scoreboard snapshots.
 */
function cacheMemorySnapshot(snapshot) {
  if (!validSnapshot(snapshot)) {
    return
  }

  const cloned = cloneSerializable(snapshot)

  if (!cloned) {
    return
  }

  const matchId = normalizedMatchId(cloned.matchId)

  /*
   * Delete first so re-setting an existing match moves
   * it to the newest position in insertion order.
   */
  memorySnapshots.delete(matchId)

  memorySnapshots.set(matchId, cloned)

  while (memorySnapshots.size > MAX_MEMORY_SNAPSHOTS) {
    const oldestKey = memorySnapshots.keys().next().value

    if (!oldestKey) {
      break
    }

    memorySnapshots.delete(oldestKey)
  }
}

function memorySnapshotFor(matchId) {
  const id = normalizedMatchId(matchId)

  if (!id) {
    return null
  }

  return cloneSerializable(memorySnapshots.get(id)) || null
}

/*
 * PUBLIC SNAPSHOT ORDERING
 *
 * Authoritative revision wins first.
 *
 * publishedAt only resolves multiple deliveries of
 * the same authoritative revision.
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

export function readLiveMatchSnapshot(matchId) {
  const id = normalizedMatchId(matchId)

  if (!id) {
    return null
  }

  /*
   * Memory first.
   *
   * This keeps same-page/runtime recovery useful even
   * if persistent browser storage is unavailable.
   */
  const memory = memorySnapshotFor(id)

  if (memory) {
    return memory
  }

  if (!browserAvailable() || !localStorageAvailable()) {
    return null
  }

  try {
    return parseStoredSnapshot(window.localStorage.getItem(storageKey(id)))
  } catch {
    return null
  }
}

export function readLiveMatchHeartbeat(matchId) {
  if (!browserAvailable() || !localStorageAvailable()) {
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
 * PUBLISHER CHANNEL
 *
 * Unlike subscriber channels, this channel can respond
 * to "give me the latest public snapshot" requests.
 */
function getPublisherChannel() {
  if (!browserAvailable() || !('BroadcastChannel' in window)) {
    return null
  }

  if (publisherChannel) {
    return publisherChannel
  }

  try {
    publisherChannel = new window.BroadcastChannel(CHANNEL_NAME)

    publisherChannel.onmessage = handlePublisherChannelMessage

    return publisherChannel
  } catch {
    return null
  }
}

/*
 * REQUEST CHANNEL
 *
 * Kept separate from the publisher channel so a
 * scoreboard subscriber never accidentally becomes
 * a snapshot authority.
 */
function getRequestChannel() {
  if (!browserAvailable() || !('BroadcastChannel' in window)) {
    return null
  }

  if (requestChannel) {
    return requestChannel
  }

  try {
    requestChannel = new window.BroadcastChannel(CHANNEL_NAME)

    return requestChannel
  } catch {
    return null
  }
}

function handlePublisherChannelMessage(event) {
  const request = event?.data

  if (request?.kind !== SNAPSHOT_REQUEST_KIND) {
    return
  }

  const matchId = normalizedMatchId(request.matchId)

  if (!matchId) {
    return
  }

  /*
   * Tiny rate limit.
   *
   * A buggy or malicious same-origin page must not be
   * able to force continuous full-snapshot responses.
   */
  const now = Date.now()

  const previousResponse = Number(requestResponseTimes.get(matchId) || 0)

  if (now - previousResponse < REQUEST_RESPONSE_MIN_INTERVAL_MS) {
    return
  }

  requestResponseTimes.set(matchId, now)

  const current = memorySnapshotFor(matchId) || readLiveMatchSnapshot(matchId)

  if (!current) {
    return
  }

  /*
   * Same tennis revision.
   *
   * New transport publication time.
   *
   * This is a resync, not another scoring action.
   */
  const response = {
    ...current,

    publishedAt: nextPublishedTimestamp(),
  }

  cacheMemorySnapshot(response)

  if (localStorageAvailable()) {
    try {
      window.localStorage.setItem(
        storageKey(matchId),

        JSON.stringify(response),
      )
    } catch {
      // BroadcastChannel response still works.
    }
  }

  try {
    publisherChannel?.postMessage(response)
  } catch {
    // No safe cross-context response available.
  }
}

/*
 * READ-ONLY CONSUMER MAY REQUEST CURRENT STATE.
 *
 * This request cannot mutate match state.
 */
export function requestLiveMatchSnapshot(matchId) {
  if (!browserAvailable()) {
    return false
  }

  const id = normalizedMatchId(matchId)

  if (!id) {
    return false
  }

  const channel = getRequestChannel()

  if (!channel) {
    return false
  }

  try {
    channel.postMessage({
      kind: SNAPSHOT_REQUEST_KIND,

      matchId: id,

      requestedAt: Date.now(),
    })

    return true
  } catch {
    return false
  }
}

/*
 * PUBLISH ALREADY-AUTHORITATIVE STATE.
 *
 * No tennis scoring exists in this function.
 */
export function publishLiveMatchSnapshot(snapshot) {
  if (!browserAvailable() || !validSnapshot(snapshot)) {
    return false
  }

  const cloned = cloneSerializable(snapshot)

  if (!cloned) {
    return false
  }

  const payload = {
    ...cloned,

    publishedAt: nextPublishedTimestamp(),
  }

  /*
   * Always retain the latest sanitized public state in
   * this runtime, even if persistent storage fails.
   */
  cacheMemorySnapshot(payload)

  let delivered = false

  if (localStorageAvailable()) {
    try {
      window.localStorage.setItem(
        storageKey(payload.matchId),

        JSON.stringify(payload),
      )

      delivered = true
    } catch {
      // BroadcastChannel may still work.
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
   * Browser storage/BroadcastChannel events do not
   * notify another consumer in this same document.
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
 * Liveness only.
 *
 * It deliberately does NOT duplicate the score.
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

  if (localStorageAvailable()) {
    try {
      window.localStorage.setItem(
        heartbeatStorageKey(id),

        String(sentAt),
      )

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
 * READ-ONLY SUBSCRIPTION
 *
 * Connection states:
 *
 * connecting
 * fresh
 * stale
 * unavailable
 * complete
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

  const capabilities = getLiveMatchTransportCapabilities()

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

  function updateConnectionFromSignal() {
    if (matchIsTerminal()) {
      setConnectionState('complete')

      return
    }

    if (!capabilities.crossContext) {
      setConnectionState('unavailable')

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
  }

  function markSignal(timestamp = Date.now()) {
    const numericTimestamp = Number(timestamp)

    if (Number.isFinite(numericTimestamp)) {
      lastSignalAt = Math.max(lastSignalAt, numericTimestamp)
    } else {
      lastSignalAt = Date.now()
    }

    updateConnectionFromSignal()
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

  if (capabilities.broadcastChannel) {
    try {
      subscriberChannel = new window.BroadcastChannel(CHANNEL_NAME)

      subscriberChannel.onmessage = (event) => {
        /*
         * Ignore request messages.
         *
         * Subscribers are not authorities and therefore
         * never respond to snapshot requests.
         */
        if (event.data?.kind === SNAPSHOT_REQUEST_KIND) {
          return
        }

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

  const cachedHeartbeat = readLiveMatchHeartbeat(id)

  if (cachedHeartbeat) {
    lastSignalAt = cachedHeartbeat
  }

  setConnectionState(capabilities.crossContext ? 'connecting' : 'unavailable')

  if (emitCurrent) {
    accept(readLiveMatchSnapshot(id))
  }

  /*
   * If localStorage was unavailable, or if this viewer
   * simply opened after the previous score event, ask
   * the live publisher for its current sanitized state.
   */
  requestLiveMatchSnapshot(id)

  connectionTimer = window.setInterval(
    () => {
      if (matchIsTerminal()) {
        setConnectionState('complete')

        return
      }

      if (!capabilities.crossContext) {
        setConnectionState('unavailable')

        return
      }

      if (!current) {
        setConnectionState('connecting')

        return
      }

      const previousState = connectionState

      updateConnectionFromSignal()

      /*
       * One recovery request when we first cross into
       * stale state.
       *
       * This is NOT continuous score polling.
       */
      if (connectionState === 'stale' && previousState !== 'stale') {
        requestLiveMatchSnapshot(id)
      }
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
