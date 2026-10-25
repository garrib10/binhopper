# Collector feedback kit

A kit for #92: show the clickable mockups to about 5 vinyl collectors, watch where they hesitate,
and turn what you see into issues. Each session takes 20 minutes. Write findings in
`docs/research/mockup-feedback.md` (one section per person, from the template below).

## Before the sessions

- **Who:** 5 people who buy records at least monthly. Mix in at least one person who uses Discogs
  heavily and one who doesn't. Friends of friends are better than close friends, who go easy on you.
- **What they use:** the clickable mockups canvas (your "Vinyl Finder App Mockups" artifact on
  claude.ai), on a phone if possible, because v1 is phone-first. Check every task path below works
  before the first session.
- **Heads-up:** the mockups still say **"Spindle"** (the old placeholder name). Tell participants
  it's a placeholder.
- **Roles:** one person runs the session and stays quiet; a second person takes notes, if you can.
  Ask before recording the screen or audio.
- **Bring:** this script, one copy of the notes template per person, and a timer.

## Session script (20 minutes)

**1. Welcome (2 min)**
> "Thanks for helping. This is an early design for an app that finds records in shops near you.
> We're testing the design, not you: if something's confusing, that's what we need to know.
> Please think out loud as you go: what you're looking for, what you expect to happen.
> Some buttons won't work yet, and the name on screen is a placeholder."

**2. Warm-up questions (3 min)**
- "When did you last go looking for a specific record? How did you find it?"
- "Which apps or sites do you use for records today?" (Discogs, shop Instagram, calling shops…)

**3. Tasks (12 min, about 2–3 min each)**

Read each task aloud, then stay quiet. If they're stuck for more than 30 seconds, ask
"What are you looking for?" Give the answer only after a minute, and note that you did.

**4. Wrap-up (3 min)**
- "What was the most confusing moment?"
- "What would make you use this instead of what you do today?"
- "On a scale of 1–5, how likely are you to try this when it's real?" Then ask why.
- Thank them.

## The 5 tasks

| # | Read this aloud | Mockup path to success | Success looks like |
| --- | --- | --- | --- |
| 1 | "You want *Rumours* by Fleetwood Mac on vinyl. Find a shop near you that has it." | Search (Main) → Album → Nearby stock (Stores) | They name a shop and its distance without help |
| 2 | "You're not ready to buy. Save it so you remember it later, then find where it went." | Heart on a search result (Main) → Wishlist | They tap the heart, then open Wishlist and see the album |
| 3 | "Nothing close to you has it. Look a bit farther away." | Radius picker on Stores (10/25/50/100 mi); the empty state's "Try … mi" button | They change the radius or use the "Try … mi" button |
| 4 | "You've decided to buy it from the nearest shop. Go as far as you can, then add it to your collection once it's yours." | Stores → Record (Hold, Buy & ship, or "It's on my shelf, add to collection") → View collection | They reach Record, pick an option, and end up in Collection |
| 5 | "You already track your records on Discogs. Bring them into this app, then make sure nobody else can see your collection." | Collection → Import; You → privacy ("Only me") | They find Import, and find the privacy setting showing "Only me" |

## What to watch for

- **Hesitation:** pauses over 5 seconds, hovering, scrolling back and forth. Note the screen and
  what they said.
- **Wrong first tap:** where they tapped first, and what they expected to happen.
- **Words:** labels they misread or ask about ("verified", "pressing", "hold", "out of date",
  the freshness labels on store cards, grading like VG+).
- **Trust:** do they believe the stock is really there? Do they want to call the shop first?
  What would make them trust it?
- **Distance and radius:** do they understand miles from their ZIP? Do they find the radius picker?
- **Pressings:** do they care which pressing (original vs reissue) they get? Does the app make the
  difference clear?
- **Missing things:** anything they look for that isn't there (price filter, map, opening hours,
  directions).
- **Delight:** moments they smile or say "oh, nice". Keep those when you simplify.

Write down what they *do*, not only what they *say*: people often say "that was easy" right after
struggling.

## Notes template (one per person)

Copy this into `docs/research/mockup-feedback.md` for each session. Use P1–P5, never real names.

```markdown
### P<number> · <date> · phone / desktop

**About them:** buys records <how often>; uses <Discogs / shops / other>; <Discogs heavy user? y/n>

| Task | Done? (yes / with help / no) | Time | Hesitations and wrong taps | Quotes |
| --- | --- | --- | --- | --- |
| 1 Find it nearby | | | | |
| 2 Save to wishlist | | | | |
| 3 Look farther | | | | |
| 4 Buy and add to collection | | | | |
| 5 Import and privacy | | | | |

**Most confusing moment:**
**Would use it instead of today's way because / unless:**
**Likelihood to try (1–5) and why:**
**Words they misread:**
**Things they looked for that weren't there:**
**Delights:**
```

## After all sessions

1. In `docs/research/mockup-feedback.md`, add a summary at the top: each task's success rate
   (for example "Task 3: 2 of 5 without help") and the problems seen by 2 or more people.
2. File one issue per problem worth fixing: what happened, how many people hit it, the screen,
   and a quote. Label it `design` plus its area, and link it from the notes.
3. Mark problems that change SPEC.md rules (not just layout or wording) so the spec gets updated
   before that screen is built.
4. Open a PR with the notes into `develop` and close #92.
