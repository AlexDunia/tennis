import {
  isLiveOperationsSnapshot,
  LIVE_OPERATIONS_MATCH_KIND,
} from '../utils/liveOperationsSnapshot'

import {
  getLiveMatchTransportCapabilities,
  LIVE_SCOREBOARD_STALE_AFTER_MS,
  readLiveMatchHeartbeat,
} from './liveMatchRealtime'

const STORAGE_PREFIX = 'gorra.liveOperations.v1.'

const CHANNEL_NAME = 'gorra.liveOperations.v1'

const LOCAL_EVENT_NAME = 'gorra:live-operations-change'

const STORAGE_PROBE_KEY = 'gorra.liveOperationsStorageProbe'

const MAX_OPERATIONS_MATCHES = 64

const TERMINAL_RETENTION_MS = 15 * 60 * 1000

const LIVENESS_CHECK_INTERVAL_MS = 4000

/*
 * A court does not become "abandoned" merely because
 * one heartbeat was missed.
 *
 * Scoreboard stale detection happens much earlier.
 *
 * This longer delay is only for allowing an operator
 * to remove an obviously dead Operations listing.
 */
export const LIVE_OPERATIONS_ABANDONED_AFTER_MS =
  90 * 1000

const LOCAL_REMOVE_EVENT_NAME =
  'gorra:live-operations-remove'

let storageCapability = null

let storageHydrated = false

let publisherChannel = null

let lastPublishedAt = 0

const memoryRecords = new Map()

function browserAvailable() {
  return typeof window !== 'undefined'
}

function normalizedMatchId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function normalizedClubId(value) {
  return String(value || '')
    .trim()
    .slice(0, 120)
}

function storageKey(matchId) {
  return STORAGE_PREFIX + encodeURIComponent(normalizedMatchId(matchId))
}

function storageAvailable() {
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

function cloneSerializable(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function nextPublishedTimestamp() {
  const now = Date.now()

  lastPublishedAt = Math.max(now, lastPublishedAt + 1)

  return lastPublishedAt
}

function isTerminal(record) {
  return ['finished', 'completed'].includes(record?.status)
}

function terminalExpired(record, now = Date.now()) {
  if (!isTerminal(record)) {
    return false
  }

  return now - Number(record.publishedAt || 0) > TERMINAL_RETENTION_MS
}

/*
 * Score revision always wins first.
 *
 * A stale tab must never regress the
 * visible operations score merely because
 * it published something later.
 */
export function isLiveOperationsSnapshotNewer(incoming, current) {
  if (!current) {
    return true
  }

  const incomingScore = Number(incoming?.revision || 0)

  const currentScore = Number(current?.revision || 0)

  if (incomingScore > currentScore) {
    return true
  }

  if (incomingScore < currentScore) {
    return false
  }

  const incomingAuthority = Number(incoming?.authorityRevision || 0)

  const currentAuthority = Number(current?.authorityRevision || 0)

  if (incomingAuthority > currentAuthority) {
    return true
  }

  if (incomingAuthority < currentAuthority) {
    return false
  }

  return Number(incoming?.publishedAt || 0) > Number(current?.publishedAt || 0)
}

function removeStoredRecord(matchId) {
  if (!storageAvailable()) {
    return
  }

  try {
    window.localStorage.removeItem(storageKey(matchId))
  } catch {
    // no-op
  }
}

function pruneMemoryRecords() {
  const now = Date.now()

  const removable = []

  for (const [matchId, record] of memoryRecords) {
    if (terminalExpired(record, now)) {
      removable.push(matchId)
    }
  }

  removable.forEach((matchId) => {
    memoryRecords.delete(matchId)

    removeStoredRecord(matchId)
  })

  if (memoryRecords.size <= MAX_OPERATIONS_MATCHES) {
    return
  }

  const ordered = [...memoryRecords.values()].sort(
    (a, b) => Number(a.publishedAt || 0) - Number(b.publishedAt || 0),
  )

  const overflow = ordered.slice(0, memoryRecords.size - MAX_OPERATIONS_MATCHES)

  overflow.forEach((record) => {
    memoryRecords.delete(record.matchId)

    removeStoredRecord(record.matchId)
  })
}

function cacheRecord(record) {
  if (!isLiveOperationsSnapshot(record)) {
    return false
  }

  if (terminalExpired(record)) {
    return false
  }

  const matchId = normalizedMatchId(record.matchId)

  const current = memoryRecords.get(matchId)

  if (!isLiveOperationsSnapshotNewer(record, current)) {
    return false
  }

  const cloned = cloneSerializable(record)

  if (!cloned) {
    return false
  }

  memoryRecords.set(matchId, cloned)

  pruneMemoryRecords()

  return true
}

function parseRecord(raw) {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)

    return isLiveOperationsSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

/*
 * Initial recovery only.
 *
 * After hydration, storage/BroadcastChannel
 * events update memory incrementally.
 *
 * We do NOT rescan every localStorage key
 * every few seconds.
 */
function hydrateStoredRecords() {
  if (storageHydrated || !storageAvailable()) {
    return
  }

  storageHydrated = true

  const staleKeys = []

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)

      if (!key?.startsWith(STORAGE_PREFIX)) {
        continue
      }

      const record = parseRecord(window.localStorage.getItem(key))

      if (!record || terminalExpired(record)) {
        staleKeys.push(key)

        continue
      }

      cacheRecord(record)
    }

    staleKeys.forEach((key) => {
      window.localStorage.removeItem(key)
    })
  } catch {
    // Memory + BroadcastChannel may still work.
  }
}

function persistRecord(record) {
  if (!storageAvailable()) {
    return false
  }

  try {
    const key = storageKey(record.matchId)

    const serialized = JSON.stringify(record)

    if (window.localStorage.getItem(key) === serialized) {
      return true
    }

    window.localStorage.setItem(key, serialized)

    return true
  } catch {
    return false
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

function dispatchLocalChange(record) {
  try {
    window.dispatchEvent(
      new CustomEvent(LOCAL_EVENT_NAME, {
        detail: record,
      }),
    )
  } catch {
    // no-op
  }
}

/*
 * Publish an already-derived operational
 * projection.
 *
 * No scoring happens here.
 */
export function publishLiveOperationsSnapshot(snapshot) {
  if (!browserAvailable() || !isLiveOperationsSnapshot(snapshot)) {
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

  cacheRecord(payload)

  let delivered = false

  if (persistRecord(payload)) {
    delivered = true
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

  dispatchLocalChange(payload)

  return delivered
}

function operationConnection(record, now = Date.now()) {
  if (isTerminal(record)) {
    return {
      state: 'complete',

      lastSignalAt: Number(record.publishedAt || 0),

      ageMs: 0,
    }
  }

  const capabilities = getLiveMatchTransportCapabilities()

  const heartbeat = readLiveMatchHeartbeat(record.matchId)

  const updatedTime = Date.parse(record.updatedAt || '')

  const lastSignalAt = Math.max(
    Number(heartbeat || 0),

    Number(record.publishedAt || 0),

    Number.isFinite(updatedTime) ? updatedTime : 0,
  )

  if (!capabilities.crossContext) {
    return {
      state: 'unavailable',

      lastSignalAt,

      ageMs: lastSignalAt ? Math.max(0, now - lastSignalAt) : 0,
    }
  }

  /*
   * BroadcastChannel without writable
   * localStorage can still update scores,
   * but today's heartbeat recovery is
   * storage-backed.
   */
  if (!capabilities.localStorage) {
    return {
      state: 'unknown',

      lastSignalAt,

      ageMs: lastSignalAt ? Math.max(0, now - lastSignalAt) : 0,
    }
  }

  if (!lastSignalAt) {
    return {
      state: 'connecting',

      lastSignalAt: 0,

      ageMs: 0,
    }
  }

  const ageMs = Math.max(0, now - lastSignalAt)

  return {
    state: ageMs > LIVE_SCOREBOARD_STALE_AFTER_MS ? 'stale' : 'fresh',

    lastSignalAt,

    ageMs,
  }
}

function decorateRecord(record, now = Date.now()) {
  return {
    ...cloneSerializable(record),

    connection: operationConnection(record, now),
  }
}

export function readLiveOperationsRegistry({ clubId, includeTerminal = false } = {}) {
  const requestedClubId = normalizedClubId(clubId)

  /*
   * Fail closed.
   *
   * Operations are never returned without
   * a club boundary.
   */
  if (!requestedClubId) {
    return []
  }

  hydrateStoredRecords()

  pruneMemoryRecords()

  const now = Date.now()

  return [...memoryRecords.values()]
    .filter(
      (record) =>
        record.clubId === requestedClubId && (includeTerminal || record.status === 'live'),
    )
    .sort((a, b) => Number(b.publishedAt || 0) - Number(a.publishedAt || 0))
    .map((record) => decorateRecord(record, now))
}

export function readLiveOperation(matchId, clubId) {
  const id = normalizedMatchId(matchId)

  if (!id) {
    return null
  }

  return (
    readLiveOperationsRegistry({
      clubId,

      includeTerminal: true,
    }).find((record) => record.matchId === id) || null
  )
}

export function dismissAbandonedLiveOperation({
  matchId,
  clubId,
} = {}) {
  const id =
    normalizedMatchId(
      matchId,
    )

  const requestedClubId =
    normalizedClubId(
      clubId,
    )

  if (
    !id ||
    !requestedClubId
  ) {
    return false
  }

  hydrateStoredRecords()

  const record =
    memoryRecords.get(id) ||
    parseRecord(
      storageAvailable()
        ? window.localStorage.getItem(
            storageKey(id),
          )
        : null,
    )

  if (
    !record ||
    record.clubId !==
      requestedClubId ||
    record.status !== 'live'
  ) {
    return false
  }

  const connection =
    operationConnection(
      record,
    )

  /*
   * Never dismiss a healthy court.
   */
  if (
    ![
      'stale',
      'unavailable',
    ].includes(
      connection.state,
    )
  ) {
    return false
  }

  /*
   * Give temporary network/browser interruptions
   * plenty of time to recover automatically.
   */
  if (
    Number(
      connection.ageMs || 0,
    ) <
    LIVE_OPERATIONS_ABANDONED_AFTER_MS
  ) {
    return false
  }

  memoryRecords.delete(id)

  removeStoredRecord(id)

  /*
   * localStorage removal notifies OTHER tabs.
   * This event updates subscribers in this tab.
   */
  try {
    window.dispatchEvent(
      new CustomEvent(
        LOCAL_REMOVE_EVENT_NAME,
        {
          detail: {
            matchId: id,

            clubId:
              requestedClubId,
          },
        },
      ),
    )
  } catch {
    // Removal still succeeded locally.
  }

  return true
}

function registryEmissionFingerprint(
  records,
) {
  /*
   * Deliberately exclude:
   *
   * connection.ageMs
   *
   * Age naturally increases every second but does not
   * mean the Operations card has meaningfully changed.
   *
   * We care about transitions such as:
   *
   * fresh → stale
   * scorer A → scorer B
   * score revision 12 → 13
   * live → completed
   */
  return JSON.stringify(
    records.map(
      (record) => [
        record.matchId,

        record.status,

        Number(
          record.revision || 0,
        ),

        Number(
          record.authorityRevision ||
            0,
        ),

        record.scorerId || '',

        record.scorerName || '',

        record.server || '',

        Number(
          record.score?.points?.a ||
            0,
        ),

        String(
          record.score?.points?.a ||
            '',
        ),

        String(
          record.score?.points?.b ||
            '',
        ),

        Number(
          record.score?.games?.a ||
            0,
        ),

        Number(
          record.score?.games?.b ||
            0,
        ),

        Number(
          record.score?.sets?.a ||
            0,
        ),

        Number(
          record.score?.sets?.b ||
            0,
        ),

        record.connection?.state ||
          '',

        record.court || '',
      ],
    ),
  )
}

export function subscribeToLiveOperationsRegistry(
  onChange,
  {
    clubId,
    includeTerminal = false,
  } = {},
) {
  if (
    !browserAvailable() ||
    typeof onChange !==
      'function'
  ) {
    return () => {}
  }

  const requestedClubId =
    normalizedClubId(
      clubId,
    )

  if (!requestedClubId) {
    return () => {}
  }

  let subscriberChannel =
    null

  let timer =
    null

  let lastFingerprint =
    ''

  function emit({
    force = false,
  } = {}) {
    const records =
      readLiveOperationsRegistry({
        clubId:
          requestedClubId,

        includeTerminal,
      })

    const fingerprint =
      registryEmissionFingerprint(
        records,
      )

    /*
     * Liveness is checked repeatedly, but Vue only
     * receives another array when something the
     * interface actually cares about changed.
     */
    if (
      !force &&
      fingerprint ===
        lastFingerprint
    ) {
      return
    }

    lastFingerprint =
      fingerprint

    onChange(records)
  }

  function acceptRecord(
    record,
  ) {
    if (
      cacheRecord(record)
    ) {
      emit()
    }
  }

  function handleStorage(
    event,
  ) {
    if (
      !event.key?.startsWith(
        STORAGE_PREFIX,
      )
    ) {
      return
    }

    if (!event.newValue) {
      const encodedId =
        event.key.slice(
          STORAGE_PREFIX.length,
        )

      try {
        memoryRecords.delete(
          decodeURIComponent(
            encodedId,
          ),
        )
      } catch {
        // malformed storage key
      }

      emit()

      return
    }

    acceptRecord(
      parseRecord(
        event.newValue,
      ),
    )
  }

  function handleLocal(
    event,
  ) {
    acceptRecord(
      event.detail,
    )
  }

  function handleLocalRemove(
    event,
  ) {
    const removedMatchId =
      normalizedMatchId(
        event.detail?.matchId,
      )

    const removedClubId =
      normalizedClubId(
        event.detail?.clubId,
      )

    if (
      !removedMatchId ||
      removedClubId !==
        requestedClubId
    ) {
      return
    }

    memoryRecords.delete(
      removedMatchId,
    )

    emit()
  }

  function handleVisibilityChange() {
    /*
     * There is no value continuously rebuilding an
     * Operations list while this browser tab is hidden.
     *
     * As soon as it becomes visible again, perform one
     * immediate recovery pass.
     */
    if (
      document.visibilityState ===
      'visible'
    ) {
      emit({
        force: true,
      })
    }
  }

  window.addEventListener(
    'storage',
    handleStorage,
  )

  window.addEventListener(
    LOCAL_EVENT_NAME,
    handleLocal,
  )

  window.addEventListener(
    LOCAL_REMOVE_EVENT_NAME,
    handleLocalRemove,
  )

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange,
  )

  if (
    'BroadcastChannel' in window
  ) {
    try {
      subscriberChannel =
        new window.BroadcastChannel(
          CHANNEL_NAME,
        )

      subscriberChannel.onmessage =
        (event) => {
          if (
            event.data?.kind ===
            LIVE_OPERATIONS_MATCH_KIND
          ) {
            acceptRecord(
              event.data,
            )
          }
        }
    } catch {
      subscriberChannel = null
    }
  }

  /*
   * One liveness timer for the entire club.
   *
   * It does not poll tennis scores.
   *
   * It merely allows:
   *
   * fresh → stale
   *
   * to happen even if no further score event arrives.
   */
  timer =
    window.setInterval(
      () => {
        if (
          document.visibilityState ===
          'hidden'
        ) {
          return
        }

        emit()
      },

      LIVENESS_CHECK_INTERVAL_MS,
    )

  emit({
    force: true,
  })

  return () => {
    window.removeEventListener(
      'storage',
      handleStorage,
    )

    window.removeEventListener(
      LOCAL_EVENT_NAME,
      handleLocal,
    )

    window.removeEventListener(
      LOCAL_REMOVE_EVENT_NAME,
      handleLocalRemove,
    )

    document.removeEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    if (timer) {
      window.clearInterval(
        timer,
      )
    }

    if (subscriberChannel) {
      subscriberChannel.close()
    }
  }
}
