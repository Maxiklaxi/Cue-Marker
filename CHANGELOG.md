# Changelog

## 1.1.0 – 2026-10-23

- Sound report import: reads the recorder's CSV next to the WAV files (Deity PR-4 `<folder>.csv`) and writes the Notes column to the clip's Log Note (or Description / Comment) and the Scene column to the clip's Scene field. Visible as columns in the Project panel. Existing text is kept unless "Overwrite existing text" is on.
- Rows in the panel show the note; the summary counts written notes.

## 1.0.0 – 2026-10-23

- First release.
- Reads `cue ` chunks from RIFF, RF64 and BW64 WAV files; uses `labl`/`note` entries when present.
- Check mode (read-only) and import mode (clip markers, one undo step per clip).
- Skips positions that already carry a marker.
- Optional marker color.
- Update notice via the GitHub releases API, links to the repository and issue templates.
- English and German UI.
- Flat panel layout: tinted clip rows, status strip with Check/Import buttons, full-panel settings, flyout menu.
