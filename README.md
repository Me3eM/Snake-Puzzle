# Snake Puzzle

Ein browserbasiertes Rohr-Puzzle im Stil von "geführte Level-Snake"-Spielen:
Eine Schlange steckt in einem festen Holzrohr und wird Feld für Feld per
Steuerkreuz durch das Rohr gelenkt, bis sie das Ziel erreicht – ohne
Stacheln, Sägeblätter oder Steine zu berühren.

Kein Build-Prozess nötig – reines HTML/CSS/JavaScript. Einfach `index.html`
in einem lokalen Server öffnen (z. B. `python3 -m http.server`) oder direkt
im Browser laden.

## Spielprinzip

- Jedes Level ist ein vorgezeichnetes Rohr (Pfad aus Holzplanken). Die
  Schlange startet an der Spiralmarkierung und wächst bei jedem Schritt um
  ein Segment – sie füllt das Rohr hinter sich, kann also nicht zurück in
  bereits besuchte Felder.
- Steuerung per Steuerkreuz (Bildschirm), Pfeiltasten oder WASD: Jeder
  Tastendruck bewegt den Kopf genau ein Feld.
- Stacheln und Sägeblätter auf dem Pfad sind tödlich, Steinblöcke
  versperren den Weg – oft gibt es eine breitere Ausweichstelle, um daran
  vorbeizukommen.
- Läuft die Schlange in eine Sackgasse ohne freies Nachbarfeld oder in eine
  Gefahr, endet das Level mit "FAILED!" – dann helfen "Nochmal" (Neustart)
  oder "Überspringen" (Level automatisch lösen) weiter.
- ↺ nimmt den letzten Zug zurück, 💡 zeigt kurz die nächste richtige
  Richtung an.
- Nach jedem geschafften Level wird das nächste freigeschaltet; die
  Sternebewertung (1–3) hängt von der Anzahl der Versuche ab.
- Fortschritt und Sterne werden lokal im Browser gespeichert (`localStorage`).

## Struktur

- `index.html` – Bildschirme (Menü, Level-Auswahl, Spiel) und Overlays
  (Pause, Sieg, "FAILED!")
- `style.css` – Holz-/Nachthimmel-Theme, responsives Layout, Steuerkreuz
- `js/levels.js` – Level-Baukasten (Pfad-Helferfunktionen) und
  Level-Definitionen (Pfad, Stacheln, Sägen, Steine, Start/Ziel)
- `js/game.js` – Spiellogik: schrittweise Bewegung, Kollisions-/
  Gefahrenprüfung, Rendering, Undo/Hinweis/Überspringen, Speicherstand

Aktuell enthalten: 8 Level mit steigender Schwierigkeit (Einstieg bis
Endgegner).
