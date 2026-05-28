let audioContext = null

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    return null
  }

  if (!audioContext) {
    audioContext = new AudioContextClass()
  }

  return audioContext
}

export async function playScoreUpdateClick() {
  const context = getAudioContext()
  if (!context) {
    return
  }

  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch {
      return
    }
  }

  const start = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const filter = context.createBiquadFilter()

  oscillator.type = 'triangle'
  oscillator.frequency.setValueAtTime(880, start)
  oscillator.frequency.exponentialRampToValueAtTime(1320, start + 0.018)

  filter.type = 'highpass'
  filter.frequency.setValueAtTime(420, start)

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065)

  oscillator.connect(filter)
  filter.connect(gain)
  gain.connect(context.destination)

  oscillator.start(start)
  oscillator.stop(start + 0.075)
}
