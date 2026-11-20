---
name: fix-reel
description: Setzt Feedback zu einem bestehenden Reel um (z. B. "Hook knackiger", "Szene 3 raus", "andere Farbe", "langsamer") und rendert neu. Verwenden, sobald der Nutzer etwas an einem Reel ändern möchte.
---

# Feedback umsetzen

1. **Welches Projekt?** Das zuletzt bearbeitete unter `projects/`, sonst kurz nachfragen.
2. **Feedback übersetzen** in Änderungen an `script.json`:
   - „Hook knackiger“ → Szene 1: kürzere Frage, stärkeres Stempelwort, Voiceover höchstens 8 Wörter.
   - „zu lang“ → Szenen streichen oder Voiceover kürzen.
   - „zu schnell“ → `"duration"` pro Szene erhöhen oder mehr Text im Voiceover.
   - „andere Farbe / Stil“ → `theme` (`accent`, `bg`, `ink`, …).
   - „andere Stimme“ → `ELEVENLABS_VOICE_ID` in `.env` ändern, dann mit `--force-voice` rendern.
   - Wünsche, die das Drehbuch-Format nicht abdeckt (neuer Szenentyp, Bilder, Musik …):
     `src/render.mjs` erweitern, bestehende Szenentypen dabei nicht kaputt machen.
3. `npm run preview -- <slug>`, Bilder prüfen, dann `npm run make -- <slug>`.
   Nur geänderte Voiceover-Szenen werden neu aufgenommen (spart ElevenLabs-Guthaben).
4. Kurz sagen, **was** du geändert hast (1–3 Stichpunkte).
