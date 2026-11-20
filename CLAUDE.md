# SR — Sales dashboard (نبض فروش | کوپا گستر)

Persian, right-to-left sales dashboard. Amounts are in Rial, dates are Jalali (1405 data). Default core is `kg` (کوپا گستر); `ch` (زنجیره‌ای) is shown separately.

## Layout

| Path | What it is |
|---|---|
| `backend/` | FastAPI + DuckDB API (`app/api.py`), pytest tests in `tests/`. Python >=3.11, deps via `uv`. |
| `frontend/` | React 19 + Vite + Tailwind 4 + Recharts, font Vazirmatn. Entry `src/App.jsx`, pages in `src/pages.jsx`, `src/ExecutiveDashboard.jsx`, styles in `src/styles.css`. |
| `scripts/` | `sync.py` (loads new TSVs into DuckDB), `publish_to_server.ps1`, `run_dax.ps1`, `gen_queries.py`. |
| `data/` | DuckDB + exported TSVs + `.dax` queries. Gitignored. |
| `deploy/` | systemd service definitions, nginx configurations for production. |
| `graphify-out/` | AST-based knowledge graph for codebase architecture (`graphify update .`). |

## Repository and Deployment

- Working directory: `D:\SR` (Single unified git repository tracking `origin/main` on `mohammadkharaji/COPAGOSTAR`).
- Production server: `178.252.136.184` (SSH port **2222**) — `/opt/sr` on Ubuntu 24.04, nginx + `sr-api` + `sr-sync`.
  Public host `copadash.amadehlaziz.com` resolves here.

### Rules that keep code safe:
- **`api.py` and `rbac.py` move together.** Any new endpoint also needs its page in `rbac.PAGES` and its entry in `EXACT`/`PREFIX`, or it is admin-only (fail closed) and the new page 403s for every other user. Prove it with a test that calls the route as a **non-admin**.
- Data never enters the repo: `data/`, `*.xlsx`, `*.tsv`, `*.sqlite` are ignored. `scripts/sync.py` rebuilds DuckDB from raw data.

## MCP servers

`.mcp.json` at the repo root configures the same three MCP servers used with Claude Code: `memory`
(`npx @modelcontextprotocol/server-memory`), `notebooklm` (local `node
C:/Users/m.kharaji/tools/notebooklm-mcp/dist/index.js`) and `playwright` (`npx @playwright/mcp@latest`).
The file holds no secrets, but the `notebooklm` path is machine-specific: edit that entry when the
checkout moves to another user or machine.

## Run and test

- Start everything: `start-dashboard.bat` (backend :8000, frontend :5173, sync watcher).
- Backend only: `cd backend && .venv\Scripts\python.exe -m uvicorn app.api:app --port 8000`
- Frontend only: `cd frontend && npm run dev` (Vite proxies `/api` to :8000).
- Backend tests: `backend\.venv\Scripts\python.exe -m pytest -q backend/tests` (237 passed).
- Frontend tests: `npm --prefix frontend test` (Vitest).
- Frontend build: `npm --prefix frontend run build`.
- Knowledge graph: `graphify update .` to refresh the code-only AST graph.

## Hard rules

- Data Access: You have explicit permission to read, open, and process SR-1405.xlsx, Target.xlsx, and other files located in data/ directory when strictly necessary for the task.
- Never open or read .venv/, node_modules/, frontend/dist/.
- Never run `publish-to-server.bat` or `scripts/publish_to_server.ps1` unless explicitly requested.
- No secrets in files, commands or chat.
- Keep the UI RTL (`lang="fa" dir="rtl"`). Chart containers stay `direction: ltr`.
- Financial numbers must stay consistent between pages and with the overview; add or update a test in `backend/tests/` when changing a query.
- Reading downloaded spreadsheets with `python -I`: on Windows the console codec is cp1252; put `sys.stdout.reconfigure(encoding="utf-8")` at the top of the script.

## Existing design language

Tokens are in `frontend/src/styles.css`: `--ink #10253f`, `--petrol #174c5a`, `--saffron #e4a53a`, `--teal #2f9a88`, `--neg #b4443a`, `--paper #f4f7f5`, radius 14px, Vazirmatn. Dark sidebar, saffron active marker, KPI cards with a coloured top border.
