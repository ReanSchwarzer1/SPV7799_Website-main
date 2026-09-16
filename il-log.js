/* ============================================================
   il-log.js — session log for the study

   Records what a participant did and when, so RQ2 and RQ3 can be
   read next to the cost of getting there: time on task, how often
   each section was entered, and every control they touched.

   The same file runs in both conditions. Condition A is a page, so
   sections are tracked with an IntersectionObserver; Condition B is
   a sequence of 3D scenes, so game.js calls GameLog.scene() as the
   director moves the player. Nothing else differs.

   Where the log goes:
     - desktop build: the main process writes it next to the .exe
       (preload exposes gameShell.saveLog), falling back to the user
       data folder when that directory is read-only
     - browser: kept in localStorage and downloadable with
       GameLog.download() from the console

   Participant id: ?pid=P07 in the URL, otherwise the id typed into
   the opening briefing, otherwise a timestamp. It is remembered for
   the session so a reload does not start a second file.

   Loaded as a classic script before script.js and game.js.
   ============================================================ */
(function () {
  "use strict";

  var SAVE_EVERY_MS = 15000;
  var MAX_EVENTS = 20000;          // a 30-minute session logs a few hundred
  var SLIDER_QUIET_MS = 400;       // one entry per control per this window

  function iso(d) { return new Date(d).toISOString(); }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  var startedAt = Date.now();
  var t0 = safe(function () { return performance.now(); }, 0);
  function ms() { return Math.round(safe(function () { return performance.now(); }, Date.now() - startedAt) - t0); }

  var pid = safe(function () { return new URLSearchParams(location.search).get("pid"); }, null) ||
            safe(function () { return sessionStorage.getItem("il.pid"); }, null) ||
            "P-" + iso(startedAt).replace(/[-:T.]/g, "").slice(0, 14);
  safe(function () { sessionStorage.setItem("il.pid", pid); });

  var condition = /gamified/i.test(location.pathname) ? "B" : "A";

  var log = {
    participant: pid,
    condition: condition,
    build: "1.4.0",
    startedAt: iso(startedAt),
    endedAt: null,
    userAgent: safe(function () { return navigator.userAgent; }, ""),
    desktop: !!(window.gameShell && window.gameShell.isDesktopApp),
    sections: {},                  // name -> { enters, msVisible }
    events: []
  };

  function push(type, detail) {
    if (log.events.length >= MAX_EVENTS) return;
    log.events.push({ t: ms(), type: type, detail: detail === undefined ? null : detail });
    dirty = true;
  }

  // ---------- section and scene dwell ----------
  var open = {};                   // name -> entry timestamp

  function enter(name) {
    if (open[name] != null) return;
    open[name] = ms();
    var s = log.sections[name] || (log.sections[name] = { enters: 0, msVisible: 0 });
    s.enters += 1;
    push("enter", { where: name, visit: s.enters });
  }

  function leave(name) {
    if (open[name] == null) return;
    var dwell = ms() - open[name];
    delete open[name];
    var s = log.sections[name] || (log.sections[name] = { enters: 1, msVisible: 0 });
    s.msVisible += dwell;
    push("leave", { where: name, ms: dwell });
  }

  function watchSections() {
    var sections = document.querySelectorAll("main > section");
    if (!sections.length || !window.IntersectionObserver) return;
    var names = [];
    Array.prototype.forEach.call(sections, function (el, i) {
      var h = el.querySelector("h2, h3");
      names.push(String(i + 1) + ". " + (h ? h.textContent.trim().slice(0, 60) : el.id || "section"));
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var i = Array.prototype.indexOf.call(sections, e.target);
        if (i < 0) return;
        if (e.isIntersecting) enter(names[i]); else leave(names[i]);
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(sections, function (el) { io.observe(el); });
  }

  // ---------- controls ----------
  var lastControl = {};

  function onControl(ev) {
    var el = ev.target;
    if (!el || !el.id) return;
    var now = ms();
    if (ev.type === "input" && lastControl[el.id] != null && now - lastControl[el.id] < SLIDER_QUIET_MS) return;
    lastControl[el.id] = now;
    push("control", { id: el.id, value: el.type === "checkbox" ? el.checked : el.value });
  }

  function onClick(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest("button, a, [role=button]") : null;
    if (!el) return;
    push("click", { id: el.id || null, text: (el.textContent || "").trim().slice(0, 48) });
  }

  // ---------- saving ----------
  var dirty = false, saving = false, lastPath = null;

  function filename() {
    return ("onemolecule-" + condition + "-" + pid + "-" + iso(startedAt).replace(/[-:T.]/g, "").slice(0, 14) + ".json")
      .replace(/[^A-Za-z0-9._-]/g, "_");
  }

  function serialise() {
    log.endedAt = iso(Date.now());
    log.msElapsed = ms();
    Object.keys(open).forEach(function (name) {            // count the section still on screen
      var s = log.sections[name];
      if (s) s.msVisibleOpen = ms() - open[name];
    });
    return JSON.stringify(log);
  }

  function flush(reason) {
    if (saving) return Promise.resolve(lastPath);
    var text = serialise();
    dirty = false;
    if (window.gameShell && typeof window.gameShell.saveLog === "function") {
      saving = true;
      return window.gameShell.saveLog(filename(), text).then(function (res) {
        saving = false;
        if (res && res.ok) { lastPath = res.path; return res.path; }
        console.warn("[log] not saved:", res && res.error);
        return null;
      }, function (err) { saving = false; console.warn("[log] save failed:", err); return null; });
    }
    safe(function () { localStorage.setItem("il.log." + pid, text); });
    return Promise.resolve("localStorage:il.log." + pid);
  }

  function download() {
    var blob = new Blob([serialise()], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename();
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- public surface ----------
  window.GameLog = {
    get id() { return pid; },
    setId: function (v) {
      v = String(v || "").trim().slice(0, 40);
      if (!v) return pid;
      pid = v.replace(/[^A-Za-z0-9._-]/g, "_");
      log.participant = pid;
      safe(function () { sessionStorage.setItem("il.pid", pid); });
      push("participant", { id: pid });
      return pid;
    },
    event: push,
    scene: function (id, state) { if (state === "enter") enter("scene:" + id); else leave("scene:" + id); },
    flush: flush,
    download: download,
    get data() { return log; }
  };

  // ---------- wiring ----------
  document.addEventListener("input", onControl, true);
  document.addEventListener("change", onControl, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("DOMContentLoaded", watchSections);
  if (document.readyState !== "loading") watchSections();

  setInterval(function () { if (dirty) flush("interval"); }, SAVE_EVERY_MS);
  window.addEventListener("pagehide", function () { Object.keys(open).forEach(leave); flush("pagehide"); });
  window.addEventListener("beforeunload", function () { Object.keys(open).forEach(leave); flush("unload"); });

  push("session-start", { condition: condition, href: location.pathname });
  flush("start");
})();
