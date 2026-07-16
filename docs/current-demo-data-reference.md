# Gorra current demo-data reference

This document archives the populated mock experience that existed before the fresh-account mode was introduced. The records remain live in `src/services/ApiService.js`; they are selected by the persisted `demo` data mode and are not copied into the fresh-account dataset.

## Restore point and mode

- Canonical reusable source: `src/services/ApiService.js`
- Separate booking seed: `src/services/BookingService.js`
- Mode source of truth: `src/dataMode.js`
- Default mode: `empty`
- Persisted key: `gorra.appDataMode.v1`
- `demo` returns the original populated mock database.
- `empty` returns empty API collections while leaving the mock database untouched.

## Demo identities and roles

- Current one-click administrator identity: **Heredina**.
- The administrator is linked to `player-02` for the existing permission and tournament flows.
- `player-02` is the generated ladder record for **Henry Dunia**.
- The one-click member identity is linked to `player-05`, **Amina Esin**.
- Role definitions and permissions live in `src/utils/auth/accessControl.js`.
- Authentication-to-player relationships live in `src/stores/auth.js` and `src/stores/player.js`.

## Ladder players

Player fields are: `id`, `name`, `imageUrl`, `rank`, `wins`, `losses`, `matchesPlayed`, `ladderRank`, `category`, `categoryId`, `gender`, `birthYear`, `isVeteran`, `status`, `eligibleCategoryIds`, and `categoryHistory`.

The four image-backed players are generated first:

1. `player-01` — Foster Ezenwelu
2. `player-02` — Henry Dunia
3. `player-03` — Nestor Madukaife
4. `player-04` — Philip Onu

The remaining generated ladder is:

5. `player-05` — Amina Esin
6. `player-06` — Chima Adamu
7. `player-07` — Ify Okonkwo
8. `player-08` — Bola Johnson
9. `player-09` — Grace Nwosu
10. `player-10` — Seun Adeyemi
11. `player-11` — Tomiwa Adebayo
12. `player-12` — Nkechi Okonkwo
13. `player-13` — David Eze
14. `player-14` — Ifeoma Umeh
15. `player-15` — Kingsley Obi
16. `player-16` — Nadia Abdul
17. `player-17` — John Paul
18. `player-18` — Amaka Osei
19. `player-19` — Sola Akin
20. `player-20` — Emeka Nwankwo
21. `player-21` — Aisha Musa
22. `player-22` — Tunde Bello
23. `player-23` — Lilian Ibiam
24. `player-24` — Chinedu Nduka
25. `player-25` — Oyin Adewale
26. `player-26` — Kelechi Iro
27. `player-27` — Mariam Bello
28. `player-28` — Victor Etim
29. `player-29` — Rita Okafor
30. `player-30` — Samuel Okoro
31. `player-31` — Efe Ajayi
32. `player-32` — Fola Bakare
33. `player-33` — Chioma Udo
34. `player-34` — Peter Danjuma
35. `player-35` — Yemi Lawal
36. `player-36` — Theresa Obi

Ranks 1–12 are assigned to Premier, 13–24 to Category A, and 25–36 to Category B. Women are additionally eligible for Ladies. The deterministic veteran-rank set is `2, 4, 7, 11, 15, 18, 22`.

## Ladder challenges

Challenge fields are: `id`, `challengerId`, `defenderId`, `status`, `requestedAt`, and optional `scheduledAt`. Response objects also include player names, images, ranks, status labels, and match configuration.

- `challenge-01`: `player-01` challenges `player-02`; status `awaiting`; requested one hour before database initialization.
- `challenge-02`: `player-03` challenges `player-04`; status `scheduled`; requested two hours before initialization and scheduled two days later.
- `challenge-03`: `player-02` challenges `player-01`; status `pending_review`; requested three days before initialization and scheduled one day before initialization.

## Ladder matches and scores

Shared match fields include: `id`, `type`, `challengeId`, participant IDs and names, `status`, scheduling fields, `score`, `winnerId`, tournament context, set data, and `liveState`.

- `match-01` belongs to `challenge-02`; `player-03` vs `player-04`; scheduled; no score or winner.
- `match-02` belongs to `challenge-03`; `player-02` vs `player-01`; pending review; score `6-4, 3-6, 7-5`; winner `player-02`.

Accepting a challenge creates or updates its match. Reviewing a ladder result updates wins, losses, matches played, and may swap ladder ranks before the ladder is reordered.

## Tournament

The seeded tournament is `rsp-masters-2026`, **2026 RSP Masters Tennis Tournament**. It is active, runs from 14 March through 4 April 2026, and uses five categories: Premier, Category A, Category B, Ladies, and Veterans. Officials are Igo, Harcourt, Zino, Dogiye, and David.

Tournament rules: one point for a win, zero for a loss, four qualifiers per group, tie-break at 6–6, top-four crossover knockout, ranking order of points/set difference/game difference/wins/name, 30-minute walkover time, and 24-hour reschedule notice.

### Tournament rosters

- Premier A: Andy Spencer, Charles Harcourt, Igho Eguegue, Babatunde Salami, Ulo Okon, Amaechi Modunkwu.
- Premier B: Rv. Fr. John Konyeke, Zino Ejomarie, Leonard Chimaobi, Chukwunalu Adeshina, Ifeanyi Atumonye, Alfred Equong.
- Category A A: Okey Oturu, Julian Anaele, Philip Onu, Dogiye Esendu, Ogechukwu Izedinor, one BYE.
- Category A B: Gbolade Ibikunle, Arinze Ugochukwu, Gift Elekwuwa, David Dugo, Gibson Oriaku, one BYE.
- Category B A: Hamza Kassim, Kodili Iloka, Nwoke Adinigwe, Dennis Okoro, David Michael, Chidiebere Oburu.
- Category B B: Voke Emore, Reuben Eteure, George Nwachukwu, Ikechi Okpala, Ben Oguche, Major Kenechukwu Otubo.
- Ladies A: Brownie Blessing, Heritage Imo, Abisola Dare Linus, Stella Ezimoha, two BYEs.
- Ladies B: Chinazor Okpalogu, Ejemen Obozokhae, Elah Adagogo, Sotonye Akhagbeme, two BYEs.
- Veterans A: Chukuwdi Imo, Forster Ezenwelu, Funmi Adebowale, Nestor Madukaife, Joe Ighekpe, Kayode Adeyeri.
- Veterans B: Chijioke Amu'nnadi, Greg Ojih, Augustine Inyikalum, Vincent Nwabueze, Uche Okpalogu, Ufuoma Oghene.

Round-robin fixtures are generated deterministically by `src/composables/useTournamentFixtures.js`. Each six-slot group produces 15 pairings, for 150 initial tournament fixture records across ten groups. BYE pairings remain explicitly identifiable through player metadata. Category A starts with 18 completed result tuples and two explicitly pending pairings; the exact score tuples remain in `rspCategoryAPartialScenarioResults` in the canonical source.

### Tournament gallery

Six seeded image records (`rsp-gallery-01` through `rsp-gallery-06`) cover opening day, match point, preparation, finals atmosphere, an empty court, and championship focus. Each has URL, thumbnail URL, caption, category, tags, uploader, and upload time. They are uploaded by `player-02` under the stored name Chima Adamu. The records remain in `createRspTournamentImages()`.

## Court bookings

Booking fields are: `id`, `date`, `startHour`, `duration`, `playerName`, `description`, and `createdAt`.

- `booking-1`: Amina Esin, 16 April 2026 at 18:00 for two hours, “Evening fitness session”.
- `booking-2`: Shell Wellness, 17 April 2026 at 07:00 for one hour, “Early bird practice”.

## Notifications and activity

Notifications are not hardcoded seed records. They are generated from challenge and tournament actions and saved under `tennis.local.notifications.v1`. Match-event signatures are saved under `tennis.local.matchEventSignatures.v1`. Fields are `id`, `title`, `message`, `type`, `time`, `read`, `eventKey`, and `meta`.

Dashboard figures are computed from the player, challenge, match, booking, tournament, and notification stores; there is no separate dashboard seed. Recent activity is derived from the same challenge/match records.

## Persistence and relationships

- Tournament edits and generated tournament matches: `tennis.mock.tournamentState.v1`.
- Category A partial-scenario marker: `tennis.mock.rspCategoryAPartialScenario.v1`.
- Court bookings: `sheltennis-bookings`.
- Authentication: `sheltennis-auth`.
- Role overrides: `tennis.local.playerRoles.v1`.
- Tournament gallery additions are stored inside tournament state.
- Challenge records connect to ladder players through `challengerId` and `defenderId`.
- Ladder matches connect back through `challengeId`.
- Tournament matches connect through `tournamentId`, `categoryId`, and `groupId`.
- Gallery records connect through `tournamentId` and optional `categoryId`.

## Components and views consuming demo data

- Players/rankings: `src/stores/player.js`, `src/views/RankingsView.vue`, `src/views/ProfileView.vue`, `src/views/CreateChallengeView.vue`.
- Challenges: `src/stores/challenge.js`, `src/views/ChallengesView.vue`, `src/components/ChallengeCard.vue`.
- Matches: `src/stores/match.js`, `src/views/MatchesView.vue`, `src/views/MatchDetailsView.vue`, `src/views/PlayView.vue`.
- Dashboard/activity: `src/views/DashboardView.vue`.
- Tournaments: `src/stores/tournament.js` and the tournament views/components.
- Notifications: `src/stores/notification.js`, `src/views/NotificationsView.vue`.
- Bookings: `src/stores/booking.js`, `src/views/BookView.vue`.

No CSV import or migration flow is part of this archive or the fresh-account implementation.
