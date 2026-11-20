# Visitor club: achievement-ladder plans

Date: 2026-11-16. Status: draft for approval. Source of the method: an external distributor's 11-month
sales-force scorecard analysed in `.claude/completions/2026-11-16-scorecard-analysis.md`.

## Intent

The visitor club today scores one way: net rial divided by a fixed rial-per-point, optionally with linear
rules per brand or group. That rewards volume, not performance against a target, so a visitor in a large
territory always wins. The external scorecard shows a method that is fair across territory sizes: each
visitor is measured against their own monthly target on several KPIs, the achievement ratio is turned into a
0 to 25 score through a step ladder, the KPI scores are weighted into one monthly score, the months add up,
and visitors are ranked within a grade and paid by rank.

This design adds that method as a second plan type to the existing visitor club, next to the current linear
plans. It changes nothing for the B2B customer club.

## Decisions taken with the owner

- **Level:** visitors only. Supervisors and branch managers are a later phase on the same engine.
- **Targets:** every KPI target comes from the monthly target file (`tools/monthly-target`). No fallback
  targets are derived from history. A KPI whose target is missing for a month scores zero for that month.
- **Grade:** automatic from sales volume (rial bands set in the plan), not entered by hand.
- **Coexistence:** linear plans stay as they are. A plan has a `plan_type`, `linear` (default, today's
  behaviour) or `ladder` (this design). The 41 existing plans are untouched.
- **Rial actual follows the Target page**, not the club's net-rial rule: promotion rows are included and
  the category set is every target category in the month's target file, core-wide. The ladder reuses
  the Target page's query so the two can never drift.
- **Coverage target arrives from next month's target file onward.** Earlier months are not re-converted.
  A month without the column scores the coverage KPI 0; the plan form's default KPI set therefore ships
  without coverage, and the admin adds it when the column exists.

## Goals

- An admin can define a ladder plan: window, KPIs with weights and ladders, grade bands, prize table.
- The admin leaderboard shows every visitor's monthly scores, total, grade, national rank, branch rank
  and prize for a ladder plan.
- A visitor signed in to the club sees their own report card: monthly scores, this month's KPI table
  (target, actual, achievement, score), rank, distance to the next rank, prize band.
- Rial achievement on the report card equals the achievement the Target page shows for the same visitor
  and month. One number, two pages.
- Everything is computed from DuckDB on request, as the club does today. No new scheduled job.

## Non-goals (this phase)

Supervisor and manager levels; carton volume (no carton factor in our data); collection period (not in
DuckDB); year-over-year growth (data starts 1405/01); VIP, chain-store and competitor-ratio KPIs; paying
the prizes (the table only displays amounts); editing or deleting plans (today's UI only creates).

## Anti-goals

- A ladder plan whose rial achievement disagrees with the Target page, even by rounding. The two must share
  one definition of "actual" and "target".
- Weights that do not sum to one, silently. A plan with bad weights must be refused at creation.
- Scoring a visitor who had no target that month as zero. They must be absent for that month, so a
  newcomer is not ranked below a visitor who scored 2 points.
- Fake numbers on the member page. Today `MyVisitorClub` feeds the activity rings with
  `target_rial = sales × 1.15` and `collection_rate = 0.94`, both invented. For ladder plans the rings
  show real KPI achievements or are hidden.

## Constraints

- Persian RTL UI, Rial amounts, Jalali months; chart containers `direction: ltr`.
- Server code lives in `ubuntu-server/`; `api.py` and `rbac.py` move together. New routes under
  `/api/club/visitor/...` are already covered by the `club_visitor` prefix in `rbac.PREFIX`; any route
  outside that prefix needs its own `EXACT` entry or it is admin-only.
- Club data stays in `club.duckdb`; sales are read through the read-only connection in `club.py`.
- Backend tests in `backend/tests/`; a query change needs a test. Target: 80% coverage of new code.
- Existing style: `AppleCard`, `AppleKpiCard`, `Table`, `PointsChart` in `frontend/src/ClubPages.jsx`.

## The method, precisely

### Inputs per visitor and Jalali month

| Input | Definition | Source |
|---|---|---|
| Target categories | the `target_category` values this visitor has rows for in `fact_target` for the month | `fact_target` |
| Rial target | sum of `target_rial` over the KPI's rows (all rows, or rows whose `product_group` is in the KPI's filter) | `fact_target` |
| Rial actual | sum of `rial_vat` of `fact_sales` rows for the visitor, core `kg`, that month (promotions included, returns negative, exactly as `target.py`), whose product's `dim_product.target_category` is in the month's core-wide target category set, narrowed to the KPI's `product_groups` when given | the `target.py` sales query, extracted into a shared helper |
| Coverage target | the month's `target_coverage` for the visitor (see "Target file") | `fact_target`, new column |
| Coverage actual | distinct `customer_code` with at least one row `NOT is_promo AND NOT is_return` for the visitor that month | `fact_sales` |
| Basket actual | number of the visitor's product groups whose rial achievement that month is at or above the basket threshold (default 0.70) | derived from the two rial inputs per `product_group` |

A visitor-month exists only when `fact_target` has at least one row for that visitor and month. Months
without target rows are skipped for that visitor; tenure = number of visitor-months in the plan window.

**Months, not date windows.** A ladder plan scores whole Jalali months. Creation refuses a `start_key`
that is not the first of a month or an `end_key` that is not the last day of a month (HTTP 400). The
linear engine's clipping in `_month_windows` is not used for ladder plans.

**The current month is provisional.** Months count as *completed* when the last sales date is past their
last day. Total, grade ranks, branch ranks and prize use completed months only. The current month is
scored and shown in its own column, flagged `provisional: true` in the API and labelled «در جریان» in the
UI, with a `rank_month_national` of its own so visitors can watch it move; it enters the total only once
it completes.

Visitor code matching follows `target.py`: the code in the target file, else the sales code of the same
name when that name has exactly one code.

### Ladder lookup

A ladder is an ordered list of `[threshold, score]` steps. The score for a value is the score of the
highest step whose threshold is at or below the value; below the first step the score is 0. Thresholds
are ratios for rial and coverage, counts for basket.

Default achievement ladder (from the source scorecard, each step 1.3 times the previous):

| threshold | 0.60 | 0.70 | 0.80 | 0.90 | 1.05 |
|---|---|---|---|---|---|
| score | 8.75 | 11.38 | 14.79 | 19.23 | 25 |

Default basket ladder: groups at or above 0.70 → `2: 8.75, 3: 11.38, 4: 14.79, 5: 19.23, 6: 25`.

### Monthly score

`month_score = Σ over KPIs of weight × ladder(kpi_value)`. Weights must sum to 1 (tolerance 0.001),
so the monthly maximum is the ladder maximum (25 by default). KPI value for rial and coverage is
`actual / target`; when target is 0 or missing the KPI scores 0 (owner's decision). Negative actual
(returns exceed sales) gives ratio 0.

### Plan total, grade, ranks, prize

- **Total** = sum of monthly scores over the completed months of the plan window. Shown next to it:
  average per visitor-month and tenure. Ranking uses the total, as the source does (my call; the owner
  can switch ranking to the average later with one config flag).
- **Grade** is fixed per visitor for the plan: average monthly rial over the three Jalali months before
  `start_key` (fewer if data starts later; if none, the first month of the window), using the *same
  rial-actual definition as the KPI* (promotions included, returns negative, all of the visitor's sales
  regardless of target category, so that a visitor who had no target file in those months still gets a
  grade). Looked up in the plan's `grade_bands` (ascending `min_rial` → grade letter). Default bands:
  C from 0, B and A thresholds entered by the admin.
- **Ranks**, ties sharing a rank (dense): national overall, national within grade, branch within grade,
  each over completed months; plus `rank_month_national` for the latest month (the plan window's last
  month with sales data, provisional or not). Branch for ranking = the visitor's branch in their most
  recent target month inside the window (a visitor who moves branch is ranked where they are now).
- **Latest month on the scorecard** = the plan window's last month with sales data. A visitor with no
  target rows in that month gets `kpis: []` and a `note` string («این ماه هدفی برای شما ثبت نشده»); the
  UI shows the note in place of the KPI table and the month selector still offers earlier months.
- **Prize** = amount of the `prize_table` row whose `[rank_from, rank_to]` contains the national overall
  plan-to-date rank, else none. Default table empty.

## Target file contract change

The converter `tools/monthly-target/convert_target.py` gains one optional header, «هدف پوشش»: the
visitor's coverage target for the month (whole customers). It is read per row and must be identical on
every row of the same visitor; a conflict is a validation error. When the header is absent the column
is empty. The TSV gains the column `target_coverage` at the end; `app.schema.TARGET_COLS`, `ingest.py`
and `fact_target` gain it with an additive migration (NULL for existing months). Nothing else in the
file changes. `ingest_target` must accept both the legacy 10-column header and the new 11-column one
(coverage NULL for legacy files), so the months already on the server reload without re-conversion.

## Data model

`plans` (club.duckdb) gains two columns through `club_store._migrate`:

- `plan_type VARCHAR` — `linear` or `ladder`; NULL reads as `linear`.
- `config VARCHAR` — JSON for ladder plans:

```json
{
  "kpis": [
    {"key": "rial_total",    "label": "ریالی کل",     "metric": "rial",     "weight": 0.45, "ladder": [[0.6,8.75],[0.7,11.38],[0.8,14.79],[0.9,19.23],[1.05,25]]},
    {"key": "rial_biscuit",  "label": "ریالی بیسکوییت", "metric": "rial",   "weight": 0.15, "product_groups": ["بیسکوییت"], "ladder": [...]},
    {"key": "coverage",      "label": "پوشش",         "metric": "coverage", "weight": 0.25, "ladder": [...]},
    {"key": "basket",        "label": "سبد فروشی",    "metric": "basket",   "weight": 0.15, "threshold": 0.7, "ladder": [[2,8.75],[3,11.38],[4,14.79],[5,19.23],[6,25]]}
  ],
  "grade_bands": [{"grade": "C", "min_rial": 0}, {"grade": "B", "min_rial": 5000000000}, {"grade": "A", "min_rial": 12000000000}],
  "prize_table": [{"rank_from": 1, "rank_to": 1, "amount": 100000000}, {"rank_from": 2, "rank_to": 5, "amount": 80000000}]
}
```

Validation at creation (Pydantic, HTTP 400 in Persian): 1 to 12 KPIs, unique keys, metric in
`rial | coverage | basket`, weights in (0, 1] summing to 1 ± 0.001, ladders non-empty with strictly
increasing thresholds and non-decreasing scores, `product_groups` only on rial, grade bands ascending
with unique letters, prize ranges non-overlapping with `rank_from ≤ rank_to`. `rial_per_point` is not
required for ladder plans (stored as 0).

## API

All under the existing router; the `club_visitor` prefix already grants them to visitor-club users.

- `POST /api/club/visitor/plans` — body gains `plan_type` and `config`. Linear bodies unchanged.
- `GET /api/club/visitor/points?plan_id=` — for ladder plans returns `{plan, months: [{month, completed}…],
  rows}`, one row per visitor: `code, name, branch, grade, tenure, months: {YYYYMM: score}, total,
  average, rank_national, rank_grade, rank_branch, rank_month_national, provisional_month, prize`.
  Sorted by total desc.
- `GET /api/club/visitor/scorecard?plan_id=&code=&month=` — one visitor's report card: everything in
  the leaderboard row plus `kpis` for the chosen month (default latest): `key, label, target, actual,
  ratio, score, weight, weighted`. Admins may pass any code; a club account may only pass its own linked
  code (403 otherwise, same check as `/visitor/team`).
- `GET /api/club/me` and `GET /api/club/visitor/team` — for a ladder plan, `points` is the plan total
  (rounded to 2 decimals), `history` is the monthly scores, `breakdown` is the latest month's KPI
  scores, and `tier` is the grade and ranks. Customer portfolio in `/visitor/team` is unchanged.

## UI

Admin page (`ClubPage kind="visitor"`):

- Plan form: a type switch «خطی / نردبان تحقق». Ladder shows a KPI editor (rows: label, metric, product
  groups for rial, weight, ladder as editable "threshold:score" pairs pre-filled with the default), a
  weight-sum indicator that turns red when not 1, grade bands (two rial thresholds) and a prize table
  (rank range, amount). The rial-per-point field is hidden for ladder plans.
- Points view: for ladder plans a leaderboard table (rank, grade, name, branch, one column per month,
  total, average, tenure, prize). Clicking a row opens the report card below the table.
- Report card (shared component, used by admin and member): header with name, grade, tenure, national
  and branch rank and prize band; a monthly bar chart of scores with a reference line at the ladder
  maximum; a month selector; the KPI table for that month with target, actual, achievement, score and
  weighted score; a one-line summary of the ladder rule so the visitor knows what the next step needs.

Member page (`MyVisitorClub`): for a ladder plan the report card replaces the «کارنامه اختصاصی» card and
the activity rings take their three values from real KPI achievements (rial, coverage, basket; a KPI
the plan lacks leaves its ring empty with the label «تعریف نشده»). For linear plans the rings keep
showing, but fed from real data: rial ring = the visitor's rial achievement for the latest month from
the shared Target helper, coverage ring = active customers this month over the previous month's, and
the collection ring is removed (no source). Customer portfolio and monthly chart stay.

## Tests (backend, `tests/test_club_ladder.py` and `tests/test_convert_target.py`)

1. Ladder lookup: below first step → 0, exact step, between steps, above last step.
2. Hand-computed month: two KPIs with weights 0.6 / 0.4, known target and sales rows → expected score.
3. Weights not summing to 1 → 400; bad ladder → 400.
4. Missing coverage target → coverage KPI 0, other KPIs unaffected.
5. Visitor with no target rows in a month → month absent, tenure excludes it, not ranked below a scored
   visitor for that month.
6. Rial achievement equals `/api/target?by=visitor` achieved_pct for the same visitor and month, with a
   promotion row and a sale in a category only another visitor targets both present in the fixture.
6b. The current month is excluded from total and ranks while provisional and included once the fixture's
   last sales date passes its end; a plan whose keys are not month-aligned is refused with 400.
7. Grade from prior three months and ranks within grade (dense ties).
8. Prize table lookup, including a rank outside every range.
9. Club account can read only its own scorecard.
10. Converter: optional «هدف پوشش» present, absent, and conflicting within one visitor.

Frontend: `Phase*.test.jsx` style smoke test that the ladder plan form refuses weights ≠ 1 client-side
and that the report card renders a KPI table from a fixture.

## Left to the builder

- Exact Pydantic models and the JSON column names inside `config`, as long as the API above holds.
- Whether the leaderboard is computed in one DuckDB query per month or one per KPI; both are fine at
  403 visitors × 12 months.
- Component file layout; the report card should be its own file (`ClubPages.jsx` is already 610 lines).
- Persian labels beyond those given.

## Open questions settled as my calls

- Rank by total, not average (matches the source; flag reserved).
- Grade fixed per plan from the three months before the window, on all sales with the Target page's
  rial definition.
- Prize by national overall rank; grade ranks are informational.
- Dense ranking for ties.
- Negative monthly rial → ratio 0, not negative score.
- Ladder plans are whole-month only; non-aligned date keys are refused.
- The current month is provisional: shown, ranked on its own, excluded from total and prize.
- Branch for ranking = the visitor's most recent target-month branch in the window.
- Latest month = the window's last month with sales data; a visitor without target rows then sees a
  note, not an empty table.
- Linear-plan activity rings stay, fed from real target and coverage data; the invented collection
  ring goes.
- Legacy 10-column target files keep loading; coverage is NULL for them.
