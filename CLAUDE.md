# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev`
- **Build:** `npm run build` (runs `tsc -b && vite build`)
- **Lint:** `npm run lint`
- **Tests:** `npm run test` (vitest, one-shot) or `npm run test:watch`
- **Single test:** `npx vitest run src/services/parsing.test.ts`

## Naming

**Hard rule: no real personal names anywhere in this repo** — not in identifiers,
string literals, types, tests, comments, or docs. The two people are `Person =
'A' | 'B'` (`types/person.ts`), positional to the sheet's two amount columns, and
their display names are read at runtime from the expenses tab's header rows
(`readPersonNames` in `services/sheets.ts`) — sub-header first, then row 1,
taking both names or neither, falling back to "Partner A"/"Partner B". Anyone can use this app and none of them need to learn whose finances it was
built for. Components take a `names: PersonNames` prop rather than reaching for a
name themselves; `App` is the single place that pulls it off the context.

Copy that talks about the two people stays in **they/them**: the sheet says what
they are called, never which pronouns they use.

## Testing

**Hard rule: every code change ships with tests, in the same change.** The sheet is
the couple's only record of who owes whom and there is no backend or audit trail
behind it, so a silent sign error moves real money and stays invisible. Cover the
new behaviour _and_ the unchanged path that proves existing rows still compute the
same. Run `npm run test` before calling a change done, and say so if it fails.
Keep logic in `services/` where it can be tested directly rather than inline in a
component.

## Environment Variables

Required in `.env` (not committed):

- `VITE_GOOGLE_CLIENT_ID` — Google OAuth2 client ID
- `VITE_GOOGLE_API_KEY` — Google API key, required by the spreadsheet picker
  (the Google Picker, Drive and Sheets APIs must all be enabled in the project)
- `VITE_SPREADSHEET_ID` — optional hint shown on the picker screen; the sheet
  the user picks is the one actually used (see below)
- `VITE_SHEET_NAME` — Sheet tab name (defaults to `Sheet1`)

## Architecture

This is a client-only PWA (no backend) that reads/writes expenses directly to a Google Sheet via the Sheets API. Authentication uses Google Identity Services (GIS) OAuth2 token flow, with tokens stored in **localStorage** (`services/auth.ts`) — deliberately, so an installed PWA restores its session across restarts. Note this means the token survives closing the tab, and is readable by any page on the same origin.

### Data flow

Google Sheet (source of truth) ↔ `services/sheets.ts` (CRUD via Sheets REST API) ↔ per-domain hooks (`useExpenses.ts`, `useTransfers.ts`, `useGifts.ts`) ↔ `hooks/ExpensesContext.tsx` (single React context exposing all three domains) ↔ UI components

### Three data domains

The app tracks three kinds of records, each in its own sheet tab, all flowing through the same `ExpensesContext`:

- **Expenses** — main sheet (`VITE_SHEET_NAME`, default `Sheet1`), range `A1:F` (rows 1–2 are the header and sub-header; data still starts at row 3). Both partners can have an amount on one row.
- **Transfers** — `Transfers` tab, range `A2:D`. One partner pays the other to settle the balance.
- **Gifts** — `Gifts` tab, range `A2:E`. Column E is the kind: a `present` (money changed hands, no balance effect at all) or `forgiven` (no money moved, one partner let that much of the other's debt slide — the _inverse_ of a transfer). `toGiftKind` in `types/gift.ts` reads blank and unrecognised cells as `forgiven`, which is what rows written before the column existed already did, so adding it moved no balances.

For Transfers and Gifts, the form captures a single `from` person + `amount`, but the sheet stores it in one of two columns (`amountA`/`amountB`); the empty column encodes direction. `transferFrom`/`giftFrom` in `utils.ts` recover the direction by checking which column is non-empty.

### Settlement math (the core domain logic, in `utils.ts`)

`calculateBalance` computes who owes whom, and reports **real money** — what one would hand the other to square up.

It works in two steps. First the spending **gap**, where anything that changes what is owed by €X counts as **2×X** because it moves both sides at once (one loses X _and_ the other gains X): transfers close the gap (`+2×`), forgiveness applies the opposite sign (`−2×`), and presents are absent entirely.
`gapA = (totalA − totalB) + 2·(transferA − transferB) − 2·(forgivenA − forgivenB)`.

Then `owedToA = gapA / 2`, because expenses are shared 50/50 and the gap is therefore twice the debt: €1000 spent against €500 is a €500 gap but only €250 owed. Reporting the gap was the earlier behaviour and it read as double every settlement.

Changing these signs, coefficients or the halving changes who owes whom and by how much — touch with care.

### Key details

- **Expense sheet layout:** Row 1 = header, row 2 = sub-header, data starts at row 3. Columns: Date | Amount (A) | Amount (B) | Item | Category | Notes. The partners' display names are read from these header rows — `readPersonNames` tries row 2 first, then row 1, because row 1 often merges both amount columns under one group label. Transfers/Gifts have a single header row, data from row 2. `rowIndex` in each type is the 1-based sheet row number.
- **Deletes** go through `deleteRow` (batchUpdate `deleteDimension`), which looks up the `sheetId` by tab title — so deleting renumbers `rowIndex` for everything below; the UI reloads after mutations rather than patching in place.
- **Date handling:** The sheet may store dates as serial numbers (Google Sheets epoch) or text in various formats (DD/MM/YYYY, DD.MM.YY, etc.). All normalization is in `services/parsing.ts`.
- **Amounts:** Stored/displayed with `€` prefix and comma thousands separators. `parseAmount`/`formatAmount` in `parsing.ts` convert between display format and raw numbers.
- **Categories:** Fixed set defined in `types/expense.ts`: Car, Food, Health, Holidays, Home, Various.
- **Auth:** `services/auth.ts` dynamically loads the GIS script and manages the OAuth token client. `AuthContext` wraps the app. The scope is **`drive.file`**, not `spreadsheets` — the token authorises only files the user picked, so a leaked token cannot touch the rest of the account's Drive.
- **Picker app id:** the picker must be given the Cloud project number (`setAppId`) or no per-file grant is created — the pick appears to succeed and every later Sheets call 404s. It is derived from `VITE_GOOGLE_CLIENT_ID` (`getProjectNumber` in `services/auth.ts`), not configured separately, because a mistyped number is still a number and fails silently.
- **Sheet selection:** because `drive.file` grants per file, the target spreadsheet is chosen through the Google Picker (`services/picker.ts`) and remembered in localStorage (`services/sheetAccess.ts`). `App` renders `SheetGate` until a sheet is granted, which also keeps the fetching effect from running without one. A 403/404 from the Sheets API drops the grant and returns to the picker.
- **Deployment:** GitHub Pages — `vite.config.ts` sets `base` to `/specter-finances/` when `GITHUB_ACTIONS` env is set.

### Provider hierarchy (main.tsx)

BrowserRouter → AuthProvider → ExpensesProvider → ThemeProvider → App

### UI

Mantine v8 component library with Tabler icons. Five routes: `/` (Dashboard with charts via chart.js), `/add` (tabbed Expense/Transfer/Gift form), `/list` (expenses), `/transfers`, `/gifts`. Bottom nav bar for mobile. Theme system with customizable backgrounds in `theme/` (gradient, matrix, squirrel). Date filtering (`filterByDate`/`FilterMode` in `utils.ts`) is shared across the dashboard and lists.
