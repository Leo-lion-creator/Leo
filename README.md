# AI Video Editor 🎬

Animierte Reels aus **einer Zeile Text**, gebaut mit Claude Code.
Claude schreibt das Drehbuch, ElevenLabs spricht das Voiceover, Node animiert die Szenen
und ffmpeg rendert das MP4 (1080×1920, mit Untertiteln).

## Die 6 Schritte

1. **Desktop-App:** [Claude](https://claude.ai/download) installieren und darin Claude Code nutzen, nicht im Browser.
2. **Ordner:** dieses Repo auf deinen Computer holen (z. B. als Ordner `AI Video Editor`).
3. **Lokaler Chat:** in der App einen neuen Chat starten, **Local** wählen und diesen Ordner auswählen.
4. **Setup:** `check my setup` tippen. Claude prüft Node.js, ffmpeg und deinen ElevenLabs-Key
   und hilft dir bei allem, was fehlt.
5. **Eine Zeile:** dein Thema tippen, z. B. *„Mach ein Reel darüber, warum Flugzeugessen so fade schmeckt“*.
6. **Feedback:** sagen, was dir nicht gefällt, z. B. *„Mach den Hook knackiger“*. Claude ändert es und rendert neu.

Das fertige Reel liegt danach unter `projects/<name>/out/reel.mp4`.

## Von Hand (optional)

```bash
npm install
npm run check                 # Setup prüfen
npm run preview -- beispiel   # Standbilder pro Szene
npm run make -- beispiel      # Voiceover + Reel rendern
```

Ohne ElevenLabs-Key funktioniert alles auch, nur ohne Stimme (mit Untertiteln).
