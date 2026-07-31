---
name: complete-review
description: Whole-codebase quality and security audit — duplication, code smells, security problems, lint/format drift, typing weaknesses, accessibility, and test gaps. Reports findings, never edits code. Use when the user asks for a full review, a codebase audit, a health check, or wants to know what needs cleaning up across the whole project (as opposed to /code-review and /simplify, which only look at the working diff).
---

# Complete review

A full-codebase audit. Unlike `/code-review` and `/simplify`, which are scoped to
the working diff, this examines **every source file in the repository** and
reports what it finds.

**This skill is report-only. Do not edit, fix, or format any source file, and do
not run any command that writes to the tree (`prettier --write`, `eslint --fix`,
codemods).** The user reviews the report and decides what to act on. If they ask
for fixes afterward, that is a separate follow-up.

The failure mode to avoid is a flood of low-value nits. A 40-item list of style
preferences is worse than 6 findings the user actually acts on. Every finding
must name a concrete cost.

## Phase 0 — Mechanical baseline (do this first, yourself)

Tools are ground truth and produce no false positives, so run them before
spending any agent time. In this repo:

```bash
npm run lint             # eslint
npm run format:check     # prettier, check only — never `npm run format`
npx tsc --noEmit         # type errors the build might not surface alone
npm run test             # vitest, one-shot
```

Then gather scope so the agents get concrete targets, not vague instructions:

```bash
git ls-files 'src/**' | xargs wc -l | sort -rn   # inventory + biggest files
git ls-files | wc -l
```

Record: every tool failure verbatim, the file inventory, the largest files, and
which files have test coverage. If a tool is missing or a script does not exist,
note it and move on — do not install anything.

Read `CLAUDE.md` and `README.md` if present. Documented conventions are part of
the review standard: code that contradicts them is a finding, and so is
documentation that contradicts the code.

## Phase 1 — Review agents (parallel, one message)

Launch the agents below via the Agent tool **in a single message** so they run
concurrently. Give each one: the file inventory from Phase 0, the relevant
tool output, the project conventions from `CLAUDE.md`, and its angle.

Scale to the codebase. Under ~50 source files, each agent takes the whole tree.
Above that, shard by directory and give each agent a slice, keeping the total
under ~12 agents; say in the report which slices were covered.

Every agent is told: **read the actual files, verify each claim before
reporting it, cite `file:line`, and return nothing rather than padding.**

### 1. Duplication and reuse

Near-identical logic implemented more than once; parallel type definitions;
components that could share a primitive; copy-pasted blocks with small
variations. Name both sites and the extraction that would unify them. Two
similar-looking things that are genuinely independent are not duplication —
say so instead of forcing a shared abstraction.

### 2. Code smells and complexity

Oversized files and functions, deep nesting, tangled conditionals, dead code,
unused exports, stale TODOs, unclear naming, primitive obsession, state that
could be derived. Rank by how likely the code is to be edited again — a gnarly
function nobody touches matters less than a confusing one in a hot path.

### 3. Security and data handling

Whole-codebase security sweep: credential and token handling (storage,
lifetime, exposure), auth flows, anything reaching the DOM unsafely
(`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`), URL and
redirect construction, third-party script loading, data sent to external
services, secrets committed to the repo or leaked into logs, permissive
CORS/CSP or missing integrity checks.

Skip: DOS and resource exhaustion, rate limiting, outdated-dependency CVEs
(handled separately), missing hardening measures with no concrete attack path,
and XSS claims in React/TSX that do not involve an unsafe sink. Client-side
code cannot be trusted to enforce authorization — its absence there is not a
finding. Report only what has a real exploit path, and state that path.

### 4. Types

`any`, `unknown` escapes, unsafe casts and `as` chains, non-null assertions,
implicit `any` in callbacks, missing discriminated unions where a union of
shapes is being hand-checked, types that permit states the domain forbids,
and `@ts-expect-error`/`@ts-ignore` suppressions. Prefer findings where a
better type would have caught a real class of mistake.

### 5. Conventions, consistency and accessibility

Divergence from the project's own established patterns (check how the majority
of files do it before calling something wrong), inconsistent error handling,
inconsistent formatting that Prettier does not cover, and — for UI code —
accessibility: keyboard operability, semantic elements over click handlers on
divs, labels and ARIA on interactive controls, focus management, and text
contrast. **This project requires all text to pass WCAG AA; dimmed or muted
text colors are a finding.**

### 6. Tests

Which behavior is untested and would break silently. Weight by blast radius:
domain and money math, parsing and normalization, and anything the project
documents as load-bearing come first. Flag tests that assert implementation
detail rather than behavior, and tests that cannot fail. Do not ask for
coverage of trivial glue.

## Phase 2 — Verify before reporting

Whole-codebase sweeps generate false positives; a wrong finding costs the user
more than a missed one. For every candidate finding rated high severity, and
for any finding whose claim depends on code the agent did not read end to end,
spawn a verifier (parallel, in one message) that tries to **refute** it: read
the cited lines and the surrounding context, and decide whether the problem is
real. Default to refuted when uncertain. Drop anything refuted.

Then dedup: several agents will report the same underlying cause from different
angles. Merge those into one finding naming the root cause, not five symptoms.

## Phase 3 — Report

Write the full report to a file in the scratchpad directory and give the user
the path, then summarize inline — lead with the summary, not the file path.

Structure it as:

1. **Baseline** — lint, format, typecheck, and test results. State plainly
   whether each passed; quote failures.
2. **Findings by severity** — High / Medium / Low. Each finding gets:
   `file:line`, one-sentence claim, the concrete cost (what breaks, what is
   harder to change, what an attacker gets), and the fix in a sentence or two.
   Order within a tier by cost, not by category.
3. **Coverage** — what was reviewed, what was sharded or skipped, and any
   limits (unreadable files, tools that would not run). Never let a bounded
   sweep read as exhaustive.
4. **What's healthy** — briefly, the things that were checked and are genuinely
   fine. This is what makes the rest of the report trustworthy.

Close by offering to fix a specific subset. Do not start fixing unprompted.

Severity means:

- **High** — exploitable security issue, data loss or corruption, or a bug
  class the types/tests will not catch.
- **Medium** — real maintenance cost or a latent correctness trap.
- **Low** — worth knowing, cheap to fix, no urgency.

If a category is clean, say so in one line. Do not manufacture findings to fill
a section.
