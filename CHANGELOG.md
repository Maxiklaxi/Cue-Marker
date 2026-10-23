# Changelog

## 1.0.0 – 2026-10-23

- First release.
- Reads `cue ` chunks from RIFF, RF64 and BW64 WAV files; uses `labl`/`note` entries when present.
- Check mode (read-only) and import mode (clip markers, one undo step per clip).
- Skips positions that already carry a marker.
- English and German UI.
