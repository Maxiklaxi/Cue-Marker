#!/bin/sh
# Builds the installable .ccx from the plugin files only (no .git, docs or tests).
# A .ccx is a plain zip with manifest.json at its root; Creative Cloud installs it
# on double-click. Usage: ./build-ccx.sh  → dist/Cue-Marker-<version>.ccx
set -e
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
OUT="dist/Cue-Marker-$VERSION.ccx"
rm -f "$OUT"
zip -X -q "$OUT" manifest.json index.html index.js styles.css LICENSE
echo "built $OUT"
unzip -l "$OUT"
