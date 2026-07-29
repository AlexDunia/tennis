# GORRA Administrator App Flow — Claude Prompt

Paste this prompt into Claude while the GORRA project folder is open:

```text
You are inside the GORRA Vue application as a club administrator who is also a tennis player.

Read the router, route guards, DefaultLayout, admin and player views, Pinia stores, permission system, and responsive styles before answering. Use the real role names, routes, data, and click behavior found in the code. Do not invent admin tools.

Walk me through the complete administrator journey as if you are my eyes inside the running app. Write in first person: “I see…”, “I click…”, and “GORRA now shows…”.

For every step, state:
1. My current screen and route when useful.
2. Everything important I can see.
3. The exact control I click.
4. What appears or changes after the click.
5. Why that screen matters to me as both an admin and a player.

Cover this flow in order:

1. Admin entry and setup guard
   - Landing page and admin Sign in.
   - If no club is configured, show the automatic Club Setup journey.
   - Follow creating or joining a club, club basics, members/invitations/import, ladder setup, rules, publishing, and opening the club.
   - If a club is already configured, explain where I land.

2. The shared application shell
   - The primary navigation always remains Home | Play | Compete | Club.
   - Mobile uses the white fixed bottom navigation; desktop uses the white sidebar.
   - Show the current club switcher, notification bell, avatar menu, selected green state, and what changes when I switch clubs.

3. Home
   - The existing Dashboard appears as Home.
   - Keep my personal player experience visible: rank, matches, challenges, results, and tournaments.
   - Then explain any existing admin-relevant counts, pending work, tournament status, or operational information supported by current data.

4. Play
   - I click Play and see the real friendly match, ladder match, and continue-match entries.
   - Follow the chosen flow through opponent/invitation, format, live scoring, score submission, and result details.
   - Explain when the application shell disappears for immersive scoring.

5. Compete
   - I click Compete and see Ladder | Challenges | Tournaments.
   - Show normal player actions first.
   - Then show authorized actions such as creating a tournament, managing its categories, groups, fixtures, standings, knockout progress, scores, and gallery.
   - Follow important detail routes without losing IDs, history, or the active Compete state.

6. Club and administration
   - I click Club and see Overview | Members | Rules | Manage.
   - Overview shows the active club, location, courts, season, member count, and active ladders when data exists.
   - Members and Rules show their real current data.
   - Manage opens the protected existing Settings experience at /settings.
   - Walk through Club, Members, Ladders, Rules & format, and Account categories.
   - Include switching or adding clubs through the existing Clubs flow.
   - Clearly state which controls a normal member would not see and which routes remain protected by permissions.

7. Global admin/account actions
   - Bell → Notifications.
   - Avatar → View profile, Match history, Account settings, Club settings, and Sign out.
   - Explain the visible result of each click and confirm that Sign out calls the real authentication store.

Keep the result concise, chronological, and visual. Use short numbered steps rather than a technical architecture report. Mention loading, empty, error, permission, and responsive states only when they affect what I see. The final walkthrough should make it feel as though you are monitoring GORRA beside me and always know exactly which screen I am viewing.
```
