# ShellTennis PH Tournament App Handoff

This document explains how the tournament side of the app is structured, how the user moves through it, and what logic must be preserved.

It is written as a handoff brief for another AI or designer. Do not copy the exact current UI. Keep the same product logic, but create an original interface that feels simple, white/green, tennis-first, and easy for non-technical club admins.

## 1. Product Idea

ShellTennis PH has two connected systems:

1. Ladder system: the year-round ranking list where players challenge each other.
2. Tournament system: seasonal events such as RSP Masters, where players are split into divisions, play groups, qualify for knockout, and produce champions.

The tournament system must feel simple:

```txt
Create event
Choose divisions
Assign players
Pick format
Generate tournament
Play matches
Update standings
Seed knockout
Declare champions
```

The core tennis philosophy:

```txt
Categories decide who plays who.
Ladder rank helps seed players fairly.
Scores, games, sets, and match rules stay normal tennis.
```

## 2. Visual And Layout Direction

The brand feel should stay:

```txt
White base
Green action color
Clean club-sport interface
Simple cards
Clear hierarchy
Friendly text
```

The app should not feel like a technical database. It should feel like a guided tournament desk for tennis admins.

Avoid:

```txt
Too many controls in one row
System-heavy words as main labels
Repeating the same information in multiple places
Large crowded tables unless they are truly needed
```

Prefer:

```txt
One decision per area
Category-first editing
Player-first language
Clear next/back navigation
Small explanatory helper text
Green confirmation states
```

## 3. Normal App Shell

Outside tournament creation, the app uses the normal sidebar.

Normal sidebar contains:

```txt
Logo
Dashboard
Rankings
Tournaments
Challenges
Profile
Notifications
```

Click behavior:

```txt
Dashboard -> general app overview
Rankings -> ladder and player rankings
Tournaments -> tournament hub
Challenges -> ladder challenge workflow
Profile -> player profile
Notifications -> alerts and updates
```

The top header normally shows:

```txt
Current page title
Short page subtitle
Signed-in player avatar/name
```

## 4. Focused Create Tournament Mode

When the admin clicks `Create Tournament`, the app enters a focused wizard mode.

Route:

```txt
/tournaments/create
```

Important layout rule:

```txt
The normal app sidebar is hidden.
Basics and Categories use the full page width.
Players and Review get a fixed left rail because those steps need category selection.
```

On Basics and Categories:

```txt
No left sidebar.
Only the top header/progress is visible.
```

On Players and Review, the fixed left rail contains:

```txt
Back to tournaments
Premier
Category A
Category B
Ladies
Veterans
Any custom category
```

Click behavior:

```txt
Back to tournaments -> returns to /tournaments and restores the normal app sidebar
Header back arrow -> moves one wizard step backward
```

Do not duplicate the wizard progress in this sidebar. The progress belongs in the top header. The left rail is only for category choices when the current step needs them.

Why this matters:

```txt
Creating a tournament is a focused setup task.
The admin should not feel like they are still browsing the main app.
```

## 5. Tournament Routes

Tournament pages currently map like this:

| Route                                             | Purpose                    |
| ------------------------------------------------- | -------------------------- |
| `/tournaments`                                    | Tournament hub/list        |
| `/tournaments/create`                             | Create tournament wizard   |
| `/tournaments/:tournamentId`                      | Tournament overview        |
| `/tournaments/:tournamentId/category/:categoryId` | One category/division page |
| `/tournaments/:tournamentId/schedule`             | Full schedule              |
| `/tournaments/:tournamentId/match/:matchId`       | Match details/result entry |

## 6. Tournament Hub

The tournament hub is the entry point.

It shows:

```txt
Create Tournament button
Active tournaments
Upcoming tournaments
Completed tournaments
Match counts
Completed/pending summary
```

Admin click flow:

```txt
Click Create Tournament -> enter focused wizard
Click a tournament card -> open tournament overview
```

## 7. Create Tournament Wizard Overview

The wizard has four steps:

```txt
1. Basics
2. Categories
3. Players
4. Review
```

The URL query tracks the step:

```txt
/tournaments/create?step=basics
/tournaments/create?step=categories
/tournaments/create?step=players
/tournaments/create?step=review
```

The admin should always know:

```txt
Where am I?
What am I choosing now?
What happens when I click next?
```

## 8. Step 1: Basics

Purpose:

```txt
Name the tournament and set the tournament dates.
```

Fields:

```txt
Tournament name
Description
Group Stage Start
Group Stage End
Knockout Start
Final Date
Tournament officials
```

Date rules:

```txt
Past dates are not valid.
Group Stage End cannot be before Group Stage Start.
Knockout Start cannot be before Group Stage End.
Final Date cannot be before Knockout Start.
```

Human text idea:

```txt
Future dates only. Each stage must happen after the one before it.
```

## 9. Step 2: Categories

Purpose:

```txt
Choose which divisions this tournament will run.
```

Default RSP Masters divisions:

```txt
Premier
Category A
Category B
Ladies
Veterans
```

These are defaults, not permanent tennis law.

Each category card should communicate:

```txt
Category name
Short meaning
Number of category entries
Playing / Excluded state
```

Important wording:

```txt
Category entries
```

Use this instead of "players selected" because one person can play two divisions.

Example:

```txt
Amina plays Premier and Ladies.
That is 1 unique player but 2 category entries.
```

Category toggle behavior:

```txt
Green/on -> category will run in this tournament
Grey/off -> category will not exist in this tournament
```

## 10. Custom Categories

Admins can create their own divisions.

Examples:

```txt
Senior Ladies
Juniors
Guests
Invitational
Sponsors Cup
```

Custom category fields:

```txt
Category Name
Who Can Enter: any gender / ladies only / men only
Auto Fill: admin picks players / fill everyone who matches / fill by ladder range
Rank Start
Rank End
Player Limit
Veterans only toggle
Can play twice toggle
```

Create behavior:

```txt
Click Create Category -> category is added to the tournament setup
New category appears in Step 2, Step 3, and Step 4
Admin can delete custom categories
```

Important UX split:

```txt
Step 2 creates the division and its rule.
Step 3 adds/removes actual player names.
```

So the custom category builder should not become a crowded player assignment screen.

## 11. Step 3: Players

Purpose:

```txt
Review auto-generated category membership, then manually add or remove players per category.
```

Main explanation text:

```txt
Everything is auto-generated from player details and ladder ranking.
Pick a category, then add or remove players there.
```

This step is category-first, not giant-table-first.

Preferred structure:

```txt
Left side: category list
Right side: editor for selected category
```

Left category list should show:

```txt
Premier
Category A
Category B
Ladies
Veterans
Custom categories
```

Default labels:

```txt
Auto-generated
Manual category
Edited by admin
```

Only show "Edited by admin" after the admin has actually added or removed someone.

Do not show "Auto + manual" by default. It sounds like something has already happened.

## 12. Player Assignment Logic

Auto assignment reads:

```txt
Player ladder rank
Player gender
Player veteran/age eligibility
Enabled categories
Custom category rules
```

Default rank bands:

```txt
Ranks 1-12 -> Premier
Ranks 13-24 -> Category A
Ranks 25-36 -> Category B
Female players -> Ladies if enabled
Veteran players -> Veterans if enabled
```

Overlap logic:

```txt
Premier, Category A, Category B are normal skill divisions.
Ladies and Veterans are special divisions.
A player can play a skill division and a special division if overlap is enabled.
```

Example:

```txt
Amina
Rank 5
Female

Auto result:
Premier
Ladies
```

Manual add:

```txt
Admin selects Ladies
Searches "Amina"
Clicks Add
Player is added to Ladies for this tournament
```

Manual remove:

```txt
Admin selects Premier
Clicks Remove on Amina
Amina is removed from Premier only
Any other category stays untouched
```

Technical idea:

```txt
manualAssignments = admin-added category memberships
manualExclusions = admin-removed auto memberships
```

## 13. Step 4: Review

Purpose:

```txt
Check each category, choose a tournament format, review groups/BYEs/warnings, then generate.
```

Review should be one category at a time.

It shows:

```txt
Category tabs
Player count
Recommended format
Alternative formats
Group preview
Warnings/blockers
Rules summary
Generate Tournament button
```

Format options:

```txt
Table decides
Top 2 final
Top 4 semifinals
Top 2 per group
Top 4 per group
Small groups
Straight knockout
```

Human-facing text should answer:

```txt
How many matches will I play?
Can I lose and continue?
How is the winner decided?
```

Use tennis terms where useful:

```txt
QF
SF
Final
Semifinals
Quarterfinals
Knockout
Group stage
```

## 14. Format Recommendation Logic

The app recommends a format based on number of real players.

Current logic:

| Players | Recommended path                |
| ------- | ------------------------------- |
| 1-3     | Table decides                   |
| 4       | Top 2 final                     |
| 5-7     | Top 4 semifinals                |
| 8       | Top 2 per group                 |
| 9-10    | Top 2 per group                 |
| 11-12   | Top 4 per group                 |
| 13-16   | Small groups                    |
| 17+     | Small groups or direct knockout |

The admin can choose another valid format.

Golden rule:

```txt
Suggest the best format, but do not trap the admin unless the format is mathematically broken.
```

## 15. BYE Logic

A BYE means a free pass or empty opponent slot.

BYEs can happen when:

```txt
Category target slots are higher than real players
Knockout draw needs a power-of-two shape
Groups need balancing
```

UI language:

```txt
BYE (free pass)
```

Warning vs blocker:

```txt
BYE allowed -> warning
BYE not allowed -> blocker
No players -> blocker
Too many players -> blocker
Not enough players for selected knockout path -> blocker
```

## 16. Group Generation

Players are seeded by:

```txt
Manual selection first where applicable
Ladder rank / seed order
```

Group split uses snake seeding.

Example for two groups:

```txt
Seed 1 -> Group A
Seed 2 -> Group B
Seed 3 -> Group B
Seed 4 -> Group A
```

This avoids placing all strongest players in one group.

Each group stores:

```txt
Group id
Group name
Category id
Tournament id
Players
Fixture ids
```

## 17. Tournament Generation

When the admin clicks Generate Tournament, the app creates:

```txt
Tournament record
Category records
Category settings
Groups
BYE slots if needed
Knockout placeholders or direct knockout draw
Fixtures for each category
Schedule data
```

Generated tournament status:

```txt
active
```

Category status:

```txt
round-robin if group stage is needed
knockout if direct knockout is selected
```

## 18. After Generation: Tournament Overview

Route:

```txt
/tournaments/:tournamentId
```

This page shows:

```txt
Tournament name
Description
Status
Dates
Officials
Division count
Completed match count
Pending match count
Category/division cards
View schedule button
Back to tournaments button
```

Click behavior:

```txt
Click category card -> category page
Click View Schedule -> full schedule
```

## 19. Category Page

Route:

```txt
/tournaments/:tournamentId/category/:categoryId
```

Tabs:

```txt
Overview
Groups
Matches
Standings
Knockout
```

The category page shows:

```txt
Category name
Format summary
Qualification rule
Group progress
Pending matches
Completed matches
Champion if available
```

Admin can:

```txt
Open score modal
Enter match result
Schedule match
Mark walkover
Close group phase
Generate knockout
Open full match details
```

## 20. Standings And Qualification

Group standings update from match results.

Ranking order:

```txt
Points
Set difference
Game difference
Wins
Name fallback
```

Default points:

```txt
Win = 1
Loss = 0
```

Qualification copy:

```txt
Top 2 go through
Top 4 go through
Best record wins
```

The exact copy depends on selected format.

## 21. Knockout

Knockout can be:

```txt
Final only
Semifinals + Final
Quarterfinals + Semifinals + Final
Direct knockout
Round robin only with no bracket
```

The bracket is seeded from standings after group play, unless direct knockout was chosen during tournament creation.

Champion:

```txt
Each category produces its own champion.
No single overall club champion is required.
```

Examples:

```txt
Premier Champion
Category A Champion
Category B Champion
Ladies Champion
Veterans Champion
```

## 22. Full Schedule Page

Route:

```txt
/tournaments/:tournamentId/schedule
```

It shows every match across every category.

Filters:

```txt
All categories / one category
All status / pending / completed / walkover
All courts / Court 1 / Court 2 / Court 3 / Court 4
```

Matches are grouped by scheduled date.

Unscheduled matches appear in their own section.

Clicking a match opens controls to:

```txt
Schedule it
Change court/time
Enter result
```

## 23. Match Details

Tournament matches reuse the existing match details/scoring flow.

Route:

```txt
/tournaments/:tournamentId/match/:matchId
```

This is important:

```txt
Tournament categories do not change tennis scoring.
They only decide who plays who.
```

Scores feed back into:

```txt
Match status
Group standings
Knockout progression
Champion display
Notifications
```

## 24. Data Shape Summary

Tournament:

```txt
id
name
description
status
dates
officials
rules
categories
```

Category:

```txt
id
name
description
status
settings
players
groups
knockout
```

Tournament player:

```txt
playerId
name
ladderRank
seed
categoryId
categoryName
gender
birthYear
isVeteran
isBye
assignmentSource
```

Rules:

```txt
winPoints
lossPoints
qualifiersPerGroup
tiebreakAt
rankingOrder
veteranAge
allowSpecialOverlap
```

## 25. Product Rules To Preserve

1. Auto by default, editable by admin.
2. Categories are independent mini-tournaments.
3. A player may play more than one category when overlap is allowed.
4. Manual changes should be obvious but not visually noisy.
5. Custom categories are allowed and should use existing player data.
6. Review should block only impossible setups.
7. Warnings should not stop generation unless the tournament cannot be created safely.
8. Tennis scoring stays the same across all categories.
9. The app should explain actions in human language.
10. Every generated tournament should lead naturally into overview, category pages, schedule, matches, standings, knockout, and champion.

## 26. What Claude Should Do Differently

Claude should not copy the current layout exactly.

It should create its own original version while preserving:

```txt
White/green tennis-club identity
Focused create mode
Four-step wizard
Category-first player assignment
Auto/manual assignment logic
Custom categories
Review and format selection
Group/knockout/champion ecosystem
```

Best direction:

```txt
Make it feel even simpler.
Make every button answer "what happens if I click this?"
Make tournament setup feel guided, not technical.
```
