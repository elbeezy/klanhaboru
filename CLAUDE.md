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

## Git

Commit locally. Never push — offer the push command instead.
