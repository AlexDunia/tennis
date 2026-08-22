const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
]

function spokenNumber(value) {
  const number = Number(value || 0)

  if (Number.isInteger(number) && number >= 0 && number < NUMBER_WORDS.length) {
    return NUMBER_WORDS[number]
  }

  return String(number)
}

function pointWord(label, numericValue = 0) {
  const normalized = String(label || '').trim()

  const lookup = {
    Love: 'Love',
    0: 'Love',
    15: 'Fifteen',
    30: 'Thirty',
    40: 'Forty',
    Ad: 'Advantage',
    Advantage: 'Advantage',
  }

  if (lookup[normalized]) {
    return lookup[normalized]
  }

  if (/^\d+$/.test(normalized)) {
    return spokenNumber(Number(normalized))
  }

  return spokenNumber(numericValue)
}

function playerNameForSide(side, playerAName, playerBName) {
  return side === 'opponent' ? playerBName : playerAName
}

function completedSetPhrase(set, winnerSide) {
  if (!set) {
    return ''
  }

  const playerAScore = Number(set.a || 0)
  const playerBScore = Number(set.b || 0)

  const winnerScore = winnerSide === 'opponent' ? playerBScore : playerAScore

  const loserScore = winnerSide === 'opponent' ? playerAScore : playerBScore

  const unit = set.isMatchTieBreak ? 'points' : 'games'

  return `${spokenNumber(winnerScore)} ${unit} to ${spokenNumber(loserScore)}`
}

function tieBreakAnnouncement(state, playerAName, playerBName) {
  const playerAPoints = Number(state.pointsA || 0)

  const playerBPoints = Number(state.pointsB || 0)

  if (playerAPoints === playerBPoints) {
    if (playerAPoints === 0) {
      return 'Love all.'
    }

    return `${spokenNumber(playerAPoints)} all.`
  }

  const playerALeads = playerAPoints > playerBPoints

  const leaderScore = playerALeads ? playerAPoints : playerBPoints

  const trailingScore = playerALeads ? playerBPoints : playerAPoints

  const leaderName = playerALeads ? playerAName : playerBName

  return `${spokenNumber(leaderScore)} ${spokenNumber(trailingScore)}, ${leaderName}.`
}

function normalGameAnnouncement(state, playerAName, playerBName) {
  const { pointsA, pointsB, format, currentServer } = state

  /*
   * NO-AD
   *
   * At 40–40 the next point decides the game.
   */
  if (format === 'noad' && pointsA === 3 && pointsB === 3) {
    return 'Deciding point.'
  }

  /*
   * ADVANTAGE TENNIS
   */
  if (format === 'ad' && pointsA >= 3 && pointsB >= 3) {
    if (pointsA === pointsB) {
      return 'Deuce.'
    }

    if (Math.abs(pointsA - pointsB) === 1) {
      const advantageName = pointsA > pointsB ? playerAName : playerBName

      return `Advantage ${advantageName}.`
    }
  }

  const playerAScore = pointWord(state.playerAPoint, pointsA)

  const playerBScore = pointWord(state.playerBPoint, pointsB)

  /*
   * Equal scores are announced as:
   *
   * Fifteen all.
   * Thirty all.
   */
  if (playerAScore === playerBScore) {
    return `${playerAScore} all.`
  }

  /*
   * Traditional tennis score calls are
   * SERVER FIRST.
   *
   * This is why server state needed to exist in
   * Separation 1 before professional voice could
   * be implemented correctly.
   */
  if (currentServer === 'playerB') {
    return `${playerBScore} ${playerAScore}.`
  }

  return `${playerAScore} ${playerBScore}.`
}

/*
 * Pure presentation logic.
 *
 * This function NEVER changes tennis state.
 *
 * It only compares:
 *
 * BEFORE POINT
 *       ↓
 * AFTER POINT
 *
 * and determines what a chair-umpire-style
 * announcement should say.
 */
export function buildTennisAnnouncement({
  before,
  after,
  pointWinnerSide,
  playerAName,
  playerBName,
}) {
  if (!before || !after) {
    return ''
  }

  const pointWinnerName = playerNameForSide(pointWinnerSide, playerAName, playerBName)

  /*
   * MATCH POINT WON
   */
  if (after.over && !before.over) {
    return `Game, set and match, ${pointWinnerName}.`
  }

  /*
   * SET WON
   */
  if (after.setScoresLength > before.setScoresLength) {
    const setPhrase = completedSetPhrase(after.lastCompletedSet, pointWinnerSide)

    return setPhrase
      ? `Game and set, ${pointWinnerName}. ${setPhrase}.`
      : `Game and set, ${pointWinnerName}.`
  }

  /*
   * GAME WON
   */
  if (after.gamesA !== before.gamesA || after.gamesB !== before.gamesB) {
    return `Game, ${pointWinnerName}.`
  }

  /*
   * TIE-BREAK
   *
   * Tie-break points are announced numerically.
   */
  if (after.isTiebreak || after.isMatchTiebreak || after.standaloneTieBreak) {
    return tieBreakAnnouncement(after, playerAName, playerBName)
  }

  /*
   * ORDINARY POINT
   */
  return normalGameAnnouncement(after, playerAName, playerBName)
}

function preferredEnglishVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null
  }

  const voices = window.speechSynthesis.getVoices()

  if (!voices.length) {
    return null
  }

  /*
   * Prefer a local British English voice.
   *
   * Do not depend on a particular operating-system
   * voice name because Gorra will run across Windows,
   * macOS, iOS, Android and Smart displays.
   */
  return (
    voices.find((voice) => /^en-GB$/i.test(voice.lang) && voice.localService) ||
    voices.find((voice) => /^en-GB$/i.test(voice.lang)) ||
    voices.find((voice) => /^en-/i.test(voice.lang) && voice.localService) ||
    voices.find((voice) => /^en-/i.test(voice.lang)) ||
    null
  )
}

/*
 * CORRECTION ANNOUNCEMENT
 *
 * Undo already restored the authoritative tennis
 * state before this function is called.
 *
 * We therefore do not calculate what the corrected
 * score should be. We only speak the state that the
 * engine has already restored.
 */
export function buildTennisCorrectionAnnouncement({ state, playerAName, playerBName }) {
  if (!state) {
    return 'Correction.'
  }

  let scoreCall = ''

  if (state.isTiebreak || state.isMatchTiebreak || state.standaloneTieBreak) {
    scoreCall = tieBreakAnnouncement(state, playerAName, playerBName)
  } else {
    scoreCall = normalGameAnnouncement(state, playerAName, playerBName)
  }

  if (!scoreCall) {
    return 'Correction.'
  }

  return `Correction. ${scoreCall}`
}

export function speakTennisAnnouncement(message, options = {}) {
  const { enabled = true } = options

  if (
    !enabled ||
    !message ||
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof window.SpeechSynthesisUtterance !== 'function'
  ) {
    return false
  }

  const synthesis = window.speechSynthesis

  /*
   * Never let old score calls form a queue.
   *
   * If scoring moves quickly, the latest state
   * is the only state worth announcing.
   */
  synthesis.cancel()

  const utterance = new window.SpeechSynthesisUtterance(message)

  utterance.lang = 'en-GB'

  /*
   * Slightly slower and calmer than generic
   * text-to-speech.
   */
  utterance.rate = 0.9
  utterance.pitch = 1
  utterance.volume = 1

  const voice = preferredEnglishVoice()

  if (voice) {
    utterance.voice = voice
  }

  synthesis.speak(utterance)

  return true
}

export function cancelTennisAnnouncements() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
