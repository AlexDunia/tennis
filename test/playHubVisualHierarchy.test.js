import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const playHub = readFileSync('src/views/PlayHubView.vue', 'utf8')

test('Play hub uses larger underlined mode tabs and differentiates Ladder play', () => {
  assert.match(playHub, /class="play-option play-option--ladder"/)
  assert.match(playHub, /\.play-mode-tabs \{[\s\S]*?gap: 24px;[\s\S]*?border-bottom: 1px solid var\(--color-border\);/)
  assert.match(playHub, /\.play-mode-tabs button \{[\s\S]*?border-bottom: 3px solid transparent;[\s\S]*?font-size: 15px;/)
  assert.match(playHub, /\.play-mode-tabs button\.active \{[\s\S]*?border-bottom-color: var\(--color-primary-strong\);/)
  assert.match(playHub, /\.play-option--ladder \{[\s\S]*?background: #163d2b;/)
})