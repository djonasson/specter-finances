# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build` (runs `tsc -b && vite build`)
- **Lint:** `npm run lint`
- **Tests:** `npm run test` (vitest, one-shot) or `npm run test:watch`
- **Single test:** `npx vitest run src/services/parsing.test.ts`

## Environment Variables

Required in `.env` (not committed):
- `VITE_GOOGLE_CLIENT_ID` — Google OAuth2 client ID
- `VITE_SPREADSHEET_ID` — Google Sheets spreadsheet ID
- `VITE_SHEET_NAME` — Sheet tab name (defaults to `Sheet1`)

## Architecture

This is a client-only PWA (no backend) that reads/writes expenses directly to a Google Sheet via the Sheets API. Authentication uses Google Identity Services (GIS) OAuth2 token flow, with tokens stored in sessionStorage.

### Data flow

Google Sheet (source of truth) ↔ `services/sheets.ts` (CRUD via Sheets REST API) ↔ `hooks/useExpenses.ts` (state management) ↔ `hooks/ExpensesContext.tsx` (React context) ↔ UI components

### Key details

- **Spreadsheet layout:** Row 1 = header, row 2 = sub-header, data starts at row 3. Columns: Date | AmountDaniel | AmountManuela | Item | Category | Notes. `rowIndex` in the `Expense` type is the 1-based sheet row number.
- **Date handling:** The sheet may store dates as serial numbers (Google Sheets epoch) or text in various formats (DD/MM/YYYY, DD.MM.YY, etc.). All normalization is in `services/parsing.ts` — this is the only file with tests.
- **Amounts:** Stored/displayed with `€` prefix and comma thousands separators. `parseAmount`/`formatAmount` in `parsing.ts` convert between display format and raw numbers.
- **Categories:** Fixed set defined in `types/expense.ts`: Car, Food, Health, Holidays, Home, Various.
- **Auth:** `services/auth.ts` dynamically loads the GIS script and manages the OAuth token client. `AuthContext` wraps the app.
- **Deployment:** GitHub Pages — `vite.config.ts` sets `base` to `/specter-finances/` when `GITHUB_ACTIONS` env is set.

### Provider hierarchy (main.tsx)

BrowserRouter → AuthProvider → ExpensesProvider → ThemeProvider → App

### UI

Mantine v8 component library with Tabler icons. Three routes: `/` (Dashboard with charts via chart.js), `/add` (expense form), `/list` (expense list with edit/delete). Bottom nav bar for mobile. Theme system with customizable backgrounds in `theme/`.
