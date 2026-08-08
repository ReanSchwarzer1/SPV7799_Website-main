/* ============================================================
   electron-main.js — desktop shell for Condition B

   Runs the gamified artifact as a standalone application so a
   session can be launched from an .exe with no browser and no
   network. Everything the app needs is vendored in ./vendor.

   Why a custom protocol instead of loadFile(): Chromium refuses
   to load ES modules over file://, and the 3D layer is made of
   ES modules. Serving the same folder over a registered standard
   scheme (game://) gives module loading a real origin, without
   opening a TCP port on the machine.
   ============================================================ */

const { app, BrowserWindow, protocol, net, globalShortcut } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

/* Chromium throttles, and eventually freezes, the render loop of a window it
   considers backgrounded or occluded. For a study session that is unacceptable:
   a participant who alt-tabs for a moment would come back to a stalled scene.
   It also makes frame-time measurement meaningless, since requestAnimationFrame
   simply stops firing. Both are disabled here, and backgroundThrottling is
   turned off on the window itself. */
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

/* Chromium opens its HTTP and GPU shader disk caches very early in startup,
   before our single instance check can quit a duplicate launch. A duplicate
   therefore prints "Unable to move the cache" and "Gpu Cache Creation failed"
   on its way out, which looks alarming and is not.

   Neither cache earns its keep here. The app makes no network requests at all
   (everything is served locally over game://), and the shader set is small
   enough that recompiling it per launch costs far less than the confusion of
   red errors in a tester's console. Turning both off removes the noise and
   makes startup deterministic. */
app.commandLine.appendSwitch("disable-http-cache");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

const ROOT = __dirname;
const START_PAGE = "index-gamified.html";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "game",
    privileges: {
      standard: true,      // required for ES module resolution
      secure: true,
      supportFetchAPI: true,
      stream: true
    }
  }
]);

/* Single instance.

   Two copies of the game must never run at once. Chromium keeps one GPU and
   disk cache per user data directory, so a second instance cannot take it and
   logs "Unable to move the cache / Gpu Cache Creation failed" before falling
   back to no caching. That is only the visible symptom.

   The real problem is the study: two windows would be two independent game
   states, and a participant who double-clicks the icon would be running two
   terms at once. A second launch now just focuses the window that already
   exists. */
let win = null;

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", function () {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#0b0d12",
    show: false,
    autoHideMenuBar: true,
    title: "One Molecule, Two Markets",
    webPreferences: {
      preload: path.join(ROOT, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  win.removeMenu();
  win.once("ready-to-show", function () { win.show(); });
  win.loadURL("game://app/" + START_PAGE);

  // keep navigation inside the app
  win.webContents.setWindowOpenHandler(function () { return { action: "deny" }; });
  win.webContents.on("will-navigate", function (e, target) {
    if (!target.startsWith("game://")) e.preventDefault();
  });
}

app.whenReady().then(function () {
  // serve the app folder over game://
  protocol.handle("game", function (request) {
    let rel;
    try {
      rel = decodeURIComponent(new URL(request.url).pathname);
    } catch (err) {
      return new Response("bad request", { status: 400 });
    }
    rel = rel.replace(/^\/+/, "");
    if (rel === "") rel = START_PAGE;

    const filePath = path.normalize(path.join(ROOT, rel));
    // never serve anything outside the app directory
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      return new Response("forbidden", { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();

  // session controls for whoever is running the study
  globalShortcut.register("F11", function () {
    if (win) win.setFullScreen(!win.isFullScreen());
  });
  globalShortcut.register("F12", function () {
    if (win) win.webContents.toggleDevTools();
  });
  globalShortcut.register("CommandOrControl+R", function () {
    if (win) win.reload();
  });

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", function () { globalShortcut.unregisterAll(); });
