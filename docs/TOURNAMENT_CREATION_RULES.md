# Tournament Creation Rules

This document explains the rules currently implemented in the tournament creation flow.

Use it as the "if this, then that" guide for the RSP Masters tournament wizard.

Related docs:

- `docs/TENNIS_CATEGORY_TOURNAMENT_ARCHITECTURE.md`
- `docs/SHELLTENNIS_TOURNAMENT_WALKTHROUGH.md`

## Create Mode Layout

When the admin enters:

```txt
/tournaments/create
```

The normal app sidebar is hidden during tournament creation.

On Basics and Categories:

```txt
No left sidebar
Full setup workspace
Top header progress only
```

On Players and Review, a fixed left rail appears because those steps need category selection.

That rail shows:

```txt
Back to tournaments
Premier
Category A
Category B
Ladies
Veterans
Any custom category
```

The round arrow in the top header moves one setup step backward.

The `Back to tournaments` button returns to the normal tournament page and restores the normal app sidebar.

The sidebar does not repeat the wizard progress. `Basics`, `Categories`, `Players`, and `Review` stay in the top header only.

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

The RSP Masters default starts ON.

The screen shows:

1. Active category count.
2. Total category entries.
3. Excluded category count.

`Category entries` can be higher than unique players because one player may appear in two divisions.

Example:

```txt
Amina -> Premier
Amina -> Ladies
```

Then Amina counts as:

```txt
1 unique player
2 category entries
```

Each category card is a toggle card:

```txt
Playing  = included in this tournament
Excluded = not used in this tournament
```

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

Custom category creation lives inside an optional drawer on the Categories step.

This is intentional:

```txt
Step 2 defines the tournament structure
Step 3 assigns players into that structure
```

So the admin creates/removes categories before selecting the final player list.

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

### If custom category rule is Fill everyone who matches

Then the app uses the selected eligibility rules and fills the category automatically.

Eligibility rules can be mixed:

```txt
Who Can Enter = Ladies only
Veterans only = ON
Auto Fill = Fill everyone who matches
```

Then:

```txt
Female veterans -> custom category
```

### If Who Can Enter is Ladies only

Then only players with:

```txt
gender = female
```

are eligible.

### If Who Can Enter is Men only

Then only players with:

```txt
gender = male
```

are eligible.

### If Veterans only is ON

Then the custom category behaves like a Veterans-style category.

Players who satisfy the tournament Veterans Age setting are eligible.

### If the admin removes a custom category

Then the category is removed from the tournament setup, its format choice is cleared, and any manual player assignments pointing to it are removed.

### If Can play twice is ON

Then players in the custom category can also remain in another category, such as Premier, Category A, or Category B.

Use this for special side divisions such as:

```txt
Senior Ladies
Veterans Invitational
Sponsors Cup
```

### If Can play twice is OFF

Then the custom category behaves like a normal exclusive category. Players selected there are not automatically reused elsewhere unless manually overridden.

## Step 1: Date Rules

Tournament creation is future-forward.

### If the admin selects a past date

Then the app pushes that date back to the earliest valid date.

The earliest valid date is:

```txt
today
```

### If Group Stage End is before Group Stage Start

Then Group Stage End is moved to Group Stage Start.

### If Knockout Start is before Group Stage End

Then Knockout Start is moved to Group Stage End.

### If Final Date is before Knockout Start

Then Final Date is moved to Knockout Start.

The date order is:

```txt
Today or later
Group Stage Start
Group Stage End
Knockout Start
Final Date
```

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

Manual assignment is multi-category.

That means one player can be added to more than one category when the event allows it.

Example:

```txt
Amina
Rank 5
Gender female
```

Then the admin can place her in:

```txt
Premier
Ladies
```

The player list shows the player's categories as removable chips. Click a chip to remove that player from that category.

If the chip was auto-assigned by ladder, gender, or age, the app records an admin exclusion for that player/category pair.

If the chip was manually added by the admin, the app removes the manual pick.

If the manual assignment breaks eligibility rules, the app shows a warning.

Example:

```txt
Male player manually placed in Ladies
```

Then:

```txt
Warning: check eligibility before generating
```

### If the admin adds a player to a custom category

Then the player is automatically selected for the tournament and the custom category is added to that player's category list.

Example:

```txt
Custom category = Senior Ladies
Admin adds Ify
```

Then:

```txt
Ify -> Senior Ladies
```

If the category allows overlap, Ify can still remain in Ladies, Veterans, Premier, Category A, or Category B where appropriate.

### If the admin removes a player from one category

Then only that category is removed.

Example:

```txt
Amina is auto-assigned to Premier and Ladies
Admin removes Premier chip
```

Then:

```txt
Amina -> Ladies
Premier exclusion is remembered for this tournament setup
```

The player is not removed from the whole tournament unless the admin unticks the player checkbox.

## Step 3: Player Assignment

The Players step is category-first.

The admin does not edit every player row at once.

The page explains the rule in plain language:

```txt
Everything is auto-generated from player details and ladder ranking.
Pick a category, then add or remove players there.
```

Instead, the admin picks one category from the left side:

```txt
Premier
Category A
Category B
Ladies
Veterans
Any custom category
```

Then the right side shows:

```txt
Players already in that category
Search box to add more players manually
Reset/clear actions for that category
```

### If the admin picks a category

Then the app shows only that category's working list.

Example:

```txt
Admin clicks Ladies
```

Then:

```txt
Right side shows players currently in Ladies
Admin can remove from Ladies only
Admin can search members and add to Ladies
```

### If a custom category exists

```txt
Custom category = Senior Ladies
```

Then:

```txt
Senior Ladies appears in the category list
Admin clicks Senior Ladies
Admin searches members and adds names manually
```

This is how custom divisions take existing player data from the club roster.

### If the category has an auto rule

Then the app can fill it automatically.

Examples:

```txt
Premier -> ladder rank range
Ladies -> female players
Veterans -> age-eligible players
```

The admin can still manually add or remove players after the auto fill.

### If the admin clicks Use auto rule

Then manual additions and removals for that category are cleared.

The category returns to the rule defined in Step 2.

Example:

```txt
Premier was edited manually
Admin clicks Use auto rule
```

Then:

```txt
Premier goes back to ladder-based assignment
```

### If the admin clicks Empty category

Then every current player is removed from that category for this tournament setup.

This does not delete the category.

Use this when the admin wants to hand-pick the category from zero.

### If the admin searches in the add-player area

Then the list is filtered locally by:

```txt
name
rank
category
gender
veteran status
assigned category
```

Search input is sanitized before filtering. It only supports simple name/rank/category style characters.

### If the admin adds a player manually

Then the player is selected for the tournament and added to the active category.

If that player already belongs to another category, the other category stays unless the admin removes it.

### If the admin removes a player from the active category

Then only the active category is removed.

```txt
Amina -> Premier + Ladies
Admin is editing Ladies
Admin removes Amina
```

Then:

```txt
Amina -> Premier
Ladies removal is remembered for this tournament setup
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
