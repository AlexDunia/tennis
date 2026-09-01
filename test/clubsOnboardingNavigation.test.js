import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clubsView = readFileSync('src/views/ClubsView.vue', 'utf8')

test('admin onboarding records forward steps in browser history', () => {
  assert.match(
    clubsView,
    /function setQuery\(query, \{ replace = false \} = \{\}\)[\s\S]*router\.push\(location\)/,
  )
  assert.doesNotMatch(clubsView, /function setQuery\(query\) \{[\s\S]*router\.replace/)
})

test('admin onboarding Back consumes history and keeps direct-linked steps inside the flow', () => {
  assert.match(clubsView, /window\.history\.state\?\.back === previousLocation\.fullPath/)
  assert.match(clubsView, /router\.back\(\)/)
  assert.match(clubsView, /setQuery\(query, \{ replace: true \}\)/)
  assert.match(
    clubsView,
    /goToPreviousFlowState\(\{ step: ONBOARDING_STEPS\[stepIndex\.value - 1\]\.key \}\)/,
  )
})

test('leaving the onboarding start screen returns to the actual previous page', () => {
  assert.match(
    clubsView,
    /function exitFlow\(\)[\s\S]*window\.history\.state\?\.back[\s\S]*router\.back\(\)/,
  )
  assert.match(clubsView, /if \(routeView\.value === 'start'\) \{\s*exitFlow\(\)/)
})
