# Snake Puzzle

Ein browserbasiertes Zug-für-Zug-Puzzlespiel im Stil von "Snake Puzzle: Slither to Eat": Kein Echtzeit-Tempo wie beim klassischen Snake – jeder Tastendruck/Wisch ist genau ein Feld. Ziel jedes Levels: alle Äpfel fressen, ohne dich selbst einzusperren, gegen Stacheln zu laufen oder von einem patrouillierenden Zahnrad erwischt zu werden.

Kein Build-Prozess nötig – reines HTML/CSS/JavaScript. Einfach `index.html` in einem lokalen Server öffnen (z. B. `python3 -m http.server`) oder direkt im Browser laden.

## Spielprinzip

- Steuere die Schlange mit Pfeiltasten/WASD (Desktop), dem Steuerkreuz oder per Wisch-Geste (Mobil) – ein Tastendruck bewegt genau ein Feld.
- Gegen eine Wand oder den eigenen Körper zu laufen ist harmlos (der Zug wird einfach ignoriert) – nur Stacheln und Zahnräder sind tödlich.
- Alle Äpfel eines Levels liegen von Anfang an auf dem Feld. Jeder gefressene Apfel lässt die Schlange um ein Segment wachsen; dadurch wird es schwieriger, sich durch enge Gänge zu manövrieren.
- „Rückgängig" macht den letzten Zug ungeschehen (auch nach einem Fehlschlag), „Tipp" zeigt kurz einen sicheren Weg zum nächsten Apfel – kostet aber einen Stern.
- Sternebewertung (1–3) basiert auf der Anzahl der Versuche; ein genutzter Tipp begrenzt das Level auf maximal 2 Sterne.
- Fortschritt und Sterne werden lokal im Browser gespeichert (`localStorage`).
- Manche Level (z. B. Level 1) haben Gravitation: Die Blöcke bilden gestufte Plattformen statt einer flachen Maze. Trägt kein Segment der Schlange mehr Bodenkontakt, fällt die gesamte Schlange als Einheit nach unten – landet sie auf einer Plattform, geht es weiter; fällt sie ins Leere oder auf einen Stachel, ist der Versuch vorbei.

## Struktur

- `index.html` – Bildschirme (Menü, Level-Auswahl, Spiel) und Overlays (Pause, Sieg, Niederlage)
- `style.css` – Dark-Theme, responsives Layout, Steuerkreuz für Touch-Geräte
- `js/levels.js` – Level-Definitionen (Größe, Wände, Äpfel, Stacheln, Zahnrad-Patrouillen)
- `js/game.js` – Zugbasierte Spiellogik: Kollision/Blockierung, Undo-Stack, Tipp-Pfadsuche, Rendering, Speicherstand

Aktuell enthalten: 6 Level mit steigender Schwierigkeit (Erste Schritte bis Meisterwerk).
