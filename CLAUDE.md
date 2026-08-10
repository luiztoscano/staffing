# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step or package manager. Open `staffing.html` directly in a modern browser (Chrome/Edge recommended). Requires WebAssembly support, `crypto.randomUUID`, and `structuredClone`.

Before opening, place these files in `lib/` (not committed to the repo — see `lib/README.md`):
- `sql-wasm.js` and `sql-wasm.wasm` (from sql.js)
- `xlsx.full.min.js` (from SheetJS)

Without `lib/`, the app loads both libraries from CDN (requires internet access).

## Architecture

This is a **zero-dependency vanilla JS SPA** — no framework, no bundler, no TypeScript. Everything runs in the browser via three global singletons:

| Global | File | Responsibility |
|---|---|---|
| `window.staffingDatabase` | `js/database.js` | SQLite/WASM layer — all reads, writes, migrations |
| `window.staffingExcel` | `js/excel.js` | SheetJS wrapper — import/export |
| `window.staffingSeed` | `js/sample-data.js` | Initial seed data (currently empty) |
| *(app logic)* | `js/app.js` | All UI, routing, state, event handling (~4500 lines) |

### Rendering Model

All UI is built as template-literal HTML strings rendered into `el.content.innerHTML`. There is no virtual DOM. After every `render()` call, `bindContentEvents()` re-attaches all event listeners using `data-*` attribute selectors. Modals are appended to `document.body` as `.modal-backdrop` divs.

### State and Routing

A single IIFE-scoped `state` object drives everything. `state.view` is a string matching one of 12 view names (`dashboard`, `projects`, `positions`, `candidates`, `companies`, `pipeline`, `calendar`, `roles`, `import`, `skills`, `alerts`, `reports`). The `render()` function switch-dispatches to the appropriate renderer. No URL changes occur.

All entity data lives in `state.data` (projects, positions, candidates, skills, companies, roles, applications, allocations, importedPeople, allocationCalendars, importBatches).

### Database Layer

`database.js` wraps sql.js (SQLite compiled to WASM). The database lives entirely in memory; users persist it by downloading `staffing.db` via the Save button.

- All writes use parameterized upserts (`INSERT … ON CONFLICT … DO UPDATE`)
- Multi-step writes use explicit `BEGIN TRANSACTION / COMMIT / ROLLBACK`
- Schema migrations are in a `migrationSql` array — each is retried idempotently; `"duplicate column name"` errors are swallowed silently
- `PRAGMA foreign_keys = ON` and `PRAGMA optimize` are always set

### CSS Design System

`css/staffing.css` uses CSS custom properties defined in `:root`. Key variables: `--accent: #a100ff` (Accenture purple), `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--gold`, `--red`, `--blue`. Layout is a CSS grid: 280px sidebar + fluid workspace.

## Key Conventions

- **UI language**: All labels and messages are in Brazilian Portuguese (pt-BR). Internal code, enum values, and column names are in English.
- **XSS escaping**: Always use `escapeHtml(value)` for content and `escapeAttr(value)` for attribute values when building HTML strings.
- **IDs**: `createId()` generates UUIDs; `stableId(parts)` creates deterministic IDs from string arrays (used for import deduplication).
- **Date handling**: `normalizeDateCell(value)` handles JS Date objects, ISO 8601, Excel serial numbers, Brazilian DD/MM/YYYY, and month-name formats.
- **Excel imports**: Column matching uses `normalizeHeader()` — lowercase, strip accents, remove non-alphanumeric — so column names are matched fuzzily.

## Alert System

`getAlerts()` computes alerts on-the-fly (not persisted) from three severity levels: `high`, `medium`, `low`. Add new alert types by extending this function's return array.

## Data Model Summary

13 SQLite tables. Core entities: `project`, `position`, `candidate`, `role`, `company`, `skill`. Junction tables: `position_skill`, `candidate_skill`, `role_skill`. Pipeline table: `application` (14-step status) + `application_history` audit trail. Import tables: `imported_person` (~30 Accenture workforce report fields), `allocation_calendar` (~30 allocation calendar fields), `import_batch`.
