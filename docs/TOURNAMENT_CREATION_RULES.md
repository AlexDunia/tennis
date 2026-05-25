# Tournament Creation Rules

This document explains the rules currently implemented in the tournament creation flow.

Use it as the "if this, then that" guide for the RSP Masters tournament wizard.

Related docs:

- `docs/TENNIS_CATEGORY_TOURNAMENT_ARCHITECTURE.md`
- `docs/SHELLTENNIS_TOURNAMENT_WALKTHROUGH.md`

## Core Principle

Tennis scoring is stable.

Tournament structure is configurable.

That means:

```txt
Points, games, sets, match winner = tennis scoring
Categories, groups, BYEs, qualifiers, brackets = tournament structure
```

The app should guide the admin into a clean tournament format without forcing every category to use the same shape.

## Human UI Language Rule

The tournament engine can use technical words internally.

The screen should speak like a player.

Use this translation in the UI:

| System logic                   | Human UI text             |
| ------------------------------ | ------------------------- |
| Category                       | Category                  |
| Group stage                    | Group stage               |
| Knockout                       | Knockout                  |
| BYE                            | BYE (free pass)           |
| Qualifiers                     | Who goes through          |
| Assigned by current format     | Playing in this event     |
| Not assigned by current format | Not playing yet           |
| Direct knockout                | Lose once and you are out |

Format cards should answer three player questions:

1. How many matches can I expect?
2. Can I lose once and continue?
3. How is the winner decided?

Example visible chips:

```txt
3+ matches
Lose and continue
QF + SF + Final
```

The exact system format can stay in code and docs, but it should not be the main headline on the screen.

## Step 2: Category Selection

### If a category is ON

Then the category exists in this tournament.

Example:

```txt
Ladies ON
```

Then Step 3 can assign players to Ladies, Step 4 can preview Ladies, and Generate can create a Ladies tournament section.

### If a category is OFF

Then the category does not exist in this tournament.

Example:

```txt
Ladies OFF
```

Then no player is assigned to Ladies, the dropdown does not include Ladies, and the generated tournament has no Ladies section.

## Default RSP Categories

By default, the wizard enables:

1. Premier
2. Category A
3. Category B
4. Ladies
5. Veterans

These are defaults, not permanent tennis law. The admin can turn any category off for a smaller event.

## Custom Category Rules

### If the admin creates a custom category

Then the category becomes available in Step 2, Step 3, Step 4, and the generated tournament.

Examples:

```txt
Juniors
Doubles
Invitational
Social Cup
Guests
```

### If custom category rule is Manual only

Then the app does not automatically place anyone inside it.

The admin must manually choose players in Step 3.

Use this when the category is club-specific and the app should not guess.

### If custom category rule is Ladder range

Then the app assigns players whose ladder ranks fall inside the chosen range.

Example:

```txt
Rank Start = 37
Rank End = 48
```

Then:

```txt
Ranks 37-48 -> custom category
```

### If custom category rule is Female players

Then the custom category behaves like a Ladies-style category.

Players with:

```txt
gender = female
```

are eligible.

### If custom category rule is Veterans age rule

Then the custom category behaves like a Veterans-style category.

Players who satisfy the tournament Veterans Age setting are eligible.

### If the admin removes a custom category

Then the category is removed from the tournament setup, its format choice is cleared, and any manual player assignments pointing to it are removed.

## Player Assignment Rules

### If a category is rank-based

Then ladder rank decides automatic placement.

Current rank bands:

| Rank  | Auto Category |
| ----- | ------------- |
| 1-12  | Premier       |
| 13-24 | Category A    |
| 25-36 | Category B    |

Example:

```txt
Player rank = 5
Premier is ON
```

Then:

```txt
Player -> Premier
```

### If Ladies is ON

Then players with:

```txt
gender = female
```

are eligible for Ladies.

If there are more eligible players than the category limit, the app selects the top eligible players by ladder/manual choice and warns the admin.

Example:

```txt
Ladies has 14 eligible players
Ladies limit is 12
```

Then:

```txt
Top 12 are selected
2 remain unassigned
Warning is shown
Generation can continue
```

### If Veterans is ON

Then players qualify by veteran status or age rule.

Current wizard setting:

```txt
Veterans Age = 50 by default
```

If the player is age-eligible, they can be assigned to Veterans.

### If Ladies/Veterans overlap is ON

Then a player can be in a skill category and a special category.

Example:

```txt
Amina
Rank 5
Gender female
Overlap ON
```

Then:

```txt
Amina -> Premier
Amina -> Ladies
```

### If Ladies/Veterans overlap is OFF

Then a player is only assigned to one category by default.

Example:

```txt
Amina
Rank 5
Gender female
Overlap OFF
```

Then the app avoids automatically placing her in both Premier and Ladies.

The admin can still manually override if needed.

### If the admin manually assigns a player

Then manual assignment takes priority over auto assignment.

If the manual assignment breaks eligibility rules, the app shows a warning.

Example:

```txt
Male player manually placed in Ladies
```

Then:

```txt
Warning: check eligibility before generating
```

## Step 3: Player List Display

### If a player matches the enabled categories

Then the player appears under:

```txt
Playing in this event
```

### If a player does not match the enabled categories

Then the player is hidden under:

```txt
Not playing yet
```

The admin can click `Show Not Playing` to inspect or manually override those players.

Example:

```txt
Only Ladies is ON
```

Then:

```txt
Female players appear first as Ladies
Male players appear under Not playing yet
```

## Step 4: Player Path Recommendation Rules

The app recommends a path per category based on the number of real players assigned.

The visible card should use player language first. The system format name can stay in code.

### If player count is 1-3

Recommended:

```txt
Play everyone. Best record wins.
```

Reason:

Too small for knockout.

### If player count is 4

Recommended:

```txt
Play everyone. Top 2 reach final.
```

Meaning:

Everyone plays group-stage matches. Top 2 play the final.

### If player count is 5-7

Recommended:

```txt
Play everyone. Top 4 go through.
```

Meaning:

Everyone plays group-stage matches. Top 4 reach the semifinals.

This is the recommended fix for a 7-player Veterans category.

### If player count is 8

Recommended:

```txt
Play your group. Top 2 go through.
```

Meaning:

Two groups of 4. Top 2 from each group go through.

### If player count is 9-10

Recommended:

```txt
Play your group. Top 2 go through.
```

Reason:

Top 2 per group keeps the race clear.

### If player count is 11-12

Recommended:

```txt
Play your group. Top 4 go through.
```

Meaning:

Two groups. Top 4 per group go through.

This is the current RSP default for full 12-player categories.

### If player count is 13-16

Recommended:

```txt
Play a small group. Top 2 go through.
```

Meaning:

Four groups. Top 2 per group go through.

### If player count is 17+

Recommended:

```txt
Play a small group. Top 2 go through.
```

But the admin should consider a larger future setup.

## Available Format Options

The app currently supports these format choices:

| Player-facing option                  | What It Means                                          |
| ------------------------------------- | ------------------------------------------------------ |
| Play everyone. Best record wins.      | No knockout. The table decides.                        |
| Play everyone. Top 2 reach final.     | Everyone plays group-stage matches. Top 2 play final.  |
| Play everyone. Top 4 go through.      | Everyone plays group-stage matches. Top 4 reach semis. |
| Play your group. Top 2 go through.    | Good for 8-10 players.                                 |
| Play your group. Top 4 go through.    | RSP default for full 12-player categories.             |
| Play a small group. Top 2 go through. | Good for larger fields.                                |
| Lose once and you are out.            | Fastest path. No guaranteed second match.              |

## BYE Rules

A BYE means a player has no opponent in that slot.

In plain English, it is a free pass.

### If a group needs empty slots

Then the app can add BYE slots if the category allows them.

Example:

```txt
Category target = 12
Real players = 10
BYEs needed = 2
```

Then:

```txt
2 BYE slots are added
Warning is shown
```

### If a category does not allow BYEs

Then BYEs become a blocker.

Example:

```txt
Premier allows no BYEs
Premier needs BYEs
```

Then:

```txt
Generation is blocked
```

### If direct knockout has missing draw slots

Then the missing slots become BYEs.

Example:

```txt
7-player direct knockout
8-player draw
```

Then:

```txt
1 top seed receives a BYE
```

## Warning vs Blocker

### Warning

A warning means:

```txt
You can continue, but review this.
```

Examples:

1. Category has fewer than the recommended minimum.
2. Category will use BYE slots.
3. More players are eligible than the category limit.
4. Manual assignment may break eligibility.

### Blocker

A blocker means:

```txt
The selected format cannot safely generate.
```

Examples:

1. Category has no real players.
2. Category has more players than its maximum.
3. Category does not allow BYEs but BYEs were added.
4. Selected path needs more real players than exist.

## Knockout Generation Rules

### If format is one group + final

Then:

```txt
Rank 1 vs Rank 2
```

### If format is one group + semifinals

Then:

```txt
1st vs 4th
2nd vs 3rd
```

### If format is two groups + semifinals

Then:

```txt
Group A winner vs Group B runner-up
Group B winner vs Group A runner-up
```

### If format is two groups + quarterfinals

Then:

```txt
A1 vs B4
B2 vs A3
B1 vs A4
A2 vs B3
```

### If format is four groups + quarterfinals

Then:

```txt
A1 vs B2
B1 vs A2
C1 vs D2
D1 vs C2
```

### If format is round robin only

Then:

```txt
No bracket is created
Group standings decide champion
```

### If path is direct knockout

Then:

```txt
No group stage is created
Players are seeded straight into knockout
Missing draw slots become BYEs
```

## Standings Rules

Current standings order:

1. Points
2. Set difference
3. Game difference
4. Wins
5. Name fallback

Current default:

```txt
Win = 1 point
Loss = 0 points
```

This can be changed later if the club wants a different system, such as 3 points for a win.

## Generation Rules

### If there are blockers

Then:

```txt
Generate Tournament is disabled
```

### If there are only warnings

Then:

```txt
Generate Tournament can continue
```

### If generation succeeds

Then the app creates:

1. Tournament record
2. Enabled categories
3. Category-specific format settings
4. Groups if the format needs groups
5. Round-robin fixtures if the format needs groups
6. Knockout bracket placeholders or direct knockout bracket
7. Category schedule data

## Important Product Rule

The admin should not be trapped by one rigid tournament structure.

The app should:

1. Suggest the cleanest format.
2. Explain why.
3. Warn when something needs review.
4. Block only when generation would be mathematically broken.
5. Allow the admin to choose a different valid format.
