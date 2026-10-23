/*
 * Cue Marker – UXP plugin for Adobe Premiere Pro (26.2+)
 *
 * Reads cue points from WAV files (RIFF / RF64 / BW64 "cue " chunk, as written by
 * field recorders such as the Deity PR-4) and adds them as clip markers to the
 * selected project items. WAV files are only read, never modified.
 *
 * Log lines are always English so bug reports are readable for everyone.
 */

const ppro = require("premierepro");
const fs = require("fs");
const { localFileSystem, formats } = require("uxp").storage;

// ---------- Strings ----------
const STRINGS = {
  en: {
    "settings": "Settings",
    "empty": "Select audio clips in the Project panel, then press Check or Import.",
    "btn.preview": "Check",
    "btn.run": "Import",
    "btn.copy": "Copy log",
    "btn.copied": "Log copied",
    "btn.copyFailed": "Copy failed",
    "btn.clear": "Clear log",
    "sec.markers": "Markers",
    "sec.panel": "Panel",
    "opt.prefix": "Marker name",
    "opt.prefix.hint": "Numbered automatically (“Mark 1”, “Mark 2” …). Labels stored in the WAV take precedence.",
    "opt.color": "Marker color",
    "opt.color.hint": "“Default” keeps Premiere's standard marker color.",
    "color.default": "Default",
    "color.GREEN": "Green", "color.RED": "Red", "color.MAGENTA": "Purple", "color.ORANGE": "Orange",
    "color.YELLOW": "Yellow", "color.BLUE": "Blue", "color.CYAN": "Cyan",
    "opt.skipDup": "Skip existing markers",
    "opt.skipDup.hint": "No second marker where the clip already has one.",
    "opt.fileComment": "File name in comment",
    "opt.fileComment.hint": "Cue number, time, sample position and file name go into the marker comment.",
    "opt.debug": "Debug log",
    "opt.debug.hint": "Paths, read method, chunks and error details. Always in English.",
    "opt.lang": "Language",
    "opt.lang.hint": "“Auto” follows the system language.",
    "lang.auto": "Auto",
    "footer.version": "Version",
    "clips": (n) => `${n} clip${n === 1 ? "" : "s"}`,
    "status.idle": "Select audio clips in the Project panel",
    "status.reading": "Reading selection …",
    "status.importing": "Importing …",
    "status.nothingSelected": "Nothing selected in the Project panel",
    "err.noProject": "No project open.",
    "skip.folder": "bin",
    "skip.sequence": "sequence",
    "skip.notMedia": "not a media clip",
    "skip.offline": "offline",
    "skip.noPath": "no media path",
    "skip.pathError": "media path not readable",
    "skip.notWav": "not a WAV file",
    "chip.skipped": "skipped",
    "chip.error": "error",
    "chip.noCues": "no cues",
    "chip.cues": (n) => `${n} cue${n === 1 ? "" : "s"}`,
    "chip.new": (n) => `${n} new`,
    "sub.format": (rate, ch) => `${rate} Hz · ${ch} ch`,
    "sub.existing": (n) => `${n} already present`,
    "err.markersUnreachable": "Clip markers not accessible.",
    "err.transaction": "Premiere rejected the transaction.",
    "summary.dry": (files, n, dup, err) => `${files} file${files === 1 ? "" : "s"}: ${n} marker${n === 1 ? "" : "s"} to add` + (dup ? `, ${dup} present` : "") + (err ? `, ${err} error${err === 1 ? "" : "s"}` : ""),
    "summary.run": (files, n, dup, err) => `${n} marker${n === 1 ? "" : "s"} added to ${files} clip${files === 1 ? "" : "s"}` + (dup ? `, ${dup} present` : "") + (err ? `, ${err} error${err === 1 ? "" : "s"}` : ""),
    "error": "Error",
  },
  de: {
    "settings": "Einstellungen",
    "empty": "Audioclips im Projektfenster auswählen, dann „Prüfen“ oder „Import“ drücken.",
    "btn.preview": "Prüfen",
    "btn.run": "Import",
    "btn.copy": "Protokoll kopieren",
    "btn.copied": "Protokoll kopiert",
    "btn.copyFailed": "Kopieren fehlgeschlagen",
    "btn.clear": "Protokoll leeren",
    "sec.markers": "Marker",
    "sec.panel": "Panel",
    "opt.prefix": "Marker-Name",
    "opt.prefix.hint": "Wird fortlaufend nummeriert („Mark 1“, „Mark 2“ …). In der WAV gespeicherte Labels haben Vorrang.",
    "opt.color": "Marker-Farbe",
    "opt.color.hint": "„Standard“ behält Premieres Vorgabefarbe.",
    "color.default": "Standard",
    "color.GREEN": "Grün", "color.RED": "Rot", "color.MAGENTA": "Lila", "color.ORANGE": "Orange",
    "color.YELLOW": "Gelb", "color.BLUE": "Blau", "color.CYAN": "Cyan",
    "opt.skipDup": "Vorhandene Marker überspringen",
    "opt.skipDup.hint": "Kein zweiter Marker, wo der Clip schon einen hat.",
    "opt.fileComment": "Dateiname im Kommentar",
    "opt.fileComment.hint": "Cue-Nummer, Zeit, Sample-Position und Dateiname kommen in den Marker-Kommentar.",
    "opt.debug": "Debug-Protokoll",
    "opt.debug.hint": "Pfade, Lesevariante, Chunks und Fehlerdetails. Immer auf Englisch.",
    "opt.lang": "Sprache",
    "opt.lang.hint": "„Auto“ folgt der Systemsprache.",
    "lang.auto": "Auto",
    "footer.version": "Version",
    "clips": (n) => `${n} Clip${n === 1 ? "" : "s"}`,
    "status.idle": "Audioclips im Projektfenster auswählen",
    "status.reading": "Lese Auswahl …",
    "status.importing": "Importiere …",
    "status.nothingSelected": "Nichts im Projektfenster ausgewählt",
    "err.noProject": "Kein Projekt geöffnet.",
    "skip.folder": "Ordner",
    "skip.sequence": "Sequenz",
    "skip.notMedia": "kein Medienclip",
    "skip.offline": "offline",
    "skip.noPath": "kein Medienpfad",
    "skip.pathError": "Medienpfad nicht lesbar",
    "skip.notWav": "keine WAV-Datei",
    "chip.skipped": "übersprungen",
    "chip.error": "Fehler",
    "chip.noCues": "keine Cues",
    "chip.cues": (n) => `${n} Cue${n === 1 ? "" : "s"}`,
    "chip.new": (n) => `${n} neu`,
    "sub.format": (rate, ch) => `${rate} Hz · ${ch} Kanäle`,
    "sub.existing": (n) => `${n} bereits vorhanden`,
    "err.markersUnreachable": "Clip-Marker nicht erreichbar.",
    "err.transaction": "Premiere hat die Transaktion abgelehnt.",
    "summary.dry": (files, n, dup, err) => `${files} Datei${files === 1 ? "" : "en"}: ${n} Marker zu setzen` + (dup ? `, ${dup} vorhanden` : "") + (err ? `, ${err} Fehler` : ""),
    "summary.run": (files, n, dup, err) => `${n} Marker gesetzt in ${files} Clip${files === 1 ? "" : "s"}` + (dup ? `, ${dup} vorhanden` : "") + (err ? `, ${err} Fehler` : ""),
    "error": "Fehler",
  },
};

function systemLang() {
  try {
    const l = (navigator.language || (navigator.languages && navigator.languages[0]) || "en").toLowerCase();
    return l.startsWith("de") ? "de" : "en";
  } catch (_) { return "en"; }
}

function t(key, ...args) {
  const lang = settings.lang === "auto" ? systemLang() : settings.lang;
  const v = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
}

function applyLanguage() {
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.getAttribute("data-i18n"));
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.getAttribute("data-i18n-title"));
  for (const b of document.querySelectorAll("#langRow .seg-btn")) b.classList.toggle("active", b.getAttribute("data-lang") === settings.lang);
  for (const sw of document.querySelectorAll("#colorRow .swatch")) sw.title = t("color." + sw.getAttribute("data-color"));
  if (statusState === "idle") setStatus(t("status.idle"), "idle");
}

// ---------- Settings ----------
const VERSION = "1.0.0";
const DEFAULTS = { prefix: "Mark", skipDup: true, fileComment: true, debug: false, lang: "auto", color: "default" };
// Marker colors: names of ppro.Constants.MarkerColor (documented since 25.6; White is not
// documented and therefore not offered). The hex values only paint the swatches.
const COLORS = [
  { key: "default", hex: null },
  { key: "GREEN", hex: "#4ce890" },
  { key: "RED", hex: "#ff6b6b" },
  { key: "MAGENTA", hex: "#d070f0" },
  { key: "ORANGE", hex: "#f0a030" },
  { key: "YELLOW", hex: "#f0d040" },
  { key: "BLUE", hex: "#4a9eff" },
  { key: "CYAN", hex: "#40d8e0" },
];
let settings = { ...DEFAULTS };

function loadSettings() {
  try {
    const raw = localStorage.getItem("cue-marker.settings");
    if (raw) settings = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (_) {}
}
function saveSettings() {
  try { localStorage.setItem("cue-marker.settings", JSON.stringify(settings)); } catch (_) {}
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const logEl = $("log");
const logLines = [];
let busy = false;
let statusState = "idle";

const ICON_TICK = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 6.3 4.6 8.9 10 3.3" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CROSS = '<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

function log(msg, cls) {
  logLines.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

// Status strip at the bottom: idle | busy | done | warn | error
function setStatus(msg, state) {
  statusState = state || "idle";
  $("statusText").textContent = msg || "";
  $("statusStrip").className = "status-strip status-" + statusState;
}

// Called by run(): "" while working, "ok" when done, "warn" / "err" otherwise
function summary(msg, cls) {
  setStatus(msg, cls === "ok" ? "done" : cls === "warn" ? "warn" : cls === "err" ? "error" : "busy");
}

function flashStatus(msg) {
  const prev = { msg: $("statusText").textContent, state: statusState };
  setStatus(msg, "done");
  setTimeout(() => setStatus(prev.msg, prev.state), 1800);
}

function paintToggle(el, on) {
  el.classList.toggle("on", on);
  el.classList.toggle("off", !on);
  el.innerHTML = on ? ICON_TICK : ICON_CROSS;
}

function buildSwatches() {
  const rowEl = $("colorRow");
  rowEl.innerHTML = "";
  for (const c of COLORS) {
    const sw = document.createElement("div");
    sw.className = "swatch" + (c.hex ? "" : " none");
    sw.setAttribute("data-color", c.key);
    if (c.hex) sw.style.background = c.hex;
    else sw.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.2 9.8 9.8 2.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    sw.addEventListener("click", () => { settings.color = c.key; saveSettings(); applySettings(); });
    rowEl.appendChild(sw);
  }
}

function applySettings() {
  $("optPrefix").value = settings.prefix;
  for (const sw of document.querySelectorAll("#colorRow .swatch")) sw.classList.toggle("active", sw.getAttribute("data-color") === settings.color);
  paintToggle($("optSkipDup"), settings.skipDup);
  paintToggle($("optFileComment"), settings.fileComment);
  paintToggle($("optDebug"), settings.debug);
  $("btnLog").classList.toggle("on", settings.debug);
  $("logWrap").classList.toggle("visible", settings.debug);
  $("ver").textContent = VERSION;
  applyLanguage();
}

function showView(name) {
  $("viewMain").classList.toggle("active", name === "main");
  $("viewSettings").classList.toggle("active", name === "settings");
}

function setBusy(b) {
  busy = b;
  $("btnPreview").classList.toggle("btn-disabled", b);
  $("btnRun").classList.toggle("btn-disabled", b);
}

async function guarded(fn) {
  if (busy) return;
  setBusy(true);
  try {
    await fn();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    log("ERROR: " + msg, "err");
    summary(t("error") + ": " + msg, "err");
    console.error(e);
  } finally {
    setBusy(false);
  }
}

$("btnPreview").addEventListener("click", () => guarded(() => run(true)));
$("btnRun").addEventListener("click", () => guarded(() => run(false)));
$("btnSettings").addEventListener("click", () => showView("settings"));
$("btnBack").addEventListener("click", () => showView("main"));
$("btnLog").addEventListener("click", () => { settings.debug = !settings.debug; saveSettings(); applySettings(); });
$("optPrefix").addEventListener("change", (e) => {
  settings.prefix = e.target.value.trim() || DEFAULTS.prefix;
  saveSettings(); applySettings();
});
for (const row of document.querySelectorAll(".setting-row[data-opt]")) {
  const key = row.getAttribute("data-opt");
  row.addEventListener("click", () => { settings[key] = !settings[key]; saveSettings(); applySettings(); });
}
for (const b of document.querySelectorAll("#langRow .seg-btn")) {
  b.addEventListener("click", (e) => { e.stopPropagation(); settings.lang = b.getAttribute("data-lang"); saveSettings(); applySettings(); });
}
$("btnClear").addEventListener("click", () => { logEl.innerHTML = ""; logLines.length = 0; });
$("btnCopy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.setContent({ "text/plain": logLines.join("\n") });
    flashStatus(t("btn.copied"));
  } catch (e) {
    flashStatus(t("btn.copyFailed"));
  }
});

// Panel flyout menu (the ≡ menu in the panel tab), like other UXP panels
try {
  require("uxp").entrypoints.setup({
    panels: {
      cueMarkerPanel: {
        show() {}, hide() {}, destroy() {},
        menuItems: [
          { id: "settings", label: "Settings" },
          { id: "debug", label: "Debug Log" },
          { id: "sep", label: "-" },
          { id: "made-by", label: "made by Mees-Film", enabled: false },
        ],
        invokeMenu(id) {
          if (id === "settings") showView("settings");
          if (id === "debug") { settings.debug = !settings.debug; saveSettings(); applySettings(); }
        },
      },
    },
  });
} catch (e) {
  console.warn("entrypoints.setup failed:", e);
}

buildSwatches();
loadSettings();
applySettings();

// ---------- Result list ----------
function fmtTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w) => String(n).padStart(w, "0");
  return (h ? p(h, 2) + ":" : "") + `${p(m, 2)}:${p(s, 2)}.${p(r, 3)}`;
}

// rows: { name, chip, chipCls: ok|warn|err|accent|undefined, sub, times[] }
function renderList(rows) {
  const list = $("list");
  list.innerHTML = "";
  $("empty").style.display = rows.length ? "none" : "";
  $("listCount").textContent = rows.length ? t("clips", rows.length) : "";
  for (const r of rows) {
    const row = document.createElement("div");
    row.className = "row " + (r.chipCls || "dim");
    const head = document.createElement("div");
    head.className = "row-head";
    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = r.name;
    const chip = document.createElement("span");
    chip.className = "row-chip";
    chip.textContent = r.chip;
    head.appendChild(name);
    head.appendChild(chip);
    row.appendChild(head);
    if (r.sub) {
      const sub = document.createElement("div");
      sub.className = "row-sub";
      sub.textContent = r.sub;
      row.appendChild(sub);
    }
    if (r.times && r.times.length) {
      const el = document.createElement("div");
      el.className = "row-times";
      el.textContent = r.times.join("  ·  ");
      row.appendChild(el);
    }
    list.appendChild(row);
  }
}

// ---------- WAV parser (RIFF + RF64/BW64) ----------
// Works on a reader readAt(offset, length) → Promise<DataView>, so only the chunk
// headers and the small metadata chunks are read. Recorders usually write "cue "
// after the data chunk, which can be hundreds of MB for long takes.
const MAX_META_CHUNK = 4 * 1024 * 1024;

function tag4(dv, o) {
  return String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
}

function readCString(dv, start, end) {
  let s = "";
  for (let k = start; k < end && k < dv.byteLength; k++) {
    const c = dv.getUint8(k);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s;
}

async function parseWavCues(readAt, fileSize) {
  const head = await readAt(0, 12);
  const riff = tag4(head, 0);
  if ((riff !== "RIFF" && riff !== "RF64" && riff !== "BW64") || tag4(head, 8) !== "WAVE") {
    throw new Error("Not a RIFF/RF64 WAVE file.");
  }
  let pos = 12;
  let sampleRate = null, channels = null, ds64Data = null;
  const cues = [], labels = {}, notes = {};
  const chunks = [];
  while (pos + 8 <= fileSize) {
    const h = await readAt(pos, 8);
    if (h.byteLength < 8) break;
    const id = tag4(h, 0);
    let size = h.getUint32(4, true);
    const body = pos + 8;
    if (id === "ds64") {
      const b = await readAt(body, Math.min(size, 28));
      ds64Data = Number(b.getBigUint64(8, true)); // dataSize
    } else if (id === "data" && size === 0xffffffff) {
      if (ds64Data === null) throw new Error("RF64 file without ds64 chunk.");
      size = ds64Data;
    } else if (id === "fmt ") {
      const b = await readAt(body, Math.min(size, 16));
      channels = b.getUint16(2, true);
      sampleRate = b.getUint32(4, true);
    } else if (id === "cue ") {
      const b = await readAt(body, Math.min(size, MAX_META_CHUNK));
      const n = b.getUint32(0, true);
      for (let i = 0; i < n && 4 + i * 24 + 24 <= b.byteLength; i++) {
        const o = 4 + i * 24;
        cues.push({ id: b.getUint32(o, true), sample: b.getUint32(o + 20, true) }); // dwSampleOffset
      }
    } else if (id === "LIST" && size <= MAX_META_CHUNK) {
      const b = await readAt(body, size);
      if (b.byteLength >= 4 && tag4(b, 0) === "adtl") {
        let p = 4;
        while (p + 8 <= b.byteLength) {
          const sid = tag4(b, p), ssize = b.getUint32(p + 4, true);
          if ((sid === "labl" || sid === "note") && ssize >= 4) {
            const cueId = b.getUint32(p + 8, true);
            const text = readCString(b, p + 12, p + 8 + ssize);
            if (sid === "labl") labels[cueId] = text; else notes[cueId] = text;
          }
          p += 8 + ssize + (ssize & 1);
        }
      }
    }
    chunks.push(`${id.trim()}:${size}`);
    pos = body + size + (size & 1);
  }
  if (!sampleRate) throw new Error("fmt chunk missing.");
  cues.sort((a, b) => a.sample - b.sample);
  return {
    format: riff, sampleRate, channels, chunks,
    cues: cues.map((c) => ({
      id: c.id, sample: c.sample, seconds: c.sample / sampleRate,
      label: labels[c.id] || "", note: notes[c.id] || "",
    })),
  };
}

// ---------- File access (UXP) ----------
// Order: fs.open/fs.read with position (cheap) → fs.readFile (whole file)
// → localFileSystem entry. The debug log shows which one Premiere accepted.
function pathVariants(nativePath) {
  const v = [nativePath];
  if (!/^file:/i.test(nativePath)) v.push("file://" + encodeURI(nativePath));
  return v;
}

async function openReader(nativePath) {
  const errors = [];

  for (const p of pathVariants(nativePath)) {
    let fd = null;
    try {
      fd = await fs.open(p, "r");
      const st = await fs.lstat(p).catch(() => null);
      const size = st && typeof st.size === "number" ? st.size : null;
      const readAt = async (offset, length) => {
        const ab = new ArrayBuffer(length);
        const n = await fs.read(fd, ab, 0, length, offset);
        const got = typeof n === "number" ? n : (n && n.bytesRead) || length;
        return new DataView(ab, 0, got);
      };
      const probe = await readAt(0, 12);
      if (probe.byteLength < 12) throw new Error("probe read returned too little data");
      log(`read (positioned): ${p}`, "dim");
      return {
        readAt,
        size: size ?? Number.MAX_SAFE_INTEGER,
        close: async () => { try { await fs.close(fd); } catch (_) {} },
      };
    } catch (e) {
      errors.push(`open(${p}): ${e.message || e}`);
      if (fd !== null) { try { await fs.close(fd); } catch (_) {} }
    }
  }

  for (const p of pathVariants(nativePath)) {
    try {
      const buf = await fs.readFile(p);
      const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      log(`read (fs.readFile): ${p}`, "dim");
      return wholeReader(ab);
    } catch (e) {
      errors.push(`readFile(${p}): ${e.message || e}`);
    }
  }

  for (const p of pathVariants(nativePath)) {
    try {
      const entry = await localFileSystem.getEntryWithUrl(p);
      const ab = await entry.read({ format: formats.binary });
      log(`read (entry): ${p}`, "dim");
      return wholeReader(ab);
    } catch (e) {
      errors.push(`entry(${p}): ${e.message || e}`);
    }
  }

  throw new Error("File not readable. " + errors.join(" | "));
}

function wholeReader(ab) {
  return {
    size: ab.byteLength,
    readAt: async (offset, length) => new DataView(ab, offset, Math.max(0, Math.min(length, ab.byteLength - offset))),
    close: async () => {},
  };
}

async function readCues(nativePath) {
  const r = await openReader(nativePath);
  try {
    return await parseWavCues(r.readAt, r.size);
  } finally {
    await r.close();
  }
}

// ---------- Premiere ----------
const MEDIA = (ppro.Constants && ppro.Constants.ContentType && ppro.Constants.ContentType.MEDIA) ?? undefined;
const DUP_TOLERANCE = 0.002; // seconds

async function selectedClips(project) {
  const sel = await ppro.ProjectUtils.getSelection(project);
  const items = sel ? await sel.getItems() : [];
  const out = [];
  for (const item of items) {
    const name = item.name || "?";
    const clip = ppro.ClipProjectItem.cast(item);
    if (!clip) { out.push({ name, skip: "skip.folder" }); continue; }
    try {
      if (await clip.isSequence()) { out.push({ name, skip: "skip.sequence" }); continue; }
    } catch (_) {}
    try {
      if (MEDIA !== undefined && (await clip.getContentType()) !== MEDIA) { out.push({ name, skip: "skip.notMedia" }); continue; }
    } catch (_) {}
    try {
      if (await clip.isOffline()) { out.push({ name, skip: "skip.offline" }); continue; }
    } catch (_) {}
    let path = "";
    try { path = await clip.getMediaFilePath(); } catch (e) { out.push({ name, skip: "skip.pathError", detail: e.message || String(e) }); continue; }
    if (!path) { out.push({ name, skip: "skip.noPath" }); continue; }
    if (!/\.(wav|wave|bwf|rf64)$/i.test(path)) { out.push({ name, skip: "skip.notWav" }); continue; }
    out.push({ name, clip, path });
  }
  return out;
}

function markerColorIndex() {
  if (!settings.color || settings.color === "default") return null;
  const mc = ppro.Constants && ppro.Constants.MarkerColor;
  const v = mc ? mc[settings.color] : undefined;
  return typeof v === "number" ? v : null;
}

// Second transaction after the add: the add action does not hand back the marker,
// so the new markers are looked up by time and name and then colored.
async function colorizeMarkers(project, clip, clipName, fresh, colorIndex) {
  const markers = await ppro.Markers.getMarkers(clip);
  if (!markers) return 0;
  const targets = [];
  for (const m of markers.getMarkers()) {
    let start, name;
    try { start = m.getStart(); name = m.getName(); } catch (_) { continue; }
    const sec = typeof start.seconds === "number" ? start.seconds : Number(start.ticks) / 254016000000;
    if (fresh.some((p) => p.name === name && Math.abs(p.seconds - sec) <= DUP_TOLERANCE)) targets.push(m);
  }
  if (!targets.length) return 0;
  let ok = false;
  project.lockedAccess(() => {
    ok = project.executeTransaction((ca) => {
      for (const m of targets) ca.addAction(m.createSetColorByIndexAction(colorIndex));
    }, `Cue Marker color: ${clipName}`);
  });
  return ok ? targets.length : 0;
}

function existingMarkerTimes(markers) {
  const times = [];
  try {
    for (const m of markers.getMarkers()) {
      const st = m.getStart();
      const s = typeof st.seconds === "number" ? st.seconds : Number(st.ticks) / 254016000000;
      times.push(s);
    }
  } catch (e) {
    log("existing markers not readable: " + (e.message || e), "warn");
  }
  return times;
}

async function run(dry) {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error(t("err.noProject"));
  log(`— ${dry ? "check" : "import"} —`, "head");
  summary(t(dry ? "status.reading" : "status.importing"));
  renderList([]);

  const clips = await selectedClips(project);
  if (!clips.length) {
    summary(t("status.nothingSelected"), "warn");
    return;
  }

  const rows = [];
  let totalNew = 0, totalDup = 0, totalFiles = 0, totalErr = 0;

  for (const c of clips) {
    if (c.skip) {
      log(`skipped "${c.name}": ${c.skip}${c.detail ? " – " + c.detail : ""}`, "dim");
      rows.push({ name: c.name, chip: t("chip.skipped"), sub: t(c.skip) + (c.detail ? " – " + c.detail : "") });
      continue;
    }
    log(`"${c.name}" → ${c.path}`, "dim");
    let info;
    try {
      info = await readCues(c.path);
    } catch (e) {
      totalErr++;
      log(`error for "${c.name}": ${e.message || e}`, "err");
      rows.push({ name: c.name, chip: t("chip.error"), chipCls: "err", sub: e.message || String(e) });
      continue;
    }
    totalFiles++;
    log(`${info.format} · ${info.sampleRate} Hz · ${info.channels} ch · chunks: ${info.chunks.join(" ")}`, "dim");
    const fmt = t("sub.format", info.sampleRate, info.channels);
    if (!info.cues.length) {
      rows.push({ name: c.name, chip: t("chip.noCues"), sub: fmt });
      continue;
    }

    const markers = await ppro.Markers.getMarkers(c.clip);
    if (!markers) {
      totalErr++;
      rows.push({ name: c.name, chip: t("chip.error"), chipCls: "err", sub: t("err.markersUnreachable") });
      continue;
    }
    const existing = settings.skipDup ? existingMarkerTimes(markers) : [];
    const plan = info.cues.map((cue, i) => ({
      ...cue,
      index: i + 1,
      dup: existing.some((x) => Math.abs(x - cue.seconds) <= DUP_TOLERANCE),
    }));
    for (const p of plan) p.name = p.label || `${settings.prefix} ${p.index}`;
    const fresh = plan.filter((p) => !p.dup);
    const dups = plan.length - fresh.length;
    for (const p of plan) log(`  cue ${p.index}: ${fmtTime(p.seconds)} (sample ${p.sample})${p.dup ? " – exists" : ""}${p.label ? " – " + p.label : ""}`);

    let added = 0;
    if (!dry && fresh.length) {
      let ok = false;
      let err = null;
      try {
        project.lockedAccess(() => {
          ok = project.executeTransaction((ca) => {
            for (const p of fresh) {
              const name = p.name;
              const parts = [];
              if (p.note) parts.push(p.note);
              if (settings.fileComment) parts.push(`Cue ${p.index} · ${fmtTime(p.seconds)} · sample ${p.sample} · ${baseName(c.path)}`);
              ca.addAction(markers.createAddMarkerAction(
                name,
                ppro.Marker.MARKER_TYPE_COMMENT,
                ppro.TickTime.createWithSeconds(p.seconds),
                ppro.TickTime.TIME_ZERO,
                parts.join(" · ")
              ));
            }
          }, `Cue Marker: ${c.name}`);
        });
      } catch (e) { err = e; }
      if (err || !ok) {
        totalErr++;
        const msg = err ? (err.message || String(err)) : t("err.transaction");
        log(`adding markers failed for "${c.name}": ${msg}`, "err");
        rows.push({ name: c.name, chip: t("chip.error"), chipCls: "err", sub: msg, times: plan.map((p) => fmtTime(p.seconds)) });
        continue;
      }
      added = fresh.length;
      log(`${added} marker(s) added to "${c.name}"`, "ok");
      const colorIndex = markerColorIndex();
      if (colorIndex !== null) {
        try {
          const n = await colorizeMarkers(project, c.clip, c.name, fresh, colorIndex);
          log(`color ${settings.color} (index ${colorIndex}) set on ${n} of ${added} marker(s)`, n === added ? "dim" : "warn");
        } catch (e) {
          log(`setting color failed for "${c.name}": ${e.message || e}`, "warn");
        }
      } else if (settings.color !== "default") {
        log(`color ${settings.color} unknown in this Premiere version – markers keep the default color`, "warn");
      }
    }

    totalNew += dry ? fresh.length : added;
    totalDup += dups;
    rows.push({
      name: c.name,
      chip: dry ? t("chip.cues", plan.length) : t("chip.new", added),
      chipCls: dry ? "accent" : (added ? "ok" : "warn"),
      sub: fmt + (dups ? " · " + t("sub.existing", dups) : ""),
      times: plan.map((p) => fmtTime(p.seconds) + (p.dup ? "*" : "")),
    });
  }

  renderList(rows);
  summary(t(dry ? "summary.dry" : "summary.run", totalFiles, totalNew, totalDup, totalErr), totalErr ? "warn" : "ok");
}

function baseName(p) {
  return String(p).split(/[\\/]/).pop();
}
