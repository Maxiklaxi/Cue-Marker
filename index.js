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
    "step1.title": "Select clips in the Project panel",
    "step1.hint": "Select the audio clips in the Project panel. “Check” reads the cue points from the WAV files and lists them without changing anything. “Import markers” adds them as clip markers. The WAV files stay untouched.",
    "btn.preview": "Check",
    "btn.run": "Import markers",
    "section.result": "Result",
    "empty": "Nothing checked yet.",
    "btn.copy": "Copy log",
    "btn.copied": "Copied ✓",
    "btn.copyFailed": "Copy failed",
    "btn.clear": "Clear",
    "btn.back": "Back",
    "opt.prefix": "Marker name",
    "opt.prefix.hint": "Numbered automatically, e.g. “Mark 1”, “Mark 2”. Labels stored in the WAV take precedence.",
    "opt.skipDup": "Skip existing markers",
    "opt.skipDup.hint": "If the clip already has a marker at that position, no second one is added.",
    "opt.fileComment": "File name in comment",
    "opt.fileComment.hint": "Writes cue number, time, sample position and file name into the marker comment.",
    "opt.debug": "Show debug log",
    "opt.debug.hint": "Shows paths, read method, chunks and error details below the result.",
    "opt.lang": "Language",
    "opt.lang.hint": "“Auto” follows the system language.",
    "lang.auto": "Auto",
    "footer.version": "Version",
    "clips": (n) => `${n} clip${n === 1 ? "" : "s"}`,
    "err.noProject": "No project open.",
    "status.reading": "Reading selection …",
    "status.importing": "Importing …",
    "status.nothingSelected": "Nothing selected. Please select audio clips in the Project panel.",
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
    "summary.dry": (files, n, dup, err) => `${files} file${files === 1 ? "" : "s"} read: ${n} marker${n === 1 ? "" : "s"} would be added` + (dup ? `, ${dup} already present` : "") + (err ? `, ${err} error${err === 1 ? "" : "s"}` : "") + ".",
    "summary.run": (files, n, dup, err) => `${n} marker${n === 1 ? "" : "s"} added to ${files} clip${files === 1 ? "" : "s"}` + (dup ? `, ${dup} already present` : "") + (err ? `, ${err} error${err === 1 ? "" : "s"}` : "") + ".",
    "error": "Error",
  },
  de: {
    "settings": "Einstellungen",
    "step1.title": "Clips im Projektfenster markieren",
    "step1.hint": "Audioclips im Projektfenster auswählen. „Prüfen“ liest die Cue-Punkte aus den WAV-Dateien und zeigt sie an, ohne etwas zu ändern. „Marker importieren“ legt sie als Clip-Marker an. Die WAV-Dateien bleiben unverändert.",
    "btn.preview": "Prüfen",
    "btn.run": "Marker importieren",
    "section.result": "Ergebnis",
    "empty": "Noch nichts geprüft.",
    "btn.copy": "Protokoll kopieren",
    "btn.copied": "Kopiert ✓",
    "btn.copyFailed": "Kopieren fehlgeschlagen",
    "btn.clear": "Leeren",
    "btn.back": "Zurück",
    "opt.prefix": "Marker-Name",
    "opt.prefix.hint": "Wird fortlaufend nummeriert, z. B. „Mark 1“, „Mark 2“. In der WAV gespeicherte Labels haben Vorrang.",
    "opt.skipDup": "Vorhandene Marker überspringen",
    "opt.skipDup.hint": "Liegt an der Stelle schon ein Clip-Marker, wird kein zweiter gesetzt.",
    "opt.fileComment": "Dateiname im Kommentar",
    "opt.fileComment.hint": "Schreibt Cue-Nummer, Zeit, Sample-Position und Dateiname in den Marker-Kommentar.",
    "opt.debug": "Debug-Protokoll anzeigen",
    "opt.debug.hint": "Zeigt Pfade, Lesevariante, Chunks und Fehlerdetails unter dem Ergebnis.",
    "opt.lang": "Sprache",
    "opt.lang.hint": "„Auto“ folgt der Systemsprache.",
    "lang.auto": "Auto",
    "footer.version": "Version",
    "clips": (n) => `${n} Clip${n === 1 ? "" : "s"}`,
    "err.noProject": "Kein Projekt geöffnet.",
    "status.reading": "Lese Auswahl …",
    "status.importing": "Importiere …",
    "status.nothingSelected": "Nichts ausgewählt. Bitte Audioclips im Projektfenster markieren.",
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
    "summary.dry": (files, n, dup, err) => `${files} Datei${files === 1 ? "" : "en"} gelesen: ${n} Marker würden gesetzt` + (dup ? `, ${dup} bereits vorhanden` : "") + (err ? `, ${err} Fehler` : "") + ".",
    "summary.run": (files, n, dup, err) => `${n} Marker gesetzt in ${files} Clip${files === 1 ? "" : "s"}` + (dup ? `, ${dup} bereits vorhanden` : "") + (err ? `, ${err} Fehler` : "") + ".",
    "error": "Fehler",
  },
};

function systemLang() {
  try {
    const l = (navigator.language || navigator.languages?.[0] || "en").toLowerCase();
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
  for (const b of document.querySelectorAll("#langRow .btn")) b.classList.toggle("active", b.getAttribute("data-lang") === settings.lang);
}

// ---------- Settings ----------
const VERSION = "1.0.0";
const DEFAULTS = { prefix: "Mark", skipDup: true, fileComment: true, debug: false, lang: "auto" };
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

function log(msg, cls) {
  logLines.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  const line = document.createElement("div");
  if (cls) line.className = cls;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function summary(msg, cls) {
  const el = $("summary");
  el.textContent = msg || "";
  el.className = "status" + (msg ? " visible" : "") + (cls ? " " + cls : "");
}

function applySettings() {
  $("optPrefix").value = settings.prefix;
  $("optSkipDup").checked = settings.skipDup;
  $("optFileComment").checked = settings.fileComment;
  $("optDebug").checked = settings.debug;
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
  $("btnPreview").disabled = b;
  $("btnRun").disabled = b;
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
$("optPrefix").addEventListener("change", (e) => {
  settings.prefix = e.target.value.trim() || DEFAULTS.prefix;
  saveSettings(); applySettings();
});
$("optSkipDup").addEventListener("change", (e) => { settings.skipDup = e.target.checked; saveSettings(); });
$("optFileComment").addEventListener("change", (e) => { settings.fileComment = e.target.checked; saveSettings(); });
$("optDebug").addEventListener("change", (e) => { settings.debug = e.target.checked; saveSettings(); applySettings(); });
for (const b of document.querySelectorAll("#langRow .btn")) {
  b.addEventListener("click", () => { settings.lang = b.getAttribute("data-lang"); saveSettings(); applySettings(); });
}
$("btnClear").addEventListener("click", () => { logEl.innerHTML = ""; logLines.length = 0; });
$("btnCopy").addEventListener("click", async () => {
  const b = $("btnCopy");
  try {
    await navigator.clipboard.setContent({ "text/plain": logLines.join("\n") });
    b.textContent = t("btn.copied");
  } catch (e) {
    b.textContent = t("btn.copyFailed");
  }
  setTimeout(() => { b.textContent = t("btn.copy"); }, 2000);
});

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

function renderList(rows) {
  const list = $("list");
  list.innerHTML = "";
  $("empty").style.display = rows.length ? "none" : "";
  $("listCount").textContent = rows.length ? t("clips", rows.length) : "";
  for (const r of rows) {
    const item = document.createElement("div");
    item.className = "item";
    const head = document.createElement("div");
    head.className = "item-head";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = r.name;
    const chip = document.createElement("span");
    chip.className = "chip " + (r.chipCls || "");
    chip.textContent = r.chip;
    head.appendChild(name);
    head.appendChild(chip);
    item.appendChild(head);
    if (r.sub) {
      const sub = document.createElement("div");
      sub.className = "item-sub";
      sub.textContent = r.sub;
      item.appendChild(sub);
    }
    if (r.times && r.times.length) {
      const el = document.createElement("div");
      el.className = "item-times";
      el.textContent = r.times.join("  ·  ");
      item.appendChild(el);
    }
    list.appendChild(item);
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
              const name = p.label || `${settings.prefix} ${p.index}`;
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
