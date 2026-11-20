# Snow Rider 3D – Autopilot (Safari-Lesezeichen)

Ein Lesezeichen (Bookmarklet), das Snow Rider 3D selbst fahren lässt: Es liest das
Spielbild vor dem Schlitten aus, erkennt Hindernisse (alles, was nicht nach Schnee
aussieht) und lenkt mit simulierten Pfeiltasten in die freieste Spur.

## Dateien

| Datei | Inhalt |
|---|---|
| `bookmarklet.txt` | **Die Zeile, die du als Lesezeichen-Adresse einfügst** (beginnt mit `javascript:`) |
| `autopilot.js` | Lesbarer Quellcode |
| `build.js` | Erzeugt `bookmarklet.txt` aus `autopilot.js` (`npm i terser && node build.js`) |

## Einrichten in Safari

**iPhone / iPad**
1. Inhalt von `bookmarklet.txt` komplett kopieren.
2. Irgendeine Seite öffnen → Teilen-Symbol → *Lesezeichen hinzufügen* → Name z. B. „Autopilot“ → Sichern.
3. Lesezeichen-Liste öffnen → *Bearbeiten* → das neue Lesezeichen antippen → die Adresse löschen
   und den kopierten Text einfügen → Fertig.

**Mac**
1. Ansicht → Favoritenleiste einblenden, eine beliebige Seite als Favorit sichern.
2. Rechtsklick auf den Favoriten → *Adresse bearbeiten* → Inhalt von `bookmarklet.txt` einfügen.

## Benutzen

1. Spielseite öffnen und das Spiel starten (Play).
2. Lesezeichen antippen.
   - Liegt das Spiel in einem Rahmen einer fremden Domain (sehr häufig), fragt das
     Lesezeichen, ob es die eigentliche Spielseite öffnen soll → **OK** → dort das Spiel
     starten und das Lesezeichen **noch einmal** antippen.
3. Rechts oben erscheint das Panel „🏂 Autopilot“. Der Bot fährt jetzt selbst.

Noch einmal antippen blendet das Panel aus/ein. Taste **P** schaltet den Autopiloten an/aus,
**✕** beendet ihn komplett.

## Einstellen (Debug-Anzeige hilft dabei)

- **Blauer Rahmen** = Suchbereich. Er sollte die Piste direkt *vor* dem Schlitten abdecken,
  aber nicht den Himmel. → *Suchbereich oben/unten*.
- **Balken** = erkannte Hindernisse pro Spur (grün = frei, rot = blockiert).
  - Schnee wird als Hindernis erkannt (alles voller Balken)? → *Dunkel-Schwelle* senken
    oder *Farb-Schwelle* erhöhen.
  - Hindernisse werden übersehen? → umgekehrt.
- **Schlittenbreite**: größer = hält mehr Abstand.
- **Mitte bevorzugen**: größer = lenkt weniger, kleiner = weicht weiter aus.
- Reagiert der Schlitten gar nicht, unter *Tasten* auf **A / D** umstellen.

Die Einstellungen werden pro Seite gespeichert.

## Grenzen

- Die Hinderniserkennung ist farbbasiert. Weiße Schneemänner werden nur über ihre
  dunklen/bunten Teile erkannt.
- Erscheint „Bild nicht lesbar“: Spiel neu laden und das Lesezeichen gleich danach antippen.
- Auf iPhone/iPad hängt es vom Spiel ab, ob es simulierte Tastendrücke annimmt.
  Auf dem Mac (Tastatur-Steuerung) funktioniert das zuverlässiger.
