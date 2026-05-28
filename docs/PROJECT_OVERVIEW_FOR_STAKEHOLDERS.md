# Renaissance Tennis Platform: Project Overview

## The Short Story

Every tennis club has the same quiet problem: people want fair games, clear rankings, and well-run tournaments, but nobody wants to spend their week chasing scores, checking WhatsApp threads, or arguing about who should play next.

This software is built to remove that friction.

It gives the club one simple place to see the ladder, challenge players, manage tournaments, record scores, and follow match activity. The goal is not to make members learn a complicated system. The goal is to make club play feel organized without making busy adults do extra work.

## Who This Is For

This is for a mature club community: working people, senior members, administrators, and active players who need information quickly. They do not need a flashy app. They need a clear one.

When they open it, they should know three things immediately:

- Where they stand.
- What needs their attention.
- What to do next.

## The Main Idea

The platform turns club tennis into a guided flow.

A player sees their rank, checks who they can challenge, sends a challenge, plays the match, records the result, and the ladder moves. An admin can create a tournament, place players into categories, choose formats, monitor fixtures, and enter scores from one control area.

No guesswork. No scattered records. No long explanation before action.

## What The Software Does

### Dashboard

The dashboard is the member's home base. It shows rank, wins, losses, win rate, tournament position, urgent actions, recent activity, and performance trends. It answers the question: "What is happening with me right now?"

### Rankings

The rankings page shows the ladder clearly. Players can see who is above them, who they are allowed to challenge, and who is out of range. This keeps competition fair and prevents confusion.

### Challenges

Challenges are managed like a simple work queue. Members can view incoming challenges, accept or decline them, review match activity, and follow status changes without searching through messages.

### Create Challenge

The challenge form guides the player through opponent selection, match format, scoring rules, doubles options, scorer assignment, and notes. It gives enough control without overwhelming the user.

### Tournaments

Tournament control is the strongest admin feature. The app helps create tournaments with divisions, player placement, group stages, knockout paths, standings, schedules, and score entry.

The creation flow is broken into four steps:

- Basics: name and dates.
- Categories: choose the divisions.
- Players: confirm who belongs where.
- Review: choose the final format and create the tournament.

### Live Scoreboard

The play screen provides a live tennis scoreboard. It supports real tennis scoring, including love, deuce, advantage, sets, and tiebreaks. It is useful during play and for following match progress.

### Match Details

Match details give the official match record: players, status, schedule, score, winner, and tournament context. Admins can update tournament scores and schedules from here.

### Notifications

Notifications keep members aware of challenge updates, score activity, match reviews, and tournament changes. This reduces the need for manual reminders.

### Profile

The profile page gives each member a clean summary of their tennis record: rank, wins, losses, win rate, matches played, and ladder standing.

## What Makes It Useful

The software does not try to replace the club culture. It supports it.

Members still play, talk, compete, and enjoy the game. The app simply keeps the facts straight. Who challenged whom. Who accepted. Who won. Who moved. Which tournament match is next. Which score is pending.

That is the value: fewer arguments, fewer delays, and a cleaner record of play.

## Admin View

Admins get the structure they need without turning club management into office work. They can create tournaments, assign players, choose formats, update schedules, enter results, and monitor progress.

The system is especially helpful when there are many categories or busy tournament days. Instead of managing everything from memory, the admin sees the state of the event on screen.

## Player View

Players get a personal route through the club. They see their rank, their next action, their challenge options, and their match history. A player does not need to understand the entire system to use it. They only need to follow the next clear step.

## Why This Matters

Good clubs are built on trust. In sport, trust comes from clear rules and visible records.

If rankings are unclear, people complain. If fixtures are scattered, matches are missed. If scores are not recorded, progress stops. If admins are overloaded, the whole system slows down.

This platform gives the club a shared source of truth.

## Current State

The app currently runs as a Vue dashboard with mock service data and local prototype persistence for selected areas. It already demonstrates the main product experience:

- Ladder and rankings.
- Challenge creation and review.
- Tournament creation and management.
- Score entry.
- Live scoreboard.
- Notifications.
- Profile and player summaries.

Some production foundations still need to be completed before full live rollout, especially real backend persistence, real authentication, long-term match history, challenge expiry rules, and saved live scoring history.

## The Direction

The direction is simple: make tennis administration feel lighter.

The first version proves the flow. The next version should make it permanent: real users, real data, real match records, real notifications, and a reliable backend.

The product should stay focused. Every new feature should answer one question:

"Does this make club tennis easier to run or easier to play?"

If the answer is yes, it belongs. If not, it waits.

## Final Word

This is not just a scoreboard, a ranking table, or a tournament form.

It is a club operating system for tennis: one place where players know what to do, admins know what is happening, and the game keeps moving.

