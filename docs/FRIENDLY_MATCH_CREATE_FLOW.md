# Friendly Match Create Flow

## Current flow

1. User signs in with one click and starts from the fresh dashboard.
2. User selects **Create Match**.
3. User chooses a match type:
   - **Friendly** continues immediately.
   - **Ladder** explains that a ladder position is required.
   - **Tournament** explains that no tournament is currently active.
4. User selects a friendly opponent and presses **Continue**.
5. User selects **Advantage** or **No-Ad** scoring.
6. The live scoreboard opens. Tapping a player records a point.
7. Ending the match returns the user to the dashboard and adds the result to the activity feed.

The draft is preserved when navigating backward, completed results persist after refresh, and the flow is responsive.

## Recommended next step

Connect friendly matches to the main match store/API so completed results also update dashboard statistics, match history, player profiles, notifications, and club activity.
