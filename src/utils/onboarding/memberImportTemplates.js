import { memberImportScenario } from './memberImport.js'

// Fictional examples, never seeded into club storage. Emails use the reserved example.com domain.
const PEOPLE = [
  ['Ada', 'Okafor', 'ada.okafor@example.com', '2022', 'Female', '1994-03-12', 'Intermediate', '3.5', 'GC-001'],
  ['Tunde', 'Bello', 'tunde.bello@example.com', '2021', 'Male', '1988-07-24', 'Advanced', '4.5', 'GC-002'],
  ['Ama', 'Mensah', 'ama.mensah@example.com', '2023', 'Female', '1996-11-08', 'Intermediate', '3.0', 'GC-003'],
  ['Daniel', 'Cole', 'daniel.cole@example.com', '2020', 'Male', '1990-01-19', 'Advanced', '4.0', 'GC-004'],
  ['Zainab', 'Lawal', 'zainab.lawal@example.com', '2024', 'Female', '1998-05-06', 'Beginner', '2.5', 'GC-005'],
  ['Kwame', 'Asante', 'kwame.asante@example.com', '2022', 'Male', '1992-09-15', 'Intermediate', '3.5', 'GC-006'],
  ['Maya', 'Williams', 'maya.williams@example.com', '2025', 'Female', '1995-12-03', 'Intermediate', '3.0', 'GC-007'],
  ['Chidi', 'Nwosu', 'chidi.nwosu@example.com', '2023', 'Male', '1991-04-27', 'Advanced', '4.0', 'GC-008'],
]

export function memberTemplateMatrix(scenario, includeExamples = true) {
  const schema = memberImportScenario(scenario)
  const fields = [...schema.required, ...schema.optional]
  const headers = fields.map(([, label]) => label)
  if (!includeExamples) return [headers]
  const people = PEOPLE.map(([firstName, lastName, email, yearOfEntry, gender, dob, level, rating, memberNumber]) => ({
    firstName, lastName, email, yearOfEntry, gender, dob, level, rating, memberNumber, phone: '',
  }))
  let entries = people.map((person, index) => ({ ...person, ladder: 'Open Singles', position: String(index + 1) }))
  if (scenario === 'multiple-ladders') {
    entries = [...entries, ...people.filter(person => person.gender === 'Female').map((person, index) => ({
      ...person, ladder: "Women's Singles", position: String(index + 1),
    })), ...people.filter(person => person.gender === 'Male').map((person, index) => ({
      ...person, ladder: "Men's Singles", position: String(index + 1),
    }))]
  }
  return [headers, ...entries.map(person => fields.map(([key]) => person[key] || ''))]
}

export function memberTemplateDelimited(scenario, includeExamples = true, separator = ',') {
  return memberTemplateMatrix(scenario, includeExamples)
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(separator))
    .join('\r\n') + '\r\n'
}

export function memberTemplateGuide(scenario) {
  const schema = memberImportScenario(scenario)
  return [
    ['Gorra import guide', schema.title],
    ['Example data', 'All example people are fictional. Replace or delete them before importing your club list.'],
    ['Required columns', schema.required.map(([, label]) => label).join(', ')],
    ['Optional columns', schema.optional.map(([, label]) => label).join(', ')],
    ['Identity', 'Use one consistent email and member reference for each person.'],
    ['Dates', 'Use YYYY-MM-DD for dates of birth and a four-digit Year of Entry.'],
    ['Phone', 'Optional. Keep phone numbers as text, including the country code.'],
    ['Position', scenario === 'members-only' ? 'Not needed for a members-only list.' : 'Use positive whole numbers. Each position must be unique within its ladder.'],
    ['Ladder', scenario === 'one-ladder' ? 'Enter the ladder name in Gorra before uploading. Do not add a Ladder column.' : scenario === 'multiple-ladders' ? 'One row per person per ladder. Repeat the same email and reference when a person belongs to another ladder.' : 'No ladders are created by this format.'],
    ['Before importing', 'Keep headings in row 1. Review all rows in Gorra before confirming the import.'],
  ]
}
