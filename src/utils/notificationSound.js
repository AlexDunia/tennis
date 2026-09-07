let audioContext = null
let lastMoveClickAt = -Infinity

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

  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch {
      return null
    }
  }

  return context
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

  oscillator.start(start)
  oscillator.stop(start + duration + 0.012)
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
  const context = await prepareContext()
  if (!context) return

  // Avoid overlapping click sounds from rapid input or the same action's toast.
  if (context.currentTime - lastMoveClickAt < 0.08) return
  lastMoveClickAt = context.currentTime

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

