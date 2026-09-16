/* ============================================================
   tools/verify-log.js — smoke test for the session log

   Drives the running app over the debugger: sets a participant id,
   files a couple of events, asks the logger to flush, and prints the
   path the main process wrote to. Fails loudly if the bridge is not
   there or the write was refused.

   Usage:
     npx electron . --remote-debugging-port=9444     (in one shell)
     node tools/verify-log.js                        (in another)
   ============================================================ */
const http = require("http");
const fs = require("fs");

const PORT = Number((process.argv.find((a) => a.startsWith("--port=")) || "--port=9444").split("=")[1]);

function targets() {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path: "/json/list" }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    }).on("error", reject);
  });
}

(async () => {
  const pages = (await targets()).filter((t) => t.type === "page");
  if (!pages.length) throw new Error("no page target on port " + PORT);

  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    const fn = pending.get(msg.id);
    if (fn) { pending.delete(msg.id); fn(msg); }
  };
  await new Promise((r) => (ws.onopen = r));

  const send = (method, params) =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params: params || {} }));
    });

  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (res.result && res.result.exceptionDetails) {
      throw new Error(res.result.exceptionDetails.text + " " + JSON.stringify(res.result.exceptionDetails.exception || {}));
    }
    return res.result.result.value;
  };

  // a cold packaged start can still be loading its scripts when we attach
  let present = false;
  for (let tries = 0; tries < 30 && !present; tries++) {
    present = await evaluate("!!window.GameLog && !!(window.gameShell && window.gameShell.saveLog)");
    if (!present) await new Promise((r) => setTimeout(r, 500));
  }
  console.log("logger present, bridge present:", present);
  if (!present) throw new Error("GameLog or gameShell.saveLog missing");

  await evaluate('window.GameLog.setId("VERIFY01")');
  await evaluate('window.GameLog.event("probe", { source: "verify-log" })');
  await evaluate('window.GameLog.scene("molecule", "enter")');
  await evaluate('window.GameLog.scene("molecule", "end")');
  const path = await evaluate('window.GameLog.flush("verify")');
  console.log("written to:", path);

  if (!path || !fs.existsSync(path)) throw new Error("no file at " + path);
  const parsed = JSON.parse(fs.readFileSync(path, "utf8"));
  console.log("participant:", parsed.participant, "| condition:", parsed.condition, "| build:", parsed.build);
  console.log("events:", parsed.events.length, "| sections:", JSON.stringify(parsed.sections));
  const types = parsed.events.map((e) => e.type);
  for (const want of ["session-start", "participant", "probe", "enter", "leave"]) {
    if (!types.includes(want)) throw new Error("missing event type: " + want);
  }
  console.log("event types:", [...new Set(types)].join(", "));
  console.log("OK");
  ws.close();
  process.exit(0);
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
