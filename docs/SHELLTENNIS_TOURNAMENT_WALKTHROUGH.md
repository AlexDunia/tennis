# ShellTennis PH Tournament Walkthrough

Use this document to verify the tournament system page by page, button by button.

Source of truth:

`docs/TENNIS_CATEGORY_TOURNAMENT_ARCHITECTURE.md`

## 1. Main Navigation

Open the app.

Expected sidebar order:

1. Dashboard
2. Rankings
3. Tournaments
4. Challenges
5. Profile
6. Notifications

Click `Tournaments`.

Expected result:

You arrive at `/tournaments`.

This page is the tournament control center. It lists active, upcoming, and completed tournaments.

## 2. Rankings Page Category Check

Click `Rankings`.

Expected result:

Each player row should show:

1. Ladder rank
2. Player name
3. Category badge, such as `Premier`, `Category A`, or `Category B`
4. Wins
5. Losses
6. Win percentage
7. Challenge action when eligible

Why this matters:

The ladder is still the year-round ranking system, but each player now also carries category context. This supports auto-assignment when tournaments are created.

## 3. Tournament List

Click `Tournaments`.

Expected controls:

1. `Create Tournament`
2. Active tournament cards
3. Upcoming section
4. Completed section

Click `Create Tournament`.

Expected result:

You arrive at `/tournaments/create`.

## 4. Create Tournament - Step 1: Basics

Visible fields:

1. Tournament Name
2. Description
3. Group Stage Start
4. Group Stage End
5. Knockout Start
6. Final Date
7. Tournament Officials

Button behavior:

`Back` returns to `/tournaments`.

`Next` stays disabled until the required dates and tournament name are filled.

Expected context:

This step defines when the tournament starts, when the group stage ends, when knockout begins, and when the final is played.

## 5. Create Tournament - Step 2: Categories

Click `Next`.

Visible categories:

1. Premier
2. Category A
3. Category B
4. Ladies
5. Veterans
6. Any custom categories the admin adds

Each category card shows:

1. Category name
2. Who belongs there
3. On or Off

Button behavior:

Click a category card to turn it on or off.

Expected default:

All RSP Masters categories are on.

Extra controls:

`Let eligible players enter twice`

When on, an eligible Lady or Veteran can also play Premier, Category A, or Category B.

`Veterans Age`

Default is `50`. Change this if the club defines Veterans differently.

`Create a Custom Category`

Use this when the club wants a category outside the RSP defaults, such as Juniors, Doubles, Invitational, Social Cup, or Guests.

Custom category rules:

1. `Manual only` starts empty and lets the admin pick players in Step 3.
2. `Ladder range` auto-fills from a rank range.
3. `Female players` works like a Ladies-style category.
4. `Veterans age rule` works like a Veterans-style category.

Tooltip:

Hover or focus the `?` icon. It explains that categories decide who plays who, while ladder rank helps the app seed players fairly.

## 6. Create Tournament - Step 3: Players

Click `Next`.

Expected controls:

1. `Select All`
2. `Clear Players`
3. `Fill From Ladder`
4. Player checkboxes
5. Manual category dropdown per player
6. `Show Not Playing` when some selected players do not match the enabled categories

Expected player row context:

Each row shows:

1. Ladder rank
2. Player name
3. Current player category
4. Gender
5. Veteran marker where applicable
6. Auto-assigned tournament category result
7. Manual override dropdown

The list is split by relevance:

`Playing in this event`

Players who match the categories enabled in Step 2 appear first.

`Not playing yet`

Players who do not match the enabled categories are tucked into a separate section. Use `Show Not Playing` if the admin wants to inspect them or manually override someone.

Button behavior:

`Select All`

Selects every active player.

`Clear Players`

Removes every selected player and clears manual overrides.

`Fill From Ladder`

Clears manual overrides and lets the system assign players from the ladder and eligibility rules.

Manual dropdown:

Use this when the admin wants to override the auto guess.

Expected assignment logic:

1. Ranks 1-12 go to Premier.
2. Ranks 13-24 go to Category A.
3. Ranks 25-36 go to Category B.
4. Female players are suggested for Ladies.
5. Veteran players are suggested for Veterans.
6. If overlap is enabled, Ladies/Veterans can include players already in Premier, A, or B.

Example:

If only `Ladies` is enabled in Step 2, Step 3 should show female players assigned to Ladies first. Male players are not wrong; they simply do not match this tournament setup, so they sit under `Not playing yet`.

## 7. Create Tournament - Step 4: Review

Click `Next`.

Expected review cards:

One card per enabled category.

Each card shows:

1. Category name
2. Player count
3. Player-first path, such as `3+ matches`
4. Whether a BYE is needed
5. Who goes through
6. Group A preview
7. Group B preview
8. Warnings or blockers
9. Format options

Expected group split:

Players are seeded with balanced snake seeding.

Example:

1. Seed 1 -> Group A
2. Seed 2 -> Group B
3. Seed 3 -> Group B
4. Seed 4 -> Group A

Expected warnings:

The app should clearly say when a category has BYEs, too few players, or no players.

It should also warn when more players are eligible than the category limit allows. Example: if Ladies has 14 eligible players but a 12-player cap, the app selects the top 12 by ladder/manual choice and tells the admin that 2 remain unassigned.

Expected path options:

Each category can use a different path. The app recommends the safest option based on player count, but the admin can choose another option.

Common examples:

1. `Play everyone. Top 2 reach final.` - useful for 4 players.
2. `Play everyone. Top 4 go through.` - useful for 5-7 players.
3. `Play your group. Top 2 go through.` - useful for 8-10 players.
4. `Play your group. Top 4 go through.` - RSP default for 11-12 players.
5. `Play a small group. Top 2 go through.` - useful for 13-16 players.
6. `Lose once and you are out.` - useful when the club wants speed over guaranteed matches.

Example:

If Veterans has 7 real players, the app should recommend `Play everyone. Top 4 go through.` That allows the tournament to start without forcing fake players into the draw.

Button behavior:

`Generate Tournament`

Creates the real tournament, categories, group-stage matches, standings, and knockout placeholders.

The button stays disabled if a category has a blocking issue, such as no real players.

## 8. Tournament Overview

After generation, the app redirects to `/tournaments/:tournamentId`.

Expected overview:

1. Tournament status
2. Tournament name
3. Description
4. Schedule button
5. Category count
6. Completed match count
7. Pending match count
8. Officials count
9. First match dates
10. Final-round dates
11. Officials list
12. Category cards

Click any category card.

## 9. Category Page

Expected tabs:

1. Overview
2. Groups
3. Fixtures
4. Standings
5. Knockout

### Overview Tab

Expected:

1. Group progress cards
2. Top players in each group
3. Progress bar
4. Simple category guide

### Groups Tab

Expected:

1. Group A player list
2. Group B player list
3. Seeds
4. BYE slots where needed

Important:

BYE slots must be visible, but they should not appear as real players in the standings.

### Fixtures Tab

Expected filters:

1. All Groups
2. Group A
3. Group B
4. Quarterfinal
5. Semifinal
6. Final
7. Status filters

Expected fixture cards:

Each group match is created from the category group only. Premier should not generate matches against Category B.

Click a fixture to view details or enter score.

### Standings Tab

Expected:

1. Group A standings
2. Group B standings

Standings should update after scores are entered.

Default tiebreak order:

1. Points
2. Set difference
3. Game difference
4. Wins
5. Name fallback

### Knockout Tab

Before group stage is finished:

Expected:

`Complete the group stage first`

Button:

`Generate Knockout`

After closing:

Expected:

Final-round draw appears using the selected path:

1. A1 vs B4
2. B2 vs A3
3. B1 vs A4
4. A2 vs B3

Final winner becomes the champion for that category only.

## 10. Full Schedule

From tournament overview, click `View Schedule`.

Expected route:

`/tournaments/:tournamentId/schedule`

Expected filters:

1. All Categories
2. Individual category filters
3. Status filters
4. Court filters

Expected sections:

1. Scheduled matches by date
2. Unscheduled matches

This confirms that all category matches are part of one tournament schedule, while still staying category-isolated.

## 11. Match Details

From a category fixture, open a match.

Expected route:

`/tournaments/:tournamentId/match/:matchId`

Expected context:

The match should show tournament context and category context.

Important:

Tournament matches reuse the same match/scoring surfaces. The category system decides match creation, not tennis scoring.

## 12. Microinteractions To Check

Expected polish:

1. Wizard panels fade/slide in when steps change.
2. Step circles animate when active or completed.
3. Category cards lift slightly on hover.
4. Player rows shift subtly on hover.
5. Review cards lift on hover.
6. Tooltip bubbles appear when hovering/focusing the `?` icons.
7. The template status dot pulses gently.

These animations should help orientation without changing the layout or hiding core controls.

## 13. What Counts As Correct

The implementation is aligned when:

1. Tournaments are reachable from navigation.
2. Players carry category metadata.
3. Create Tournament no longer submits empty `categories`.
4. Admin can select categories.
5. Admin can select players.
6. Admin can auto-assign players.
7. Admin can manually override category assignment.
8. Admin can review groups and BYEs before generation.
9. Generate creates real category groups.
10. Generate creates round-robin fixtures.
11. Each category has independent standings.
12. Each category has independent knockout bracket.
13. Each category has independent champion.
14. Schedule can filter by category.
15. Match Details can open tournament matches.

## 14. Known Future Enhancements

These are intentionally not required for the first aligned build:

1. Editable saved category templates.
2. Dedicated tournament admin panel.
3. Head-to-head tiebreaker.
4. Promotion/relegation confirmation screen.
5. Persistent backend storage for category history.
6. Drag-and-drop player assignment.

The current build focuses on making the category tournament flow real, usable, and auditable.
