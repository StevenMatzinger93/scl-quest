# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"SCL Quest 3: Aufstand der Maschinen" — a single-file, offline-playable German-language browser game that teaches Siemens SCL (Structured Control Language, used for programming Siemens S7 PLCs). The player writes real SCL code in an in-browser editor to fix/control a simulated robotic work cell (gripper, conveyor, sensors, light stack, sorting gate); the code is parsed and executed by a hand-written SCL interpreter, and a 2D SVG (or optional 3D three.js) scene animates live based on the resulting variable state.

The entire game — markup, styles, interpreter, level data, and controller — lives in **`index.html`** (~5500 lines). There is no build step, package manager, or test framework: it's a static file meant to be opened directly in a browser or hosted as-is.

## Running / developing

- Open `index.html` directly in a browser (or serve the directory with any static file server) — no build, no dependencies to install.
- External dependencies are loaded via CDN `<link>`/`<script>` tags only: Google Fonts, Font Awesome, and `three.js r128` (only needed for the optional 3D view). Everything else is inline.
- There is no linter, formatter, bundler, or automated test suite in this repo. Verify changes by loading the page in a browser and playing through the relevant level(s).
- Game progress persists to `localStorage` under key `sclquest3_state_v1`. Use the in-game "reset" button (or clear that localStorage key) to start fresh while testing. Header buttons also support exporting/importing the save as JSON.

## High-level architecture

`index.html` is organized as one `<style>` block followed by **~10 sequential `<script>` blocks**, each an IIFE that attaches its exports to `window`. Later blocks depend on globals set by earlier ones — read/edit them in order. Use line numbers below as a map (search for the `====` comment banners to relocate after edits shift line numbers):

1. **SCL interpreter/engine** (`window.SCLEngine`) — a hand-rolled tokenizer → recursive-descent parser → tree-walking evaluator for a subset of SCL: `:=` assignment, `IF/ELSIF/ELSE`, `CASE/OF`, `FOR/TO/DO`, `WHILE/DO`, `EXIT`, array indexing, boolean/arithmetic operators, `%I/%Q/%M` address literals, `T#..S`/`T#..MS` time literals, and function blocks (`TON`, `TOF`, `TP`, `R_TRIG`, `F_TRIG`) invoked as `Instance(Param := Value, ...)` calls plus `.Output`/`.Q` reads. Exposes `compileSCL`, `evalExpr`, `executeOnce` (single-pass), `executeTimed` (multi-step, for timer-based tasks), and `runSinglePassTests`/`runTimedTests` (used for grading submissions against a task's `testCases`/`timedTestCases`).
2. **`SceneEngine`** (`window.SceneEngine`) — the 2D SVG "live system" view. One master SVG for the whole game; `applyFrame`/`playTimeline` drive per-channel visual state (gripper open/closed, arm angle, belt running, sensor active, light stack colors, sort gate position, fault indicator, HMI display value, etc.) from the interpreter's output.
3. **`Scene3D`** (`window.Scene3D`) — optional three.js-based 3D counterpart to the SVG stage, built lazily on first toggle to 3D. Mirrors the same channel updates (`setChannel`) as the 2D scene so both views stay in sync; degrades gracefully if `THREE` fails to load.
4. **Level task data**, one script block per level: `window.TASKS_L1` … `window.TASKS_L5` (5 curated tasks each, drawn from a larger "Quest 2" task pool), then `window.TASK_FINAL_BOSS` (a single larger combined task — full step-chain cycle control with a `FOR` loop, `R_TRIG`, two `TON` timers, and an emergency-stop `CASE` state machine). Each task object has the same shape: `id`, `level`, `title`, `story`/`briefing` (flavor + instructions), `isDebug`/`isBoss` flags, `starterCode`, `initialVars`, `fbTypes` (function-block instance declarations), `testCases` or `timedTestCases`, `refSolution`/`refLines` (for the "Clean Coder" badge and hints), `manualRef`, `hint`, and `sceneBindings` (maps SCL variable names to scene channel names for live animation).
5. **`MANUAL_CONTENT`** — the in-game SCL reference manual (tabs/sections shown in the "Handbuch" modal).
6. **`LEVEL_INTROS`** — per-level and final-boss narrative intro overlay content.
7. **`SCLEditor`** (`window.SCLEditor`) — a minimal syntax highlighter + editor "attach" helper (line numbers, keyword highlighting) wired to the `<textarea>` code editor.
8. **`APP.JS` (the game controller)** — the last script block; ties everything together:
   - Concatenates `TASKS_L1..L5` into `ALL_TASKS` (50 tasks) plus `FINAL_BOSS` as level 6.
   - Owns `gameState` (current task index, completed tasks, badges, failed-attempt counts, seen intros, saved solutions, cert name) persisted to `localStorage`.
   - Compile/validation pipeline: takes the editor's code, calls `ENGINE.compileSCL` + `runSinglePassTests`/`runTimedTests` against the current task's test cases, then re-runs the code through `executeOnce`/`executeTimed` to drive the live scene animation (not canned clips — the animation reflects actual interpreter execution).
   - Badge logic (`BADGE_CATALOG`): `first_try`, `sherlock` (fast debug fix), `clean_coder` (concise solution), `buecherwurm` (consulted manual before failing).
   - Manual modal, progress map modal, level-intro overlays, savegame import/export, and the printable completion certificate.

### Key invariant when editing tasks/levels

Everything hinges on each task object's `initialVars`/`fbTypes` matching the variables/function blocks its `refSolution` and `testCases`/`timedTestCases` use, and `sceneBindings` mapping only to channel names the scene engines (`SceneEngine`/`Scene3D`) actually understand (see `DEFAULTS`/`MON_META`/`PULSE_TARGET` tables and the `state` object in the 3D block for the full channel list). Breaking this mapping causes silent animation glitches rather than errors, since scene binding failures are not validated at parse time — spot-check visually after changes.

### Language note

All in-game text (story, briefings, hints, manual, UI labels) is German. Keep additions consistent with the existing tone/voice (a slightly antagonistic AI, "ARIA", sabotaging a training work-cell) and terminology.
