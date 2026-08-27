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

**Hard rule, non-negotiable: every code change ships with tests, in the same
change. No exceptions, and no "I'll add them after".** The sheet is the couple's
only record of who owes whom and there is no backend or audit trail behind it, so
a silent sign error moves real money and stays invisible. There is nowhere to
notice it later.

This means, every time:

- **Every new feature** — the new behaviour _and_ the unchanged path that proves
  existing rows still compute the same.
- **Every bug fixed, and every review finding acted on** — a test that fails
  against the old code and passes against the new one, so it can never come back.
  Name the failure in the test's own words ("does not resurrect a generated
  expense the user deleted"), never "works".
- **Every edge case discovered while working** — if it was surprising enough to
  think about, it is surprising enough to pin.
- **Anything touched that had no tests** — add them retroactively, covering what
  it does today, _before_ changing it. Refactoring untested code is how behaviour
  goes missing silently. A file with no test file is a gap to close, not a
  precedent to follow.

**Still uncovered, and the reason.** These are the only files without tests. Any
of them being touched means writing the tests first; nothing new belongs on this
list.

- `AuthContext.tsx`, `services/picker.ts` — the GIS and Google Picker flows, both
  of which turn on a `<script>` the browser loads and a global the page then
  grows. Worth doing behind a fake, not yet done.
- `InstallButton.tsx` — hangs off the `beforeinstallprompt` event.
- `ThemeToggle.tsx` — a control over `ThemeContext`, which is itself covered.
- `theme/*Background.tsx` (what they _draw_) and `theme/cello/draw.ts` — canvas
  drawing, which has no assertable output. What each background does with the
  page **is** covered: `SquirrelBackground.test.tsx` and
  `MatrixBackground.test.tsx` record the drawing calls through a stubbed
  `getContext` and pin the coordinate space — the buffer in the screen's pixels,
  everything drawn on it in the window's — plus the frame loop and its teardown.
  What is still uncovered is the shape of the figures themselves.
  **A scene's behaviour does not belong in a draw file**: Cello keeps its state
  machine in `theme/cello/scene.ts`, pure and taking its randomness as a
  parameter, and its wiring in `CelloBackground.tsx` — both covered, the latter
  behind a stubbed `getContext` and a mocked `draw`. The squirrel predates that
  split and holds every acorn, icicle and mood in a `useEffect` closure, so its
  tests can only ask what it drew and never what it decided; copy Cello's shape
  for the next scene, not the squirrel's.
- `ExpenseFields.tsx`, `useTransfers.ts`, `useGifts.ts` — no logic of their own;
  exercised through `ExpenseForm`/`RecurringForm` and `useMovements` tests, plus
  a wiring test proving each wrapper drives its own tab.

**The suite runs on half the cores, capped at six** (`maxWorkers` in
`vite.config.ts`). Not a courtesy to the desktop: uncapped, twenty cores ran it
in 14.7s at 1385% CPU and six workers run it in 13.3s at 881% — faster and a
third less work, because past that point the workers contend for memory rather
than getting anything done. `npm run mutate` additionally asks `nice` to put it
last in the queue, since it runs the suite once per mutation and nobody is
waiting on it.

**`npm run test:shuffled` asks whether the suite passes in any order.** Tests
that lean on what an earlier test left behind are green until the day something
is added above them, and then the failure looks unrelated to whatever caused
it. Three were found this way and all three were real: a `clientWidth` spy that
was never restored, a window size jsdom keeps for the life of a file, and
module state that made "before `initAuth` has run" untrue for every test but the
first. The third pointed at a production bug — `downloadBlob` removed its link
only after a successful click, so a blocked one left an anchor in the page for
every press of the backup button.

**`npm run mutate` asks the other question: would the suite notice?** It breaks
each load-bearing thing on purpose — the settlement signs and coefficients, the
asymmetric write ranges that keep a recurring marker from being erased, the
catch-up cap, the guards that decide whether work is skipped, the constants
other constants are derived from — and reports any the tests do not catch. A
survivor is a test that cannot fail, which is how a wrong number reaches the
sheet with everything green. Run it when touching anything on that list; the
list lives in `scripts/mutations.mjs` and adding to it costs two lines.

Three things about it are deliberate. It **refuses to start on a dirty tree**,
because it edits files in place and a crash would come between you and anything
uncommitted. A mutation whose text is **not found, or found twice, is an
error** rather than a pass — a find-and-replace that quietly matches nothing
tests nothing while reporting success. And a mutation that changes no behaviour
does not belong on the list: "measure the band from the park rather than the
tallest tree" is unkillable while the park _is_ the tallest, so what is asked
instead is whether the band follows a banana that outgrows it.

Run `npm run test` before calling any change done, and say plainly if it fails —
never report work as complete on a red suite. If asked whether something is
tested, check rather than assume, and answer honestly: an admitted gap is
recoverable, a wrong "yes" is not.

Keep logic in `services/` where it can be tested directly rather than inline in a
component.

## Before merging anything

**Hard rule, non-negotiable: nothing reaches `main` until all three review skills
have been run over the change and what they found has been dealt with. Every
change, not every feature** — a one-line follow-up to an already-reviewed branch
goes through the same three gates as the branch did. The small changes are the
ones that get waved through, and on this app a small change is exactly how a sign
gets moved.

Run them in this order, because each one's fixes are the next one's input:

1. **`/simplify`** — reuse, duplication, and altitude. Cheapest to act on while
   the code is still fresh, and it shrinks what the other two have to read.
2. **`/code-review`** — correctness. This is the one that catches a moved sign or
   a wrong row index, which on this app is real money moved silently. Claude runs
   this one like any other skill. Only **`/code-review ultra`** — the deep
   multi-agent cloud review — is user-triggered and billed: Claude cannot launch
   that one by any route, so it asks for it explicitly, says the branch is ready,
   and waits. Either way, never quietly treat the step as done because it was not
   run.
3. **`/security-review`** — the token lives in localStorage and the OAuth scope
   grants access to a real person's Drive file, so anything touching auth,
   `sheetAccess`, or what gets written to the sheet needs a look.

**Run them on a clean tree, and do not edit while one is running.** They spawn
a dozen or more subagents that mutate files to see whether the suite notices,
and restore them afterwards — so uncommitted work is theirs to lose, and twice
it was. Commit first; the diff they read is the committed one anyway.

They read the **pending diff on the current branch**, so run them before merging
or squashing, not after — once the change is on `main` there is nothing left for
them to look at. Work on a branch even for a one-liner, so there is a diff to
review.

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

- **Expenses** — main sheet (`VITE_SHEET_NAME`, default `Sheet1`), read `A1:J` (rows 1–2 are the header and sub-header; data still starts at row 3). Both partners can have an amount on one row. Columns G and H are maintained by the app: G is the recurring marker (see below), H is the date the row was added. Columns I and J are the user's: the part of each amount that was only for the person who paid it.
- **Transfers** — `Transfers` tab, range `A2:D`. One partner pays the other to settle the balance.
- **Gifts** — `Gifts` tab, range `A2:E`. Column E is the kind: a `present` (money changed hands, no balance effect at all) or `forgiven` (no money moved, one partner let that much of the other's debt slide — the _inverse_ of a transfer). `toGiftKind` in `types/gift.ts` reads blank and unrecognised cells as `forgiven`, which is what rows written before the column existed already did, so adding it moved no balances.
- **Recurring** — `Recurring` tab, range `A2:L`: `Start | Amount (A) | Amount (B) | Item | Category | Notes | Day | Id | Not counted (A) | Not counted (B) | Every (months) | Amount varies`. Blank `K` reads as monthly and blank `L` as a fixed amount, so a rule written before either column existed keeps behaving exactly as it did — same guarantee as `toGiftKind`. **Metadata, not money** — a recurring rule never enters `calculateBalance`; only the expense rows it produces do, and those are ordinary expenses. B–F mirror the expenses tab's B–F so `formatAmount`/`normalizeAmount`/`toCategory` are reused and generating a row is a straight copy.

For Transfers and Gifts, the form captures a single `from` person + `amount`, but the sheet stores it in one of two columns (`amountA`/`amountB`); the empty column encodes direction. `transferFrom`/`giftFrom` in `utils.ts` recover the direction by checking which column is non-empty.

### Recurring payments (`services/recurring.ts`, pure)

Four rules hold this together. Breaking any of them moves real money.

- **A generated expense is a snapshot, never a live view of its rule.** Column G holds `rec:<ruleId>:YYYY-MM` as _provenance only_. Nothing may read a marker and write back into an expense row: raising a subscription's price, renaming it or recategorising it must leave every past row byte-identical, because those rows record what was actually paid.
- **The expenses read/write ranges are deliberately asymmetric**: read `A1:J`, append `A:J`, update two ranges. A PUT rewrites its whole range, so a single `A{n}:J{n}` would blank G and H on every edit — the month would read as never generated and be created a second time, and the added-date would be lost. `updateExpense` therefore sends one `values:batchUpdate` covering `A{n}:F{n}` and `I{n}:J{n}` and skipping over the two in between, which keeps both unerasable by construction while still letting the user edit I and J. Appending writes the full `A:J` because the row is new: there is no marker to protect. `ExpenseFormData` has neither field, which is also why Duplicate yields a fresh, unmarked, freshly-stamped row.
- **Occurrences sit on a schedule anchored at the rule's start month**, stepping by `everyMonths` (1–12, `toEveryMonths` clamps whatever the cell holds). A bi-monthly bill starting in March falls in May and July, never April. Resuming rounds **up onto** that schedule rather than stepping forward from wherever the last one was, which is what makes a rule whose interval was changed later snap back to its anchor instead of drifting a month further out on every edit. Because occurrences are at least a month apart, the `YYYY-MM` marker still names exactly one — no marker change was needed.
- **The catch-up cap counts occurrences, not months** (`MAX_CATCH_UP_OCCURRENCES`), measured back from the latest occurrence at or before today. In months it would mean two years for a monthly bill and two _occurrences_ for a yearly one, silently dropping the rest of its history on a fresh install. For a monthly rule the bound is identical to the old one.
- **A payment whose amount varies** (`amountVaries`) holds no amount, not-counted included: the figure is unknown until the bill arrives. Established once, in `fetchRecurring` — a hand-edited sheet can hold `yes` beside a leftover figure, and the form is not the only way in, so normalising at the read boundary is what stops the list showing an amount next to the badge saying nobody knows it. `RecurringPrompt` then refuses to write the row until someone types one, treating a typed **zero as no figure** — a `€0` row is worse than no row, because it settles as though the bill were free. The rule's form hides the money fields when the box is ticked and clears them, so unticking cannot resurrect a stale figure.
- **Generate forward from the last occurrence already generated, do not backfill holes.** Deleting a generated expense is a decision; an app that quietly recreates it next launch is worse than one that misses a month. A month is due only once `dueDate(month, day) <= today`, which covers both the current month and the rule's start month. Capped at `MAX_CATCH_UP_OCCURRENCES` (24) — see the schedule bullets above.
- **Ids live in the sheet, not in the row number.** Deleting any row renumbers `rowIndex`, so a marker keyed on it would point at a different rule. A rule with a blank `Id` (added by hand) is listed but never generated from.

Month arithmetic is done on `YYYY-MM` strings and integers, with `Date.UTC` used only to count days in a month, so no timezone can shift a payment into the wrong month. `pendingRecurring` takes `todayIso` as a parameter and `Pick<Expense, 'recurringMarker'>[]` for the existing rows — it cannot see a `rowIndex` even if a caller wanted it to, which makes the snapshot rule a property of the types.

A missing `Recurring` tab is an HTTP **400 `Unable to parse range`**, not a lost grant. `sheetsRequest` throws `SheetsApiError` carrying the status; `fetchRecurring` confirms absence against the spreadsheet's own tab list rather than matching Google's (localisable) prose, and reports `tabMissing` as an empty state. The tab is **never auto-created on load** — all four domains load in parallel on every navigation, so a create-on-load races itself into a duplicate-title 400. It is created by an explicit button, or implicitly by `addRecurring`.

### Settlement math (the core domain logic, in `utils.ts`)

`calculateBalance` computes who owes whom, and reports **real money** — what one would hand the other to square up.

It works in two steps. First the spending **gap**, where anything that changes what is owed by €X counts as **2×X** because it moves both sides at once (one loses X _and_ the other gains X): transfers close the gap (`+2×`), forgiveness applies the opposite sign (`−2×`), and presents are absent entirely.
`gapA = (totalA − totalB) + 2·(transferA − transferB) − 2·(forgivenA − forgivenB)`.

Then `owedToA = gapA / 2`, because expenses are shared 50/50 and the gap is therefore twice the debt: €1000 spent against €500 is a €500 gap but only €250 owed. Reporting the gap was the earlier behaviour and it read as double every settlement.

### Spending that is not shared

Columns I and J hold the part of each amount that was only for the person who
paid it — €100 spent with €10 of it for one of them alone.

Only the **shared** part reaches the gap: `sharedA = totalA − notCountedA`, and
the formula above is otherwise untouched. So that row is still €100 of spending
in the totals and the charts, but €90 of sharing, and the other owes €45 rather
than €50.

`notCounted` is a **slice of the amount beside it, never a figure on top**. More
than the whole would make the shared part negative and pay the wrong person, so
`notCountedProblem` in `utils.ts` refuses it in both forms _and_ `calculateBalance`
clamps with `Math.min` — the form covers what is typed in the app, the clamp
covers what is typed into Google Sheets.

A recurring rule carries the same two columns, so a payment that is partly
personal every month does not have to be corrected on each generated expense.

Changing these signs, coefficients or the halving changes who owes whom and by
how much — touch with care.

### Key details

- **Expense sheet layout:** Row 1 = header, row 2 = sub-header, data starts at row 3. Columns: Date | Amount (A) | Amount (B) | Item | Category | Notes | Recurring | Added. The partners' display names are read from these header rows — `readPersonNames` tries row 2 first, then row 1, because row 1 often merges both amount columns under one group label. Transfers/Gifts have a single header row, data from row 2; Recurring likewise. `rowIndex` in each type is the 1-based sheet row number.
- **The "New" badge:** `isRecentlyAdded` in `utils.ts`, over column H, with a three-day window (`RECENTLY_ADDED_DAYS`). It exists because the list is ordered by the date of the _spending_, so a purchase entered today but dated last month lands mid-list where nobody would scroll — and a caught-up recurring payment is always that case. A row with no `addedOn` is **not** recent: that is every row predating the column and anything typed straight into Google Sheets, and "unknown" must not light up a years-old row. A future date does count, since it means a wrong clock wrote it and the row is certainly new. Shown inline on both breakpoints — a badge you must tap a row to see defeats the purpose.
- **The `Recurring` tab-existence cache** in `sheets.ts` is keyed by spreadsheet id, not just by session. A dropped grant sends the user back to the picker without the module unloading, and the next sheet owes the first one nothing.
- **Sorting and filtering the expense list:** `sortExpenses`/`filterExpenses` in `utils.ts`, not inline in the component. The default is **date descending**, which for a sheet filled in as the money was spent renders identically to the old `[...expenses].reverse()` — there is a test pinning that equivalence, because it is what makes changing the default safe. Ties break on `rowIndex` following the primary direction; dates failing `isIsoDate` sort last in **both** directions. "Amount" means the row total (`amountA + amountB`), the cost of the purchase rather than either person's share. `filterExpenses` also takes `recentOnly` + `todayIso` for the "Recently added" checkbox, and **ignores `recentOnly` when `todayIso` is not a real date**: answering "show me what is new" by emptying the list reads as "you have no expenses" rather than "the clock is wrong".
- **Deletes** go through `deleteRow` (batchUpdate `deleteDimension`), which looks up the `sheetId` by tab title — so deleting renumbers `rowIndex` for everything below; the UI reloads after mutations rather than patching in place.
- **Date handling:** The sheet may store dates as serial numbers (Google Sheets epoch) or text in various formats (DD/MM/YYYY, DD.MM.YY, etc.). All normalization is in `services/parsing.ts`.
- **Amounts:** Stored/displayed with `€` prefix and comma thousands separators. `parseAmount`/`formatAmount` in `parsing.ts` convert between display format and raw numbers.
- **Categories:** Fixed set defined in `types/expense.ts`: Car, Food, Health, Holidays, Home, Various.
- **Auth:** `services/auth.ts` dynamically loads the GIS script and manages the OAuth token client. `AuthContext` wraps the app. The scope is **`drive.file`**, not `spreadsheets` — the token authorises only files the user picked, so a leaked token cannot touch the rest of the account's Drive.
- **Picker app id:** the picker must be given the Cloud project number (`setAppId`) or no per-file grant is created — the pick appears to succeed and every later Sheets call 404s. It is derived from `VITE_GOOGLE_CLIENT_ID` (`getProjectNumber` in `services/auth.ts`), not configured separately, because a mistyped number is still a number and fails silently.
- **Sheet selection:** because `drive.file` grants per file, the target spreadsheet is chosen through the Google Picker (`services/picker.ts`) and remembered in localStorage (`services/sheetAccess.ts`). `App` renders `SheetGate` until a sheet is granted, which also keeps the fetching effect from running without one. A 403/404 from the Sheets API drops the grant and returns to the picker.
- **Addressing the spreadsheet:** `sheetsRequest` takes the path _within_ the sheet (`/values/A1:B2`, `:batchUpdate`, `?fields=…`) and builds the spreadsheet's own segment itself, percent-encoded. Callers must never interpolate the id: it is not a literal but stored text, read back out of localStorage on every launch long after the pick that wrote it, and a raw `a/b` addresses spreadsheet `a` with `b` grafted onto the front of the path — a different sheet, or a different operation, than the caller asked for. Eighteen callers each pasting it in was eighteen chances to forget; one place to do it is none. The two calls that do not go through `sheetsRequest` — the Drive export in `exportSpreadsheet` and the Drive diagnostic in `describeSheetAccess`, which cannot, since it runs inside the failure branch `sheetsRequest` throws from — encode for themselves, for the same reason. `sheets.test.ts` pins this over every exported operation.
- **Service worker updates:** `services/swUpdates.ts` checks on foreground (`visibilitychange`/`focus`) with a one-minute floor, not on a timer. The old `setInterval` re-fetched the worker and revalidated the ~1 MB precache every minute for as long as the tab existed — an installed PWA is left open for days, so nearly all of that happened while nobody was looking.
- **Labelling the app's columns:** `fetchExpenses` reports `columnsUnlabelled` from the header rows it already read, and `useExpenses` writes the headings after the first successful add or edit — not on load, because writing to someone's spreadsheet merely because they opened the app is the surprise this app avoids, and not from `ensureRecurringSetup` alone, because that left anyone who never opened the Recurring tab with four unexplained columns of money. Best-effort: the expense has already saved, so a failed labelling is not a failed save.
- **Claiming columns:** the app owns expenses G–J and Recurring I–J. Nothing verifies they were free before it starts writing them, so pointing this at an existing spreadsheet with content there reads it as money and overwrites it on the next edit. This is documented as a warning in the README rather than enforced in code; if that ever needs enforcing, gate ownership on the labels in the sub-header the way the Recurring tab gates on its own existence.
- **Backing up (`services/backup.ts`):** the settings drawer downloads the whole workbook through Drive's **export** endpoint — a Google-native spreadsheet has no bytes of its own, so only a conversion answers. Three rules hold it together. **A 403 is ambiguous**: Drive refuses a file over its 10 MB export cap with one, and reading that as a lost grant would send the user back to the picker to re-grant a sheet that would still be too big. `authorizedFetch` therefore takes `keepGrantOn` from the caller that knows its own harmless 403s, and everything unrecognised still drops the grant — holding on to one that really was revoked fails every request forever. **The file name is computed, never read off the response**: `Content-Disposition` is not CORS-exposed. `backupFileName` is pure and sanitises the sheet's own title before it becomes a path, separators first, so `../../etc` collapses to `etc` rather than surviving as `..`. **The bytes come before the name**: `backupSpreadsheet` exports first and asks for the title second, so a failure reports what stopped the download, and an unreadable title falls back to a default instead of failing a backup that worked.
- **Deployment:** GitHub Pages — `vite.config.ts` sets `base` to `/specter-finances/` when `GITHUB_ACTIONS` env is set.

### Provider hierarchy (main.tsx)

BrowserRouter → AuthProvider → ExpensesProvider → ThemeProvider → App

### UI

Mantine v8 component library with Tabler icons. Five routes: `/` (Dashboard with charts via chart.js), `/add` (tabbed Expense/Transfer/Gift/Recurring form), `/list` (`ExpensesPage`: Expenses | Recurring), `/transfers`, `/gifts`. Bottom nav bar for mobile. Theme system with customizable backgrounds in `theme/` (gradient, matrix, squirrel, cello). Date filtering (`filterByDate`/`FilterMode` in `utils.ts`) is shared across the dashboard and lists.

**Backgrounds are listed once, in `theme/registry.tsx`, and that is the only place any of them is named.** The `BackgroundName` union is derived from the list, so a background cannot be half-added, and `loadSettings` validates a stored name against it with `isBackgroundName` — storage outlives releases, and an unrecognised name used to render nothing at all. (The union is `BackgroundName`, not `BackgroundEffect`: that name belongs to the component in `backgrounds.tsx` that renders one.)

**"Random" is a choice, not a background.** It has nothing to render and no
floor to stand in, so an entry in `BACKGROUNDS` would have the stage asking it
for both and getting the wrong answer: it lives beside the list as
`RANDOM_BACKGROUND`, and the setting is a `BackgroundChoice` (`BackgroundName |
'random'`). What the app draws is `resolvedBackground` on the theme context, and
**everything that reacts to a background reads that** — the scene in
`backgrounds.tsx`, the floor and clip in `BackgroundStage.tsx`, and the chrome
the card tint leaves alone. Reading the choice instead draws nothing at all.

The roll lives in `theme/random.ts`, pure and **taking its randomness as a
parameter** the way `cello/scene.ts` does, so a shuffle is something a test can
hold still. It is rolled once per launch and deliberately never stored: once per
launch means a fresh pick each launch, and a stored roll would freeze the first
shuffle forever. It re-rolls on three things — choosing Random afresh, pressing
**Shuffle again**, and a pool change that leaves the background on screen out of
the pool. Not on every tick, which would yank the scene away while someone is
still building the list. The button is not a convenience: Mantine's `Select`
fires no `onChange` when the option already showing is picked again, so "Random"
cannot re-offer itself and a relaunch would otherwise be the only way to a
different scene.

**What is stored is what the user turned _off_** (`randomExcluded`), and the
pool is derived from it against the registry (`poolFrom`). Stored as the list
that was ticked, the pool would freeze: the whole settings object is written
back on any theme change, so a background added to `BACKGROUNDS` later would
join the shuffle of nobody who had ever touched their settings. Exclusions also
make the load path fail safe — dropping a stored name this build does not know
puts a background back _into_ the shuffle, where the same pruning over stored
inclusions emptied the pool and left a blank screen the user never chose.

A pool with nothing in it resolves to `none`, and the drawer says so. Note the
drawer keys that sentence on the **pool**, not on what it resolved to: a pool
holding only the plain background is a blank screen somebody asked for, and
reporting that as "nothing ticked" would be untrue.

The provider holds the settings and the roll in **one state atom** (`ThemeState`).
Apart, each writer of the pair reads the other out of the render scope, which
inside a React batch is the value from before the batch — a pool change followed
by a re-roll in the same handler then rolls against the pool it just replaced.
The roll _value_ is still drawn outside the updater, since React invokes those
twice under StrictMode.

A background that draws _over_ the app rather than behind it (canvas at z-index 101, not −1) declares a `floor` — **a function of the window's width**, since a scene may draw itself smaller on a narrow one and should then ask for less of it — and the layout obeys: `BackgroundFloor` masks everything above the band, `BackgroundSpacer` reserves the matching scroll room inside `AppShell.Main`, and `ThemeContext` leaves the header and footer out of the card-transparency tint so the scene does not show through the chrome it stands on. `App.tsx` names no theme and does not read the theme context at all; asking the registry is the whole point, and `FOOTER_HEIGHT` in `theme/chrome.ts` is the single source for the height the AppShell footer and the floor both depend on. `BackgroundStage` reads the width through `useSyncExternalStore` on `resize`, so the band is re-measured rather than fixed at mount — read once, a phone turned to landscape masks the portrait band for the rest of the session. `drawsOverTheApp` is deliberately _not_ derived from the height any more: whether a scene stands in a band is a fact about the scene, and asking for a height would mean picking a width to ask about.

**What a background may paint on is granted by the system, not chosen by the theme.** `BackgroundEffect` wraps whichever background is showing in `SceneLayer`, which takes the footer's band away from the ones that draw over the app. It has to: a scene's canvas is fixed across the whole viewport, so the navigation bar is underneath it, and Cello's opaque ground painted straight over all five buttons — an app that could not be navigated, with no error to notice. A new scene cannot opt out, because a new scene does not render the clip; the registry does, and `backgrounds.test.tsx` drives that assertion off `BACKGROUNDS` so a background added later is covered the day it is added. Two details are load-bearing: it is `clip-path`, not `overflow: hidden`, because a `position: fixed` canvas escapes an ancestor's overflow; and the clip **must** carry `SCENE_Z` itself, because clipping makes it a stacking context and a canvas's own z-index is then resolved inside it and never reaches the page — leaving that off sinks the whole scene behind the app. The scenes still set a z-index of their own; inside the clip it is inert. And it wraps **only** the backgrounds that draw over the app: that stacking context is a one-way door, so the gradient and matrix at `z-index: -1` get hoisted in front of the whole app by it — wrapping them "for uniformity" left the gradient covering every row, chart and form with only the nav bar showing. `backgrounds.test.tsx` pins both directions against `drawsOverTheApp`.

The `floor` belongs to the scene, and Cello's is **derived, not chosen**: `SCENE_REACH` is the taller of its chimney cap and its bird at the top of his hover, and `celloFloor(width)` scales that by `sceneScale(width)` and adds the ground clearance — which stays in **screen** pixels, since `CelloBackground` works the ground out in screen pixels before dividing by the scale. Rounded **up**, so a band can never be half a pixel shorter than the scenery standing in it. Anything above the floor is painted over the user's own list, so a hand-picked number goes stale the moment the scenery grows — but what is _thrown_ is deliberately outside it. A pizza sailing up over the app, like the squirrel's falling acorns, is the point.

Cello's left is a park, a school and a light beige Fiat 500 — which she drives, see below — mirroring the oven on the right. One thing there moves on its own: she lets herself into the school now and then, the window lights while she is inside, and the bird — having no shoulder to sit on — waits in the nearest tree. That last part is **a substituted target, not a new phase**: `perchX`/`perchY` return her shoulder or the treetop, and `perched`, `escorting` and even a dive for a passing pizza go on working without knowing she is gone. Two things follow from `perched` holding him _at_ his perch by setting his position every frame, and both were jerks worth naming: he must fly the last of the way down (`landing`) rather than entering `perched` from a hover and covering the whole hover height in one frame, and when the perch itself becomes a different perch — she goes in, she comes out — he notices for himself: `bird.perchedOn` remembers which perch he took, and `perched` puts him back in the air when it no longer matches `currentPerch`. **Identity, not distance, and not the caller's memory**: keying it on the two girl transitions that cause it today would leave the next cause to reintroduce the jump, while a geometry check would make `perched` doubt its own invariant and break every deliberate placement. The lit window and the swinging door are **derived from her phase** rather than stored, so a lit window with nobody in it is not a state the scene can reach, and `treeSway` is pure so the wind is something a test can hold. The chimney stands on the right-hand slope with its foot **cut to the pitch** — drawn square it had one corner buried in the roof and the other hanging over air — and smokes only while she is in there, through the same puff machinery the oven uses. Her silhouette at the window is gated on the same `schoolLit`, so the light, the smoke and the shadow cannot disagree about whether anybody is home. Sizes live in `scene.ts` beside `SCENE_REACH`, which counts the chimney rather than the ridge (it stands part way down a slope, so it is the taller) and is otherwise derived from one list of **perch heights** (`PERCH_HEIGHT`) plus how far above one he gets — the same list `perchY` places him with, so a perch added there cannot be forgotten here. He sits _in_ the crown rather than on top of it, which is both what a bird does and the difference between reserving 198px of the user's list and 171px: the band is measured from wherever he settles highest, so where he sits in a tree, not the park itself, is what costs screen. It grew 158px → 171px.

**Canvas backgrounds are sized in device pixels, and that is separate from the
scene's own scale.** `fitCanvas` in `theme/chrome.ts` is the single place it
happens: it puts the backing store at the viewport's size times the ratio,
sets the element's _CSS_ size explicitly, scales the context by the ratio, and
hands back the size in CSS pixels — after which a background works in CSS pixels and knows
nothing about any of it. Sized in CSS pixels alone the scene was drawn at a
fraction of the screen's resolution and stretched back up by the display: soft
on a laptop at 1.25, and on a phone at 3 every edge in the scene was upscaled
threefold. All three steps are load-bearing. The CSS size has to be set
explicitly, because a canvas with no width or height in its style lays out at
its _attribute_ size, which in device pixels is wider than the window it covers
— and its **width** is measured by `viewportSize`, not from `innerWidth`, since
a classic scrollbar counts towards the latter but not towards the containing
block of a `position: fixed` box: sized from it, `left`/`right`/`width` are all
constrained, CSS drops `right`, and the last strip of the scene is drawn off the
side of the screen. The **height** stays `innerHeight`, deliberately and not for
symmetry's sake: `clientHeight` is the layout viewport, pinned on a phone, so it
does not move when the URL bar collapses — while the footer, measured with
`getBoundingClientRect`, does. Taking it from there stood the scenery ~90px
above the navigation bar, and permanently, since a height that cannot change
also tells every resize guard that nothing has.

**Asking how big the window is goes through `theme/chrome.ts`, and lint
enforces it.** `viewportSize`, `canvasPixelRatio`, `footerHeight` and
`headerHeight` are the only places these are read, and `no-restricted-globals`
/ `no-restricted-properties` make going round them a build error everywhere
else. Not a style preference: three bugs in a row came from moving one of these
readings and not finding every other reader — a canvas fitted to the viewport
whose guard still compared the window, so it never fired; a band measured
differently from the scenery standing in it; and a height taken from the layout
viewport, which does not move when a phone's URL bar does. Each was a grep
somebody had to remember to run, and each shipped.

**One definition of "the viewport", used by everything.** A background that
fits to one measure and decides whether to re-fit by another never re-fits — or
never stops: comparing `innerWidth` against what `fitCanvas` had measured, the
guards never once fired on a desktop with a scrollbar, so every one of the
dozens of resize events a URL-bar collapse sends reallocated the buffer. Cello
lays the _scene_ out in it too, or the scenery is arranged for a stage a
scrollbar wider than the one it is drawn on — and so does `BackgroundStage`,
which reserves the band that scenery stands in: measured from two different
widths, "the band covers the scenery" stops holding by construction and holds
only where `clientWidth <= innerWidth`, which is a platform's habit rather than
a guarantee. The fallback to `innerWidth` is load-bearing rather than
defensive — `clientWidth` is 0 wherever the document is not laid out, and a
canvas sized to zero draws nothing and then agrees with every guard that nothing
has changed. `test-setup.ts` therefore has the document follow the window, so
the suite measures what a browser measures rather than that fallback.

**A width the page can move must be held, not measured on demand.**
`BackgroundStage` keeps its width in a variable the resize listener writes,
because `useSyncExternalStore` re-reads the snapshot after every commit: reading
`clientWidth` there closes a loop the stage drives itself — the spacer adds page
height, that brings a scrollbar, the scrollbar takes width, the narrower width
asks for a shorter band — which React answers by re-rendering until it throws
`Maximum update depth exceeded`, blanking the app. Holding it also takes a
forced layout flush off every render of the app, since `clientWidth` flushes
where `innerWidth` did not. And because a scrollbar appearing fires **no**
`resize` at all, the stage watches `document.documentElement` with a
`ResizeObserver` as well as the window.
All three compare the viewport _and_ the ratio before refitting, because
reallocating the buffer zeroes it and mobile browsers ask dozens of times as the
URL bar collapses — and all three keep the buffer and the scene as **two**
decisions, since a change of monitor alters nothing about the stage: folding
them into one early-out teleports the girl mid-stride, restarts every falling
acorn and re-seeds the rain. Cello's comparison includes the footer's measured
height, or a footer that lays out taller than the sign-in screen's fallback
leaves the ground where it was for the session. And the ratio is **capped at `MAX_PIXEL_RATIO`**: the buffer is the whole
viewport, repainted for as long as the app is open, so its cost grows with the
square of the ratio while most of those pixels never hold anything — a scene
only reaches its floor up the screen. Two takes the sharpness that matters at a
fraction of the paint.

It lives in `chrome.ts` rather than in a scene because every canvas background
needs it and a scene that forgot would simply be blurry — nothing would fail.
All three canvas backgrounds call it. The squirrel took the most moving: it read
`canvas.width` as a **scene coordinate** in sixteen places, and its own click
handler compares the squirrel's `x` against a click's `clientX`, so a buffer in
device pixels would have put the squirrel at twice his own position and made him
unrescuable. Its width and height are now closure variables in CSS pixels, which
is what the whole file already assumed they were.

A ratio change is **not** a resize event: moving a window between monitors can
leave `innerWidth` and `innerHeight` untouched, and `resize` is not specified to
fire. `watchPixelRatio`, beside `fitCanvas` and used by all three, watches
`matchMedia('(resolution: Ndppx)')` and re-arms at the new ratio. Left in one
scene, the other two kept the launch screen's buffer for the life of the tab —
which for an installed PWA is days. Three guards, all load-bearing: on the
_listener_ rather than on `matchMedia`, since Safari 13 returns a real
`MediaQueryList` carrying only `addListener` and the throw lands inside the
effect before its cleanup closure exists, unmounting the whole app to a blank
screen over a background; on `matches`, because a query born false can never
_change_ to false and would be silently dead for the session, which fractional
display scaling (ratios like 1.100000023841858) reaches; and re-arming on every
change, or one move between monitors would be all it ever noticed. Its `resize` also keeps the buffer and the _scene_ as two
decisions, because `resizeScene` is not a no-op on unchanged input — it puts the
girl back at the nearer end of her walk — so folding the ratio into one
early-out teleported her mid-stride for a change of monitor. Clicks are still
divided by `sceneScale` alone: `clientX` is in CSS pixels.

**The scene is drawn to scale, and works in its own units.** `sceneScale(width)`
runs from 1 at `SCENE_FULL_WIDTH` down to `SCENE_MIN_SCALE` at a phone's width,
and `CelloBackground` hands the scene a stage of `width / scale` — so at 360px
the layout has ~500 units to place a school, a car and a walk in, and nothing in
`scene.ts` knows the window got smaller. `drawScene` applies the one `ctx.scale`,
and clicks are divided by the same number on the way in. The alternative —
laying the scene out differently on a phone — means every measurement in the
file growing a narrow-window case.

**The car's outline is traced, and lives in `scene.ts`.** `CAR_OUTLINE` is the
ink contour of a side-on drawing of the real car, nose-left, wheel wells
included — cut as a separate arc over the body they read as hoops standing clear
of the tyres, which is what three rounds of hand-placed control points kept
producing. It sits in `scene.ts` rather than in `draw.ts` because **a perch
depends on it**: `ROOF_BACK` is derived from the flat of that roof, and seven —
measured against the hand-drawn car whose apex was at 0.57 of the length — left
the bird on the leading edge of the traced roof with his body over the
windscreen. The same rule as `bananaLean`. Deliberately _not_ restored: the
`beigeShade` arch stroke that used to ring each wheel. The traced wells are
downward tabs at the contact patch rather than cutouts, so each tyre does sit on
unbroken bodywork — checked on screen at 26x, where it reads as a wheel in a
well, and the stroke is what made them read as hoops in the first place.

**The Fiat is the middle of the scene, not scenery.** She walks the two ends —
the park and the school at one, home and the oven at the other — and drives the
stretch between them, with the bird in the seat beside her. The car waits at
`carSchoolX` or `carHomeX`; **home is the oven end**, which is what the
pizzaiolo is cooking for. Both are `null` together on a window with no room to
park one clear of him, or too narrow for the drive to be worth getting in for,
and then nothing about the drive happens at all. Reaching the car she either gets in or **turns round** —
the car is the end of her walk when she is not taking it, so she stays at the
end she is at and is out of the middle either way. That chance
(`LEAVE_HOME_CHANCE`) is what sets the shape of her day: boarding on the first
arrival gave each end exactly one lap, and since the school end is wider and has
a visit inside it, she was at work two thirds of the time and home for a tenth
of it. It is now roughly **44% home** (with a good part of that on the
lounger — pinned as its own share, since the chance to lie down says nothing
about how many afternoons she actually gets), **16% driving** and **40% at
school and in the park**, which `scene.test.ts` measures over three seeded days rather than
assuming — the split is set by five constants pulling against each other and no
one of them states it. The home end is a **share** of the room between the
school's car and the end of her walk (`HOME_WALK_SHARE`), not a fixed distance:
fixed, a wide window gets a home end she crosses in a moment and a narrow one
has no room to drive at all. Which end the car is parked at is held as `car.at`, not recovered by
comparing `x` to a layout number — the same rule as `bird.perchedOn`, and for
the same reason: the first thing that nudges the car by a pixel would make it
unboardable for ever, with nothing to see but a girl who stopped taking it. It
starts parked at whichever end she was dropped into the scene at — and **she is
dropped at an end**, never in between: placed anywhere in her range, she can
open the scene mid-way with the car behind her and walk the entire middle on
foot, which is the one journey the car exists to prevent. `resizeScene` puts her
back to the nearer end for the same reason, since a window that changes size
moves both ends underneath her.

**A drive to the school is an errand.** Alighting there sets `girl.dueAtSchool`,
and the door lets her in on it regardless of `VISIT_CHANCE` — driving somewhere
and not going in is a car park, not an errand. She leaves the school heading
**west**, into the park: leaving eastwards walks her straight back to the car,
and the park then never gets walked at all.

**The oven cooks for someone who is coming home** (`homeward`). No pizza while
she is at the school end, in the park, or being driven there — he is making them
for her, and one tossed while she is away is one nobody is there for. A window
with no car has no ends to be at, so the old rule stands there. This is also
what makes the two clickable things worth clicking: with the oven running
regardless, the bird spent about half the scene's life lying on the ground too
full to fly.

**"Settled" is measured against the perch, not against the ground**
(`perchVX`/`settledOnPerch`). Her shoulder walks and the car drives; a bird
holding station over a car doing 3px a frame has a speed of 3, so a check
against zero meant he could only ever land on something stopped — he flew above
the car for entire drives and got in only during the pause while she boarded.

**She turns, rather than flipping.** `girl.facing` eases between −1 and 1 while
`dir` snaps, because the shoulder he sits on is the one _behind_ her: taken off
`dir`, a turn moved his perch the width of her body in a single frame with
`perched` pinning him to it — a 26px teleport across her, twice a lap, for as
long as the scene ran. `boarding`/`driving`/`alighting` mirror the school's
`entering`/`inside`/`leaving`, and the speed is taken from how far the car has
come and how far is left rather than from a stored velocity — so it eases at both
ends by construction, and a resize that moves the spots changes only how quickly
it arrives. `resizeScene` puts her back on her feet when a window loses its car.

**The seat is a third perch, and that is the whole of it.** `PERCH_HEIGHT` gains
`car`, `currentPerch` returns it while she is boarding or driving, and the
`perchedOn` identity rule already in `perched` flies him over — the same
mechanism that moves him to the tree when she goes into the school. A pizza still
beats the drive, and he comes back to whichever perch is current afterwards
without either feature knowing about the other.

**The throw comes out of the swing.** `peelSwingAt`/`peelAngle`/`peelTip` live in
`scene.ts` and `draw.ts` reads them, because the two owning separate copies is
exactly what the old throw was: the pizza was born beside his head while the peel
held it an arm's length up and to the right, so it hopped backwards out of the
paddle as it was released. It now leaves **from the tip**, along the path the
carry point was already travelling, snapped up by the wrist (`PEEL_SNAP`) — the
paddle's own speed is a lob. It goes at `PEEL_RELEASE_SWING`, part way round
rather than at the top of the arc, where the tip is travelling almost straight
left and a pizza let go there is thrown sideways; the arm follows through and
eases back over `PEEL_RECOVER_FRAMES`. `movePizza` runs **before** `runOven` so a
pizza released this frame is drawn at the tip rather than a frame's flight away
from it.

**Clicking her is the one thing in the scene the user starts that is not about
food.** Walking, a click blows a `kiss` heart from her mouth and reaches him in
either of the two states a call can reach (`callable`): hovering, he flies down;
too full to fly, his digestion is cut short exactly as clicking _him_ already
does, and the takeoff still plays out so he returns rather than appearing.
Nothing happens if he is already on her shoulder, already on his way down, or
has a pizza in the air or in his beak. Her hit box is much wider than she is
drawn — she is a few pixels across on a screen a thousand wide. `clickScene` keeps working through a
`document` listener with the canvas at `pointer-events: none`, so none of this
costs the app a tap.

**Squirrels live in colonies, one pair to a colony and a colony to a stand of
trees — `COLONIES` in `scene.ts` says which, and everything else follows from
it.** Today that is a pair in the park and a pair in the bananas, and in nothing
else. It used to be three conventions that happened to agree: the seeding split
the index in half, the kissing walked the list two at a time, and a squirrel's
stand was recovered from whichever tree it was in. They agreed only at exactly
two colonies of two — at three, the third squirrel came out identical to the
first in every seeded field and one pair straddled the two stands, so it shared
no tree and could never kiss. A squirrel carries its `colony` for the same
reason `bird.perchedOn` and `car.at` are carried: a fact about the animal that
can only be recovered by measuring where it stands is a fact the next nudge
changes. They climb a **spiral** round a trunk
rather than a straight line up one side — a squirrel on a vertical line reads as
a lift — which means they pass behind the tree, which is why each colony is
drawn in **two passes around its own stand**: `squirrelBehind` says which side
of the trunk, and `inPark` says which trees. Both matter. Split only by side and
run once around the park, a banana squirrel was painted before its own plant on
both passes, and the half of the spiral that should have gone behind the stem
read as a squirrel blinking out instead. They sit in a crown a while, and jump
to **any other tree in their own stand**, in an arc scaled to the distance and
normalised by _that stand's_ spacing, often aimed at wherever another one is
(`MEET_CHANCE`). The stand is the whole rule. It used to be a distance —
`CROSS_REACH`, 150 units — which looks like it separates the colonies and does
at a desktop width, but the scene squeezes as the window narrows and below
~385px the nearest park tree and the nearest banana came within one jump of each
other. Squirrels emigrated within seconds, a pair ended up split across the two
stands — and since kissing needs both in one tree and pairs are fixed at
creation, neither pair could kiss again — while the jump itself flew through the
schoolhouse. `inPark` cannot be squeezed. The distance is **gone** rather than
kept alongside: within a stand the widest gap is 88 units of park or 54 of
banana, so it could never once have excluded anything, and a predicate that
cannot fire is a trap — widen the park past it and a squirrel would simply stop
crossing, with nothing to notice.

Crossing, a squirrel is drawn moving to the **height it will land at** rather
than holding the height it left and dropping the difference on arrival: the
bananas are 62 and 46, so carrying the height across and clamping it on the last
frame swallowed 16 units at once, against the two a frame the hop itself moves.
The arrival lands exactly where the flight was drawn heading. **And `up` is not
only a height** — the spiral is `side + up * SPIRAL_TURNS` turns — so rescaling
it on landing also spun the squirrel round the trunk, which is the same jerk
moved from the height into the width. The difference goes into `side`, where the
phase lives, so it lands on the side it flew in on. A kiss **borrows nothing it has to give
back**: it faces a pair at each other with two fixed angles, and the second
colony's are tilted a sixth of a turn (`KISS_TILT`) so that the four do not come
out of it holding two values between them — `sin` and `cos` cannot tell 90
degrees from 90 degrees, and both colonies climbing down in step is the "one
squirrel with a shadow" the seeding spread exists to prevent. Restoring a stored
side on release instead moved the spiral 17.4 units in a single frame, twice the
worst jerk anywhere else in the scene, and popped the squirrel from in front of
the trunk to behind it in half of all releases.

**How wide a circle it goes round is the tree's, not always the park's**
(`treeRadius`), and for a banana it is **the stem's own half-width at the top**
(`BANANA_STEM_TOP`, which `draw.ts` draws it at) rather than a number picked
beside it. A park tree has a crown to orbit inside; a banana has a pseudostem a
few units across, so a squirrel swung at the park's radius hung in open air
beside it — and `squirrelBehind` then hid it behind a stem a fifth as
wide for half of every turn, which is the blinking the two-pass draw exists to
stop, in the stand it was added for. Finding
themselves together at the top of one, they sometimes kiss, with hearts over
them — decided in `runSquirrelPair` after the per-squirrel loop, because it takes
two and a loop that sees one at a time cannot settle it. `up` runs 0 at the foot
to 1 at the top of the crown, so a squirrel's height is its tree's: it cannot
climb out of the band the app reserved by climbing higher than the tree it is
in. The plants' positions are **spaced by how many there are** rather than read
off a second hand-written list, because one entry short makes `loungerX +
undefined` a NaN, and a NaN `up` is one no clamp recovers from — the squirrel
stops being drawn for the rest of the session with nothing thrown anywhere.
`BANANA_GAP` is that spacing, and `crossArc` measures a hop against it. `SQUIRREL_REACH` is taken from **the tallest tree any
of them can climb**, not from the park's — measured off the park alone it was correct only because the
bananas happen to be shorter, and raising `BANANA_TRUNK` would have sent them
climbing over the user's own list with nothing failing. It stays below
`SCENE_REACH`, so the reserved band still cannot grow because of them, and a
test pins that rather than a comment. Where a tree stands and
how tall it is are read one at a time (`treeX`/`treeTop`), not by building the
whole list: every squirrel asks several times a frame, and rebuilding it there
threw away a hundred-odd objects a frame for as long as the app was open.
Nothing else in the scene reads them, and they read nothing else — _except_ the
one `rng` stream `step` draws from for the girl, the oven and the bird as well.
Adding a squirrel changes how many numbers are drawn per frame and so re-rolls
every seeded run, which is why the day-split figures below are ranges measured
over several seeds rather than fixed numbers.

**The home end has a lounger under two banana trees**, and she lies on it now
and then (`lounging`, caught on the way past like the school's door). She still
counts as **home** while she is there, so the oven goes on working and a pizza
sails over while she suns herself. `BANANA_HEIGHT` is **derived** from the leaves' own shapes
(`bananaLeaves`, in `scene.ts` so that the reach it decides is part of the scene
rather than of the drawing), and the plants lean through `bananaLean` — also in
`scene.ts`, because a perch depends on it: a lean the scene cannot see is a bird
held at a fixed point while the crown slides out from under him, which is the
very thing `perchX` swaying with a park tree exists to prevent.
Where the bird waits it out is chosen **once, when she lies down**
(`girl.restPerch`, the head of the lounger or a banana tree): decided per frame
it would change under him every frame, and `perched` follows the perch — he
would bounce between the two for the whole afternoon. His own hover cycle is
what makes the third case, flying about above her, happen by itself.

**The left of the scene is capped, not just placed.** `schoolX` is bounded by her walking range and by the pizzaiolo, because two things it did otherwise were invisible until someone opened a phone: at 320px the door sat _past the end of her walk_, so she could never cross it and the entire visit — light, door, tree perch — was dead; and the car, growing rightwards out of the school, was drawn straight through the pizzaiolo at every phone width. On a window with no room for one, `carSchoolX` and `carHomeX` are `null` together, no car is drawn and no drive happens. Order of sacrifice: the park goes first, then the car, and the school always stays on screen because it is the only part anybody interacts with.

The `/list` tab lives in the **query string** (`/list?tab=recurring`), not the path: `BottomNavItem` marks the current screen with an exact `pathname ===` match, so a sub-route would unlight Expenses — and a path change fires the four-request refetch on every tab switch.

Not counted is shown under the amount it came out of, on both layouts: it decides who owes whom, so a stale figure has to be catchable by scanning rather than only by opening the edit form. A standing banner on the `/list` expenses tab reports months waiting, because the
confirmation is a one-shot dialog: a rule that has not created anything yet lives
on the other tab and its expenses do not exist, so without the banner setting one
up looks like nothing happened. `RecurringPrompt` is rendered once in
`AuthenticatedApp` outside `<Routes>`, since what is due does not depend on the screen being viewed. Two things gate it, both load-bearing: `useExpenses` exposes `loadedOnce` so an unloaded (therefore empty) expense list is never mistaken for "no month was ever generated" — which would offer to write every month of every rule — and `useRecurringPending` keys its dismissal on the **set of pending markers** in localStorage, so it cannot nag on every navigation while still asking again when a new month falls due or the rules change. The date is editable too, and **validated rather than bounded**: handing Mantine's `DateInput` a `minDate`/`maxDate` makes it clamp silently, so the field reads the date typed while a different one is written. It must stay inside the occurrence's own month, since the marker names that month — a date outside it would file the expense in one month while the month it left still counted as generated. Unticking a month in the prompt writes **nothing**, not even a marker — and unticks every later month of the same payment. That is not a UI nicety: generation resumes from the last month written, so a hole punched in the middle would never be offered again and a month of real spending would vanish. A trailing run can be left for next time; an interior month cannot be, so it is not offered as a choice. After a write the prompt dismisses **the set it left behind**, passed explicitly — reading the hook's own state there would persist the pre-write set and reopen the modal immediately.

New components take `names: PersonNames` as a prop like every other; `App` remains the only place that reads it off the context.
