/*
 * GORRA RESULT SHARE CARD
 *
 * Presentation/export only.
 *
 * This module:
 * - receives an already-completed result
 * - draws a shareable PNG
 * - never changes match/result state
 * - never includes internal IDs, invitation tokens,
 *   review messages or authorization data
 *
 * No third-party image dependency is required.
 */

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350

const COLORS = Object.freeze({
  background: '#f7faf7',

  white: '#ffffff',

  green: '#00b51a',

  greenStrong: '#008f15',

  darkGreen: '#073f30',

  text: '#16211b',

  secondary: '#66736b',

  muted: '#8a958e',

  softGreen: '#eef9f1',

  line: 'rgba(7, 63, 48, 0.10)',
})

function safeText(value, fallback = '') {
  return String(value ?? fallback)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function playerFromResult(result, key, fallbackName) {
  const player = result?.players?.[key]

  if (player && typeof player === 'object') {
    return {
      id: safeText(player.id),
      name: safeText(player.name, fallbackName),
    }
  }

  return {
    id: '',
    name: fallbackName,
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  const value = Math.min(radius, width / 2, height / 2)

  ctx.beginPath()

  ctx.moveTo(x + value, y)

  ctx.arcTo(x + width, y, x + width, y + height, value)

  ctx.arcTo(x + width, y + height, x, y + height, value)

  ctx.arcTo(x, y + height, x, y, value)

  ctx.arcTo(x, y, x + width, y, value)

  ctx.closePath()
}

function fillRoundedRect(ctx, x, y, width, height, radius, color) {
  ctx.save()

  roundedRect(ctx, x, y, width, height, radius)

  ctx.fillStyle = color
  ctx.fill()

  ctx.restore()
}

function drawCenteredText(ctx, value, x, y, options = {}) {
  const {
    font = '600 40px system-ui, sans-serif',

    color = COLORS.text,

    maxWidth,
  } = options

  ctx.save()

  ctx.font = font

  ctx.fillStyle = color

  ctx.textAlign = 'center'

  ctx.textBaseline = 'middle'

  if (maxWidth) {
    ctx.fillText(value, x, y, maxWidth)
  } else {
    ctx.fillText(value, x, y)
  }

  ctx.restore()
}

function initials(name = '') {
  return safeText(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function drawAvatar(ctx, name, x, y) {
  ctx.save()

  ctx.beginPath()

  ctx.arc(x, y, 62, 0, Math.PI * 2)

  ctx.fillStyle = COLORS.softGreen

  ctx.fill()

  drawCenteredText(ctx, initials(name), x, y + 2, {
    font: '600 29px system-ui, sans-serif',

    color: COLORS.darkGreen,
  })

  ctx.restore()
}

function resultScore(result) {
  return safeText(result?.score, '0–0')
}

function formatLabel(result) {
  return safeText(result?.matchFormatLabel || result?.matchFormat || 'Friendly match')
}

function scoringLabel(result) {
  return safeText(result?.scoringFormat || (result?.scoring === 'noad' ? 'No-Ad' : 'Advantage'))
}

function completedDate(result) {
  const date = new Date(result?.completedAt || '')

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })
}

function winnerForResult(result, playerA, playerB) {
  if (result?.winnerId && result.winnerId === playerB.id) {
    return playerB
  }

  return playerA
}

function drawSetScores(ctx, result) {
  const sets = Array.isArray(result?.setScores) ? result.setScores.slice(0, 5) : []

  if (!sets.length) {
    return
  }

  const startX = 145

  const availableWidth = CARD_WIDTH - 290

  const gap = 14

  const width = Math.min(150, (availableWidth - gap * (sets.length - 1)) / sets.length)

  const totalWidth = width * sets.length + gap * (sets.length - 1)

  let x = (CARD_WIDTH - totalWidth) / 2

  sets.forEach((set, index) => {
    fillRoundedRect(ctx, x, 939, width, 108, 22, COLORS.white)

    drawCenteredText(
      ctx,
      set?.isMatchTieBreak ? 'MATCH TB' : `SET ${index + 1}`,
      x + width / 2,
      970,
      {
        font: '600 17px system-ui, sans-serif',

        color: COLORS.muted,
      },
    )

    drawCenteredText(ctx, `${Number(set?.a || 0)}–${Number(set?.b || 0)}`, x + width / 2, 1011, {
      font: '600 29px system-ui, sans-serif',

      color: COLORS.darkGreen,
    })

    x += width + gap
  })
}

/*
 * Returns a PNG Blob.
 *
 * Blob rather than base64 keeps memory usage lower,
 * particularly on mobile devices.
 */
export async function createResultShareImage({ result, currentPlayerId = '' }) {
  if (!result || result.status !== 'completed') {
    throw new Error('A completed result is required.')
  }

  const participantIds = Array.isArray(result.participantIds) ? result.participantIds : []

  /*
   * This is a presentation boundary, not production
   * authorization.
   *
   * The result page already performs its access check.
   * This extra check prevents accidental export if this
   * helper is called from the wrong UI.
   */
  if (!currentPlayerId || !participantIds.includes(currentPlayerId)) {
    throw new Error('This result cannot be exported by this player.')
  }

  const canvas = document.createElement('canvas')

  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT

  const ctx = canvas.getContext('2d', {
    alpha: false,
  })

  if (!ctx) {
    throw new Error('Image rendering is unavailable.')
  }

  const playerA = playerFromResult(result, 'playerA', 'Player 1')

  const playerB = playerFromResult(result, 'playerB', 'Player 2')

  const winner = winnerForResult(result, playerA, playerB)

  const currentPlayerWon = result.winnerId === currentPlayerId

  /*
   * Canvas
   */
  ctx.fillStyle = COLORS.background

  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  /*
   * Very restrained Gorra accent.
   *
   * White still does most of the visual work.
   */
  ctx.fillStyle = COLORS.green

  ctx.fillRect(0, 0, CARD_WIDTH, 12)

  /*
   * Brand
   */
  ctx.font = '700 34px system-ui, sans-serif'

  ctx.fillStyle = COLORS.darkGreen

  ctx.textAlign = 'left'

  ctx.fillText('GORRA', 78, 91)

  ctx.font = '500 19px system-ui, sans-serif'

  ctx.fillStyle = COLORS.muted

  ctx.textAlign = 'right'

  ctx.fillText(completedDate(result), CARD_WIDTH - 78, 91)

  /*
   * Celebration
   */
  fillRoundedRect(ctx, 438, 161, 204, 46, 23, COLORS.softGreen)

  drawCenteredText(ctx, currentPlayerWon ? 'MATCH WON' : 'MATCH COMPLETE', CARD_WIDTH / 2, 184, {
    font: '600 18px system-ui, sans-serif',

    color: COLORS.greenStrong,
  })

  drawCenteredText(
    ctx,
    currentPlayerWon ? 'That one is yours.' : `${winner.name} takes the match.`,
    CARD_WIDTH / 2,
    285,
    {
      font: '600 61px system-ui, sans-serif',

      color: COLORS.darkGreen,

      maxWidth: 900,
    },
  )

  drawCenteredText(ctx, `${formatLabel(result)}  ·  ${scoringLabel(result)}`, CARD_WIDTH / 2, 350, {
    font: '500 22px system-ui, sans-serif',

    color: COLORS.secondary,
  })

  /*
   * Main score surface
   */
  fillRoundedRect(ctx, 75, 421, 930, 430, 34, COLORS.white)

  drawAvatar(ctx, playerA.name, 250, 579)

  drawAvatar(ctx, playerB.name, 830, 579)

  drawCenteredText(ctx, playerA.name, 250, 679, {
    font: '600 27px system-ui, sans-serif',

    color: COLORS.text,

    maxWidth: 260,
  })

  drawCenteredText(ctx, playerB.name, 830, 679, {
    font: '600 27px system-ui, sans-serif',

    color: COLORS.text,

    maxWidth: 260,
  })

  drawCenteredText(ctx, 'FINAL', CARD_WIDTH / 2, 519, {
    font: '600 17px system-ui, sans-serif',

    color: COLORS.muted,
  })

  drawCenteredText(ctx, resultScore(result), CARD_WIDTH / 2, 616, {
    font: '700 76px system-ui, sans-serif',

    color: COLORS.darkGreen,

    maxWidth: 330,
  })

  /*
   * Winner markers
   */
  if (result.winnerId === playerA.id) {
    fillRoundedRect(ctx, 186, 727, 128, 40, 20, COLORS.softGreen)

    drawCenteredText(ctx, 'WINNER', 250, 747, {
      font: '600 15px system-ui, sans-serif',

      color: COLORS.greenStrong,
    })
  }

  if (result.winnerId === playerB.id) {
    fillRoundedRect(ctx, 766, 727, 128, 40, 20, COLORS.softGreen)

    drawCenteredText(ctx, 'WINNER', 830, 747, {
      font: '600 15px system-ui, sans-serif',

      color: COLORS.greenStrong,
    })
  }

  /*
   * Sets
   */
  drawCenteredText(ctx, 'SET BY SET', CARD_WIDTH / 2, 909, {
    font: '600 17px system-ui, sans-serif',

    color: COLORS.muted,
  })

  drawSetScores(ctx, result)

  /*
   * Footer
   */
  drawCenteredText(ctx, 'Played on Gorra', CARD_WIDTH / 2, 1170, {
    font: '600 25px system-ui, sans-serif',

    color: COLORS.darkGreen,
  })

  drawCenteredText(ctx, 'Your match. Your score. Your moment.', CARD_WIDTH / 2, 1210, {
    font: '500 20px system-ui, sans-serif',

    color: COLORS.secondary,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gorra could not create the image.'))

          return
        }

        resolve(blob)
      },

      'image/png',

      1,
    )
  })
}

export function resultShareFilename(result) {
  const winner = safeText(result?.winnerName, 'match')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `gorra-${winner || 'match'}-result.png`
}

export function resultShareText(result) {
  const playerA = safeText(result?.players?.playerA?.name, 'Player 1')

  const playerB = safeText(result?.players?.playerB?.name, 'Player 2')

  const score = resultScore(result)

  const winner = safeText(result?.winnerName, 'Match winner')

  return `${winner} won on Gorra · ${playerA} vs ${playerB} · ${score}`
}
