import { sanitizePlainText } from '../formSafety.js'

const MAX_CSV_TEXT_LENGTH = 2 * 1024 * 1024
const MAX_IMPORTED_MEMBERS = 500
const VALID_ROLES = new Set(['admin', 'co-admin', 'player'])

function parseRows(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
      if (rows.length > MAX_IMPORTED_MEMBERS + 1) break
    } else {
      field += character
    }
  }

  if (field || row.length) {
    row.push(field)
    if (row.some((value) => value.trim())) rows.push(row)
  }
  return rows
}

function headerKey(value) {
  return sanitizePlainText(value, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function columnIndex(headers, names) {
  return headers.findIndex((header) => names.includes(header))
}

export function parseRosterCsv(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { valid: false, message: 'This CSV file is empty.', members: [] }
  }
  if (text.length > MAX_CSV_TEXT_LENGTH) {
    return { valid: false, message: 'Use a CSV file smaller than 2 MB.', members: [] }
  }

  const rows = parseRows(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) {
    return { valid: false, message: 'Add a header row and at least one member.', members: [] }
  }

  const headers = rows[0].map(headerKey)
  const nameIndex = columnIndex(headers, ['name', 'fullname', 'membername'])
  const emailIndex = columnIndex(headers, ['email', 'emailaddress'])
  const phoneIndex = columnIndex(headers, ['phone', 'phonenumber', 'mobile'])
  const roleIndex = columnIndex(headers, ['role', 'clubrole'])

  if (nameIndex < 0 && emailIndex < 0 && phoneIndex < 0) {
    return {
      valid: false,
      message: 'Use a name, email, or phone column in the first row.',
      members: [],
    }
  }

  const seen = new Set()
  const members = rows.slice(1, MAX_IMPORTED_MEMBERS + 1).flatMap((row, index) => {
    const name = nameIndex >= 0 ? sanitizePlainText(row[nameIndex], 100) : ''
    const rawEmail = emailIndex >= 0 ? sanitizePlainText(row[emailIndex], 254).toLowerCase() : ''
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : ''
    const rawPhone = phoneIndex >= 0 ? sanitizePlainText(row[phoneIndex], 30) : ''
    const phone = /^\+?[0-9()\-\s]{7,30}$/.test(rawPhone) ? rawPhone : ''
    if (!name && !email && !phone) return []

    const key = email || phone || name.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)

    const rawRole = roleIndex >= 0 ? headerKey(row[roleIndex]).replace('coadmin', 'co-admin') : ''
    const role = VALID_ROLES.has(rawRole) ? rawRole : 'player'
    return [
      {
        id: `csv-member-${index + 1}`,
        userId: '',
        name,
        contact: email || phone,
        email,
        phone,
        role,
        source: 'import',
        status: 'invited',
      },
    ]
  })

  if (!members.length) {
    return { valid: false, message: 'We could not find any usable members.', members: [] }
  }
  return { valid: true, members }
}
