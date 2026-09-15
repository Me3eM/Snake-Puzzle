# Snake Puzzle

Ein browserbasiertes Snake-Spiel mit festen Levels statt Endlosmodus: Jedes Level hat ein eigenes Wände-/Hindernis-Layout und ein Ziel (eine bestimmte Anzahl an Punkten fressen), statt einfach nur Highscore zu jagen.

Kein Build-Prozess nötig – reines HTML/CSS/JavaScript. Einfach `index.html` in einem lokalen Server öffnen (z. B. `python3 -m http.server`) oder direkt im Browser laden.

## Spielprinzip

- Steuere die Schlange mit Pfeiltasten/WASD (Desktop), dem Steuerkreuz oder per Wisch-Geste (Mobil).
- Friss die geforderte Anzahl an Punkten, ohne gegen eine Wand, ein Hindernis oder dich selbst zu fahren.
- Nach jedem geschafften Level wird das nächste freigeschaltet; die Sternebewertung (1–3) hängt davon ab, wie viele Versuche du gebraucht hast.
- Fortschritt und Sterne werden lokal im Browser gespeichert (`localStorage`).

## Struktur

- `index.html` – Bildschirme (Menü, Level-Auswahl, Spiel) und Overlays (Pause, Sieg, Niederlage)
- `style.css` – Dark-Theme, responsives Layout, Steuerkreuz für Touch-Geräte
- `js/levels.js` – Level-Definitionen (Größe, Wände/Hindernisse, Zielanzahl, Geschwindigkeit)
- `js/game.js` – Spiellogik: Game-Loop, Kollisionserkennung, Rendering, Eingaben, Speicherstand

Aktuell enthalten: 8 Level mit steigender Schwierigkeit (Einstieg bis Endgegner).
