/* ============================================================
   il-audio.js — the sound of Condition B

   Every sound in this build is synthesised at runtime. There is not
   one audio file in the project, and that is deliberate:

     - The app ships offline with no network access. Bundled audio
       would be the only asset class that could not be regenerated
       from source.
     - Licence provenance for sourced clips has to be verified per
       file, and an unverifiable licence in a published study build
       is not worth the risk.
     - The brief asks for ambience that responds to game state — a
       trading floor that thickens as competitors are admitted. That
       is a parameter change on a synth and a crossfade problem on a
       recording.

   The trade is realism: synthesised wood is a filtered noise burst
   with a pitch drop, not a recording of a gavel. It reads as the
   right event rather than as the exact material.

   Loaded as a classic script before game.js so both the plain-DOM
   HUD and the ES-module interludes can reach one mixer through
   window.Sfx.
   ============================================================ */
(function () {
  "use strict";

  var MUTE_KEY = "il.muted";
  var VOL_KEY = "il.volume";

  var ac = null;               // created on the first gesture, never before
  var master = null;
  var buses = {};              // ui | foley | amb
  var unlocked = false;
  var muted = false;
  var volume = 0.6;
  var noiseBuf = null;
  var amb = null;              // the running ambience, if any

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
    var v = parseFloat(localStorage.getItem(VOL_KEY));
    if (!isNaN(v)) volume = Math.max(0, Math.min(1, v));
  } catch (e) { /* private mode */ }

  /* ---- context ---------------------------------------------------------
     Browsers and Electron both refuse to start a context without a gesture,
     and a refused context fails silently, so everything is built lazily on
     the first real interaction and every entry point tolerates ac === null. */
  function ensure() {
    if (ac) return ac;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { ac = new Ctor(); } catch (e) { return null; }

    master = ac.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ac.destination);

    /* Category buses, so the mix can be balanced in one place rather than by
       tuning forty call sites. UI sits well under foley: a click the player
       makes forty times an hour should never be the loudest thing present. */
    [["ui", 0.34], ["foley", 0.75], ["amb", 0.30]].forEach(function (p) {
      var g = ac.createGain();
      g.gain.value = p[1];
      g.connect(master);
      buses[p[0]] = g;
    });

    // one second of white noise, reused by every noise-based voice
    var n = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, n, n);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }

  function unlock() {
    if (unlocked) return;
    var c = ensure();
    if (!c) return;
    unlocked = true;
    if (c.state === "suspended") c.resume();
  }

  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) {
    window.addEventListener(ev, unlock, { passive: true });
  });

  function now() { return ac.currentTime; }
  function bus(name) { return buses[name] || buses.ui; }

  /* ---- voices ----------------------------------------------------------
     Two primitives underneath everything: a pitched oscillator with an
     envelope, and a band of noise with an envelope. Every sound in the game
     is some arrangement of those two. */

  function env(node, t0, peak, attack, hold, release) {
    var g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    if (hold) g.setValueAtTime(Math.max(0.0002, peak), t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + (hold || 0) + release);
  }

  function tone(o) {
    var c = ensure(); if (!c || muted) return;
    var t0 = now() + (o.delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, o.to), t0 + (o.glide || o.release || 0.12));
    if (o.detune) osc.detune.value = o.detune;
    env(g, t0, o.gain == null ? 0.3 : o.gain,
        o.attack || 0.004, o.hold || 0, o.release || 0.12);
    osc.connect(g).connect(bus(o.bus));
    osc.start(t0);
    osc.stop(t0 + (o.attack || 0.004) + (o.hold || 0) + (o.release || 0.12) + 0.03);
  }

  function noise(o) {
    var c = ensure(); if (!c || muted) return;
    var t0 = now() + (o.delay || 0);
    var src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = c.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(
      Math.max(20, o.to), t0 + (o.release || 0.12));
    f.Q.value = o.q == null ? 1 : o.q;
    var g = c.createGain();
    env(g, t0, o.gain == null ? 0.25 : o.gain,
        o.attack || 0.003, o.hold || 0, o.release || 0.12);
    src.connect(f).connect(g).connect(bus(o.bus));
    src.start(t0);
    src.stop(t0 + (o.attack || 0.003) + (o.hold || 0) + (o.release || 0.12) + 0.03);
  }

  /* ---- the kit ---------------------------------------------------------
     Named events rather than named sounds, so a scene asks for what happened
     and the mix decides what that sounds like. */
  var KIT = {
    /* --- pointer and UI, the ones that fire hundreds of times --- */
    hover: function () {
      noise({ bus: "ui", freq: 2600, q: 3, gain: 0.045, attack: 0.002, release: 0.035 });
    },
    select: function () {
      tone({ bus: "ui", type: "triangle", freq: 660, to: 880, gain: 0.12,
             attack: 0.003, release: 0.07 });
      noise({ bus: "ui", freq: 3200, q: 2, gain: 0.05, release: 0.03 });
    },
    press: function () {
      tone({ bus: "ui", type: "sine", freq: 240, to: 150, gain: 0.16, release: 0.09 });
      noise({ bus: "ui", freq: 1500, q: 1.4, gain: 0.09, release: 0.05 });
    },
    back: function () {
      tone({ bus: "ui", type: "triangle", freq: 520, to: 360, gain: 0.10, release: 0.09 });
    },
    denied: function () {
      // a dead, damped knock: something that will not move
      tone({ bus: "ui", type: "sine", freq: 150, to: 96, gain: 0.16, release: 0.13 });
      noise({ bus: "ui", filter: "lowpass", freq: 420, gain: 0.13, release: 0.10 });
    },

    /* --- handling: grabs, detents, drags --- */
    grab: function () {
      noise({ bus: "foley", filter: "lowpass", freq: 900, gain: 0.10,
              attack: 0.006, release: 0.08 });
    },
    release: function () {
      noise({ bus: "foley", filter: "lowpass", freq: 620, gain: 0.07, release: 0.07 });
    },
    tick: function () {
      // one detent of a ratchet; deliberately tiny, it fires on every step
      noise({ bus: "foley", freq: 2100, q: 6, gain: 0.055, attack: 0.001, release: 0.022 });
    },
    ratchet: function () {
      tone({ bus: "foley", type: "square", freq: 1400, to: 900, gain: 0.035, release: 0.03 });
      noise({ bus: "foley", freq: 1800, q: 5, gain: 0.06, release: 0.03 });
    },

    /* --- mechanisms --- */
    "switch": function () {
      // two-stage metal clank: the throw, then the stop
      tone({ bus: "foley", type: "square", freq: 380, to: 190, gain: 0.10, release: 0.05 });
      noise({ bus: "foley", freq: 2400, q: 3, gain: 0.13, release: 0.045 });
      noise({ bus: "foley", freq: 900, q: 2, gain: 0.10, delay: 0.055, release: 0.07 });
    },
    switchBlocked: function () {
      /* The welded-shut variant from the brief. The player flips a switch that
         their own earlier ruling closed, and it has to sound like a thing that
         will not move rather than a thing that did nothing. */
      noise({ bus: "foley", filter: "lowpass", freq: 300, gain: 0.16,
              attack: 0.002, release: 0.09 });
      tone({ bus: "foley", type: "sine", freq: 110, to: 74, gain: 0.14, release: 0.14 });
    },
    slot: function () {
      // ca-chunk: the card going in, then the mechanism taking it
      noise({ bus: "foley", filter: "highpass", freq: 1800, gain: 0.10, release: 0.09 });
      tone({ bus: "foley", type: "square", freq: 300, to: 150, gain: 0.11,
             delay: 0.10, release: 0.07 });
      noise({ bus: "foley", freq: 700, q: 2, gain: 0.13, delay: 0.10, release: 0.09 });
    },
    wheel: function () {
      noise({ bus: "foley", freq: 1500, q: 4, gain: 0.05, release: 0.03 });
    },

    /* --- the bench --- */
    gavel: function () {
      /* Three layers, because a single thud reads as a drum. The crack is the
         two faces meeting, the body is the block resonating, and the drop
         underneath is the weight. */
      noise({ bus: "foley", filter: "bandpass", freq: 3000, to: 800, q: 1.2,
              gain: 0.30, attack: 0.001, release: 0.07 });
      tone({ bus: "foley", type: "triangle", freq: 220, to: 90, gain: 0.34,
             attack: 0.002, release: 0.26 });
      tone({ bus: "foley", type: "sine", freq: 68, to: 42, gain: 0.30,
             attack: 0.004, release: 0.34 });
      noise({ bus: "foley", filter: "lowpass", freq: 260, gain: 0.14,
              delay: 0.02, release: 0.22 });
    },
    paper: function () {
      noise({ bus: "foley", filter: "highpass", freq: 2200, q: 0.7, gain: 0.075,
              attack: 0.012, hold: 0.02, release: 0.13 });
    },
    card: function () {
      noise({ bus: "foley", filter: "highpass", freq: 2800, gain: 0.06,
              attack: 0.006, release: 0.08 });
    },

    /* --- score and outcome --- */
    gain: function () {
      tone({ bus: "ui", type: "sine", freq: 587.33, gain: 0.13, release: 0.16 });          // D5
      tone({ bus: "ui", type: "sine", freq: 880.00, gain: 0.11, delay: 0.09, release: 0.22 }); // A5
    },
    loss: function () {
      tone({ bus: "ui", type: "triangle", freq: 392.00, gain: 0.13, release: 0.18 });      // G4
      tone({ bus: "ui", type: "triangle", freq: 261.63, gain: 0.12, delay: 0.10, release: 0.30 }); // C4
    },
    complete: function () {
      // a small rising figure, not a fanfare; this happens ten times a run
      [523.25, 659.25, 783.99].forEach(function (f, i) {
        tone({ bus: "ui", type: "sine", freq: f, gain: 0.12,
               delay: i * 0.085, release: 0.30 });
      });
    },

    /* --- flow --- */
    enter: function () {
      noise({ bus: "amb", filter: "bandpass", freq: 260, to: 1400, q: 0.8,
              gain: 0.11, attack: 0.10, release: 0.32 });
    },
    leave: function () {
      noise({ bus: "amb", filter: "bandpass", freq: 1200, to: 220, q: 0.8,
              gain: 0.09, attack: 0.03, release: 0.20 });
    }
  };

  /* ---- ambience --------------------------------------------------------
     A noise bed through a lowpass plus an optional drone. `busy` opens the
     filter and lifts the level, which is how the market floor thickens as
     competitors are admitted without needing a second recording to crossfade
     to. Every change is ramped, never set, so nothing clicks. */
  function ambience(opts) {
    var c = ensure(); if (!c) return;
    var o = opts || {};
    if (!amb) {
      var src = c.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      var lp = c.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 300; lp.Q.value = 0.6;
      var g = c.createGain(); g.gain.value = 0.0001;
      src.connect(lp).connect(g).connect(bus("amb"));
      src.start();

      var drone = c.createOscillator();
      var dg = c.createGain();
      drone.type = "sine"; drone.frequency.value = 55;
      dg.gain.value = 0.0001;
      drone.connect(dg).connect(bus("amb"));
      drone.start();

      amb = { src: src, lp: lp, g: g, drone: drone, dg: dg };
    }
    var t = now(), k = 0.7;
    var busy = Math.max(0, Math.min(1, o.busy == null ? 0 : o.busy));
    amb.g.gain.linearRampToValueAtTime(
      Math.max(0.0001, (o.level == null ? 0.22 : o.level) * (0.6 + busy * 0.8)), t + k);
    amb.lp.frequency.linearRampToValueAtTime(240 + busy * 1500, t + k);
    amb.dg.gain.linearRampToValueAtTime(Math.max(0.0001, o.drone == null ? 0 : o.drone), t + k);
    if (o.droneHz) amb.drone.frequency.linearRampToValueAtTime(o.droneHz, t + k);
  }

  function stopAmbience() {
    if (!amb || !ac) return;
    var a = amb, t = now();
    amb = null;
    a.g.gain.cancelScheduledValues(t);
    a.g.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    a.dg.gain.cancelScheduledValues(t);
    a.dg.gain.linearRampToValueAtTime(0.0001, t + 0.35);
    setTimeout(function () {
      try { a.src.stop(); a.drone.stop(); } catch (e) { /* already stopped */ }
    }, 500);
  }

  function applyGain() {
    if (!master) return;
    var t = ac.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.linearRampToValueAtTime(muted ? 0.0001 : Math.max(0.0001, volume), t + 0.08);
  }

  /* Throttle, so a voice cannot be retriggered faster than it can be heard.
     Hover in particular fires on every pointer move across a boundary. */
  var lastAt = Object.create(null);
  var MIN_GAP = { hover: 0.07, tick: 0.028, wheel: 0.04, card: 0.05 };

  function play(name, opts) {
    if (muted) return;
    var fn = KIT[name];
    if (!fn) return;
    var c = ensure(); if (!c) return;
    if (c.state === "suspended") return;      // still waiting on a gesture
    var gap = MIN_GAP[name];
    if (gap) {
      var t = c.currentTime;
      if (lastAt[name] && t - lastAt[name] < gap) return;
      lastAt[name] = t;
    }
    try { fn(opts || {}); } catch (e) { /* never let audio break a scene */ }
  }

  window.Sfx = {
    play: play,
    unlock: unlock,
    ambience: ambience,
    stopAmbience: stopAmbience,
    has: function (n) { return !!KIT[n]; },
    muted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (e) {}
      if (muted) stopAmbience();
      applyGain();
      document.dispatchEvent(new CustomEvent("sfx:mute", { detail: { muted: muted } }));
      return muted;
    },
    toggleMute: function () { return window.Sfx.setMuted(!muted); },
    volume: function (v) {
      if (v === undefined) return volume;
      volume = Math.max(0, Math.min(1, v));
      try { localStorage.setItem(VOL_KEY, String(volume)); } catch (e) {}
      applyGain();
      return volume;
    }
  };

  /* One action, from anywhere, and it persists. Study sessions run in shared
     rooms; the brief calls this a requirement rather than a nicety. */
  window.addEventListener("keydown", function (e) {
    if (e.key === "m" || e.key === "M") {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      window.Sfx.toggleMute();
    }
  });
})();
