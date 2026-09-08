import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(
  'src/layouts/DefaultLayout.vue',
  'utf8',
)

const consistency = readFileSync(
  'src/assets/app-consistency.css',
  'utf8',
)

const ladderSettings = readFileSync(
  'src/views/LadderSettingsView.vue',
  'utf8',
)

const clubVisit = readFileSync(
  'src/views/ClubVisitView.vue',
  'utf8',
)

test(
  'Ladder routes stay inside the migrated GORRA shell',
  () => {
    assert.match(
      layout,
      /name\.startsWith\('Ladder'\)/,
    )

    assert.match(
      layout,
      /\.layout\s*\{[\s\S]*?font-family:\s*var\(--font-family-app\)/,
    )

    assert.match(
      layout,
      /\.layout--migrated\s*\{[\s\S]*?font-family:\s*var\(--font-family-app\)/,
    )
  },
)

test(
  'Ladder Settings consumes the shared Home Play type and control tokens',
  () => {
    assert.match(
      consistency,
      /--app-control-height:\s*44px/,
    )

    assert.match(
      consistency,
      /--app-control-font-size:\s*13px/,
    )

    assert.match(
      consistency,
      /--app-select-padding-right:\s*38px/,
    )

    assert.match(
      consistency,
      /\.ladder-settings/,
    )

    assert.match(
      ladderSettings,
      /font-family:\s*var\(--font-family-app\)/,
    )

    assert.match(
      ladderSettings,
      /font-size:\s*var\(--type-section-title\)/,
    )

    assert.match(
      ladderSettings,
      /font-size:\s*var\(--type-page-description\)/,
    )

    assert.match(
      ladderSettings,
      /font-size:\s*var\(--type-row-title\)/,
    )

    assert.match(
      ladderSettings,
      /font-size:\s*var\(--type-meta\)/,
    )

    assert.match(
      ladderSettings,
      /padding:\s*[\s\S]{0,80}var\(--app-select-padding-right\)[\s\S]{0,80}var\(--app-control-padding-inline\)/,
    )

    assert.doesNotMatch(
      ladderSettings,
      /font-weight:\s*650/,
    )
  },
)

test(
  'Club preview accordion state no longer pollutes the URL',
  () => {
    assert.doesNotMatch(
      clubVisit,
      /route\.query\.collapsed/,
    )

    assert.doesNotMatch(
      clubVisit,
      /query\.collapsed\s*=\s*'1'/,
    )

    assert.match(
      clubVisit,
      /openSection\.value\s*=\s*[\s\S]{0,100}openSection\.value === section/,
    )

    assert.match(
      clubVisit,
      /delete query\.collapsed/,
    )

    assert.match(
      clubVisit,
      /router[\s\S]{0,80}\.replace\(\{[\s\S]{0,120}name:\s*'ClubVisit'/,
    )
  },
)
