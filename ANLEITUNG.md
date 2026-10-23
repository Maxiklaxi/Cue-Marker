# Cue Marker – Anleitung (Deutsch)

UXP-Plugin für Premiere Pro (ab 26.2). Liest die Cue-Punkte aus WAV-Dateien, zum Beispiel die MARK-Punkte des Deity PR-4, und legt sie als Clip-Marker an den Projektclips an. Die WAV-Dateien werden nur gelesen, nie verändert.

Die englische README ist die Hauptdokumentation: [README.md](README.md).

## Hintergrund

Field-Recorder schreiben Marker in den `cue `-Chunk der WAV (Sample-Position, beim PR-4 ohne Namen). Premiere liest Marker aus Audiodateien nur aus XMP, nicht aus diesem Chunk. Deshalb fehlen sie nach dem Import. Das Plugin holt sie nach.

PR-4-Dateien sind RF64, nicht klassisches RIFF. Der Parser liest nur die Chunk-Köpfe und springt über die Audiodaten, deshalb dauert es auch bei großen Takes nur Millisekunden.

## Installation (Entwicklermodus)

1. Premiere: Einstellungen → Plugins → „Enable developer mode“, Premiere neu starten.
2. UXP Developer Tools → „Add Plugin“ → `manifest.json` aus diesem Ordner → „Load“.
3. Beim ersten Laden fragt UXP nach Zustimmung zum Dateizugriff (`fullAccess`), weil das Plugin WAV-Dateien außerhalb des Plugin-Ordners lesen muss.
4. Panel „Cue Marker“ erscheint (sonst: Fenster → UXP Plugins).

## Ablauf

1. Audioclips im Projektfenster markieren (Bins werden übersprungen, nicht durchsucht).
2. **Prüfen** (unten) liest die Cue-Punkte und zeigt pro Clip Anzahl und Positionen, ohne etwas zu ändern.
3. **Import** legt sie als Kommentar-Marker an. Pro Clip ein Undo-Schritt („Cue Marker: Clipname“). Zeilen mit gesetzten Markern werden grün.

Ergebnis pro Clip:
- rechts „n Cues“ (Prüfen) bzw. „n neu“ (Import), die Statusleiste unten fasst zusammen
- Zeiten als `mm:ss.mmm`, ein `*` markiert Positionen, an denen schon ein Marker lag
- „übersprungen“ mit Grund: Ordner, Sequenz, offline, keine WAV-Datei

## Einstellungen (⚙ oder Flyout-Menü ≡ des Panels)

- **Marker-Name** – Standard „Mark“, wird nummeriert („Mark 1“ …). Enthält die WAV Labels (`labl`), haben diese Vorrang.
- **Vorhandene Marker überspringen** – kein zweiter Marker innerhalb von 2 ms an derselben Stelle.
- **Dateiname im Kommentar** – Kommentar enthält Cue-Nummer, Zeit, Sample und Dateiname.
- **Debug-Protokoll** – zeigt Pfade, Lesevariante, Chunks und Fehlerdetails unter der Liste. Auch über das Listen-Symbol in der Werkzeugleiste. Bei Problemen einschalten und über das Kopieren-Symbol weitergeben. Das Protokoll ist immer englisch, damit Fehlerberichte für alle lesbar sind.
- **Sprache** – Auto (Systemsprache), English, Deutsch.

## Test ohne Premiere

`_test_cues.js` prüft nur den Parser:

    node _test_cues.js index.js "/Pfad/Aufnahme.wav"

Für die Referenzdatei `PR-4_T_7.wav` sind die Samples 871380, 1219572, 1308312, 1376856 hinterlegt.
