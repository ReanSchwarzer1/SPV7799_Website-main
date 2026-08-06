/* ============================================================
   tools/verify-scenes.js — per-scene verification runner

   Builds every registered interlude in turn and records, for each:
     - whether it built at all
     - console errors and uncaught exceptions raised while it ran
     - frame time (median and 95th percentile) and fps
     - a screenshot

   This is the gate for every phase of the polish pipeline: run it
   before a change and after, and diff the report.

   Usage:
     npx electron . --remote-debugging-port=9444      (in one shell)
     node tools/verify-scenes.js                      (in another)

   Options:
     --port=9444        debugger port
     --settle=1500      ms to let a scene build before measuring
     --measure=2500     ms to measure frame time over
     --tier=high        force a quality tier first
     --post             enable post-processing before measuring
     --out=tools/verify-out
   ============================================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v === undefined ? true : v];
}));
const PORT = +(args.port || 9444);
const SETTLE = +(args.settle || 1500);
const MEASURE = +(args.measure || 2500);
const OUT = args.out || path.join("tools", "verify-out");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function targets() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}/json`, (res) => {
      let b = ""; res.on("data", (d) => (b += d));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
  });
}

(async function main() {
  let pages;
  try {
    pages = (await targets()).filter((t) => t.type === "page");
  } catch (e) {
    console.error(`Cannot reach the debugger on port ${PORT}.`);
    console.error(`Start the app first:  npx electron . --remote-debugging-port=${PORT}`);
    process.exit(2);
  }
  if (!pages.length) { console.error("No page target found."); process.exit(2); }

  fs.mkdirSync(OUT, { recursive: true });

  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  let id = 0; const pending = {};
  let errors = [];

  const send = (method, params) => new Promise((resolve) => {
    const i = ++id; pending[i] = resolve;
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errors.push("EXCEPTION " + (d.exception?.description || d.text || "").split("\n")[0]);
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push("console.error " +
        (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    }
  };

  const evaluate = async (expr) => {
    const r = await send("Runtime.evaluate",
      { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) {
      return { __error: r.result.exceptionDetails.text ||
                        r.result.exceptionDetails.exception?.description };
    }
    return r.result?.result?.value;
  };

  const screenshot = async (file) => {
    const r = await send("Page.captureScreenshot", { format: "png" });
    if (r.result?.data) fs.writeFileSync(file, Buffer.from(r.result.data, "base64"));
  };

  await new Promise((r) => (ws.onopen = r));
  await send("Runtime.enable");
  await send("Page.enable");

  if (args.tier) await evaluate(`window.Interludes.quality(${JSON.stringify(args.tier)})`);
  if (args.post) await evaluate(`window.Interludes.setPost(true)`);

  const settings = await evaluate(`JSON.stringify(window.Interludes.quality())`);
  console.log("quality:", settings, args.post ? "| post forced ON" : "");

  // the registry is private, so drive from the known id list
  const IDS = ["molecule", "courtroom", "market-floor", "equilibrium", "ward", "globe",
               "wage", "antitrust", "race", "oecd",
               "dispatch", "dispatch-market", "dispatch-reach", "dispatch-power",
               "reckoning"];

  const rows = [];
  for (const sceneId of IDS) {
    if (!(await evaluate(`window.Interludes.has(${JSON.stringify(sceneId)})`))) {
      rows.push({ scene: sceneId, built: false, note: "not registered" });
      continue;
    }
    errors = [];
    await evaluate(`document.querySelector('.il-overlay [data-act="skip"]')?.click()`);
    await wait(400);
    const played = await evaluate(`window.Interludes.play(${JSON.stringify(sceneId)})`);
    // play() throwing is the failure this runner exists to catch; do not swallow it
    if (played && played.__error) {
      errors.push("play() threw: " + String(played.__error).split(/\r?\n/)[0]);
    }
    await wait(SETTLE);

    const built = await evaluate(`!!document.querySelector('.il-overlay canvas')`);
    await evaluate(`window.__ilPerf = null`);
    await wait(MEASURE);
    const perf = await evaluate(`window.__ilPerf`);

    await screenshot(path.join(OUT, `${sceneId}.png`));

    rows.push({
      scene: sceneId,
      built: !!built,
      fps: perf?.fps ?? null,
      medianMs: perf?.median ?? null,
      p95Ms: perf?.p95 ?? null,
      tier: perf?.tier ?? null,
      errors: errors.slice()
    });
    const e = rows[rows.length - 1];
    console.log(
      `  ${sceneId.padEnd(16)} built=${e.built ? "y" : "N"}` +
      `  fps=${String(e.fps ?? "-").padStart(5)}` +
      `  median=${String(e.medianMs ?? "-").padStart(6)}ms` +
      `  p95=${String(e.p95Ms ?? "-").padStart(6)}ms` +
      `  errors=${e.errors.length}`);
    e.errors.forEach((x) => console.log(`      ${x}`));
  }

  await evaluate(`document.querySelector('.il-overlay [data-act="skip"]')?.click()`);

  const report = {
    when: new Date().toISOString(),
    quality: JSON.parse(settings),
    post: !!args.post,
    settleMs: SETTLE, measureMs: MEASURE,
    scenes: rows
  };
  const file = path.join(OUT, "report.json");
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  const bad = rows.filter((r) => !r.built || (r.errors && r.errors.length));
  const slow = rows.filter((r) => r.p95Ms && r.p95Ms > 33.3);
  console.log(`\n${rows.length} scenes | ${bad.length} with problems | ${slow.length} over 33ms p95`);
  console.log(`report: ${file}`);
  console.log(`shots : ${OUT}/<scene>.png`);

  ws.close();
  process.exit(bad.length ? 1 : 0);
})();
