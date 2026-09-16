# Snake Puzzle

Ein browserbasiertes Zug-für-Zug-Puzzlespiel im Stil von "Snake Puzzle: Slither to Eat": Kein Echtzeit-Tempo wie beim klassischen Snake – jeder Tastendruck oder Wisch bewegt die Schlange genau ein Feld. Friss alle Pflanzen eines Levels, werde dadurch länger, und erreiche damit das Portal.

Kein Build-Prozess nötig – reines HTML/CSS/JavaScript. Einfach `index.html` über einen lokalen Server öffnen (z. B. `python3 -m http.server`).

## Spielprinzip

- Steuerung mit Pfeiltasten/WASD, dem Steuerkreuz oder per Wisch-Geste – ein Befehl, ein Feld.
- Gegen einen Block oder den eigenen Körper zu laufen ist harmlos: Der Zug wird einfach ignoriert.
- **Pflanzen** sind das Futter. Jede gefressene Pflanze verlängert die Schlange um ein Segment.
- **Das Portal** ist das Ziel. Es öffnet sich erst, wenn alle Pflanzen gefressen sind – und weil die Schlange nur so hoch reicht, wie sie lang ist, musst du oft erst wachsen, um überhaupt hinzukommen.
- **Stacheln** und **Kreissägen** sind tödlich. Sägen stehen entweder fest oder patrouillieren eine Strecke, dann bewegen sie sich pro Spielzug genau ein Feld.
- **Gravitation** (in Levels mit `gravity: true`): Die Blöcke bilden gestufte Plattformen. Solange mindestens ein Segment auf einem Block ruht, hält sich die ganze Schlange – sie kann also über Kanten hinausragen oder senkrecht hochstehen. Verliert sie jeden Halt, fällt sie als Einheit nach unten; ins Leere oder in Stacheln zu fallen beendet den Versuch.
- „Rückgängig" macht den letzten Zug ungeschehen – auch noch aus dem Fehlschlag-Bildschirm heraus. „Tipp" zeigt kurz einen sicheren Weg zum nächsten Ziel, kostet aber einen Stern.
- Sternebewertung (1–3) nach Anzahl der Versuche; Fortschritt und Sterne liegen im `localStorage`.

## Struktur

- `index.html` – Bildschirme (Menü, Level-Auswahl, Spiel) und Overlays (Pause, Sieg, Niederlage)
- `style.css` – Dark-Theme, responsives Layout, Steuerkreuz für Touch-Geräte
- `js/levels.js` – Level-Definitionen: `walls` (Holzblöcke), `stones` (Steinblöcke), `food`, `spikes`, `saws`, `portal`, `gravity`
- `js/game.js` – Zugbasierte Spiellogik: Kollision, Fallphysik, Portal-Ziel, Undo-Stack, Tipp-Pfadsuche, Canvas-Rendering

Aktuell enthalten: 6 Level (Erste Schritte bis Meisterwerk). Level 1 ist ein Plattform-Level mit Gravitation und Portal, die übrigen sind flache Labyrinth-Level.
