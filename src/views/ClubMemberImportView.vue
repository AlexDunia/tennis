<script setup>
import MemberListArt from '../components/club/MemberListArt.vue'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import { useAdminStore } from '../stores/admin'
import { useNotificationStore } from '../stores/notification'
import {
  MEMBER_IMPORT_FIELD_OPTIONS,
  MEMBER_IMPORT_MAX_BYTES,
  MEMBER_IMPORT_SCENARIOS,
  analyseMemberImportMatrix,
  buildMemberImportDraft,
  importCellIssue,
  importExtraSourceColumns,
  importFooterMessage,
  importReviewFields,
  importScenarioTemplate,
  importSourceOptionsForTarget,
  importTargetSourceIndex,
  importWorkspaceHealth,
  memberImportScenario,
  parseDelimitedSpreadsheet,
  remapImportTarget,
} from '../utils/onboarding/memberImport.js'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const fileInput = ref(null)
const pasteDialog = ref(null)
const helpDialog = ref(null)
const templateDialog = ref(null)
const error = ref('')
const busy = ref(false)
const dragging = ref(false)
const stage = ref('scenario')
const query = ref('')
const columnFilter = ref('all')
const pasteText = ref('')
const manualScenarioOverride = ref(false)

const workspace = reactive({
  scenario: 'members-only',
  fileName: '',
  sheetName: '',
  sheetCount: 1,
  headerIndex: 0,
  headers: [],
  rows: [],
  mappings: {},
  mappingSources: {},
  fixes: [],
  suggestedScenario: 'members-only',
  detectedLadders: [],
  looksLikePeople: true,
  oneLadderName: '',
})

const scenario = computed(() => {
  const value = String(route.query.scenario || '')
  return MEMBER_IMPORT_SCENARIOS[value] ? value : ''
})

const schema = computed(() => memberImportScenario(workspace.scenario))
const club = computed(() => adminStore.activeClub)
const fields = computed(() => importReviewFields(workspace))
const extras = computed(() => importExtraSourceColumns(workspace))
const health = computed(() => importWorkspaceHealth(workspace))
const footer = computed(() => importFooterMessage(workspace))

const displayedColumns = computed(() => {
  const fieldColumns = fields.value
    .filter((field) => {
      if (columnFilter.value === 'required') return field.required
      if (columnFilter.value === 'optional') return !field.required
      if (columnFilter.value === 'extra') return false
      return true
    })
    .map((field) => ({ type: 'field', key: field.key, field }))

  const extraColumns =
    columnFilter.value === 'required' || columnFilter.value === 'optional'
      ? []
      : extras.value.map((extra) => ({
          type: 'extra',
          key: `extra-${extra.index}`,
          extra,
        }))

  return [...fieldColumns, ...extraColumns]
})

const displayedRows = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return workspace.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !needle || row.some((value) => String(value || '').toLowerCase().includes(needle)))
})

const importActionLabel = computed(() => {
  if (busy.value) return 'Adding…'
  if (workspace.scenario === 'one-ladder') return 'Add ladder'
  if (workspace.scenario === 'multiple-ladders') return 'Add ladders'
  return 'Add members'
})

const helpCopy = computed(() => {
  if (workspace.scenario === 'one-ladder') {
    return {
      title: 'How to prepare one ladder',
      intro: 'Use the ladder list your club already keeps.',
      steps: [
        ['Keep one player on each row', 'Use First Name, Last Name, Email, Position and Year of Entry.'],
        ['Enter the ladder name once in Gorra', 'You do not need to repeat the same ladder name on every row.'],
        ['Positions should describe the current order', '1 is the top position, then 2, 3 and so on.'],
        ['Upload even if your headings are different', 'Gorra will match familiar columns and only ask when it is not sure.'],
      ],
    }
  }

  if (workspace.scenario === 'multiple-ladders') {
    return {
      title: 'How to prepare multiple ladders',
      intro: 'One file can carry more than one ladder.',
      steps: [
        ['Use one row for each ladder position', 'Use First Name, Last Name, Email, Ladder, Position and Year of Entry.'],
        ['Repeat a player when they belong to another ladder', 'Gorra uses the email or member number to recognise the same club record.'],
        ['Keep the official ladder names if you can', 'Small differences can be cleaned during import.'],
        ['Review before adding', 'Gorra shows conflicts such as duplicate positions instead of guessing.'],
      ],
    }
  }

  return {
    title: 'How to prepare a member list',
    intro: 'You can use the spreadsheet your club already has.',
    steps: [
      ['Keep one person on each row', 'Use a clear member name on every row.'],
      ['Use clear member columns', 'First Name, Last Name, Email and Year of Entry are the best starting point.'],
      ['Do not rebuild a messy file just for Gorra', 'Upload it first. If Gorra is unsure about a column, choose the right one in the table header.'],
      ['Save as Excel or CSV', 'Then upload the file and check the players before anything is added.'],
    ],
  }
})

function resetWorkspace(nextScenario = scenario.value || 'members-only') {
  Object.assign(workspace, {
    scenario: nextScenario,
    fileName: '',
    sheetName: '',
    sheetCount: 1,
    headerIndex: 0,
    headers: [],
    rows: [],
    mappings: {},
    mappingSources: {},
    fixes: [],
    suggestedScenario: nextScenario,
    detectedLadders: [],
    looksLikePeople: true,
    oneLadderName: workspace.oneLadderName || '',
  })
  query.value = ''
  columnFilter.value = 'all'
  manualScenarioOverride.value = false
}

function chooseScenario(value) {
  resetWorkspace(value)
  stage.value = 'prepare'
  router.replace({
    name: 'ClubMemberImport',
    query: { scenario: value },
  })
}

function back() {
  if (stage.value === 'scenario') {
    router.push({ name: 'ClubMembers' })
    return
  }

  if (stage.value === 'review' || stage.value === 'mismatch' || stage.value === 'unrecognized') {
    changeFile()
    return
  }

  router.replace({ name: 'ClubMemberImport' })
  stage.value = 'scenario'
}

function sourceOptions(fieldKey) {
  return importSourceOptionsForTarget(workspace, fieldKey)
}

function targetSource(fieldKey) {
  return importTargetSourceIndex(workspace, fieldKey)
}

function mapTarget(fieldKey, value) {
  remapImportTarget(workspace, fieldKey, value === '' ? null : Number(value))
}

function extraTargetValue(sourceIndex) {
  return workspace.mappings[sourceIndex] || ''
}


function mapExtra(sourceIndex, targetKey) {
  const current = workspace.mappings[sourceIndex]
  if (current) remapImportTarget(workspace, current, null)
  if (targetKey) remapImportTarget(workspace, targetKey, sourceIndex)
}

function cellValue(column, row) {
  if (column.type === 'extra') return row[column.extra.index] ?? ''
  const index = targetSource(column.field.key)
  return index === null ? '' : row[index] ?? ''
}

function changeCell(column, rowIndex, value) {
  if (column.type !== 'field') return
  const sourceIndex = targetSource(column.field.key)
  if (sourceIndex === null) return
  workspace.rows[rowIndex][sourceIndex] = value
}

function cellState(column, rowIndex) {
  if (column.type !== 'field') return null
  return importCellIssue(workspace, column.field, rowIndex)
}

function rowHasRequiredError(rowIndex) {
  return fields.value.some((field) => importCellIssue(workspace, field, rowIndex)?.blocking)
}

function applyAnalysis(analysis) {
  Object.assign(workspace, analysis)
  workspace.scenario = scenario.value || workspace.scenario || 'members-only'

  if (
    workspace.scenario === 'one-ladder' &&
    !workspace.oneLadderName &&
    analysis.detectedLadders?.length === 1
  ) {
    workspace.oneLadderName = analysis.detectedLadders[0]
  }

  if (!analysis.looksLikePeople) {
    stage.value = 'unrecognized'
    return
  }

  if (
    !manualScenarioOverride.value &&
    analysis.suggestedScenario &&
    analysis.suggestedScenario !== workspace.scenario
  ) {
    stage.value = 'mismatch'
    return
  }

  stage.value = 'review'
}

function analysisScore(analysis) {
  if (!analysis?.ok) return -1
  const mapped = Object.values(analysis.mappings || {}).filter(Boolean).length
  return (analysis.looksLikePeople ? 40 : 0) + mapped * 10 + Math.min(analysis.rows?.length || 0, 100) / 10
}

async function readXlsx(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const signature = new Uint8Array(buffer.slice(0, 2))

  if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
    throw new Error('That does not look like a valid Excel file.')
  }

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
  })

  let best = null

  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    })

    const analysis = analyseMemberImportMatrix(rows, {
      scenario: workspace.scenario,
      fileName: file.name,
      sheetName,
      sheetCount: workbook.SheetNames.length,
    })

    if (!best || analysisScore(analysis) > analysisScore(best)) best = analysis
  })

  return best
}

async function processFile(file) {
  error.value = ''
  if (!file) return

  const extension = String(file.name || '').toLowerCase().split('.').pop()
  if (!['csv', 'xlsx'].includes(extension)) {
    error.value = 'Use a CSV or Excel (.xlsx) file.'
    return
  }

  if (file.size > MEMBER_IMPORT_MAX_BYTES) {
    error.value = 'Choose a file smaller than 5 MB.'
    return
  }

  busy.value = true

  try {
    const analysis =
      extension === 'xlsx'
        ? await readXlsx(file)
        : analyseMemberImportMatrix(parseDelimitedSpreadsheet(await file.text()), {
            scenario: workspace.scenario,
            fileName: file.name,
          })

    if (!analysis?.ok) throw new Error(analysis?.error || 'We could not read that list.')
    applyAnalysis(analysis)
  } catch (fileError) {
    error.value = fileError?.message || 'We could not read that list.'
  } finally {
    busy.value = false
  }
}

function chooseFile(event) {
  processFile(event.target.files?.[0])
  event.target.value = ''
}

function handleDrop(event) {
  dragging.value = false
  processFile(event.dataTransfer?.files?.[0])
}

function openPaste() {
  pasteText.value = ''
  pasteDialog.value?.showModal()
}

function usePastedSpreadsheet() {
  const rows = parseDelimitedSpreadsheet(pasteText.value)
  const analysis = analyseMemberImportMatrix(rows, {
    scenario: workspace.scenario,
    fileName: 'Pasted spreadsheet',
  })

  if (!analysis.ok) {
    error.value = analysis.error
    return
  }

  pasteDialog.value?.close()
  applyAnalysis(analysis)
}

function useSuggestedScenario() {
  const next = workspace.suggestedScenario
  if (!MEMBER_IMPORT_SCENARIOS[next]) return
  workspace.scenario = next
  manualScenarioOverride.value = true
  if (next === 'one-ladder' && !workspace.oneLadderName && workspace.detectedLadders.length === 1) {
    workspace.oneLadderName = workspace.detectedLadders[0]
  }
  router.replace({
    name: 'ClubMemberImport',
    query: { scenario: next },
  })
  stage.value = 'review'
}

function keepChosenScenario() {
  manualScenarioOverride.value = true
  stage.value = 'review'
}

function changeFile() {
  const keepScenario = workspace.scenario
  const keepLadder = workspace.oneLadderName
  resetWorkspace(keepScenario)
  workspace.oneLadderName = keepLadder
  stage.value = 'prepare'
  error.value = ''
}

function templateHeaders() {
  return importScenarioTemplate(workspace.scenario)
}

function templateBaseName() {
  return `${workspace.scenario}-gorra-template`
}

function downloadTemplateCsv() {
  const headers = templateHeaders()
  const csv = `${headers
    .map((header) => `"${String(header).replaceAll('"', '""')}"`)
    .join(',')}\r\n`

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8',
  })

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `${templateBaseName()}.csv`

  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)

  templateDialog.value?.close()
}

async function downloadTemplateXlsx() {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([templateHeaders()])
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, sheet, 'Gorra import')
  XLSX.writeFile(workbook, `${templateBaseName()}.xlsx`)

  templateDialog.value?.close()
}

async function copyTemplateHeadings() {
  await navigator.clipboard.writeText(templateHeaders().join('\t'))

  notificationStore.addToast({
    message: 'Template headings copied.',
    type: 'success',
  })

  templateDialog.value?.close()
}

async function confirmImport() {
  if (health.value.blocking || busy.value) return
  error.value = ''
  busy.value = true

  try {
    const draft = buildMemberImportDraft(workspace)
    const merged = await adminStore.importMemberData(draft)

    const parts = []
    if (merged.addedCount) parts.push(`${merged.addedCount} added`)
    if (merged.updatedCount) parts.push(`${merged.updatedCount} existing record${merged.updatedCount === 1 ? '' : 's'} completed`)
    if (merged.addedLadderCount) parts.push(`${merged.addedLadderCount} ladder${merged.addedLadderCount === 1 ? '' : 's'} created`)

    notificationStore.addToast({
      message: parts.join(' · ') || 'Club data is up to date.',
      type: 'success',
    })

    await router.push({ name: 'ClubMembers' })
  } catch (importError) {
    error.value = importError?.message || 'We could not add this club data.'
  } finally {
    busy.value = false
  }
}

watch(
  scenario,
  (value) => {
    if (!value) {
      stage.value = 'scenario'
      return
    }

    if (workspace.scenario !== value || stage.value === 'scenario') {
      resetWorkspace(value)
      stage.value = 'prepare'
    }
  },
  { immediate: true },
)

onMounted(async () => {
  try {
    await adminStore.loadClubs()
  } catch (loadError) {
    error.value = loadError?.message || 'We could not open this club.'
  }
})
const importPageCopy = computed(() => {
  const optional =
    'Optional fields: phone, gender, date of birth, playing level, rating and member / reference number.'

  if (workspace.scenario === 'one-ladder') {
    return {
      title: 'Import your member list',
      required: ['first name', 'last name', 'email', 'position', 'year of entry'],
      optional,
    }
  }

  if (workspace.scenario === 'multiple-ladders') {
    return {
      title: 'Import your member list',
      required: [
        'first name',
        'last name',
        'email',
        'ladder',
        'position',
        'year of entry',
      ],
      optional,
    }
  }

  return {
    title: 'Import your member list',
    required: ['first name', 'last name', 'email', 'year of entry'],
    optional,
  }
})

function requiredJoiner(index, length) {
  if (index === length - 1) return ''
  if (index === length - 2) return ' and '
  return ', '
}

const importModeCrumb = computed(
  () => MEMBER_IMPORT_SCENARIOS[workspace.scenario]?.title || '',
)

useShellNestedHeader(() => {
  const crumbs = [
    { label: 'Club', to: { name: 'Club' } },
    { label: 'Members', to: { name: 'ClubMembers' } },
    { label: 'Import' },
  ]

  if (stage.value !== 'scenario' && importModeCrumb.value) {
    crumbs.push({ label: importModeCrumb.value })
  }

  if (stage.value === 'review') {
    crumbs.push({ label: 'Review' })
  }

  return {
    label:
      stage.value === 'scenario'
        ? 'Back to members'
        : stage.value === 'prepare'
          ? 'Back to import types'
          : 'Back to upload',
    back,
    crumbs,
  }
})
</script>

<template>
  <main class="gorra-club-ref ref-page">

    <p v-if="error" class="ref-inline-alert" role="alert">{{ error }}</p>

    <header
      v-if="stage !== 'scenario'"
      class="ref-import-page-head"
    >
      <div class="ref-import-head-copy">
        <h1>{{ importPageCopy.title }}</h1>

        <p class="ref-import-required-copy">
          Upload your CSV. We need
          <template
            v-for="(label, index) in importPageCopy.required"
            :key="label"
          >
            <strong>{{ label }}</strong>{{ requiredJoiner(index, importPageCopy.required.length) }}
          </template>.
        </p>

        <p class="ref-import-optional-copy">
          {{ importPageCopy.optional }}
        </p>

        <button
          class="ref-import-template-link"
          type="button"
          @click="templateDialog?.showModal()"
        >
          <FlowIcon name="download" />
          <span>Download template</span>
          <FlowIcon name="chevron-down" />
        </button>
      </div>

      <button
        class="ref-how-to-button"
        type="button"
        aria-label="How to prepare this file"
        title="How to prepare this file"
        @click="helpDialog?.showModal()"
      >
        <FlowIcon name="help" />
      </button>
    </header>

    <section v-if="stage === 'scenario'" class="ref-import-choice">
      <header class="ref-page-head">
        <div class="ref-page-head-main">
          <h1>What are you bringing in?</h1>
          <p>Choose what is already in your file.</p>
        </div>
      </header>

      <div class="ref-choice-stack">
        <button
          v-for="item in Object.values(MEMBER_IMPORT_SCENARIOS)"
          :key="item.id"
          class="ref-import-type-row"
          type="button"
          @click="chooseScenario(item.id)"
        >
          <span class="ref-feature-icon" aria-hidden="true">
            <FlowIcon :name="item.id === 'members-only' ? 'users' : item.id === 'one-ladder' ? 'ordered-list' : 'layers'" />
          </span>
          <span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.copy }}</small>
          </span>
          <FlowIcon name="arrow-right" />
        </button>
      </div>
    </section>

    <section v-else-if="stage === 'prepare'" class="ref-page-narrow">
      <label
        v-if="workspace.scenario === 'one-ladder'"
        class="ref-form-field ref-one-ladder-context"
      >
        <span>Which ladder is this list for?</span>

        <input
          v-model="workspace.oneLadderName"
          type="text"
          maxlength="70"
          placeholder="Men's Singles"
          required
        />

        <small>
          Examples: Men's Singles, Women's Singles, Open Doubles.
          Set it once here — your file does not need a Ladder column.
        </small>
      </label>

      <section
        class="ref-import-empty-state"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <MemberListArt
          :variant="
            workspace.scenario === 'one-ladder'
              ? 'one-ladder'
              : workspace.scenario === 'multiple-ladders'
                ? 'multiple-ladders'
                : 'members'
          "
        />

        <div class="ref-import-empty-actions">
          <button
            class="ref-button primary"
            type="button"
            :disabled="busy"
            @click="fileInput?.click()"
          >
            {{ busy ? 'Reading…' : 'Choose file' }}
          </button>

          <button
            class="ref-button"
            type="button"
            :disabled="busy"
            @click="openPaste"
          >
            Paste spreadsheet
          </button>
        </div>

        <div class="ref-import-drop-note">
          CSV or Excel (.xlsx) · up to 5 MB · you review everything before it is added
        </div>

        <input
          ref="fileInput"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          @change="chooseFile"
        />
      </section>
    </section>

    <section v-else-if="stage === 'unrecognized'" class="ref-page-narrow">
      <header class="ref-section-heading">
        <div class="ref-page-head-main">
          <h2>This does not look like a member list yet.</h2>
          <p>Gorra could not confidently find people in this file. Try a different sheet or paste the rows directly.</p>
        </div>
      </header>

      <div class="ref-form-actions" style="justify-content: flex-start">
        <button class="ref-button" type="button" @click="changeFile">Choose another file</button>
        <button class="ref-button primary" type="button" @click="openPaste">Paste spreadsheet</button>
      </div>
    </section>

    <section v-else-if="stage === 'mismatch'" class="ref-page-narrow">
      <header class="ref-section-heading">
        <div class="ref-page-head-main">
          <h2>
            {{
              workspace.suggestedScenario === 'multiple-ladders'
                ? 'Gorra found multiple ladders.'
                : 'Gorra found ladder positions.'
            }}
          </h2>
          <p>You can use that information now or keep importing members only.</p>
        </div>
      </header>

      <div class="ref-choice-stack">
        <button class="ref-choice-row" type="button" @click="useSuggestedScenario">
          <span class="ref-feature-icon"><FlowIcon name="ladder" /></span>
          <span class="ref-choice-row-copy">
            <strong>
              {{
                workspace.suggestedScenario === 'multiple-ladders'
                  ? 'Use the ladder information'
                  : 'Import this ladder too'
              }}
            </strong>
            <span>Keep the positions already in your file.</span>
          </span>
          <FlowIcon name="arrow-right" />
        </button>

        <button class="ref-choice-row" type="button" @click="keepChosenScenario">
          <span class="ref-feature-icon"><FlowIcon name="users" /></span>
          <span class="ref-choice-row-copy">
            <strong>Keep {{ schema.title.toLowerCase() }}</strong>
            <span>Ignore the extra ladder information for this import.</span>
          </span>
          <FlowIcon name="arrow-right" />
        </button>
      </div>
    </section>

    <section v-else class="ref-import-review">
      <div class="ref-import-file-meta">
        <span>{{ workspace.fileName }}</span>

        <button
          class="ref-text-action"
          type="button"
          @click="changeFile"
        >
          Change file
        </button>
      </div>

      <label
        v-if="workspace.scenario === 'one-ladder'"
        class="ref-form-field"
        style="max-width: 420px; margin-bottom: 14px"
      >
        <span>Ladder name</span>
        <input v-model="workspace.oneLadderName" type="text" maxlength="70" />
      </label>

      <div class="ref-import-toolbar">
        <div class="ref-search">
          <FlowIcon name="search" />
          <input
            v-model="query"
            type="search"
            autocomplete="off"
            placeholder="Search this list"
            aria-label="Search imported rows"
          />
          <button
            v-if="query"
            class="ref-search-clear"
            type="button"
            aria-label="Clear search"
            @click="query = ''"
          >
            <FlowIcon name="close" />
          </button>
          <span v-else></span>
        </div>

        <div class="ref-import-column-filter">
          <label for="import-column-filter">Columns</label>
          <select id="import-column-filter" v-model="columnFilter">
            <option value="all">All columns</option>
            <option value="required">Required</option>
            <option value="optional">Optional</option>
            <option value="extra">Not importing</option>
          </select>
        </div>
      </div>

      <div class="ref-import-grid">
        <div class="ref-import-scroll">
          <table class="ref-import-table">
            <thead>
              <tr>
                <th class="ref-import-number-head" aria-label="Row"></th>

                <th
                  v-for="column in displayedColumns"
                  :key="column.key"
                  :class="{
                    'ref-import-head-missing':
                      column.type === 'field' &&
                      column.field.required &&
                      targetSource(column.field.key) === null,
                    'ref-import-extra-head': column.type === 'extra',
                  }"
                >
                  <template v-if="column.type === 'field'">
                    <div class="ref-import-field-top">
                      <strong>{{ column.field.label }}</strong>
                      <span>{{ column.field.required ? 'Required' : 'Optional' }}</span>
                    </div>

                    <div class="ref-import-source">
                      <label>From</label>
                      <select
                        :value="targetSource(column.field.key) ?? ''"
                        @change="mapTarget(column.field.key, $event.target.value)"
                      >
                        <option value="">Choose column</option>
                        <option
                          v-for="option in sourceOptions(column.field.key)"
                          :key="option.index"
                          :value="option.index"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </div>
                  </template>

                  <template v-else>
                    <div class="ref-import-field-top">
                      <strong>{{ column.extra.header || `Column ${column.extra.index + 1}` }}</strong>
                      <span>Not importing</span>
                    </div>

                    <div class="ref-import-source">
                      <label>Use as</label>
                      <select
                        :value="extraTargetValue(column.extra.index)"
                        @change="mapExtra(column.extra.index, $event.target.value)"
                      >
                        <option
                          v-for="[key, label] in MEMBER_IMPORT_FIELD_OPTIONS"
                          :key="key || 'none'"
                          :value="key"
                        >
                          {{ label }}
                        </option>
                      </select>
                    </div>
                  </template>
                </th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="{ row, index } in displayedRows"
                :key="index"
                :class="{ 'required-error': rowHasRequiredError(index) }"
              >
                <td class="ref-import-number">{{ index + 1 }}</td>

                <td
                  v-for="column in displayedColumns"
                  :key="column.key"
                  class="ref-import-cell"
                  :class="{
                    extra: column.type === 'extra',
                    'required-error': cellState(column, index)?.blocking,
                    'optional-warning': cellState(column, index)?.warning,
                  }"
                  :title="cellState(column, index)?.message || ''"
                >
                  <input
                    :value="cellValue(column, row)"
                    type="text"
                    :readonly="column.type === 'extra'"
                    @input="changeCell(column, index, $event.target.value)"
                  />

                  <span
                    v-if="cellState(column, index)"
                    class="ref-cell-marker"
                    :class="cellState(column, index).blocking ? 'required' : 'optional'"
                    aria-hidden="true"
                  ></span>
                </td>
              </tr>

              <tr v-if="!displayedRows.length">
                <td :colspan="displayedColumns.length + 1" class="ref-member-empty">
                  No rows match this search.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer class="ref-import-footer">
          <div class="ref-import-footer-copy" aria-live="polite">
            <strong>{{ footer.strong }}</strong>
            <span v-if="footer.detail"> {{ footer.detail }}</span>
          </div>

          <div class="ref-import-footer-actions">
            <button class="ref-button" type="button" @click="changeFile">Change file</button>
            <button
              class="ref-button primary"
              type="button"
              :disabled="health.blocking || busy"
              @click="confirmImport"
            >
              {{ importActionLabel }}
            </button>
          </div>
        </footer>
      </div>

      <p v-if="workspace.fixes.length" class="ref-import-fixes">
        {{ workspace.fixes.join(' · ') }}
      </p>
    </section>

    <dialog ref="templateDialog" class="ref-dialog">
      <div class="ref-dialog-inner">
        <header class="ref-dialog-head">
          <div>
            <h2>Download template</h2>
            <p>Use whichever file your club already works with.</p>
          </div>

          <button
            class="ref-dialog-close"
            type="button"
            aria-label="Close"
            @click="templateDialog?.close()"
          >
            <FlowIcon name="close" />
          </button>
        </header>

        <div class="ref-template-download-options">
          <button
            class="ref-template-download-option"
            type="button"
            @click="downloadTemplateXlsx"
          >
            <span class="ref-feature-icon">
              <FlowIcon name="file-spreadsheet" />
            </span>
            <span>
              <strong>Excel</strong>
              <small>.xlsx · recommended</small>
            </span>
            <FlowIcon name="download" />
          </button>

          <button
            class="ref-template-download-option"
            type="button"
            @click="downloadTemplateCsv"
          >
            <span class="ref-feature-icon">
              <FlowIcon name="file-text" />
            </span>
            <span>
              <strong>CSV</strong>
              <small>.csv · works everywhere</small>
            </span>
            <FlowIcon name="download" />
          </button>

          <button
            class="ref-template-download-option"
            type="button"
            @click="copyTemplateHeadings"
          >
            <span class="ref-feature-icon">
              <FlowIcon name="copy" />
            </span>
            <span>
              <strong>Copy headings</strong>
              <small>Paste into an existing sheet</small>
            </span>
            <FlowIcon name="arrow-right" />
          </button>
        </div>
      </div>
    </dialog>

    <dialog ref="pasteDialog" class="ref-dialog">
      <div class="ref-dialog-inner">
        <header class="ref-dialog-head">
          <div>
            <h2>Paste spreadsheet</h2>
            <p>Copy rows from Excel, Google Sheets or another spreadsheet and paste them here.</p>
          </div>
          <button class="ref-dialog-close" type="button" aria-label="Close" @click="pasteDialog?.close()">
            <FlowIcon name="close" />
          </button>
        </header>

        <label class="ref-form-field">
          <span>Spreadsheet rows</span>
          <textarea
            v-model="pasteText"
            rows="10"
            spellcheck="false"
            placeholder="First Name&#9;Last Name&#9;Email..."
          ></textarea>
        </label>

        <footer class="ref-form-actions">
          <button class="ref-button" type="button" @click="pasteDialog?.close()">Cancel</button>
          <button class="ref-button primary" type="button" :disabled="!pasteText.trim()" @click="usePastedSpreadsheet">
            Use this list
          </button>
        </footer>
      </div>
    </dialog>

    <dialog ref="helpDialog" class="ref-dialog">
      <div class="ref-dialog-inner">
        <header class="ref-dialog-head">
          <div>
            <h2>{{ helpCopy.title }}</h2>
            <p>{{ helpCopy.intro }}</p>
          </div>
          <button class="ref-dialog-close" type="button" aria-label="Close" @click="helpDialog?.close()">
            <FlowIcon name="close" />
          </button>
        </header>

        <ol style="display: grid; gap: 0; margin: 0; padding: 0; list-style: none">
          <li
            v-for="(stepItem, index) in helpCopy.steps"
            :key="stepItem[0]"
            style="display: grid; grid-template-columns: 26px minmax(0,1fr); gap: 13px; padding: 16px 0; border-top: 1px solid #edf0ed"
          >
            <span class="ref-feature-icon" style="width:24px;height:24px;flex-basis:24px;font-size:9px">
              {{ index + 1 }}
            </span>
            <div>
              <strong style="font-size:12px">{{ stepItem[0] }}</strong>
              <p class="ref-inline-note" style="margin:4px 0 0">{{ stepItem[1] }}</p>
            </div>
          </li>
        </ol>
      </div>
    </dialog>
  </main>
</template>
