# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"SCL Quest 3: Aufstand der Maschinen" (v5) — an offline-playable, German-language browser game that teaches Siemens SCL (Structured Control Language for S7 PLCs). Players write real SCL code; hand-written engines compile, type-check and execute it against test cases, and a 2D SVG / 3D three.js robot cell animates from the actual execution results.

Content: **15 chapters × 10 tasks = 150 programming tasks** plus **30 theory assignments** (lesson + 5-question check, 80 % to pass). Each chapter runs: Theory A → tasks 1–5 → Theory B → tasks 6–10.
- **Grundstufe** (chapters 1–10, tasks 1–100): statements only, variables are pre-declared. Task 100 = final boss. Afterwards a "Grundstufe" certificate is shown (`S.basicCert`).
- **Profi-Stufe** (chapters 11–15, tasks 101–150): whole blocks in a small project — declarations, FC, FB, multi-instances, STRUCT/UDT, DBs, STRING, OB1/OB100 program structure, programming standard. Task 150 = final boss 2. (The TIA export was removed in all quests, see `docs/ENTSCHEIDUNGEN.md`.)

## Repository layout

- **`index.html`** — the shipped game. Single self-contained file that works fully offline (three.js and Font Awesome are embedded; only the Google web fonts are optional). **Generated — do not hand-edit.**
- **`web/`** — the hosted **SPS Quest portal** (generated): `index.html` (portal: factory hall with five gates incl. the Sensorwerkstatt, ARIA intro, login terminal, Leitstand for teachers, administration, live challenge + beamer view), `scl/index.html` (SCL Quest with account sync and live mode, `window.SPSQ_PORTAL = true`), `data/scl.json` + `data/scl_live.json` (task meta, bug scenarios, reference solutions for the dashboards), `impressum.html`/`datenschutz.html` (templates with `[[…]]` placeholders), `sw.js` (one service worker for portal + game, never caches `/api/`).
- **`worker/`** — Cloudflare Worker (`wrangler.jsonc`: `main`, assets from `web/`, `run_worker_first: ["/api/*"]`, D1 binding `DB`). `index.js` (routing, login/sessions, roles, classes, progress), `challenge.js` (live challenge), `db.js` (migrations — tables are created by the code), `lib.js` (PBKDF2 via WebCrypto, 100 000 iterations = Workers limit). `reports.js` (feedback/bug reports from the 💬 button, table `feedback_reports`),
- **`dev/`** — sources, build and tests:
  - `src/engine.js` — Grundstufe engine (`window.SCLEngine`): flat statement code against task-declared variables.
  - `src/engine_pro.js` — Profi engine (`window.SCLPro`): tokenizer/parser for FUNCTION, FUNCTION_BLOCK, ORGANIZATION_BLOCK, DATA_BLOCK, TYPE; compiler (types, name resolution `#local`/`"global"`, warnings); runtime (FC/FB calls, IN_OUT by reference, TEMP reset per call, STAT per instance); `Session` (OB100 once, then OB1 per scan); test runners (`runUnitTests`, `runProgramTests`, `runProgramTimed`, `runAll`); trace for the observe view; interface table ⇄ source (`readInterface`, `writeInterface`).
  - `src/scene2d.js` / `src/scene3d.js` — SVG / three.js cell. Channels also accept dotted paths (`DB_Zelle.Anzahl`).
  - `src/editor.js` — highlighting textarea editor. `src/app.js` — game controller incl. Profi project editor (tabs, declaration table, observe modal).
  - `src/content/` — `_helpers.js` (`defTask`, `defProTask`, `ProTask`, `defTheory`, `defChapter`), `ch01.js`…`ch15.js`, `theory.js` (ch 1–10), `theory_pro.js` (ch 11–15), `chapters.js`, `manual.js`.
  - `portal/` — portal sources (`body.html`, `portal.css`, `portal.js`, `portal_live.js` — every `portal_*.js` is bundled), legal page templates.
  - `src/content/bugs.js` — Störungsjagd scenarios (`defBug({id, task, title, symptom, bug:[[from,to]] | {Block:[[from,to]]}})`, first occurrence in the reference is replaced; validator: buggy version compiles but fails, ≥ 2 per chapter).
  - `build.js` → `../index.html` and `../web/`. Embeds three.js/Font Awesome from `node_modules` (run `npm install` first); `node build.js --cdn` builds a small CDN version instead. `assets/` holds the app icons. `validate.js` (content validator). `test_engine.js`, `test_pro.js` (≈270 Profi engine tests). `tests/playthrough.js` (all 30 theories + 150 tasks through the UI), `tests/pro_ui.js` (Profi UI smoke: table, observe, no export).

## KOP Quest (kop.html, web/kop/)

- Same game shell (`app.js`) configured through `window.QUEST` (set per quest in `build.js` → `QUESTS`). `KOPMODE` swaps in `KOP.wrapEngine(SCLEngine)`, the network editor and `scene_seilbahn.js`; storage key `kopquest_state_v1`.
- `dev/src/kop.js`: text format `NETWORK Title` + `<path> => <outputs>;` — `AND` series, `OR` parallel, `NOT x` NC contact, `P(x)`/`N(x)` edges, `[a > b]` comparators, boxes `TON(T1, T#3S)`, `CTU(Z, PV:=5, R:=x)`, `CTD(Z, PV:=5, LD:=x)`; outputs `A`, `S A`, `R A`, `NOT A`, `MOVE(a, dst)`, `ADD/SUB/MUL/DIV(a, b, dst)`, `INC(x)`, `DEC(x)`; a rung starting with `=>` has no condition. Translated to SCL with a flow variable `_f<net>_<n>` per element (shown green in the editor during playback).
- Content in `dev/src/content_kop/` with `defKop` (= `defTask` + `lang:'kop'`), `truth()` for all-combination tests; theory questions may carry `kop` (rendered ladder) and `verifyKop {src, vars, tests|steps}`; bugs via `defBug` on the KOP text. Validator: `node validate_kop.js`. Browser run: `node tests/kop_playthrough.js` (`mobile` for 390 px).
- Network order matters for timing: a coil written in a later network is seen one scan later — derive timed expectations by simulation.
- Profi (ch 11–15): `defKopPro` (= `defProTask`, table on) with helpers `kFB/kFC/kOB/kDB/kUDT` + `kDecl({in,out,inout,stat,temp})`. Block source = SCL header/declarations + `BEGIN` + networks + `END_…`; `KOP.wrapPro(SCLPro)` (set as `window.SCLPro` in KOPMODE and in the validator) translates bodies line-preserving. Locals `#x`, globals `"x"`, calls as outputs `=> "FB_X_DB"(In := a, Out => b)` / `#Multi(…)` / FC `Ret_Val => r`. Edges (P/N) only in FBs; box type must match the declared instance type. Translation helpers (TEMP/STAT/IF/BOOL/R_TRIG) are removed from `constructsUsed` unless declared by the block. Tests: `tests/kop_pro_ui.js`.

## FUP Quest (fup.html, web/fup/)

- Same network model and engine wrapping as KOP (`t.lang = 'kop'`, `QUEST.lang = 'fup'` → `FUPMODE`); extra operators `XOR` (precedence AND > XOR > OR) and outputs `SR(Q, R)` (reset dominant) / `RS(Q, R)` (set dominant). `KOP.words()` rewrites error texts into FUP terms (box, assignment, signal).
- Editor: `KOPEditor.attach(editor, {flavor:'fup'})` draws boxes (`drawFup`); palette buttons and variable chips can be dragged onto inputs/outputs (HTML5 DnD), tapping still works. `renderStatic(src, flow, 'fup')` for theory/manual/portal.
- Scene `scene_stellwerk.js` (switch1Right/Moving, switch2Right/Moving, signalEntry/Exit, crossingClosed/Lights/Bell, trainRunning/Approach, trackA/B/C, routeSet/Locked, lamps, displays); bindings may map values (`{channel:'trackB', variable:'Gleis1_frei', map:{'true':false,'false':true}}`).
- Content `dev/src/content_fup/` (`defFup`, `defFupPro` = aliases of the KOP helpers). Single-letter names P, N, S, R are keywords — never use them as variables. FB unit-test inputs persist between steps. Validator `node validate_kop.js fup`; browser `node tests/kop_playthrough.js fup`, `node tests/fup_ui.js`. Storage key `fupquest_state_v1`, sync key `spsquest_sync_fup`.

## AWL Quest (awl.html, web/awl/)

- `dev/src/awl.js` translates AWL (STL, German mnemonics) line-preserving to SCL: VKE/first-check/OR-branch tracked statically (helper vars `_qv<depth>`, `_qo<depth>`), parentheses `U(`…`)`, typed accumulators (`_qai1/2`, `_qar1/2`, `_qat1/2`), comparisons set a new VKE (AKKU2 op AKKU1), S5 timers SE/SA/SI/SV → TON/TOF/TP (Grundstufe only), S5 counters Z1… (0…999, native), jumps SPA/SPB/SPBN/LOOP/BEA/BEB via a WHILE/CASE dispatcher. Per-line status in `_q<line>v/a/b` (`AWL.statusOf`). All helper names start with `_q` (hidden in UI, filtered from warnings).
- `AWL.wrapEngine(SCLEngine)` for tasks with `lang:'awl'` (use the wrapped runners — they add the helper vars); `AWL.wrapPro(SCLPro)` for blocks with SCL header + AWL body; `CALL "FC"` / `CALL "FB", "DB"` / `CALL #Multi` with parameter lines, `RET_VAL := x`; operand types resolved from interfaces, DBs, UDTs, globals. In Profi use IEC timers as multi-instances.
- Content `dev/src/content_awl/` with `defAwl`/`defAwlPro` and `aFB/aFC/aOB/aDB/aUDT`; theory questions use `code` + `verifyAwl {src, vars, types, tests|steps}` / `verifyAwlPro`. must codes = mnemonics (`U`, `UN`, `ASSIGN`, `KLAMMER`, `O_VOR`, `SE`, `ZV`, `CMP_I`, `SPBN`, `CALL`, `RETVAL` …). Validator `node validate_awl.js`, tests `node test_awl.js`, `node tests/kop_playthrough.js awl`, `node tests/awl_ui.js`. Scene `scene_walzwerk.js` (furnaceOn/Door/Temp, conveyorRunning/Reverse, billetVisible/Pos, rollsRunning, rollGap, shearDown, coolingOn, pumpRunning, pressure, pieceCount, plcRun/plcFault, lamps, displays).

## Sensorwerkstatt (sensor.html, web/sensor/; plan: docs/SENSORWERKSTATT_PLAN.md, facts: docs/SENSORWERKSTATT_FAKTEN.md)

- Same game shell (`app.js`, `QUEST.lang = 'sensor'` → `SENSORMODE`); `sensor_game.js` swaps the scene card for a "Arbeitsschritte" checklist (quiz/measure inputs, "Anlage bedienen") and the editor for the workshop; the engineering laptop is an overlay. Storage key `sensorquest_state_v1`; drafts are objects `{state, hw, tags, lang, source, answers, loaded}`.
- Core (pure, Node-testable): `sensor_model.js` (raw values 0–27648, special values, materials, `detects`, `digitalInput` PNP/NPN × 1M, tank, transmitters), `wiring.js` (netlist with union-find, terminals `X2:n.L+|S|M`, `X1:L+n/Mn`, `X3:n.a|b`, `A1:DIa.n`, `A4:.n`, `check()` rules with pseudo nodes `POT:L+`, `POT:M`, `DI:I0.4`, `AI:CH0`; `mountAction`/`plugAction`/`shieldAction`, `meter`, calibrator in `analogAt`), `sensor_plc.js` (tag table + checks, `"Name"`/`%I0.4` preprocessing, hardware config, `Cpu` with compile/download/start/cycle/read, `ioImage`, `session`), `sensor_tasks.js` (`defWorkshopTask`, `defPreset`, `worldFrom`, step kinds quiz · mount · plug · wire · power · observe · tags · config · load · measure · program, `checkTask`, `applyRef`, `runProgram`, `describe`).
- UI: `scene_sensor.js` (three.js workshop, views 1–7, picking via face ranges, LEDs, wires, `screenPos`/`pickAt`), `scene_sensor2d.js` (terminal strip, tap-tap, keyboard, `intercept` hook), `workshop_ui.js` (tools, detail cards, multimeter, calibrator, x-ray, 2D mode), `engineering_ui.js` (device view, tags, program SCL/FUP – FUP with the graphical `KOPEditor` mounted on its own elements via `attach(stub, {flavor:'fup', body, toolsBar, symBar, varList})`; **no KOP in the Sensorwerkstatt** (removed 29.09.2026, old drafts with `lang:'kop'` open as FUP) –, load dialog, watch table with trend, diagnostics).
- **Umbau (29.09.2026, `docs/AUFTRAG_SENSORWERKSTATT_UMBAU.md`)**: nur **30 angezeigte Aufgaben** (5 je Modul, Auswahl in `content_sensor/plan.js` = `SW_PLAN`); die anderen 30 haben `hidden:true` (nicht in der Folge, Karte, Zählern und Live-Auswahl, aber per ID auflösbar – Leitstand, Live-Challenge, Störungsjagd `sb_<id>` –, **nie löschen**). Format v2 (`defWorkshopTask`): `core`, `hidden`, `phase` (Schwerpunkt: `verbinden|signale|programm|laufen|alle|[…]`), `prefill`, `lang:['scl','fup']`, `tools` (nur `multimeter`, `kalibrator`), `scene` (`sortierstrecke|tank`), `dispNo` (angezeigte Nummer 1–5). Schritte gehören zu Phasen (`SensorTasks.phaseOfStep`: wire/plug/mount → Verbinden; tags/config → Signale; program → Programm; power/load/observe/measure → Laufen lassen; quiz → Schwerpunkt); vorbefüllte Phasen sind im Startzustand gelöst (`newContext`). `sensor_flow.js` (`SensorFlow.create(task)`) ist der Zustandsautomat der Kernschleife (`status/accept/goto/canRun/done/snapshot`). Text-Limits: Story ≤ 2 Sätze, Auftrag ≤ 25 Wörter (`validate_sensor.js`: Hinweis, `--strict` = Fehler).
- **Kernschleife v2 (W6/W7)**: `sensor_v2.js` (`SensorGameV2`) spielt alle Aufgaben mit `core:true` (Phasenleiste, 2.5D-Verdrahtung, eingebetteter Laptop, „▶ Laufen lassen“, Werkzeugkarte); `sensor_game.js` schaltet per Proxy zwischen alter Werkstatt (versteckte Aufgaben) und v2 (`SCLQuest.sensor.current/v2/classic`). Mechanik automatisch (`isAutoStep`: plug, power, mount ohne Einstellen), Einstellen gehört zu Laufen lassen; `flow.markRun`. Texte in `content_sensor/texte.js` (story, brief, info = Infokarte). Theorie A/B kommen nach Aufgabe 1/3 und sind freiwillig („Später“, `S.skippedTheory`).
- **Messung und Leitstand (W8/W9)**: `S.sensorMetrics[id]` (erste Ader, Abbrüche, Zeig mir, Zeit je Phase; `summary.m` für die Klasse), `S.sensorWork[id]` = Werkstattzustand beim Lösen; der Leitstand lädt `web/data/sensor_view.js` (generiert) und zeigt die 2.5D-Verdrahtung nur lesend. Störungsjagd-Szenarien tragen `art` (verdrahtung/konfiguration/programm), andere sind `hidden`. Bildschirmtest `node tests/sensor_shots.js`.
- **Visualisierung (W3–W5)**: `sensor_visual.js` (`SensorVisual`: `netlist/state/help/apply/plant`, Node-testbar), `sensor_wiring_25d.js` (`SensorWiring25D`, 2.5D-Verdrahtung: Zonen Sensor/Klemmleisten/CPU, Schaltflächen ≥ 44 px, SVG-Kabel, DnD + Touch + Tastatur, eingeklappte „weitere Klemmen“, Farbsehhilfe, CSS im Modul) und `sensor_plant_3d.js` (`SensorPlant3D`, Hülle um `SensorScene`; `scene_sensor.js` hat seit W5 Etiketten `setLabels`, Hervorhebung `setHighlight`, Sensor-Farbcodes, warmes Licht), Demo `dev/demo_visual.html`, Mock-Daten `dev/mock/sensor_visual/mock_all.js` (erzeugt mit `node gen_visual_mock.js`), Screenshots `node tests/visual_shots.js` → `tests/shots/visual/`. Vertrag: `docs/SENSOR_VISUAL_VERTRAG.md`, Notiz `docs/VISUAL_NOTIZ.md`. Prüfungen: `node test_sensor_visual.js`, `node tests/sensor_visual_stub.js`, `node test_sensor_flow.js`, `node tests/sensor_scene.js`.
- Content `dev/src/content_sensor/`: `_sensor.js` (presets `schrank`, `schrank_ohne_qb`, `sortier_fertig`, `sm1221`; helpers `SW.w3/c2/field/need`), `chapters.js`, `m1.js`… (10 tasks per module, task 10 = boss), `theory.js` (`st<m>a/b`, questions may carry `verifyModel`), `manual.js`, `glossary.js` (`SENSOR_GLOSSARY`). Every step is checked against the final state; program tests address tags by name, `phys:{B11:50}` produces raw values through the model and the task's hardware config.
- Portal/worker: quest id `sensor` (progress, live challenge, reports; no exams yet), sync key `spsquest_sync_sensor`, Leitstand draws the wiring (`sensorView` in portal.js), fault-finding tasks (`debug: true`) are also live Störungsjagd scenarios (`C.bugs`, id `sb_<task>`).
- Checks: `node validate_sensor.js`, `node test_sensor_model.js`, `node test_sensor_plc.js`; browser: `node tests/sensor_playthrough.js [mobile]`, `tests/sensor_wiring_ui.js`, `tests/sensor_workshop_ui.js`, `tests/sensor_engineering_ui.js`, `tests/sensor_scene.js` (budget ≤ 120 000 triangles / 150 draw calls per view, every component pickable).

## Pikettdienst (entfernt am 29.09.2026)

- Der Pikettdienst (Schichtmodul, Pikett-Tafel, Pikett-Challenge, Zertifikatszeile „Pikettbereit“, `worker/pikett.js`, `pikett_core.js`, `content*/pikett.js`) wurde nach Klassentest 1 vollständig entfernt (`docs/AUFTRAG_FEEDBACK1.md`, Paket 0).
- Geblieben: `force` in `engine.js` / `engine_pro.js` / `awl.js` (Störungssimulation, getestet), die Handbuchseite „Fehlersuche im Betrieb“ (id `fehlersuche`, alle vier Quests), die D1-Tabellen `pikett_shifts` und `pikett_ranks` (Migration 7, kein DROP; beim Löschen eines Kontos werden ihre Zeilen weiter entfernt), alte Spielstände mit `S.pikett` (wird ignoriert) und alte Live-Challenges mit Modus `pikett` (Anzeige „Modus entfernt“, keine Ergebnisse mehr).

## Roadmap

This repo is growing into **SPS Quest** (SCL, KOP, FUP, AWL Quest + portal with accounts and teacher dashboards). All product decisions are in `docs/ENTSCHEIDUNGEN.md` (German) and are binding; current progress and the next step are in `docs/STAND.md` — read both first and update `docs/STAND.md` after each finished work package.

## Workflow

```
cd dev
node test_engine.js && node test_pro.js
node validate.js        # must print "OK — keine Fehler"
node validate_kop.js && node validate_kop.js fup && node validate_awl.js && node test_awl.js   # KOP / FUP / AWL
node build.js           # regenerates ../index.html
npm install && node tests/playthrough.js && node tests/pro_ui.js && node tests/kop_playthrough.js && node tests/kop_playthrough.js fup && node tests/fup_ui.js && node tests/kop_playthrough.js awl && node tests/awl_ui.js   # optional E2E (Playwright/Chromium)
# Worker/Portal (needs ../.dev.vars with ADMIN_USER=… and ADMIN_PASSWORD=…):
npx wrangler dev -c ../wrangler.jsonc --local --port 8787 &
node tests/api.js && node tests/portal.js && node tests/live.js
```

## Accounts, sync and live challenge
- Roles admin (from secrets, row created on first login, password `!secret`), teacher (created by admin, must change start password), student (created by teacher or self-signup with a 6-char class code). Usernames are pseudonyms; the certificate name (`S.name`) is stripped before upload. Session cookie `spsq_sess` (HttpOnly, SameSite=Lax), writes need header `x-spsquest: 1`. Rate limit: 5 failed logins per user / 40 per IP in 15 min.
- Game sync (`ACCT` in app.js, portal version only): `localStorage.spsquest_sync_scl = {user, base, dirty, summary}`; `PUT /api/progress/scl` with `base` → 409 on conflict (more progress wins). First login with local progress asks to take it over; a different account on the same browser never mixes; portal logout uploads and clears the local state.
- Reports: `dev/portal/report.js` is injected into the portal and every `web/<quest>/index.html` (not the offline files): fixed 💬 button bottom-left, type feedback/fehler + text, context from `window.SPSQ_REPORT_CONTEXT()` (app.js: quest + task/theory/block). `POST /api/reports` works without login (username from the session, UA from the request, 10 per IP per 15 min); `#/meldungen` lists them (admin all, teacher own students). Admins with a password hash (not `!secret`) log in normally, may change their password and can also act as teachers (Leitstand, classes, live challenge).
- Seed: no accounts in the repo. `node dev/seed.js [file]` reads the untracked `dev/seed.local.json` ({admin, class, students}) and writes `dev/seed.local.sql` for `wrangler d1 execute`; migration 5 is an intentionally empty placeholder.
- Live challenge (`LIVE` in app.js, `scl/?live=ID`): modes `sprint` / `bug` (Störungsjagd), 4-digit join code, task hidden until start, attempts/hints/solution reported to `/api/live/:id/*`, polling every 2.5 s (beamer 2 s). Points: 500 + up to 500 for speed − 50 per failed attempt (max 250) − 100 per hint, min 100. Solutions are trusted from the client (classroom use).

## Avatars and coins (Feedback Paket 3)
- `dev/src/avatar_core.js` (`SPSQAvatar`: catalog, SVG drawing, coin rules, unlocks) is embedded in the portal and bundled into `worker/gen/avatar_bundle.js` by `build.js` (generated, commit it). Worker `worker/avatar.js`: `GET/PUT /api/avatar`, `POST /api/avatar/buy`; balance = computed from synced progress + `coin_ledger` (speedrun awards on challenge end, purchases). Migration 9 (`avatars`, `coin_ledger`). Portal wardrobe `#/avatar` (`portal_avatar.js`), `P.avatarHTML`. Coins are earn-only and cosmetic. Test: `tests/avatar.js`.
- Live challenge: mode `sprint` is shown as „Speedrun“; `challenges.tasks` (2–10 tasks, migration 8), per-task progress in `challenge_players.progress`; beamer music `portal_musik.js` (`SPSQ_MUSIC`).

## Feedback packages 4/5 (Kernpfad, Probebetrieb, TIA editor, PLC tags)
- `content*/kern.js`: 5 core tasks per chapter (`core:true`), the rest is optional training (skipped in the sequence unless `S.settings.training`); fast lane `S.fastSkip`; exam eligibility counts core tasks. `SIM` in app.js = „▶ Anlage testen“ (cyclic run, inputs toggled in a table, never a failed attempt). Tests: `tests/kernpfad.js`.
- `content*/tags.js` (`PLC_TAGS`: addr/type/comment per plant, `node gen_tags.js [quest] [--neu]`, comments are hand-maintained); the „PLC-Variablen“ window renders them (`tagTable`). Briefs from the 3rd task on must not name variables (`check_briefs.js`, used by the validators). KOP/FUP editor: instruction library (`#kopLib`), placeholders `<??.?>`, inline operand input, `*` pin, pin click negates, context menu. Test: `tests/fup_tia.js`.

## Certificates and exams (docs/ZERTIFIKAT_KONZEPT.md, plan: docs/PLAN_ZERTIFIKAT_PIKETT.md Teil A)
- `dev/src/exam_core.js` (browser, validator, worker): `defExamTask` / `defExamQuestion`, seeded draw (`draw`, `build`), params per exam, `publicItem` (never ref/hidden/wrong), `gradeTask` (one item; 20 KB / 20 000 loop iterations via `root.SCL_MAX_ITER`), `total` (tasks 70 %, theory 30 %, pass 70 %, distinction 90 %).
- Pools: `dev/src/content*/exam.js` (per quest: Grundstufe 18 tasks + 40 questions, Profi 12 + 30). Validator: `node validate_exam.js [--quest=kop] [--full]`. CPU check: `node bench_exam.js`.
- `node build.js` also writes `worker/gen/exam_bundle.js` (engines + exam pools + task/chapter meta, ESM) — generated, commit it.
- Worker: `worker/exam.js` (eligibility, start, answer = store then grade, focus, submit with `pending` retry, proctored sessions, void), `worker/cert.js` (issue with consent, withdraw, admin revoke, class/admin lists, public `/api/certificates/:code` and server-rendered `/z/:code` with Open Graph; 60 lookups/min/IP). Migration 6. `run_worker_first` includes `/z/*`. `CERT_FEE=1` requires `exam_credits` (no payment). Local tests need `EXAM_DEV=1` in `.dev.vars` while pools are incomplete.
- Game: `EXAM` module in app.js (`<quest>/?exam=ID`, `session.exam`): exam bar, local test with visible tests (`onSuccess` → `EXAM.localOk`), „Abgeben“, theory overlay, finish/result; hints, map, diff, tour hidden (`body.exam-mode`).
- Portal: `portal_zertifikate.js` (overview, start, join by code, issue, sheet with QR via embedded `qrcode-generator` (MIT), print A4 landscape, PNG, LinkedIn link, withdraw), `portal_pruefung.js` (Leitstand proctoring `#/pruefung/:id`, class certificates, admin revoke, display name).
- Tests: `tests/exam_api.js`, `tests/exam_ui.js [quest…]`, `tests/cert_render.js` (PDF/PNG, QR decoded with jsqr).

## Grundstufe engine semantics (engine.js)

- SCL precedence: `**` > unary `NOT`/`-` > `* / MOD` > `+ -` > comparisons > `= <>` > `AND`/`&` > `XOR` > `OR`.
- Types inferred from `initialVars` or set via `types` (`{Mittelwert:'REAL'}`). **A REAL output whose initial value is 0 must be declared REAL.**
- Time model: each timed step is one scan; `dt` = time since the previous scan. Timers measure from the scan in which they first see their input.

## Profi engine semantics (engine_pro.js)

- Types: Bool, SInt/USInt/Int/UInt/DInt/UDInt (overflow wraps like a PLC), Real/LReal, Time (seconds internally), Byte/Word/DWord with `.%Xn`, String[n] (truncates), Array[a..b(,c..d)] (bounds are part of the type), STRUCT, UDT (`"UDT_x"`), FB types incl. TON/TOF/TP/R_TRIG/F_TRIG/CTU/CTD/CTUD.
- Implicit conversions only when lossless (Int→DInt→Real); otherwise `X_TO_Y` is required. Literals adapt to the target if they fit. ROUND/TRUNC/CEIL/FLOOR return a generic integer.
- FC: all parameters must be supplied; return value via the function name (or `Ret_Val`); `VAR` (static) is an error. FB: inputs keep their last value; instances via instance DB (`"X_DB"` is auto-created if `X` is an FB, or declared through `instances`) or multi-instance `#Inst(...)`. Calling an FB type directly is an error.
- Warnings (codes): `TEMP_READ_BEFORE_WRITE`, `OUT_NOT_ALL_PATHS`, `RET_NOT_SET`, `UNUSED_VAR`, `GLOBAL_ACCESS` (FB/FC reads globals), `INSTANCE_TWICE`, `CONDITIONAL_CALL`, `STRING_TRUNC` (literals only). Tasks can require absence via `warnFree`.
- OB with name Startup/Anlauf (or `ob:100` in the block meta) runs once before the first scan.
- String conversions (`INT_TO_STRING` etc.) are simplified (no leading sign/space); this is noted in the manual — verify against real TIA.

## Writing Profi tasks (`defProTask`)

`id, ch, title, story, brief, learn, take, man, hint, hint2, debug, boss, final, table (default: ch >= 12), blocks, globals, types, comments, instances, unit, tests, timed, must, warnFree, bind, wrong`.
- `blocks`: `{name, kind:'FB'|'FC'|'OB'|'UDT'|'DB', edit:true, start, ref}` (learner-editable) or `{name, kind, src}` (locked). The block name must equal the unit name (unless `free:true`).
- `unit: [{block, setup, steps:[[dt, inputs, expect]]}]` tests a single FB/FC through its interface (`RET` = FC return value). `tests`/`timed` run the whole program; expect/input keys may be paths (`'DB_Zelle.Charge[1]'`, `'FB_Anlage_DB.Band1.Lauf'`).
- `must` uses `SCLPro.constructsUsed(prog, editableBlocks)` codes, e.g. `FB, FC, MULTI, SINGLE, FC_CALL, STAT, TEMP, CONSTANT, VAR_CONSTANT, VAR_IN_OUT, UDT, UDT_REF, STRUCT, DB_ACCESS, MEMBER, BIT, STRING, CONCAT, STARTUP, INIT, DINT, ARRAY_BOUNDS`, statement codes as in the Grundstufe.
- `wrong: [{Block:'source'}]` — merged over the reference; the validator asserts they fail.
- The validator also checks: reference passes, start code fails, references are warning-free, bindings resolve, and that no content still offers the removed TIA export.
- Theory questions in `theory_pro.js` may carry `verifyPro {src, globals, types, steps, ask}`, `compilesPro {src, expect}`, `warnPro {src, code, expect}` — checked against the engine.

## Scene channels

armAngle, gripperOpen, beltRunning, lightRed/Yellow/Green, sensorActive, partVisible, partColor, gateAngle, displayValue, displayLabel, faultActive, hornActive, **belt2Running, fanRunning, displayText, partLabel, motorFault1, motorFault2**. armAngle 0° = pick station, +90° = LAGER, −90° = NACHARBEIT.

## Comfort features (app.js, section "BEDIENKOMFORT")

- Editor: wavy underline at the error position (`editor.setErrorMark`), live while typing; hover tooltips for variables (type, section, comment, last test value), keywords and glossary terms; mobile symbol toolbar (`#symBar`).
- Quick fixes (`quickFix`) for common compiler errors: suggestion replacement ("Meintest du …"), missing `;`, `=`→`:=`, `==`, `!=`, `&&`, `||`, `!`, missing THEN/DO, `ELSE IF`→`ELSIF`, CASE `:=`→`:`.
- Diagnosis box ("Mögliche Ursache", `diagnose`) derived from the failing test step: counting without edge, value lost between cycles (TEMP), off by one, overflow, integer division, one cycle late (order), output stuck, timer issues, truncated strings, array position.
- Solution comparison (line diff, `openDiff`) after solving and from the map; spaced review suggestions (`reviewCandidates`) at the top of the map.
- Guided tours (`TOURS.basic`, `TOURS.pro`, stored in `S.tours`), glossary (`GLOSSARY`, manual page "Glossar A–Z", dotted underlines in task texts), manual full-text search.
- Save indicator, storage check/banner, `navigator.storage.persist()`, export reminder (`S.doneSinceExport`, `S.lastExportAt`).
- Settings: light theme (editor and cell stay dark), UI scale (`zoom`), colour-vision aid (symbols on signal lamps and monitor).
- Scene: channels a task does not bind are reset to their defaults when a task is opened.
- Browser tests set `SCLQuest.state.tours = {basic:true, pro:true}` after starting a new game so the tour does not block clicks; `tests/comfort.js` covers the comfort features (runs fully offline).

## Persistence

`localStorage` key `sclquest3_state_v4` (v1 saves are migrated). Profi drafts are stored as objects `{block: source}` in `S.drafts[taskId]`. `S.basicCert` marks that the Grundstufe certificate was shown.

## Known limits / next steps

- String conversion behaviour has not been verified in a real TIA Portal (V17–V20) / PLCSIM.
- A learner field test of chapters 11–15 is still outstanding.
- Language: all in-game text is German (Swiss spelling without ß in places). Keep the ARIA / Werkmeister tone.
