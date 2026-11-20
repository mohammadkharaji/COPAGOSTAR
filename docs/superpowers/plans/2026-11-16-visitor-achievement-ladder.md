# Visitor Achievement-Ladder Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second visitor-club plan type that scores each visitor against their monthly targets through weighted step ladders, ranks them within grade, and shows a report card to admins and to the visitor.

**Architecture:** A pure scoring module (`club_ladder.py`) turns per-visitor-month inputs into KPI scores, monthly scores, grades, ranks and prizes with no I/O. A data module (`club_ladder_data.py`) reads targets and sales through a sales query extracted from `target.py` so the Target page and the club share one definition of "actual". `club.py` branches on `plan_type` and exposes the leaderboard and scorecard routes; the React club page gets a ladder plan form, a leaderboard and a shared report-card component.

**Tech Stack:** Python 3.11+, FastAPI, Pydantic v2, DuckDB, pytest; React 19, Vite, Tailwind 4, Recharts, bun test.

**Spec:** `docs/superpowers/specs/2026-11-16-visitor-achievement-ladder-design.md`

## Global Constraints

- All code changes are made in `ubuntu-server/` (the only committed copy); `D:\SR` is updated by copying the same files after each task. Commits go to `ubuntu-server` on `main`.
- Backend tests: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q <file>`. The whole suite must stay green (`test_sql_source` fails there by design, see CLAUDE.md).
- Frontend tests: `cd ubuntu-server/frontend && bun test src/<file>`; build check `npm run build`.
- Every new route lives under `/api/club/visitor/` so the existing `club_visitor` prefix in `rbac.PREFIX` covers it; no new `EXACT` entries are needed, and no route may be added outside that prefix.
- UI text is Persian, RTL; chart containers `dir="ltr"`. Amounts in Rial, months as Jalali `YYYYMM`.
- Default achievement ladder: `[[0.6, 8.75], [0.7, 11.38], [0.8, 14.79], [0.9, 19.23], [1.05, 25]]`. Default basket ladder: `[[2, 8.75], [3, 11.38], [4, 14.79], [5, 19.23], [6, 25]]`. Default basket threshold `0.7`. Weight-sum tolerance `0.001`.
- Rial actual = `SUM(rial_vat)` of `fact_sales` rows for the core and month, promotions included, returns negative, limited to products whose `dim_product.target_category` is in the month's core-wide target-category set. Identical to `target.py`.
- Sales rows carry `rial_vat` with sign already applied for returns (see `test_target.py`: a return row of `-200` is summed as is).
- Immutable style in new code: build new dicts/lists, do not mutate inputs. No `console.log`. Files under 800 lines; `ClubPages.jsx` is 610 lines, so new UI goes in new files.

## Review Focus

1. A visitor whose rial actual is negative for a month (returns exceed sales): ratio must clamp to 0, score 0, not a negative number or a crash. Pinned in Task 1 (`test_kpi_value_clamps_and_handles_missing_target`) and Task 5 (رضا's row).
2. A target row whose `visitor_code` is empty but whose name is unique in sales must be matched by name, exactly as the Target page does; otherwise that visitor silently vanishes from the leaderboard. Pinned in Task 4 (رضا has no code in the fixture).
3. A plan window that starts before the first loaded target month: those months produce no visitor-months and tenure must not count them. Pinned in Task 4 (`140506` requested, absent).
4. Legacy 10-column target TSVs on the server must keep loading after `TARGET_COLS` grows. Pinned in Task 3.
5. A ladder-plan body posted to the B2B club (`/api/club/b2b/plans`) must be refused with 400, since only visitors have targets. Pinned in Task 5.

---

## File structure

| File | Responsibility |
|---|---|
| `backend/app/club_ladder.py` (new) | Pure scoring: ladder lookup, KPI scoring, monthly score, grade, ranks, prize, `LadderConfig` Pydantic model. No DB. |
| `backend/app/club_ladder_data.py` (new) | Reads visitor-months (targets, actuals, coverage, basket) from DuckDB and builds the leaderboard and scorecard dicts using `club_ladder`. |
| `backend/app/target_sales.py` (new) | `month_sales(con, core_name, ym, scope, args)` and `match_visitor_codes(...)`, extracted from `target.py` and reused by it. |
| `backend/app/target.py` | Calls the extracted helpers; behaviour unchanged. |
| `backend/app/schema.py`, `ingest.py` | `target_coverage` column; legacy header accepted. |
| `tools/monthly-target/convert_target.py` | Optional «هدف پوشش» header. |
| `backend/app/club_store.py` | `plan_type`, `config` columns. |
| `backend/app/club.py` | `plan_type` on `PlanBody`, ladder branch in `points`, new `scorecard` route, ladder shape in `/me` and `/visitor/team`. |
| `frontend/src/club/LadderPlanForm.jsx` (new) | KPI editor, grade bands, prize table, weight-sum guard. |
| `frontend/src/club/LadderLeaderboard.jsx` (new) | Leaderboard table for ladder plans. |
| `frontend/src/club/ReportCard.jsx` (new) | Shared report card (admin and member). |
| `frontend/src/club/ladder.js` (new) | Client-side validation and defaults shared by form and tests. |
| `frontend/src/ClubPages.jsx` | Type switch in `PlanForm`, ladder branch in `PointsView` and `MyVisitorClub`, real ring data. |

Tests: `backend/tests/test_club_ladder.py` (pure), `backend/tests/test_club_ladder_api.py` (routes), additions to `backend/tests/test_target.py` and `backend/tests/test_convert_target.py`, `frontend/src/club/ladder.test.jsx`.

---

### Task 1: Pure scoring module

**Files:**
- Create: `backend/app/club_ladder.py`
- Test: `backend/tests/test_club_ladder.py`

**Interfaces:**
- Produces:
  - `DEFAULT_LADDER: list[list[float]]`, `DEFAULT_BASKET_LADDER: list[list[float]]`, `DEFAULT_BASKET_THRESHOLD = 0.7`
  - `class Kpi(BaseModel)`: `key: str`, `label: str`, `metric: Literal["rial","coverage","basket"]`, `weight: float (gt=0, le=1)`, `ladder: list[list[float]]`, `product_groups: list[str] | None = None`, `threshold: float = 0.7`
  - `class GradeBand(BaseModel)`: `grade: str`, `min_rial: float (ge=0)`
  - `class PrizeRow(BaseModel)`: `rank_from: int (ge=1)`, `rank_to: int (ge=1)`, `amount: float (ge=0)`
  - `class LadderConfig(BaseModel)`: `kpis: list[Kpi]` (1..12), `grade_bands: list[GradeBand]`, `prize_table: list[PrizeRow]`; a `model_validator` enforcing: unique keys, weights sum to 1 ± 0.001, ladders non-empty with strictly increasing thresholds and non-decreasing scores, `product_groups` only when `metric == "rial"`, grade bands ascending by `min_rial` with unique letters, prize ranges `rank_from <= rank_to` and pairwise non-overlapping. Each violation raises `ValueError` with a Persian message.
  - `ladder_score(ladder: list[list[float]], value: float) -> float`
  - `kpi_value(kpi: Kpi, target: float | None, actual: float, basket_groups: int) -> float` (ratio for rial/coverage clamped at 0; `basket_groups` for basket; 0 when target is None or 0)
  - `month_score(config: LadderConfig, inputs: dict[str, tuple[float | None, float]], basket_groups: int) -> tuple[float, list[dict]]` returning `(score, kpis)` where each kpi dict is `{key, label, target, actual, ratio, score, weight, weighted}`
  - `grade_for(bands: list[GradeBand], avg_rial: float) -> str` (highest band whose `min_rial <= avg_rial`; `"C"` when bands empty)
  - `dense_ranks(values: dict[str, float]) -> dict[str, int]` (higher value → rank 1; equal values share a rank; next rank is previous + 1)
  - `prize_for(table: list[PrizeRow], rank: int | None) -> float | None`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_club_ladder.py
import pytest
from pydantic import ValidationError
from app import club_ladder as L

LAD = L.DEFAULT_LADDER

def test_ladder_score_steps():
    assert L.ladder_score(LAD, 0.59) == 0
    assert L.ladder_score(LAD, 0.6) == 8.75
    assert L.ladder_score(LAD, 0.85) == 14.79
    assert L.ladder_score(LAD, 1.05) == 25
    assert L.ladder_score(LAD, 3.0) == 25

def test_kpi_value_clamps_and_handles_missing_target():
    rial = L.Kpi(key="r", label="ریالی", metric="rial", weight=1, ladder=LAD)
    assert L.kpi_value(rial, 1000, -200, 0) == 0          # returns exceed sales
    assert L.kpi_value(rial, None, 500, 0) == 0           # no target
    assert L.kpi_value(rial, 0, 500, 0) == 0
    assert L.kpi_value(rial, 1000, 850, 0) == pytest.approx(0.85)
    basket = L.Kpi(key="b", label="سبد", metric="basket", weight=1, ladder=L.DEFAULT_BASKET_LADDER)
    assert L.kpi_value(basket, None, 0, 4) == 4

def test_month_score_weights_two_kpis():
    cfg = L.LadderConfig(kpis=[
        L.Kpi(key="rial", label="ریالی", metric="rial", weight=0.6, ladder=LAD),
        L.Kpi(key="cov", label="پوشش", metric="coverage", weight=0.4, ladder=LAD)],
        grade_bands=[], prize_table=[])
    score, kpis = L.month_score(cfg, {"rial": (1000, 850), "cov": (50, 50)}, 0)
    # rial 0.85 -> 14.79 * 0.6 = 8.874 ; coverage 1.0 -> 19.23 * 0.4 = 7.692
    assert score == pytest.approx(16.566)
    assert [k["key"] for k in kpis] == ["rial", "cov"]
    assert kpis[0]["weighted"] == pytest.approx(8.874) and kpis[1]["ratio"] == 1.0

@pytest.mark.parametrize("bad", [
    {"kpis": [{"key": "a", "label": "a", "metric": "rial", "weight": 0.5, "ladder": LAD}]},                   # sum 0.5
    {"kpis": [{"key": "a", "label": "a", "metric": "rial", "weight": 1, "ladder": [[0.9, 25], [0.6, 8]]}]},   # not increasing
    {"kpis": [{"key": "a", "label": "a", "metric": "coverage", "weight": 1, "ladder": LAD, "product_groups": ["x"]}]},
    {"kpis": [{"key": "a", "label": "a", "metric": "rial", "weight": 0.5, "ladder": LAD},
              {"key": "a", "label": "b", "metric": "rial", "weight": 0.5, "ladder": LAD}]},                      # dup key
])
def test_config_rejects_bad_shapes(bad):
    with pytest.raises(ValidationError):
        L.LadderConfig(grade_bands=[], prize_table=[], **bad)

def test_prize_ranges_must_not_overlap():
    with pytest.raises(ValidationError):
        L.LadderConfig(kpis=[L.Kpi(key="a", label="a", metric="rial", weight=1, ladder=LAD)], grade_bands=[],
                       prize_table=[{"rank_from": 1, "rank_to": 3, "amount": 1}, {"rank_from": 3, "rank_to": 5, "amount": 1}])

def test_grade_ranks_and_prize():
    bands = [L.GradeBand(grade="C", min_rial=0), L.GradeBand(grade="B", min_rial=5e9), L.GradeBand(grade="A", min_rial=12e9)]
    assert L.grade_for(bands, 4.9e9) == "C" and L.grade_for(bands, 5e9) == "B" and L.grade_for(bands, 20e9) == "A"
    assert L.grade_for([], 1) == "C"
    assert L.dense_ranks({"a": 10, "b": 10, "c": 7, "d": 0}) == {"a": 1, "b": 1, "c": 2, "d": 3}
    table = [L.PrizeRow(rank_from=1, rank_to=1, amount=100), L.PrizeRow(rank_from=2, rank_to=5, amount=80)]
    assert L.prize_for(table, 1) == 100 and L.prize_for(table, 4) == 80
    assert L.prize_for(table, 6) is None and L.prize_for(table, None) is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_club_ladder.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.club_ladder'`

- [ ] **Step 3: Implement `backend/app/club_ladder.py` with the Interfaces above**

Ladder lookup: iterate steps in order, keep the score of the last step whose threshold `<= value`. Dense ranks: sort distinct values descending, map each to its 1-based index. Pydantic v2 (`model_validator(mode="after")`). Module docstring states it holds no I/O.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_club_ladder.py`
Expected: `8 passed`

- [ ] **Step 5: Copy to the working copy and commit**

```bash
cp ubuntu-server/backend/app/club_ladder.py backend/app/ && cp ubuntu-server/backend/tests/test_club_ladder.py backend/tests/
git -C ubuntu-server add backend/app/club_ladder.py backend/tests/test_club_ladder.py
git -C ubuntu-server commit -m "feat(club): pure achievement-ladder scoring module"
```

### Task 2: Extract the Target page's sales query into a shared helper

**Files:**
- Create: `backend/app/target_sales.py`
- Modify: `backend/app/target.py:88-110` (the `by_name` and `sales` queries and the code-matching comprehension)
- Test: `backend/tests/test_target.py` (existing tests must stay green; one new test)

**Interfaces:**
- Produces:
  - `month_sales(con, core_name: str, ym: str, scope: str = "", scope_args: list | None = None) -> list[tuple]` returning `(branch, group_name, visitor_code, target_category, day, rial)` rows, promotions included, exactly the query now inline in `target.py`.
  - `visitor_codes_by_name(con, core_name: str) -> dict[str, tuple[str, int]]` (`name -> (any code, distinct code count)`), the `by_name` query.
  - `resolve_code(code: str | None, name: str, by_name: dict) -> str | None`: the code when present, else the unique code for the name, else None.

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/test_target.py
def test_month_sales_helper_matches_report(client):
    from app import target_sales
    from app.db import connect
    con = connect(read_only=True)
    try:
        rows = target_sales.month_sales(con, "کوپا گستر", "140507")
        by_name = target_sales.visitor_codes_by_name(con, "کوپا گستر")
    finally:
        con.close()
    # 1000 - 200 + 70 (no category) for visitor 11; 500 + 50 promo for visitor 12; 300 for 13
    by_code = {}
    for _, _, code, _, _, rial in rows:
        by_code[code] = by_code.get(code, 0) + rial
    assert by_code == {"11": 870, "12": 550, "13": 300}
    assert target_sales.resolve_code("", "رضا احمدی", by_name) == "12"
    assert target_sales.resolve_code("", "ویزیتور جدید", by_name) is None
    assert target_sales.resolve_code("99", "رضا احمدی", by_name) == "99"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_target.py::test_month_sales_helper_matches_report`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.target_sales'`

- [ ] **Step 3: Create `target_sales.py` and make `target.py` call it**

Move the two SQL strings verbatim; `target.py` passes `s_scope, s_sargs` into `month_sales` and replaces its `trows` comprehension with `resolve_code`. No other change in `target.py`.

- [ ] **Step 4: Run the whole target test file**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_target.py`
Expected: all pass (10 before + 1 new)

- [ ] **Step 5: Copy and commit**

```bash
cp ubuntu-server/backend/app/target_sales.py ubuntu-server/backend/app/target.py backend/app/ && cp ubuntu-server/backend/tests/test_target.py backend/tests/
git -C ubuntu-server add backend/app/target_sales.py backend/app/target.py backend/tests/test_target.py
git -C ubuntu-server commit -m "refactor(target): extract month sales and visitor-code matching for reuse"
```

### Task 3: Target file gains an optional coverage column

**Files:**
- Modify: `backend/app/schema.py:33-34` (`TARGET_COLS`), `backend/app/ingest.py:181-233` (`ingest_target`), `tools/monthly-target/convert_target.py:47-51` (`REQUIRED_HEADERS`), `:107-172` (`convert`)
- Test: `backend/tests/test_target.py`, `backend/tests/test_convert_target.py`

**Interfaces:**
- Produces: `TARGET_COLS` ends with `"target_coverage"`; `fact_target.target_coverage DOUBLE` (NULL when absent); converter header map gains `"هدف پوشش": "coverage"` as optional; TSV rows gain an 11th field (empty string when the header is absent).

- [ ] **Step 1: Write the failing tests**

```python
# append to backend/tests/test_target.py
def test_legacy_ten_column_target_file_still_loads(client, tmp_path):
    legacy_cols = [c for c in TARGET_COLS if c != "target_coverage"]
    body = "\x1f".join(legacy_cols) + "\x1e" + "\x1f".join(
        ["140508", "شعبه تهران", LINE, "دسته A", "گروه", "11", "علی رضایی", "س", "م", "900"]) + "\x1e"
    (tmp_path / "raw" / "target_kg_140508.tsv").write_text(body, encoding="utf-8")
    from app import ingest
    from app.db import connect
    assert any(r["file"] == "target_kg_140508.tsv" and r["status"] == "loaded" for r in ingest.ingest_all())
    con = connect(read_only=True)
    try:
        assert con.execute("SELECT target_coverage FROM fact_target WHERE month='140508'").fetchone() == (None,)
    finally:
        con.close()

def test_coverage_column_is_loaded_when_present(client, tmp_path):
    (tmp_path / "raw" / "target_kg_140509.tsv").write_text(target_tsv(
        trow("شعبه تهران", "دسته A", 900, "11", "علی رضایی", month="140509") [:-1] + ["25"]), encoding="utf-8")
    from app import ingest
    from app.db import connect
    ingest.ingest_all()
    con = connect(read_only=True)
    try:
        assert con.execute("SELECT target_coverage FROM fact_target WHERE month='140509'").fetchone() == (25.0,)
    finally:
        con.close()
```

Adjust `trow` in `test_target.py` to append `cov=""` as an 11th field so `target_tsv` rows match the grown `TARGET_COLS`.

```python
# append to backend/tests/test_convert_target.py
def test_optional_coverage_header_is_read(tmp_path):
    rows = [HEADER + ["هدف پوشش"], ROW + ["40"], ["شعبه تهران", "لاین سوپرمارکت", "دسته B", "گروه", "11", "علی رضایی", "500", "سرپرست ۱", "مدیر ۱", "40"]]
    tsv, _ = ct.convert(make_workbook(tmp_path / "t.xlsx", rows), "1405/07")
    assert all(r[-1] == "40" for r in tsv) and len(tsv[0]) == 11

def test_missing_coverage_header_gives_empty_field(tmp_path):
    tsv, _ = ct.convert(make_workbook(tmp_path / "t.xlsx"), "1405/07")
    assert tsv[0][-1] == "" and len(tsv[0]) == 11

def test_conflicting_coverage_for_one_visitor_is_rejected(tmp_path):
    rows = [HEADER + ["هدف پوشش"], ROW + ["40"], ["شعبه تهران", "لاین سوپرمارکت", "دسته B", "گروه", "11", "علی رضایی", "500", "سرپرست ۱", "مدیر ۱", "41"]]
    with pytest.raises(ct.TargetError):
        ct.convert(make_workbook(tmp_path / "t.xlsx", rows), "1405/07")
```

`make_workbook` uses `cols = "ABCDEFGHIJ"`; extend it to `"ABCDEFGHIJK"`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_target.py tests/test_convert_target.py`
Expected: the five new tests FAIL; the rest pass.

- [ ] **Step 3: Implement**

`schema.py`: append `"target_coverage"` to `TARGET_COLS`. `ingest.py`: accept `sorted(cols)` equal to either the full set or the set minus `target_coverage`; when absent, write `""` for it; add `ALTER TABLE fact_target ADD COLUMN target_coverage DOUBLE` guarded by `CatalogException` next to `TARGET_DDL` creation; cast with `TRY_CAST(... AS DOUBLE)` like `target_rial`. Converter: `OPTIONAL_HEADERS = {"هدف پوشش": "coverage"}`; `_column_map` fills it when present; `convert` reads it per row, stores it per `(branch, name)`, raises `TargetError("ردیف N: هدف پوشش برای همین ویزیتور متفاوت است")` on conflict, and appends it to each TSV row.

- [ ] **Step 4: Run both files to verify they pass**

Run: same command. Expected: all pass.

- [ ] **Step 5: Copy and commit**

```bash
cp ubuntu-server/backend/app/schema.py ubuntu-server/backend/app/ingest.py backend/app/ && cp ubuntu-server/tools/monthly-target/convert_target.py tools/monthly-target/ && cp ubuntu-server/backend/tests/test_target.py ubuntu-server/backend/tests/test_convert_target.py backend/tests/
git -C ubuntu-server add backend/app/schema.py backend/app/ingest.py tools/monthly-target/convert_target.py backend/tests/test_target.py backend/tests/test_convert_target.py
git -C ubuntu-server commit -m "feat(target): optional coverage target column, legacy files keep loading"
```

### Task 4: Visitor-month inputs from DuckDB

**Files:**
- Create: `backend/app/club_ladder_data.py`
- Test: `backend/tests/test_club_ladder_api.py` (fixture shared with Tasks 5 and 6)

**Interfaces:**
- Consumes: `target_sales.month_sales`, `target_sales.visitor_codes_by_name`, `target_sales.resolve_code` (Task 2); `fact_target.target_coverage` (Task 3); `club_ladder.Kpi` (Task 1).
- Produces:
  - `VisitorMonth` (frozen `dataclass`): `code: str`, `name: str`, `branch: str`, `month: str`, `rial_targets: dict[str, float]` (product_group → target rial, plus key `"__all__"`), `rial_actuals: dict[str, float]` (same keys), `coverage_target: float | None`, `coverage_actual: int`
  - `load_visitor_months(con, core_name: str, months: list[str]) -> list[VisitorMonth]`: one entry per (visitor, month) with at least one `fact_target` row; actuals from `month_sales` limited to the month's category set, summed per `product_group` through the month's `{target_category: product_group}` map; `coverage_actual` = `COUNT(DISTINCT customer_code)` over `fact_sales` rows `NOT is_promo AND NOT is_return` for that visitor and month.
  - `kpi_inputs(vm: VisitorMonth, kpi: Kpi) -> tuple[float | None, float]` (rial: sum over `kpi.product_groups` or `"__all__"`; coverage: `(coverage_target, coverage_actual)`; basket: `(None, 0)`)
  - `basket_groups(vm: VisitorMonth, threshold: float) -> int` (groups with target > 0 and actual/target ≥ threshold, excluding `"__all__"`)
  - `last_sales_key(con, core_name: str) -> int | None` (`MAX(jdate_key)`)

- [ ] **Step 1: Write the failing test with the shared fixture**

```python
# backend/tests/test_club_ladder_api.py
"""Ladder plans on seeded sales + target rows: two visitors, two months."""
import pytest
from test_api import build_client, make_row, product_tsv
from test_target import target_tsv, LINE

S = "SRSalesProcedure1405"; RET = "SRDatedSalesReturnProcedurewithVAT1405"; PROMO = "SRPromotionsProcedure1405"
PRODUCT = product_tsv(("P1", "گروه الف", "ز", "دسته A"), ("P2", "گروه ب", "ز", "دسته B"))
KG = "کوپا گستر"

def trow(month, branch, cat, group, rial, code, name, cov=""):
    return [month, branch, LINE, cat, group, code, name, "سرپرست", "مدیر", str(rial), cov]

def sales():
    return {"sr_kg_140507": [
        make_row(S, "1", "C1", "850", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/05", line=LINE),
        make_row(S, "2", "C2", "100", "1", vcode="11", vname="علی", ucode="P2", date="1405/07/06", line=LINE),
        make_row(PROMO, "3", "C3", "50", "1", vcode="11", vname="علی", ucode="P1", date="1405/07/07", line=LINE),  # promo counts in rial, not coverage
        make_row(S, "4", "C9", "300", "1", vcode="12", vname="رضا", ucode="P1", date="1405/07/08", line=LINE),
        make_row(RET, "5", "C9", "-500", "-1", vcode="12", vname="رضا", ucode="P1", date="1405/07/09", line=LINE),  # net negative
    ], "sr_kg_140508": [
        make_row(S, "6", "C1", "1000", "1", vcode="11", vname="علی", ucode="P1", date="1405/08/03", line=LINE),
    ]}

@pytest.fixture()
def client(tmp_path, monkeypatch):
    c = build_client(tmp_path, monkeypatch, sales(), product=PRODUCT)
    (tmp_path / "raw" / "target_kg_140507.tsv").write_text(target_tsv(
        trow("140507", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی", "3"),
        trow("140507", "شعبه تهران", "دسته B", "گروه ب", 200, "11", "علی", "3"),
        trow("140507", "شعبه کرج", "دسته A", "گروه الف", 1000, "", "رضا")), encoding="utf-8")   # no code: matched by unique name
    (tmp_path / "raw" / "target_kg_140508.tsv").write_text(target_tsv(
        trow("140508", "شعبه تهران", "دسته A", "گروه الف", 1000, "11", "علی")), encoding="utf-8")
    from app import ingest
    assert all(r["status"] == "loaded" for r in ingest.ingest_all() if r["file"].startswith("target_"))
    return c

def test_visitor_months_use_target_page_actuals(client):
    from app import club_ladder_data as D
    from app.db import connect
    con = connect(read_only=True)
    try:
        vms = {(v.code, v.month): v for v in D.load_visitor_months(con, KG, ["140506", "140507", "140508"])}
    finally:
        con.close()
    assert set(vms) == {("11", "140507"), ("12", "140507"), ("11", "140508")}   # 140506 has no target file
    ali = vms[("11", "140507")]
    assert ali.rial_targets == {"گروه الف": 1000, "گروه ب": 200, "__all__": 1200}
    assert ali.rial_actuals == {"گروه الف": 900, "گروه ب": 100, "__all__": 1000}   # promo 50 included
    assert ali.coverage_target == 3 and ali.coverage_actual == 2
    reza = vms[("12", "140507")]
    assert reza.branch == "شعبه کرج" and reza.rial_actuals["__all__"] == -200 and reza.coverage_target is None
    assert D.basket_groups(ali, 0.7) == 1          # الف 0.9 passes, ب 0.5 does not
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_club_ladder_api.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.club_ladder_data'`

- [ ] **Step 3: Implement `club_ladder_data.py`**

One targets query for all months (`fact_target WHERE core=? AND month IN (...)`), one coverage query grouped by `visitor_code, year_month`, then `month_sales` once per month with no rbac scope (the club computes for everyone; the route layer decides who sees what). Resolve codeless target rows with `resolve_code`; drop rows that still have no code. Branch = branch of the visitor's first target row that month.

- [ ] **Step 4: Run the test to verify it passes**

Run: same command. Expected: `1 passed`

- [ ] **Step 5: Copy and commit**

```bash
cp ubuntu-server/backend/app/club_ladder_data.py backend/app/ && cp ubuntu-server/backend/tests/test_club_ladder_api.py backend/tests/
git -C ubuntu-server add backend/app/club_ladder_data.py backend/tests/test_club_ladder_api.py
git -C ubuntu-server commit -m "feat(club): load visitor-month targets, actuals and coverage for ladder plans"
```

### Task 5: Ladder plans: storage, creation, leaderboard and scorecard routes

**Files:**
- Modify: `backend/app/club_store.py:14-24,27-37` (DDL and `_migrate`), `backend/app/club.py:50-62` (`PlanBody`), `:65-85` (`_plans`), `:182-206` (`create_plan`, `points`)
- Create: `backend/app/club_ladder_report.py`
- Test: `backend/tests/test_club_ladder_api.py`

**Interfaces:**
- Consumes: Task 1 functions and `LadderConfig`; Task 4 `load_visitor_months`, `kpi_inputs`, `basket_groups`, `last_sales_key`.
- Produces:
  - `plans` columns `plan_type VARCHAR`, `config VARCHAR`; `_plans()` returns `plan_type` (`"linear"` when NULL) and parsed `config` (dict or None).
  - `PlanBody.plan_type: Literal["linear", "ladder"] = "linear"`, `PlanBody.config: LadderConfig | None = None`, `rial_per_point: float = Field(0, ge=0)` (must be > 0 only for linear; validated in `create_plan`).
  - `club_ladder_report.plan_months(plan: dict) -> list[str]` (whole Jalali months inside `[start_key, end_key]`).
  - `club_ladder_report.leaderboard(plan: dict) -> dict` with keys `plan`, `months: [{month, completed}]`, `rows: [...]` per the spec (`code, name, branch, grade, tenure, months, total, average, rank_national, rank_grade, rank_branch, rank_month_national, provisional_month, prize`). Completed = month's last day `<` `last_sales_key`'s month start, i.e. `last_sales_key > last day key of the month`. Grade from the three months before `start_key` using `month_sales` summed per visitor (all categories, any target file or not: use `SUM(rial_vat)` of `fact_sales` for the visitor and month, promotions included), averaged over months that have sales data.
  - `club_ladder_report.scorecard(plan: dict, code: str, month: str | None) -> dict`: the visitor's leaderboard row plus `month`, `kpis` (list from `month_score`), `note` (None, or the Persian string when the visitor has no target rows that month), `ladder_max` (max score of the first KPI's ladder).
  - Routes: `POST /api/club/visitor/plans` accepts ladder bodies; `GET /api/club/visitor/points?plan_id=` returns `leaderboard()` for ladder plans; `GET /api/club/visitor/scorecard?plan_id=&code=&month=` (admin any code; a linked club account only its own, else 403).

- [ ] **Step 1: Write the failing tests**

```python
# append to backend/tests/test_club_ladder_api.py
LAD = [[0.6, 8.75], [0.7, 11.38], [0.8, 14.79], [0.9, 19.23], [1.05, 25]]
def cfg(**over):
    base = {"kpis": [{"key": "rial", "label": "ریالی کل", "metric": "rial", "weight": 0.6, "ladder": LAD},
                     {"key": "cov", "label": "پوشش", "metric": "coverage", "weight": 0.4, "ladder": LAD}],
            "grade_bands": [{"grade": "C", "min_rial": 0}, {"grade": "B", "min_rial": 500}],
            "prize_table": [{"rank_from": 1, "rank_to": 1, "amount": 100}]}
    return {**base, **over}

def ladder_plan(c, **over):
    body = {"name": "نردبان", "core": "kg", "start_key": 14050701, "end_key": 14050830, "plan_type": "ladder", "config": cfg(), **over}
    return c.post("/api/club/visitor/plans", json=body)

def test_ladder_plan_rejects_bad_weights_and_unaligned_window(client):
    bad = cfg(); bad["kpis"][0]["weight"] = 0.5
    assert ladder_plan(client, config=bad).status_code == 400
    assert ladder_plan(client, start_key=14050702).status_code == 400
    assert ladder_plan(client, end_key=14050829).status_code == 400
    assert client.post("/api/club/b2b/plans", json={"name": "x", "core": "kg", "start_key": 14050701, "end_key": 14050730,
                                                    "plan_type": "ladder", "config": cfg()}).status_code == 400

def test_leaderboard_scores_grades_and_ranks(client):
    pid = ladder_plan(client).json()["id"]
    body = client.get("/api/club/visitor/points", params={"plan_id": pid}).json()
    assert [m["month"] for m in body["months"]] == ["140507", "140508"]
    assert [m["completed"] for m in body["months"]] == [True, False]        # last sales day is 1405/08/03
    rows = {r["code"]: r for r in body["rows"]}
    ali, reza = rows["11"], rows["12"]
    # Ali 140507: rial 1000/1200 = 0.833 -> 14.79*0.6 = 8.874 ; coverage 2/3 = 0.667 -> 8.75*0.4 = 3.5
    assert ali["months"]["140507"] == pytest.approx(12.374)
    assert ali["total"] == pytest.approx(12.374) and ali["tenure"] == 1          # 140508 provisional, not counted
    assert ali["provisional_month"]["month"] == "140508"
    # Ali 140508: rial 1000/1000 = 1.0 -> 19.23*0.6 ; no coverage target -> 0
    assert ali["provisional_month"]["score"] == pytest.approx(11.538)
    assert reza["months"]["140507"] == 0 and reza["total"] == 0               # negative rial, no coverage target
    assert ali["rank_national"] == 1 and reza["rank_national"] == 2 and ali["prize"] == 100 and reza["prize"] is None
    assert ali["grade"] == "C" and reza["grade"] == "C"                        # no sales before 1405/07

def test_scorecard_kpis_and_note(client):
    pid = ladder_plan(client).json()["id"]
    sc = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11", "month": "140507"}).json()
    kp = {k["key"]: k for k in sc["kpis"]}
    assert kp["rial"]["target"] == 1200 and kp["rial"]["actual"] == 1000 and kp["rial"]["score"] == 14.79
    assert kp["cov"]["target"] == 3 and kp["cov"]["actual"] == 2 and kp["cov"]["weighted"] == pytest.approx(3.5)
    assert sc["ladder_max"] == 25 and sc["note"] is None
    sc2 = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "12", "month": "140508"}).json()
    assert sc2["kpis"] == [] and "هدفی" in sc2["note"]

def test_rial_achievement_equals_target_page(client):
    pid = ladder_plan(client).json()["id"]
    sc = client.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11", "month": "140507"}).json()
    tgt = client.get("/api/target", params={"month": "140507", "by": "visitor"}).json()
    row = next(r for r in tgt["rows"] if r.get("code") == "11")
    rial = next(k for k in sc["kpis"] if k["key"] == "rial")
    assert rial["ratio"] == pytest.approx(row["achieved_pct"])

def test_club_account_reads_only_its_own_scorecard(client):
    pid = ladder_plan(client).json()["id"]
    client.post("/api/admin/roles/defaults")
    role = next(x for x in client.get("/api/admin/roles").json() if x["name"] == "Sales Power Club")
    assert client.post("/api/admin/users", json={"username": "vis11", "password": "password-123", "role_id": role["id"]}).status_code == 201
    assert client.put("/api/club/link", json={"username": "vis11", "kind": "visitor", "code": "11"}).status_code == 200
    from fastapi.testclient import TestClient
    from app.api import app
    u = TestClient(app)
    assert u.post("/api/auth/login", json={"username": "vis11", "password": "password-123"}).status_code == 200
    assert u.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "11"}).status_code == 200
    assert u.get("/api/club/visitor/scorecard", params={"plan_id": pid, "code": "12"}).status_code == 403
```


- [ ] **Step 2: Run them to verify they fail**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_club_ladder_api.py`
Expected: the five new tests FAIL (422 on unknown fields, 404 on the scorecard route).

- [ ] **Step 3: Implement storage and body**

`club_store._migrate` gains `("plan_type", "VARCHAR"), ("config", "VARCHAR")`. `_plans` reads both columns, defaults `plan_type` to `"linear"`, `json.loads` the config. `create_plan`: for `ladder` require `kind == "visitor"` (400 «نردبان تحقق فقط برای باشگاه ویزیتورها»), require `config`, require `start_key % 100 == 1` and `end_key` equal to `days_in_jalali_month` of its month (400 «بازه طرح نردبان باید ماه کامل باشد»); for `linear` require `rial_per_point > 0`. Store `config` as `json.dumps(config.model_dump(), ensure_ascii=False)`. Pydantic errors from `LadderConfig` surface as 400 with the validator's Persian message (catch `ValidationError` in the route, or use a `field_validator` raising `HTTPException`).

- [ ] **Step 4: Implement `club_ladder_report.py`**

`leaderboard`: months from `plan_months`; `vms = load_visitor_months(...)`; per visitor-month `month_score(config, {k.key: kpi_inputs(vm, k)}, basket_groups(vm, threshold))`; completed months by `last_sales_key`; totals over completed months; grades; ranks via `dense_ranks` on total (national), within grade groups, within `(branch, grade)` groups; `rank_month_national` on the latest month's score; prize via `prize_for`. Branch for ranking = branch of the visitor's latest target month in the window. `scorecard`: same computation filtered to one code, plus the chosen month's `kpis`. Keep each function under 50 lines; split helpers freely.

- [ ] **Step 5: Wire the routes in `club.py`**

`points` branches on `plan["plan_type"] == "ladder"` → `club_ladder_report.leaderboard(plan)`. New `@router.get("/visitor/scorecard")` with `plan_id: int, code: str, month: str | None = None`; `p = rbac.require()`; if not `p.is_admin`, `_link_for(p.user)` must be `("visitor", code)` else 403 «فقط کارنامه خودتان».

- [ ] **Step 6: Run the file and the existing club tests**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_club_ladder_api.py tests/test_club_points.py tests/test_club.py`
Expected: all pass.

- [ ] **Step 7: Copy and commit**

```bash
cp ubuntu-server/backend/app/club_store.py ubuntu-server/backend/app/club.py ubuntu-server/backend/app/club_ladder_report.py backend/app/ && cp ubuntu-server/backend/tests/test_club_ladder_api.py backend/tests/
git -C ubuntu-server add backend/app/club_store.py backend/app/club.py backend/app/club_ladder_report.py backend/tests/test_club_ladder_api.py
git -C ubuntu-server commit -m "feat(club): ladder plan type with leaderboard and scorecard routes"
```

### Task 6: Member endpoints for ladder plans

**Files:**
- Modify: `backend/app/club.py:327-345` (`my_club`), `:379-437` (`my_team`)
- Test: `backend/tests/test_club_ladder_api.py`

**Interfaces:**
- Consumes: `club_ladder_report.leaderboard`, `club_ladder_report.scorecard` (Task 5).
- Produces: for a ladder plan, `/api/club/visitor/team` returns `visitor_summary` with `points = total` (2 decimals), `history = [{month, points: score, provisional}]`, `breakdown = latest month's kpis as [{label, points: weighted}]`, `tier = {"level": grade, "step": 0, "rank_national", "rank_branch", "prize", "points_needed_label": "رتبه کشوری N"}`, and a new key `scorecard` (the full `scorecard()` dict for the latest month). `/api/club/me` for a visitor link returns the same `points`, `history`, `breakdown`, `tier` per ladder plan. Linear plans unchanged.

- [ ] **Step 1: Write the failing test**

```python
# append to backend/tests/test_club_ladder_api.py
def test_member_team_endpoint_carries_ladder_summary(client):
    pid = ladder_plan(client).json()["id"]
    client.post("/api/admin/roles/defaults")
    role = next(x for x in client.get("/api/admin/roles").json() if x["name"] == "Sales Power Club")
    client.post("/api/admin/users", json={"username": "vis11", "password": "password-123", "role_id": role["id"]})
    client.put("/api/club/link", json={"username": "vis11", "kind": "visitor", "code": "11"})
    from fastapi.testclient import TestClient
    from app.api import app
    u = TestClient(app)
    u.post("/api/auth/login", json={"username": "vis11", "password": "password-123"})
    body = u.get("/api/club/visitor/team", params={"plan_id": pid}).json()
    s = body["visitor_summary"]
    assert s["points"] == pytest.approx(12.37, abs=0.01) and s["tier"]["level"] == "C" and s["tier"]["rank_national"] == 1
    assert [h["month"] for h in s["history"]] == ["140507", "140508"] and s["history"][1]["provisional"] is True
    assert body["scorecard"]["month"] == "140508" and body["plan"]["plan_type"] == "ladder"
    me = u.get("/api/club/me").json()
    assert me["plans"][0]["tier"]["level"] == "C"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q tests/test_club_ladder_api.py::test_member_team_endpoint_carries_ladder_summary`
Expected: FAIL (`KeyError: 'scorecard'` or linear-shaped values)

- [ ] **Step 3: Implement**

Add `_ladder_member_view(plan, code) -> dict` in `club.py` that calls `scorecard(plan, code, None)` and maps it to the shape above; `my_club` and `my_team` use it when `plan["plan_type"] == "ladder"`, else the existing code path.

- [ ] **Step 4: Run the full backend suite**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q`
Expected: all pass except the known `test_sql_source` workbook failure.

- [ ] **Step 5: Copy and commit**

```bash
cp ubuntu-server/backend/app/club.py backend/app/ && cp ubuntu-server/backend/tests/test_club_ladder_api.py backend/tests/
git -C ubuntu-server add backend/app/club.py backend/tests/test_club_ladder_api.py
git -C ubuntu-server commit -m "feat(club): ladder report card in member endpoints"
```

### Task 7: Client-side ladder defaults, validation and the plan form

**Files:**
- Create: `frontend/src/club/ladder.js`, `frontend/src/club/LadderPlanForm.jsx`
- Modify: `frontend/src/ClubPages.jsx:128-230` (`PlanForm`)
- Test: `frontend/src/club/ladder.test.jsx`

**Interfaces:**
- Produces (`ladder.js`): `DEFAULT_LADDER`, `DEFAULT_BASKET_LADDER`, `DEFAULT_KPIS` (rial total 0.7, basket 0.3; no coverage, per the spec), `weightSum(kpis) -> number`, `validateConfig(config) -> string[]` (Persian messages: weights ≠ 1, empty kpis, ladder not increasing, overlapping prize ranges), `parseLadder(text) -> number[][]` (`"0.6:8.75, 0.7:11.38"` → pairs), `formatLadder(pairs) -> string`.
- Produces (`LadderPlanForm.jsx`): `export default function LadderPlanForm({ value, onChange })` controlled component for `{kpis, grade_bands, prize_table}`; shows the weight sum in red when `validateConfig` returns errors.
- `PlanForm` gains a `plan_type` select («خطی» / «نردبان تحقق»); for ladder it hides rial-per-point, target and tiers, renders `LadderPlanForm`, blocks submit while `validateConfig` has errors, and posts `{plan_type: 'ladder', config, rial_per_point: 0, start_key, end_key, name, core}`.

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/club/ladder.test.jsx
import { describe, expect, it } from 'bun:test'
import { DEFAULT_KPIS, validateConfig, weightSum, parseLadder, formatLadder } from './ladder'

describe('ladder config helpers', () => {
  it('default kpis sum to one and validate', () => {
    expect(weightSum(DEFAULT_KPIS)).toBeCloseTo(1, 3)
    expect(validateConfig({ kpis: DEFAULT_KPIS, grade_bands: [], prize_table: [] })).toEqual([])
  })
  it('rejects weights that do not sum to one', () => {
    const kpis = [{ ...DEFAULT_KPIS[0], weight: 0.5 }]
    expect(validateConfig({ kpis, grade_bands: [], prize_table: [] })[0]).toContain('ضرایب')
  })
  it('rejects overlapping prize ranges and non-increasing ladders', () => {
    const errs = validateConfig({ kpis: [{ ...DEFAULT_KPIS[0], ladder: [[0.9, 25], [0.6, 8]] }],
      grade_bands: [], prize_table: [{ rank_from: 1, rank_to: 3, amount: 1 }, { rank_from: 3, rank_to: 5, amount: 1 }] })
    expect(errs.length).toBe(2)
  })
  it('parses and formats ladder text', () => {
    expect(parseLadder('0.6:8.75, 0.7:11.38')).toEqual([[0.6, 8.75], [0.7, 11.38]])
    expect(formatLadder([[0.6, 8.75]])).toBe('0.6:8.75')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ubuntu-server/frontend && bun test src/club/ladder.test.jsx`
Expected: FAIL, cannot resolve `./ladder`

- [ ] **Step 3: Implement `ladder.js`, then `LadderPlanForm.jsx`, then the `PlanForm` switch**

Form rows follow the existing rule-row markup in `PlanForm` (inputs with `bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs`). KPI row: label, metric select (ریالی / پوشش / سبد فروشی), product groups (comma list, rial only), weight, ladder text. Grade bands: two inputs (B from, A from) producing three bands with C at 0. Prize table: add/remove rows of (from, to, amount). All state updates immutable.

- [ ] **Step 4: Run the test and the build**

Run: `cd ubuntu-server/frontend && bun test src/club/ladder.test.jsx && npm run build`
Expected: `4 pass`; build succeeds with no new warnings.

- [ ] **Step 5: Copy and commit**

```bash
mkdir -p frontend/src/club && cp ubuntu-server/frontend/src/club/ladder.js ubuntu-server/frontend/src/club/ladder.test.jsx ubuntu-server/frontend/src/club/LadderPlanForm.jsx frontend/src/club/ && cp ubuntu-server/frontend/src/ClubPages.jsx frontend/src/
git -C ubuntu-server add frontend/src/club/ladder.js frontend/src/club/ladder.test.jsx frontend/src/club/LadderPlanForm.jsx frontend/src/ClubPages.jsx
git -C ubuntu-server commit -m "feat(club-ui): ladder plan form with client-side validation"
```

### Task 8: Leaderboard, report card and real activity-ring data

**Files:**
- Create: `frontend/src/club/LadderLeaderboard.jsx`, `frontend/src/club/ReportCard.jsx`
- Modify: `frontend/src/ClubPages.jsx:255-284` (`PointsView`), `:459-610` (`MyVisitorClub`)
- Test: `frontend/src/club/ReportCard.test.jsx`

**Interfaces:**
- Consumes: `/api/club/visitor/points` ladder shape and `/api/club/visitor/scorecard` (Task 5); `visitor_summary.scorecard` (Task 6); `ActivityRingsWidget` `customRings` prop (`[{id, label, value, target, progress, percentage, color, colorEnd, icon}]`).
- Produces:
  - `export default function LadderLeaderboard({ data, onSelect })`: `Table` with columns rank, grade, name, branch, one per `data.months` (header suffixed «(در جریان)» when not completed), total, average, tenure, prize; row click → `onSelect(code)`.
  - `export default function ReportCard({ scorecard, months, onMonth })`: header (name, grade, tenure, national and branch rank, prize band), `BarChart` of `history` with a `ReferenceLine` at `ladder_max` and provisional bars in a lighter fill, month `<select>`, KPI `Table` (target, actual, achievement %, score, weight, weighted), `note` text when `kpis` is empty, one-line ladder rule («از ۶۰٪ تحقق ۸٫۷۵ امتیاز … از ۱۰۵٪ ۲۵ امتیاز»).
  - `export function ringsFromScorecard(scorecard) -> customRings` (pure, in `ReportCard.jsx`): rial, coverage, basket rings from `kpis` by metric; a missing metric gives a ring with `progress 0`, label «تعریف نشده».
  - `export function linearRings(summary, target) -> customRings` (pure): rial ring from `target.achieved_pct`, coverage ring `customers_count / previous month customers`, no collection ring.
  - `PointsView`: when the chosen plan is `ladder`, render `LadderLeaderboard` and, on select, `ReportCard` fed by `useApi('/club/visitor/scorecard', {plan_id, code, month})`.
  - `MyVisitorClub`: when `plan.plan_type === 'ladder'`, replace the «کارنامه اختصاصی» card with `ReportCard` (scorecard from `team.data.scorecard`, month change refetches via `useApi('/club/visitor/scorecard', ...)`) and pass `customRings={ringsFromScorecard(...)}` to `ActivityRingsWidget`; for linear plans pass `customRings={linearRings(summary, target)}` where `target = useApi('/target', {by: 'visitor'})` filtered to the visitor's code. The invented `collection_rate: 0.94` and `sales_rial * 1.15` are removed.

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/src/club/ReportCard.test.jsx
import { describe, expect, it } from 'bun:test'
import { ringsFromScorecard, linearRings } from './ReportCard'

const sc = { kpis: [
  { key: 'rial', label: 'ریالی کل', metric: 'rial', target: 1200, actual: 1000, ratio: 0.8333, score: 14.79, weight: 0.6, weighted: 8.874 },
  { key: 'cov', label: 'پوشش', metric: 'coverage', target: 3, actual: 2, ratio: 0.6667, score: 8.75, weight: 0.4, weighted: 3.5 },
] }

describe('report card rings', () => {
  it('maps kpis to three rings and marks a missing metric', () => {
    const rings = ringsFromScorecard(sc)
    expect(rings.length).toBe(3)
    expect(rings[0].progress).toBeCloseTo(0.8333, 3)
    expect(rings[2].label).toBe('تعریف نشده')
    expect(rings[2].progress).toBe(0)
  })
  it('linear rings use the target page achievement and never a fixed collection rate', () => {
    const rings = linearRings({ customers_count: 20, prev_customers_count: 25 }, { achieved_pct: 0.9 })
    expect(rings.length).toBe(2)
    expect(rings[0].progress).toBeCloseTo(0.9)
    expect(rings[1].progress).toBeCloseTo(0.8)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ubuntu-server/frontend && bun test src/club/ReportCard.test.jsx`
Expected: FAIL, cannot resolve `./ReportCard`

- [ ] **Step 3: Implement the two components and wire `ClubPages.jsx`**

Ring metrics: `metric === 'rial'` → emerald `#10B981`, `coverage` → purple `#8B5CF6`, `basket` → blue `#0071E3`, icons `Target`, `Users`, `Sparkles` from lucide (as `ActivityRingsWidget` does). `prev_customers_count` comes from `visitor_summary.history` (the second-last month's distinct customers; add it to `_team`'s summary in `club.py` as `prev_customers_count` if absent, one query). Keep `ClubPages.jsx` under 800 lines by moving `MyVisitorClub` into `frontend/src/club/MyVisitorClub.jsx` and re-exporting it from `ClubPages.jsx`.

- [ ] **Step 4: Run tests and build, then check both pages in the browser**

Run: `cd ubuntu-server/frontend && bun test src/club && npm run build`
Expected: `6 pass`, build ok.
Then with `preview_start` on the `.claude/launch.json` frontend config: create a ladder plan on the visitor club page, confirm the leaderboard renders with month columns and the «در جریان» suffix, click a row and confirm the report card KPI table, then log in as a linked visitor account and confirm the member page shows the report card and rings without the removed fixed values. Check at desktop and mobile widths.

- [ ] **Step 5: Copy, run the whole backend suite once more, and commit**

```bash
cp ubuntu-server/frontend/src/club/*.jsx ubuntu-server/frontend/src/club/*.js frontend/src/club/ && cp ubuntu-server/frontend/src/ClubPages.jsx frontend/src/ && cp ubuntu-server/backend/app/club.py backend/app/
git -C ubuntu-server add frontend/src/club frontend/src/ClubPages.jsx backend/app/club.py
git -C ubuntu-server commit -m "feat(club-ui): ladder leaderboard, shared report card, real activity-ring data"
```

### Task 9: Completion record and deploy readiness

**Files:**
- Create: `.claude/completions/2026-11-16-visitor-achievement-ladder.md` (D:\SR only; not committed)
- Verify: `git -C ubuntu-server status -sb` clean and not behind `origin/main`

- [ ] **Step 1: Full verification**

Run: `cd ubuntu-server/backend && .venv\Scripts\python.exe -m pytest -q` and `cd ubuntu-server/frontend && bun test src && npm run build`
Expected: backend green except `test_sql_source`; frontend green; build ok.

- [ ] **Step 2: Confirm the two copies agree on every touched file**

Run: `for f in $(git -C ubuntu-server diff --name-only aa4cc45..HEAD); do diff -q "$f" "ubuntu-server/$f" >/dev/null || echo "DIFF $f"; done` from `D:\SR` (replace `aa4cc45` with the commit before Task 1). Expected: no `DIFF` lines (CRLF-only differences are acceptable, verify with `diff <(tr -d '\r' < a) <(tr -d '\r' < b)`).

- [ ] **Step 3: Write the completion doc** with what shipped, what the operator must do (add «هدف پوشش» to next month's `Target.MM.xlsx`), and the push command `git -C ubuntu-server push origin main`. Do not push; the user decides.

---

## Self-review notes

- Spec coverage: data model (T5), target file change (T3), API (T5, T6), UI (T7, T8), tests 1–10 of the spec map to T1, T5, T5, T5, T4/T5, T5, T5, T1/T5, T5, T3. The current-month provisional rule and month-aligned window are in T5. Branch for ranking and latest-month note are in T5. Linear rings fed from real data in T8. Legacy target file loading in T3.
- Naming: `LadderConfig`, `Kpi`, `GradeBand`, `PrizeRow`, `ladder_score`, `kpi_value`, `month_score`, `grade_for`, `dense_ranks`, `prize_for` (T1) are used by name in T5; `VisitorMonth`, `load_visitor_months`, `kpi_inputs`, `basket_groups`, `last_sales_key` (T4) in T5; `leaderboard`, `scorecard`, `plan_months` (T5) in T6; `ringsFromScorecard`, `linearRings` (T8) tested in T8.
- Task 3 must precede Task 4 because the shared fixture writes 11-column target files.
