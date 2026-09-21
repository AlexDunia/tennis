<script setup>
import {
  computed,
  onMounted,
  ref,
} from 'vue'
import {
  useRoute,
  useRouter,
} from 'vue-router'
import * as XLSX from 'xlsx'
import BaseButton from '../components/BaseButton.vue'
import FlowIcon from '../components/friendly/FlowIcon.vue'
import MemberListArt from '../components/club/MemberListArt.vue'
import { useAdminStore } from '../stores/admin.js'
import { useNotificationStore } from '../stores/notification.js'
import {
  ladderRequirementsLabel,
  normalizeLadderEligibility,
} from '../domain/ladderWorkspace.js'
import {
  normalizePlayerRatingValue,
  playerRatingOptions,
  playerRatingSystem,
  playerRatingValueLabel,
} from '../domain/playerRatings.js'
import {
  ladderImportReadMeRows,
  ladderImportTemplateHeaders,
  spreadsheetRowsForLadder,
} from '../services/LadderImportService.js'
import {
  LADDER_IMPORT_ORIGINS,
  ladderImportBackRoute,
  normalizeLadderImportOrigin,
} from '../utils/ladderImportNavigation.js'
import { sanitizeDirectoryId } from '../utils/admin/clubSetup.js'
import { sanitizePlainText } from '../utils/formSafety.js'
import { useShellNestedHeader } from '../composables/useShellNestedHeader.js'
import '../assets/ladder-workspace.css'

const MAX_FILE_BYTES =
  5 * 1024 * 1024

const props = defineProps({ ladderId: { type: String, default: '' }, embedded: { type: Boolean, default: false } })
const emit = defineEmits(['back', 'complete'])

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const notificationStore = useNotificationStore()

const ready = ref(false)
const busy = ref(false)
const checking = ref(false)
const error = ref('')
const fileName = ref('')
const rows = ref([])
const preview = ref(null)
const fileInput = ref(null)
const showReady = ref(false)

const resolutions = ref({})
const skippedRowIds = ref([])

const ladderId = computed(() =>
  String(
    props.ladderId || route.params.ladderId ||
      '',
  ),
)

const activeClub = computed(
  () => adminStore.activeClub,
)

const ladder = computed(
  () =>
    activeClub.value?.setup
      ?.ladders?.find(
        (item) =>
          item.id ===
            ladderId.value &&
          !item.archived,
      ) || null,
)

const clubLevels = computed(() =>
  Array.isArray(
    activeClub.value?.setup
      ?.playerLevels?.levels,
  )
    ? activeClub.value.setup
        .playerLevels.levels
    : [],
)

const eligibility = computed(() =>
  normalizeLadderEligibility(
    ladder.value?.eligibility,
  ),
)

const requirements = computed(() =>
  ladderRequirementsLabel(
    ladder.value?.eligibility,
    clubLevels.value,
  ),
)

const importOrigin = computed(() =>
  normalizeLadderImportOrigin(
    String(
      route.query.from ||
        '',
    ),
  ),
)

const backLabel = computed(() =>
  importOrigin.value ===
    LADDER_IMPORT_ORIGINS.SETUP_MEMBERS
    ? 'Back to add people'
    : 'Back to ladder',
)

const templateHeaders = computed(() =>
  ladderImportTemplateHeaders(
    ladder.value,
  ),
)

const ratingSystem = computed(() =>
  eligibility.value.skill
    .mode === 'rating'
    ? playerRatingSystem(
        eligibility.value.skill
          .ratingSystem,
      )
    : null,
)

const ntrpOptions =
  playerRatingOptions('ntrp')

const attentionRows = computed(() =>
  preview.value?.rows?.filter(
    (row) =>
      row.status ===
      'attention',
  ) || [],
)

const ineligibleRows = computed(() =>
  preview.value?.rows?.filter(
    (row) =>
      row.status ===
      'ineligible',
  ) || [],
)

const readyRows = computed(() =>
  preview.value?.rows?.filter(
    (row) =>
      row.status ===
      'ready',
  ) || [],
)

const skippedRows = computed(() =>
  preview.value?.rows?.filter(
    (row) =>
      row.status ===
      'skipped',
  ) || [],
)

function rowInput(rowId) {
  return rows.value.find(
    (row) =>
      row.rowId === rowId,
  )
}

function currentRatingValue(row) {
  if (!ratingSystem.value) {
    return ''
  }

  const raw =
    rowInput(row.rowId)
      ?.ratings?.[
        ratingSystem.value.id
      ]

  const value =
    normalizePlayerRatingValue(
      ratingSystem.value.id,
      raw?.value ?? raw,
    )

  return value === null
    ? ''
    : value
}

function resolutionFieldFor(
  field,
) {
  if (
    field === 'rating' &&
    ratingSystem.value
  ) {
    return `rating:${ratingSystem.value.id}`
  }

  if (field === 'clubLevel') {
    return 'clubLevelId'
  }

  return field
}

async function refreshPreview() {
  if (!rows.value.length) {
    preview.value = null
    return
  }

  checking.value = true
  error.value = ''

  try {
    preview.value =
      await adminStore.previewLadderImport(
        ladderId.value,
        rows.value,
        {
          resolutions:
            resolutions.value,
          skippedRowIds:
            skippedRowIds.value,
        },
      )
  } catch (previewError) {
    preview.value = null
    error.value =
      previewError?.message ||
      'Unable to review this Ladder import.'
  } finally {
    checking.value = false
  }
}

function setRowField(
  rowId,
  field,
  value,
) {
  const row = rowInput(rowId)

  if (!row) return

  if (field === 'rating') {
    const system =
      ratingSystem.value

    if (!system) return

    row.rawRating = String(
      value ?? '',
    )

    row.ratingInvalid = false

    row.ratings = {
      ...(row.ratings || {}),
      [system.id]: value,
    }

    resolutions.value = {
      ...resolutions.value,
      [`${rowId}:rating:${system.id}`]:
        'incoming',
    }
  } else if (
    field === 'clubLevelId'
  ) {
    row.clubLevelId =
      sanitizeDirectoryId(
        value,
      )

    row.clubLevelInvalid = false

    resolutions.value = {
      ...resolutions.value,
      [`${rowId}:clubLevelId`]:
        'incoming',
    }
  } else if (
    field === 'gender'
  ) {
    row.gender = value
    row.rawGender = value
    row.genderInvalid = false

    resolutions.value = {
      ...resolutions.value,
      [`${rowId}:gender`]:
        'incoming',
    }
  } else if (
    field === 'dob'
  ) {
    row.dob = value
    row.rawDob = value
    row.dateAmbiguous = false
    row.dateOptions = []
    row.dateInvalid = false

    resolutions.value = {
      ...resolutions.value,
      [`${rowId}:dob`]:
        'incoming',
    }
  } else if (
    field === 'position'
  ) {
    row.position =
      Number.parseInt(
        value,
        10,
      )
  } else {
    row[field] = value
  }

  refreshPreview()
}

function chooseAmbiguousDate(
  rowId,
  value,
) {
  setRowField(
    rowId,
    'dob',
    value,
  )
}

function resolveConflict(
  issue,
  decision,
) {
  if (
    !issue?.resolutionKey ||
    ![
      'keep',
      'incoming',
    ].includes(decision)
  ) {
    return
  }

  resolutions.value = {
    ...resolutions.value,
    [issue.resolutionKey]:
      decision,
  }

  refreshPreview()
}

function skipRow(rowId) {
  const safe =
    sanitizeDirectoryId(
      rowId,
    )

  if (!safe) return

  skippedRowIds.value = [
    ...new Set([
      ...skippedRowIds.value,
      safe,
    ]),
  ]

  refreshPreview()
}

function unskipRow(rowId) {
  skippedRowIds.value =
    skippedRowIds.value.filter(
      (value) =>
        value !== rowId,
    )

  refreshPreview()
}

async function readFile(file) {
  if (!file) return

  error.value = ''
  preview.value = null
  rows.value = []
  resolutions.value = {}
  skippedRowIds.value = []

  if (
    file.size >
    MAX_FILE_BYTES
  ) {
    error.value =
      'Use a file smaller than 5 MB.'

    return
  }

  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase()

  if (
    ![
      'csv',
      'xlsx',
      'xls',
    ].includes(extension)
  ) {
    error.value =
      'Use a CSV or Excel file.'

    return
  }

  busy.value = true

  try {
    const buffer =
      await file.arrayBuffer()

    const workbook =
      XLSX.read(
        buffer,
        {
          type: 'array',
          cellFormula: false,
          cellHTML: false,
          cellNF: false,
          cellStyles: false,
        },
      )

    const firstSheet =
      workbook.SheetNames[0]

    if (!firstSheet) {
      throw new Error(
        'This file has no worksheet.',
      )
    }

    const rawRows =
      XLSX.utils.sheet_to_json(
        workbook.Sheets[
          firstSheet
        ],
        {
          defval: '',
          raw: false,
        },
      )

    const normalized =
      spreadsheetRowsForLadder(
        rawRows,
        {
          ladder:
            ladder.value,
          clubLevels:
            clubLevels.value,
        },
      )

    if (!normalized.length) {
      throw new Error(
        'No player rows were found. Keep one player per row and use headings in the first row.',
      )
    }

    rows.value = normalized

    fileName.value =
      sanitizePlainText(
        file.name,
        180,
      )

    await refreshPreview()
  } catch (readError) {
    rows.value = []
    preview.value = null
    fileName.value = ''

    error.value =
      readError?.message ||
      'Unable to read this file.'
  } finally {
    busy.value = false
  }
}

function chooseFile(event) {
  const file =
    event.target.files?.[0]

  readFile(file)

  event.target.value = ''
}

async function copyHeadings() {
  try {
    await navigator.clipboard.writeText(
      templateHeaders.value.join(
        '\t',
      ),
    )

    notificationStore.addToast({
      message:
        'Ladder headings copied.',
      type: 'success',
    })
  } catch {
    notificationStore.addToast({
      message:
        templateHeaders.value.join(
          ' Â· ',
        ),
      type: 'info',
    })
  }
}

function safeFileBase() {
  return (
    sanitizeDirectoryId(
      ladder.value?.name,
      'ladder',
    ) || 'ladder'
  )
}

function downloadTemplate() {
  if (!ladder.value) return

  const workbook =
    XLSX.utils.book_new()

  const players =
    XLSX.utils.aoa_to_sheet([
      templateHeaders.value,
    ])

  players['!cols'] =
    templateHeaders.value.map(
      (header) => ({
        wch:
          header === 'Email'
            ? 30
            : Math.max(
                16,
                header.length + 4,
              ),
      }),
    )

  XLSX.utils.book_append_sheet(
    workbook,
    players,
    'Players',
  )

  const readMe =
    XLSX.utils.aoa_to_sheet(
      ladderImportReadMeRows({
        ladder:
          ladder.value,
        requirementsLabel:
          requirements.value,
      }),
    )

  readMe['!cols'] = [
    { wch: 24 },
    { wch: 100 },
  ]

  XLSX.utils.book_append_sheet(
    workbook,
    readMe,
    'Read me',
  )

  XLSX.writeFile(
    workbook,
    `${safeFileBase()}-gorra-template.xlsx`,
  )
}

function changeFile() {
  rows.value = []
  preview.value = null
  fileName.value = ''
  resolutions.value = {}
  skippedRowIds.value = []
  error.value = ''
}

async function applyImport() {
  if (
    busy.value ||
    !preview.value?.canApply
  ) {
    return
  }

  busy.value = true
  error.value = ''

  try {
    const result =
      await adminStore.importLadder(
        ladderId.value,
        rows.value,
        {
          resolutions:
            resolutions.value,
          skippedRowIds:
            skippedRowIds.value,
        },
      )

    notificationStore.addToast({
      title: 'Ladder imported',
      message:
        `${result.summary.imported} ${result.summary.imported === 1 ? 'player is' : 'players are'} ready on ${result.ladder.name}.`,
      type: 'success',
    })
    if (props.embedded) {
      emit('complete', result)
      return
    }


    if (
      result.ladder.status ===
      'active'
    ) {
      await router.push({
        name: 'Rankings',
        query: {
          ladder:
            result.ladder.id,
        },
      })

      return
    }

    await router.push({
      name: 'LadderSetup',
      params: {
        ladderId:
          ladderId.value,
        step: 'order',
      },
      query: {
        from: 'import',
        returnTo:
          importOrigin.value,
      },
    })
  } catch (importError) {
    error.value =
      importError?.message ||
      'Unable to import this Ladder.'
  } finally {
    busy.value = false
  }
}

function leaveImport() {
  if (props.embedded) { emit('back'); return }
  return router.push(
    ladderImportBackRoute({
      origin:
        importOrigin.value,
      ladderId:
        ladderId.value,
    }),
  )
}

function rowEditField(row) {
  const reason =
    row?.eligibilityResult
      ?.reason

  if (reason === 'gender') {
    return 'gender'
  }

  if (reason === 'age') {
    return 'dob'
  }

  if (reason === 'skill') {
    return 'clubLevelId'
  }

  if (reason === 'rating') {
    return 'rating'
  }

  return ''
}

function issueInputField(issue) {
  if (!issue) return ''

  if (
    issue.field === 'clubLevel'
  ) {
    return 'clubLevelId'
  }

  if (
    issue.field === 'rating' ||
    issue.field?.startsWith(
      'rating:',
    )
  ) {
    return 'rating'
  }

  return issue.field
}

useShellNestedHeader(() => ({
  label: ladder.value
    ? `Import to ${ladder.value.name}`
    : 'Import ladder',
  backLabel:
    backLabel.value,
  back: leaveImport,
  crumbs: [
    { label: 'Ladder' },
    {
      label:
        ladder.value?.name ||
        'Current ladder',
    },
    { label: 'Import' },
  ],
}))

onMounted(async () => {
  try {
    if (!adminStore.activeClub) {
      await adminStore.loadClubs()
    }

    if (
      !adminStore.hasActiveClubPermission(
        'club.manage',
      )
    ) {
      await router.replace({
        name: 'Rankings',
      })

      return
    }

    if (!ladder.value) {
      error.value =
        'This Ladder could not be found.'
    }
  } catch (loadError) {
    error.value =
      loadError?.message ||
      'Unable to open Ladder import.'
  } finally {
    ready.value = true
  }
})
</script>

<template>
  <main
    v-if="ready && ladder"
    class="ladder-workspace-page gorra-club-ref"
  >
    <header
      class="ladder-workspace-page__header"
    >
      <p
        class="ladder-workspace-page__eyebrow"
      >
        {{ ladder.name }}
      </p>

      <h1>
        Bring your ladder list
      </h1>

      <p
        class="ladder-workspace-page__description"
      >
        {{ requirements }}
      </p>
    </header>

    <p
      v-if="error"
      class="lw-alert"
      role="alert"
    >
      {{ error }}
    </p>

    <template v-if="!preview">
      <section
        class="lw-import-intro"
      >
        <strong>
          Keep your spreadsheet.
        </strong>

        <p>
          Keep one player per row. Rename the first-row headings if needed â€” GORRA checks the rest before anything is added.
        </p>

        <div
          class="lw-import-heading-list"
          aria-label="Suggested spreadsheet headings"
        >
          <span
            v-for="
              heading in
              templateHeaders
            "
            :key="heading"
          >
            {{ heading }}
          </span>
        </div>
      </section>

      <section
        class="ref-import-empty-state lw-import-empty-state"
      >
        <MemberListArt
          variant="one-ladder"
        />

        <div
          class="ref-members-empty-copy"
        >
          <h2>
            Add your current list
          </h2>

          <p>
            Upload the file your club already uses, or start with a template made for this Ladder.
          </p>
        </div>

        <div
          class="lw-import-empty-actions"
        >
          <button
            class="ref-button primary"
            type="button"
            :disabled="busy"
            @click="
              fileInput?.click()
            "
          >
            <FlowIcon
              name="upload"
            />

            {{
              busy
                ? 'Readingâ€¦'
                : 'Choose file'
            }}
          </button>

          <button
            class="ref-button"
            type="button"
            :disabled="busy"
            @click="downloadTemplate"
          >
            <FlowIcon
              name="download"
            />

            Download template
          </button>
        </div>

        <button
          class="ref-text-action lw-import-copy-headings"
          type="button"
          @click="copyHeadings"
        >
          Copy headings
        </button>

        <small>
          CSV or Excel Â· up to 5 MB Â· nothing changes until you confirm
        </small>

        <input
          ref="fileInput"
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          @change="chooseFile"
        />
      </section>
    </template>

    <template v-else>
      <header
        class="lw-import-filebar"
      >
        <span
          class="ref-feature-icon"
          aria-hidden="true"
        >
          <FlowIcon
            name="file-spreadsheet"
          />
        </span>

        <span>
          <strong>
            {{ fileName }}
          </strong>

          <small>
            {{ preview.summary.total }}
            {{
              preview.summary.total === 1
                ? 'player'
                : 'players'
            }}
            found
          </small>
        </span>

        <button
          class="lw-text-button"
          type="button"
          :disabled="busy"
          @click="changeFile"
        >
          Change file
        </button>
      </header>

      <section
        class="lw-import-stats"
        aria-label="Import review summary"
      >
        <div>
          <strong>
            {{ preview.summary.ready }}
          </strong>

          <span>Ready</span>
        </div>

        <div>
          <strong>
            {{ preview.summary.attention }}
          </strong>

          <span>
            Need attention
          </span>
        </div>

        <div>
          <strong>
            {{ preview.summary.ineligible }}
          </strong>

          <span>
            Not eligible
          </span>
        </div>

        <div>
          <strong>
            {{ preview.summary.skipped }}
          </strong>

          <span>Skipped</span>
        </div>
      </section>

      <p
        v-if="preview.hasPositionGap"
        class="lw-note"
      >
        Some uploaded positions will be skipped. That is okay â€” GORRA preserves the remaining relative order and closes the gaps automatically.
      </p>

      <section
        v-if="attentionRows.length"
        class="lw-section"
      >
        <div
          class="lw-section__heading"
        >
          <h2>
            Needs attention
          </h2>

          <p>
            Fix only what GORRA genuinely cannot decide. You do not need to rebuild the spreadsheet.
          </p>
        </div>

        <article
          v-for="
            row in
            attentionRows
          "
          :key="row.rowId"
          class="lw-import-issue"
        >
          <header>
            <div>
              <strong>
                {{
                  row.name ||
                  `Spreadsheet row ${row.sourceRow}`
                }}
              </strong>

              <small>
                {{
                  Number.isInteger(row.position)
                    ? `Position #${row.position}`
                    : 'Position needs attention'
                }}
                <template
                  v-if="row.existingMember"
                >
                  Â· Existing club member
                </template>
              </small>
            </div>

            <button
              class="lw-text-button"
              type="button"
              @click="
                skipRow(row.rowId)
              "
            >
              Skip for now
            </button>
          </header>

          <div
            class="lw-import-issue-list"
          >
            <div
              v-for="
                issue in
                row.issues
              "
              :key="
                `${row.rowId}:${issue.type}:${issue.field}`
              "
              class="lw-import-issue-line"
            >
              <div>
                <strong>
                  {{ issue.label }}
                </strong>

                <span>
                  {{ issue.message }}
                </span>
              </div>

              <div
                v-if="
                  issue.type ===
                  'conflict'
                "
                class="lw-import-conflict"
              >
                <span>
                  Club:
                  <strong>
                    {{
                      issue.currentLabel ||
                      'Not set'
                    }}
                  </strong>
                </span>

                <span>
                  File:
                  <strong>
                    {{
                      issue.incomingLabel ||
                      'Not set'
                    }}
                  </strong>
                </span>

                <div>
                  <button
                    type="button"
                    :class="{
                      active:
                        resolutions[
                          issue.resolutionKey
                        ] ===
                        'keep',
                    }"
                    @click="
                      resolveConflict(
                        issue,
                        'keep',
                      )
                    "
                  >
                    Keep club value
                  </button>

                  <button
                    type="button"
                    :class="{
                      active:
                        resolutions[
                          issue.resolutionKey
                        ] ===
                        'incoming',
                    }"
                    @click="
                      resolveConflict(
                        issue,
                        'incoming',
                      )
                    "
                  >
                    Use uploaded value
                  </button>
                </div>
              </div>

              <div
                v-else-if="
                  issue.options?.length
                "
                class="lw-import-inline-field lw-import-inline-buttons"
              >
                <button
                  v-for="
                    option in
                    issue.options
                  "
                  :key="option"
                  type="button"
                  @click="
                    chooseAmbiguousDate(
                      row.rowId,
                      option,
                    )
                  "
                >
                  {{ option }}
                </button>
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'name'
                "
                class="lw-import-inline-field"
              >
                <input
                  type="text"
                  maxlength="100"
                  :value="
                    rowInput(
                      row.rowId,
                    )?.name ||
                    ''
                  "
                  placeholder="Player name"
                  @change="
                    setRowField(
                      row.rowId,
                      'name',
                      $event.target.value,
                    )
                  "
                />
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'email'
                "
                class="lw-import-inline-field"
              >
                <input
                  type="email"
                  maxlength="254"
                  :value="
                    rowInput(
                      row.rowId,
                    )?.email ||
                    ''
                  "
                  placeholder="Email"
                  @change="
                    setRowField(
                      row.rowId,
                      'email',
                      $event.target.value,
                    )
                  "
                />
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'memberNumber'
                "
                class="lw-import-inline-field"
              >
                <input
                  type="text"
                  maxlength="80"
                  :value="
                    rowInput(
                      row.rowId,
                    )?.memberNumber ||
                    ''
                  "
                  placeholder="Member number"
                  @change="
                    setRowField(
                      row.rowId,
                      'memberNumber',
                      $event.target.value,
                    )
                  "
                />
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'position'
                "
                class="lw-import-inline-field"
              >
                <input
                  type="number"
                  min="1"
                  max="10000"
                  inputmode="numeric"
                  :value="
                    rowInput(
                      row.rowId,
                    )?.position ||
                    ''
                  "
                  placeholder="Position"
                  @change="
                    setRowField(
                      row.rowId,
                      'position',
                      $event.target.value,
                    )
                  "
                />
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'gender'
                "
                class="lw-import-inline-field"
              >
                <select
                  :value="
                    rowInput(
                      row.rowId,
                    )?.gender ||
                    ''
                  "
                  @change="
                    setRowField(
                      row.rowId,
                      'gender',
                      $event.target.value,
                    )
                  "
                >
                  <option value="">
                    Choose gender
                  </option>

                  <option value="men">
                    Man
                  </option>

                  <option value="women">
                    Woman
                  </option>
                </select>
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'dob'
                "
                class="lw-import-inline-field"
              >
                <input
                  type="date"
                  :value="
                    rowInput(
                      row.rowId,
                    )?.dob ||
                    ''
                  "
                  @change="
                    setRowField(
                      row.rowId,
                      'dob',
                      $event.target.value,
                    )
                  "
                />
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                  'clubLevelId'
                "
                class="lw-import-inline-field"
              >
                <select
                  :value="
                    rowInput(
                      row.rowId,
                    )?.clubLevelId ||
                    ''
                  "
                  @change="
                    setRowField(
                      row.rowId,
                      'clubLevelId',
                      $event.target.value,
                    )
                  "
                >
                  <option value="">
                    Choose level
                  </option>

                  <option
                    v-for="
                      level in
                      clubLevels
                    "
                    :key="level.id"
                    :value="level.id"
                  >
                    {{ level.label }}
                  </option>
                </select>
              </div>

              <div
                v-else-if="
                  issueInputField(issue) ===
                    'rating' &&
                  ratingSystem
                "
                class="lw-import-inline-field"
              >
                <select
                  v-if="
                    ratingSystem.id ===
                    'ntrp'
                  "
                  :value="
                    currentRatingValue(
                      row,
                    )
                  "
                  @change="
                    setRowField(
                      row.rowId,
                      'rating',
                      $event.target.value,
                    )
                  "
                >
                  <option value="">
                    Choose NTRP
                  </option>

                  <option
                    v-for="
                      value in
                      ntrpOptions
                    "
                    :key="value"
                    :value="value"
                  >
                    {{
                      playerRatingValueLabel(
                        'ntrp',
                        value,
                      )
                    }}
                  </option>
                </select>

                <input
                  v-else
                  type="number"
                  :min="
                    ratingSystem.minimum
                  "
                  :max="
                    ratingSystem.maximum
                  "
                  :step="
                    ratingSystem.step
                  "
                  :value="
                    currentRatingValue(
                      row,
                    )
                  "
                  :placeholder="
                    ratingSystem.acronym
                  "
                  @change="
                    setRowField(
                      row.rowId,
                      'rating',
                      $event.target.value,
                    )
                  "
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section
        v-if="ineligibleRows.length"
        class="lw-section"
      >
        <div
          class="lw-section__heading"
        >
          <h2>
            Not eligible
          </h2>

          <p>
            These players will not be added unless their information is corrected and they meet this Ladderâ€™s rules.
          </p>
        </div>

        <article
          v-for="
            row in
            ineligibleRows
          "
          :key="row.rowId"
          class="lw-import-ineligible"
        >
          <div>
            <strong>
              {{ row.name }}
            </strong>

            <span>
              {{
                row.eligibilityReason
              }}
            </span>
          </div>

          <div
            v-if="
              rowEditField(row) ===
              'gender'
            "
            class="lw-import-inline-field"
          >
            <select
              :value="
                rowInput(
                  row.rowId,
                )?.gender ||
                ''
              "
              @change="
                setRowField(
                  row.rowId,
                  'gender',
                  $event.target.value,
                )
              "
            >
              <option value="">
                Choose gender
              </option>

              <option value="men">
                Man
              </option>

              <option value="women">
                Woman
              </option>
            </select>
          </div>

          <div
            v-else-if="
              rowEditField(row) ===
              'dob'
            "
            class="lw-import-inline-field"
          >
            <input
              type="date"
              :value="
                rowInput(
                  row.rowId,
                )?.dob ||
                ''
              "
              @change="
                setRowField(
                  row.rowId,
                  'dob',
                  $event.target.value,
                )
              "
            />
          </div>

          <div
            v-else-if="
              rowEditField(row) ===
              'clubLevelId'
            "
            class="lw-import-inline-field"
          >
            <select
              :value="
                rowInput(
                  row.rowId,
                )?.clubLevelId ||
                ''
              "
              @change="
                setRowField(
                  row.rowId,
                  'clubLevelId',
                  $event.target.value,
                )
              "
            >
              <option value="">
                Choose level
              </option>

              <option
                v-for="
                  level in
                  clubLevels
                "
                :key="level.id"
                :value="level.id"
              >
                {{ level.label }}
              </option>
            </select>
          </div>

          <div
            v-else-if="
              rowEditField(row) ===
                'rating' &&
              ratingSystem
            "
            class="lw-import-inline-field"
          >
            <select
              v-if="
                ratingSystem.id ===
                'ntrp'
              "
              :value="
                currentRatingValue(
                  row,
                )
              "
              @change="
                setRowField(
                  row.rowId,
                  'rating',
                  $event.target.value,
                )
              "
            >
              <option value="">
                Choose NTRP
              </option>

              <option
                v-for="
                  value in
                  ntrpOptions
                "
                :key="value"
                :value="value"
              >
                {{
                  playerRatingValueLabel(
                    'ntrp',
                    value,
                  )
                }}
              </option>
            </select>

            <input
              v-else
              type="number"
              :min="
                ratingSystem.minimum
              "
              :max="
                ratingSystem.maximum
              "
              :step="
                ratingSystem.step
              "
              :value="
                currentRatingValue(
                  row,
                )
              "
              @change="
                setRowField(
                  row.rowId,
                  'rating',
                  $event.target.value,
                )
              "
            />
          </div>
        </article>
      </section>

      <section
        v-if="skippedRows.length"
        class="lw-section"
      >
        <details>
          <summary>
            {{ skippedRows.length }}
            skipped
          </summary>

          <div
            class="lw-list"
          >
            <article
              v-for="
                row in
                skippedRows
              "
              :key="row.rowId"
              class="lw-list-row"
            >
              <span>
                <strong>
                  {{
                    row.name ||
                    `Row ${row.sourceRow}`
                  }}
                </strong>

                <small>
                  Skipped for now
                </small>
              </span>

              <button
                class="lw-text-button"
                type="button"
                @click="
                  unskipRow(
                    row.rowId,
                  )
                "
              >
                Restore
              </button>
            </article>
          </div>
        </details>
      </section>

      <section
        v-if="readyRows.length"
        class="lw-section"
      >
        <button
          class="lw-import-ready-toggle"
          type="button"
          @click="
            showReady =
              !showReady
          "
        >
          <span>
            <strong>
              {{ readyRows.length }}
              ready
            </strong>

            <small>
              GORRA already has enough information for these players.
            </small>
          </span>

          <span>
            {{
              showReady
                ? 'Hide'
                : 'View'
            }}
          </span>
        </button>

        <div
          v-if="showReady"
          class="lw-list"
        >
          <article
            v-for="
              row in
              readyRows
            "
            :key="row.rowId"
            class="lw-list-row"
          >
            <span
              class="lw-order-number"
            >
              {{ row.position }}
            </span>

            <span>
              <strong>
                {{ row.name }}
              </strong>

              <small>
                {{
                  row.existingMemberId
                    ? 'Existing club member'
                    : 'New club member'
                }}
              </small>
            </span>
          </article>
        </div>
      </section>

      <p
        v-if="preview.summary.preservedExisting"
        class="lw-note"
      >
        {{ preview.summary.preservedExisting }}
        current Ladder
        {{
          preview.summary.preservedExisting === 1
            ? 'player is'
            : 'players are'
        }}
        not part of the ready uploaded rows. GORRA keeps
        {{
          preview.summary.preservedExisting === 1
            ? 'them'
            : 'them'
        }}
        on the Ladder after the uploaded order rather than deleting anyone silently.
      </p>

      <p
        v-if="preview.summary.ineligible"
        class="lw-note"
      >
        {{ preview.summary.ineligible }}
        {{
          preview.summary.ineligible === 1
            ? 'player does'
            : 'players do'
        }}
        not meet this Ladderâ€™s current requirements and will not be imported.
      </p>

      <footer class="lw-footer">
        <BaseButton
          variant="secondary"
          :disabled="
            busy ||
            checking
          "
          @click="leaveImport"
        >
          Cancel
        </BaseButton>

        <BaseButton
          :disabled="
            busy ||
            checking ||
            !preview.canApply
          "
          @click="applyImport"
        >
          {{
            busy
              ? 'Importingâ€¦'
              : checking
                ? 'Checkingâ€¦'
                : preview.summary.attention
                  ? `Fix ${preview.summary.attention} ${preview.summary.attention === 1 ? 'issue' : 'issues'} to continue`
                  : `Import ${preview.summary.ready} ${preview.summary.ready === 1 ? 'player' : 'players'}`
          }}
        </BaseButton>
      </footer>
    </template>
  </main>
</template>
