import {
  evaluateLadderEligibility,
  ladderEligibilityMissingFields,
  normalizeLadderEligibility,
} from '../domain/ladderWorkspace.js'
import {
  memberRatingValue,
  normalizeMemberRatings,
  normalizePlayerRatingValue,
  playerRatingSystem,
  playerRatingValueLabel,
  withMemberRating,
} from '../domain/playerRatings.js'
import { collectClubMembers } from '../utils/club/memberData.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { sanitizePlainText } from '../utils/formSafety.js'

const MAX_IMPORT_ROWS = 500

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function normalizedKey(value) {
  return sanitizePlainText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function valueFor(row, aliases) {
  const keyMap = new Map(
    Object.entries(asObject(row)).map(([key, value]) => [
      normalizedKey(key),
      value,
    ]),
  )

  for (const alias of aliases) {
    const value = keyMap.get(normalizedKey(alias))

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim()
    ) {
      return value
    }
  }

  return ''
}

function normalizedEmail(value) {
  return sanitizePlainText(value, 254).toLowerCase()
}

function normalizedMemberNumber(value) {
  return sanitizePlainText(value, 80).toLowerCase()
}

function normalizeGender(value) {
  const key = sanitizePlainText(value, 30).toLowerCase()

  if (['m', 'male', 'man', 'men'].includes(key)) return 'men'

  if (
    ['f', 'female', 'woman', 'women'].includes(key)
  ) {
    return 'women'
  }

  return ''
}

function validDateParts(year, month, day) {
  const date = new Date(
    Date.UTC(year, month - 1, day, 12),
  )

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  )
}

function toIsoDate(year, month, day) {
  if (!validDateParts(year, month, day)) return ''

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

export function normalizeLadderImportDate(value) {
  const raw = sanitizePlainText(value, 40)

  if (!raw) {
    return {
      value: '',
      ambiguous: false,
      options: [],
    }
  }

  const iso = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  )

  if (iso) {
    return {
      value: toIsoDate(
        Number(iso[1]),
        Number(iso[2]),
        Number(iso[3]),
      ),
      ambiguous: false,
      options: [],
    }
  }

  const numeric = raw.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/,
  )

  if (numeric) {
    const first = Number(numeric[1])
    const second = Number(numeric[2])
    const year = Number(numeric[3])

    if (
      first <= 12 &&
      second <= 12 &&
      first !== second
    ) {
      const dayFirst = toIsoDate(
        year,
        second,
        first,
      )

      const monthFirst = toIsoDate(
        year,
        first,
        second,
      )

      return {
        value: '',
        ambiguous: true,
        options: [
          dayFirst,
          monthFirst,
        ].filter(Boolean),
      }
    }

    const day =
      first > 12
        ? first
        : second

    const month =
      first > 12
        ? second
        : first

    return {
      value: toIsoDate(
        year,
        month,
        day,
      ),
      ambiguous: false,
      options: [],
    }
  }

  if (/[a-z]/i.test(raw)) {
    const parsed = new Date(raw)

    if (!Number.isNaN(parsed.getTime())) {
      return {
        value: parsed.toISOString().slice(0, 10),
        ambiguous: false,
        options: [],
      }
    }
  }

  return {
    value: '',
    ambiguous: false,
    options: [],
  }
}

function clubLevelIdFor(value, clubLevels) {
  const raw = sanitizePlainText(value, 50)

  if (!raw) return ''

  const safeId = sanitizeDirectoryId(raw)

  const match = (
    Array.isArray(clubLevels)
      ? clubLevels
      : []
  ).find(
    (level) =>
      sanitizeDirectoryId(level?.id) === safeId ||
      sanitizePlainText(
        level?.label,
        50,
      ).toLowerCase() === raw.toLowerCase(),
  )

  return match
    ? sanitizeDirectoryId(match.id)
    : ''
}

function clubLevelLabel(levelId, clubLevels) {
  const match = (
    Array.isArray(clubLevels)
      ? clubLevels
      : []
  ).find(
    (level) =>
      sanitizeDirectoryId(level?.id) === levelId,
  )

  return sanitizePlainText(
    match?.label,
    50,
  )
}

function ratingAliases(systemId) {
  if (systemId === 'ntrp') {
    return [
      'ntrp',
      'ntrp rating',
      'usta ntrp',
      'usta rating',
      'rating',
    ]
  }

  if (systemId === 'utr') {
    return [
      'utr',
      'utr rating',
      'universal tennis rating',
      'rating',
    ]
  }

  if (systemId === 'wtn') {
    return [
      'wtn',
      'world tennis number',
      'world tennis rating',
      'rating',
    ]
  }

  return []
}

export function ladderImportTemplateHeaders(ladderInput) {
  const ladder = asObject(ladderInput)
  const eligibility = normalizeLadderEligibility(
    ladder.eligibility,
  )

  const headers = [
    'Name',
    'Email',
    'Position',
  ]

  if (eligibility.gender !== 'any') {
    headers.push('Gender')
  }

  if (eligibility.age.mode === 'range') {
    headers.push('Date of Birth')
  }

  if (eligibility.skill.mode === 'club_level') {
    headers.push('Playing Level')
  }

  if (eligibility.skill.mode === 'rating') {
    const system = playerRatingSystem(
      eligibility.skill.ratingSystem,
    )

    if (system) {
      headers.push(system.acronym)
    }
  }

  return headers
}

export function ladderImportReadMeRows({
  ladder,
  requirementsLabel,
} = {}) {
  const headers = ladderImportTemplateHeaders(ladder)

  return [
    [
      'GORRA Ladder Import',
      'Keep one player per row. Put the field names in the first row.',
    ],
    [
      'This ladder',
      requirementsLabel || '',
    ],
    [
      'Suggested headings',
      headers.join(' Â· '),
    ],
    [
      'Existing spreadsheet',
      'Keep your data. Rename the first-row headings if needed. GORRA also understands common headings such as Player, Rank and DOB.',
    ],
    [
      'Identity',
      'Email is the easiest way to reuse an existing club member. A Member Number is also accepted. GORRA never merges people by name alone.',
    ],
    [
      'Dates',
      'YYYY-MM-DD is safest. Example: 2001-09-24.',
    ],
    [
      'Missing details',
      'If GORRA already knows a playerâ€™s required detail, you do not need to repeat it in the file.',
    ],
    [
      'Before anything changes',
      'GORRA shows who is ready, who needs attention and who is not eligible.',
    ],
  ]
}

export function spreadsheetRowsForLadder(
  rawRows,
  {
    ladder,
    clubLevels = [],
  } = {},
) {
  const eligibility = normalizeLadderEligibility(
    ladder?.eligibility,
  )

  const ratingSystem =
    eligibility.skill.mode === 'rating'
      ? eligibility.skill.ratingSystem
      : ''

  return (
    Array.isArray(rawRows)
      ? rawRows
      : []
  )
    .slice(0, MAX_IMPORT_ROWS)
    .map((raw, index) => {
      const rawGender = valueFor(
        raw,
        [
          'gender',
          'sex',
        ],
      )

      const normalizedGender = normalizeGender(
        rawGender,
      )

      const rawDob = valueFor(
        raw,
        [
          'dob',
          'date of birth',
          'birth date',
          'birthday',
        ],
      )

      const date = normalizeLadderImportDate(rawDob)

      const rawLevel = valueFor(
        raw,
        [
          'playing level',
          'level',
          'skill',
          'skill level',
          'player grade',
        ],
      )

      const clubLevelId = clubLevelIdFor(
        rawLevel,
        clubLevels,
      )

      const rawRating = ratingSystem
        ? valueFor(
            raw,
            ratingAliases(ratingSystem),
          )
        : ''

      const ratingValue =
        ratingSystem &&
        String(rawRating || '').trim()
          ? normalizePlayerRatingValue(
              ratingSystem,
              rawRating,
            )
          : null

      return {
        rowId: `row-${index + 1}`,
        sourceRow: index + 2,

        name: sanitizePlainText(
          valueFor(
            raw,
            [
              'name',
              'full name',
              'player',
              'player name',
              'member',
            ],
          ),
          100,
        ),

        email: normalizedEmail(
          valueFor(
            raw,
            [
              'email',
              'email address',
              'mail',
            ],
          ),
        ),

        memberNumber: sanitizePlainText(
          valueFor(
            raw,
            [
              'member number',
              'member no',
              'member id',
              'reference number',
              'reference no',
              'member ref',
            ],
          ),
          80,
        ),

        phone: sanitizePlainText(
          valueFor(
            raw,
            [
              'phone',
              'phone number',
              'mobile',
              'whatsapp',
            ],
          ),
          30,
        ),

        position: Number.parseInt(
          valueFor(
            raw,
            [
              'position',
              'rank',
              'ranking',
              'ladder position',
              'standing',
              'current position',
            ],
          ),
          10,
        ),

        gender: normalizedGender,
        rawGender: sanitizePlainText(rawGender, 30),
        genderInvalid: Boolean(
          String(rawGender || '').trim() &&
          !normalizedGender,
        ),

        dob: date.value,
        dateAmbiguous: date.ambiguous,
        dateOptions: date.options,
        rawDob: sanitizePlainText(rawDob, 40),
        dateInvalid: Boolean(
          String(rawDob || '').trim() &&
          !date.value &&
          !date.ambiguous,
        ),

        clubLevelId,
        rawClubLevel: sanitizePlainText(rawLevel, 50),
        clubLevelInvalid: Boolean(
          String(rawLevel || '').trim() &&
          !clubLevelId,
        ),

        rawRating: sanitizePlainText(rawRating, 40),
        ratingInvalid: Boolean(
          ratingSystem &&
          String(rawRating || '').trim() &&
          ratingValue === null,
        ),

        ratings:
          ratingSystem &&
          ratingValue !== null
            ? {
                [ratingSystem]: ratingValue,
              }
            : {},
      }
    })
}

function memberIndices(members) {
  const emailIndex = new Map()
  const memberNumberIndex = new Map()

  members.forEach((member) => {
    const email = normalizedEmail(
      member.email,
    )

    const memberNumber = normalizedMemberNumber(
      member.memberNumber,
    )

    if (email) {
      if (!emailIndex.has(email)) {
        emailIndex.set(email, [])
      }

      emailIndex
        .get(email)
        .push(member)
    }

    if (memberNumber) {
      if (!memberNumberIndex.has(memberNumber)) {
        memberNumberIndex.set(memberNumber, [])
      }

      memberNumberIndex
        .get(memberNumber)
        .push(member)
    }
  })

  return {
    emailIndex,
    memberNumberIndex,
  }
}

function matchingMember(row, indices) {
  const matches = []

  if (row.email) {
    matches.push(
      ...(indices.emailIndex.get(row.email) || []),
    )
  }

  const memberNumber = normalizedMemberNumber(
    row.memberNumber,
  )

  if (memberNumber) {
    matches.push(
      ...(
        indices.memberNumberIndex.get(memberNumber) ||
        []
      ),
    )
  }

  const unique = [
    ...new Map(
      matches.map((member) => [
        member.id,
        member,
      ]),
    ).values(),
  ]

  return {
    ambiguous: unique.length > 1,
    member:
      unique.length === 1
        ? unique[0]
        : null,
  }
}

function comparisonValue(field, value) {
  if (
    value === undefined ||
    value === null
  ) {
    return ''
  }

  if (field.startsWith('rating:')) {
    return Number(value)
  }

  return String(value)
    .trim()
    .toLowerCase()
}

function conflictDecision(
  resolutions,
  rowId,
  field,
) {
  const key = `${rowId}:${field}`
  const value = resolutions?.[key]

  return ['keep', 'incoming'].includes(value)
    ? value
    : ''
}

function conflictIssue({
  rowId,
  field,
  label,
  current,
  incoming,
  currentLabel = '',
  incomingLabel = '',
} = {}) {
  return {
    type: 'conflict',
    field,
    label,
    current,
    incoming,
    currentLabel:
      currentLabel ||
      String(current ?? ''),
    incomingLabel:
      incomingLabel ||
      String(incoming ?? ''),
    resolutionKey: `${rowId}:${field}`,
    message:
      `${label} does not match the current club record.`,
  }
}

function missingIssue(field, eligibility) {
  if (field === 'gender') {
    return {
      type: 'missing',
      field,
      label: 'Gender',
      message:
        'Gender is needed to check this Ladder.',
    }
  }

  if (field === 'dob') {
    return {
      type: 'missing',
      field,
      label: 'Date of birth',
      message:
        `Date of birth is needed to check the ${eligibility.age.minimum}${eligibility.age.maximum >= 100 ? '+' : `â€“${eligibility.age.maximum}`} age rule.`,
    }
  }

  if (field === 'clubLevel') {
    return {
      type: 'missing',
      field,
      label: 'Playing level',
      message:
        'The club needs a playing level for this player.',
    }
  }

  if (field === 'rating') {
    const system = playerRatingSystem(
      eligibility.skill.ratingSystem,
    )

    return {
      type: 'missing',
      field,
      label:
        system?.acronym ||
        'Competition rating',
      message:
        `${system?.acronym || 'A competition rating'} is needed to check this Ladder.`,
    }
  }

  return {
    type: 'missing',
    field,
    label: 'Information',
    message: 'More information is needed.',
  }
}

function eligibilityReasonText(
  result,
  eligibility,
) {
  if (result.reason === 'gender') {
    return eligibility.gender === 'men'
      ? 'This Ladder is for men.'
      : 'This Ladder is for women.'
  }

  if (result.reason === 'age') {
    return result.age === null ||
      result.age === undefined
      ? 'The age requirement is not met.'
      : `This player is ${result.age}. The Ladder requires age ${eligibility.age.minimum}${eligibility.age.maximum >= 100 ? '+' : `â€“${eligibility.age.maximum}`}.`
  }

  if (result.reason === 'skill') {
    return 'The playerâ€™s current club level is not allowed on this Ladder.'
  }

  if (result.reason === 'rating') {
    const system = playerRatingSystem(
      eligibility.skill.ratingSystem,
    )

    const current = playerRatingValueLabel(
      system?.id,
      result.ratingValue,
    )

    const minimum = playerRatingValueLabel(
      system?.id,
      eligibility.skill.minimum,
    )

    const maximum = playerRatingValueLabel(
      system?.id,
      eligibility.skill.maximum,
    )

    return `${system?.acronym || 'Rating'} ${current} is outside the allowed ${minimum}â€“${maximum} range.`
  }

  return 'This player does not meet the Ladder requirements.'
}

function profileFromMember(member) {
  if (!member) {
    return {
      name: '',
      email: '',
      memberNumber: '',
      phone: '',
      gender: '',
      dob: '',
      clubLevelId: '',
      level: '',
      ratings: {},
    }
  }

  return {
    name: sanitizePlainText(
      member.name,
      100,
    ),
    email: normalizedEmail(
      member.email,
    ),
    memberNumber: sanitizePlainText(
      member.memberNumber,
      80,
    ),
    phone: sanitizePlainText(
      member.phone,
      30,
    ),
    gender: normalizeGender(
      member.gender,
    ),
    dob: sanitizePlainText(
      member.dob,
      10,
    ),
    clubLevelId: sanitizeDirectoryId(
      member.clubLevelId ||
        member.level,
    ),
    level: sanitizePlainText(
      member.level,
      50,
    ),
    ratings: normalizeMemberRatings(
      member.ratings,
    ),
  }
}

function profileFromRow(
  row,
  {
    ratingSystem,
    clubLevels,
  } = {},
) {
  let ratings = {}

  if (ratingSystem) {
    const raw = asObject(
      row.ratings,
    )[ratingSystem]

    const value = normalizePlayerRatingValue(
      ratingSystem,
      raw?.value ?? raw,
    )

    if (value !== null) {
      ratings = withMemberRating(
        ratings,
        ratingSystem,
        value,
        {
          source: 'admin-import',
        },
      )
    }
  }

  return {
    name: sanitizePlainText(
      row.name,
      100,
    ),
    email: normalizedEmail(
      row.email,
    ),
    memberNumber: sanitizePlainText(
      row.memberNumber,
      80,
    ),
    phone: sanitizePlainText(
      row.phone,
      30,
    ),
    gender: normalizeGender(
      row.gender,
    ),
    dob: sanitizePlainText(
      row.dob,
      10,
    ),
    clubLevelId: sanitizeDirectoryId(
      row.clubLevelId,
    ),
    level: clubLevelLabel(
      sanitizeDirectoryId(
        row.clubLevelId,
      ),
      clubLevels,
    ),
    ratings,
  }
}

function mergeEligibilityField({
  rowId,
  field,
  label,
  current,
  incoming,
  resolutions,
  issues,
  currentLabel = '',
  incomingLabel = '',
} = {}) {
  const currentComparable = comparisonValue(
    field,
    current,
  )

  const incomingComparable = comparisonValue(
    field,
    incoming,
  )

  if (
    currentComparable !== '' &&
    incomingComparable !== '' &&
    currentComparable !== incomingComparable
  ) {
    const decision = conflictDecision(
      resolutions,
      rowId,
      field,
    )

    if (decision === 'incoming') {
      return incoming
    }

    if (decision === 'keep') {
      return current
    }

    issues.push(
      conflictIssue({
        rowId,
        field,
        label,
        current,
        incoming,
        currentLabel,
        incomingLabel,
      }),
    )

    return current
  }

  return incomingComparable !== ''
    ? incoming
    : current
}

function structuralIssues(
  row,
  eligibility,
  existingMember = null,
) {
  const issues = []

  if (
    sanitizePlainText(
      row.name,
      100,
    ).length < 2 &&
    sanitizePlainText(
      existingMember?.name,
      100,
    ).length < 2
  ) {
    issues.push({
      type: 'invalid',
      field: 'name',
      label: 'Name',
      message:
        'Add the player name.',
    })
  }

  const position = Number.parseInt(
    row.position,
    10,
  )

  if (
    !Number.isInteger(position) ||
    position < 1 ||
    position > 10000
  ) {
    issues.push({
      type: 'invalid',
      field: 'position',
      label: 'Position',
      message:
        'Use a whole-number position such as 1, 2 or 3.',
    })
  }

  if (
    row.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(
      row.email,
    )
  ) {
    issues.push({
      type: 'invalid',
      field: 'email',
      label: 'Email',
      message:
        'Check this email address.',
    })
  }

  if (
    eligibility.gender !== 'any' &&
    row.genderInvalid
  ) {
    issues.push({
      type: 'invalid',
      field: 'gender',
      label: 'Gender',
      message:
        `GORRA does not recognise "${row.rawGender}" as a gender value for this Ladder.`,
    })
  }

  if (
    eligibility.age.mode === 'range' &&
    row.dateAmbiguous
  ) {
    issues.push({
      type: 'invalid',
      field: 'dob',
      label: 'Date of birth',
      message:
        `The date "${row.rawDob}" is ambiguous. Choose the intended date.`,
      options:
        Array.isArray(row.dateOptions)
          ? row.dateOptions
          : [],
    })
  } else if (
    eligibility.age.mode === 'range' &&
    row.dateInvalid
  ) {
    issues.push({
      type: 'invalid',
      field: 'dob',
      label: 'Date of birth',
      message:
        `GORRA could not read "${row.rawDob}" as a date of birth.`,
    })
  }

  if (
    eligibility.skill.mode === 'club_level' &&
    row.clubLevelInvalid
  ) {
    issues.push({
      type: 'invalid',
      field: 'clubLevel',
      label: 'Playing level',
      message:
        `GORRA does not recognise "${row.rawClubLevel}" as one of this clubâ€™s levels.`,
    })
  }

  if (
    eligibility.skill.mode === 'rating' &&
    row.ratingInvalid
  ) {
    const system = playerRatingSystem(
      eligibility.skill.ratingSystem,
    )

    issues.push({
      type: 'invalid',
      field: 'rating',
      label:
        system?.acronym ||
        'Competition rating',
      message:
        `"${row.rawRating}" is not a valid ${system?.acronym || 'rating'} value.`,
    })
  }

  return issues
}

function duplicateIssueMap(rows) {
  const issues = new Map()

  const add = (rowId, issue) => {
    if (!issues.has(rowId)) {
      issues.set(rowId, [])
    }

    issues
      .get(rowId)
      .push(issue)
  }

  const positions = new Map()
  const emails = new Map()
  const memberNumbers = new Map()

  rows.forEach((row) => {
    const position = Number.parseInt(
      row.position,
      10,
    )

    if (
      Number.isInteger(position) &&
      position >= 1
    ) {
      if (!positions.has(position)) {
        positions.set(position, [])
      }

      positions
        .get(position)
        .push(row.rowId)
    }

    if (row.email) {
      if (!emails.has(row.email)) {
        emails.set(row.email, [])
      }

      emails
        .get(row.email)
        .push(row.rowId)
    }

    const memberNumber = normalizedMemberNumber(
      row.memberNumber,
    )

    if (memberNumber) {
      if (!memberNumbers.has(memberNumber)) {
        memberNumbers.set(memberNumber, [])
      }

      memberNumbers
        .get(memberNumber)
        .push(row.rowId)
    }
  })

  positions.forEach((rowIds, position) => {
    if (rowIds.length < 2) return

    rowIds.forEach((rowId) =>
      add(
        rowId,
        {
          type: 'invalid',
          field: 'position',
          label: 'Position',
          message:
            `Position #${position} appears more than once.`,
        },
      ),
    )
  })

  emails.forEach((rowIds, email) => {
    if (rowIds.length < 2) return

    rowIds.forEach((rowId) =>
      add(
        rowId,
        {
          type: 'invalid',
          field: 'email',
          label: 'Email',
          message:
            `${email} appears more than once in this file.`,
        },
      ),
    )
  })

  memberNumbers.forEach(
    (rowIds, memberNumber) => {
      if (rowIds.length < 2) return

      rowIds.forEach((rowId) =>
        add(
          rowId,
          {
            type: 'invalid',
            field: 'memberNumber',
            label: 'Member number',
            message:
              `${memberNumber} appears more than once in this file.`,
          },
        ),
      )
    },
  )

  return issues
}

export function previewExistingLadderImport({
  setup,
  ladder,
  rows,
  resolutions = {},
  skippedRowIds = [],
} = {}) {
  const source = (
    Array.isArray(rows)
      ? rows
      : []
  )
    .slice(0, MAX_IMPORT_ROWS)
    .map((row, index) => ({
      ...asObject(row),
      rowId: sanitizeDirectoryId(
        row?.rowId,
        `row-${index + 1}`,
      ),
    }))

  const eligibility = normalizeLadderEligibility(
    ladder?.eligibility,
  )

  const clubLevels = Array.isArray(
    setup?.playerLevels?.levels,
  )
    ? setup.playerLevels.levels
    : []

  const ratingSystem =
    eligibility.skill.mode === 'rating'
      ? eligibility.skill.ratingSystem
      : ''

  const members = collectClubMembers(
    setup || {},
  )

  const indices = memberIndices(members)

  const skipped = new Set(
    (
      Array.isArray(skippedRowIds)
        ? skippedRowIds
        : []
    )
      .map(sanitizeDirectoryId)
      .filter(Boolean),
  )

  /*
   * A skipped row is intentionally outside this import attempt.
   * It must not keep causing duplicate-position / duplicate-identity
   * errors for the rows the admin is still importing.
   */
  const duplicates = duplicateIssueMap(
    source.filter(
      (row) =>
        !skipped.has(
          sanitizeDirectoryId(row.rowId),
        ),
    ),
  )

  const previewRows = source.map((row) => {
    const rowId = sanitizeDirectoryId(
      row.rowId,
    )

    if (skipped.has(rowId)) {
      return {
        ...row,
        rowId,
        status: 'skipped',
        issues: [],
        existingMemberId: '',
        existingMember: null,
        resolvedProfile: null,
        memberPatch: null,
        eligibilityResult: null,
        eligibilityReason: '',
      }
    }

    const match = matchingMember(
      row,
      indices,
    )

    const issues = [
      ...structuralIssues(
        row,
        eligibility,
        match.member,
      ),
      ...(duplicates.get(rowId) || []),
    ]

    if (match.ambiguous) {
      issues.push({
        type: 'invalid',
        field: 'identity',
        label: 'Player',
        message:
          'Email and member number point to different club records. Review this player.',
      })
    }

    const existing = profileFromMember(
      match.member,
    )

    const incoming = profileFromRow(
      row,
      {
        ratingSystem,
        clubLevels,
      },
    )

    const resolved = {
      name:
        existing.name ||
        incoming.name,
      email:
        existing.email ||
        incoming.email,
      memberNumber:
        existing.memberNumber ||
        incoming.memberNumber,
      phone:
        existing.phone ||
        incoming.phone,
      gender:
        existing.gender ||
        incoming.gender,
      dob:
        existing.dob ||
        incoming.dob,
      clubLevelId:
        existing.clubLevelId ||
        incoming.clubLevelId,
      level:
        existing.level ||
        incoming.level,
      ratings: {
        ...existing.ratings,
      },
    }

    if (eligibility.gender !== 'any') {
      resolved.gender = mergeEligibilityField({
        rowId,
        field: 'gender',
        label: 'Gender',
        current: existing.gender,
        incoming: incoming.gender,
        resolutions,
        issues,
      })
    }

    if (eligibility.age.mode === 'range') {
      resolved.dob = mergeEligibilityField({
        rowId,
        field: 'dob',
        label: 'Date of birth',
        current: existing.dob,
        incoming: incoming.dob,
        resolutions,
        issues,
      })
    }

    if (
      eligibility.skill.mode ===
      'club_level'
    ) {
      resolved.clubLevelId = mergeEligibilityField({
        rowId,
        field: 'clubLevelId',
        label: 'Playing level',
        current:
          existing.clubLevelId,
        incoming:
          incoming.clubLevelId,
        resolutions,
        issues,
        currentLabel:
          clubLevelLabel(
            existing.clubLevelId,
            clubLevels,
          ),
        incomingLabel:
          clubLevelLabel(
            incoming.clubLevelId,
            clubLevels,
          ),
      })

      resolved.level = clubLevelLabel(
        resolved.clubLevelId,
        clubLevels,
      )
    }

    if (ratingSystem) {
      const currentRating = memberRatingValue(
        existing,
        ratingSystem,
      )

      const incomingRating = memberRatingValue(
        incoming,
        ratingSystem,
      )

      const resolvedRating = mergeEligibilityField({
        rowId,
        field: `rating:${ratingSystem}`,
        label:
          playerRatingSystem(
            ratingSystem,
          )?.acronym ||
          'Competition rating',
        current: currentRating,
        incoming: incomingRating,
        resolutions,
        issues,
        currentLabel: playerRatingValueLabel(
          ratingSystem,
          currentRating,
        ),
        incomingLabel: playerRatingValueLabel(
          ratingSystem,
          incomingRating,
        ),
      })

      if (
        resolvedRating !== '' &&
        resolvedRating !== null &&
        resolvedRating !== undefined
      ) {
        resolved.ratings = withMemberRating(
          resolved.ratings,
          ratingSystem,
          resolvedRating,
          {
            source:
              conflictDecision(
                resolutions,
                rowId,
                `rating:${ratingSystem}`,
              ) === 'incoming' ||
              currentRating === null
                ? 'admin-import'
                : existing.ratings?.[
                    ratingSystem
                  ]?.source ||
                  'admin',
            verified:
              existing.ratings?.[
                ratingSystem
              ]?.verified === true &&
              Number(currentRating) ===
                Number(resolvedRating),
          },
        )
      }
    }

    const missing = ladderEligibilityMissingFields(
      eligibility,
      resolved,
    )

    missing.forEach((field) => {
      const conflictAlreadyExists = issues.some(
        (issue) =>
          issue.type === 'conflict' &&
          (
            issue.field === field ||
            (
              field === 'rating' &&
              issue.field.startsWith(
                'rating:',
              )
            ) ||
            (
              field === 'clubLevel' &&
              issue.field ===
                'clubLevelId'
            )
          ),
      )

      const invalidAlreadyExists = issues.some(
        (issue) =>
          issue.type === 'invalid' &&
          issue.field === field,
      )

      if (
        !conflictAlreadyExists &&
        !invalidAlreadyExists
      ) {
        issues.push(
          missingIssue(
            field,
            eligibility,
          ),
        )
      }
    })

    const hasInvalid = issues.some(
      (issue) => issue.type === 'invalid',
    )

    const hasConflict = issues.some(
      (issue) => issue.type === 'conflict',
    )

    const hasMissing = issues.some(
      (issue) => issue.type === 'missing',
    )

    const eligibilityResult =
      hasInvalid ||
      hasConflict ||
      hasMissing
        ? null
        : evaluateLadderEligibility({
            eligibility,
            profile: resolved,
          })

    let status = 'ready'
    let eligibilityReason = ''

    if (
      hasInvalid ||
      hasConflict ||
      hasMissing
    ) {
      status = 'attention'
    } else if (
      eligibilityResult &&
      !eligibilityResult.eligible
    ) {
      status = 'ineligible'
      eligibilityReason = eligibilityReasonText(
        eligibilityResult,
        eligibility,
      )
    }

    const memberPatch = {
      name: resolved.name,
      email: resolved.email,
      memberNumber:
        resolved.memberNumber,
      phone: resolved.phone,
      gender: resolved.gender,
      dob: resolved.dob,
      clubLevelId:
        resolved.clubLevelId,
      level: resolved.level,
      ratings: normalizeMemberRatings(
        resolved.ratings,
      ),
    }

    return {
      ...row,
      rowId,
      position: Number.parseInt(
        row.position,
        10,
      ),
      status,
      issues,
      existingMemberId:
        sanitizeDirectoryId(
          match.member?.id,
        ),
      existingMember:
        match.member
          ? {
              id: match.member.id,
              name: match.member.name,
              email: match.member.email,
            }
          : null,
      resolvedProfile: resolved,
      memberPatch,
      eligibilityResult,
      eligibilityReason,
    }
  })

  const ready = previewRows.filter(
    (row) => row.status === 'ready',
  )

  const attention = previewRows.filter(
    (row) => row.status === 'attention',
  )

  const ineligible = previewRows.filter(
    (row) => row.status === 'ineligible',
  )

  const skippedRows = previewRows.filter(
    (row) => row.status === 'skipped',
  )

  const readyExistingIds = new Set(
    ready
      .map((row) => row.existingMemberId)
      .filter(Boolean),
  )

  const preservedExisting = (
    Array.isArray(ladder?.entries)
      ? ladder.entries
      : []
  ).filter(
    (entry) =>
      entry?.memberId &&
      !readyExistingIds.has(entry.memberId),
  ).length

  /*
   * Ineligible and skipped rows are not applied, so calculate
   * position gaps only from the rows that will actually be imported.
   */
  const readyPositions = ready
    .map((row) => row.position)
    .filter(Number.isInteger)
    .sort((left, right) => left - right)

  const hasPositionGap =
    readyPositions.length > 0 &&
    readyPositions.some(
      (position, index) =>
        position !== index + 1,
    )

  return {
    ladderId: sanitizeDirectoryId(
      ladder?.id,
    ),
    rows: previewRows,
    summary: {
      total: previewRows.length,
      ready: ready.length,
      attention: attention.length,
      ineligible: ineligible.length,
      skipped: skippedRows.length,
      existingMembers: ready.filter(
        (row) => row.existingMemberId,
      ).length,
      newMembers: ready.filter(
        (row) => !row.existingMemberId,
      ).length,
      preservedExisting,
    },
    canApply:
      ready.length > 0 &&
      attention.length === 0,
    hasPositionGap,
    templateHeaders:
      ladderImportTemplateHeaders(
        ladder,
      ),
  }
}
