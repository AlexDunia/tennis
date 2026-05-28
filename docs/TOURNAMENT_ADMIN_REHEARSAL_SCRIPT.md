# Tournament Admin Rehearsal Script

Short version:

[Tournament Admin Quick Rehearsal](./TOURNAMENT_ADMIN_REHEARSAL_QUICK_START.md)

Use this when you want to test the app like a real tournament admin.

The goal is to enter scores, run live scoreboards, generate knockouts, and confirm the division cards, standings, filters, live updates, and champions all change correctly.

## Before You Start

1. Open the app.
   `http://localhost:5173/tennis/#/tournaments`

2. Use Henry as the admin.
   In the local frontend, Henry is the current admin user.

3. Open two browser tabs if you want to test live updates.
   - Tab 1: admin tab, where Henry enters scores.
   - Tab 2: viewer tab, same tournament page, to confirm updates appear automatically.

4. Know this important seed-data detail:
   In the current seeded `2026 RSP Masters Tennis Tournament`, Philip Onu is in `Category A`, not `Premier` or `Veterans`.

5. For the future story where Philip wins `Premier` and `Veterans`, create or load a tournament where Philip Onu is present in both divisions. Philip exists in the player list as a Premier/Veteran-eligible player, but the seeded RSP demo tournament uses separate `rsp-*` tournament player IDs.

## Refresh and Local Storage

Yes, rehearsal progress survives a normal page refresh.

The local mock API stores tournament testing data in browser localStorage under:

`tennis.mock.tournamentState.v1`

This includes:

- Created tournaments
- Tournament matches
- Scheduled dates, times, and courts
- Live scoreboard state
- Saved group-stage scores
- Walkovers
- Generated knockout brackets
- Knockout results
- Division champions

This is local testing storage only. It is not session storage, so it should remain after refresh and browser reopen until localStorage is cleared.

For a clean rehearsal reset, open browser DevTools and run:

```js
localStorage.removeItem('tennis.mock.tournamentState.v1')
location.reload()
```

Backend handoff note:

When Laravel is connected, this localStorage key should be replaced by API persistence. The frontend already treats tournament state as API data through the service layer, so the backend should persist the same concepts: tournaments, categories, groups, matches, schedules, live score state, standings inputs, knockout brackets, and champions.

## What Should Update Automatically

When Henry saves a score:

1. The match status changes from `Pending` to `Completed` or `Walkover`.
2. The division card count changes.
3. The group progress bar changes.
4. Standings recalculate.
5. The pending count goes down.
6. Viewer tabs refresh within about 1 second on tournament pages.
7. The live scoreboard page refreshes match data every few seconds.

If Tab 2 is hidden in the background, browser refresh may pause until the tab is visible again.

## Admin Score Entry Rules

Open a division:

`Tournaments -> 2026 RSP Masters Tennis Tournament -> Category A -> Matches`

Use the filters:

- `All Groups`: every non-BYE match in the division.
- `Group A`: only Group A round-robin matches.
- `Group B`: only Group B round-robin matches.
- `Quarterfinal`: knockout quarterfinals after knockout is generated.
- `Semifinal`: knockout semifinals after quarterfinals are scored.
- `Final`: final match after semifinals are scored.
- `Pending`: matches needing scores.
- `Completed`: scored matches.
- `Walkover`: matches marked as walkover.
- `Waiting`: knockout matches not ready yet.

For normal score entry:

1. Go to `Matches`.
2. Pick `Group A` or `Group B`.
3. Pick `Pending`.
4. Click `Enter Score`.
5. Enter set score.
6. Enter total games for each player.
7. Click `Save Result`.

Allowed set scores:

| Winner score | Loser score |
| ------------ | ----------- |
| 2            | 0           |
| 2            | 1           |
| 0            | 2           |
| 1            | 2           |

The app uses total games as tiebreakers in standings. It does not store every set score in the simple modal.

## Current Seed Demo: Make Philip Win Category A

This works with the seeded RSP tournament today because Philip Onu is already in `Category A`.

Route:

`/tournaments/rsp-masters-2026/category/category-a`

### Category A Group A Scores

Filter:

`Matches -> Group A -> Pending`

Ignore BYE rows. They are handled automatically.

Enter these scores exactly as shown. The game numbers are total games, not per-set games.

| Match                               | Sets                  | Games                  | Winner        |
| ----------------------------------- | --------------------- | ---------------------- | ------------- |
| Okey Oturu vs Julian Anaele         | Okey 2, Julian 0      | Okey 12, Julian 7      | Okey Oturu    |
| Okey Oturu vs Philip Onu            | Okey 1, Philip 2      | Okey 15, Philip 16     | Philip Onu    |
| Okey Oturu vs Dogiye Esendu         | Okey 2, Dogiye 0      | Okey 12, Dogiye 5      | Okey Oturu    |
| Okey Oturu vs Ogechukwu Izedinor    | Okey 2, Ogechukwu 0   | Okey 12, Ogechukwu 4   | Okey Oturu    |
| Julian Anaele vs Philip Onu         | Julian 0, Philip 2    | Julian 8, Philip 13    | Philip Onu    |
| Julian Anaele vs Dogiye Esendu      | Julian 2, Dogiye 1    | Julian 15, Dogiye 13   | Julian Anaele |
| Julian Anaele vs Ogechukwu Izedinor | Julian 2, Ogechukwu 0 | Julian 12, Ogechukwu 6 | Julian Anaele |
| Philip Onu vs Dogiye Esendu         | Philip 2, Dogiye 0    | Philip 12, Dogiye 4    | Philip Onu    |
| Philip Onu vs Ogechukwu Izedinor    | Philip 2, Ogechukwu 0 | Philip 12, Ogechukwu 3 | Philip Onu    |
| Dogiye Esendu vs Ogechukwu Izedinor | Dogiye 2, Ogechukwu 0 | Dogiye 12, Ogechukwu 8 | Dogiye Esendu |

Expected top four:

1. Philip Onu
2. Okey Oturu
3. Julian Anaele
4. Dogiye Esendu

### Category A Group B Scores

Filter:

`Matches -> Group B -> Pending`

| Match                                | Sets                | Games                 | Winner           |
| ------------------------------------ | ------------------- | --------------------- | ---------------- |
| Gbolade Ibikunle vs Arinze Ugochukwu | Gbolade 2, Arinze 1 | Gbolade 16, Arinze 14 | Gbolade Ibikunle |
| Gbolade Ibikunle vs Gift Elekwuwa    | Gbolade 2, Gift 0   | Gbolade 12, Gift 5    | Gbolade Ibikunle |
| Gbolade Ibikunle vs David Dugo       | Gbolade 2, David 0  | Gbolade 12, David 6   | Gbolade Ibikunle |
| Gbolade Ibikunle vs Gibson Oriaku    | Gbolade 2, Gibson 0 | Gbolade 12, Gibson 3  | Gbolade Ibikunle |
| Arinze Ugochukwu vs Gift Elekwuwa    | Arinze 2, Gift 1    | Arinze 15, Gift 13    | Arinze Ugochukwu |
| Arinze Ugochukwu vs David Dugo       | Arinze 2, David 0   | Arinze 12, David 5    | Arinze Ugochukwu |
| Arinze Ugochukwu vs Gibson Oriaku    | Arinze 2, Gibson 0  | Arinze 12, Gibson 6   | Arinze Ugochukwu |
| Gift Elekwuwa vs David Dugo          | Gift 2, David 1     | Gift 15, David 14     | Gift Elekwuwa    |
| Gift Elekwuwa vs Gibson Oriaku       | Gift 2, Gibson 0    | Gift 12, Gibson 7     | Gift Elekwuwa    |
| David Dugo vs Gibson Oriaku          | David 2, Gibson 0   | David 12, Gibson 9    | David Dugo       |

Expected top four:

1. Gbolade Ibikunle
2. Arinze Ugochukwu
3. Gift Elekwuwa
4. David Dugo

### Generate Category A Knockout

1. Go to `Knockout`.
2. Click `Generate Knockout`.
3. If the app warns about pending matches, stop and go back to `Matches -> Pending`.
4. Only continue when pending group matches are 0.

Expected quarterfinals:

| Match | Expected players                  |
| ----- | --------------------------------- |
| QF1   | Philip Onu vs David Dugo          |
| QF2   | Arinze Ugochukwu vs Julian Anaele |
| QF3   | Gbolade Ibikunle vs Dogiye Esendu |
| QF4   | Okey Oturu vs Gift Elekwuwa       |

### Category A Knockout Scores

Go to:

`Knockout`

Enter:

| Match                                 | Sets                | Games                | Winner           |
| ------------------------------------- | ------------------- | -------------------- | ---------------- |
| QF1 Philip Onu vs David Dugo          | Philip 2, David 0   | Philip 12, David 5   | Philip Onu       |
| QF2 Arinze Ugochukwu vs Julian Anaele | Arinze 2, Julian 1  | Arinze 15, Julian 13 | Arinze Ugochukwu |
| QF3 Gbolade Ibikunle vs Dogiye Esendu | Gbolade 2, Dogiye 0 | Gbolade 12, Dogiye 7 | Gbolade Ibikunle |
| QF4 Okey Oturu vs Gift Elekwuwa       | Okey 2, Gift 1      | Okey 15, Gift 14     | Okey Oturu       |

After saving quarterfinals, semifinals should appear.

| Match                              | Sets               | Games                | Winner           |
| ---------------------------------- | ------------------ | -------------------- | ---------------- |
| SF1 Philip Onu vs Arinze Ugochukwu | Philip 2, Arinze 1 | Philip 16, Arinze 14 | Philip Onu       |
| SF2 Gbolade Ibikunle vs Okey Oturu | Gbolade 2, Okey 0  | Gbolade 12, Okey 8   | Gbolade Ibikunle |

After saving semifinals, final should appear.

| Match                                | Sets                | Games                 | Winner     |
| ------------------------------------ | ------------------- | --------------------- | ---------- |
| Final Philip Onu vs Gbolade Ibikunle | Philip 2, Gbolade 1 | Philip 17, Gbolade 15 | Philip Onu |

Expected result:

`Category A Champion: Philip Onu`

## Future Demo: Philip Wins Premier and Veterans

Use this section when Philip Onu is present in `Premier` and `Veterans`.

Recommended setup:

1. Create a new tournament.
2. Use default categories or custom categories.
3. Ensure Philip Onu is selected in:
   - `Premier`
   - `Veterans`
4. If the app asks about overlap, allow it. Philip can be in a skill category and a special category if the category rules allow overlap.

### Premier Script

Use this story:

- Philip wins all group matches.
- Philip wins a close semifinal.
- Philip wins a dramatic final.

For every Philip group match, enter:

| Match type                  | Sets                 | Games                  | Winner     |
| --------------------------- | -------------------- | ---------------------- | ---------- |
| Normal win                  | Philip 2, Opponent 0 | Philip 12, Opponent 5  | Philip Onu |
| Tight win                   | Philip 2, Opponent 1 | Philip 17, Opponent 15 | Philip Onu |
| Tiebreak-style modal result | Philip 2, Opponent 1 | Philip 19, Opponent 18 | Philip Onu |

For non-Philip group matches, make the strongest players finish below Philip:

| Match type                        | Sets                   | Games                    |
| --------------------------------- | ---------------------- | ------------------------ |
| Strong player beats weaker player | Strong 2, Weak 0       | Strong 12, Weak 6        |
| Middle match                      | Player A 2, Player B 1 | Player A 15, Player B 13 |

When standings put Philip in the top four:

1. Go to `Knockout`.
2. Generate knockout.
3. Enter:

| Round        | Sets                 | Games                  | Winner     |
| ------------ | -------------------- | ---------------------- | ---------- |
| Quarterfinal | Philip 2, Opponent 0 | Philip 12, Opponent 6  | Philip Onu |
| Semifinal    | Philip 2, Opponent 1 | Philip 16, Opponent 14 | Philip Onu |
| Final        | Philip 2, Opponent 1 | Philip 18, Opponent 16 | Philip Onu |

Expected result:

`Premier Champion: Philip Onu`

### Veterans Script

Use this story:

- Philip starts slowly.
- Philip wins one match after several deuces.
- Philip wins one tiebreak set live.
- Philip wins the final.

For group matches:

| Match type                  | Sets                 | Games                  | Winner     |
| --------------------------- | -------------------- | ---------------------- | ---------- |
| Philip clean win            | Philip 2, Opponent 0 | Philip 12, Opponent 4  | Philip Onu |
| Philip comeback             | Philip 2, Opponent 1 | Philip 16, Opponent 15 | Philip Onu |
| Philip tiebreak-style match | Philip 2, Opponent 1 | Philip 19, Opponent 18 | Philip Onu |
| Philip one loss for drama   | Philip 1, Opponent 2 | Philip 14, Opponent 16 | Opponent   |

Make sure Philip still qualifies in the top four.

For knockout:

| Round        | Sets                 | Games                  | Winner     |
| ------------ | -------------------- | ---------------------- | ---------- |
| Quarterfinal | Philip 2, Opponent 1 | Philip 16, Opponent 14 | Philip Onu |
| Semifinal    | Philip 2, Opponent 0 | Philip 12, Opponent 7  | Philip Onu |
| Final        | Philip 2, Opponent 1 | Philip 17, Opponent 15 | Philip Onu |

Expected result:

`Veterans Champion: Philip Onu`

## Live Scoreboard Scenarios

Use live scoreboard when you want the match to feel like it happened point by point.

Open:

`Division -> Matches -> Pending -> Live Board`

Then click:

`Full screen`

In full screen:

- Header and sidebar should disappear.
- Use `Light mode` if projecting in a bright room.
- Use `Dark mode` if projecting in a darker room.
- Use `Switch server` when service changes.

### Scenario 1: Seven Deuces in One Game

Use any pending match.

Let Player A be Philip if Philip is in that match.

Clicks:

1. Player A point
2. Player B point
3. Player A point
4. Player B point
5. Player A point
6. Player B point

Score should now show `Deuce`.

Repeat this 7 times:

1. Player A point
2. Player B point

Each repeat should go:

`Advantage Player A -> Deuce`

To finish the game:

1. Player A point
2. Player A point

The game should move to Player A.

### Scenario 2: Tiebreak Set

The app starts a tiebreak when the set reaches `6-6`.

Fastest way to rehearse:

1. Give Player A four straight points to win game 1.
2. Give Player B four straight points to win game 2.
3. Repeat until games are `6-6`.
4. The scoreboard should switch to tiebreak numbers.

Tiebreak finish:

| Click sequence                        | Result                      |
| ------------------------------------- | --------------------------- |
| Player A 7 points, Player B 5 points  | Player A wins tiebreak 7-5  |
| Player A 8 points, Player B 6 points  | Player A wins tiebreak 8-6  |
| Player A 10 points, Player B 8 points | Player A wins tiebreak 10-8 |

### Scenario 3: Comeback Match

Use the live board.

1. Let Player B win set 1.
2. Let Player A win set 2.
3. Let Player A win set 3.
4. Click `Submit final score`.

Expected result:

The match becomes completed and the division card updates.

## What To Check After Every Score

After saving a score, check these areas:

1. `Matches -> Pending`
   The match should disappear from Pending.

2. `Matches -> Completed`
   The match should appear there.

3. `Overview`
   The group progress should increase.

4. `Standings`
   Points, wins, set difference, and game difference should update.

5. Tournament overview card
   Completed count should increase and pending count should decrease.

6. Viewer tab
   The viewer should see the same update without manually refreshing.

## Codebase Checks and Watch-Outs

These are the things I checked in the code and the things to watch while testing.

### Accurate Card Data

Division cards use match data, not static text:

- Players are counted from groups, excluding BYE players.
- Group progress uses non-BYE group matches.
- Completed count uses completed or walkover matches.
- Pending count excludes BYE matches.
- Live count checks pending matches with a live state.
- Champion text comes from `category.knockout.championName`.

### Live Refresh

Tournament pages use `useTournamentLiveRefresh`.

Current behavior:

- Overview refreshes tournament and matches.
- Category page refreshes tournament and matches.
- Schedule refreshes tournament and matches.
- Tournament match detail refreshes tournament and matches.
- Live scoreboard refreshes match data while preserving local point saves.

Important:

If a browser tab is hidden, refresh pauses until the tab becomes visible.

### Standings Formula

Standings are sorted by:

1. Points
2. Set difference
3. Game difference
4. Wins
5. Name

There is no head-to-head tiebreaker yet.

### Modal Score Limitation

The simple score modal only stores:

- Sets won by player 1
- Sets won by player 2
- Total games by player 1
- Total games by player 2
- Winner

It does not store:

- Exact set-by-set scores
- Number of deuces
- Point-by-point history
- Tiebreak point score

Use live scoreboard for dramatic match simulation.

### Live Scoreboard Limitation

The live scoreboard has no undo button yet.

If you click the wrong point, use a rehearsal match or reset the local demo data before presenting.

### Knockout Safety

Do not generate knockout until `Pending` group matches are 0 unless you intentionally want to test the warning.

If you force knockout early, the app can generate a bracket from incomplete standings.

### Current Seed Data Limitation

The seeded RSP tournament uses tournament-specific player IDs like `rsp-category-a-05`.

The logged-in Henry user uses app player ID `player-02`.

That means "You" highlighting is strongest in tournaments created from the normal app player list, not always in the static seeded RSP tournament.

## Final Demo Goal

At the end of a full rehearsal, you should be able to show:

| Division               | Champion                                       |
| ---------------------- | ---------------------------------------------- |
| Premier                | Philip Onu, once Philip is present in Premier  |
| Veterans               | Philip Onu, once Philip is present in Veterans |
| Category A seeded demo | Philip Onu                                     |

Then check:

1. Tournament overview shows the champion on each division card.
2. Category page shows the champion card.
3. Standings show final group order.
4. Knockout bracket shows completed rounds.
5. Viewer tab matches admin tab.
