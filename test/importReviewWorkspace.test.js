import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const importView = readFileSync(
  'src/views/ClubMemberImportView.vue',
  'utf8',
)

const clubCss = readFileSync(
  'src/assets/club-reference32.css',
  'utf8',
)

const consistencyCss = readFileSync(
  'src/assets/app-consistency.css',
  'utf8',
)

const apiService = readFileSync(
  'src/services/ApiService.js',
  'utf8',
)

const ladderView = readFileSync(
  'src/views/compete/LadderView.vue',
  'utf8',
)

const ladderAdmin = readFileSync(
  'src/services/LadderAdminService.js',
  'utf8',
)

test(
  'post-upload review replaces the preparation body while keeping the real shell contract',
  () => {
    assert.match(
      importView,
      /v-if="stage === 'prepare'"\s+class="ref-import-page-head"/,
    )

    assert.match(
      importView,
      /ref-import-review-filebar gorra-data-filebar/,
    )

    assert.match(
      importView,
      /Review before adding/,
    )

    assert.match(
      importView,
      /useShellNestedHeader/,
    )
  },
)

test(
  'the same review workspace owns desktop spreadsheet and one-field mobile editing',
  () => {
    assert.match(
      importView,
      /ref-import-table gorra-data-table/,
    )

    assert.match(
      importView,
      /ref-import-mobile-command/,
    )

    assert.match(
      importView,
      /moveMobileColumn\(-1\)/,
    )

    assert.match(
      importView,
      /moveMobileColumn\(1\)/,
    )

    assert.match(
      importView,
      /From your CSV/,
    )

    assert.match(
      importView,
      /openMobileSearch/,
    )

    assert.match(
      importView,
      /openMobileFilter/,
    )

    assert.doesNotMatch(
      importView,
      /class="ref-import-mobile-switcher"/,
    )
  },
)

test(
  'mobile import chrome follows the current GORRA header and bottom navigation variables',
  () => {
    assert.match(
      clubCss,
      /top:\s*var\(--app-header-height\)/,
    )

    assert.match(
      clubCss,
      /bottom:\s*calc\([\s\S]*var\(--app-bottom-nav-height\)/,
    )

    assert.match(
      consistencyCss,
      /\.gorra-data-workspace/,
    )

    assert.doesNotMatch(
      clubCss,
      /body\.import-review-mode\s+\.topbar/,
    )
  },
)

test(
  'EMPTY player mode is genuinely empty and no longer builds the seeded fresh-account roster',
  () => {
    assert.match(
      apiService,
      /isFreshAccount[\s\S]{0,180}path === '\/players'[\s\S]{0,260}buildResponse\(\[\]\)/,
    )

    assert.doesNotMatch(
      apiService,
      /buildFreshAccountLadderRoster/,
    )
  },
)

test(
  'the temporary clear control is development-only and Ladder admin reset is club scoped',
  () => {
    assert.match(
      ladderView,
      /showDevTestControls\s*=\s*Boolean\(import\.meta\.env\?\.DEV\)/,
    )

    assert.match(
      ladderView,
      /data-dev-only="clear-test-data"/,
    )

    assert.match(
      ladderView,
      /clearActiveClubTestData/,
    )

    assert.match(
      ladderAdmin,
      /clearLadderAdminTestState/,
    )

    assert.match(
      ladderAdmin,
      /const prefix =\s*`\$\{normalizedClubId\}::`/,
    )
  },
)
