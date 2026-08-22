# 🎲 Random Team Picker

Ein Zufallsgenerator für Teams im Lobby-Stil: Namen werden sofort zu kleinen
Kacheln, die per Zufall (mit coolem Karten-Deal-Effekt) in Team-Spalten
verteilt werden — danach frei per Drag & Drop verschiebbar und per Klick
umbenennbar. Reines HTML/CSS/JS, kein Build-Schritt, läuft direkt als
GitHub Page.

## Benutzung

1. Spieler oben eintippen und mit Enter/`+` als Kachel hinzufügen.
2. "Spieler pro Team" festlegen.
3. Verteilung wählen:
   - **Gleichverteilt** (Standard) — Teamgrößen unterscheiden sich um
     höchstens 1 (z. B. 4 Spieler / 3 pro Team → 2 + 2).
   - **Füllen** — erstes Team wird komplett voll gemacht, der Rest wandert
     ins letzte Team (z. B. 4 Spieler / 3 pro Team → 3 + 1).
4. Optional eigene Teamnamen eingeben oder eine der absurden Vorschlags-Chips
   anklicken (🔄 für neue Vorschläge).
5. Optional einen **Seed** eintragen, um eine Auslosung reproduzierbar zu
   machen — gleicher Seed + gleiche Spielerliste = garantiert gleiches
   Ergebnis. Leer lassen für einen frischen Zufalls-Seed bei jedem Klick.
6. Auf "Teams auslosen" klicken — die Kacheln mischen sich kurz und fliegen
   dann reihum in ihr Team.
7. Kacheln können jederzeit per **Drag & Drop** in ein anderes Team (oder
   zurück in den Pool) gezogen werden. Das Stift-Icon erlaubt Umbenennen,
   das ✕ entfernt einen Spieler.
8. **🖼️ Urkunde herunterladen** speichert eine PNG-Übersicht mit Zeitstempel,
   verwendetem Modus, Seed und der aktuellen (ggf. manuell angepassten)
   Teamaufstellung.

## Lokal testen

```bash
python3 -m http.server 8000
```

und dann `http://localhost:8000` öffnen.

## Hosting via GitHub Pages

Ein Workflow (`.github/workflows/pages.yml`) deployt die Seite bei jedem
Push auf `main` automatisch über GitHub Actions als Page.

Einmalig in den Repo-Einstellungen aktivieren:

**Settings → Pages → Build and deployment → Source: "GitHub Actions"**

Danach ist die Seite unter `https://<username>.github.io/<repo-name>/`
erreichbar.
