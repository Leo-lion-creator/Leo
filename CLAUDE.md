# AI Video Editor

Dieser Ordner macht aus **einer Zeile Text** ein animiertes Hochkant-Reel (1080×1920, MP4)
mit Voiceover und Wort-für-Wort-Untertiteln.

## So arbeitest du hier

Der Nutzer redet Deutsch und ist kein Entwickler. Antworte kurz, auf Deutsch, ohne Fachjargon.
Führe Befehle selbst aus, statt sie dem Nutzer zu erklären.

| Der Nutzer sagt … | Dann … |
|---|---|
| „check my setup“, „prüf mein Setup“ | Skill **check-setup** |
| „mach ein Reel über …“, ein Thema in einer Zeile | Skill **make-reel** |
| Feedback zu einem Reel („Hook knackiger“, „Szene 3 kürzer“ …) | Skill **fix-reel** |

## Aufbau

```
projects/<name>/script.json   ← das Drehbuch (das schreibst du)
projects/<name>/audio/        ← Voiceover pro Szene (ElevenLabs, automatisch)
projects/<name>/out/reel.mp4  ← fertiges Reel
src/                          ← Pipeline (Node + Canvas + ffmpeg)
```

Befehle (immer aus dem Projektordner):

- `npm run check` – Setup prüfen
- `npm run preview -- <name>` – ein Standbild pro Szene nach `out/preview-XX.png` (schnell, zum Prüfen)
- `npm run make -- <name>` – Voiceover aufnehmen + Reel rendern
- `npm run make -- <name> --no-voice` – ohne Voiceover rendern

## Drehbuch-Format (`script.json`)

```json
{
  "title": "Kurzer Titel",
  "theme": { "accent": "#E0262B" },
  "scenes": [
    { "label": "hook", "type": "title", "headline": "Warum ist *X* so?", "stamp": "KURZ & LAUT", "voiceover": "…" },
    { "label": "fakt", "type": "stat", "headline": "…", "stat": { "value": 30, "suffix": "%", "caption": "…" }, "voiceover": "…" },
    { "label": "gründe", "type": "list", "headline": "…", "items": ["…", "…", "…"], "voiceover": "…" },
    { "label": "erklärung", "type": "text", "headline": "…", "body": "Ein bis zwei Sätze.", "voiceover": "…" }
  ]
}
```

- **Szenentypen:** `title` (Überschrift + roter Stempel), `stat` (hochzählende Zahl), `list` (2–4 nummerierte Karten), `text` (Überschrift + kurzer Text).
- `*Wort*` in `headline` wird rot und kursiv hervorgehoben, höchstens 1–2 Wörter pro Überschrift.
- Die Szenenlänge ergibt sich aus der Länge des Voiceovers. Mit `"duration": 3.5` lässt sie sich erzwingen.
- Optional: `"headlineSize": 80` für lange Überschriften und `"captions": false` auf oberster Ebene.
- Theme-Farben: `bg`, `ink`, `accent`, `muted`, `card`.

## Regeln für gute Reels

- **Hook in Szene 1:** eine Frage oder überraschende Aussage, höchstens 8 Wörter im Voiceover.
- 4–6 Szenen, insgesamt 20–40 Sekunden. Pro Szene ein Gedanke, Voiceover höchstens 25 Wörter.
- Überschrift ≠ Voiceover: Die Überschrift ist die Kurzfassung, das Voiceover erzählt.
- Zahlen ausschreiben im Voiceover („dreißig Prozent“), damit die Stimme sie richtig spricht.
- Letzte Szene: klarer Call-to-Action (Folgen, Kommentieren, Speichern).
- Fakten müssen stimmen. Bei Unsicherheit lieber vorsichtiger formulieren.
- Nach jedem Rendern **immer** `npm run preview` ausführen, die PNGs ansehen und Layoutfehler
  (Text über dem Rand, Überlappungen) selbst beheben, bevor du dem Nutzer Bescheid gibst.
