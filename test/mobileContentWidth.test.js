import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('src/layouts/DefaultLayout.vue', 'utf8')

test('normal authenticated mobile content uses bounded side gutters', () => {
  assert.match(
    layout,
    /@media \(max-width: 767px\)[\s\S]*--app-shell-content-width:\s*min\(calc\(100% - 32px\), 720px\)/,
  )
  assert.match(
    layout,
    /\.content:not\(\.content--fullscreen\):not\(\.content--public\)[\s\S]*width:\s*var\(--app-shell-content-width\)/,
  )
  assert.doesNotMatch(layout, /@media \(max-width: 767px\)[\s\S]*--app-shell-content-width:\s*100%/)
})

test('mobile application header retains bounded side gutters', () => {
  assert.match(
    layout,
    /@media \(max-width: 767px\)[\s\S]*--app-header-content-width:\s*min\(calc\(100% - 32px\), 720px\)/,
  )
  assert.match(layout, /\.header-content[\s\S]*width:\s*var\(--app-header-content-width\)/)
  assert.doesNotMatch(layout, /@media \(max-width: 767px\)[\s\S]*--app-header-content-width:\s*100%/)
})

test('public and immersive content remain full width', () => {
  assert.match(layout, /\.content--fullscreen,[\s\S]*\.content--public[\s\S]*width:\s*100%/)
})
