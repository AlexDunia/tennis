let audioContext = null
let lastMoveClickAt = -Infinity
let idleTimer = null
let resumePending = null

function suspendWhenIdle(context) {
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    idleTimer = null
    if (context.state === 'running') context.suspend().catch(() => {})
  }, 1500)
}

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext

  if (!AudioContextClass) return null

  if (!audioContext) {
    audioContext = new AudioContextClass()
  }

  return audioContext
}

async function prepareContext() {
  const context = getAudioContext()
  if (!context) return null
  window.clearTimeout(idleTimer)

  if (context.state === 'suspended') {
    try {
      if (!resumePending) {
        resumePending = context.resume().finally(() => { resumePending = null })
      }
      await resumePending
    } catch {
      return null
    }
  }

  return context.state === 'running' ? context : null
}

function connectTone(context, {
  type = 'sine',
  from = 700,
  to = 980,
  duration = 0.075,
  gainPeak = 0.08,
  highpass = 280,
} = {}) {
  const start = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(1, to),
    start + Math.max(0.01, duration * 0.45),
  )

  filter.type = 'highpass'
  filter.frequency.setValueAtTime(highpass, start)

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.001, gainPeak),
    start + 0.006,
  )
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    start + duration,
  )

  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)

  oscillator.onended = () => {
    oscillator.disconnect()
    filter.disconnect()
    gain.disconnect()
    oscillator.onended = null
  }
  oscillator.start(start)
  oscillator.stop(start + duration + 0.012)
  suspendWhenIdle(context)
}

export async function playToastPop() {
  const context = await prepareContext()
  if (!context) return

  connectTone(context, {
    type: 'sine',
    from: 620,
    to: 940,
    duration: 0.082,
    gainPeak: 0.075,
    highpass: 240,
  })
}

export async function playLadderMoveClick() {
  if (typeof window === 'undefined') return
  const requestedAt = performance.now()
  // Throttle before creating or resuming audio, rather than after that work.
  if (requestedAt - lastMoveClickAt < 100) return
  lastMoveClickAt = requestedAt

  const context = await prepareContext()
  if (!context) return
  if (performance.now() - requestedAt > 120) {
    suspendWhenIdle(context)
    return
  }

  connectTone(context, {
    type: 'triangle',
    from: 760,
    to: 1160,
    duration: 0.055,
    gainPeak: 0.09,
    highpass: 340,
  })
}

export async function playScoreUpdateClick() {
  return playLadderMoveClick()
}

export async function playNotificationSound(kind = 'toast') {
  if (kind === false || kind === 'none') return

  if (kind === 'move' || kind === 'ladder') {
    await playLadderMoveClick()
    return
  }

  await playToastPop()
}

