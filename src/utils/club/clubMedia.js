export const CLUB_COVER_PRESETS = Object.freeze([
  {
    id: 'court-green',
    label: 'Court green',
    background: 'linear-gradient(135deg, #0f6f39 0%, #158447 46%, #b9d8ad 100%)',
  },
  {
    id: 'forest',
    label: 'Forest',
    background: 'linear-gradient(135deg, #183c2a 0%, #285942 52%, #8caf93 100%)',
  },
  {
    id: 'warm-sand',
    label: 'Warm sand',
    background: 'linear-gradient(135deg, #d8d0b7 0%, #ece6d4 52%, #9db99f 100%)',
  },
  {
    id: 'charcoal-court',
    label: 'Charcoal court',
    background: 'linear-gradient(135deg, #29332d 0%, #46554b 56%, #9db4a2 100%)',
  },
])

export const DEFAULT_CLUB_COVER_PRESET = 'court-green'

export function clubCoverPreset(id) {
  return CLUB_COVER_PRESETS.find((preset) => preset.id === id) || CLUB_COVER_PRESETS[0]
}

export function clubCoverStyle(id) {
  return { background: clubCoverPreset(id).background }
}

export function validateClubImageFile(file) {
  if (!file) throw new Error('Choose an image first.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP image.')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 8 MB.')
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ image, url })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('We could not read that image.'))
    }
    image.src = url
  })
}

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('We could not prepare that image.'))
          return
        }
        resolve(blob)
      },
      'image/webp',
      quality,
    )
  })
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('We could not prepare that image.'))
    reader.readAsDataURL(blob)
  })
}

export async function cropClubImage(
  file,
  { kind = 'cover', focalX = 0.5, focalY = 0.5 } = {},
) {
  validateClubImageFile(file)

  const target =
    kind === 'logo'
      ? { width: 360, height: 360, maxDataLength: 420_000 }
      : { width: 1440, height: 450, maxDataLength: 900_000 }

  const { image, url } = await loadImage(file)

  try {
    const imageWidth = image.naturalWidth
    const imageHeight = image.naturalHeight
    if (!imageWidth || !imageHeight) throw new Error('That image has no usable dimensions.')

    const targetRatio = target.width / target.height
    const imageRatio = imageWidth / imageHeight

    let sourceWidth
    let sourceHeight

    if (imageRatio > targetRatio) {
      sourceHeight = imageHeight
      sourceWidth = sourceHeight * targetRatio
    } else {
      sourceWidth = imageWidth
      sourceHeight = sourceWidth / targetRatio
    }

    const centerX = clamp(Number(focalX) || 0.5, 0, 1) * imageWidth
    const centerY = clamp(Number(focalY) || 0.5, 0, 1) * imageHeight

    const sourceX = clamp(centerX - sourceWidth / 2, 0, Math.max(0, imageWidth - sourceWidth))
    const sourceY = clamp(centerY - sourceHeight / 2, 0, Math.max(0, imageHeight - sourceHeight))

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height

    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Image processing is unavailable in this browser.')

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      target.width,
      target.height,
    )

    for (const quality of [0.82, 0.74, 0.66]) {
      const blob = await canvasBlob(canvas, quality)
      const output = await blobToDataUrl(blob)
      if (output.length <= target.maxDataLength) return output
    }

    throw new Error(
      kind === 'logo'
        ? 'That logo is still too large after processing. Try a simpler image.'
        : 'That cover is still too large after processing. Try another image.',
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

