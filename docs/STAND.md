# Stand (26.09.2026)

Fertig: SCL Quest v5.1 (siehe CLAUDE.md) – 150 Aufgaben, 30 Theorien, Profi-Engine, Bedienkomfort, PWA.
Projektkarte: docs/SCL_Quest_Projektkarte.drawio.
Entscheidungen: docs/ENTSCHEIDUNGEN.md.

## Erledigt
1. **TIA-Export entfernt** – Engine (`exportProject`, `exportZip`, ZIP/CRC, Fixups), Export-Knopf im Projekt-Editor und im Erfolgsdialog, Tour-Schritt, Handbuchseite „Export nach TIA Portal“, Abzeichen „Brücke ins TIA Portal“ (alte Spielstände mit dem Abzeichen laufen weiter), Validator-Rundreise. Aufgabe `p15_export` heisst jetzt „Sauber für die Bibliothek“ (ID unverändert, Handbuch → Programmierstandard), Theorie t15b „Programmierstandard“ ohne Import-Fragen. Validator meldet Fehler, falls Inhalte wieder auf einen TIA-Export verweisen. Tests: Engine, 268 Profi-Tests, Validator 0 Fehler, Browser-Durchlauf 150+30 ohne JS-Fehler, pro_ui, comfort.

## Nächster Schritt
2. Plattform: Portal, Login, Klassen, Dashboards (Worker-API in `worker/`, D1).
Danach: 3. Live-Challenge, 4. Testplan, 5. KOP/FUP/AWL Quest.

## Hosting
Cloudflare Worker `scl-quest` (wrangler.jsonc, Assets aus web/), per GitHub verbunden (Workers Builds, Preview pro Nebenzweig).
D1 `spsquest` angelegt (database_id febfbb60-ed1e-48b3-b26f-f4933dd24915), Binding `DB` in wrangler.jsonc eingetragen. Secrets ADMIN_USER / ADMIN_PASSWORD im Worker gesetzt (Production + Previews).
Hinweis für Sitzungen in der Cloud-Umgebung: *.workers.dev ist dort vom Proxy gesperrt – Deploy-Status über die GitHub-Checks „Workers Builds: scl-quest“ prüfen, Worker lokal mit `npx wrangler dev` (in dev/ installiert) testen.
