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

### [ ] Progress over months
Results currently compare baseline with latest, two points only.
- [ ] A timeline per test: every result as a point, one line per dimension
      (Vata/Pitta/Kapha, Sattva/Rajas/Tamas, Big Five traits), on the stored
      0-100 `norm` scores.
- [ ] Mark changes too small to mean anything (under 5 points today; the
      ECR-R test-retest data from Handbook ch.27 can set a per-test
      threshold).
- [ ] Short written trend: "Vata has come down over three checks since June."

### [ ] Seasons and travel, compared year on year
- [ ] Save **context** with every Vikriti and Guna result: the season
      (worked out from date and hemisphere), a coarse location (country or
      climate zone only, since precise location is personal data), and
      whether you're travelling or away from home.
- [ ] Compare the same season across years ("autumn 2026 vs autumn 2027"),
      separately from month-to-month change.
- [ ] Flag results taken while travelling or in another climate so they
      don't distort the trend, but still show them.
- Needs a hemisphere or location setting on the profile, plus a "Where are
  you right now?" question on the state tests.

### [ ] Home screen "today" card: what to do, what to avoid
One short card, rebuilt from:
- the current Vikriti (strongest weight), then Prakriti
- the season (temperate cycle, Svoboda ch.4)
- the time of day (e.g. Vata hours pre-dawn and late afternoon)
- the current Guna

It gives a few do's and don'ts, each with a one-line reason and a link to the
source. It stays rule-based and cited, not free-written. The data and
priority order already exist in `profile.ts` (the "practice" section); this
brings it to the front page.

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

### [ ] Short daily or weekly check-in
Three or four quick questions (sleep, digestion, energy, mood) between full
retakes. More data points, little effort, and it feeds the "today" card and
the trends. It must not be mistaken for a Vikriti result: store it
separately and label it clearly.

---

## Later: from static tests to a tool that helps

### [ ] Needs model
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

### [ ] Practice log and feedback loop
- [ ] Record what you actually did (a sequence, a routine change, a food
      change).
- [ ] Later, show what tended to come before an improvement ("Vikriti Vata
      eased in the weeks you kept the morning routine"). Word it as a
      pattern, never as proof.

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
