---
name: make-reel
description: Erstellt aus einem Thema in einer Zeile ein komplettes animiertes Reel – Drehbuch schreiben, Voiceover aufnehmen, animieren, rendern, selbst prüfen. Verwenden bei "mach ein Reel über …", "Reel zum Thema …" oder wenn der Nutzer einfach ein Thema nennt.
---

# Reel aus einer Zeile

1. **Projektname:** kurzer Slug aus dem Thema (klein, Bindestriche), z. B. `flugzeug-essen`.
   Existiert `projects/<slug>/` schon, nicht überschreiben, sondern `-2` anhängen.
2. **Drehbuch schreiben:** `projects/<slug>/script.json` nach dem Format und den Regeln in `CLAUDE.md`.
   Orientierung: `projects/beispiel/script.json`. Kurze Recherche nur, wenn Fakten nötig sind.
   Mische die Szenentypen (nicht nur `text`).
3. **Vorschau:** `npm run preview -- <slug>` und **alle** `out/preview-XX.png` ansehen.
   Text außerhalb des Bildes, Überlappungen oder zu volle Szenen selbst im Drehbuch korrigieren
   (kürzer formulieren, `headlineSize` verkleinern, weniger `items`). Danach erneut prüfen.
4. **Rendern:** `npm run make -- <slug>`. Ohne Voice key läuft es stumm durch; erwähne das einmal.
5. **Abschluss:** dem Nutzer in 2–3 Zeilen sagen, wo das Reel liegt (`projects/<slug>/out/reel.mp4`),
   wie lang es ist und was der Hook ist. Mit dem Hinweis: „Sag mir einfach, was ich ändern soll.“
