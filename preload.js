/* preload.js — runs sandboxed, before the page.
   The artifact needs nothing from Node, so this exposes only a
   small marker the page can use to tell it is running as the
   desktop app rather than in a browser tab. */

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("gameShell", {
  isDesktopApp: true,
  platform: process.platform
});
