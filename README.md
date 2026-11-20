# 🎁 Geschenke-Gedächtnis

Merkt sich Geschenkideen für deine Liebsten und findet Wünsche automatisch in deinen Chats – **komplett lokal auf deinem Gerät**.

## Funktionen
- **Personen** mit Geburtstag und Chat-Spitznamen; Erinnerungs-Banner 30 Tage vor dem Geburtstag
- **Ideen** mit Status: Idee → Gekauft 🛍️ → Verschenkt ✓
- **Wünsche aus Chats finden**: erkennt Sätze wie „Ich wünsche mir…“, „Hätte so gern…“, „Den X will ich unbedingt“, „Mein X ist kaputt“, Shop-Links u. v. m.
  - WhatsApp-Export (.txt oder .zip, Android & iPhone)
  - Telegram-Export (JSON)
  - **Screenshots** vom Chat (Texterkennung direkt auf dem Gerät, helles & dunkles Design; eigene Nachrichten rechts werden übersprungen)
  - Eingefügter Text
  - Android: direkt aus WhatsApp per **Teilen → Geschenke** (wenn als App installiert)
- Vorschläge prüfen, anpassen und mit einem Tipp übernehmen
- Sicherung/Wiederherstellung als JSON, funktioniert offline

## Datenschutz
Keine Server, keine Konten, kein Tracking. Chats werden nur durchsucht, wenn du sie selbst auswählst und die Erlaubnis bestätigst. Gespeichert werden nur übernommene Ideen (im `localStorage` des Browsers).

> Warum kein automatisches Mitlesen aller Chats? WhatsApp, Signal & iMessage erlauben das keiner App – der Chat-Export ist der offizielle, sichere Weg.

## Drittanbieter
`vendor/tesseract/` enthält [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 und deutsche Sprachdaten (Apache-2.0), damit die Texterkennung offline und ohne fremde Server läuft.

## Starten
```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```
Fürs Handy: auf einen HTTPS-Host stellen (z. B. GitHub Pages) und dort „App installieren“ bzw. „Zum Home-Bildschirm“ wählen.

## Tests
```bash
node tests/detector.test.js
```
