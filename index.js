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
    "sec.report": "Sound report",
    "opt.report": "Import notes from the sound report",
    "opt.report.hint": "Reads the recorder's CSV next to the WAV files (Deity PR-4: “<folder>.csv”) and writes the Notes column to the clip.",
    "opt.reportField": "Target field",
    "opt.reportField.hint": "Project panel column that receives the note.",
    "field.logNote": "Log Note",
    "field.description": "Description",
    "field.comment": "Comment",
    "opt.reportScene": "Also import Scene",
    "opt.reportScene.hint": "Writes the Scene column of the report to the clip's Scene field.",
    "opt.reportOverwrite": "Overwrite existing text",
    "opt.reportOverwrite.hint": "Off: fields that already contain text are left alone.",
    "row.note": (n) => `Note: ${n}`,
    "row.scene": (s) => `Scene: ${s}`,
    "row.noteKept": "existing text kept",
    "row.noteWritten": "note written",
    "chip.note": "note",
    "summary.notes": (n) => `${n} note${n === 1 ? "" : "s"}`,
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
    "sec.about": "Updates & feedback",
    "opt.updates": "Updates",
    "update.hint.idle": "Checks GitHub once a day for a new release.",
    "update.hint.latest": (v) => `Up to date (v${v}).`,
    "update.hint.available": (v, cur) => `Version ${v} available – you have ${cur}.`,
    "update.hint.error": "GitHub not reachable.",
    "update.hint.none": "No release published yet.",
    "update.title": "New version on GitHub – click to open",
    "update.checking": "Checking for updates …",
    "btn.checkUpdates": "Check now",
    "opt.feedback": "Feedback",
    "opt.feedback.hint": "Bugs and feature requests are welcome as GitHub issues.",
    "btn.issue": "Report / request",
    "link.copied": "Link copied to clipboard",
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
    "sec.report": "Soundreport",
    "opt.report": "Notizen aus dem Soundreport übernehmen",
    "opt.report.hint": "Liest die CSV des Recorders neben den WAV-Dateien (Deity PR-4: „<Ordner>.csv“) und schreibt die Spalte Notes an den Clip.",
    "opt.reportField": "Zielfeld",
    "opt.reportField.hint": "Spalte im Projektfenster, die die Notiz erhält.",
    "field.logNote": "Protokollnotiz",
    "field.description": "Beschreibung",
    "field.comment": "Kommentar",
    "opt.reportScene": "Auch Szene übernehmen",
    "opt.reportScene.hint": "Schreibt die Spalte Scene des Reports ins Szene-Feld des Clips.",
    "opt.reportOverwrite": "Vorhandenen Text überschreiben",
    "opt.reportOverwrite.hint": "Aus: Felder, die schon Text enthalten, bleiben unverändert.",
    "row.note": (n) => `Notiz: ${n}`,
    "row.scene": (s) => `Szene: ${s}`,
    "row.noteKept": "vorhandener Text behalten",
    "row.noteWritten": "Notiz geschrieben",
    "chip.note": "Notiz",
    "summary.notes": (n) => `${n} Notiz${n === 1 ? "" : "en"}`,
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
    "sec.about": "Updates & Feedback",
    "opt.updates": "Updates",
    "update.hint.idle": "Prüft einmal täglich auf GitHub, ob es eine neue Version gibt.",
    "update.hint.latest": (v) => `Aktuell (v${v}).`,
    "update.hint.available": (v, cur) => `Version ${v} verfügbar – installiert ist ${cur}.`,
    "update.hint.error": "GitHub nicht erreichbar.",
    "update.hint.none": "Noch keine Version veröffentlicht.",
    "update.title": "Neue Version auf GitHub – klicken zum Öffnen",
    "update.checking": "Suche nach Updates …",
    "btn.checkUpdates": "Jetzt prüfen",
    "opt.feedback": "Feedback",
    "opt.feedback.hint": "Fehler und Feature-Wünsche gern als GitHub-Issue.",
    "btn.issue": "Melden / wünschen",
    "link.copied": "Link in die Zwischenablage kopiert",
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
  for (const b of document.querySelectorAll("#fieldRow .seg-btn")) b.classList.toggle("active", b.getAttribute("data-field") === settings.reportField);
  paintUpdateState();
  if (statusState === "idle") setStatus(t("status.idle"), "idle");
}

// ---------- Settings ----------
const VERSION = "1.1.0";
const REPO = "Maxiklaxi/Cue-Marker";
const REPO_URL = `https://github.com/${REPO}`;
const RELEASES_URL = `${REPO_URL}/releases/latest`;
const ISSUES_URL = `${REPO_URL}/issues/new/choose`;
const UPDATE_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULTS = { prefix: "Mark", skipDup: true, fileComment: true, debug: false, lang: "auto", color: "default",
  report: true, reportField: "logNote", reportScene: true, reportOverwrite: false };
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
  paintToggle($("optReport"), settings.report);
  paintToggle($("optReportScene"), settings.reportScene);
  paintToggle($("optReportOverwrite"), settings.reportOverwrite);
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
for (const b of document.querySelectorAll("#fieldRow .seg-btn")) {
  b.addEventListener("click", (e) => { e.stopPropagation(); settings.reportField = b.getAttribute("data-field"); saveSettings(); applySettings(); });
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
          { id: "check-updates", label: "Check for Updates" },
          { id: "github", label: "GitHub" },
          { id: "debug", label: "Debug Log" },
          { id: "sep", label: "-" },
          { id: "made-by", label: "made by Mees-Film", enabled: false },
        ],
        invokeMenu(id) {
          if (id === "settings") showView("settings");
          if (id === "check-updates") checkForUpdates(false);
          if (id === "github") openUrl(REPO_URL);
          if (id === "debug") { settings.debug = !settings.debug; saveSettings(); applySettings(); }
        },
      },
    },
  });
} catch (e) {
  console.warn("entrypoints.setup failed:", e);
}

// ---------- Links & update check ----------
// Same approach as other community UXP panels: ask the GitHub releases API for the
// latest tag, compare with VERSION, show a pill in the toolbar when newer.
// Silent check at most once a day; a manual check always runs.
let updateInfo = { state: "idle", latest: null }; // idle | checking | latest | available | error | none

function loadUpdateCache() {
  try {
    const raw = localStorage.getItem("cue-marker.update");
    if (raw) {
      const c = JSON.parse(raw);
      if (c.latest && isNewerVersion(c.latest, VERSION)) updateInfo = { state: "available", latest: c.latest };
      return c;
    }
  } catch (_) {}
  return {};
}

function saveUpdateCache(c) {
  try { localStorage.setItem("cue-marker.update", JSON.stringify(c)); } catch (_) {}
}

function isNewerVersion(a, b) {
  const pa = String(a).split(".").map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

function paintUpdateState() {
  const pill = $("btnUpdate");
  const hint = $("updateHint");
  const st = updateInfo.state;
  pill.style.display = st === "available" ? "" : "none";
  if (st === "available") $("updateLabel").textContent = "v" + updateInfo.latest;
  hint.textContent =
    st === "available" ? t("update.hint.available", updateInfo.latest, VERSION) :
    st === "latest" ? t("update.hint.latest", VERSION) :
    st === "error" ? t("update.hint.error") :
    st === "none" ? t("update.hint.none") :
    st === "checking" ? t("update.checking") :
    t("update.hint.idle");
}

async function checkForUpdates(silent) {
  const cache = loadUpdateCache();
  if (silent && cache.at && Date.now() - cache.at < UPDATE_INTERVAL_MS) { paintUpdateState(); return; }
  updateInfo.state = "checking";
  paintUpdateState();
  if (!silent) flashStatus(t("update.checking"));
  try {
    const r = await fetch(UPDATE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (r.status === 404) {
      updateInfo = { state: "none", latest: null };
      saveUpdateCache({ at: Date.now(), latest: null });
    } else {
      if (!r.ok) throw new Error("GitHub API " + r.status);
      const data = await r.json();
      if (!data || typeof data.tag_name !== "string" || (data.html_url && !data.html_url.includes(REPO))) throw new Error("unexpected response");
      const latest = data.tag_name.replace(/^v/i, "");
      if (!/^\d+\.\d+\.\d+/.test(latest)) throw new Error("no version tag");
      updateInfo = isNewerVersion(latest, VERSION) ? { state: "available", latest } : { state: "latest", latest };
      saveUpdateCache({ at: Date.now(), latest });
      log(`update check: latest v${latest}, installed v${VERSION}`, "dim");
    }
  } catch (e) {
    updateInfo = { state: "error", latest: updateInfo.latest };
    log("update check failed: " + (e.message || e), "dim");
  }
  paintUpdateState();
  if (!silent) {
    if (updateInfo.state === "available") flashStatus(t("update.hint.available", updateInfo.latest, VERSION));
    else if (updateInfo.state === "latest") flashStatus(t("update.hint.latest", VERSION));
    else if (updateInfo.state === "none") flashStatus(t("update.hint.none"));
    else flashStatus(t("update.hint.error"));
  }
}

async function openUrl(url) {
  try {
    await require("uxp").shell.openExternal(url);
  } catch (e) {
    // Fall back to the clipboard when the host refuses to open a browser
    try {
      await navigator.clipboard.setContent({ "text/plain": url });
      flashStatus(t("link.copied"));
    } catch (_) {
      log("could not open " + url + ": " + (e.message || e), "warn");
    }
  }
}

$("btnUpdate").addEventListener("click", () => openUrl(RELEASES_URL));
$("btnCheckUpdates").addEventListener("click", (e) => { e.stopPropagation(); checkForUpdates(false); });
$("btnGitHub").addEventListener("click", (e) => { e.stopPropagation(); openUrl(REPO_URL); });
$("btnIssue").addEventListener("click", (e) => { e.stopPropagation(); openUrl(ISSUES_URL); });

buildSwatches();
loadSettings();
applySettings();
setTimeout(() => checkForUpdates(true), 1500);

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

// ---------- Sound report (CSV next to the WAV files) ----------
// The Deity PR-4 writes "<folder>.csv" with a "SOUND REPORT" header and one row per
// take (File Name, Scene, Length, Start TC, …, Notes). Notes typed on the recorder
// ("Wild Track") live only there, not in the WAV. The parser is generic: any CSV
// whose header row has a "File Name" column works.
function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseSoundReport(text) {
  const lines = String(text).replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const headerIdx = lines.findIndex((l) => /^"?file ?name"?\s*,/i.test(l));
  if (headerIdx < 0) return null;
  const header = splitCsvLine(lines[headerIdx]).map((h) => h.toLowerCase());
  const col = (names) => header.findIndex((h) => names.includes(h));
  const iFile = col(["file name", "filename", "file"]);
  const iNotes = col(["notes", "note", "comment", "comments"]);
  const iScene = col(["scene"]);
  const iTc = col(["start tc", "start timecode", "timecode"]);
  if (iFile < 0) return null;
  const files = {};
  for (const line of lines.slice(headerIdx + 1)) {
    if (!line.trim()) continue;
    const f = splitCsvLine(line);
    const name = (f[iFile] || "").trim();
    if (!name) continue;
    files[name.toLowerCase()] = {
      file: name,
      notes: iNotes >= 0 ? (f[iNotes] || "").trim() : "",
      scene: iScene >= 0 ? (f[iScene] || "").trim() : "",
      startTc: iTc >= 0 ? (f[iTc] || "").trim() : "",
    };
  }
  const isSoundReport = /sound\s*report/i.test(lines.slice(0, headerIdx).join(" "));
  return { files, isSoundReport, count: Object.keys(files).length };
}

function folderOf(p) {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : p;
}

async function readTextFile(nativePath) {
  const errors = [];
  for (const p of pathVariants(nativePath)) {
    try { return await fs.readFile(p, "utf8"); } catch (e) { errors.push(`readFile(${p}): ${e.message || e}`); }
  }
  for (const p of pathVariants(nativePath)) {
    try {
      const entry = await localFileSystem.getEntryWithUrl(p);
      return await entry.read({ format: formats.utf8 });
    } catch (e) { errors.push(`entry(${p}): ${e.message || e}`); }
  }
  throw new Error(errors.join(" | "));
}

async function listFolder(folderPath) {
  const errors = [];
  for (const p of pathVariants(folderPath)) {
    try {
      const names = await fs.readdir(p);
      if (Array.isArray(names)) return names.map((n) => (typeof n === "string" ? n : n.name)).filter(Boolean);
    } catch (e) { errors.push(`readdir(${p}): ${e.message || e}`); }
  }
  for (const p of pathVariants(folderPath)) {
    try {
      const entry = await localFileSystem.getEntryWithUrl(p);
      const entries = await entry.getEntries();
      return entries.map((en) => en.name);
    } catch (e) { errors.push(`entries(${p}): ${e.message || e}`); }
  }
  throw new Error(errors.join(" | "));
}

const reportCache = new Map(); // folder → { report, path } | null

async function findSoundReport(folderPath) {
  if (reportCache.has(folderPath)) return reportCache.get(folderPath);
  let result = null;
  try {
    let names;
    try {
      names = await listFolder(folderPath);
    } catch (e) {
      // No listing: fall back to the PR-4 naming scheme "<folder name>.csv"
      log("folder listing failed, trying <folder>.csv: " + (e.message || e), "dim");
      names = [folderPath.split(/[\\/]/).pop() + ".csv"];
    }
    const csvs = names.filter((n) => /\.csv$/i.test(n));
    const sep = folderPath.includes("\\") && !folderPath.includes("/") ? "\\" : "/";
    for (const n of csvs) {
      const p = folderPath + sep + n;
      try {
        const rep = parseSoundReport(await readTextFile(p));
        if (rep && rep.count) {
          result = { report: rep, path: p };
          log(`sound report: ${p} (${rep.count} rows${rep.isSoundReport ? "" : ", no SOUND REPORT header"})`, "dim");
          if (rep.isSoundReport) break;
        }
      } catch (e) {
        log(`csv skipped ${p}: ${e.message || e}`, "dim");
      }
    }
  } catch (e) {
    log("sound report lookup failed: " + (e.message || e), "dim");
  }
  reportCache.set(folderPath, result);
  return result;
}

function reportEntryFor(found, nativePath) {
  if (!found) return null;
  const name = baseName(nativePath).toLowerCase();
  return found.report.files[name] || null;
}

// ---------- Project metadata (columns in the Project panel) ----------
const PPRO_MD_NS = "http://ns.adobe.com/premierePrivateProjectMetaData/1.0/";
const REPORT_FIELDS = {
  logNote: "Column.Intrinsic.LogNote",
  description: "Column.PropertyText.Description",
  comment: "Column.PropertyText.Comment",
};
const SCENE_FIELD = "Column.PropertyText.Scene";

// values: { "<Column id>": "text" }. Returns { written: [...ids], kept: [...ids] }.
// Existing text is kept unless settings.reportOverwrite is on or it already matches.
async function writeProjectMetadata(project, item, clipName, values) {
  const { XMPMeta } = require("uxp").xmp;
  const xmpStr = await ppro.Metadata.getProjectMetadata(item);
  const xmp = new XMPMeta(xmpStr || "");
  const written = [], kept = [];
  for (const [id, value] of Object.entries(values)) {
    if (!value) continue;
    let existing = "";
    try { if (xmp.doesPropertyExist(PPRO_MD_NS, id)) existing = String(xmp.getProperty(PPRO_MD_NS, id).value || ""); } catch (_) {}
    if (existing === value) continue;
    if (existing && !settings.reportOverwrite) { kept.push(id); continue; }
    xmp.setProperty(PPRO_MD_NS, id, value);
    written.push(id);
  }
  if (written.length) {
    const serialized = xmp.serialize();
    let ok = false;
    project.lockedAccess(() => {
      ok = project.executeTransaction((ca) => {
        ca.addAction(ppro.Metadata.createSetProjectMetadataAction(item, serialized, written));
      }, `Cue Marker notes: ${clipName}`);
    });
    if (!ok) throw new Error(t("err.transaction"));
  }
  return { written, kept };
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
    out.push({ name, clip, item, path });
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
  let totalNew = 0, totalDup = 0, totalFiles = 0, totalErr = 0, totalNotes = 0;
  reportCache.clear();

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

    // Sound report note for this file (Deity PR-4 CSV next to the WAV)
    let note = null; // { notes, scene, status }
    if (settings.report) {
      const entry = reportEntryFor(await findSoundReport(folderOf(c.path)), c.path);
      if (entry && (entry.notes || (settings.reportScene && entry.scene))) {
        note = { notes: entry.notes, scene: settings.reportScene ? entry.scene : "", status: "" };
        log(`  report: notes "${entry.notes}" scene "${entry.scene}"`, "dim");
        if (!dry) {
          const values = {};
          if (entry.notes) values[REPORT_FIELDS[settings.reportField] || REPORT_FIELDS.logNote] = entry.notes;
          if (settings.reportScene && entry.scene) values[SCENE_FIELD] = entry.scene;
          try {
            const r = await writeProjectMetadata(project, c.item, c.name, values);
            note.status = r.written.length ? "written" : (r.kept.length ? "kept" : "");
            if (r.written.length) totalNotes++;
            log(`  metadata: written ${r.written.join(", ") || "-"}; kept ${r.kept.join(", ") || "-"}`, r.kept.length ? "warn" : "dim");
          } catch (e) {
            note.status = "error";
            log(`  metadata failed for "${c.name}": ${e.message || e}`, "err");
          }
        }
      }
    }
    const noteLine = note ? [note.notes ? t("row.note", note.notes) : "", note.scene ? t("row.scene", note.scene) : "",
      note.status === "kept" ? t("row.noteKept") : note.status === "written" ? t("row.noteWritten") : note.status === "error" ? t("chip.error") : ""]
      .filter(Boolean).join(" · ") : "";
    const subWith = (base) => noteLine ? base + " · " + noteLine : base;

    if (!info.cues.length) {
      rows.push({ name: c.name, chip: note ? t("chip.note") : t("chip.noCues"), chipCls: note && note.status === "written" ? "ok" : undefined, sub: subWith(fmt) });
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
      sub: subWith(fmt + (dups ? " · " + t("sub.existing", dups) : "")),
      times: plan.map((p) => fmtTime(p.seconds) + (p.dup ? "*" : "")),
    });
  }

  renderList(rows);
  const base = t(dry ? "summary.dry" : "summary.run", totalFiles, totalNew, totalDup, totalErr);
  summary(totalNotes && !dry ? `${base}, ${t("summary.notes", totalNotes)}` : base, totalErr ? "warn" : "ok");
}

function baseName(p) {
  return String(p).split(/[\\/]/).pop();
}
