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

test('desktop import keeps the real table while mobile gets a focused field editor', () => {
  assert.match(importView, /ref-import-desktop-grid/)
  assert.match(importView, /ref-import-mobile-editor/)
  assert.match(importView, /mobileColumnKey/)
  assert.match(importView, /mobileRowLabel/)
  assert.match(importView, /moveMobileColumn/)

  assert.match(
    clubCss,
    /\.ref-import-desktop-grid[\s\S]*display:\s*none/,
  )

  assert.match(
    clubCss,
    /\.ref-import-mobile-editor[\s\S]*display:\s*block/,
  )
})

test('the mobile import editor reuses the shared mapping and cell mutation functions', () => {
  assert.match(importView, /function mapTarget\([\s\S]*remapImportTarget/)
  assert.match(importView, /function mapExtra\([\s\S]*remapImportTarget/)
  assert.match(importView, /function changeCell\([\s\S]*workspace\.rows\[rowIndex\]\[sourceIndex\] = value/)
  assert.match(importView, /function cellState\([\s\S]*importCellIssue/)
  assert.match(importView, /mapTarget\([\s\S]*mobileColumn\.field\.key/)
  assert.match(importView, /mapExtra\([\s\S]*mobileColumn\.extra\.index/)
  assert.match(importView, /changeCell\([\s\S]*mobileColumn,[\s\S]*index/)
  assert.match(importView, /cellState\([\s\S]*mobileColumn,[\s\S]*index/)
})

test('repeated imports route through a reconciliation preview before apply', () => {
  assert.match(importView, /previewMemberImport/)
  assert.match(importView, /stage\.value = 'reconcile'/)
  assert.match(importView, /MemberImportReconciliation/)
  assert.match(importView, /applyReconciledImport/)
})

