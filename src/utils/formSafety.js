const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function removeUnsafeControlCharacters(value) {
  return String(value ?? '').replace(CONTROL_CHARACTERS, '')
}

export function sanitizePlainText(value, maxLength = 200) {
  return removeUnsafeControlCharacters(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeSlugList(values = [], maxItems = 12) {
  return [...new Set(values)]
    .map((value) =>
      sanitizePlainText(value, 40)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    )
    .filter(Boolean)
    .slice(0, maxItems)
}

export function isSafeHttpUrl(value) {
  try {
    const url = new URL(String(value))
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function isSafeImageSource(value, maxDataUrlLength = 2_100_000) {
  const source = String(value || '')
  return (
    isSafeHttpUrl(source) ||
    (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(source) && source.length <= maxDataUrlLength)
  )
}

export function hardenFormSubmissions(root = document) {
  root.addEventListener(
    'submit',
    (event) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement)) return

      form.querySelectorAll('input, textarea').forEach((field) => {
        if (field instanceof HTMLInputElement && ['password', 'file', 'hidden'].includes(field.type)) {
          return
        }
        const safeValue = removeUnsafeControlCharacters(field.value)
        if (safeValue !== field.value) {
          field.value = safeValue
          field.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })

      if (!form.checkValidity()) {
        event.preventDefault()
        form.reportValidity()
      }
    },
    true,
  )
}
