# Rating engine review & best-practice plan

Status: draft · Scope: `src/lib/scoring.ts`, `src/lib/*_mapping.json`, the five
assessment pages, `src/app/results/page.tsx`, `supabase/functions/vedic-chart`,
`supabase/migrations`.

## 1. How results are calculated and saved today

| Instrument | Items / scale | Calculation (`scoring.ts`) | Saved to | Saved fields |
|---|---|---|---|---|
| Big Five (IPIP-50) | 50 × 1–6 Likert | Reverse items `7 - x`; mean per dimension; band lookup in `bigfive_mapping.json` | `bigfive_results` | `answers`, `scores` (1–6 means), `labels` |
| Attachment (ECR-R) | 36 × 1–6 Likert | Reverse `7 - x`; mean per ANX/AVD; `> 4.0` = high; 2×2 quadrant | `ecrr_results` | `answers`, `scores`, `pattern` |
| Guna | 36 × 1–6 Likert, no reverse items | Mean per guna → % of the three means' total → rule cascade | `guna_results` | `answers`, `scores` (**% only**), `pattern` |
| Prakriti (v2, 40 items) | 1–2 ticks per item | 2 pts per single tick, 1+1 for a double; % of 80; Sama / Ekadoshaja / Dvandvaja | `prakriti_results` | `answers`, `scores`, `pattern` |
| Vikriti | 6 items, ticks | Ticks per dosha (0–6) | `prakriti_vikriti_results` | `answers`, `scores` |
| Vedic chart | birth data | Edge function: geocode → timezone → Swiss Ephemeris (Lahiri, whole-sign) | `birth_data`, `vedic_charts` | `chart` jsonb, `ascendant_reliable` |

Flow for every questionnaire: the browser collects answers → **the browser runs
`scoreX()`** → the browser `upsert`s `{user_id, answers, scores, pattern|labels}`
straight into Supabase (RLS: owner-only). The results page reads one row per
table and shows only the label or pattern string.

## 2. What checks out

- **Item keying is correct.** Big Five matches the IPIP-50 keying (EXT 5+/5−,
  AGR 6+/4−, CON 6+/4−, NEU 8+/2−, OPN 7+/3−), and NEU is consistently
  "higher = more reactive" in both scoring and mapping. ECR-R reverse items
  match the published key (anxiety 2, avoidance 12).
- **Every Prakriti item** has exactly one VAT/PIT/KAP option, and the 9+12+8+6+5
  section split adds up to 80 points. The code follows the workbook's rule order.
- **Missing answers can't happen in the UI.** The Likert cards disable "Next"
  until you answer, and Prakriti requires every item, so the band gaps
  (e.g. 2.88 / 2.89) never catch a real 10-item mean.
- **Raw answers are stored.** That's the most important thing to get right, and
  it means every score can be re-derived later.
- The design keeps Vikriti separate from Prakriti, which is correct.
- The edge functions have `verify_jwt = true`.

## 3. Findings

Ordered by impact on "is the logic broken / does the result mean anything".

### A. Logic bugs & inconsistencies

1. **Guna "dominant" rule ignores the runner-up.** The rule checks `first ≥ 45%`
   before the blend rule, with no gap test. Sattva 5.5 / Rajas 5.0 / Tamas 1.0
   → 47.8 / 43.5 / 8.7 % → **"Sattva-dominant"**, but that's a textbook
   Sattva-Rajas blend. The blend rule only fires when `first ≤ 45`, so the
   clearest two-guna profiles are never labelled a blend.
2. **Guna percentages are squashed toward 33%.** The ratio uses 1–6 means, and
   the scale floor is 1, not 0. The most any guna can reach is 75%, and
   S 4.5 / R 3.5 / T 3.0 comes out as **"Balanced / fluid"**. Fix this by
   subtracting 1 (a 0–5 scale) before taking the ratio, or by reporting raw
   means next to the percentages. Also, the fallback label `"{guna}-leaning"`
   has no entry in `guna_mapping.json`, so later interpretation has no
   description for it.
3. **The ECR-R cutoff isn't what the JSON says.** The notes call `4.0` "the
   proportional equivalent of the original 1–7 midpoint". It isn't: 4 on the
   1–7 scale maps to **3.5** on 1–6 (`(4−1)/6·5+1`). `4.0` on 1–6 is about 4.6
   on 1–7, so the engine leans toward "Secure". Either change the cutoff to 3.5
   or fix the note and say the stricter cutoff is intentional.
   (ECR-R has no official cutoffs. Fraley recommends reporting the two
   dimensions, not only the quadrant.)
4. **`prakriti_mapping.json` still describes the old 24-item rules.** It lists
   "≥50% & others <30%", "within 15 → dual", and "Tridoshic". `scoring.ts` and
   `prakriti.json` now use Sama → Ekadoshaja (lead ≥15) → Dvandvaja, with the
   label `"Sama (Tridoshaja)"`. Anything that reads the mapping, such as the
   planned synthesis prompt, gets rules and labels that don't match the stored
   `pattern`.
5. **Mapping bands are defined but never used.** That covers the ECR-R ANX/AVD
   bands, the Guna raw-mean bands, and every description text. The results page
   shows bare labels (`EXT → Outgoing`) with no score, no description and no
   explanation. That's most of the "added value" gap today.

### B. Data integrity & storage

6. **No instrument or scoring version on any row, and Prakriti was already
   swapped.** Commit `3829f96` replaced the 24-item Prakriti with the 40-item
   one and **reused the item IDs `P01…P24`** with different questions and a
   different answer shape (`"option text"` → `["VAT"]`). Any v1 rows still in
   `prakriti_results` show the old rule set's pattern, and no column marks
   them. If they're re-scored with the current `scorePrakriti`, a string answer
   iterates character by character and produces `NaN` silently, with no error.
7. **Scores are computed in the browser and written by the browser.** RLS lets
   the owner write any `scores`/`pattern`, so the stored score isn't guaranteed
   to match `answers`, or the current code. Fine for a spike, not for a system
   of record.
8. **One row per user, overwritten on retake.** `upsert` on `user_id` plus a
   `completed_at` update trigger means history is lost. That hurts most for
   Vikriti, which the migration itself says is "meant to be retaken far more
   often". It also rules out test–retest checks.
9. **The schema isn't in version control.** The only migration is Vikriti, and
   it calls `public.set_completed_at()`, which isn't defined in the repo. The
   `bigfive_results`, `ecrr_results`, `guna_results`, `prakriti_results`,
   `birth_data` and `vedic_charts` tables exist only in the hosted project.
10. **Result shapes differ by instrument.** Big Five has `labels`, the others
    have `pattern`. Guna stores only percentages, not the means. Vikriti stores
    counts. Vedic stores a nested chart. A merge step would need special
    handling for every table.
11. **Vikriti isn't wired up.** `scoreVikriti` and the table exist, but there's
    no page, no entry in `progress.ts`, and no results section.
12. **No response-quality checks.** Straight-lining (all 4s) and a
    reverse-keyed contradiction ("I'm quiet" plus "I'm talkative" both at 6)
    go through as valid profiles.

### C. Vedic chart function

13. **The nakshatra width is `13.3333`, not `360/27`.** For a longitude above
    about 359.999°, `floor(norm / 13.3333)` gives 27 and
    `nakshatras[27]` → crash. The pada boundaries also drift slightly.
14. **An unknown birth time silently defaults to 12:00.** The Moon moves about
    13° a day, which is about one nakshatra, so with no time the Moon's
    nakshatra, and sometimes its sign, can be wrong. `ascendant_reliable`
    covers the ascendant but not the Moon. Compute the Moon at 00:00 and 23:59
    and flag `moon_reliable=false` when the sign or nakshatra changes. That
    matters because Chandra Lagna is the fallback shown to users.
15. Smaller issues:
    - TimeZoneDB is called over plain `http://`, so the API key goes out in
      cleartext.
    - The UTC offset is resolved at noon UTC, which can be an hour off on
      DST-change days.
    - Ketu is derived from Rahu's *rounded* degree.
    - The WASM file is downloaded on every request.

## 4. Best-practice approach

### 4.1 Principles

1. **Answers are the source of truth. Scores are derived and versioned.** Any
   score must be reproducible from `answers` + `scoring_version`.
2. **Score on the server.** The client submits answers only. A Postgres
   function or edge function / route handler validates them against the
   instrument (IDs, value range, completeness, ≤2 ticks) and writes the scores.
   Revoke client `insert/update` on score columns.
3. **Append-only history.** Every completion is a new row, and "current" is a
   view.
4. **Keep the rules in one place.** Thresholds and labels live in the mapping
   JSON, and the code reads them from there. Store the rules in one place, not
   once in `scoring.ts` and again in `prakriti.json` and the mapping file.
5. **Store dimensions, not only categories.** Categories are for display. Merge
   logic works on continuous, normalised scores and uses distance-to-boundary
   as confidence.

### 4.2 Unified result schema (proposal)

```sql
create table assessment_results (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  instrument          text not null,          -- 'bigfive' | 'ecrr' | 'guna' | 'prakriti' | 'vikriti'
  instrument_version  text not null,          -- e.g. 'prakriti@2-govardhan40'
  scoring_version     text not null,          -- bump whenever scoring.ts / mapping rules change
  answers             jsonb not null,
  raw_scores          jsonb not null,         -- native units: means, points, ticks
  norm_scores         jsonb not null,         -- every dimension on 0–100
  classification      jsonb not null,         -- { label, rule, runner_up, margin }
  quality             jsonb not null,         -- { straightline, inconsistency, duration_s, flags[] }
  completed_at        timestamptz not null default now()
);
create index on assessment_results (user_id, instrument, completed_at desc);

create view current_results as
  select distinct on (user_id, instrument) *
  from assessment_results
  order by user_id, instrument, completed_at desc;
```

Keep `vedic_charts` separate, since it's calculated rather than
self-reported. Add `engine_version`, `ayanamsa`, `house_system`, and
`moon_reliable`.

Each `scoreX()` should return the same envelope:

```ts
interface ScoredResult {
  instrument: string;
  instrumentVersion: string;
  scoringVersion: string;
  raw: Record<string, number>;
  norm: Record<string, number>;          // 0–100
  classification: { label: string; rule: string; runnerUp?: string; margin: number };
  quality: { straightline: boolean; inconsistency?: number; flags: string[] };
}
```

### 4.3 Migration steps (before any merge)

1. `supabase db pull` → commit the current schema, including
   `set_completed_at`.
2. Create `assessment_results` and backfill it from the five legacy tables.
   Tag the legacy Prakriti rows (answers are strings) as `prakriti@1` and don't
   re-score them with v2. Ask those users to retake.
3. Re-score every backfilled row on the server with the current code, and diff
   against the stored `scores/pattern`. Any mismatch is either a client
   tampering case or a logic change. Look at them before trusting the data.
4. Move the pages to "submit answers → server scores".
5. Retire the per-instrument tables, or turn them into views, for
   compatibility.

### 4.4 Fix the scoring logic (each change bumps `scoring_version`)

- Guna: use `(mean − 1)` for the ratio, and add a margin test to "dominant"
  (e.g. `first ≥ 45 && first − second ≥ 10`, else blend). Add "leaning" to
  the mapping.
- ECR-R: decide between 3.5 and 4.0 and document it. Save the ANX/AVD band
  labels as well as the quadrant.
- Prakriti: rewrite `prakriti_mapping.json` to match the rules actually in use.
  Return `margin` so the ±2–3 point "read against both profiles" note in the
  workbook can show up in the UI.
- Vedic: use `360/27` and `360/108`, derive Ketu from the unrounded
  longitude, add `moon_reliable`, use HTTPS for TimeZoneDB, and cache the WASM
  at module scope.

### 4.5 Test harness (none exists today)

Add `vitest` and golden-vector tests per instrument:

- Hand-computed fixtures: all-min, all-max, all-mid, and each classification
  branch, including exact boundaries (45.00%, a 15-point lead, ANX = 4.0).
- Invariants: Guna and Prakriti percentages add up to 100 ± 0.01; reverse
  scoring is its own inverse; each Prakriti item adds 2 points in total.
- A **consistency test** that loads every mapping JSON and checks that each
  label `scoring.ts` can emit has a mapping entry. That would have caught
  findings 2 and 4.
- Edge function: 3–4 known charts compared against a reference such as Jagannatha Hora or
  astro-seek, plus a test at 359.9999°.

### 4.6 Merging into one profile

**Decision: the frameworks have equal standing.** This is a Vedic app. Guna and
Prakriti are not "lenses" that decorate the Big Five; each framework describes
the person in its own terms, and none of them overrides another. The merge adds
value by putting them in dialogue:

1. **Normalise first.** Every dimension is stored on 0-100 (`norm`), with a
   `margin` for the classification. Guna and Prakriti also keep their relative
   `shares`, because in those traditions the balance between the three is the
   point.
2. **Read each result in its own frame first,** then look across frameworks.
3. **Name the expected resonances up front:**
   - Tamas ↔ high NEU and low CON
   - Sattva ↔ high CON and low NEU
   - Rajas ↔ high EXT and NEU
   - Vata ↔ high NEU and OPN
   - Pitta ↔ high CON and low AGR
   - Kapha ↔ low NEU and high AGR
   - ECR-R Anxiety ↔ NEU

   Where they resonate, say so with confidence. Where they don't, that is
   information too: e.g. "constitutionally Kapha, currently Vata Vikriti and
   high NEU" means the current state has moved away from the nature.
4. **Confidence comes from data quality,** not from which framework it is: a
   low margin, a quality flag, or an unknown birth time mean hedged wording,
   whichever instrument it came from.
5. **Respect what each instrument is for** (`kind` in `src/lib/instruments.ts`):

   | Instrument | Kind | What a retake means | Suggested retake |
   |---|---|---|---|
   | Prakriti | constitution | Consistency check. The nature doesn't change, so a different result means re-check, not growth | yearly |
   | Vikriti | state | The main progression tracker for the Ayurvedic side, read against Prakriti | every 4 weeks |
   | Guna | state | Shifts with sadhana; rising Sattva is the traditional aim | monthly |
   | Big Five, ECR-R | trait | Slow change over months | every 6 months |

6. **Build the synthesis from `current_assessment_results` plus
   `baseline_assessment_results`,** as one versioned JSON input. Store the
   output with the result ids it used.
7. **Measure every instrument the same way once data exists** (about 100
   users): internal consistency (Cronbach's α) per scale, test–retest, and the
   resonances above. Prakriti's stability across retakes is itself a check the
   tradition predicts, which makes it a good way to show the instrument works.

## 5. Baseline and progression (implemented)

- Every completion is a new row in `assessment_results`; nothing is
  overwritten. The first row per instrument is the **baseline**.
- All existing results are copied in once as `source = 'legacy_backfill'`, so
  early results become the baseline. The legacy tables are left untouched.
- On read, rows on the current item set are **re-scored with the current
  rules**, so the change between baseline and latest reflects the person, not a
  rule change. No stored results come from an older item set (confirmed: no
  data from the 24-item Prakriti or the 1-5 Big Five). If items change in
  future, older rows keep their stored result and are shown as "not
  comparable".
- The results page shows the latest result, the baseline, the change per
  dimension (under 5 points is shown as "steady"), a consistency note for
  Prakriti, Vikriti read against Prakriti, and a "Retake due" marker on the
  home page once the suggested interval has passed.

## 6. Status

Done on this branch:

- Scoring engine rewrite (`src/lib/scoring.ts`): one result format for every
  instrument, thresholds read from the mapping files, answer validation,
  quality flags.
- Logic fixes: findings 1-5 (Guna floor and lead rule, "leaning" defined, ECR-R
  cutoff 3.5, Prakriti mapping rewritten), plus the band gap.
- Server-side scoring (`src/app/actions/assessments.ts`). The browser sends
  answers only.
- Append-only `assessment_results` table with backfill, and the
  `current_`/`baseline_assessment_results` views
  (`supabase/migrations/20260925000000_assessment_results.sql`).
- Vikriti page, results page with baseline and progression, retake reminders.
- One shared Likert component (questionnaire drafts survive a reload) and one
  shared tick component (fixed per-item option order, no hydration workaround).
- Vedic function: exact nakshatra spans, Ketu from the unrounded longitude,
  `moon_reliable` and `moon_range` for unknown birth times, HTTPS for
  TimeZoneDB, WASM cached per worker.
- `npm test`: 27 golden-vector tests (vitest).

Also done:

- **Per-test analysis** (`src/lib/analysis/`), shown under each result as
  "Read the analysis". It is rule-based: every sentence comes from a content
  file (`analysis/bigfive.json`, `ecrr.json`, `guna.json`, plus the existing
  `prakriti_dosha_guide.json` and mapping files), selected by the scores. No
  API call, so it is free, instant, the same every time, testable, and can't
  invent claims. The Prakriti analysis follows the guide's display rules: only
  the dosha(s) named in the result are shown.
- **Combined profile** at `/profile` (`src/lib/profile.ts`): your nature
  (Prakriti, Big Five, Vedic chart), right now (Guna, Vikriti), relationships
  (ECR-R), where the frameworks meet and where they differ
  (`analysis/resonances.json`), change since baseline, and what to practise
  now (current Vikriti imbalance first, then constitution, Guna and
  attachment).
- `buildSynthesisInput()`: the same information as one versioned JSON
  document, ready for an optional written narrative by a language model later.

Open:

1. Commit the live schema (`supabase db pull`); see roadblocks.
2. Content review: all interpretive text should be read by someone who teaches
   these frameworks before launch.
3. Nakshatra interpretations: the Vedic chart has no interpretive content yet,
   so the profile shows chart facts only.
4. Optional: an LLM-written narrative on top of `buildSynthesisInput()`.

## 6b. Content sources

Each content file carries a `sources` block with its basis and review status.

| Test | Basis | Inspiration / further reading | What's been done | Needs the book |
|---|---|---|---|---|
| Big Five | b5-result-text (MIT), itself reproducing John A. Johnson's IPIP-NEO report | Nettle, *Personality* | Trait overviews rewritten from the base text; costs-and-benefits framing throughout | Check framing against Nettle |
| Attachment | Research model | Mikulincer & Shaver, *Attachment in Adulthood*; practical tips from Levine & Heller, *Attached* (not its fixed types) | Added hyperactivating/deactivating explanation and "it can change" (earned security) | Check wording against both |
| Guna | Bhagavad Gita 14, 17 | Easwaran's translation; Frawley, *Ayurveda and the Mind* | Own paraphrase with verse numbers (14.6-8, 14.11-13, 17.8-10); dosha-through-guna reading in the profile | Check paraphrases against Easwaran, dosha-guna text against Frawley |
| Prakriti / Vikriti | Govardhan workbook (unchanged) | Svoboda, *Prakriti*; Lad, *Science of Self-Healing* | Sources recorded only | Extend from the books |
| Nakshatras | Standard facts: deity, symbol, ruler, gana | Harness, *The Nakshatras*; *Brihat Jataka* | 27 draft entries, `reviewed: false`, shown only when the Moon's nakshatra is certain | Check every entry against *Brihat Jataka* and Harness |

Nothing in these files is copied from a copyrighted book: the books couldn't be
accessed from the build environment, so the content reflects their widely
published concepts. archive.org (for the public-domain *Brihat Jataka* and old
Gita translations) is blocked by the environment's network policy; allowing it
would let the classical texts be checked directly.

## 7. Roadblocks and things to do differently

1. **Deploy order matters.** Apply the migration and set
   `SUPABASE_SERVICE_ROLE_KEY` (server-only, never `NEXT_PUBLIC_`) in Vercel
   **before** this reaches `main`. Otherwise every submit fails. Vercel preview
   deployments of this branch point at the same Supabase project, so they fail
   to save until then too.
2. **Most of the schema isn't in the repo.** Run `supabase db pull` to capture
   the legacy tables and `set_completed_at()`. Otherwise `supabase db push`
   and fresh local databases don't match production. The new migration guards
   the backfill so it still runs on a fresh database.
3. **Health and birth data.** Vikriti answers are symptoms, and birth date and
   place identify people. Under GDPR (EU users) symptom data is special-category
   health data. That calls for explicit consent before the Vikriti check, a way
   to export and delete one's data, and no symptom data in logs. Account
   deletion already cascades.
4. **The synthesis should never get only the labels.** Give it `norm`,
   `margin`, `flags` and the baseline. The label alone loses the uncertainty
   that makes the reading honest.
5. **Retaking too soon.** People remember their answers for a few weeks, so
   retakes inside that window mostly measure memory. The suggested intervals are
   shown but not enforced. Enforce a minimum (e.g. 14 days) if retake data will
   be analysed.
6. **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The build warns about
   it; migrate with `npx @next/codemod@canary middleware-to-proxy .`.
7. **Timezones.** The UTC offset is resolved at noon UTC on the birth date, so
   births on a DST-change day can be an hour off. TimeZoneDB's history before
   1970 is patchy (relevant for older users and pre-1947 India).
8. **Changing rules later.** Any change to `scoring.ts` or a mapping file needs
   a `scoringVersion` bump in `src/lib/instruments.ts`, and any change to items
   needs a new `instrumentVersion` (never reuse item ids). The tests catch a
   label without a mapping entry but not a forgotten version bump.
