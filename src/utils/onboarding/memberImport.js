import { sanitizePlainText } from '../formSafety.js'

export const MEMBER_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const MEMBER_IMPORT_MAX_ROWS = 5000
export const MEMBER_IMPORT_MAX_COLUMNS = 60
export const MEMBER_IMPORT_HEADER_SCAN_ROWS = 25

export const MEMBER_IMPORT_SCENARIOS = Object.freeze({
  'members-only': Object.freeze({
    id: 'members-only',
    title: 'Members only',
    pageTitle: 'Import members',
    copy: 'Just your club member list.',
    required: Object.freeze([
      ['firstName', 'First Name'],
      ['lastName', 'Last Name'],
      ['email', 'Email'],
      ['yearOfEntry', 'Year of Entry'],
    ]),
    optional: Object.freeze([
      ['phone', 'Phone'],
      ['gender', 'Gender'],
      ['dob', 'Date of Birth'],
      ['level', 'Playing Level'],
      ['rating', 'Rating'],
      ['memberNumber', 'Member / Reference Number'],
    ]),
  }),
  'one-ladder': Object.freeze({
    id: 'one-ladder',
    title: 'Members + one ladder',
    pageTitle: 'Import one ladder',
    copy: 'One ladder with its current positions.',
    required: Object.freeze([
      ['firstName', 'First Name'],
      ['lastName', 'Last Name'],
      ['email', 'Email'],
      ['position', 'Position'],
      ['yearOfEntry', 'Year of Entry'],
    ]),
    optional: Object.freeze([
      ['phone', 'Phone'],
      ['gender', 'Gender'],
      ['dob', 'Date of Birth'],
      ['level', 'Playing Level'],
      ['rating', 'Rating'],
      ['memberNumber', 'Member / Reference Number'],
    ]),
  }),
  'multiple-ladders': Object.freeze({
    id: 'multiple-ladders',
    title: 'Members + multiple ladders',
    pageTitle: 'Import multiple ladders',
    copy: 'Several ladders in the same file.',
    required: Object.freeze([
      ['firstName', 'First Name'],
      ['lastName', 'Last Name'],
      ['email', 'Email'],
      ['ladder', 'Ladder'],
      ['position', 'Position'],
      ['yearOfEntry', 'Year of Entry'],
    ]),
    optional: Object.freeze([
      ['phone', 'Phone'],
      ['gender', 'Gender'],
      ['dob', 'Date of Birth'],
      ['level', 'Playing Level'],
      ['rating', 'Rating'],
      ['memberNumber', 'Member / Reference Number'],
    ]),
  }),
})

export const MEMBER_IMPORT_FIELD_OPTIONS = Object.freeze([
  ['', 'Do not import'],
  ['fullName', 'Full Name'],
  ['firstName', 'First Name'],
  ['lastName', 'Last Name'],
  ['email', 'Email'],
  ['yearOfEntry', 'Year of Entry'],
  ['phone', 'Phone'],
  ['gender', 'Gender'],
  ['dob', 'Date of Birth'],
  ['level', 'Playing Level'],
  ['rating', 'Rating'],
  ['memberNumber', 'Member / Reference Number'],
  ['ladder', 'Ladder'],
  ['position', 'Position'],
])

const FIELD_LABELS = Object.freeze(
  Object.fromEntries(MEMBER_IMPORT_FIELD_OPTIONS.filter(([key]) => key)),
)

const IMPORT_ALIASES = Object.freeze({
  firstname: 'firstName',
  first: 'firstName',
  givenname: 'firstName',
  given: 'firstName',
  lastname: 'lastName',
  surname: 'lastName',
  familyname: 'lastName',
  playersurname: 'lastName',
  fullname: 'fullName',
  membername: 'fullName',
  playername: 'fullName',
  playermember: 'fullName',
  email: 'email',
  emailaddress: 'email',
  primaryemail: 'email',
  mail: 'email',
  emailish: 'email',
  yearofentry: 'yearOfEntry',
  entryyear: 'yearOfEntry',
  yearjoined: 'yearOfEntry',
  joinedyear: 'yearOfEntry',
  membershipyear: 'yearOfEntry',
  phone: 'phone',
  phonenumber: 'phone',
  mobile: 'phone',
  mobilenumber: 'phone',
  cell: 'phone',
  whatsapp: 'phone',
  whatsappno: 'phone',
  whatsappnumber: 'phone',
  gender: 'gender',
  sex: 'gender',
  mf: 'gender',
  gendersex: 'gender',
  dateofbirth: 'dob',
  dob: 'dob',
  birthdate: 'dob',
  birthday: 'dob',
  dobish: 'dob',
  playinglevel: 'level',
  level: 'level',
  skill: 'level',
  skilllevel: 'level',
  playergrade: 'level',
  howgoodareyou: 'level',
  rating: 'rating',
  playerrating: 'rating',
  membernumber: 'memberNumber',
  memberid: 'memberNumber',
  memberref: 'memberNumber',
  referencenumber: 'memberNumber',
  referenceno: 'memberNumber',
  refnumber: 'memberNumber',
  refno: 'memberNumber',
  oldid: 'memberNumber',
  legacyref: 'memberNumber',
  oldmemberref: 'memberNumber',
  ladder: 'ladder',
  laddername: 'ladder',
  whichladder: 'ladder',
  position: 'position',
  rank: 'position',
  ranking: 'position',
  ladderposition: 'position',
  standingnow: 'position',
  currentspot: 'position',
})

function scenarioConfig(scenario) {
  return MEMBER_IMPORT_SCENARIOS[scenario] || MEMBER_IMPORT_SCENARIOS['members-only']
}

function normaliseHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function addFix(fixes, text) {
  if (text && !fixes.includes(text)) fixes.push(text)
}

function cleanCell(value, fixes = []) {
  let output = String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()

  if (output.length > 500) {
    output = output.slice(0, 500)
    addFix(fixes, 'Trimmed very long cells')
  }

  // Keep spreadsheet content inert if it is exported later.
  if (
    /^[=@]/.test(output) ||
    (/^[+-]/.test(output) && !/^[+-]\d(?:[\d\s().-]*\d)?$/.test(output))
  ) {
    output = `'${output}`
    addFix(fixes, 'Blocked spreadsheet formulas')
  }

  return output
}

function headerFieldFor(header, headers = []) {
  const key = normaliseHeader(header)

  if (key === 'member' || key === 'player') {
    const hasSurname = headers.some((item) =>
      ['surname', 'lastname', 'familyname', 'playersurname'].includes(normaliseHeader(item)),
    )
    return hasSurname ? 'firstName' : 'fullName'
  }

  if (
    ['contact', 'contactlabel', 'person', 'personname', 'athlete', 'athletename', 'customer', 'client'].includes(
      key,
    )
  ) {
    return 'fullName'
  }

  return IMPORT_ALIASES[key] || ''
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || '').trim())
}

function phoneLike(value) {
  const raw = String(value || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(raw)) return false
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(raw)) return false
  return digits.length >= 7 && digits.length <= 16 && /^[+\d\s().-]+$/.test(raw)
}

function genderLike(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
  return ['m', 'male', 'man', 'f', 'female', 'woman', 'notspecified', 'prefernottosay'].includes(key)
}

function dateLike(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(raw)) return true
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(raw)) return true
  return /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(raw)
}

function levelLike(value) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
  return (
    [
      'beginner',
      'new',
      'newtotennis',
      'recreational',
      'social',
      'intermediate',
      'club',
      'clubplayer',
      'advanced',
      'competitive',
      'pro',
      'professional',
      'a',
      'b',
      'c',
      'd',
    ].includes(key) || /^[1-5](?:\.\d)?$/.test(key)
  )
}

function positionLike(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  const match = raw.match(/\d+/)
  if (!match) return false
  const number = Number(match[0])
  return (
    Number.isInteger(number) &&
    number > 0 &&
    number <= 10000 &&
    /^\s*(?:#|no\.?\s*)?\d+(?:st|nd|rd|th)?\s*$/i.test(raw)
  )
}

function nameLike(value) {
  const raw = String(value || '')
    .trim()
    .replace(/,/g, ' ')
  if (!raw || raw.length > 80 || /\d{3,}/.test(raw)) return false
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length < 2 || parts.length > 5) return false
  return parts.every((part) => /^[A-Za-zÀ-ÖØ-öø-ÿ.'’-]{2,}$/.test(part))
}

function valueList(rows, index, limit = 40) {
  return (rows || [])
    .slice(0, limit)
    .map((row) => String(row?.[index] ?? '').trim())
    .filter(Boolean)
}

function ratio(values, test) {
  return values.length ? values.filter(test).length / values.length : 0
}

function columnProfile(rows, index) {
  const values = valueList(rows, index)
  return {
    count: values.length,
    email: ratio(values, validEmail),
    phone: ratio(values, phoneLike),
    gender: ratio(values, genderLike),
    dob: ratio(values, dateLike),
    level: ratio(values, levelLike),
    position: ratio(values, positionLike),
    fullName: ratio(values, nameLike),
  }
}

function supportPersonSignals(profiles) {
  return profiles.some(
    (profile) =>
      profile.email >= 0.5 ||
      profile.phone >= 0.55 ||
      profile.gender >= 0.55 ||
      profile.level >= 0.55,
  )
}

function inferFieldFromProfile(header, profile, hasPersonSupport, scenario) {
  const key = normaliseHeader(header)
  if (profile.email >= 0.65) return { field: 'email', score: 0.98 }
  if (profile.phone >= 0.7) return { field: 'phone', score: 0.91 }
  if (profile.gender >= 0.7) return { field: 'gender', score: 0.95 }
  if (profile.dob >= 0.7) return { field: 'dob', score: 0.91 }
  if (profile.level >= 0.65) return { field: 'level', score: 0.82 }
  if (
    (scenario !== 'members-only' || /(rank|spot|position|standing)/.test(key)) &&
    profile.position >= 0.8
  ) {
    return { field: 'position', score: 0.83 }
  }
  if (hasPersonSupport && profile.fullName >= 0.7) return { field: 'fullName', score: 0.8 }
  return { field: '', score: 0 }
}

function analyseHeadersAndValues(headers, rows, scenario) {
  const profiles = headers.map((_, index) => columnProfile(rows, index))
  const personSupport = supportPersonSignals(profiles)
  const directFields = new Set(headers.map((header) => headerFieldFor(header, headers)).filter(Boolean))
  const hasSplitIdentity = directFields.has('firstName') && directFields.has('lastName')

  const suggestions = headers.map((header, index) => {
    const direct = headerFieldFor(header, headers)
    if (direct) return { index, field: direct, source: 'header', score: 1 }

    const inferred = inferFieldFromProfile(header, profiles[index], personSupport, scenario)
    if (hasSplitIdentity && inferred.field === 'fullName') {
      return { index, field: '', source: 'none', score: 0 }
    }
    return {
      index,
      field: inferred.field,
      source: inferred.field ? 'values' : 'none',
      score: inferred.score,
    }
  })

  const bestForField = new Map()
  suggestions
    .filter((suggestion) => suggestion.field)
    .forEach((suggestion) => {
      const current = bestForField.get(suggestion.field)
      if (!current || suggestion.score > current.score) {
        bestForField.set(suggestion.field, suggestion)
      }
    })

  const mappings = {}
  const sources = {}

  suggestions.forEach((suggestion) => {
    const best = suggestion.field ? bestForField.get(suggestion.field) : null
    const accepted = best && best.index === suggestion.index
    mappings[suggestion.index] = accepted ? suggestion.field : ''
    sources[suggestion.index] = accepted ? suggestion.source : 'none'
  })

  return { profiles, mappings, sources }
}

function scoreHeaderRow(row, scenario) {
  const cells = (row || []).map((value) => String(value || '').trim()).filter(Boolean)
  if (cells.length < 2) return 0

  const unique = new Set(cells.map(normaliseHeader)).size
  let known = 0
  cells.forEach((cell) => {
    if (headerFieldFor(cell, row)) known += 1
  })

  const dataLike = cells.filter((cell) => {
    const raw = String(cell || '').trim()
    return (
      validEmail(raw) ||
      dateLike(raw) ||
      phoneLike(raw) ||
      positionLike(raw) ||
      /^[£$€₦]?\s*\d[\d,.]*$/.test(raw)
    )
  }).length

  const labelLike = cells.filter((cell) => {
    const raw = String(cell || '').trim()
    if (!raw || raw.length > 60) return false
    if (validEmail(raw) || dateLike(raw) || phoneLike(raw) || positionLike(raw)) return false
    return /[A-Za-z]/.test(raw)
  }).length

  let score = known * 8 + Math.min(cells.length, 10) + Math.min(unique, 10) + labelLike * 2 - dataLike * 5

  if (scenario !== 'members-only') {
    score += cells.some((cell) => /position|rank|standing/i.test(String(cell))) ? 3 : 0
  }

  return score
}

function findHeaderRowIndex(rows, scenario) {
  let bestIndex = 0
  let bestScore = -1
  const limit = Math.min(rows.length, MEMBER_IMPORT_HEADER_SCAN_ROWS)

  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] || []
    const body = rows.slice(index + 1, index + 8)
    let score = scoreHeaderRow(row, scenario)

    if (body.length) {
      const width = Math.max(row.length, ...body.map((item) => item.length))
      const bodyProfiles = Array.from({ length: width }, (_, column) => columnProfile(body, column))
      const bodySignals = bodyProfiles.filter(
        (profile) =>
          profile.email >= 0.5 ||
          profile.phone >= 0.55 ||
          profile.gender >= 0.55 ||
          profile.dob >= 0.55 ||
          profile.level >= 0.55 ||
          profile.position >= 0.7,
      ).length
      score += bodySignals * 2
    }

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }

  return bestIndex
}

function validateMatrix(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'That file is empty.'
  if (rows.length > MEMBER_IMPORT_MAX_ROWS + MEMBER_IMPORT_HEADER_SCAN_ROWS) {
    return `That file has more than ${MEMBER_IMPORT_MAX_ROWS.toLocaleString()} rows.`
  }
  const widest = rows.reduce(
    (maximum, row) => Math.max(maximum, Array.isArray(row) ? row.length : 0),
    0,
  )
  if (widest > MEMBER_IMPORT_MAX_COLUMNS) {
    return `That file has more than ${MEMBER_IMPORT_MAX_COLUMNS} columns.`
  }
  return ''
}

function trimEmptyColumns(headers, body, fixes) {
  const keep = headers.map(
    (header, index) => Boolean(header) || body.some((row) => String(row?.[index] ?? '').trim()),
  )
  const nextHeaders = headers.filter((_, index) => keep[index])
  const nextBody = body.map((row) => row.filter((_, index) => keep[index]))
  const removed = keep.filter((value) => !value).length
  if (removed) addFix(fixes, `Removed ${removed} empty ${removed === 1 ? 'column' : 'columns'}`)
  return { headers: nextHeaders, body: nextBody }
}

export function parseDelimitedSpreadsheet(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')

  if (!lines.length) return []

  const sample = lines.slice(0, 5).join('\n')
  const delimiters = [
    [',', (sample.match(/,/g) || []).length],
    [';', (sample.match(/;/g) || []).length],
    ['\t', (sample.match(/\t/g) || []).length],
  ].sort((left, right) => right[1] - left[1])
  const delimiter = delimiters[0][1] > 0 ? delimiters[0][0] : ','

  return lines.map((line) => {
    const values = []
    let current = ''
    let quoted = false

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          quoted = !quoted
        }
      } else if (character === delimiter && !quoted) {
        values.push(current.trim())
        current = ''
      } else {
        current += character
      }
    }

    values.push(current.trim())
    return values
  })
}

function mappedSourceIndex(workspace, targetKey) {
  const entry = Object.entries(workspace.mappings || {}).find(([, target]) => target === targetKey)
  return entry ? Number(entry[0]) : null
}

function mappedValue(workspace, row, key) {
  const index = mappedSourceIndex(workspace, key)
  return index === null ? '' : String(row?.[index] ?? '').trim()
}

function splitFullName(value) {
  const parts = sanitizePlainText(value, 100).split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { firstName: '', lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function normalisePosition(value) {
  const match = String(value || '').match(/\d+/)
  const number = match ? Number(match[0]) : NaN
  return Number.isInteger(number) && number > 0 && number <= 10000 ? number : null
}

function canonicalLadderName(value) {
  return sanitizePlainText(value, 70)
}

function normaliseYear(value) {
  const number = Number.parseInt(String(value || ''), 10)
  const maximum = new Date().getFullYear() + 1
  return Number.isInteger(number) && number >= 1900 && number <= maximum ? String(number) : ''
}

function validateField(fieldKey, value, { required = false } = {}) {
  const raw = String(value ?? '').trim()
  if (!raw) return required ? 'Required value is missing' : ''

  if (fieldKey === 'email' && !validEmail(raw)) return 'Invalid email'
  if (fieldKey === 'yearOfEntry' && !normaliseYear(raw)) return 'Use a valid year'
  if (fieldKey === 'position' && !normalisePosition(raw)) return 'Use a ladder position'
  if (fieldKey === 'ladder' && !canonicalLadderName(raw)) return 'Add a ladder name'
  if (fieldKey === 'rating' && !Number.isFinite(Number(raw))) return 'Rating should be a number'

  if (fieldKey === 'dob') {
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return 'Invalid date'
  }

  if (fieldKey === 'fullName') {
    const split = splitFullName(raw)
    if (!split.firstName || !split.lastName) return 'Add first and last name'
  }

  return ''
}

export function analyseMemberImportMatrix(
  rows,
  { scenario = 'members-only', fileName = '', sheetName = '', sheetCount = 1 } = {},
) {
  const matrixError = validateMatrix(rows)
  if (matrixError) return { ok: false, error: matrixError }

  const fixes = []
  const headerIndex = findHeaderRowIndex(rows, scenario)
  const rawHeaders = (rows[headerIndex] || []).map((value) => cleanCell(value, fixes))
  const rawBody = rows
    .slice(headerIndex + 1)
    .map((row) =>
      Array.from({ length: rawHeaders.length }, (_, index) => cleanCell(row?.[index] ?? '', fixes)),
    )
    .filter((row) => row.some((value) => String(value || '').trim()))

  if (!rawHeaders.some(Boolean)) return { ok: false, error: 'We could not find the column headings.' }
  if (!rawBody.length) return { ok: false, error: 'We found the headings, but no player rows.' }
  if (rawBody.length > MEMBER_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `That file has more than ${MEMBER_IMPORT_MAX_ROWS.toLocaleString()} player rows.`,
    }
  }

  const trimmed = trimEmptyColumns(rawHeaders, rawBody, fixes)
  const analysis = analyseHeadersAndValues(trimmed.headers, trimmed.body, scenario)

  if (headerIndex > 0) addFix(fixes, `Found your headings on row ${headerIndex + 1}`)
  if (sheetCount > 1 && sheetName) addFix(fixes, `Used sheet: ${sheetName}`)

  const mappedFields = new Set(Object.values(analysis.mappings).filter(Boolean))
  const distinctLadders = []
  const ladderIndex = Object.entries(analysis.mappings).find(([, target]) => target === 'ladder')?.[0]

  if (ladderIndex !== undefined) {
    trimmed.body.forEach((row) => {
      const name = canonicalLadderName(row[Number(ladderIndex)])
      if (name && !distinctLadders.some((item) => item.toLowerCase() === name.toLowerCase())) {
        distinctLadders.push(name)
      }
    })
  }

  const suggestedScenario =
    mappedFields.has('position') && mappedFields.has('ladder')
      ? distinctLadders.length > 1
        ? 'multiple-ladders'
        : 'one-ladder'
      : mappedFields.has('position')
        ? 'one-ladder'
        : 'members-only'

  const identityMapped =
    mappedFields.has('fullName') ||
    (mappedFields.has('firstName') && mappedFields.has('lastName'))

  const looksLikePeople =
    identityMapped &&
    (mappedFields.has('email') ||
      mappedFields.has('phone') ||
      analysis.profiles.some(
        (profile) =>
          profile.email >= 0.5 ||
          profile.phone >= 0.55 ||
          profile.gender >= 0.55 ||
          profile.level >= 0.55,
      ))

  return {
    ok: true,
    scenario,
    fileName: sanitizePlainText(fileName || 'your list', 140),
    sheetName: sanitizePlainText(sheetName, 80),
    sheetCount,
    headerIndex,
    headers: trimmed.headers,
    rows: trimmed.body,
    mappings: analysis.mappings,
    mappingSources: analysis.sources,
    fixes,
    suggestedScenario,
    detectedLadders: distinctLadders,
    looksLikePeople,
    oneLadderName: distinctLadders.length === 1 ? distinctLadders[0] : '',
  }
}

export function importTargetSourceIndex(workspace, targetKey) {
  return mappedSourceIndex(workspace, targetKey)
}

function sourceUsedByOtherTarget(workspace, sourceIndex, targetKey) {
  const mapped = workspace.mappings?.[sourceIndex]
  return Boolean(mapped && mapped !== targetKey)
}

export function importSourceOptionsForTarget(workspace, targetKey) {
  const current = mappedSourceIndex(workspace, targetKey)
  return (workspace.headers || []).map((header, index) => ({
    index,
    label: header || `Column ${index + 1}`,
    selected: index === current,
    disabled: sourceUsedByOtherTarget(workspace, index, targetKey) && index !== current,
  }))
}

export function remapImportTarget(workspace, targetKey, newSourceIndex) {
  Object.entries(workspace.mappings || {}).forEach(([index, target]) => {
    if (target === targetKey) {
      workspace.mappings[index] = ''
      workspace.mappingSources[index] = 'confirmed'
    }
  })

  if (newSourceIndex === null || newSourceIndex === '') return

  const index = Number(newSourceIndex)
  if (!Number.isInteger(index) || index < 0 || index >= workspace.headers.length) return

  const existing = workspace.mappings[index]
  if (existing && existing !== targetKey) {
    workspace.mappings[index] = ''
  }

  workspace.mappings[index] = targetKey
  workspace.mappingSources[index] = 'confirmed'
}

export function importReviewFields(workspace) {
  const schema = scenarioConfig(workspace.scenario)
  const firstIndex = mappedSourceIndex(workspace, 'firstName')
  const lastIndex = mappedSourceIndex(workspace, 'lastName')
  const fullIndex = mappedSourceIndex(workspace, 'fullName')

  const required = schema.required.map(([key, label]) => ({ key, label, required: true }))

  let normalizedRequired = required
  if (fullIndex !== null && (firstIndex === null || lastIndex === null)) {
    normalizedRequired = [
      { key: 'fullName', label: 'Full Name', required: true },
      ...required.filter((field) => !['firstName', 'lastName'].includes(field.key)),
    ]
  }

  const requiredKeys = new Set(normalizedRequired.map((field) => field.key))
  const optional = schema.optional
    .map(([key, label]) => ({ key, label, required: false }))
    .filter((field) => !requiredKeys.has(field.key))

  return [...normalizedRequired, ...optional]
}

export function importExtraSourceColumns(workspace) {
  const used = new Set(
    Object.entries(workspace.mappings || {})
      .filter(([, target]) => Boolean(target))
      .map(([index]) => Number(index)),
  )

  return (workspace.headers || [])
    .map((header, index) => ({ header, index }))
    .filter((item) => !used.has(item.index))
}

function duplicatePositionRows(workspace) {
  const result = new Map()
  if (!['one-ladder', 'multiple-ladders'].includes(workspace.scenario)) return result

  const positionIndex = mappedSourceIndex(workspace, 'position')
  if (positionIndex === null) return result

  const ladderIndex =
    workspace.scenario === 'multiple-ladders' ? mappedSourceIndex(workspace, 'ladder') : null

  if (workspace.scenario === 'multiple-ladders' && ladderIndex === null) return result

  const seen = new Map()

  ;(workspace.rows || []).forEach((row, rowIndex) => {
    const position = normalisePosition(row?.[positionIndex])
    if (!position) return

    const ladderName =
      workspace.scenario === 'one-ladder'
        ? canonicalLadderName(workspace.oneLadderName)
        : canonicalLadderName(row?.[ladderIndex])

    if (!ladderName) return

    const key = `${ladderName.toLowerCase()}::${position}`
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push(rowIndex)
  })

  seen.forEach((rows, key) => {
    if (rows.length < 2) return
    const [ladder, position] = key.split('::')
    rows.forEach((rowIndex) => {
      result.set(rowIndex, `Position #${position} appears more than once in ${ladder}.`)
    })
  })

  return result
}

function missingRequiredMappings(workspace) {
  return importReviewFields(workspace)
    .filter((field) => field.required && mappedSourceIndex(workspace, field.key) === null)
    .map((field) => field.key)
}

function hasDuplicateTargetMappings(workspace) {
  const targets = Object.values(workspace.mappings || {}).filter(Boolean)
  return new Set(targets).size !== targets.length
}

export function importCellIssue(workspace, field, rowIndex) {
  const sourceIndex = mappedSourceIndex(workspace, field.key)
  if (sourceIndex === null) {
    return field.required ? { blocking: true, warning: false, message: 'Choose a source column' } : null
  }

  const value = workspace.rows?.[rowIndex]?.[sourceIndex] ?? ''
  const fieldError = validateField(field.key, value, { required: field.required })
  const duplicate =
    field.key === 'position' ? duplicatePositionRows(workspace).get(rowIndex) || '' : ''

  if (duplicate) return { blocking: true, warning: false, message: duplicate }
  if (!fieldError) return null

  return {
    blocking: field.required,
    warning: !field.required,
    message: fieldError,
  }
}

export function importWorkspaceHealth(workspace) {
  const fields = importReviewFields(workspace)
  const duplicateRows = duplicatePositionRows(workspace)
  const missingMappings = missingRequiredMappings(workspace)
  let requiredCellErrors = 0
  let optionalWarnings = 0

  ;(workspace.rows || []).forEach((row, rowIndex) => {
    fields.forEach((field) => {
      const sourceIndex = mappedSourceIndex(workspace, field.key)
      if (sourceIndex === null) return
      const error = validateField(field.key, row?.[sourceIndex], { required: field.required })
      if (error) {
        if (field.required) requiredCellErrors += 1
        else optionalWarnings += 1
      }
    })

    if (duplicateRows.has(rowIndex)) requiredCellErrors += 1
  })

  if (workspace.scenario === 'one-ladder' && !canonicalLadderName(workspace.oneLadderName)) {
    requiredCellErrors += 1
  }

  return {
    missingRequiredMappings: missingMappings,
    duplicateMappings: hasDuplicateTargetMappings(workspace),
    requiredCellErrors,
    optionalWarnings,
    duplicateRows,
    blocking:
      hasDuplicateTargetMappings(workspace) ||
      missingMappings.length > 0 ||
      requiredCellErrors > 0,
  }
}

export function importFooterMessage(workspace) {
  const health = importWorkspaceHealth(workspace)
  const total = workspace.rows?.length || 0

  if (health.duplicateMappings) {
    return {
      strong: 'Columns need attention.',
      detail: 'Two source columns are mapped to the same Gorra field.',
    }
  }

  if (health.missingRequiredMappings.length) {
    const count = health.missingRequiredMappings.length
    return {
      strong: `${count} required ${count === 1 ? 'field needs' : 'fields need'} a column.`,
      detail: 'Choose it from the table header.',
    }
  }

  if (health.requiredCellErrors) {
    const count = health.requiredCellErrors
    return {
      strong: `${count} ${count === 1 ? 'value needs' : 'values need'} attention.`,
      detail: 'Fix the softly highlighted cells.',
    }
  }

  return {
    strong: `${total} ${total === 1 ? 'member' : 'members'} ready.`,
    detail: health.optionalWarnings
      ? `${health.optionalWarnings} optional ${health.optionalWarnings === 1 ? 'value will' : 'values will'} be left empty unless fixed.`
      : '',
  }
}

function rowIdentity(workspace, row) {
  const fullName = mappedValue(workspace, row, 'fullName')
  if (fullName) return splitFullName(fullName)

  return {
    firstName: sanitizePlainText(mappedValue(workspace, row, 'firstName'), 60),
    lastName: sanitizePlainText(mappedValue(workspace, row, 'lastName'), 60),
  }
}

function normaliseDob(value) {
  const raw = sanitizePlainText(value, 30)
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function mergeImportedPeople(existing, incoming) {
  const next = { ...existing }
  ;[
    'name',
    'email',
    'phone',
    'gender',
    'dob',
    'level',
    'rating',
    'memberNumber',
    'yearOfEntry',
  ].forEach((field) => {
    if (!next[field] && incoming[field]) next[field] = incoming[field]
  })

  const memberships = [...(next.ladderMemberships || [])]
  ;(incoming.ladderMemberships || []).forEach((membership) => {
    const key = membership.ladderName.toLowerCase()
    const current = memberships.find((item) => item.ladderName.toLowerCase() === key)
    if (!current) memberships.push(membership)
  })
  next.ladderMemberships = memberships
  return next
}

export function buildMemberImportDraft(workspace) {
  const health = importWorkspaceHealth(workspace)
  if (health.blocking) {
    throw new Error('Fix the highlighted import details before adding members.')
  }

  const byIdentity = new Map()
  const people = []

  ;(workspace.rows || []).forEach((row, rowIndex) => {
    const identity = rowIdentity(workspace, row)
    const email = sanitizePlainText(mappedValue(workspace, row, 'email'), 254).toLowerCase()
    const memberNumber = sanitizePlainText(mappedValue(workspace, row, 'memberNumber'), 80)
    const phone = sanitizePlainText(mappedValue(workspace, row, 'phone'), 30)
    const ladderName =
      workspace.scenario === 'one-ladder'
        ? canonicalLadderName(workspace.oneLadderName)
        : workspace.scenario === 'multiple-ladders'
          ? canonicalLadderName(mappedValue(workspace, row, 'ladder'))
          : ''
    const position =
      workspace.scenario === 'members-only'
        ? null
        : normalisePosition(mappedValue(workspace, row, 'position'))

    const record = {
      importRow: rowIndex,
      firstName: identity.firstName,
      lastName: identity.lastName,
      name: sanitizePlainText(`${identity.firstName} ${identity.lastName}`, 100),
      email,
      phone,
      gender: sanitizePlainText(mappedValue(workspace, row, 'gender'), 30),
      dob: normaliseDob(mappedValue(workspace, row, 'dob')),
      level: sanitizePlainText(mappedValue(workspace, row, 'level'), 50),
      rating: sanitizePlainText(mappedValue(workspace, row, 'rating'), 40),
      memberNumber,
      yearOfEntry: normaliseYear(mappedValue(workspace, row, 'yearOfEntry')),
      ladderMemberships:
        ladderName && position
          ? [
              {
                ladderName,
                position,
              },
            ]
          : [],
    }

    const strongKey = email ? `email:${email}` : memberNumber ? `member:${memberNumber.toLowerCase()}` : ''
    if (strongKey && byIdentity.has(strongKey)) {
      const index = byIdentity.get(strongKey)
      people[index] = mergeImportedPeople(people[index], record)
      return
    }

    if (strongKey) byIdentity.set(strongKey, people.length)
    people.push(record)
  })

  const ladders = []
  people.forEach((person) => {
    person.ladderMemberships.forEach((membership) => {
      if (
        !ladders.some(
          (ladder) => ladder.name.toLowerCase() === membership.ladderName.toLowerCase(),
        )
      ) {
        ladders.push({ name: membership.ladderName })
      }
    })
  })

  return {
    scenario: workspace.scenario,
    people,
    ladders,
  }
}

export function importScenarioTemplate(scenario) {
  const schema = scenarioConfig(scenario)
  return [...schema.required, ...schema.optional].map(([, label]) => label)
}

export function memberImportScenario(scenario) {
  return scenarioConfig(scenario)
}

export function importFieldLabel(key) {
  return FIELD_LABELS[key] || key
}
