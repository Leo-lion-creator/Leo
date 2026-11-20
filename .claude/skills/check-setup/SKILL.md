---
name: check-setup
description: Prüft, ob alles für den AI Video Editor installiert ist (Node.js, ffmpeg, npm-Pakete, ElevenLabs-Key) und führt den Nutzer Schritt für Schritt durch fehlende Teile. Verwenden bei "check my setup", "prüf mein Setup", "funktioniert alles?" oder wenn ein Render wegen fehlender Tools scheitert.
---

# Setup prüfen

1. Falls `node_modules/` fehlt: `npm install` ausführen.
2. `npm run check` ausführen und das Ergebnis kurz zusammenfassen (z. B. „3 von 4 bereit“).
3. Für jeden roten Punkt den Nutzer **einzeln** durchführen und nach jedem Schritt erneut prüfen:
   - **Node.js fehlt / zu alt:** Link https://nodejs.org (LTS) geben, installieren lassen, danach Claude neu starten.
   - **ffmpeg fehlt:** Auf dem Mac `brew install ffmpeg` selbst ausführen (falls Homebrew fehlt: https://brew.sh).
     Unter Windows `winget install ffmpeg`.
   - **Canvas fehlt:** `npm install` selbst ausführen.
   - **Voice key fehlt:**
     1. Falls `.env` fehlt: `cp .env.example .env` selbst ausführen.
     2. Nutzer öffnet https://elevenlabs.io/app/settings/api-keys → „Create key“ (Recht „Text to Speech“ reicht).
     3. Nutzer trägt den Key **selbst** in `.env` bei `ELEVENLABS_API_KEY=` ein.
        Bitte den Nutzer **nicht**, den Key in den Chat zu kopieren.
     4. Optional: Für eine deutsche Stimme in der ElevenLabs Voice Library eine Stimme wählen
        und deren ID bei `ELEVENLABS_VOICE_ID=` eintragen.
4. Wenn alles grün ist, sagen: „Alles bereit – nenn mir einfach dein Thema.“
   Ohne Voice key funktioniert Rendern trotzdem, nur stumm mit Untertiteln.
