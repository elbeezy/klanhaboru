# Working agreements for this repo

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

A screenshot shows rendering, never which CSS rule won, or whether a script
is even the loaded copy. Before theorising about why something looks wrong:
check the loaded source directly, or Inspect → Styles (names the winner,
strikes through the losers). Do not build a causal story from a picture —
this has cost two full sessions on this project already (the amber-header
saga, the `ANY(` tooltip false alarm). After any CSS/UI change ships, ask for
a reload-and-look before diagnosing anything.

## Test discipline

A passing assertion is not evidence until it has been seen to fail.
Mutation-test new assertions as you write them, not as an afterthought —
seven separate vacuous assertions have slipped through on this project (a
guard downstream absorbing the change under test, a mutation that doesn't
touch the logged output, etc.). Deliberately break the source and confirm
red before trusting green.

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
