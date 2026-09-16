/* ============================================================
   tools/shot.js — screenshot the running app over the debugger

   For the documents that have to show a session runner what the
   screen looks like: the opening briefing, a module card, the
   reckoning.

   Usage:
     npx electron . --remote-debugging-port=9444
     node tools/shot.js --out=shots/intro.png
     node tools/shot.js --out=shots/module1.png --click="#game-start" --wait=1500
     node tools/shot.js --out=shots/x.png --eval="launchWard()" --wait=3000
   ============================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const PORT = Number(arg("port", "9444"));
const OUT = arg("out", "shot.png");
const CLICK = arg("click", "");
const EVAL = arg("eval", "");
const WAIT = Number(arg("wait", "1200"));

const list = () =>
  new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path: "/json/list" }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });

(async () => {
  const page = (await list()).find((t) => t.type === "page");
  if (!page) throw new Error("no page target on port " + PORT);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
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

  const evaluate = (expression) =>
    send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
      .then((r) => (r.result && r.result.result ? r.result.result.value : null));

  // wait for the page to have finished booting
  for (let i = 0; i < 40; i++) {
    if (await evaluate("document.readyState === 'complete'")) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  if (CLICK) await evaluate(`(function(){var el=document.querySelector(${JSON.stringify(CLICK)}); if(el) el.click(); return !!el;})()`);
  if (EVAL) await evaluate(EVAL);
  await new Promise((r) => setTimeout(r, WAIT));

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const data = shot.result && shot.result.data;
  if (!data) throw new Error("no screenshot data");
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(data, "base64"));
  console.log("wrote", OUT, fs.statSync(OUT).size, "bytes");
  ws.close();
  process.exit(0);
})().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
