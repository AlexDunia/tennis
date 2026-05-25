# Tennis Category Tournament Architecture

This document defines how the app should handle tennis categories, ladder ranking, tournament seeding, groups, standings, knockouts, and champions.

The goal is simple:

Admin should be able to click through a tournament setup like a child could use it, while the system still respects proper club tennis logic.

## Core Understanding

A category is a division of players.

Categories answer one question:

Who should compete against who?

They are not part of tennis scoring. Tennis scoring still uses points, games, sets, and matches. Categories only control fair competition.

For RSP Masters, the expected categories are:

| Category   | Meaning                              |
| ---------- | ------------------------------------ |
| Premier    | Strongest players                    |
| Category A | Strong/intermediate players          |
| Category B | Developing players                   |
| Ladies     | Female division                      |
| Veterans   | Older or experienced player division |

Each category must behave like its own mini tournament:

1. Own player list
2. Own group draw
3. Own fixtures
4. Own standings
5. Own knockout bracket
6. Own champion

Premier players must not be mixed into Category B matches. Ladies and Veterans must also be treated as independent tournament divisions unless the admin intentionally creates a different event format.

## Tennis Standard

This is normal in club and recreational tennis.

The idea of divisions is standard. The exact names are club-specific. A club can use Premier, A, B, Ladies, Veterans, Juniors, Open, Doubles, or any other division names.

So the app should not treat category names as universal tennis law. It should ship with RSP Masters defaults, but the system should allow admins to edit category names, eligibility rules, sizes, and formats.

## App Rule

The product rule should be:

Category decides who plays who.

Ladder decides seeding inside a category.

Tournament results decide standings, knockout qualification, and category champion.

## Current Codebase Alignment

The current app already aligns with the tournament-category model in several important places.

| Area                                | Current Status | Notes                                                                                                                                                                        |
| ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Categories exist                    | Aligned        | Tournaments contain `categories`, and each category has groups, status, knockout, and champion data.                                                                         |
| Category pages exist                | Aligned        | `/tournaments/:tournamentId/category/:categoryId` opens one category as its own workspace.                                                                                   |
| Groups exist per category           | Aligned        | Category view renders each group separately.                                                                                                                                 |
| Fixtures are category-scoped        | Aligned        | Tournament matches include `tournamentId`, `categoryId`, and `groupId`.                                                                                                      |
| Standings are category/group-scoped | Aligned        | Standings are calculated per group using matches from that category.                                                                                                         |
| Knockout is category-scoped         | Aligned        | Knockout data lives under each category.                                                                                                                                     |
| Champion is category-scoped         | Aligned        | `championForCategory` reads the champion from the category knockout.                                                                                                         |
| BYEs are supported                  | Aligned        | BYE fixtures become walkovers and BYE players are excluded from standings.                                                                                                   |
| RSP Masters defaults exist          | Partly aligned | The mock API already contains Premier, Category A, Category B, Ladies, and Veterans.                                                                                         |
| Tournament creation                 | Aligned        | The create wizard now builds generated category data instead of submitting `categories: []`.                                                                                 |
| Player assignment                   | Partly aligned | Admin can select players, auto-assign from ladder, and manually override with dropdowns. Drag/drop can come later.                                                           |
| Ladder to category flow             | Partly aligned | Mock players now have `category`, `categoryId`, `eligibleCategoryIds`, `gender`, `birthYear`, `isVeteran`, and `categoryHistory`. Persistent backend storage can come later. |
| Configurable categories             | Partly aligned | RSP Masters defaults now live in a reusable template utility. Full saved-template editing can come later.                                                                    |
| Toddler-simple generation           | Aligned        | The wizard supports select players, auto assign, review, BYE warnings, and one-click tournament generation.                                                                  |

The tournament engine and setup flow now share the same category model.

The biggest remaining product gaps are saved template editing, a dedicated admin panel, head-to-head tiebreaking, and promotion/relegation screens.

## What The App Should Feel Like

Admin flow should be:

1. Click `Create Tournament`
2. Enter tournament name and dates
3. Choose category template
4. Select players
5. Click `Auto Assign`
6. Review categories
7. Click `Generate Tournament`

The app should then create everything:

Ladder rankings

to category assignment

to seeding

to groups

to fixtures

to standings

to knockout placeholders

to separate category champions

## Required Data Model

### Player

Players need more than rank.

Recommended shape:

```js
{
  id: "player-01",
  name: "Henry Dunia",
  ladderRank: 1,
  categoryId: "premier",
  eligibleCategoryIds: ["premier"],
  gender: "male",
  birthYear: 1988,
  isVeteran: false,
  status: "active",
  stats: {
    wins: 12,
    losses: 3,
    matchesPlayed: 15
  },
  categoryHistory: [
    {
      categoryId: "category-a",
      from: "2025-01-01",
      to: "2025-12-31",
      reason: "Promoted by ladder"
    }
  ]
}
```

The app can keep using `rank` internally for now, but the product language should treat it as `ladderRank`.

### Category Template

Category setup should be reusable.

```js
{
  id: "rsp-masters-default",
  name: "RSP Masters Default",
  categories: [
    {
      id: "premier",
      name: "Premier",
      assignmentMode: "ladder-range",
      ladderStart: 1,
      ladderEnd: 12,
      targetPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: false,
      eligibility: {
        gender: "any",
        veteranOnly: false
      }
    },
    {
      id: "category-a",
      name: "Category A",
      assignmentMode: "ladder-range",
      ladderStart: 13,
      ladderEnd: 24,
      targetPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      eligibility: {
        gender: "any",
        veteranOnly: false
      }
    },
    {
      id: "ladies",
      name: "Ladies",
      assignmentMode: "eligibility",
      targetPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      eligibility: {
        gender: "female",
        veteranOnly: false
      }
    },
    {
      id: "veterans",
      name: "Veterans",
      assignmentMode: "eligibility",
      targetPlayers: 12,
      groupCount: 2,
      qualifiersPerGroup: 4,
      allowByes: true,
      eligibility: {
        gender: "any",
        veteranOnly: true
      }
    }
  ]
}
```

Important: Ladies and Veterans may overlap with ladder categories in real life. The app must let the admin decide whether a player can appear in multiple categories or only one category per tournament.

For RSP Masters singles, the safer default should be one player per category per tournament, unless the club explicitly allows overlap.

### Tournament

Tournament should store generated categories, not only enabled category ids.

```js
{
  id: "rsp-masters-2026",
  name: "2026 RSP Masters",
  status: "active",
  categoryTemplateId: "rsp-masters-default",
  assignmentMode: "auto-with-admin-review",
  rules: {},
  categories: []
}
```

### Tournament Category

```js
{
  id: "premier",
  tournamentId: "rsp-masters-2026",
  name: "Premier",
  status: "round-robin",
  source: "auto-assigned-from-ladder",
  players: [],
  groups: [],
  knockout: {},
  championId: null,
  championName: null
}
```

### Tournament Player

```js
{
  playerId: "player-01",
  name: "Henry Dunia",
  ladderRank: 1,
  categorySeed: 1,
  categoryId: "premier",
  groupId: "A",
  isBye: false,
  assignmentSource: "auto",
  assignmentWarning: null
}
```

## Auto Assignment Rules

The default should be automatic, with admin review.

Recommended rule order:

1. Load active players sorted by ladder rank.
2. Apply category eligibility rules.
3. Fill Premier first from the top eligible ladder players.
4. Fill Category A next.
5. Fill Category B next.
6. Fill Ladies from eligible female players if that category is enabled.
7. Fill Veterans from eligible veteran players if that category is enabled.
8. Add BYEs to categories that allow BYEs and need fixed bracket/group size.
9. Show all warnings before generation.

Warnings should be plain and actionable:

| Problem            | Message                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| Not enough players | `Ladies needs 12 slots but only 8 players were selected. 4 BYEs will be added.` |
| Too many players   | `Category B has 15 players. Move 3 players out or increase category size.`      |
| Ineligible player  | `Alex is not eligible for Ladies based on player profile.`                      |
| Duplicate category | `Grace is already in Category A. Choose whether she can also play Ladies.`      |
| Missing rank       | `Nora has no ladder rank. Admin must seed manually.`                            |

## Group Generation Rules

After players are assigned to a category, the app should seed them by category seed.

For two groups, use balanced snake seeding:

| Seed | Group |
| ---- | ----- |
| 1    | A     |
| 2    | B     |
| 3    | B     |
| 4    | A     |
| 5    | A     |
| 6    | B     |
| 7    | B     |
| 8    | A     |
| 9    | A     |
| 10   | B     |
| 11   | B     |
| 12   | A     |

This keeps the groups fairer than simply putting odd seeds in A and even seeds in B.

The current mock RSP data mostly uses odd/even splitting. That is acceptable for seeded demo data, but the generator should use a defined seeding policy so admins understand the draw.

## Fixture Rules

Each group should generate round-robin fixtures:

Every real player in the group plays every other real player once.

If a player is paired with BYE, the real player receives a walkover.

BYE vs BYE should never create a match.

The current fixture utility already supports this.

## Standings Rules

Each group has its own standings.

Recommended order:

1. Points
2. Set difference
3. Game difference
4. Wins
5. Head-to-head if available
6. Admin decision or alphabetical fallback

The current app uses points, set difference, game difference, wins, then name. That is acceptable for now, but head-to-head should be added later for serious tournaments.

## Knockout Rules

The default RSP format appears to be:

Top 4 from Group A and top 4 from Group B qualify.

Quarterfinal crossover:

| Match | Fixture  |
| ----- | -------- |
| QF1   | A1 vs B4 |
| QF2   | B2 vs A3 |
| QF3   | B1 vs A4 |
| QF4   | A2 vs B3 |

Then:

QF winners go to semifinals.

Semifinal winners go to final.

Final winner becomes category champion.

The current bracket builder already follows this general format.

## Category Differences To Consider

Not every category must have the same exact setup.

| Category   | Possible Difference                                                                 |
| ---------- | ----------------------------------------------------------------------------------- |
| Premier    | Usually strict top ladder players, no BYEs if club wants full strength field.       |
| Category A | Can allow BYEs when not enough players register.                                    |
| Category B | Should protect developing players from Premier-level players.                       |
| Ladies     | Eligibility may be based on gender rather than ladder range.                        |
| Veterans   | Eligibility may be based on age, membership status, or club-defined veteran status. |

The architecture should allow category-level settings:

1. `targetPlayers`
2. `minPlayers`
3. `maxPlayers`
4. `groupCount`
5. `qualifiersPerGroup`
6. `allowByes`
7. `eligibility`
8. `assignmentMode`
9. `allowManualOverride`
10. `allowPlayerOverlap`

## Required UI Changes

The UI already looks good. The missing controls are functional.

### Create Tournament Wizard

Current steps:

1. Basics
2. Categories
3. Rules

Recommended steps:

1. Basics
2. Format
3. Players
4. Review
5. Generate

### Step 1: Basics

Keep the current fields:

1. Tournament name
2. Description
3. Group stage dates
4. Knockout dates
5. Officials

### Step 2: Format

Admin sees:

1. `Use RSP Masters Default`
2. Category toggles
3. Category size controls
4. BYE controls
5. Player overlap option

Default should be already selected.

### Step 3: Players

Admin sees:

1. Player list from ladder
2. Search
3. Select all active players
4. Auto assign from ladder
5. Manual drag/drop between categories

Primary button:

`Auto Assign`

### Step 4: Review

Admin sees one row per category:

| Category   | Players | BYEs | Status          |
| ---------- | ------- | ---- | --------------- |
| Premier    | 12      | 0    | Ready           |
| Category A | 10      | 2    | Ready with BYEs |
| Category B | 12      | 0    | Ready           |
| Ladies     | 8       | 4    | Ready with BYEs |
| Veterans   | 12      | 0    | Ready           |

Each category card should include:

1. Player count
2. BYE count
3. Group A preview
4. Group B preview
5. Warnings
6. Edit button

### Step 5: Generate

The button should say:

`Generate Tournament`

On click, the app creates:

1. Tournament
2. Categories
3. Groups
4. BYEs
5. Fixtures
6. Empty knockout brackets

Then the app redirects to the tournament overview.

## API / Service Changes

The app needs a tournament generation service.

Recommended function:

```js
createTournamentFromWizard({
  basics,
  templateId,
  selectedPlayers,
  categorySettings,
  assignmentMode,
  rules,
})
```

It should return:

```js
{
  ;(tournament, matches, warnings)
}
```

Internally it should:

1. Resolve selected players.
2. Assign players to categories.
3. Seed each category.
4. Build groups.
5. Add BYEs.
6. Generate fixtures.
7. Create empty knockout placeholders.
8. Save tournament and matches.

Resolved issue:

`TournamentCreate.vue` used to send `categories: []`.

It now sends real generated category data. The wizard creates category groups and then asks the existing tournament store to generate fixtures per category.

## Helper Functions To Add

Recommended utilities:

```txt
src/utils/tournament/categoryTemplates.js
src/utils/tournament/assignPlayersToCategories.js
src/utils/tournament/buildCategoryGroups.js
src/utils/tournament/buildTournamentPayload.js
src/utils/tournament/validateTournamentSetup.js
```

### `categoryTemplates.js`

Stores RSP default category config.

### `assignPlayersToCategories.js`

Turns selected ladder players into category rosters.

### `buildCategoryGroups.js`

Turns category roster into Group A and Group B using snake seeding.

### `buildTournamentPayload.js`

Creates the final payload expected by the tournament API.

### `validateTournamentSetup.js`

Returns warnings and blockers before generation.

## Acceptance Criteria

The app aligns with this tennis understanding when all of these are true:

1. A player has ladder rank and category-related fields.
2. Admin can create a tournament without manually building every group.
3. Admin can select RSP Masters default categories.
4. Admin can auto-assign players from ladder.
5. Admin can manually override category assignment.
6. Admin can see warnings before generating.
7. Each category has separate groups.
8. Each category has separate fixtures.
9. Each category has separate standings.
10. Each category has separate knockout bracket.
11. Each category has separate champion.
12. Premier players do not automatically play Category B players.
13. Ladies and Veterans can have eligibility rules.
14. BYEs are visible and handled automatically.
15. Tournament overview shows multiple category champions, not one global champion.

## Implementation Priority

Current implementation status:

Phase 1 is implemented for the mock/local app flow.

Phase 2 is implemented for the create wizard: auto-assign, review screen, clear warnings, and one final generate action.

Phase 3 remains future work: saved templates, full admin panel, head-to-head tiebreaker, and promotion/relegation screens.

### Phase 1: Make Creation Correct

1. Add category templates.
2. Add player category fields to mock players.
3. Add auto-assignment utility.
4. Add group builder.
5. Update `TournamentCreate.vue` so it creates real categories instead of `categories: []`.
6. Generate fixtures automatically after tournament creation.

### Phase 2: Make It Toddler Simple

1. Add `Auto Assign` button.
2. Add Review screen.
3. Show category readiness labels.
4. Show warnings in plain language.
5. Add one final `Generate Tournament` button.

### Phase 3: Make It Club-Proof

1. Add editable category templates.
2. Add head-to-head tiebreaker.
3. Add promotion/relegation history.
4. Add category assignment history per player.
5. Add option for Ladies/Veterans overlap rules.

## Final Product Principle

The admin should not need to understand the data model.

The admin should only understand this:

Pick tournament.

Pick players.

Click auto assign.

Review.

Generate.

The system handles fairness, categories, seeding, groups, fixtures, standings, knockout, and champions.
