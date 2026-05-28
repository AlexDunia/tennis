# Tournament Admin Quick Rehearsal

Use this when you just want to test the tournament controls fast.

## Start Here

Open:

`http://localhost:5173/tennis/#/tournaments/rsp-masters-2026`

Henry is already the local admin.

## Main Controls

| What you want           | Where to go           | What to click                                          |
| ----------------------- | --------------------- | ------------------------------------------------------ |
| See all divisions       | Tournament overview   | Open any division card                                 |
| Enter group scores      | Division page         | `Matches` -> `Group A/B` -> `Pending` -> `Enter Score` |
| Correct a saved score   | Division page         | `Matches` -> `Completed` -> `Edit Result`              |
| Watch a match live      | Division page         | `Matches` -> `Pending` -> `Live Board`                 |
| Use projector mode      | Live board            | `Full screen`                                          |
| Switch light/dark board | Fullscreen live board | `Light mode` or `Dark mode`                            |
| Generate knockout       | Division page         | `Knockout` -> `Generate Knockout`                      |
| Enter knockout score    | Knockout tab          | `Enter Score` on a bracket match                       |
| Check standings         | Division page         | `Standings`                                            |
| Confirm champion        | Division page         | `Knockout` after final is scored                       |

## Fast Test: Make Philip Win Category A

Open:

`Tournaments -> 2026 RSP Masters Tennis Tournament -> Category A`

### 1. Group A

Go to:

`Matches -> Group A -> Pending`

These are already seeded for the local rehearsal. If you need to re-enter them manually, use:

| Match               | Sets | Games | Winner |
| ------------------- | ---- | ----- | ------ |
| Okey vs Julian      | 2-0  | 12-7  | Okey   |
| Okey vs Philip      | 1-2  | 15-16 | Philip |
| Okey vs Dogiye      | 2-0  | 12-5  | Okey   |
| Okey vs Ogechukwu   | 2-0  | 12-4  | Okey   |
| Julian vs Philip    | 0-2  | 8-13  | Philip |
| Julian vs Dogiye    | 2-1  | 15-13 | Julian |
| Julian vs Ogechukwu | 2-0  | 12-6  | Julian |
| Philip vs Dogiye    | 2-0  | 12-4  | Philip |
| Philip vs Ogechukwu | 2-0  | 12-3  | Philip |

Leave `Dagiye/Dogiye vs Ogechukwu` pending for now.

Expected top four:

`Philip, Okey, Julian, Dogiye`

### 2. Group B

Go to:

`Matches -> Group B -> Pending`

These are already seeded for the local rehearsal. If you need to re-enter them manually, use:

| Match             | Sets | Games | Winner  |
| ----------------- | ---- | ----- | ------- |
| Gbolade vs Arinze | 2-1  | 16-14 | Gbolade |
| Gbolade vs Gift   | 2-0  | 12-5  | Gbolade |
| Gbolade vs David  | 2-0  | 12-6  | Gbolade |
| Gbolade vs Gibson | 2-0  | 12-3  | Gbolade |
| Arinze vs Gift    | 2-1  | 15-13 | Arinze  |
| Arinze vs David   | 2-0  | 12-5  | Arinze  |
| Arinze vs Gibson  | 2-0  | 12-6  | Arinze  |
| Gift vs David     | 2-1  | 15-14 | Gift    |
| Gift vs Gibson    | 2-0  | 12-7  | Gift    |

Leave `David vs Gibson` pending for now.

Expected top four:

`Gbolade, Arinze, Gift, David`

### 3. Generate Knockout

Go to:

`Knockout -> Generate Knockout`

Only do this when `Matches -> Pending` is empty.

For the current partial rehearsal, there should still be two pending matches. Finish them only when you are ready to close the group stage.

### 4. Knockout Winners

Enter:

| Round | Match             | Sets | Games | Winner  |
| ----- | ----------------- | ---- | ----- | ------- |
| QF1   | Philip vs David   | 2-0  | 12-5  | Philip  |
| QF2   | Arinze vs Julian  | 2-1  | 15-13 | Arinze  |
| QF3   | Gbolade vs Dogiye | 2-0  | 12-7  | Gbolade |
| QF4   | Okey vs Gift      | 2-1  | 15-14 | Okey    |
| SF1   | Philip vs Arinze  | 2-1  | 16-14 | Philip  |
| SF2   | Gbolade vs Okey   | 2-0  | 12-8  | Gbolade |
| Final | Philip vs Gbolade | 2-1  | 17-15 | Philip  |

Expected result:

`Category A Champion: Philip Onu`

## Live Board Mini Test

Open any pending match:

`Matches -> Pending -> Live Board -> Full screen`

To test deuce:

1. Player A point
2. Player B point
3. Player A point
4. Player B point
5. Player A point
6. Player B point

Now it should show `Deuce`.

To test advantage:

1. Player A point
2. Player B point

It should go `Advantage -> Deuce`.

To finish the game:

1. Player A point
2. Player A point

## What To Watch

After every score:

- Pending count should go down.
- Completed count should go up.
- Standings should change.
- Division card should update.
- Viewer tab should update without refresh.
- Knockout should create the next round after the previous round is scored.

## Refresh Safety

Your test progress survives refresh.

Stored locally under:

`tennis.mock.tournamentState.v1`

Reset everything with:

```js
localStorage.removeItem('tennis.mock.tournamentState.v1')
localStorage.removeItem('tennis.mock.rspCategoryAPartialScenario.v1')
localStorage.removeItem('tennis.local.notifications.v1')
localStorage.removeItem('tennis.local.matchEventSignatures.v1')
location.reload()
```
