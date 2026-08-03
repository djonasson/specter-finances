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

## Before merging a feature

**Hard rule: no feature branch merges until all three review skills have been run
over the change and what they found has been dealt with.** Run them in this order,
because each one's fixes are the next one's input:

1. **`/simplify`** — reuse, duplication, and altitude. Cheapest to act on while
   the code is still fresh, and it shrinks what the other two have to read.
2. **`/code-review`** — correctness. This is the one that catches a moved sign or
   a wrong row index, which on this app is real money moved silently.
   **Claude cannot launch this one** — it is user-triggered and billed. Ask for
   it explicitly, say the branch is ready for it, and wait; do not quietly treat
   the step as done because it could not be run.
3. **`/security-review`** — the token lives in localStorage and the OAuth scope
   grants access to a real person's Drive file, so anything touching auth,
   `sheetAccess`, or what gets written to the sheet needs a look.

They read the **pending diff on the current branch**, so run them before merging
or squashing, not after — once the change is on `main` there is nothing for them
to look at.

Fix what they report, then re-run `npm run lint`, `npm run build` and
`npm run test`. If a finding is deliberate and you are leaving it, say which one
and why rather than passing over it silently. Report what each review found even
when it found nothing.

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

Google Sheet (source of truth) ↔ `services/sheets.ts` (CRUD via Sheets REST API) ↔ per-domain hooks (`useExpenses.ts`, `useTransfers.ts`, `useGifts.ts`, `useRecurring.ts`) ↔ `hooks/ExpensesContext.tsx` (single React context exposing all four domains) ↔ UI components

### Four data domains

The app tracks four kinds of records, each in its own sheet tab, all flowing through the same `ExpensesContext`:

- **Expenses** — main sheet (`VITE_SHEET_NAME`, default `Sheet1`), read `A1:H` (rows 1–2 are the header and sub-header; data still starts at row 3). Both partners can have an amount on one row. Columns G and H are maintained by the app: G is the recurring marker (see below), H is the date the row was added.
- **Transfers** — `Transfers` tab, range `A2:D`. One partner pays the other to settle the balance.
- **Gifts** — `Gifts` tab, range `A2:E`. Column E is the kind: a `present` (money changed hands, no balance effect at all) or `forgiven` (no money moved, one partner let that much of the other's debt slide — the _inverse_ of a transfer). `toGiftKind` in `types/gift.ts` reads blank and unrecognised cells as `forgiven`, which is what rows written before the column existed already did, so adding it moved no balances.
- **Recurring** — `Recurring` tab, range `A2:H`: `Start | Amount (A) | Amount (B) | Item | Category | Notes | Day | Id`. **Metadata, not money** — a recurring rule never enters `calculateBalance`; only the expense rows it produces do, and those are ordinary expenses. B–F mirror the expenses tab's B–F so `formatAmount`/`normalizeAmount`/`toCategory` are reused and generating a row is a straight copy.

For Transfers and Gifts, the form captures a single `from` person + `amount`, but the sheet stores it in one of two columns (`amountA`/`amountB`); the empty column encodes direction. `transferFrom`/`giftFrom` in `utils.ts` recover the direction by checking which column is non-empty.

### Recurring payments (`services/recurring.ts`, pure)

Four rules hold this together. Breaking any of them moves real money.

- **A generated expense is a snapshot, never a live view of its rule.** Column G holds `rec:<ruleId>:YYYY-MM` as _provenance only_. Nothing may read a marker and write back into an expense row: raising a subscription's price, renaming it or recategorising it must leave every past row byte-identical, because those rows record what was actually paid.
- **The expenses read/write ranges are deliberately asymmetric**: read `A1:H`, append `A:H`, update `A{n}:F{n}`. A PUT rewrites its whole range, so widening `updateExpense` past F would blank the marker on any generated expense the user edits — the month would then read as never generated and be created a second time. Keeping the PUT narrow makes both app-written columns unerasable by construction, and is also the right answer for H (correcting an amount does not change when the row was added). Appending writes the full `A:H` because the row is new: there is no marker to protect. `ExpenseFormData` has neither field, which is also why Duplicate yields a fresh, unmarked, freshly-stamped row.
- **Generate forward from the last month already generated, do not backfill holes.** Deleting a generated expense is a decision; an app that quietly recreates it next launch is worse than one that misses a month. A month is due only once `dueDate(month, day) <= today`, which covers both the current month and the rule's start month. Capped at `MAX_CATCH_UP_MONTHS` (24).
- **Ids live in the sheet, not in the row number.** Deleting any row renumbers `rowIndex`, so a marker keyed on it would point at a different rule. A rule with a blank `Id` (added by hand) is listed but never generated from.

Month arithmetic is done on `YYYY-MM` strings and integers, with `Date.UTC` used only to count days in a month, so no timezone can shift a payment into the wrong month. `pendingRecurring` takes `todayIso` as a parameter and `Pick<Expense, 'recurringMarker'>[]` for the existing rows — it cannot see a `rowIndex` even if a caller wanted it to, which makes the snapshot rule a property of the types.

A missing `Recurring` tab is an HTTP **400 `Unable to parse range`**, not a lost grant. `sheetsRequest` throws `SheetsApiError` carrying the status; `fetchRecurring` confirms absence against the spreadsheet's own tab list rather than matching Google's (localisable) prose, and reports `tabMissing` as an empty state. The tab is **never auto-created on load** — all four domains load in parallel on every navigation, so a create-on-load races itself into a duplicate-title 400. It is created by an explicit button, or implicitly by `addRecurring`.

### Settlement math (the core domain logic, in `utils.ts`)

`calculateBalance` computes who owes whom, and reports **real money** — what one would hand the other to square up.

It works in two steps. First the spending **gap**, where anything that changes what is owed by €X counts as **2×X** because it moves both sides at once (one loses X _and_ the other gains X): transfers close the gap (`+2×`), forgiveness applies the opposite sign (`−2×`), and presents are absent entirely.
`gapA = (totalA − totalB) + 2·(transferA − transferB) − 2·(forgivenA − forgivenB)`.

Then `owedToA = gapA / 2`, because expenses are shared 50/50 and the gap is therefore twice the debt: €1000 spent against €500 is a €500 gap but only €250 owed. Reporting the gap was the earlier behaviour and it read as double every settlement.

Changing these signs, coefficients or the halving changes who owes whom and by how much — touch with care.

### Key details

- **Expense sheet layout:** Row 1 = header, row 2 = sub-header, data starts at row 3. Columns: Date | Amount (A) | Amount (B) | Item | Category | Notes | Recurring | Added. The partners' display names are read from these header rows — `readPersonNames` tries row 2 first, then row 1, because row 1 often merges both amount columns under one group label. Transfers/Gifts have a single header row, data from row 2; Recurring likewise. `rowIndex` in each type is the 1-based sheet row number.
- **The "New" badge:** `isRecentlyAdded` in `utils.ts`, over column H, with a three-day window (`RECENTLY_ADDED_DAYS`). It exists because the list is ordered by the date of the _spending_, so a purchase entered today but dated last month lands mid-list where nobody would scroll — and a caught-up recurring payment is always that case. A row with no `addedOn` is **not** recent: that is every row predating the column and anything typed straight into Google Sheets, and "unknown" must not light up a years-old row. A future date does count, since it means a wrong clock wrote it and the row is certainly new. Shown inline on both breakpoints — a badge you must tap a row to see defeats the purpose.
- **Sorting and filtering the expense list:** `sortExpenses`/`filterExpenses` in `utils.ts`, not inline in the component. The default is **date descending**, which for a sheet filled in as the money was spent renders identically to the old `[...expenses].reverse()` — there is a test pinning that equivalence, because it is what makes changing the default safe. Ties break on `rowIndex` following the primary direction; dates failing `isIsoDate` sort last in **both** directions. "Amount" means the row total (`amountA + amountB`), the cost of the purchase rather than either person's share. `filterExpenses` also takes `recentOnly` + `todayIso` for the "Recently added" checkbox, and **ignores `recentOnly` when `todayIso` is not a real date**: answering "show me what is new" by emptying the list reads as "you have no expenses" rather than "the clock is wrong".
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

Mantine v8 component library with Tabler icons. Five routes: `/` (Dashboard with charts via chart.js), `/add` (tabbed Expense/Transfer/Gift/Recurring form), `/list` (`ExpensesPage`: Expenses | Recurring), `/transfers`, `/gifts`. Bottom nav bar for mobile. Theme system with customizable backgrounds in `theme/` (gradient, matrix, squirrel). Date filtering (`filterByDate`/`FilterMode` in `utils.ts`) is shared across the dashboard and lists.

The `/list` tab lives in the **query string** (`/list?tab=recurring`), not the path: `BottomNavItem` marks the current screen with an exact `pathname ===` match, so a sub-route would unlight Expenses — and a path change fires the four-request refetch on every tab switch.

`RecurringPrompt` is rendered once in `AuthenticatedApp` outside `<Routes>`, since what is due does not depend on the screen being viewed. Two things gate it, both load-bearing: `useExpenses` exposes `loadedOnce` so an unloaded (therefore empty) expense list is never mistaken for "no month was ever generated" — which would offer to write every month of every rule — and `useRecurringPending` keys its dismissal on the **set of pending markers** in localStorage, so it cannot nag on every navigation while still asking again when a new month falls due or the rules change. Unticking a month in the prompt writes **nothing**, not even a marker: otherwise "not this month" silently becomes "never".

New components take `names: PersonNames` as a prop like every other; `App` remains the only place that reads it off the context.
