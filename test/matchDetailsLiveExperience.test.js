import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('match details uses the canonical Ladder action policy and only starts explicitly', () => {
  const source = read('../src/views/MatchDetailsView.vue')
  assert.match(source, /PLAY_MATCH_ACTIONS/)
  assert.match(source, /getPlayMatchActions/)
  assert.match(source, /LadderMatchManageDialog/)
  assert.match(source, /LivePresenceStrip/)
  assert.match(source, /case PLAY_MATCH_ACTIONS\.START_MATCH:[\s\S]*explicitStart: true/)
  assert.match(source, /case PLAY_MATCH_ACTIONS\.RESUME_SCORING:[\s\S]*name: 'LiveMatch'/)
  assert.match(source, /case PLAY_MATCH_ACTIONS\.VIEW_LIVE_SCORE:[\s\S]*name: 'LiveScoreboard'/)
  assert.match(source, /case PLAY_MATCH_ACTIONS\.OPEN_MATCH_CONTROL:[\s\S]*name: 'LiveOperationDetail'/)
  assert.doesNotMatch(source, /canOpenLadderLive|openLadderLive/)
  assert.match(source, /onMounted\(\(\) => \{ loadMatchDetails\(\) \}\)/)
})

test('live surfaces show presence without making authority implicit', () => {
  const live = read('../src/views/LiveMatchView.vue')
  const scoreboard = read('../src/views/LiveScoreboardView.vue')
  const operations = read('../src/views/LiveOperationDetailView.vue')
  assert.match(live, /scorerAuthority\?\.scorerId/)
  assert.match(live, /LivePresenceStrip/)
  assert.match(scoreboard, /LivePresenceStrip/)
  assert.match(scoreboard, /role="viewer"/)
  assert.match(operations, /LivePresenceStrip/)
  assert.match(operations, /role="club_control"/)
  assert.match(operations, /Match scorer/)
  assert.match(operations, /Take Match Control/)
})