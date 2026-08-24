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
- `theme/*Background.tsx` and `theme/cello/draw.ts` — canvas drawing, which has
  no assertable output. **A scene's behaviour does not belong in there**: Cello
  keeps its state machine in `theme/cello/scene.ts`, pure and taking its
  randomness as a parameter, and its wiring in `CelloBackground.tsx` — both
  covered, the latter behind a stubbed `getContext` and a mocked `draw`. The
  squirrel predates that split and holds every entity in a `useEffect` closure
  where nothing can be asserted; copy Cello's shape for the next scene, not the
  squirrel's.
- `ExpenseFields.tsx`, `useTransfers.ts`, `useGifts.ts` — no logic of their own;
  exercised through `ExpenseForm`/`RecurringForm` and `useMovements` tests, plus
  a wiring test proving each wrapper drives its own tab.

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
   a wrong row index, which on this app is real money moved silently.
   **Claude cannot launch this one** — it is user-triggered and billed. Ask for
   it explicitly, say the branch is ready for it, and wait; do not quietly treat
   the step as done because it could not be run.
3. **`/security-review`** — the token lives in localStorage and the OAuth scope
   grants access to a real person's Drive file, so anything touching auth,
   `sheetAccess`, or what gets written to the sheet needs a look.

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

A background that draws _over_ the app rather than behind it (canvas at z-index 101, not −1) declares a `floor` — how tall a band it stands in — and the layout obeys: `BackgroundFloor` masks everything above the band, `BackgroundSpacer` reserves the matching scroll room inside `AppShell.Main`, and `ThemeContext` leaves the header and footer out of the card-transparency tint so the scene does not show through the chrome it stands on. `App.tsx` names no theme and does not read the theme context at all; asking the registry is the whole point, and `FOOTER_HEIGHT` in `theme/chrome.ts` is the single source for the height the AppShell footer and the floor both depend on.

**What a background may paint on is granted by the system, not chosen by the theme.** `BackgroundEffect` wraps whichever background is showing in `SceneClip`, which takes the footer's band away from the ones that draw over the app. It has to: a scene's canvas is fixed across the whole viewport, so the navigation bar is underneath it, and Cello's opaque ground painted straight over all five buttons — an app that could not be navigated, with no error to notice. A new scene cannot opt out, because a new scene does not render the clip; the registry does, and `backgrounds.test.tsx` drives that assertion off `BACKGROUNDS` so a background added later is covered the day it is added. Two details are load-bearing: it is `clip-path`, not `overflow: hidden`, because a `position: fixed` canvas escapes an ancestor's overflow; and the clip **must** carry `SCENE_Z` itself, because clipping makes it a stacking context and a canvas's own z-index is then resolved inside it and never reaches the page — leaving that off sinks the whole scene behind the app. The scenes still set a z-index of their own; inside the clip it is inert. And it wraps **only** the backgrounds that draw over the app: that stacking context is a one-way door, so the gradient and matrix at `z-index: -1` get hoisted in front of the whole app by it — wrapping them "for uniformity" left the gradient covering every row, chart and form with only the nav bar showing. `backgrounds.test.tsx` pins both directions against `drawsOverTheApp`.

The `floor` belongs to the scene, and Cello's is **derived, not chosen**: `SCENE_REACH` is the taller of its chimney cap and its bird at the top of his hover, and `CELLO_FLOOR` adds the ground clearance. Anything above the floor is painted over the user's own list, so a hand-picked number goes stale the moment the scenery grows — but what is _thrown_ is deliberately outside it. A pizza sailing up over the app, like the squirrel's falling acorns, is the point.

Cello's left is a park, a school and a light beige Fiat 500 parked outside it, mirroring the oven on the right. One thing there moves on its own: she lets herself into the school now and then, the window lights while she is inside, and the bird — having no shoulder to sit on — waits in the nearest tree. That last part is **a substituted target, not a new phase**: `perchX`/`perchY` return her shoulder or the treetop, and `perched`, `escorting` and even a dive for a passing pizza go on working without knowing she is gone. Two things follow from `perched` holding him _at_ his perch by setting his position every frame, and both were jerks worth naming: he must fly the last of the way down (`landing`) rather than entering `perched` from a hover and covering the whole hover height in one frame, and when the perch itself becomes a different perch — she goes in, she comes out — he notices for himself: `bird.perchedOn` remembers which perch he took, and `perched` puts him back in the air when it no longer matches `currentPerch`. **Identity, not distance, and not the caller's memory**: keying it on the two girl transitions that cause it today would leave the next cause to reintroduce the jump, while a geometry check would make `perched` doubt its own invariant and break every deliberate placement. The lit window and the swinging door are **derived from her phase** rather than stored, so a lit window with nobody in it is not a state the scene can reach, and `treeSway` is pure so the wind is something a test can hold. The chimney stands on the right-hand slope with its foot **cut to the pitch** — drawn square it had one corner buried in the roof and the other hanging over air — and smokes only while she is in there, through the same puff machinery the oven uses. Her silhouette at the window is gated on the same `schoolLit`, so the light, the smoke and the shadow cannot disagree about whether anybody is home. Sizes live in `scene.ts` beside `SCENE_REACH`, which counts the chimney rather than the ridge (it stands part way down a slope, so it is the taller) and is otherwise derived from one list of **perch heights** (`PERCH_HEIGHT`) plus how far above one he gets — the same list `perchY` places him with, so a perch added there cannot be forgotten here. He sits _in_ the crown rather than on top of it, which is both what a bird does and the difference between reserving 198px of the user's list and 171px: the band is measured from wherever he settles highest, so where he sits in a tree, not the park itself, is what costs screen. It grew 158px → 171px.

**The left of the scene is capped, not just placed.** `schoolX` is bounded by her walking range and by the pizzaiolo, because two things it did otherwise were invisible until someone opened a phone: at 320px the door sat _past the end of her walk_, so she could never cross it and the entire visit — light, door, tree perch — was dead; and the car, growing rightwards out of the school, was drawn straight through the pizzaiolo at every phone width. On a window with no room for one, `carX` is `null` and no car is drawn. Order of sacrifice: the park goes first, then the car, and the school always stays on screen because it is the only part anybody interacts with.

The `/list` tab lives in the **query string** (`/list?tab=recurring`), not the path: `BottomNavItem` marks the current screen with an exact `pathname ===` match, so a sub-route would unlight Expenses — and a path change fires the four-request refetch on every tab switch.

Not counted is shown under the amount it came out of, on both layouts: it decides who owes whom, so a stale figure has to be catchable by scanning rather than only by opening the edit form. A standing banner on the `/list` expenses tab reports months waiting, because the
confirmation is a one-shot dialog: a rule that has not created anything yet lives
on the other tab and its expenses do not exist, so without the banner setting one
up looks like nothing happened. `RecurringPrompt` is rendered once in
`AuthenticatedApp` outside `<Routes>`, since what is due does not depend on the screen being viewed. Two things gate it, both load-bearing: `useExpenses` exposes `loadedOnce` so an unloaded (therefore empty) expense list is never mistaken for "no month was ever generated" — which would offer to write every month of every rule — and `useRecurringPending` keys its dismissal on the **set of pending markers** in localStorage, so it cannot nag on every navigation while still asking again when a new month falls due or the rules change. The date is editable too, and **validated rather than bounded**: handing Mantine's `DateInput` a `minDate`/`maxDate` makes it clamp silently, so the field reads the date typed while a different one is written. It must stay inside the occurrence's own month, since the marker names that month — a date outside it would file the expense in one month while the month it left still counted as generated. Unticking a month in the prompt writes **nothing**, not even a marker — and unticks every later month of the same payment. That is not a UI nicety: generation resumes from the last month written, so a hole punched in the middle would never be offered again and a month of real spending would vanish. A trailing run can be left for next time; an interior month cannot be, so it is not offered as a choice. After a write the prompt dismisses **the set it left behind**, passed explicitly — reading the hook's own state there would persist the pre-write set and reopen the modal immediately.

New components take `names: PersonNames` as a prop like every other; `App` remains the only place that reads it off the context.
