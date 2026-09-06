import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync(
  'src/layouts/DefaultLayout.vue',
  'utf8',
)

test('normal authenticated mobile content uses the locked 80 percent shell width', () => {
  assert.match(
    layout,
    /@media \(max-width: 767px\)[\s\S]*--app-shell-content-width:\s*80%/,
  )

  assert.match(
    layout,
    /\.content:not\(\.content--fullscreen\):not\(\.content--public\)[\s\S]*width:\s*var\(--app-shell-content-width\)/,
  )
})

test('mobile application header uses a separate restrained 85 percent width', () => {
  assert.match(
    layout,
    /@media \(max-width: 767px\)[\s\S]*--app-header-content-width:\s*85%/,
  )

  assert.match(
    layout,
    /\.header-content[\s\S]*width:\s*var\(--app-header-content-width\)/,
  )

  assert.doesNotMatch(
    layout,
    /@media \(max-width: 767px\)[\s\S]*--app-header-content-width:\s*(?:98|100)%/,
  )
})

test('public and immersive content remain full width', () => {
  assert.match(
    layout,
    /\.content--fullscreen,[\s\S]*\.content--public[\s\S]*width:\s*100%/,
  )
})
