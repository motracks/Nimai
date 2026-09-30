# Nimai to-do

The goal: move from a set of tests you take once to a tool that helps week to
week. The ingredients are already here. Some measures are **fixed** (Prakriti,
the Vedic chart), some are **slow** (Big Five, attachment), and some are
**dynamic** (Vikriti, Guna). Add **context** (season, place, travel, age) and a
**feedback loop** (what you practised, and whether it helped), and the app can
say what a person needs *now*, not just who they are.

Status key: `[ ]` open · `[~]` partly there · `[x]` done. Items marked
**(you)** need something only the owner can do or provide.

---

## Now (small, high value)

### [x] Rework the "Keep in mind" section
Done: two points per test in the reader's voice (Prakriti also shows
Svoboda's note on what a changed retake means; ECR-R gets the
self-report vs. interview caveat from Handbook ch.27). The workbook's
teacher points stay in the guide, marked teacher-only. The duplicate
near-boundary note on Prakriti and the repeated "see a doctor" line on a
Vikriti referral are gone.

### [~] Bibliography page (long-form Quellenverzeichnis)
Done: `/sources` lists all 16 sources grouped as classical, research,
practitioner and course material. Each entry shows the full citation,
the version used (PDF, epub or scan), what was read, what it's used for,
how many cited points come from it, and where the edition details were
read. A separate section covers the questionnaires and the chart
calculation. Every analysis links to the page.
- [x] In-text citations (e.g. "Svoboda, ch.4") link to their entry.
- [ ] **(you)** Charaka Saṃhitā (Sharma & Dash): publisher, year and ISBN
      aren't on the scanned pages. Check the physical copy.
- [ ] **(you)** *Attached*: only the ISBN is in our copy; confirm the
      publisher and year from a print copy.

### [x] Refresh `docs/rating-engine-review.md`
Its "Status", "Open" and "Content sources" sections predate the
book-sourcing work. For example, it still says nakshatras have no content and
several books are still needed. Point it at this file for open work.

### [ ] Capture the live schema **(you)**
Run `supabase db pull` (steps in the chat history) and commit the migration it
generates. Until then, a fresh database built from the repo won't match
production.

---

## Next

### [~] Retake reminders
Done:
- [x] A "Reminders" card on the home page: retakes that are due, retakes
      coming up in the next 30 days, and a Vikriti prompt within two weeks
      either side of each equinox and solstice (Svoboda ch.4: imbalance
      arises most at seasonal junctions). The prompt disappears once a
      Vikriti has been taken in that window.
- [x] "Add these to your calendar": `/reminders.ics` gives the next retake
      dates and the next season changes, each with an alert on the day.
      Imported into a phone calendar, it reminds without Nimai sending
      anything.
Open:
- [ ] Email or push reminders. They need a sending service and keys (e.g.
      Resend for email, VAPID keys for push) plus a scheduled job.
      **(you)** Pick the channel if the calendar file isn't enough.

### [x] Reminders only when they matter
Done: a "Reminders" card at the top of the home page appears only for a
retake that's due or at most 5 days away, or within 5 days of a season
change (and until that window closes). Everything further off is listed
quietly under "Coming up" at the bottom, with the calendar file link. The
calendar file still holds every date (`SOON_DAYS` in `src/lib/reminders.ts`).

### [~] Explain the Vedic chart
Done (nakshatras, from Harness, *The Nakshatras*, 1999):
- [x] A **Reading** under the chart: what the Moon's nakshatra says about
      the emotional nature, its ruler, deity, symbol and power, linked to its
      own page. With no birth time, both possible nakshatras are linked
      instead of guessing.
- [x] `/vedic/nakshatras`: all 27 in order. `/vedic/nakshatras/<name>`: a page
      per nakshatra (position, ruler, deity, symbol, shakti, motivation,
      gana, animal, gunas; Moon traits and what to watch; page citation;
      previous/next).
Open:
- [ ] **Signs, houses, planets** from de Fouw & Svoboda, *Light on Life*
      **(you: upload it)**. Then: a general reading (ascendant only when the
      birth time is reliable, Moon sign), and clicking a sign opens its own
      page (element, quality, ruler; which planets sit there and which house
      it is in this chart). Same rules: tendencies, no timing, marriage or
      health predictions.
- [ ] Add the chart to the needs model's Nature layer once it has content.

### [x] Progress over months
Done: each result card shows an "Over time" section once there are two or
more comparable results.
- A line per dimension across every result, spaced by real dates. Guna and
  Prakriti are plotted as shares (the balance), the rest as 0-100 scores.
  Colours are fixed per dimension and checked for colour-blind separation.
- A one-line trend ("Sattva has risen 12 points since June 2026, across 3
  results"); movements under 5 points count as steady.
- Hover, tap or arrow keys for a tooltip; a legend; end labels where
  there's room; "Show as a table" for every value.
- Later: a per-test "real change" threshold from test-retest data.

### [~] Seasons and travel, compared year on year
Done (needs the migration below applied to record anything):
- [x] Vikriti and Guna end with "Where are you taking this?": at home or
      away, and if away, the climate compared with home. The hemisphere
      is guessed from the device's time zone and can be switched; the
      season is worked out on the server. No location is stored.
- [x] The progress chart draws results taken away from home as hollow
      dots, the tooltip shows season and place, and the trend sentence
      leaves away results out when at least two home results remain.
- [x] "Same season in 2025 (Autumn): Vata 4 → 2 …" on the result card once
      there's an earlier year to compare with.
- [ ] **(you)** Apply `supabase/migrations/20261001000000_context_checkins_practice.sql`
      (Supabase dashboard → SQL editor → paste → Run, or `supabase db push`).
      Until then results save without context, and nothing breaks.

### [x] Home screen "today" card: what to do, what to avoid
Done: a "Today" card at the top of the home page.
- Picks the dosha that needs attention now: a raised Vikriti first, then
  the season's dosha when it matches the constitution, then the
  constitution, then the season alone (Svoboda ch.4; southern seasons when
  the results were taken there).
- Three things to do and three to go easy on. "Go easy on" restates the
  workbook's "increased by" list; "Do" applies the classical rule that a
  quality is settled by its opposite (Caraka Sarira 6.5-7). Fast breathing
  techniques are left off on purpose.
- The dosha of the current hour from the reader's own clock, and one Guna
  line when a Guna result exists. "Why this?" links to the full reading.

---

## Then

### [ ] Asana library
- [ ] One entry per pose: Sanskrit name (with diacritics and a simple
      spelling), English name, a drawn illustration, a description, its
      effect on each dosha, contraindications, and a beginner variation.
- [ ] Illustrations: one consistent line-drawing style (e.g. simple SVG
      figures). Each drawing must be checked against a real reference.
      Generated pose images often get the anatomy wrong, and a wrong drawing
      is a safety issue.
- **(you)** An asana reference book to source the descriptions and
      contraindications, e.g. Swami Satyananda Saraswati, *Asana Pranayama
      Mudra Bandha* (Bihar School), or B.K.S. Iyengar, *Light on Yoga*.
      Today's asana text is the Govardhan workbook's per-dosha summary only.

### [ ] Sequence builder
- [ ] Build a sequence from the library for the person's current state:
      Vikriti first, then Prakriti, the season and the time of day, using the
      per-dosha rules already in the dosha guide.
- [ ] Choose a length (15, 30 or 60 min) and a level, then save or print the
      sequence.
- [ ] Always show the contraindications and a "not a substitute for a
      teacher" note.

### [x] Short check-in between retakes
Done: `/checkin`, four quick questions (sleep, digestion, mood, energy) in the
Vikriti check's own wording plus a "fine" option each. Stored in its own
`checkins` table and never scored as a Vikriti. A check-in under a week old
and newer than the last Vikriti feeds the Today card (below a raised
Vikriti). Recent check-ins are listed on the page. Needs the migration
applied; until then the page says it isn't set up yet.

---

## Later: from static tests to a tool that helps

### [x] Needs model
Done: `src/lib/needs.ts`, shown as "What needs attention now" at the top of
the profile (top four). Each item names its layer, a confidence (lowered by
quality flags and by age: state results older than 6 weeks, trait results
older than a year) and the result it came from. The Response layer uses the
practice log below; the Vedic chart and place/age aren't in it yet.

Combine all the data into a ranked answer to "what does this person need
now?":

| Layer | Source | Changes |
|---|---|---|
| Nature | Prakriti, Vedic chart | never / rarely |
| Temperament | Big Five, attachment | slowly (years) |
| Current state | Vikriti, Guna, check-ins | weeks |
| Context | season, place, travel, time of day, age | predictable cycles |
| Response | practices logged, and whether they helped | ongoing |

Rules:
- Current state outranks nature.
- Confidence comes from data quality: margin, quality flags, how recent the
  result is.
- Every recommendation says which layer drove it and cites its source.

### [x] Practice log and feedback loop
- [x] Tick the Today card's practices; stored per local day in
      `practice_log` (needs the migration). `/practice` shows the last 4 weeks.
- [x] Show what a raised dosha did between two Vikriti checks alongside the
      days you practised for it, worded as a pattern, never as proof.
- [ ] Use the `helped` column (1-5 rating per practice); it exists but has
      no UI yet.
- [ ] Log sequences and food changes once the asana library exists.

### [ ] Optional written narrative
An LLM-written summary on top of `buildSynthesisInput()`. It must only use
facts from the input and keep the citations. Optional; the rule-based text
comes first.

### [ ] Check the instruments with real data
Once there are about 100 users: internal consistency (Cronbach's α) per
scale, test-retest, and whether the expected resonances actually show up.

### [ ] Expert content review **(you)**
Someone who teaches these frameworks should read all the interpretive text
before launch.

---

## Done recently

- [x] Book-sourced knowledge base: 14 sources, paraphrased and cited (PR #2).
- [x] Charaka Samhita (Sharma & Dash) and Lad's *Textbook of Ayurveda* added
      despite the Drive download problems (PR #2).
- [x] Lad's *Science of Self-Healing* (1984) no longer needed; Svoboda
      ch.4/ch.6 cover the same ground (PR #3).
- [x] 14-day retake rule: block for Big Five, attachment and Prakriti, warn
      for Guna and Vikriti (PR #3).
- [x] `middleware.ts` → `proxy.ts` for Next 16 (PR #3).
- [x] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel; Vikriti saves confirmed on
      production.
