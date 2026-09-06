import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNavigationBreadcrumbs } from '../src/utils/navigationBreadcrumbs.js'
const build = (name, extras = {}) => buildNavigationBreadcrumbs({ route: { name, meta: {}, query: {}, params: {}, ...extras.route }, club: { name: 'Dunia media' }, ...extras })

test('member hierarchy has real club name and navigable ancestors', () => {
  const items = build('ClubMembers')
  assert.deepEqual(items.map(item => item.label), ['Club', 'Dunia media', 'Members'])
  assert.deepEqual(items.slice(0, 2).map(item => item.to.name), ['Clubs', 'Club'])
  assert.equal(items.at(-1).to, undefined)
})
test('member detail and club switching resolve names from current context', () => {
  assert.deepEqual(build('ClubMemberDetail', { member: { name: 'Ada Okafor' }, club: { name: 'Greenview' } }).map(item => item.label), ['Club', 'Greenview', 'Members', 'Ada Okafor'])
})
test('create route excludes unrelated active club context', () => {
  const items = buildNavigationBreadcrumbs({ route: { name: 'Clubs', query: { view: 'create' } }, club: { name: 'Old club' } })
  assert.deepEqual(items.map(item => item.label), ['Club', 'Create club'])
})
test('tournament child preserves the tournament route parameter', () => {
  const items = buildNavigationBreadcrumbs({ route: { name: 'TournamentSchedule', params: { tournamentId: 'summer-26' } }, tournament: { name: 'Summer Open' }, title: 'Tournament Schedule' })
  assert.deepEqual(items.map(item => item.label), ['Tournaments', 'Summer Open', 'Schedule'])
  assert.deepEqual(items[1].to, { name: 'TournamentOverview', params: { tournamentId: 'summer-26' } })
})
test('root destinations avoid redundant breadcrumbs', () => {
  for (const name of ['Clubs', 'Dashboard', 'Play', 'Rankings', 'Tournaments']) assert.deepEqual(build(name), [])
})
