/* ============================================================
   tools/verify-layout.js — does the label layout come to rest?

   A screenshot cannot catch an oscillating label: every frame
   looks plausible, and the still is taken at one of them. This
   plays each scene, samples every registered label's position
   over time, and reports how far they are still travelling in
   the final window.

   Settled means the separation solver converged. Drift means
   something is pushing a label in a loop — which is what happens
   if an object is both a label and a keep-out volume, because
   then it pushes itself.

   Usage:
     npx electron . --remote-debugging-port=9444    (in one shell)
     node tools/verify-layout.js                    (in another)
   ============================================================ */

const http = require("http");

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith("--" + k + "="));
  return m ? m.split("=")[1] : d;
};
const PORT = +arg("port", 9444);
const SETTLE = +arg("settle", 2200);   // let the entry sweep and solver finish
const WINDOW = +arg("window", 1200);   // then watch for this long
const LIMIT = +arg("limit", 0.02);     // world units of drift we call "at rest"

function targets() {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}/json`, (res) => {
      let b = ""; res.on("data", (d) => (b += d));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

(async function main() {
  let pages;
  try { pages = (await targets()).filter((t) => t.type === "page"); }
  catch (e) {
    console.error(`Cannot reach the debugger on port ${PORT}.`);
    console.error(`Start the app first:  npx electron . --remote-debugging-port=${PORT}`);
    process.exit(2);
  }
  if (!pages.length) { console.error("No page target found."); process.exit(2); }

  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params) => new Promise((res) => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  });
  const evals = async (expr) => {
    const r = await send("Runtime.evaluate",
      { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) {
      throw new Error(r.result.exceptionDetails.text || "eval failed");
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  await new Promise((r) => { ws.onopen = r; });
  await send("Runtime.enable");

  const scenes = await evals(`Object.keys(window.__ilRegistry || {}).length
    ? Object.keys(window.__ilRegistry)
    : ["molecule","courtroom","market-floor","equilibrium","ward","globe","wage",
       "antitrust","race","oecd","dispatch","dispatch-market","dispatch-reach",
       "dispatch-power","reckoning"]`);

  console.log("");
  let worstAll = 0, bad = 0;
  for (const key of scenes) {
    await evals(`window.Interludes.play(${JSON.stringify(key)}); true`);
    await new Promise((r) => setTimeout(r, SETTLE));

    const report = await evals(`(async () => {
      const d = window.Interludes.debug();
      if (!d || !d.labels || !d.labels.length) return { n: 0, drift: 0 };
      const snap = () => d.labels.map(L => L.mesh.position.clone());
      const a = snap();
      await new Promise(r => setTimeout(r, ${WINDOW}));
      const b = snap();
      let drift = 0, which = -1;
      for (let i = 0; i < a.length; i++) {
        const v = a[i].distanceTo(b[i]);
        if (v > drift) { drift = v; which = i; }
      }
      return { n: a.length, drift: +drift.toFixed(4), which };
    })()`);

    const flag = report.drift > LIMIT;
    if (flag) bad++;
    worstAll = Math.max(worstAll, report.drift);
    console.log("  %s labels=%s  drift=%s %s",
      key.padEnd(16), String(report.n).padStart(2),
      String(report.drift).padStart(7),
      flag ? "  <-- STILL MOVING" : "");
  }

  await evals(`window.Interludes.close(false); true`);
  ws.close();
  console.log("");
  console.log("  worst drift %s over %sms (at rest <= %s)",
    worstAll.toFixed(4), WINDOW, LIMIT);
  console.log(bad ? "  LAYOUT NOT SETTLED in " + bad + " scene(s)" : "  layout settled everywhere");
  process.exit(bad ? 1 : 0);
})();
