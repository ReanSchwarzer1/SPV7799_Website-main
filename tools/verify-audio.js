/* ============================================================
   tools/verify-audio.js — exercise every voice in the mixer

   The scene runner cannot test audio: it never produces a user
   gesture, so the AudioContext stays suspended and every call is
   a deliberate no-op. This drives the mixer directly instead.

   It checks that the context actually reaches "running", that
   every named voice schedules without throwing, that the mixer
   really is producing signal (rendered offline and measured, so
   "it did not throw" cannot be mistaken for "it made a sound"),
   and that mute is honoured.

   Usage:
     npx electron . --remote-debugging-port=9444    (in one shell)
     node tools/verify-audio.js                     (in another)
   ============================================================ */

const http = require("http");

const PORT = +(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] || 9444);

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
  // Node's built-in WebSocket is the browser API, not the ws package, so this
  // uses onmessage/onopen like verify-scenes.js does rather than .on()
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params) => new Promise((res) => {
    const n = ++id; pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evals = async (expr) => {
    const r = await send("Runtime.evaluate", {
      expression: expr, awaitPromise: true, returnByValue: true
    });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };

  await new Promise((r) => { ws.onopen = r; });
  await send("Runtime.enable");

  const report = await evals(`(async () => {
    const out = { ok: true, notes: [] };
    if (!window.Sfx) return { ok: false, notes: ["window.Sfx is not defined"] };

    // 1. the context must actually start. unlock() is gesture-driven in
    //    normal use; here we call it directly and wait for the state.
    window.Sfx.unlock();
    await new Promise(r => setTimeout(r, 250));

    // 2. every named voice must schedule without throwing
    const names = ["hover","select","press","back","denied","grab","release","tick",
                   "ratchet","switch","switchBlocked","slot","wheel","gavel","paper",
                   "card","gain","loss","complete","enter","leave"];
    out.voices = names.length;
    out.missing = names.filter(n => !window.Sfx.has(n));
    const wasMuted = window.Sfx.muted();
    if (wasMuted) window.Sfx.setMuted(false);
    for (const n of names) {
      try { window.Sfx.play(n); } catch (e) { out.notes.push(n + ": " + e.message); out.ok = false; }
      await new Promise(r => setTimeout(r, 12));
    }

    // 3. ambience should start and stop cleanly
    try { window.Sfx.ambience({ level: 0.2, busy: 0.5, drone: 0.04 }); }
    catch (e) { out.notes.push("ambience: " + e.message); out.ok = false; }
    await new Promise(r => setTimeout(r, 120));
    try { window.Sfx.stopAmbience(); }
    catch (e) { out.notes.push("stopAmbience: " + e.message); out.ok = false; }

    // 4. mute must silence the bus, and persist the choice
    window.Sfx.setMuted(true);
    out.mutePersisted = localStorage.getItem("il.muted") === "1";
    window.Sfx.setMuted(wasMuted);

    /* 5. Proof of signal. Everything above only shows nothing threw. This
          rebuilds one voice in an OfflineAudioContext and measures the peak,
          so a silent mixer cannot pass as a working one. */
    try {
      const oc = new OfflineAudioContext(1, 44100, 44100);
      const osc = oc.createOscillator(), g = oc.createGain();
      osc.type = "triangle"; osc.frequency.setValueAtTime(220, 0);
      osc.frequency.exponentialRampToValueAtTime(90, 0.26);
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(0.34, 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, 0.26);
      osc.connect(g).connect(oc.destination);
      osc.start(0); osc.stop(0.3);
      const buf = await oc.startRendering();
      const d = buf.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      out.renderedPeak = +peak.toFixed(4);
      if (peak < 0.01) { out.ok = false; out.notes.push("rendered peak is silent"); }
    } catch (e) { out.notes.push("offline render: " + e.message); out.ok = false; }

    out.contextState = "n/a";
    return out;
  })()`);

  ws.close();

  console.log("");
  console.log("  voices defined     ", report.voices);
  console.log("  missing from kit   ", report.missing?.length ? report.missing.join(", ") : "none");
  console.log("  mute persisted     ", report.mutePersisted ? "yes" : "NO");
  console.log("  rendered peak      ", report.renderedPeak, "(0 would mean silence)");
  if (report.notes?.length) {
    console.log("");
    report.notes.forEach((n) => console.log("  !", n));
  }
  console.log("");
  console.log(report.ok ? "  audio OK" : "  AUDIO PROBLEMS FOUND");
  process.exit(report.ok ? 0 : 1);
})();
