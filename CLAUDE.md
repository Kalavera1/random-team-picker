# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page vanilla HTML/CSS/JS app ("Random Team Picker") that
randomly splits a list of player names into teams, with a tile-based
lobby-style UI (drag & drop, inline rename, animated deal effect). No
framework, no build step, no dependencies, no `package.json`. Deployed as a
GitHub Page.

## Commands

There is no build, lint, or test tooling in this repo — it's three static
files (`index.html`, `style.css`, `script.js`).

- **Run locally**: `python3 -m http.server 8000`, then open `http://localhost:8000`.
- **Check JS for syntax errors** (closest thing to a test here): `node --check script.js`.
- **Deploy**: push to `main` — `.github/workflows/pages.yml` automatically builds
  and deploys the repo root to GitHub Pages via `actions/upload-pages-artifact`.
  There is no separate build output; the working tree is deployed as-is.

## Architecture

Everything lives in `script.js`; `index.html` is just the static shell/ids and
`style.css` the (Warhammer Card Creator-derived) dark steel/gold/coral theme.

**Single source of truth**: the `players` array (`{ id, name, teamIndex }`,
`teamIndex === -1` meaning "in the pool, unassigned"). There is no separate
render-from-state step — instead, each player's tile DOM element is created
once via `createTileElement()` and cached in the `tileEls` Map keyed by
player id. That same DOM node is then *moved* (via `appendChild`) between the
pool container and team-column containers for the rest of its life — it's
never destroyed and recreated. This matters because:
- Drag & drop, pointer capture, and inline-edit listeners stay attached
  regardless of which container currently holds the tile.
- The deal animation (see below) is a real FLIP transform on the actual
  tile, not a synthetic copy.

**Draw flow** (`startDraw()`):
1. Snapshot every tile's current `getBoundingClientRect()` ("first" rect for FLIP).
2. Shuffle player ids with a seeded PRNG (`mulberry32(hashSeed(seed))`) — if
   the seed field is empty, an auto seed is generated per draw so results
   are fresh; a manually entered seed makes the draw reproducible.
3. Partition the shuffled ids into team chunks via one of two interchangeable
   strategies (`assignTeamsEven` / `assignTeamsFill`), selected by the
   "Gleichverteilt"/"Füllen" segmented switch. Both use the same
   `teamCountFor()` formula (`ceil(players / teamSize)`), so switching modes
   never changes the number of teams — only how members are packed into them.
4. Team columns are torn down and rebuilt fresh (`buildTeamColumns`), then
   each tile is reparented into its new column and FLIP-animated from its
   first rect to its new position (`flipTileTo`), staggered in round-robin
   deal order (`buildDealOrder`) for the "dealing cards around the table"
   effect.

**Drag & drop** is hand-rolled with Pointer Events (not the HTML5 DnD API),
so it works uniformly for mouse and touch. A dragged tile is reparented to
`document.body` with `position: fixed` and tracks the pointer; drop targets
are any element with class `.dropzone` (the pool and every team's tile list
all carry `data-team-index`, with `-1` for the pool).

**Certificate export** (`downloadCertificate`) renders a PNG via `<canvas>`
at click time from the *current* `players` state — meaning it reflects any
manual drag-and-drop edits made after the original draw. Only the
seed/timestamp/mode metadata shown on it come from the original draw
(`lastDrawInfo`), not from re-deriving anything.

**Team name suggestions** are a fixed pool of joke names (`TEAM_NAME_SUGGESTIONS`)
drawn from without replacement (`drawSuggestions`) and refilled once
exhausted — clicking one adds it to `pendingTeamNames`, the same array that
manually-typed custom team names go into.
