# Working agreements for this repo

This file is read in full every session — keep entries as single crisp
bullets/paragraphs. Incident backstory, "how we found this" narrative, and
anything not needed to act correctly belongs in commit messages, not here.
Add something here only if it must survive independent of any one session
or machine (a standing rule, or a fact about the code/game that would
otherwise be silently rediscovered); anything else — incident detail,
in-progress state, evolving context — belongs in the commit message or
elsewhere, not in this file.

## Model and effort routing

Before starting any task, state which tier it falls in and why, as a single
line at the top of the reply — `[Sonnet]`, `[Opus/medium]` or `[Opus/high]`.
Do this before doing the work, so the tier can be changed first. Say it plainly
even when the tier is lower than the model currently running.

| Tier | Use for |
| --- | --- |
| Sonnet 5 | Applying a fix that has already been specified; renames and mechanical edits; reading code to answer a question; running `tests/`. |
| Opus, medium | A new feature that follows an existing module's pattern; edits spanning several functions; reviewing a diff. |
| Opus, high | Live-behaviour bugs whose cause is not visible in one file; timing and interaction logic such as the VIJE rest-sync; conflicts when merging `upstream`. |

Default to Opus/medium when a task sits between two tiers. Reach for
Opus/high only when the reasoning itself is the hard part — not when the
edit is merely large.

If a task turns out to be harder than its announced tier, say so and stop
rather than pushing through on too little effort; a wrong cause confidently
stated costs more than the re-run.

For Opus/high-tier work — where the reasoning/design is the hard part, not
just the size of the edit — enter plan mode and get the approach approved
before writing code. Skip this for Sonnet-tier and routine Opus/medium work;
it's for the cases where a wrong design assumption would cost a real rework.

## Git

Commit locally. Never push — offer the push command instead.

## Diagnosis discipline

A screenshot shows rendering, never which CSS rule won. Before theorising
about why something looks wrong, check the loaded source directly or use
Inspect → Styles (names the winner). After any CSS/UI change ships, reload
and look before diagnosing anything.

## Test discipline

A passing assertion is not evidence until it has been seen to fail.
Mutation-test new assertions as you write them: deliberately break the
source and confirm red before trusting green.

## Patch-script hygiene on this machine

- The repo is `core.autocrlf=true`: after any `git checkout`, working files
  come back CRLF. Normalise to LF on read, patch, convert back to CRLF on
  write — a multi-line match string built against LF silently finds nothing
  in a CRLF file.
- Do not build JS regex patches through a bash heredoc or Python string
  literal typed casually — backslashes do not survive intact (`\` has
  collapsed to a literal backspace byte before). Build backslashes as
  `chr(92)` in patch scripts, or just use the Write tool directly and splice
  by line number/exact marker instead of a generated patch script.

## Project facts

- **The whole script is one IIFE; exactly 49 names land on `window`.**
  `verifyInlineHandlers()` checks the built interface at startup and names
  any inline handler calling something missing, so a wrong export list is
  loud, not silent. Never put example syntax (e.g. `ANY(barracks 5)`) inside
  an `on*=` attribute — it gets scanned as a real call.
- **No Node on this machine.** Verify changes by slicing the relevant
  function out of `scripts/SZEM4.js` and running it via `new Function(...)`
  in the browser tool, or serve the repo and open `tests/` (`tests/run.cmd`).
  A green run is required before committing; add a case in the same commit
  as the behaviour it covers.
- **`scripts/SZEM4.js` is ~4,400 lines.** By default, grep/search for the
  function or marker first and read narrow line ranges — don't read the
  whole file start-to-end. This default doesn't apply when the task itself
  is a full review or asks to read the whole file; follow the explicit ask.
- **Reuse `tests/` and `tests/preview.html` rather than building a new
  scratch harness.** They already run the real code (sliced from source,
  not a replica) and mirror the real markup; a fresh one-off harness repeats
  work that already exists and can drift from what's real.
- **Never guess game markup.** Ask for a saved page (Ctrl+S, "Web Page, HTML
  only") or a pasted element before writing a selector against it.
- **Numbers on-page use `.` as a thousands separator.** Strip it before
  `parseInt`/`parseFloat` or a value over 999 silently truncates.
- **The `banya` (mine) cell's comma-separated text is a data contract, not
  decoration** — `getProdHour()` splits it to drive every farm/loot decision.
  Any UI change there must keep the raw commas as real characters.
- **The anti-bot module is a fail-safe alarm, not evasion**: it detects the
  game's own CAPTCHA, halts every module, and waits for a human to solve it
  before resuming.
- **The farm/attack send path spends real troops; the auto-finish module
  spends real premium points.** Anything touching either gets flagged and
  live-tested before being trusted.
