// Tests only the WAV parser from index.js with Node (no Premiere needed):
//   node _test_cues.js index.js datei1.wav [datei2.wav …]
const fs = require("fs");
const src = fs.readFileSync(process.argv[2], "utf8");
const a = src.indexOf("// ---------- WAV parser");
const b = src.indexOf("// ---------- File access");
const code = src.slice(a, b) + "\nmodule.exports = { parseWavCues };";
const m = new module.constructor(); m.paths = module.paths; m._compile(code, "wavpart.js");
const { parseWavCues } = m.exports;

const EXPECTED = { "PR-4_T_7.wav": [871380, 1219572, 1308312, 1376856] };
let fail = 0;

(async () => {
  for (const file of process.argv.slice(3)) {
    const st = fs.statSync(file);
    const fd = fs.openSync(file, "r");
    let reads = 0, bytes = 0;
    const readAt = async (offset, length) => {
      const buf = Buffer.alloc(length);
      const n = fs.readSync(fd, buf, 0, length, offset);
      reads++; bytes += n;
      return new DataView(buf.buffer, buf.byteOffset, n);
    };
    const r = await parseWavCues(readAt, st.size);
    fs.closeSync(fd);
    const name = file.split("/").pop();
    console.log(`${name}: ${r.format} ${r.sampleRate} Hz ${r.channels} ch · ${r.cues.length} Cues · ${reads} reads, ${bytes} bytes of ${st.size}`);
    for (const c of r.cues) console.log(`   #${c.id} Sample ${c.sample} → ${c.seconds.toFixed(3)} s${c.label ? " " + c.label : ""}`);
    if (EXPECTED[name]) {
      const got = r.cues.map((c) => c.sample).join(",");
      const want = EXPECTED[name].join(",");
      if (got !== want) { fail++; console.log(`   EXPECTED ${want}, GOT ${got}`); }
      else console.log("   ✓ matches expectation");
    }
  }
  console.log(fail ? `FAILED: ${fail}` : "OK");
  process.exit(fail ? 1 : 0);
})();
