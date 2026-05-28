const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const monthDayFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
})

const monthDayYearFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

function parseDate(value) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function mergeDateAndTime(dateValue, timeValue) {
  if (!dateValue) {
    return null
  }

  if (!timeValue) {
    return parseDate(dateValue)
  }

  const normalizedTime = String(timeValue).length === 5 ? `${timeValue}:00` : String(timeValue)
  return parseDate(`${dateValue}T${normalizedTime}`)
}

export function formatAppDate(value, options = {}) {
  const date = parseDate(value)
  if (!date) {
    return options.fallback || ''
  }

  return options.includeYear === false
    ? monthDayFormatter.format(date)
    : monthDayYearFormatter.format(date)
}

export function formatAppDateTime(value, options = {}) {
  const date = parseDate(value)
  if (!date) {
    return options.fallback || ''
  }

  return dateTimeFormatter.format(date)
}

export function formatAppDateWithTime(dateValue, timeValue, options = {}) {
  const date = mergeDateAndTime(dateValue, timeValue)
  if (!date) {
    return options.fallback || ''
  }

  return timeValue ? dateTimeFormatter.format(date) : monthDayYearFormatter.format(date)
}

export function formatAppDateRange(startValue, endValue, options = {}) {
  const startDate = parseDate(startValue)
  const endDate = parseDate(endValue)
  const fallback = options.fallback || ''

  if (!startDate && !endDate) {
    return fallback
  }

  if (startDate && !endDate) {
    return formatAppDate(startDate)
  }

  if (!startDate && endDate) {
    return formatAppDate(endDate)
  }

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatAppDate(startDate)
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${monthDayFormatter.format(startDate)} → ${monthDayFormatter.format(endDate)}, ${endDate.getFullYear()}`
  }

  return `${monthDayYearFormatter.format(startDate)} → ${monthDayYearFormatter.format(endDate)}`
}
