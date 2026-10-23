// Tests the sound-report CSV parser from index.js with Node (no Premiere needed):
//   node _test_report.js index.js /path/to/<folder>.csv
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("// ---------- Sound report");
const b = src.indexOf("function folderOf");
const m = new module.constructor(); m.paths = module.paths;
m._compile(src.slice(a, b) + "\nmodule.exports = { parseSoundReport };", "reportpart.js");
const { parseSoundReport } = m.exports;

const r = parseSoundReport(fs.readFileSync(process.argv[3], "utf8"));
if (!r) { console.log("no File Name header found"); process.exit(1); }
console.log(`${r.count} rows, SOUND REPORT header: ${r.isSoundReport}`);
for (const e of Object.values(r.files)) console.log(`  ${e.file}  scene="${e.scene}"  tc=${e.startTc}  notes="${e.notes}"`);
const t4 = r.files["pr-4_t_4.wav"];
if (t4) {
  const ok = t4.notes === "Wild Track" && t4.scene === "PR-4";
  console.log(ok ? "✓ PR-4_T_4: Wild Track / PR-4" : "✗ PR-4_T_4 mismatch");
  process.exit(ok ? 0 : 1);
}
