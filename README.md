# 🎲 Random Team Picker

Ein kleiner Zufallsgenerator, der aus einer Liste von Spielernamen zufällige
Teams bildet — mit einem Karten-Misch- und Auslos-Effekt. Reines
HTML/CSS/JS, kein Build-Schritt, läuft direkt als GitHub Page.

## Benutzung

1. Spielernamen eingeben (einer pro Zeile).
2. Gewünschte Anzahl Spieler pro Team eingeben. Das letzte Team bekommt den
   Rest, falls die Spielerzahl nicht restlos aufgeht.
3. Optional eigene Teamnamen eingeben (einer pro Zeile). Ohne Eingabe wird
   "Team 1", "Team 2", ... verwendet.
4. Auf "Teams auslosen" klicken — die Karten werden gemischt und reihum auf
   die Teams verteilt.
5. Mit "Neu starten" zurück zur Eingabe (die bisherigen Eingaben bleiben
   erhalten).

## Lokal testen

Da es nur statische Dateien sind, reicht ein einfacher Webserver, z. B.:

```bash
python3 -m http.server 8000
```

und dann `http://localhost:8000` öffnen.

## Hosting via GitHub Pages

Dieses Repo enthält einen Workflow (`.github/workflows/pages.yml`), der die
Seite bei jedem Push auf `main` automatisch über GitHub Actions als Page
deployt.

Einmalig in den Repo-Einstellungen aktivieren:

**Settings → Pages → Build and deployment → Source: "GitHub Actions"**

Danach ist die Seite unter `https://<username>.github.io/<repo-name>/`
erreichbar.
