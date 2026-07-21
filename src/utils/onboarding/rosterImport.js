import { sanitizePlainText } from '../formSafety'

const MAX_ROSTER_FILE_BYTES = 10 * 1024 * 1024
const ALLOWED_ROSTER_FILES = Object.freeze({
  csv: new Set(['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel']),
  xls: new Set(['application/vnd.ms-excel', 'application/octet-stream']),
  xlsx: new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
  ]),
  pdf: new Set(['application/pdf']),
})

export function validateRosterImport(file) {
  if (!file) return { valid: false, message: 'Choose a roster file.' }
  const safeName = sanitizePlainText(file.name, 140)
  const extension = safeName.split('.').pop()?.toLowerCase() || ''
  const allowedTypes = ALLOWED_ROSTER_FILES[extension]

  if (!allowedTypes || (file.type && !allowedTypes.has(file.type))) {
    return { valid: false, message: 'Use a CSV, Excel, or PDF roster file.' }
  }
  if (file.size <= 0 || file.size > MAX_ROSTER_FILE_BYTES) {
    return { valid: false, message: 'Choose a file between 1 byte and 10 MB.' }
  }
  return { valid: true, safeName }
}
