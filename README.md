# Specter Finances

A shared expense tracker for two people. It's a client-only PWA that reads and
writes records directly to a Google Sheet — there is no backend or database. The
sheet is the single source of truth, so the data stays portable, inspectable, and
fully owned by you.

## Features

- **Three record types**, each in its own sheet tab:
  - **Expenses** — a purchase, where either partner (or both) can put in an amount.
  - **Transfers** — one partner paying the other to settle the running balance.
  - **Gifts** — one partner giving the other something that does _not_ count as
    settling up: either a **present** that changed hands, or **forgiving** part of
    what the other owes (see [Transfers vs. gifts](#transfers-vs-gifts)).
- **Recurring payments** — a phone bill, a subscription, a gym. Each one is a rule
  that falls due monthly on a day you choose; the app offers the months that are
  due, including any you missed while it was closed, and never adds anything
  without asking (see [Recurring payments](#recurring-payments)).
- **Settlement math** — automatically computes who owes whom from all three record
  types.
- **Sorting and filtering** — order the expense list by date, by the order rows
  were added, or by what each one cost, and narrow it to a single category.
- **A "New" badge** on anything added in the last few days, so a purchase you
  entered today but dated last month is still easy to spot in a list ordered by
  when the money was spent — plus a **Recently added** checkbox that narrows the
  list to just those, for when the badge is buried a few pages down.
- **Dashboard** — charts (via Chart.js) summarizing spending by category and over
  time, with shared date filtering.
- **Installable PWA** — works offline-friendly and installs to the home screen.
- **Theming** — light/dark mode plus customizable animated backgrounds
  (gradient, matrix, squirrel) and adjustable accent color and card opacity.
- **Mobile-first** — responsive tables and a bottom navigation bar.

## Transfers vs. gifts

Transfers and gifts look almost identical — same fields, same form, one amount
from one partner to the other. They differ in a single respect: **what the money
means for the debt between you.** There are three cases, and each does something
different to the balance.

- A **transfer** is _settling up_. A owes B money and pays some of it back, so it
  moves the balance toward zero.
- A **gift → present** is money that changed hands as a present. It sits outside
  the shared pot, so it must not be credited against what A owes — and it leaves
  the balance exactly where it was.
- A **gift → forgiven** is A letting part of what B owes _slide_. No money moves;
  B's debt simply drops by that amount. It is the mirror image of a transfer.

The Balance the app reports is **real money**: what one of you would hand the
other to square up. Every amount you enter moves it by its own face value.

| Action                         | Balance change | Result with A already owing B €100                         |
| ------------------------------ | -------------- | ---------------------------------------------------------- |
| A transfers €50 to B           | `−50`          | A now owes **€50**                                         |
| A gifts B €50 as a **present** | `0`            | A still owes **€100**, and B keeps the €50 on top of it    |
| B **forgives** €50 of A's debt | `−50`          | A now owes **€50** — same as paying, except no money moved |

### Why the internal figure is doubled

Expenses are shared, so **the spending gap is twice the debt**. Spend €1000 to
the other's €500 and the gap is €500, but only **€250** changes hands to square
up — the payer ends on €750 and so does the receiver. Handing over €500 would
leave one of you having covered two-thirds of an evenly split bill.

That is why `calculateBalance` applies transfers and forgiveness at `2×` while
building the gap, then halves the result. The doubling is an internal conversion
between the two units and never reaches the screen:

| €1 of…                            | Closes the gap by | Closes the debt by |
| --------------------------------- | ----------------- | ------------------ |
| shared spending by the one behind | €1                | €0.50              |
| money handed to the other         | €2                | €1                 |

A present and a forgiveness are stored the same way and are told apart by column
E of the `Gifts` tab. Rows written before that column existed come back blank and
read as **forgiven** — the behaviour they already had — so introducing the column
moved nobody's balance. That also means an older present recorded as a transfer
plus a cancelling gift still nets to zero; if you ever tidy one up, flip the gift
row to _present_ **and** delete the paired transfer together, or the balance
shifts by the amount twice over.

Everything else about the two is plumbing: separate sheet tabs, hooks, routes and
list pages, but the same record shape.

## Recurring payments

Some spending repeats: a phone bill on the 10th, a subscription on the 1st, a gym
on the 28th. Rather than typing those in every month, you describe each one once
on the **Recurring** tab of the expenses screen, and the app creates the expense
rows for you.

### It asks first, and it catches up

Recurring payments are **rules**, not expenses. Nothing is written to the sheet
until you confirm it. When something is due you get a list of the months, and you
can correct any amount or untick any row before it is added.

If the app has not been opened for two months, opening it offers those two months
as well as the current one — being away is not the same as not having paid.
Catch-up reaches back at most 24 months, so a rule you set up years ago does not
greet a fresh install with eighty rows.

A month is offered only once its day has arrived. A payment on the 15th proposes
nothing on the 3rd.

### A created expense is a snapshot

**Changing a rule never changes what it has already created.** If a subscription
gets more expensive, the months you already paid keep the price you actually paid;
only future months use the new one. The same goes for renaming a payment or
changing its category. This is the whole point of the design: the sheet is the
only record of who owes whom, and rewriting history would move real money.

The one thing this cannot know is what a payment used to cost. If the price
changed while the app was closed, the missed months are proposed at today's price
— which is exactly why the confirmation list lets you correct each amount before
it is written.

### Deleting, skipping and short months

| You do this                            | What happens                                                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Delete a rule**                      | Nothing further is created from it. Every expense it already created stays — that money was really spent.                                                  |
| **Delete a created expense**           | It is not recreated. The app carries on from the most recent month it created, so a deletion sticks.                                                       |
| **Untick a month** in the confirmation | Nothing is written and nothing is recorded, so it is offered again next time. "Not this month" never becomes "never".                                      |
| **Set the day to the 31st**            | It falls on the last day of shorter months — the 28th, 29th or 30th. The payment does leave the account in February, so it is clamped rather than skipped. |

### Setting it up

Recurring payments live on their own tab, which an existing spreadsheet will not
have. The first time you open the Recurring tab the app offers to create it; that
one action adds the `Recurring` tab and labels column G of the expenses tab, where
each created expense records which payment produced it. **The app never creates
the tab on its own** — nothing is written to your spreadsheet because you opened
the app.

Columns G and H are written by the app. Editing a created expense is fine —
change the amount, the date, anything — but clearing column G makes the app think
that month was never created, and it will offer it again.

Because a caught-up payment is dated the month it belonged to, it would land far
down a list ordered by date. It is marked **New** for a few days after it is
created, so you can see what just appeared.

## Who the app calls you

The two people are `A` and `B` in the code — positional, matching the two amount
columns. Their names are never written in the source: the app reads them from the
expenses tab's **header rows** every time it loads, so whoever points it at their
own spreadsheet sees their own names.

The sub-header (row 2) is checked first, then row 1, because row 1 often merges
both amount columns under a single group label:

```
Row 1:   Date │    Amount    │ Item │ Category │ Notes     ← merged, not a name
Row 2:        │  Ada  │  Bo  │                             ← the two names
Row 3:   ...data starts here
```

Both names have to come from the same row — one real name beside a placeholder
would read as though the sheet were half-configured — otherwise the app shows
"Partner A" / "Partner B".

Renaming yourself is therefore a sheet edit, not a code change.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) with [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [Mantine v8](https://mantine.dev/) components + [Tabler icons](https://tabler.io/icons)
- [React Router](https://reactrouter.com/)
- [Chart.js](https://www.chartjs.org/) via react-chartjs-2
- Google Sheets REST API + Google Identity Services (GIS) OAuth2
- [Vitest](https://vitest.dev/) for tests

## Getting started

### Prerequisites

- Node.js 20+ and npm
- A Google Cloud project with the **Google Sheets API**, the **Google Drive
  API** and the **Google Picker API** all enabled (Drive is needed for the
  per-file grant, even though this app never calls it directly)
- An **OAuth 2.0 Client ID** (Web application) — add your dev origin
  (e.g. `http://localhost:5173`) to the authorized JavaScript origins
- An **API key** in the same project — the picker requires one
- A Google Sheet to use as the datastore (see [Sheet layout](#sheet-layout))

### Setup

```bash
npm install
```

Create a `.env` file in the project root (it is not committed):

```bash
VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-google-api-key   # required by the spreadsheet picker
VITE_SPREADSHEET_ID=your-google-sheet-id  # optional hint on the picker screen
VITE_SHEET_NAME=Sheet1                    # the expenses tab; defaults to "Sheet1"
```

The signed-in Google account must have edit access to the spreadsheet.

### OAuth publishing status

Leave the consent screen's publishing status at **Testing** and every sign-in
shows a "Google hasn't verified this app" warning, and only accounts added as
test users can authorise at all. Switch it to **In production** to remove both.

No verification review is needed for this app: `drive.file` is a non-sensitive
scope, and verification applies only to sensitive or restricted ones. (This was
not true of the old `spreadsheets` scope, which is sensitive — narrowing the
scope is what made publishing free.)

### Choosing the spreadsheet

On first sign-in the app asks you to pick your spreadsheet. This is not a
formality: the OAuth scope is `drive.file`, which grants access only to files
you explicitly pick, so picking the sheet is what authorises the app to read it.
The alternative — the broad `spreadsheets` scope — would hand the app read and
write access to **every** spreadsheet in the account, which is far more than it
needs. The grant persists, so you pick once per browser; if the sheet is later
unshared or access revoked, the app returns to the picker rather than failing
every request.

The picker also needs your Cloud **project number**, which is what associates
your selection with this app — without it the picker returns a file id but no
grant is created, and every Sheets call fails with "Requested entity was not
found". You don't configure it: it is the numeric prefix of
`VITE_GOOGLE_CLIENT_ID`, so it is derived from the client id and cannot drift
out of sync.

### Run

```bash
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check and produce a production build in dist/
npm run preview  # preview the production build locally
```

## Sheet layout

The app expects up to four tabs in the spreadsheet. `rowIndex` everywhere refers to
the 1-based sheet row number.

- **Expenses** (the `VITE_SHEET_NAME` tab, range `A3:G`) — row 1 is a header, row 2
  a sub-header, and data starts at row 3:

  | Date | Amount (partner A) | Amount (partner B) | Item | Category | Notes | Recurring | Added |
  | ---- | ------------------ | ------------------ | ---- | -------- | ----- | --------- | ----- |

  The two amount headers are also where the app reads the partners' display names
  from (see [Who the app calls you](#who-the-app-calls-you)).

  The last two columns are written by the app, never by you:

  - **Recurring** records which recurring payment and which month produced the
    row, as `rec:<id>:YYYY-MM`, and is blank on everything you enter yourself
    (see [Recurring payments](#recurring-payments)).
  - **Added** is the date the row was typed, as opposed to **Date**, which is
    when the money was spent. The two differ whenever you enter something late,
    and the list is ordered by **Date** — so this is what lets a purchase you
    added today but dated last month still be marked **New**. Editing a row
    never changes it.

  Rows from before these columns existed simply have nothing in them, which reads
  as "not known" rather than "old" — no badge, no recurring payment.

- **Transfers** (`Transfers` tab, range `A2:D`) — one header row, data from row 2:

  | Date | Amount (partner A) | Amount (partner B) | Notes |
  | ---- | ------------------ | ------------------ | ----- |

- **Gifts** (`Gifts` tab, range `A2:E`) — the same, plus a kind column:

  | Date | Amount (partner A) | Amount (partner B) | Notes | Kind |
  | ---- | ------------------ | ------------------ | ----- | ---- |

  `Kind` is `present` or `forgiven`; anything else, blank included, reads as
  `forgiven` (see [Transfers vs. gifts](#transfers-vs-gifts)).

- **Recurring** (`Recurring` tab, range `A2:H`) — one header row, data from row 2.
  Created by the app when you set the feature up, so an existing spreadsheet will
  not have it until then:

  | Start | Amount (partner A) | Amount (partner B) | Item | Category | Notes | Day | Id  |
  | ----- | ------------------ | ------------------ | ---- | -------- | ----- | --- | --- |

  Columns B–F are deliberately the same five as the expenses tab, so a created
  expense is a straight copy with a date in front and a marker behind.

  `Start` is the earliest date anything is created for. `Day` is the day of the
  month it falls on, clamped to the last day in shorter ones; leave it blank and
  the start date's own day is used. `Id` is how a created expense is traced back
  to its rule — it is last so the familiar columns stay where you expect them, and
  it lives in the cell rather than being the row number, because deleting any row
  renumbers everything below it. A rule you add by hand with no `Id` is listed but
  nothing is created from it until you give it one, which the app offers to do.

For transfers and gifts, the form captures a single payer + amount, but the value
is stored in one of two amount columns; the empty column encodes the direction.

Dates may be stored as Google Sheets serial numbers or as text in various formats
(`DD/MM/YYYY`, `DD.MM.YY`, etc.) — all normalization lives in
`src/services/parsing.ts`. Amounts are stored/displayed with a `€` prefix.

Categories are a fixed set: `Car`, `Food`, `Health`, `Holidays`, `Home`, `Various`.

## Project structure

```
src/
  components/        UI components (forms, lists, dashboard, theme controls)
  hooks/             per-domain data hooks + the shared ExpensesContext
  services/          Sheets CRUD, auth, parsing, settlement math (utils.ts),
                     and the recurring due-date rules (recurring.ts)
  theme/             theming context and animated backgrounds
  types/             Expense / Transfer / Gift / Recurring type definitions
```

Data flows in one direction:

```
Google Sheet ↔ services/sheets.ts ↔ useExpenses/useTransfers/useGifts/useRecurring
            ↔ ExpensesContext ↔ UI components
```

The settlement logic lives in `calculateBalance` in `src/services/utils.ts`. It
reduces to one expression — see [Transfers vs. gifts](#transfers-vs-gifts) for
what the signs mean:

```
gapA    = (totalA − totalB)
        + 2 × (transferA − transferB)   // transfers close the gap
        − 2 × (forgivenA − forgivenB)   // forgiveness does the opposite
                                        // presents do not appear at all

owedToA = gapA / 2                      // the gap is twice the debt
```

A negative `owedToA` means A owes B. Changing these signs, coefficients or the
halving changes who owes whom and by how much, so treat that function as
load-bearing.

## Development

```bash
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm run test          # Vitest, one-shot
npm run test:watch    # Vitest, watch mode
```

Tests cover the services (`parsing`, `utils`, `sheets`, `recurring`, `auth`), the
hook that decides when to offer a recurring payment, and the list, form and page
components. Run a single file with
`npx vitest run src/services/parsing.test.ts`.

Service tests run in Node; anything touching the DOM opts into jsdom with a
`// @vitest-environment jsdom` docblock on the first line, so the fast suite stays
fast.

A [Husky](https://typicode.github.io/husky/) pre-commit hook formats staged files
with Prettier (via lint-staged) and blocks the commit unless lint, build, and tests
all pass. The hook is installed automatically on `npm install` via the `prepare`
script.

## Deployment

The app deploys to GitHub Pages via `.github/workflows/deploy.yml`. `VITE_*`
values are **inlined at build time**, so every one the app needs must exist as a
repository secret (Settings → Secrets and variables → Actions):

- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_API_KEY` — without it the deployed app reaches the picker screen
  and reports the key as missing
- `VITE_SPREADSHEET_ID` (optional, picker hint)
- `VITE_SHEET_NAME`

The API key's HTTP referrer restrictions must also include the deployed origin,
and it has to be **origin-wide** — `https://<user>.github.io/*`, not
`https://<user>.github.io/specter-finances/*`. Browsers send only the origin on
cross-origin requests under the default `strict-origin-when-cross-origin`
referrer policy, so a path-scoped pattern never matches and the picker reports
"The API developer key is invalid" in production while working on localhost.

Origin-wide means any page on that github.io account could use the key. That is
bounded by restricting the key to the Google Picker API, which grants no data
access and is not billable. When the `GITHUB_ACTIONS` environment variable is
set, `vite.config.ts` sets the base path to `/specter-finances/`. Build with
`npm run build` and publish the `dist/` directory.
