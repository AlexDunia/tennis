# GORRA Member App Flow — Claude Prompt

Paste this prompt into Claude while the GORRA project folder is open:

```text
You are inside the GORRA Vue application as a normal tennis player/member.

Read the router, DefaultLayout, member-facing views, Pinia stores, permissions, and responsive styles before answering. Do not invent screens or features. Describe the application exactly as the current code renders it.

Walk me through the complete member journey as if you are my eyes inside the running app. Write in first person: “I see…”, “I click…”, and “GORRA now shows…”.

For every step, state:
1. Where I am, including the route when useful.
2. What I can see on the screen.
3. Exactly what I click.
4. What appears or changes after the click.
5. What I should understand or do next.

Cover this flow in order:

1. Entry and authentication
   - Landing page, Sign in, and Sign up.
   - Joining a club when I do not have one.
   - What happens after authentication or club onboarding.

2. The shared application shell
   - Mobile: fixed white header and Home | Play | Compete | Club bottom navigation.
   - Desktop: white header and the same four items in the sidebar.
   - Current club name/switcher, notification bell, avatar, active green state, and page scrolling.

3. Home
   - The existing Dashboard appears as Home.
   - Explain what I see with a new/empty account versus an account with club data.
   - Show rank, challenges, matches, recent activity, tournament information, and the next useful action only when existing data supports them.

4. Play
   - I click Play and see the real supported choices: Start friendly match, Start ladder match, and any match ready to continue.
   - Follow the selected match flow screen by screen: match type, timing, opponent or invitation, scoring format, live match, and result.
   - Explain when the normal navigation disappears so scoring stays focused.

5. Compete
   - I click Compete and see Ladder | Challenges | Tournaments.
   - Ladder: rankings, my position, eligible opponents, and starting a challenge.
   - Challenges: statuses, actions, match details, and result review.
   - Tournaments: tournament list, overview, category, schedule, gallery, match details, and browser Back behavior.
   - Compete must remain active throughout these screens.

6. Club
   - I click Club and see Overview | Members | Rules.
   - Describe the connected-club view and the no-club state.
   - Explain courts, season, member directory, and competition rules only when present in current data.

7. Global account actions
   - Bell → Notifications.
   - Avatar → View profile, Match history, Account settings, and Sign out.
   - Explain what each page shows and confirm that Sign out uses the real authentication action.

Keep the result concise and chronological. Use short numbered steps, not a feature inventory. Mention loading, empty, error, permission, and mobile/desktop differences only where I would visibly encounter them. The result should feel like you are beside me, watching every screen and telling the story of my exact journey through GORRA.
```
