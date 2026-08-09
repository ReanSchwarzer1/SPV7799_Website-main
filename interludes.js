/* ============================================================
   interludes.js — three.js embodied-interaction harness
   ES module. Provides a reusable shell so each section can drop
   in a short real-time 3D task between objectives.

   A single shell owns the renderer, camera, lights, animation
   loop, pointer raycasting, keyboard state, resize, and teardown.
   Each interlude only describes its content + interaction:

     Interludes.register('id', {
       title, kicker, instructions, step,
       assets,                 // per-section material/texture config
                               // (primitives now; swap in later)
       build(ctx) {            // ctx below; return an instance
         ...
         return {
           update(dt) {},      // per-frame
           onPointerDown(hit){},// hit = first raycast result on ctx.pickables
           onPointerMove(hit){},
           onPointerUp() {},
           dispose() {}         // free geometries/materials
         };
       }
     });

   ctx = { THREE, scene, camera, renderer, container, assets,
           pickables[],        // push meshes you want pointer-pickable
           pointer (Vec2 NDC), raycaster, keys{},
           complete(), setHint(text) }

   Public: window.Interludes.play('id'), .register(id, def), .has(id)
   ============================================================ */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

const registry = new Map();
let active = null; // current running session

/* ------------------------------------------------------------------
   Quality tiers.

   Sessions run on machines we do not control. A study that stutters is
   worse than one that looks plain, so every visual upgrade added from
   here on is gated on a tier, and the tier can drop itself if the frame
   budget is missed for a sustained period.

   high   shadows + post-processing + full shadow map
   medium shadows, no post-processing
   low    no shadows, no post-processing
   ------------------------------------------------------------------ */
let Interludes_postDefault = false;   // Phase 3 flips this to true

/* Participants sit with this for half an hour and some are motion sensitive.
   Camera kicks and any rapid flashing check this before they run. */
/* Audio is optional infrastructure. If il-audio.js failed to load, or the
   context has not been unlocked by a gesture yet, every call here is a no-op
   rather than a thrown error — a study build must not lose a scene because a
   sound could not play. */
function sfx(name, opts) {
  try { if (window.Sfx) window.Sfx.play(name, opts); } catch (e) { /* silent */ }
}
function sfxAmbience(o) {
  try { if (window.Sfx) window.Sfx.ambience(o); } catch (e) { /* silent */ }
}

let reducedMotionOverride = null;      // null = follow the OS setting
function prefersReducedMotion() {
  if (reducedMotionOverride !== null) return reducedMotionOverride;
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch (e) { return false; }
}

const TIERS = ["low", "medium", "high"];
const QUALITY_KEY = "il.quality";

const Quality = {
  tier: "high",
  locked: false,          // true when the user picked a tier by hand
  budgetMs: 1000 / 50,    // aim for 50fps before considering a downgrade

  get shadows() { return this.tier !== "low"; },
  get post() { return this.tier === "high"; },
  get shadowMapSize() { return this.tier === "high" ? 2048 : 1024; },

  set(tier, byUser) {
    if (TIERS.indexOf(tier) < 0) return;
    this.tier = tier;
    if (byUser) {
      this.locked = true;
      try { localStorage.setItem(QUALITY_KEY, tier); } catch (e) { /* private mode */ }
    }
    document.dispatchEvent(new CustomEvent("interlude:quality", { detail: { tier } }));
  },

  downgrade() {
    const i = TIERS.indexOf(this.tier);
    if (this.locked || i <= 0) return false;
    this.set(TIERS[i - 1], false);
    console.info("[interludes] frame budget missed, dropping to", this.tier);
    return true;
  },

  restore() {
    try {
      const saved = localStorage.getItem(QUALITY_KEY);
      if (saved && TIERS.indexOf(saved) >= 0) { this.tier = saved; this.locked = true; }
    } catch (e) { /* private mode */ }
  }
};
Quality.restore();

/* Rolling frame meter. Read over the debugger as window.__ilPerf during
   verification runs; also feeds the adaptive downgrade above. */
const Perf = {
  scene: null, frames: 0, ms: 0, fps: 0,
  _acc: 0, _n: 0, _overBudget: 0, _samples: [],
  reset(scene) {
    this.scene = scene; this.frames = 0; this.ms = 0; this.fps = 0;
    this._acc = 0; this._n = 0; this._overBudget = 0; this._samples = [];
  },
  sample(dtMs) {
    this.frames++; this._acc += dtMs; this._n++;
    if (this._samples.length < 600) this._samples.push(dtMs);
    if (this._n >= 30) {                       // report about twice a second
      this.ms = this._acc / this._n;
      this.fps = 1000 / this.ms;
      this._acc = 0; this._n = 0;
      // three consecutive slow windows before acting, so a single hitch
      // (a scene building, a texture upload) never triggers a downgrade
      if (this.ms > Quality.budgetMs) {
        if (++this._overBudget >= 3) { this._overBudget = 0; Quality.downgrade(); }
      } else this._overBudget = 0;
      if (typeof window !== "undefined") {
        window.__ilPerf = {
          scene: this.scene, fps: +this.fps.toFixed(1), ms: +this.ms.toFixed(2),
          frames: this.frames, tier: Quality.tier,
          median: this.median(), p95: this.percentile(95)
        };
      }
    }
  },
  median() { return this.percentile(50); },
  percentile(p) {
    if (!this._samples.length) return 0;
    const a = this._samples.slice().sort((x, y) => x - y);
    return +a[Math.min(a.length - 1, Math.floor(a.length * p / 100))].toFixed(2);
  }
};

// ---------- shell ----------
function buildOverlay(def, params) {
  const o = document.createElement("div");
  o.className = "il-overlay";
  o.innerHTML =
    '<div class="il-head">' +
      '<span class="kicker">' + (def.kicker || "3D interlude") + '</span>' +
      '<h2>' + ((params && params.title) || def.title || "") + '</h2>' +
      '<span class="step">' + ((params && params.step) || def.step || "") + '</span>' +
    '</div>' +
    '<div class="il-stage">' +
      '<aside class="il-brief" hidden>' +
        '<div class="il-brief-head">' +
          '<span class="il-brief-label">Brief</span>' +
          '<button class="il-brief-toggle" type="button">Hide</button>' +
        '</div>' +
        '<div class="il-brief-body"></div>' +
      '</aside>' +
      '<div class="il-hint"></div>' +
    '</div>' +
    '<div class="il-foot">' +
      '<span class="status">Goal not met yet</span>' +
      '<span class="spacer"></span>' +
      '<span class="il-aux"></span>' +
      '<button class="il-btn ghost" data-act="skip">Skip</button>' +
      '<button class="il-btn go" data-act="go" disabled>Continue</button>' +
    '</div>';
  document.body.appendChild(o);
  return o;
}

function play(id, params) {
  const def = registry.get(id);
  if (!def) { console.warn("[interludes] unknown interlude:", id); return; }
  if (active) active.close(false); // only one at a time; close the prior session
  // a build that threw can leave its overlay behind with no session to close it
  document.querySelectorAll(".il-overlay").forEach((el) => el.remove());

  const overlay = buildOverlay(def, params);
  const stage = overlay.querySelector(".il-stage");
  const hintEl = overlay.querySelector(".il-hint");
  const statusEl = overlay.querySelector(".status");
  const goBtn = overlay.querySelector('[data-act="go"]');
  const skipBtn = overlay.querySelector('[data-act="skip"]');
  const auxWrap = overlay.querySelector('.il-aux');

  // renderer / scene / camera
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // shadowMap.enabled must be set before materials compile; it is not toggled
  // again during a session, only chosen per tier when the session starts
  renderer.shadowMap.enabled = Quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* Without tone mapping anything above 1.0 clips flat to white, which is why
     the case file burned out the moment an environment was added. ACES rolls
     the highlight off instead, so a bright surface still reads as a material.
     Exposure is per scene because the bench and the monument ring should not
     have to share one setting. */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = def.exposure != null ? def.exposure : 0.82;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.4, 6);
  camera.lookAt(0, 0, 0); // frame the scene origin so screen-center rays hit centered objects

  /* Standard three point rig.

     Every scene file declares zero lights of its own, so this is the only
     lighting in the application. A scene can nudge it through def.lighting
     without having to build a rig from scratch. Total illumination is kept
     close to the old two light setup so existing scenes do not shift in
     brightness; the difference is direction and the shadowing key. */
  const L = Object.assign({
    /* These scenes are art directed low key: dark ground, one dominant key,
       deep falloff. Drama comes from range, not from brightness. The fill is
       deliberately well below the key so the shadow side is allowed to go
       dark. */
    hemi: 0.28,                       // soft ambient fill, kept low on purpose
    key: 1.35,                        // the shadow caster, clearly dominant
    rim: 0.26,                        // cool separation from behind
    // a high key keeps shadows short. Long raking shadows look dramatic but
    // they fall across the printed labels the player has to read.
    keyDir: [3.2, 11.5, 5.2],
    rimDir: [-5, 3.5, -6],
    keyColor: 0xffffff,
    rimColor: 0xbcd0ff,
    skyColor: 0xffffff,
    groundColor: 0x404060
  }, def.lighting || {});

  scene.add(new THREE.HemisphereLight(L.skyColor, L.groundColor, L.hemi));

  const key = new THREE.DirectionalLight(L.keyColor, L.key);
  key.position.set(L.keyDir[0], L.keyDir[1], L.keyDir[2]);
  // a scene can opt out: presentational rooms have nothing physical to ground,
  // and their shadows land on near-black surfaces as unexplained dark shapes
  key.castShadow = Quality.shadows && L.shadows !== false;
  if (key.castShadow) {
    key.shadow.mapSize.set(Quality.shadowMapSize, Quality.shadowMapSize);
    // thin boxes (papers, cards, plaques) acne badly; normalBias does more
    // of the work here than a constant depth bias would
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.018;
  }
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(L.rimColor, L.rim);
  rim.position.set(L.rimDir[0], L.rimDir[1], L.rimDir[2]);
  scene.add(rim);

  /* Image based lighting.

     Metalness, clearcoat and low roughness describe how a surface reflects its
     surroundings. With three direct lights and nothing else there are no
     surroundings, so a metal renders black and a clearcoat has nothing to
     catch. Every material change in Phase 2 was invisible until this existed.

     RoomEnvironment is a small procedural box of emissive panels; PMREM
     prefilters it into the roughness mipmaps three.js samples. It is built
     once per session and applied as scene.environment, so it lights materials
     without ever being visible as a background. */
  let envRT = null;
  import("three/addons/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => {
    if (!renderer) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const room = new RoomEnvironment();
    envRT = pmrem.fromScene(room, 0.04);
    scene.environment = envRT.texture;
    /* Low. scene.environment feeds both diffuse irradiance and specular
       reflection, and it is the diffuse half that flattened every scene into an
       even overcast. Kept near the floor here so it barely lifts the ambient,
       then raised per material through envMapIntensity on the surfaces that
       should actually reflect: metal, glass, polished stone, varnish. */
    scene.environmentIntensity = def.envIntensity != null ? def.envIntensity : 1.0;
    room.dispose && room.dispose();
    pmrem.dispose();
  }).catch((e) => {
    console.warn("[interludes] environment map unavailable, materials stay direct-lit", e);
  });

  /* Fog is opt in per scene: def.fog = { color, density }. The backbuffer is
     transparent and the overlay behind it is a radial gradient running from
     #1b2030 to #0b0d12, so the default fog colour sits in that range and
     geometry recedes into the page rather than into a grey haze. */
  if (def.fog) {
    scene.fog = new THREE.FogExp2(
      def.fog.color != null ? def.fog.color : 0x12151f,
      def.fog.density != null ? def.fog.density : 0.035);
  }

  /* Shadow participation is assigned by walking the graph rather than by
     hand editing twelve scene files. Unlit billboards (labels, record cards,
     plaques) opt out entirely: they are MeshBasicMaterial, they ignore
     lighting, and letting them cast would drop hard rectangles across the
     scene. Large flat geometry receives but does not cast, so floors and
     table tops do not waste shadow map area on themselves. */
  /* ---- edges ---------------------------------------------------------
     A perfectly sharp 90 degree edge is the strongest "computer graphics"
     tell there is. No manufactured object has one: every real edge carries a
     small chamfer that catches a bright specular line, and it is that line
     the eye reads as solidity. This replaces the raw boxes.

     RoundedBoxGeometry has a single material group, so anything relying on
     per-face materials keeps its BoxGeometry and stays sharp. */
  function roundedBox(w, h, d, radius, segments) {
    const smallest = Math.min(Math.abs(w), Math.abs(h), Math.abs(d));
    // proportional by default, clamped so a thin panel cannot round itself away
    let r = radius != null ? radius : smallest * 0.09;
    r = Math.max(0.002, Math.min(r, smallest * 0.48));
    // 6 segments across the chamfer: at 3 the fillet itself facets, which
    // defeats the point of having one
    return new RoundedBoxGeometry(w, h, d, segments || 6, r);
  }

  /* A turned part rather than a raw cylinder. Real turned stock has a chamfer
     where the wall meets the end face, and that chamfer is what reads as a
     manufactured edge. Drop-in replacement for CylinderGeometry. */
  function turnedCylinder(rTop, rBot, h, chamfer, segments) {
    const rt = Math.abs(rTop), rb = Math.abs(rBot), hh = h / 2;
    let c = chamfer != null ? chamfer : Math.min(rt, rb, h) * 0.10;
    c = Math.max(0.001, Math.min(c, Math.min(rt, rb) * 0.4, hh * 0.4));
    const pts = [
      [0, -hh], [rb - c, -hh], [rb, -hh + c],
      [rt, hh - c], [rt - c, hh], [0, hh]
    ].map((q) => new THREE.Vector2(Math.max(0, q[0]), q[1]));
    return new THREE.LatheGeometry(pts, segments || 64);
  }

  /* A base that reads as a built object: slab, moulded lip, apron. */
  function plinth(w, h, d, mats, opts) {
    const o = opts || {};
    const top = mats.top || mats, sub = mats.sub || mats.top || mats;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(roundedBox(w, h, d, o.radius), top));
    const lipH = o.lipH != null ? o.lipH : Math.max(0.06, h * 0.34);
    const lip = new THREE.Mesh(roundedBox(w + h * 0.30, lipH, h * 0.55, lipH * 0.35), sub);
    lip.position.set(0, h / 2 - lipH * 0.55, d / 2 + h * 0.12);
    g.add(lip);
    const apron = new THREE.Mesh(roundedBox(w * 0.96, h * 0.95, d * 0.93, h * 0.12), sub);
    apron.position.y = -h * 0.92;
    g.add(apron);
    return g;
  }

  /* Foot plate, capping plate and optional bands: the trim a manufactured bar
     or column would carry. */
  function fitTrim(target, opts) {
    const o = opts || {};
    const w = o.w, d = o.d != null ? o.d : o.w;
    const mat = o.material || material("machinedSteel", { color: 0x8d97a6 });
    const g = new THREE.Group();
    const t = o.plate != null ? o.plate : Math.max(0.04, w * 0.09);
    if (o.foot !== false) {
      const foot = new THREE.Mesh(roundedBox(w * 1.34, t, d * 1.34, t * 0.3), mat);
      foot.position.y = t / 2; g.add(foot);
    }
    if (o.cap !== false) {
      const cap = new THREE.Mesh(roundedBox(w * 1.16, t * 0.8, d * 1.16, t * 0.28), mat);
      cap.name = "trimCap"; g.add(cap);
    }
    for (let i = 1; i <= (o.bands || 0); i++) {
      const b = new THREE.Mesh(roundedBox(w * 1.08, t * 0.45, d * 1.08, t * 0.16), mat);
      b.name = "trimBand" + i; g.add(b);
    }
    return g;
  }

  /* ---- micro-detail ---------------------------------------------------
     The small hardware that separates a modelled object from a shape: bolts
     round a flange, rivets along a seam, feet under a leg, a nameplate screwed
     to a face. Each is a shared geometry instanced many times, so a scene can
     scatter dozens of them for almost nothing.

     They matter at reading distance more than large forms do: the eye uses the
     scale of small repeated parts to judge how big the whole thing is. */

  // one hex-headed bolt with a washer under it
  function boltHead(r, mat, washerMat) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.94, r * 0.85, 6), mat);
    head.position.y = r * 0.5;
    g.add(head);
    const washer = new THREE.Mesh(turnedCylinder(r * 1.5, r * 1.55, r * 0.28, r * 0.07, 24),
                                  washerMat || mat);
    g.add(washer);
    return g;
  }

  /* A ring of bolts round a circular flange or hub. */
  function boltRing(radius, count, size, mat, washerMat) {
    const g = new THREE.Group();
    const proto = boltHead(size, mat, washerMat);
    for (let i = 0; i < count; i++) {
      const b = proto.clone();
      const a = (i / count) * Math.PI * 2;
      b.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      g.add(b);
    }
    return g;
  }

  /* A run of rivets along a seam, laid on the x axis and centred. */
  function rivetLine(length, count, size, mat) {
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(size, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    for (let i = 0; i < count; i++) {
      const r = new THREE.Mesh(geo, mat);
      r.position.x = -length / 2 + (i + 0.5) * (length / count);
      g.add(r);
    }
    return g;
  }

  /* Rubber feet, so a heavy object sits on something rather than floating flush
     against the floor. */
  function footPads(w, d, mat, r) {
    const g = new THREE.Group();
    const rr = r || Math.min(w, d) * 0.06;
    const geo = turnedCylinder(rr, rr * 1.12, rr * 0.7, rr * 0.2, 24);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => {
      const f = new THREE.Mesh(geo, mat);
      f.position.set(c[0] * (w / 2 - rr * 1.6), 0, c[1] * (d / 2 - rr * 1.6));
      g.add(f);
    });
    return g;
  }

  /* A small plate screwed to a face, with four screws. Something to catch a
     highlight and give the surface a sense of scale. */
  function nameplate(w, h, plateMat, screwMat) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(roundedBox(w, h, h * 0.14, h * 0.08), plateMat));
    const sr = h * 0.10;
    const sgeo = turnedCylinder(sr, sr, sr * 0.5, sr * 0.2, 16);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => {
      const sc = new THREE.Mesh(sgeo, screwMat || plateMat);
      sc.rotation.x = Math.PI / 2;
      sc.position.set(c[0] * (w / 2 - sr * 2.2), c[1] * (h / 2 - sr * 2.0), h * 0.10);
      g.add(sc);
    });
    return g;
  }

  /* ---- assemblies ------------------------------------------------------
     Four objects kept turning up as a single primitive across the scenes: a
     switch, an intake slot, a gauge and the mount under a spinning thing.
     Defining them once, with the construction a real one has, means no scene
     has to settle for a box and none of them drift apart. */

  /* A heavy panel toggle. The paddle is returned separately because the scenes
     animate its tilt to show state. */
  function toggleSwitch(o) {
    o = o || {};
    const w = o.w || 0.55, h = o.h || 1.0, d = o.d || 0.34;
    const paint = o.housingMat, steel = o.steelMat, paddleMat = o.paddleMat;
    const g = new THREE.Group();

    const housing = new THREE.Mesh(roundedBox(w * 2.6, h * 0.34, d * 2.3, w * 0.09), paint);
    housing.position.y = h * 0.17;
    g.add(housing);
    const plate = new THREE.Mesh(roundedBox(w * 3.1, h * 0.07, d * 2.8, w * 0.05), steel);
    g.add(plate);
    const pb = boltRing(w * 1.25, 4, w * 0.055, steel);
    pb.position.y = h * 0.04;
    g.add(pb);

    // raised bezel round the slot the paddle swings through
    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.62, w * 0.09, 14, 48), steel);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.y = h * 0.34;
    g.add(bezel);
    // pivot boss with a cheek either side, which is what the paddle turns on
    [-1, 1].forEach((c) => {
      const cheek = new THREE.Mesh(roundedBox(w * 0.22, h * 0.30, d * 0.5, w * 0.05), steel);
      cheek.position.set(c * w * 0.72, h * 0.34, 0);
      g.add(cheek);
    });
    const pin = new THREE.Mesh(turnedCylinder(w * 0.11, w * 0.11, w * 1.6, w * 0.03), steel);
    pin.rotation.z = Math.PI / 2;
    pin.position.y = h * 0.40;
    g.add(pin);

    // the paddle: a shank, a knurled grip band, a finger notch and a tip cap
    const paddle = new THREE.Group();
    paddle.position.y = h * 0.40;
    g.add(paddle);
    const shank = new THREE.Mesh(roundedBox(w, h * 0.72, d, w * 0.16), paddleMat);
    shank.position.y = h * 0.36;
    paddle.add(shank);
    for (let i = 0; i < 7; i++) {
      const knurl = new THREE.Mesh(roundedBox(w * 1.04, h * 0.028, d * 0.30, w * 0.012), steel);
      knurl.position.set(0, h * 0.30 + i * h * 0.05, d * 0.42);
      paddle.add(knurl);
    }
    const notch = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.30, w * 0.07, 12, 32, Math.PI), steel);
    notch.position.set(0, h * 0.66, d * 0.16);
    paddle.add(notch);
    const cap = new THREE.Mesh(turnedCylinder(w * 0.40, w * 0.46, h * 0.13, w * 0.09), steel);
    cap.position.y = h * 0.76;
    paddle.add(cap);
    const collar2 = new THREE.Mesh(turnedCylinder(w * 0.44, w * 0.44, h * 0.07, w * 0.04), steel);
    collar2.position.y = h * 0.10;
    paddle.add(collar2);

    // an indicator lamp in a bezel, and a screwed plate to letter
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(w * 0.13, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
      o.lampMat || steel);
    lamp.position.set(w * 1.02, h * 0.36, d * 1.0);
    g.add(lamp);
    const lampRing = new THREE.Mesh(
      new THREE.TorusGeometry(w * 0.15, w * 0.035, 10, 28), steel);
    lampRing.rotation.x = Math.PI / 2;
    lampRing.position.set(w * 1.02, h * 0.34, d * 1.0);
    g.add(lampRing);
    const tag = nameplate(w * 1.5, h * 0.20, steel, paint);
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(-w * 0.55, h * 0.35, d * 1.35);
    g.add(tag);

    return { group: g, paddle, lamp };
  }

  /* A machine intake: a throat you push something into, with the lead-in
     bezel, guide rollers and bolted-down frame one actually has. */
  function intakeSlot(o) {
    o = o || {};
    const w = o.w || 1.9, h = o.h || 0.22, d = o.d || 1.5;
    const body = o.bodyMat, steel = o.steelMat;
    const g = new THREE.Group();

    g.add(new THREE.Mesh(roundedBox(w, h, d, h * 0.22), body));
    // the throat itself, recessed, so the slot reads as an opening
    const throat = new THREE.Mesh(roundedBox(w * 0.80, h * 0.9, d * 0.42, h * 0.14),
                                  o.throatMat || body);
    throat.position.set(0, h * 0.22, d * 0.16);
    g.add(throat);
    // lead-in bezel: two lips that chamfer down into the throat
    [-1, 1].forEach((c) => {
      const lip = new THREE.Mesh(roundedBox(w * 1.02, h * 0.55, d * 0.16, h * 0.16), steel);
      lip.position.set(0, h * 0.50, d * (0.16 + c * 0.24));
      lip.rotation.x = c * 0.32;
      g.add(lip);
    });
    // guide rollers with end caps, either side of the mouth
    [-1, 1].forEach((c) => {
      const roller = new THREE.Mesh(turnedCylinder(h * 0.34, h * 0.34, w * 0.78, h * 0.08), steel);
      roller.rotation.z = Math.PI / 2;
      roller.position.set(0, h * 0.44, d * (0.16 + c * 0.13));
      g.add(roller);
      [-1, 1].forEach((e) => {
        const endCap = new THREE.Mesh(turnedCylinder(h * 0.46, h * 0.46, h * 0.16, h * 0.05), steel);
        endCap.rotation.z = Math.PI / 2;
        endCap.position.set(e * w * 0.42, h * 0.44, d * (0.16 + c * 0.13));
        g.add(endCap);
      });
    });
    // side rails down the length, a base frame and feet
    [-1, 1].forEach((c) => {
      const rail = new THREE.Mesh(roundedBox(h * 0.34, h * 1.1, d * 0.92, h * 0.10), steel);
      rail.position.set(c * w * 0.50, h * 0.30, 0);
      g.add(rail);
    });
    const frame = new THREE.Mesh(roundedBox(w * 1.16, h * 0.5, d * 1.16, h * 0.14), steel);
    frame.position.y = -h * 0.52;
    g.add(frame);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => {
      const foot = new THREE.Mesh(turnedCylinder(h * 0.32, h * 0.40, h * 0.45, h * 0.09), steel);
      foot.position.set(c[0] * w * 0.48, -h * 0.90, c[1] * d * 0.44);
      g.add(foot);
      const b = boltHead(h * 0.13, steel);
      b.position.set(c[0] * w * 0.50, h * 0.05, c[1] * d * 0.50);
      g.add(b);
    });
    // two indicator lamps on the front apron
    [-1, 1].forEach((c) => {
      const lampRing = new THREE.Mesh(
        new THREE.TorusGeometry(h * 0.22, h * 0.06, 10, 24), steel);
      lampRing.position.set(c * w * 0.30, h * 0.10, d * 0.53);
      g.add(lampRing);
    });
    return { group: g, throat };
  }

  /* The pedestal under something that spins: shaft, bearing housing on a
     bolted flange, column, base and feet. Built along +Y from the floor up. */
  function machineMount(o) {
    o = o || {};
    const r = o.r || 0.3, drop = o.drop || 2.0;
    const paint = o.mat, steel = o.steelMat || o.mat;
    const g = new THREE.Group();

    const bearing = new THREE.Mesh(turnedCylinder(r * 0.9, r * 1.05, r * 1.1, r * 0.16), steel);
    g.add(bearing);
    const flange = new THREE.Mesh(turnedCylinder(r * 1.5, r * 1.5, r * 0.30, r * 0.09), paint);
    flange.position.y = -r * 0.55;
    g.add(flange);
    const fb = boltRing(r * 1.15, 6, r * 0.14, steel);
    fb.position.y = -r * 0.40;
    g.add(fb);
    const neck = new THREE.Mesh(turnedCylinder(r * 0.55, r * 0.80, drop * 0.42, r * 0.10), paint);
    neck.position.y = -r * 0.7 - drop * 0.21;
    g.add(neck);
    const collar = new THREE.Mesh(turnedCylinder(r * 0.95, r * 0.95, r * 0.28, r * 0.08), steel);
    collar.position.y = -r * 0.7 - drop * 0.42;
    g.add(collar);
    const column = new THREE.Mesh(turnedCylinder(r * 0.75, r * 1.15, drop * 0.52, r * 0.12), paint);
    column.position.y = -r * 0.7 - drop * 0.70;
    g.add(column);
    const base = new THREE.Mesh(turnedCylinder(r * 1.9, r * 2.3, r * 0.55, r * 0.14), paint);
    base.position.y = -drop + r * 0.28;
    g.add(base);
    const bb = boltRing(r * 1.6, 8, r * 0.13, steel);
    bb.position.y = -drop + r * 0.55;
    g.add(bb);
    const feet = footPads(r * 4.2, r * 4.2, o.footMat || paint, r * 0.26);
    feet.position.y = -drop;
    g.add(feet);
    return g;
  }

  /* A firm on the floor. Both the market and the concentration room drew one
     as a box with a plate on top, which is the shape of a building and none of
     the detail of one. This is the same silhouette with the parts that make it
     read at a glance: a base course, corner pilasters, banded window strips on
     all four faces, a door, a parapet with a coping and a roof vent. Every
     geometry is built once and shared across the instances, so a row of
     fourteen costs one set of buffers. */
  function blockBuilding(w, h, d, o) {
    o = o || {};
    const body = o.bodyMat, trim = o.trimMat || o.roofMat, glass = o.glassMat || o.roofMat;
    const g = new THREE.Group();

    g.add(new THREE.Mesh(roundedBox(w, h, d, Math.min(w, d) * 0.07), body));
    const course = new THREE.Mesh(roundedBox(w * 1.12, h * 0.10, d * 1.12, w * 0.03), trim);
    course.position.y = -h * 0.46;
    g.add(course);

    // corner pilasters, standing slightly proud of the wall
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => {
      const pil = new THREE.Mesh(roundedBox(w * 0.16, h * 0.90, d * 0.16, w * 0.04), trim);
      pil.position.set(c[0] * w * 0.50, 0, c[1] * d * 0.50);
      g.add(pil);
    });

    // three window bands wrapping all four faces
    const bandZ = roundedBox(w * 0.78, h * 0.11, d * 0.04, w * 0.02);
    const bandX = roundedBox(w * 0.04, h * 0.11, d * 0.78, w * 0.02);
    [0.24, 0.02, -0.20].forEach((f) => {
      [-1, 1].forEach((c) => {
        const bz = new THREE.Mesh(bandZ, glass);
        bz.position.set(0, h * f, c * d * 0.51);
        g.add(bz);
        const bx = new THREE.Mesh(bandX, glass);
        bx.position.set(c * w * 0.51, h * f, 0);
        g.add(bx);
      });
    });

    // a door on the front, with a lintel over it
    const door = new THREE.Mesh(roundedBox(w * 0.26, h * 0.24, d * 0.05, w * 0.02), trim);
    door.position.set(0, -h * 0.34, d * 0.51);
    g.add(door);
    const lintel = new THREE.Mesh(roundedBox(w * 0.36, h * 0.05, d * 0.07, w * 0.02), trim);
    lintel.position.set(0, -h * 0.20, d * 0.52);
    g.add(lintel);

    // parapet: a wall round the roof with a coping on it, and a vent
    const parapet = new THREE.Mesh(roundedBox(w * 1.06, h * 0.09, d * 1.06, w * 0.03), body);
    parapet.position.y = h * 0.52;
    g.add(parapet);
    const coping = new THREE.Mesh(roundedBox(w * 1.16, h * 0.04, d * 1.16, w * 0.02), trim);
    coping.position.y = h * 0.57;
    g.add(coping);
    const vent = new THREE.Mesh(turnedCylinder(w * 0.13, w * 0.16, h * 0.14, w * 0.04), trim);
    vent.position.set(w * 0.20, h * 0.60, -d * 0.16);
    g.add(vent);
    const stack = new THREE.Mesh(roundedBox(w * 0.20, h * 0.20, d * 0.20, w * 0.04), body);
    stack.position.set(-w * 0.20, h * 0.62, d * 0.10);
    g.add(stack);
    return g;
  }

  /* A gauge track: the channel a meter bar runs in, with side rails, end caps
     and graduations, so a bar is a reading rather than a coloured rectangle. */
  function gaugeTrack(w, h, d, trackMat, steelMat, ticks) {
    const g = new THREE.Group();
    const back = new THREE.Mesh(roundedBox(w * 1.5, h * 1.04, d * 0.5, w * 0.16), trackMat);
    back.position.z = -d * 0.7;
    g.add(back);
    [-1, 1].forEach((c) => {
      const rail = new THREE.Mesh(roundedBox(w * 0.24, h * 1.04, d * 1.25, w * 0.09), steelMat);
      rail.position.set(c * w * 0.80, 0, 0);
      g.add(rail);
    });
    [-1, 1].forEach((c) => {
      const cap = new THREE.Mesh(roundedBox(w * 1.9, h * 0.035, d * 1.5, w * 0.10), steelMat);
      cap.position.y = c * h * 0.52;
      g.add(cap);
      const cb = boltRing(w * 0.66, 2, w * 0.10, steelMat);
      cb.position.y = c * h * 0.53;
      g.add(cb);
    });
    const n = ticks || 10;
    for (let i = 0; i <= n; i++) {
      const long = i % 5 === 0;
      const t = new THREE.Mesh(
        roundedBox(long ? w * 0.62 : w * 0.38, h * 0.006, d * 0.3, w * 0.04), steelMat);
      t.position.set(w * 1.02, -h / 2 + (i / n) * h, 0);
      g.add(t);
    }
    return g;
  }

  /* Weld duplicated vertices so smooth shading works across a surface rather
     than stopping at every triangle seam. */
  function smoothGeometry(geo, angleDeg) {
    try {
      const merged = BufferGeometryUtils.mergeVertices(geo);
      merged.computeVertexNormals();
      return merged;
    } catch (e) { return geo; }
  }

  /* ---- material families ----------------------------------------------
     envMapIntensity multiplies with scene.environmentIntensity and scales both
     the diffuse and specular contribution of the environment. That dial is what
     separates "reflective" from "flooded": the scene environment stays neutral
     and each family decides how much of it it may take. */
  const FAMILIES = {
    varnishedWood: { roughness: 0.52, metalness: 0.04, envMapIntensity: 0.18,
                     clearcoat: 0.30, clearcoatRoughness: 0.45, maps: "wood" },
    rawTimber:     { roughness: 0.86, metalness: 0.00, envMapIntensity: 0.08, maps: "wood" },
    paper:         { roughness: 0.94, metalness: 0.00, envMapIntensity: 0.04, maps: "paper" },
    polishedStone: { roughness: 0.40, metalness: 0.05, envMapIntensity: 0.35,
                     clearcoat: 0.35, clearcoatRoughness: 0.25, maps: "marble" },
    machinedSteel: { maps: "cast", roughness: 0.32, metalness: 1.00, envMapIntensity: 1.00, wear: 0.9 },
    brass:         { maps: "cast", roughness: 0.40, metalness: 1.00, envMapIntensity: 0.90, color: 0xb98f4a, wear: 1.1 },
    paintedMetal:  { roughness: 0.45, metalness: 0.00, envMapIntensity: 0.45,
                     clearcoat: 0.55, clearcoatRoughness: 0.30, wear: 0.8 },
    rubber:        { roughness: 0.93, metalness: 0.00, envMapIntensity: 0.06, wear: 0.5 },
    glass:         { roughness: 0.05, metalness: 0.00, envMapIntensity: 1.20,
                     transmission: 1.0, thickness: 0.5, ior: 1.5, transparent: true }
  };

  const familyMaps = {};
  function wearMap(key, tiles, strength) {
    return grayTexture("wear_" + key, 512, 512,
                       surfaces.grime(1, strength == null ? 1 : strength),
                       tiles || 2, tiles || 2);
  }
  function mapsFor(kind) {
    if (familyMaps[kind]) return familyMaps[kind];
    let m = {};
    if (kind === "wood") {
      const h = surfaces.wood(11, 1.1);
      m = { normalMap: normalTexture("f_wood", 512, 512, h, 1.5, 2, 1),
            roughnessMap: grayTexture("f_woodR", 512, 512, h, 2, 1),
            normalScale: new THREE.Vector2(0.5, 0.5) };
    } else if (kind === "paper") {
      m = { normalMap: normalTexture("f_paper", 256, 256, surfaces.paper(0.55), 0.55, 3, 4),
            roughnessMap: grayTexture("f_paperR", 256, 256, surfaces.paper(0.35), 3, 4),
            normalScale: new THREE.Vector2(0.3, 0.3) };
    } else if (kind === "cast") {
      const h = surfaces.cast(1);
      m = { normalMap: normalTexture("f_cast", 512, 512, h, 0.8, 3, 3),
            roughnessMap: grayTexture("f_castR", 512, 512, surfaces.cast(0.7), 3, 3),
            normalScale: new THREE.Vector2(0.22, 0.22) };
    } else if (kind === "marble") {
      const h = surfaces.marble(1);
      m = { normalMap: normalTexture("f_marble", 512, 512, h, 1.1, 3, 1),
            roughnessMap: grayTexture("f_marbleR", 512, 512, h, 3, 1),
            normalScale: new THREE.Vector2(0.45, 0.45) };
    }
    familyMaps[kind] = m;
    return m;
  }

  /* Boards and benches across the modules should read as timber, and as
     different timber: a card table is not a laboratory bench. */
  const WOOD_TONES = { walnut: 0x4a3324, oak: 0x8a6640, teak: 0x71492a,
                       mahogany: 0x5e3324, ash: 0x9c7d58, ebony: 0x2e2620 };

  function material(family, overrides) {
    const f = FAMILIES[family];
    if (!f) { console.warn("[interludes] unknown material family:", family);
              return new THREE.MeshStandardMaterial(overrides || {}); }
    const o = Object.assign({}, f, overrides || {});
    const kind = o.maps; delete o.maps;
    const wear = o.wear; delete o.wear;
    if (kind) Object.assign(o, mapsFor(kind), overrides || {});
    if (!kind && wear && !o.roughnessMap) o.roughnessMap = wearMap(String(wear), 2, wear);
    const physical = o.clearcoat != null || o.transmission != null || o.ior != null;
    return physical ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o);
  }

  /* ctx.wood("oak", { repeat: [4, 2] }). Maps are shared, so a different repeat
     clones the texture view: same image, different tiling. */
  function wood(tone, opts) {
    const o = Object.assign({}, opts || {});
    const rep = o.repeat; delete o.repeat;
    const raw = o.raw; delete o.raw;
    const m = material(raw ? "rawTimber" : "varnishedWood",
                       Object.assign({ color: WOOD_TONES[tone] != null ? WOOD_TONES[tone] : WOOD_TONES.oak }, o));
    if (rep && m.normalMap) {
      const n = m.normalMap.clone(); n.repeat.set(rep[0], rep[1]); n.needsUpdate = true;
      const r = m.roughnessMap.clone(); r.repeat.set(rep[0], rep[1]); r.needsUpdate = true;
      m.normalMap = n; m.roughnessMap = r;
    }
    return m;
  }

  /* What every scene's local mat() helper routes through, so nothing takes the
     environment by accident and everything gets a faint wear layer. */
  function tunedStandard(opts) {
    const o = Object.assign({ envMapIntensity: 0.10 }, opts || {});
    if (!o.roughnessMap && !o.map && o.transparent !== true) {
      o.roughnessMap = wearMap("generic", 3, 0.55);
    }
    const physical = o.clearcoat != null || o.transmission != null || o.ior != null;
    return physical ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o);
  }

  const _bbSize = new THREE.Vector3();
  function applyShadowFlags(root) {
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const unlit = mats.length > 0 && mats.every(function (m) { return m && m.isMeshBasicMaterial; });
      if (unlit) {
        /* Readable surfaces are exempt from fog. Labels, readouts, record
           cards and plaques are unlit billboards carrying text the player has
           to read; letting atmosphere wash them out trades comprehension for
           mood, and this is a study instrument first. */
        mats.forEach(function (m) {
          if (!m) return;
          // exempt from fog and from tone mapping: these carry text and must
          // render exactly as they were drawn, whatever the scene exposure is
          if (m.fog) { m.fog = false; m.needsUpdate = true; }
          if (m.toneMapped !== false) { m.toneMapped = false; m.needsUpdate = true; }
        });
        // an unlit mesh can still be a solid object worth grounding: shadow
        // casting reads depth, not shading, so a scene may opt back in
        o.castShadow = o.userData.forceCast === true;
        o.receiveShadow = false;
        return;
      }
      if (!Quality.shadows) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      o.geometry.boundingBox.getSize(_bbSize);
      const wide = _bbSize.x * o.scale.x > 6 || _bbSize.z * o.scale.z > 6;
      const flat = _bbSize.y * o.scale.y < 0.7;
      o.castShadow = !(wide && flat);
      o.receiveShadow = true;
    });
  }

  /* The shadow camera is fitted to what actually casts, so small scenes get
     a tight, sharp map instead of a blurry one stretched over empty space. */
  const _sbox = new THREE.Box3(), _sc = new THREE.Vector3(), _ss = new THREE.Vector3();
  const _keyDir = new THREE.Vector3();
  function fitShadowCamera() {
    if (!key.castShadow) return;
    _sbox.makeEmpty();
    scene.traverse(function (o) { if (o.isMesh && o.castShadow) _sbox.expandByObject(o); });
    if (_sbox.isEmpty()) return;
    _sbox.getCenter(_sc); _sbox.getSize(_ss);
    const r = Math.max(_ss.x, _ss.y, _ss.z) * 0.72 + 1;
    _keyDir.set(L.keyDir[0], L.keyDir[1], L.keyDir[2]).normalize();
    key.position.copy(_sc).addScaledVector(_keyDir, r * 2.6);
    key.target.position.copy(_sc);
    key.target.updateMatrixWorld();
    const c = key.shadow.camera;
    c.left = -r; c.right = r; c.top = r; c.bottom = -r;
    c.near = 0.1; c.far = r * 6;
    c.updateProjectionMatrix();
  }

  /* Camera offset layer.

     Scenes own their own framing: each one writes camera.position directly
     from its fitCamera()/frameScene(). Anything that wants to nudge the
     camera (a gavel strike, an eased sweep between scenes) therefore cannot
     write to camera.position, because the scene's next fit would overwrite
     it. Instead the offset is applied around the render call and removed
     immediately after, so the scene's own transform is never disturbed. */
  const camOffset = new THREE.Vector3();
  const _shakeVec = new THREE.Vector3();
  const _camSaved = new THREE.Vector3();
  let shakeLeft = 0, shakeDur = 0, shakeAmp = 0;

  /* Phase 5 — the entry sweep.

     A scene used to appear already framed, which made the term read as fifteen
     loading screens rather than one place. The camera now starts pulled back
     along its own view axis and settles into the fitted pose.

     It rides the offset layer rather than writing camera.position, which is the
     whole reason that layer exists: the offset is added around the draw and
     removed after, so frameScene() and fitCamera() are never disturbed and a
     resize mid-sweep still re-fits correctly. Because the pull-back is computed
     from the camera's own orientation, it works in every scene without any of
     them knowing about it. */
  const INTRO_DUR = 0.7;
  let introLeft = 0;
  const introVec = new THREE.Vector3();
  const _introBack = new THREE.Vector3();
  const _introUp = new THREE.Vector3();

  function beginIntro() {
    if (prefersReducedMotion()) { introLeft = 0; return; }
    camera.updateMatrixWorld();
    // camera local +Z points backwards out of the screen
    _introBack.set(0, 0, 1).applyQuaternion(camera.quaternion);
    _introUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const d = Math.max(1, camera.position.length());
    introVec.copy(_introBack).multiplyScalar(d * 0.17)
            .addScaledVector(_introUp, d * 0.035);
    introLeft = INTRO_DUR;
  }

  function updateCamOffset(dt) {
    camOffset.set(0, 0, 0);
    if (introLeft > 0) {
      introLeft = Math.max(0, introLeft - dt);
      const t = 1 - introLeft / INTRO_DUR;          // 0 at the start, 1 at rest
      // ease-in-out-cubic: starts still, accelerates, decelerates into place
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camOffset.addScaledVector(introVec, 1 - e);
    }
    if (shakeLeft > 0) {
      shakeLeft = Math.max(0, shakeLeft - dt);
      const k = shakeDur > 0 ? shakeLeft / shakeDur : 0;
      const a = shakeAmp * k * k;                       // quadratic decay
      // shake across the camera's own screen axes, not world axes
      // add, not set: an impact during the entry sweep must not cancel it
      _shakeVec.set((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a, 0)
               .applyQuaternion(camera.quaternion);
      camOffset.add(_shakeVec);
    }
  }

  /* ---- Phase 4: impact debris -------------------------------------------
     A hard contact that produces nothing but a sound and a shake reads as a
     scripted animation. A little dust thrown off the point of impact is what
     makes it read as two objects meeting. One pool, allocated once, reused by
     whatever asks for it. */
  const DUST_MAX = 90;
  let dustGeo = null, dustPts = null, dustMat = null;
  const dustLife = new Float32Array(DUST_MAX);
  const dustMaxLife = new Float32Array(DUST_MAX);
  const dustVel = new Float32Array(DUST_MAX * 3);
  let dustNext = 0, dustActive = 0;

  function dustSprite() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.45)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function ensureDust() {
    if (dustPts) return;
    dustGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(DUST_MAX * 3);
    // park the whole pool far below the floor until it is used
    for (let i = 0; i < DUST_MAX; i++) pos[i * 3 + 1] = -9999;
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dustMat = new THREE.PointsMaterial({
      size: 0.075, map: dustSprite(), transparent: true, opacity: 0.0,
      depthWrite: false, sizeAttenuation: true, color: 0xcbbfa8, fog: false
    });
    dustPts = new THREE.Points(dustGeo, dustMat);
    dustPts.frustumCulled = false;    // the pool spans wherever it was fired
    dustPts.renderOrder = 4;
    scene.add(dustPts);
  }

  function burst(pos, opts) {
    const o = opts || {};
    ensureDust();
    /* Reduced motion does not mean no feedback, it means no violent motion, so
       the dust is thinned and slowed rather than removed. The camera shake is
       separately suppressed in shake(). */
    const calm = prefersReducedMotion();
    const n = Math.round((o.count || 26) * (calm ? 0.4 : 1));
    const spread = (o.spread || 1.6) * (calm ? 0.5 : 1);
    const p = dustGeo.attributes.position.array;
    for (let k = 0; k < n; k++) {
      const i = dustNext; dustNext = (dustNext + 1) % DUST_MAX;
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      // outward and up, biased to a shallow cone so it skims the surface
      const a = Math.random() * Math.PI * 2;
      const up = 0.35 + Math.random() * 0.75;
      const out = (0.5 + Math.random() * 0.9) * spread;
      dustVel[i * 3] = Math.cos(a) * out;
      dustVel[i * 3 + 1] = up * spread;
      dustVel[i * 3 + 2] = Math.sin(a) * out;
      dustMaxLife[i] = dustLife[i] = (o.life || 0.55) * (0.6 + Math.random() * 0.7);
    }
    dustActive = Math.max(dustActive, 1);
    dustGeo.attributes.position.needsUpdate = true;
  }

  function updateDust(dt) {
    if (!dustPts) return;
    const p = dustGeo.attributes.position.array;
    let alive = 0, maxL = 0;
    for (let i = 0; i < DUST_MAX; i++) {
      if (dustLife[i] <= 0) continue;
      dustLife[i] -= dt;
      if (dustLife[i] <= 0) { p[i * 3 + 1] = -9999; continue; }
      alive++;
      maxL = Math.max(maxL, dustLife[i] / dustMaxLife[i]);
      dustVel[i * 3 + 1] -= 2.6 * dt;                 // gravity
      const drag = Math.max(0, 1 - 1.9 * dt);          // air, so it settles
      dustVel[i * 3] *= drag; dustVel[i * 3 + 2] *= drag;
      p[i * 3] += dustVel[i * 3] * dt;
      p[i * 3 + 1] += dustVel[i * 3 + 1] * dt;
      p[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
    }
    dustActive = alive;
    // one shared opacity, driven by the longest-lived particle in flight
    dustMat.opacity = alive ? 0.5 * maxL : 0;
    dustGeo.attributes.position.needsUpdate = true;
  }

  /* ---- Phase 4: hover affordance ----------------------------------------
     Most pickables in these scenes are invisible proxies — a big box over a
     tower, a cylinder around a wheel — because that is what makes them easy to
     click. Outlining the proxy would draw a rim round thin air, so a pickable
     names the thing the player actually sees with userData.rimTarget, and
     anything that does not name one gets no rim rather than a wrong one.

     A single Mesh target gets a real Fresnel rim: the same geometry drawn
     again, additively, brightest where the surface turns away from the eye.
     That reads as light catching an edge rather than as a UI outline. A Group
     target cannot share one geometry, so it gets a small emissive lift
     instead, which is the same idea carried by the materials it already has. */
  const RIM_COLOR = new THREE.Color(0xffe6a8);
  const _lift = new THREE.Vector3();
  let rimMesh = null, hovered = null, hoverT = 0;
  const _emisSaved = new Map();

  function ensureRim() {
    if (rimMesh) return;
    const m = new THREE.ShaderMaterial({
      uniforms: { rimColor: { value: RIM_COLOR }, rimStrength: { value: 0 } },
      vertexShader:
        "varying vec3 vN; varying vec3 vV;\n" +
        "void main() {\n" +
        "  vec4 wp = modelMatrix * vec4(position, 1.0);\n" +
        "  vN = normalize(mat3(modelMatrix) * normal);\n" +
        "  vV = normalize(cameraPosition - wp.xyz);\n" +
        "  gl_Position = projectionMatrix * viewMatrix * wp;\n" +
        "}",
      fragmentShader:
        "uniform vec3 rimColor; uniform float rimStrength;\n" +
        "varying vec3 vN; varying vec3 vV;\n" +
        "void main() {\n" +
        "  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));\n" +
        "  gl_FragColor = vec4(rimColor, pow(f, 2.4) * rimStrength);\n" +
        "}",
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    rimMesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
    rimMesh.visible = false;
    rimMesh.frustumCulled = false;
    rimMesh.renderOrder = 3;
    scene.add(rimMesh);
  }

  function rimTargetOf(hit) {
    if (!hit || !hit.object) return null;
    const t = hit.object.userData && hit.object.userData.rimTarget;
    if (t) return t;
    // a pickable that is drawn at all can speak for itself; an invisible proxy
    // has nothing to light, so it opts out
    const m = hit.object.material;
    const drawn = m && (Array.isArray(m) ? m.some((x) => x && x.visible !== false)
                                         : m.visible !== false);
    return drawn ? hit.object : null;
  }

  function setHovered(target) {
    if (target === hovered) return;
    // put whatever we lifted back exactly as we found it
    _emisSaved.forEach((v, mat) => {
      if (mat.emissive) mat.emissive.copy(v.color);
      mat.emissiveIntensity = v.intensity;
    });
    _emisSaved.clear();
    // and set down whatever we picked up
    if (hovered && hovered.userData._homeZ) {
      hovered.position.copy(hovered.userData._homeZ);
    }
    hovered = target;
    hoverT = 0;
    // a soft tick as the pointer crosses onto something live. Throttled in the
    // mixer, because this fires on every boundary crossing.
    if (hovered) sfx("hover");
    if (!hovered) { if (rimMesh) rimMesh.visible = false; return; }
    if (hovered.isMesh && hovered.geometry) {
      ensureRim();
      rimMesh.geometry = hovered.geometry;
      rimMesh.visible = true;
    } else {
      if (rimMesh) rimMesh.visible = false;
      hovered.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((mat) => {
          if (!mat || !mat.emissive || _emisSaved.has(mat)) return;
          _emisSaved.set(mat, {
            color: mat.emissive.clone(),
            intensity: mat.emissiveIntensity == null ? 1 : mat.emissiveIntensity
          });
        });
      });
    }
  }

  /* ---- press feedback --------------------------------------------------
     A click that changes a number somewhere else is information; a click that
     moves the thing under the cursor is contact. Every pickable gets this,
     wired once here rather than per scene, for the same reason the click sound
     is: nothing can be missed by omission.

     It is a critically-damped spring on scale, not a tween, so a rapid series
     of clicks compounds into one continuous motion instead of restarting and
     snapping. Scenes that animate their own scale (the antitrust buttons
     beckon, the ward wheel pulses) are left alone via userData.noPunch. */
  const punches = [];

  function punch(obj, depth) {
    if (!obj || obj.userData.noPunch) return;
    let p = punches.find((q) => q.obj === obj);
    if (!p) {
      p = { obj: obj, base: obj.scale.clone(), v: 0, x: 0 };
      punches.push(p);
    }
    p.v -= (depth || 0.06) * 26;      // a shove inward; the spring does the rest
  }

  function updatePunches(dt) {
    for (let i = punches.length - 1; i >= 0; i--) {
      const p = punches[i];
      // spring toward zero displacement, damped just short of oscillating
      p.v += (-p.x * 190 - p.v * 19) * dt;
      p.x += p.v * dt;
      if (Math.abs(p.x) < 0.0004 && Math.abs(p.v) < 0.004) {
        p.obj.scale.copy(p.base);
        punches.splice(i, 1);
        continue;
      }
      p.obj.scale.set(p.base.x * (1 + p.x), p.base.y * (1 + p.x), p.base.z * (1 + p.x));
    }
  }

  function updateHover(dt) {
    if (!hovered) {
      if (rimMesh && rimMesh.visible) rimMesh.material.uniforms.rimStrength.value = 0;
      return;
    }
    hoverT = Math.min(1, hoverT + dt * 6);
    const k = hoverT * hoverT * (3 - 2 * hoverT);     // smoothstep in
    /* A flat card facing the camera has no Fresnel to speak of — the surface
       never turns away from the eye — so a rim does nothing for it. What makes
       a card read as an object lying on a desk is picking it up, so anything
       carrying userData.hoverLift rises toward the camera instead. */
    if (hovered.userData.hoverLift) {
      if (!hovered.userData._homeZ) hovered.userData._homeZ = hovered.position.clone();
      _lift.copy(camera.position).sub(hovered.userData._homeZ).normalize();
      hovered.position.copy(hovered.userData._homeZ)
             .addScaledVector(_lift, hovered.userData.hoverLift * k);
    }
    if (rimMesh && rimMesh.visible) {
      hovered.updateWorldMatrix(true, false);
      rimMesh.matrix.copy(hovered.matrixWorld);
      rimMesh.matrixAutoUpdate = false;
      rimMesh.material.uniforms.rimStrength.value = 0.55 * k;
    } else {
      _emisSaved.forEach((v, mat) => {
        mat.emissive.copy(v.color).lerp(RIM_COLOR, 0.55 * k);
        mat.emissiveIntensity = v.intensity + 0.30 * k;
      });
    }
  }

  /* Held here rather than created inline on ctx, because the label solver reads
     it and runs from the frame loop — reaching it through `ctx` would mean a
     live reference to a const declared further down. That exact pattern already
     cost this file once, when resize() read `composer` before its declaration
     and play() aborted with the scene still reporting a clean build. */
  const pickables = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = Object.create(null);
  let completed = false;
  // Declared here, not next to buildComposer(), because resize() runs during
  // setup and reads `composer`. A `let` further down leaves it in the temporal
  // dead zone at that point and play() aborts before the render loop starts.
  let torn = false;                             // teardown is idempotent
  /* Identity for this session, created here and published at the end of play().
     teardown() clears the global `active` only if it still points at *this*
     session. Without that check a scene switched during the exit fade would be
     killed by its predecessor: play() starts the new session, then the old
     one's 220ms fade timer fires and nulls `active` out from under it. */
  const session = {};
  let composer = null, composerState = "idle";   // idle | loading | ready | failed
  // master switch for the composer. Off by default until Phase 3 lands real
  // passes; flipped at runtime via Interludes.setPost() during verification.
  let postEnabled = Interludes_postDefault;
  let actionHandler = null; // when set, the footer button runs this instead of closing
  // optional extra footer buttons, used by scenes that need steps of their own
  // (walking back through cases, withdrawing a ruling)

  // ---- shared high-DPI canvas textures -------------------------------
  // Every scene used to build its own fixed-size canvas, which went soft on
  // high-density displays and blurred badly on anything viewed at an angle.
  // One implementation here, supersampled and anisotropically filtered, keeps
  // text crisp everywhere.
  const maxAniso = renderer.capabilities.getMaxAnisotropy
    ? renderer.capabilities.getMaxAnisotropy() : 1;
  const texScale = Math.min(4, Math.max(2, (window.devicePixelRatio || 1) * 2));

  // apply the same filtering to a texture a scene built for itself
  function tune(t) {
    t.anisotropy = maxAniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }

  function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = Math.round(w * texScale);
    c.height = Math.round(h * texScale);
    const g = c.getContext("2d");
    g.scale(texScale, texScale);
    draw(g, w, h);                       // draw in logical units
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = maxAniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }

  /* ---- procedural surface maps -------------------------------------
     No texture assets exist and none are being introduced: the build is
     self-contained and every surface so far is drawn on a canvas. These
     generate height, normal and roughness maps at load.

     Results are cached for the life of the session, because scenes rebuild
     often (the courtroom redresses on every case) and a 512x512 normal map
     is a quarter of a million pixels of JavaScript. */
  const procCache = new Map();

  function procCanvas(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    if (draw) draw(c.getContext("2d"), w, h);
    return c;
  }

  function repeatTex(tex, rx, ry) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rx || 1, ry || rx || 1);
    return tune(tex);
  }

  // write a grayscale field from a per-pixel function returning 0..1
  function field(g, w, h, fn) {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = fn(x, y);
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        const b = (v * 255) | 0, i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
  }

  // grayscale map, used for roughness
  function grayTexture(key, w, h, fn, rx, ry) {
    const k = "g:" + key;
    if (procCache.has(k)) return procCache.get(k);
    const t = repeatTex(new THREE.CanvasTexture(
      procCanvas(w, h, (g) => field(g, w, h, fn))), rx, ry);
    procCache.set(k, t);
    return t;
  }

  /* Tangent space normal map derived from the same height function, by
     central differences. Sampling wraps, so a tiled surface has no seam. */
  function normalTexture(key, w, h, fn, strength, rx, ry) {
    const k = "n:" + key;
    if (procCache.has(k)) return procCache.get(k);
    const H = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = fn(x, y);
    const at = (x, y) => H[(((y % h) + h) % h) * w + (((x % w) + w) % w)];
    const s = strength == null ? 2 : strength;
    const out = procCanvas(w, h);
    const g = out.getContext("2d");
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * s;
        const dy = (at(x, y + 1) - at(x, y - 1)) * s;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * w + x) * 4;
        img.data[i]     = ((-dx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const t = repeatTex(new THREE.CanvasTexture(out), rx, ry);
    procCache.set(k, t);
    return t;
  }

  /* Height functions. All are periodic in x and y so they tile cleanly. */
  const TAU = Math.PI * 2;
  const surfaces = {
    /* Sand-cast metal. Wood and paper had height functions and metal did not,
       which is why every brass and steel surface in the game was mathematically
       perfect and read as plastic: a flat surface with a single roughness
       reflects the light identically everywhere, and the eye takes that as
       injection moulding. Real cast brass has slow blotches from the mould and
       a fine tooth over the top. Both are here, and both are tiny — this is
       meant to break up a highlight, not to look dirty. */
    cast(amp) {
      const a = amp == null ? 1 : amp;
      return (x, y) => {
        const u = (x / 512) * TAU, v = (y / 512) * TAU;
        const blotch = Math.sin(u * 3.1 + Math.sin(v * 2.3) * 1.4) * 0.5 +
                       Math.sin(v * 4.7 + Math.cos(u * 1.9) * 1.1) * 0.32 +
                       Math.sin((u + v) * 7.3) * 0.16;
        return 0.5 + blotch * 0.14 * a + (Math.random() - 0.5) * 0.30 * a;
      };
    },
    // fine tooth of thick paper: white noise, no structure
    paper(amp) {
      const a = amp == null ? 0.5 : amp;
      return () => 0.5 + (Math.random() - 0.5) * a;
    },
    // long grain with a slow wander across the plank
    wood(rings, wobble) {
      const r = rings || 11, wo = wobble == null ? 1.1 : wobble;
      return (x, y) => {
        const u = (x / 512) * TAU, v = (y / 512) * TAU;
        const g1 = Math.sin(u * r + Math.sin(v * 2) * wo);
        const g2 = Math.sin(u * r * 2.7 + Math.sin(v * 3) * 0.6) * 0.35;
        return 0.5 + (g1 + g2) * 0.16 + (Math.random() - 0.5) * 0.05;
      };
    },
    /* Wear and grime. Real surfaces are dirtier in the recesses and polished
       where hands pass. Used to vary roughness rather than colour, so it reads
       as a used surface instead of a dirty texture. */
    grime(scale, strength) {
      const k = scale || 1, a = strength == null ? 1 : strength;
      return (x, y) => {
        const u = (x / 512) * TAU * k, v = (y / 512) * TAU * k;
        let t = Math.sin(u * 1.3 + Math.sin(v * 0.9) * 1.7) * 0.6;
        t += Math.sin(u * 2.7 + v * 1.9) * 0.3;
        t += Math.sin(u * 5.1 + Math.sin(v * 3.3) * 0.8) * 0.16;
        t += (Math.random() - 0.5) * 0.10;
        return 0.5 + t * 0.28 * a;
      };
    },
    // turbulent veining for polished stone
    marble(scale) {
      const k = scale || 1;
      return (x, y) => {
        const u = (x / 512) * TAU * k, v = (y / 512) * TAU * k;
        let t = Math.sin(u * 3 + Math.sin(v * 2) * 1.6);
        t += 0.5 * Math.sin(u * 7 + Math.sin(v * 5) * 1.1);
        t += 0.25 * Math.sin(u * 13 + v * 3);
        return 0.5 + t * 0.15;
      };
    }
  };

  // the readout card every gameplay scene uses
  /* ---- the plaque painter ------------------------------------------------
     One painter for every readout in the game. Before this there were nineteen
     of them and the differences between modules were accidents rather than
     decisions.

     Two rules do most of the work.

     Aspect. The canvas is 2:1 and every plane it is mapped onto is 2:1, so a
     glyph is never scaled unevenly. Four planes used to break that — the worst
     was 5.63 x 0.97, a 5.8:1 plane carrying a 2:1 image, which squashed the
     text to about a third of its natural width. Those are normalised at the
     call sites rather than by teaching the painter to letterbox, because a
     plaque that is the wrong shape is a layout mistake, not a paint mistake.

     Size. The canvas is a fixed 512 wide, so physical text size is set by the
     plane width. That makes the width ladder in PLAQUE meaningful: a label is
     `md` because it is a normal readout, not because someone typed 2.15.

     Type pairing, as agreed: Georgia where the thing is meant to read as a
     document, system-ui where it is an instrument. Instruments are the default
     here; `doc: true` switches. */
  const PLAQUE = { xs: [2.10, 1.05], sm: [2.60, 1.30], md: [3.20, 1.60],
                   lg: [4.00, 2.00], xl: [5.00, 2.50] };
  /* `xs` exists for captions packed into a row. The hall of systems puts seven
     names across a deck 14 units wide: at `md` that is 22 units of plaque in 14
     units of space, they cannot all fit, and the layout solver responds by
     stacking them up over the bars they are labelling. Cohesion is a matter of
     role, not of one width everywhere — a caption in a dense row is a different
     job from a standalone readout, and sizing it as one is what keeps the row
     readable. */

  const UI_INSTRUMENT = "system-ui, sans-serif";
  const UI_DOCUMENT = "Georgia, 'Times New Roman', serif";

  function roundRectPath(g, x, y, w, h, r) {
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
    g.beginPath();                                   // older canvas, same shape
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function labelTexture(l) {
    const W = 512, H = 256;
    const accent = l.accent || "#9aa6b4";
    const fam = l.doc ? UI_DOCUMENT : UI_INSTRUMENT;
    // framing is the default now; a few places genuinely read better without it
    const framed = l.box !== false;
    return canvasTexture(W, H, (g) => {
      g.clearRect(0, 0, W, H);
      g.textAlign = "center";

      if (framed) {
        const M = 7, R = 16;
        /* A flat fill reads as a sticker. A shallow vertical gradient reads as
           a plate catching light from above, which is what everything else in
           these scenes is doing. */
        const grad = g.createLinearGradient(0, M, 0, H - M);
        grad.addColorStop(0, "rgba(26,31,42,.95)");
        grad.addColorStop(1, "rgba(10,13,19,.95)");
        g.fillStyle = grad;
        roundRectPath(g, M, M, W - M * 2, H - M * 2, R);
        g.fill();

        // accent bar along the top: the module's colour, stated once
        g.save();
        roundRectPath(g, M, M, W - M * 2, H - M * 2, R);
        g.clip();
        g.fillStyle = accent;
        g.fillRect(M, M, W - M * 2, 7);
        g.restore();

        // hairline inside the edge, then the accent border outside it
        g.strokeStyle = "rgba(255,255,255,.10)";
        g.lineWidth = 2;
        roundRectPath(g, M + 3, M + 3, W - M * 2 - 6, H - M * 2 - 6, R - 3);
        g.stroke();
        g.strokeStyle = accent;
        g.globalAlpha = 0.55;
        g.lineWidth = 3;
        roundRectPath(g, M, M, W - M * 2, H - M * 2, R);
        g.stroke();
        g.globalAlpha = 1;
      }

      const PAD = 34;
      const maxW = W - PAD * 2;

      // title / eyebrow
      g.fillStyle = accent;
      g.font = "bold " + (l.topSize || 30) + "px " + fam;
      if (g.letterSpacing !== undefined) g.letterSpacing = "1.5px";
      if (l.top) g.fillText(l.top, W / 2, l.big ? 68 : (l.sub ? 108 : 140), maxW);
      if (g.letterSpacing !== undefined) g.letterSpacing = "0px";

      // the reading itself
      if (l.big) {
        g.fillStyle = l.bigColor || "#fff";
        g.font = "bold " + (l.bigSize || 84) + "px " + fam;
        g.fillText(l.big, W / 2, 166, maxW);
      }

      // qualifier
      if (l.sub) {
        g.fillStyle = "#94a0b0";
        g.font = (l.doc ? "italic " : "") + "23px " + fam;
        g.fillText(l.sub, W / 2, l.big ? 214 : 152, maxW);
      }
    });
  }

  /* ---- document surfaces -------------------------------------------------
     The record rooms carried twelve painters between them — a header, a card
     and a plaque written out separately for each of the four rooms — which is
     why they drifted into looking like four different documents and none of
     them like a designed one. These two replace all of it.

     Canvas size is derived from the plane, so the aspect always matches and
     nothing is resampled unevenly, and the resolution scales with the surface
     rather than being a number someone picked.

     Georgia carries anything that is meant to read as a document; system-ui
     carries the parts that are instrument readings — the status line, the
     figure on a stat card. That is the pairing applied rather than the two
     fonts being alternated by habit. */

  function wrapLines(g, text, maxW, maxLines) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
        if (maxLines && lines.length >= maxLines) return lines;
      } else line = t;
    }
    if (line) lines.push(line);
    return maxLines ? lines.slice(0, maxLines) : lines;
  }

  /* A sheet of paper with something printed on it. The status colour arrives as
     a spine down the left edge rather than as a box drawn round everything: a
     full coloured stroke is what made these read as web widgets instead of
     documents, and it fought the type for attention. */
  function docCard(w, h, o) {
    const PX = 210;                                   // px per world unit
    const W = Math.round(w * PX), H = Math.round(h * PX);
    const accent = o.accent || "#1d6b3a";
    return canvasTexture(W, H, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#f8f4e9");
      grad.addColorStop(1, "#ebe4d3");
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);

      const spine = Math.max(6, Math.round(W * 0.018));
      g.fillStyle = accent;
      g.fillRect(0, 0, spine, H);
      g.strokeStyle = "rgba(30,26,18,.22)";
      g.lineWidth = 2;
      g.strokeRect(1, 1, W - 2, H - 2);

      const pad = Math.round(W * 0.072) + spine;
      const right = W - Math.round(W * 0.06);
      const maxW = right - pad;
      const S = W / 600;                              // one scale for all type
      let y = Math.round(H * 0.145);

      // eyebrow, then a hairline: the masthead of a small document
      g.textAlign = "left";
      g.fillStyle = accent;
      g.font = "bold " + Math.round(27 * S) + "px system-ui, sans-serif";
      if (g.letterSpacing !== undefined) g.letterSpacing = Math.round(1.6 * S) + "px";
      if (o.eyebrow) g.fillText(o.eyebrow, pad, y);
      if (g.letterSpacing !== undefined) g.letterSpacing = "0px";
      y += Math.round(14 * S);
      g.strokeStyle = "rgba(30,26,18,.20)";
      g.lineWidth = Math.max(1, Math.round(1.5 * S));
      g.beginPath(); g.moveTo(pad, y); g.lineTo(right, y); g.stroke();
      y += Math.round(34 * S);

      // the dominant element: a document has a title, a stat card has a figure
      if (o.value) {
        g.fillStyle = "#15161a";
        g.font = "bold " + Math.round(80 * S) + "px system-ui, sans-serif";
        g.fillText(o.value, pad, y + Math.round(52 * S));
        y += Math.round(78 * S);
      } else if (o.title) {
        g.fillStyle = "#15161a";
        g.font = "bold " + Math.round(32 * S) + "px Georgia, serif";
        for (const ln of wrapLines(g, o.title, maxW, 3)) {
          g.fillText(ln, pad, y); y += Math.round(38 * S);
        }
        y += Math.round(4 * S);
      }

      if (o.meta) {
        g.fillStyle = "#40464e";
        g.font = "italic " + Math.round(22 * S) + "px Georgia, serif";
        for (const ln of wrapLines(g, o.meta, maxW, 2)) {
          g.fillText(ln, pad, y); y += Math.round(29 * S);
        }
      }

      // the ruling: a chip, so it reads as a stamp on the document
      if (o.status) {
        y += Math.round(20 * S);
        g.font = "bold " + Math.round(24 * S) + "px system-ui, sans-serif";
        const tw = g.measureText(o.status).width;
        const chipH = Math.round(30 * S);
        g.fillStyle = accent;
        g.globalAlpha = 0.13;
        roundRectPath(g, pad - Math.round(9 * S), y - Math.round(21 * S),
                      tw + Math.round(18 * S), chipH, Math.round(6 * S));
        g.fill();
        g.globalAlpha = 1;
        g.fillStyle = accent;
        g.fillText(o.status, pad, y);
        y += Math.round(30 * S);
      }

      if (o.body) {
        y += Math.round(14 * S);
        g.strokeStyle = "rgba(30,26,18,.18)";
        g.beginPath(); g.moveTo(pad, y); g.lineTo(right, y); g.stroke();
        y += Math.round(30 * S);
        if (o.bodyLabel) {
          g.fillStyle = "#7a6320";
          g.font = "bold " + Math.round(17 * S) + "px system-ui, sans-serif";
          g.fillText(o.bodyLabel, pad, y);
          y += Math.round(28 * S);
        }
        g.fillStyle = "#171a1f";
        g.font = Math.round(20 * S) + "px Georgia, serif";
        for (const ln of wrapLines(g, o.body, maxW)) {
          if (y > H - Math.round(24 * S)) break;
          g.fillText(ln, pad, y); y += Math.round(27 * S);
        }
      }

      if (o.footer) {
        g.fillStyle = "#6f6a5d";
        g.font = "italic " + Math.round(19 * S) + "px system-ui, sans-serif";
        g.fillText(o.footer, pad, H - Math.round(20 * S));
      }
    });
  }

  /* The dark panel a record room opens with. Masthead, rule, standfirst — the
     shape of a front page, so the room reads as a report rather than as a box
     of text floating over a scene. */
  function docPanel(w, h, o) {
    const PX = 150;
    const W = Math.round(w * PX), H = Math.round(h * PX);
    const accent = o.accent || "#fffb00";
    return canvasTexture(W, H, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(24,29,40,.96)");
      grad.addColorStop(1, "rgba(11,14,20,.96)");
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.fillStyle = accent;
      g.fillRect(0, 0, W, Math.max(4, Math.round(H * 0.022)));

      const S = W / 1400;
      const pad = Math.round(46 * S);
      const maxW = W - pad * 2;
      let y = Math.round(66 * S);

      g.textAlign = "left";
      g.fillStyle = accent;
      g.font = "bold " + Math.round(30 * S) + "px system-ui, sans-serif";
      if (g.letterSpacing !== undefined) g.letterSpacing = Math.round(2.2 * S) + "px";
      g.fillText(o.masthead || "", pad, y);
      if (g.letterSpacing !== undefined) g.letterSpacing = "0px";
      y += Math.round(20 * S);
      g.strokeStyle = "rgba(255,255,255,.16)";
      g.lineWidth = Math.max(1, Math.round(1.5 * S));
      g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke();
      y += Math.round(46 * S);

      for (const blk of (o.blocks || [])) {
        g.fillStyle = blk.dim ? "#9aa6b4" : "#e8ebf0";
        g.font = (blk.dim ? "italic " : "") + Math.round(25 * S) + "px Georgia, serif";
        for (const ln of wrapLines(g, blk.text, maxW)) {
          if (y > H - Math.round(18 * S)) break;
          g.fillText(ln, pad, y); y += Math.round(35 * S);
        }
        y += Math.round(12 * S);
      }
    });
  }

  // Registered labels billboard toward the camera and are pushed apart in
  // screen space, so readouts stop landing on top of each other and on the
  // objects they describe.
  const labels = [];
  function makeLabel(x, y, z, l, w, h, opts) {
    const o = opts || {};
    const tex = labelTexture(l);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w || 2.7, h || 1.35),
      // fog and tone mapping off so a readout never fades into the atmosphere
      // and never shifts with scene exposure, whenever it happens to be made
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false,
                                    fog: false, toneMapped: false }));
    mesh.position.set(x, y, z);
    mesh.renderOrder = o.renderOrder != null ? o.renderOrder : 5;
    scene.add(mesh);
    const rec = {
      mesh,
      home: new THREE.Vector3(x, y, z),
      offset: new THREE.Vector3(),
      want: new THREE.Vector3(),
      w: w || 2.7, h: h || 1.35,
      billboard: o.billboard !== false,
      priority: o.priority || 0,
      setText(nl) {
        mesh.material.map = labelTexture(nl);
        mesh.material.needsUpdate = true;
      }
    };
    labels.push(rec);
    mesh.userData.label = rec;
    return mesh;
  }

  /* Adopt a plane that a scene built itself. Several scenes draw their own
     plaques rather than calling makeLabel, which meant those plaques never took
     part in the screen-space layout and could sit on top of anything. */
  function registerLabel(mesh, w, h, opts) {
    if (!mesh || mesh.userData.label) return mesh;
    const o = opts || {};
    const rec = {
      mesh,
      home: mesh.position.clone(),
      offset: new THREE.Vector3(),
      want: new THREE.Vector3(),
      w: w || 3.2, h: h || 1.6,
      billboard: o.billboard === true,      // scene-placed plaques usually face already
      priority: o.priority || 0,
      setText(nl) {
        mesh.material.map = labelTexture(nl);
        mesh.material.needsUpdate = true;
      }
    };
    labels.push(rec);
    mesh.userData.label = rec;
    return mesh;
  }

  // Screen-space separation. Relaxation in aspect-corrected NDC: overlapping
  // pairs push each other apart along whichever axis needs least travel, run
  // to convergence, then the result is eased in along the camera's own axes so
  // it reads as the label politely stepping aside.
  let sepTimer = 0;
  const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3();

  function camDist(L) { return camera.position.distanceTo(L.home) || 1; }
  function worldPerNdcY(L) {
    return camDist(L) * Math.tan((camera.fov * Math.PI / 180) / 2);
  }

  /* Screen rect of an object, in the same aspect-corrected NDC the solver
     works in. Uses the object's world bounding box so a group measures as the
     whole assembly rather than as its first mesh. */
  const _koBox = new THREE.Box3();
  const _koPt = new THREE.Vector3();
  function screenRectOf(obj) {
    _koBox.setFromObject(obj);
    if (_koBox.isEmpty()) return null;
    const aspect = camera.aspect || 1;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, anyFront = false;
    for (let i = 0; i < 8; i++) {
      _koPt.set(i & 1 ? _koBox.max.x : _koBox.min.x,
                i & 2 ? _koBox.max.y : _koBox.min.y,
                i & 4 ? _koBox.max.z : _koBox.min.z).project(camera);
      if (_koPt.z <= 1) anyFront = true;
      const x = _koPt.x * aspect;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (_koPt.y < miny) miny = _koPt.y;
      if (_koPt.y > maxy) maxy = _koPt.y;
    }
    if (!anyFront) return null;
    return { x: (minx + maxx) / 2, y: (miny + maxy) / 2,
             hx: (maxx - minx) / 2, hy: (maxy - miny) / 2 };
  }

  /* Things a label must not sit on top of. Everything the player can click or
     drag qualifies automatically — a readout covering the object it describes
     is the one case where "legibility beats atmosphere" turns against itself,
     because you can no longer see what you are aiming at. Scenes can add
     anything else with userData.keepClear.

     Note these labels were never blocking input: they are not in ctx.pickables
     and the raycast passes straight through them. The problem was purely that
     the player could not see the beam or the slot underneath. */
  /* Rects are remembered between solves and only replaced when they move by
     more than a hair. Several scenes animate a pickable to beckon — the
     concentration room pulses its add and remove buttons by about five per
     cent — and without this the rect breathes, the labels beside it are pushed
     in and out in sympathy, and nothing ever comes to rest. Real movement, like
     the ball rolling along the curve, is far outside the deadband and still
     tracks normally. */
  const _koCache = new WeakMap();
  const KO_DEADBAND = 0.014;

  function keepOutRects() {
    const out = [];
    const seen = new Set();
    const consider = (o) => {
      if (!o || seen.has(o)) return;
      seen.add(o);
      /* A registered label must never become a keep-out volume. It is already
         handled by label-vs-label separation, and counting it here makes it
         push itself: the push moves the label, the move changes its screen
         rect, so on the next pass it pushes itself again and never settles.
         The lock-in plaque is both a label and a click target, which is how it
         ended up oscillating and shoving the pedestal names around with it. */
      if (o.userData && o.userData.label) return;
      // an invisible hit proxy stands in for something real; measure that
      const t = (o.userData && o.userData.rimTarget) || o;
      if (t.userData && t.userData.label) return;   // same reason as above
      let r = screenRectOf(t);
      if (!r) return;
      const prev = _koCache.get(t);
      if (prev && Math.abs(prev.x - r.x) < KO_DEADBAND &&
                  Math.abs(prev.y - r.y) < KO_DEADBAND &&
                  Math.abs(prev.hx - r.hx) < KO_DEADBAND &&
                  Math.abs(prev.hy - r.hy) < KO_DEADBAND) {
        r = prev;                       // inside the deadband: nothing changed
      } else {
        _koCache.set(t, r);
      }
      out.push(r);
    };
    for (const p of pickables) consider(p);
    scene.traverse((o) => { if (o.userData && o.userData.keepClear) consider(o); });
    return out;
  }

  function resolveLabelOverlap() {
    for (const L of labels) L.want.set(0, 0, 0);
    const aspect = camera.aspect || 1;
    const items = [];
    for (const L of labels) {
      if (!L.mesh.visible) continue;
      const p = L.home.clone().project(camera);
      if (p.z > 1) continue;
      const wy = worldPerNdcY(L);
      items.push({ L, wy, x: p.x * aspect, y: p.y,
                   hx: (L.w / 2) / wy, hy: (L.h / 2) / wy, dx: 0, dy: 0 });
    }
    const keepOut = keepOutRects();
    for (let pass = 0; pass < 10; pass++) {
      let moved = false;
      /* Labels step off interactive objects first, then off each other. Doing
         it in this order means the second stage can still separate two labels
         that were both pushed to the same place. */
      for (let i = 0; i < items.length; i++) {
        const A = items[i];
        for (let k = 0; k < keepOut.length; k++) {
          const K = keepOut[k];
          const dx = K.x - (A.x + A.dx);
          const dy = K.y - (A.y + A.dy);
          const ox = A.hx + K.hx - Math.abs(dx);
          const oy = A.hy + K.hy - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          // the label yields, never the object: only A moves
          if (oy <= ox) A.dy -= (oy + 0.008) * (dy >= 0 ? 1 : -1);
          else          A.dx -= (ox + 0.008) * (dx >= 0 ? 1 : -1);
        }
      }
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const A = items[i], B = items[j];
          const dx = (B.x + B.dx) - (A.x + A.dx);
          const dy = (B.y + B.dy) - (A.y + A.dy);
          const ox = A.hx + B.hx - Math.abs(dx);
          const oy = A.hy + B.hy - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (oy <= ox) {
            const s = (oy / 2 + 0.006) * (dy >= 0 ? 1 : -1);
            A.dy -= s; B.dy += s;
          } else {
            const s = (ox / 2 + 0.006) * (dx >= 0 ? 1 : -1);
            A.dx -= s; B.dx += s;
          }
        }
      }
      if (!moved) break;
    }
    camera.matrixWorld.extractBasis(_right, _up, _fwd);
    for (const o of items) {
      // aspect-corrected ndc -> world, applied along the camera's screen axes
      o.L.want.copy(_right).multiplyScalar(o.dx * o.wy)
              .addScaledVector(_up, o.dy * o.wy);
    }
  }

  function updateLabels(dt) {
    sepTimer -= dt;
    if (sepTimer <= 0) { sepTimer = 0.12; resolveLabelOverlap(); }
    for (const L of labels) {
      if (L.billboard) L.mesh.quaternion.copy(camera.quaternion);
      L.offset.lerp(L.want, Math.min(1, dt * 5));
      L.mesh.position.copy(L.home).add(L.offset);
    }
  }

  const ctx = {
    THREE, scene, camera, renderer, container: stage,
    assets: def.assets || {},
    params: params || {},
    pickables,
    canvasTexture, labelTexture, makeLabel, registerLabel, tune, texScale,
    // shared document surfaces for the record rooms
    docCard, docPanel,
    // named plaque sizes: ctx.plaqueSize.md -> [w, h], all 2:1
    plaqueSize: PLAQUE,
    // procedural surface maps: ctx.surfaces.wood(), then grayTexture/normalTexture
    surfaces, grayTexture, normalTexture,
    roundedBox, smoothGeometry, turnedCylinder, plinth, fitTrim,
    boltHead, boltRing, rivetLine, footPads, nameplate,
    toggleSwitch, intakeSlot, machineMount, gaugeTrack, blockBuilding,
    material, tunedStandard, families: FAMILIES, wood, woodTones: WOOD_TONES,
    pointer, raycaster, keys,
    quality: Quality,
    // scenes that add geometry after build call this so the new objects both
    // cast shadows and fall inside the fitted shadow camera
    refitLights() { applyShadowFlags(scene); fitShadowCamera(); },
    // a decaying camera kick, in world units, applied around the draw only.
    // Scenes call this; they must never write camera.position for effects.
    // a puff of dust at a world point, for impacts
    burst(pos, opts) { burst(pos, opts); },
    // scenes name the event; the mixer decides what it sounds like
    sfx(name, opts) { sfx(name, opts); },
    // a spring shove on an object, for contact the player should feel
    punch(obj, depth) { punch(obj, depth); },
    ambience(o) { sfxAmbience(o); },
    shake(amplitude, seconds) {
      if (prefersReducedMotion()) return;
      shakeAmp = Math.max(shakeAmp, amplitude || 0.06);
      shakeDur = seconds || 0.15;
      shakeLeft = shakeDur;
    },
    complete() {
      if (completed) return;
      completed = true;
      sfx("complete");
      statusEl.textContent = "Goal complete";
      statusEl.classList.add("done");
      goBtn.disabled = false;
    },
    setHint(t) {
      const next = t || "";
      if (hintEl.textContent === next) return;
      hintEl.textContent = next;
      // retrigger the attention flash so a new instruction is noticed
      hintEl.classList.remove("changed");
      void hintEl.offsetWidth;
      hintEl.classList.add("changed");
    },
    // Show the page's own text for whatever the player is acting on, so the
    // scene is never a decision made without the evidence. Text only (set via
    // textContent), never markup. Pass nothing to hide the panel.
    setBrief(parts) {
      const panel = overlay.querySelector(".il-brief");
      const body = overlay.querySelector(".il-brief-body");
      const label = overlay.querySelector(".il-brief-label");
      if (!parts) { panel.hidden = true; return; }
      panel.hidden = false;
      label.textContent = parts.label || "Brief";
      body.innerHTML = "";
      const add = (cls, text) => {
        if (!text) return;
        const p = document.createElement("p");
        p.className = cls;
        p.textContent = text;
        body.appendChild(p);
      };
      add("il-brief-claim", parts.claim);
      add("il-brief-context", parts.context);
      add("il-brief-outcome", parts.outcome);
      body.scrollTop = 0;
    },
    setStatus(t, done) {
      statusEl.textContent = t || "";
      statusEl.classList.toggle("done", !!done);
    },
    setTitle(title, step) {
      const h = overlay.querySelector("h2"), s = overlay.querySelector(".step");
      if (h && title != null) h.textContent = title;
      if (s && step != null) s.textContent = step;
    },
    // take over the footer button for scene-internal steps ("Next case", ...).
    // fn === null restores the default behavior (close the interlude).
    setAction(label, fn) {
      goBtn.textContent = label || "Continue";
      goBtn.disabled = false;
      actionHandler = fn || null;
    },
    // extra footer buttons. Pass an array of { label, onClick }; pass nothing
    // (or an empty array) to clear them.
    setAux(list) {
      if (!auxWrap) return;
      auxWrap.textContent = "";
      (list || []).forEach((item) => {
        if (!item || !item.label) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "il-btn ghost";
        b.textContent = item.label;
        b.addEventListener("click", () => { if (item.onClick) item.onClick(); });
        auxWrap.appendChild(b);
      });
    },
    clearAux() { if (auxWrap) auxWrap.textContent = ""; },
    finish() { endSession(true); }
  };
  ctx.setHint(def.instructions || "");

  let instance = null;
  try {
    instance = def.build(ctx) || {};
  } catch (e) {
    console.error("[interludes] build failed for", id, e);
    overlay.remove();
    return;
  }

  /* World matrices must be current before anything measures the scene.
     A scene's own frameScene() builds its bounding box with expandByObject,
     which reads world matrices; if they are stale the box comes out wrong and
     the camera fits to it. This used to happen only as a side effect of the
     shadow fit, which made framing differ between quality tiers. */
  scene.updateMatrixWorld(true);
  applyShadowFlags(scene);
  fitShadowCamera();

  // sizing
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    if (composer) { composer.setSize(w, h); composer.setPixelRatio(renderer.getPixelRatio()); }
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // let the scene refit its framing to the new aspect
    if (instance && instance.onResize) {
      try { instance.onResize(w, h); } catch (e) { console.error(e); }
    }
  }
  resize();
  window.addEventListener("resize", resize);

  // pointer -> NDC + raycast against pickables
  function setPointer(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  }
  function firstHit() {
    if (!ctx.pickables.length) return null;
    // keep world matrices current so picking never depends on a render
    // frame having just run (real browsers render every frame; this is a guard)
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(ctx.pickables, false);
    return hits.length ? hits[0] : null;
  }
  function onDown(ev) {
    setPointer(ev);
    const hit = firstHit();
    /* Every pickable in every scene answers to the pointer here, so wiring the
       click sound at this one point covers all of them — including any scene
       added later — instead of relying on twelve files each remembering to. A
       scene that wants a specific sound for a specific object plays it on top
       from its own handler. */
    if (hit) {
      sfx(hit.object.userData && hit.object.userData.sfxDown || "select");
      // the visible object takes the hit, not the invisible proxy that caught it
      punch(rimTargetOf(hit), hit.object.userData && hit.object.userData.punch);
    }
    instance.onPointerDown && instance.onPointerDown(hit, ev);
  }
  function onMove(ev) {
    setPointer(ev);
    const hit = firstHit();
    // the hover affordance rides the raycast the scene was going to get anyway
    setHovered(rimTargetOf(hit));
    renderer.domElement.style.cursor = hit ? "pointer" : "";
    instance.onPointerMove && instance.onPointerMove(hit, ev);
  }
  function onUp(ev) { instance.onPointerUp && instance.onPointerUp(ev); }
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e) { keys[e.code] = false; }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  /* Post-processing.

     The composer is built lazily and only on the high tier. It is loaded
     with a dynamic import so that a missing or broken addon can never stop
     the scene rendering: on any failure we log once and stay on the direct
     path. Phase 3 adds the actual effect passes; for now the chain is
     RenderPass -> OutputPass, which should be visually identical to
     renderer.render() and exists to prove the plumbing. */
  function buildComposer() {
    if (composerState !== "idle") return;
    composerState = "loading";
    Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/OutputPass.js")
    ]).then(([{ EffectComposer }, { RenderPass }, { OutputPass }]) => {
      const c = new EffectComposer(renderer);
      c.addPass(new RenderPass(scene, camera));
      c.addPass(new OutputPass());
      const r = stage.getBoundingClientRect();
      c.setSize(Math.max(1, r.width), Math.max(1, r.height));
      c.setPixelRatio(renderer.getPixelRatio());
      composer = c;
      composerState = "ready";
    }).catch((e) => {
      composerState = "failed";
      console.warn("[interludes] post-processing unavailable, staying on direct render", e);
    });
  }

  function usePost() {
    return Quality.post && postEnabled && composerState === "ready" && composer;
  }

  function renderFrame() {
    if (usePost()) composer.render();
    else renderer.render(scene, camera);
  }

  // animation loop
  let raf = 0, last = performance.now();
  function frame(now) {
    const dtMs = now - last;
    const dt = Math.min(0.05, dtMs / 1000);
    last = now;
    instance.update && instance.update(dt);
    updateLabels(dt);
    updateCamOffset(dt);
    updateDust(dt);
    updateHover(dt);
    updatePunches(dt);

    // apply the offset only for the draw, then put the camera back exactly
    // where the scene left it
    _camSaved.copy(camera.position);
    camera.position.add(camOffset);
    renderFrame();
    camera.position.copy(_camSaved);

    Perf.sample(dtMs);
    raf = requestAnimationFrame(frame);
  }
  // the scene is built and fitted by now, so the sweep knows where it lands
  beginIntro();
  sfx("enter");
  /* Room tone. A scene may declare its own; everything else gets a quiet bed
     so the term sounds like one building rather than fifteen silent rooms. */
  sfxAmbience(def.ambience || { level: 0.16, busy: 0.05 });
  Perf.reset(id);
  raf = requestAnimationFrame(frame);
  if (Quality.post && postEnabled) buildComposer();

  function teardown() {
    if (torn) return;
    torn = true;
    try { if (window.Sfx) window.Sfx.stopAmbience(); } catch (e) { /* silent */ }
    if (endTimer) { clearTimeout(endTimer); endTimer = 0; }
    cancelAnimationFrame(raf);
    if (composer) { try { composer.dispose(); } catch (e) { /* older builds */ } composer = null; }
    setHovered(null);
    if (rimMesh) { rimMesh.material.dispose(); rimMesh = null; }
    if (dustPts) {
      dustGeo.dispose();
      if (dustMat.map) dustMat.map.dispose();
      dustMat.dispose();
      dustPts = null; dustGeo = null; dustMat = null;
    }
    if (envRT) { try { envRT.dispose(); } catch (e) {} envRT = null; scene.environment = null; }
    composerState = "idle";
    window.removeEventListener("resize", resize);
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    try { instance.dispose && instance.dispose(); } catch (e) { /* ignore */ }
    // free the shared labels this scene created
    for (const L of labels) {
      if (L.mesh.material.map) L.mesh.material.map.dispose();
      L.mesh.material.dispose();
      L.mesh.geometry.dispose();
    }
    labels.length = 0;
    renderer.dispose();
    overlay.remove();
    if (active === session) active = null;
  }

  /* Exit is a fade rather than a cut, but the game flow must not be held
     hostage to an animation. onComplete() still runs immediately, so the HUD
     meters start counting while the scene is still on screen; only the
     teardown and the end event wait for the fade.

     Two races to guard. A second close during the fade must tear down at once
     rather than start another timer, and play() starting a new scene must not
     leave this one's animation loop running behind a removed overlay. */
  let ending = false, endTimer = 0;

  function finishEnd(finished) {
    if (endTimer) { clearTimeout(endTimer); endTimer = 0; }
    teardown();
    // let the page (the game director) react to the scene ending
    document.dispatchEvent(new CustomEvent("interlude:end", {
      detail: { id, finished: !!finished }
    }));
  }

  function endSession(finished) {
    if (ending) { finishEnd(finished); return; }
    ending = true;
    sfx("leave");
    try { if (window.Sfx) window.Sfx.stopAmbience(); } catch (e) { /* silent */ }
    if (finished && def.onComplete) { try { def.onComplete(); } catch (e) {} }
    if (prefersReducedMotion()) { finishEnd(finished); return; }
    overlay.classList.add("il-leaving");
    endTimer = setTimeout(() => { endTimer = 0; finishEnd(finished); }, 220);
  }

  goBtn.addEventListener("click", () => {
    if (actionHandler) { const fn = actionHandler; fn(); }
    else endSession(true);
  });
  skipBtn.addEventListener("click", () => endSession(false));

  // let the player fold the brief away to see the whole scene
  const briefPanel = overlay.querySelector(".il-brief");
  const briefToggle = overlay.querySelector(".il-brief-toggle");
  briefToggle.addEventListener("click", () => {
    const collapsed = briefPanel.classList.toggle("collapsed");
    briefToggle.textContent = collapsed ? "Read brief" : "Hide";
  });

  session.id = id;
  session.close = endSession;
  session._internals = { ctx, get instance() { return instance; }, camera, scene, labels };
  active = session;
}

function close(finished) { if (active) active.close(finished); }

// ---------- public API ----------
window.Interludes = {
  register(id, def) { registry.set(id, def); },
  has(id) { return registry.has(id); },
  play,
  close,
  // dev/testing accessor: internals of the running session (null when idle)
  debug() { return active ? { id: active.id, ...active._internals } : null; },

  // ---- Phase 0 controls: quality, post-processing, motion, metering ----
  quality(tier) {
    if (tier) Quality.set(tier, true);
    return { tier: Quality.tier, locked: Quality.locked,
             shadows: Quality.shadows, post: Quality.post,
             shadowMapSize: Quality.shadowMapSize };
  },
  setPost(on) { Interludes_postDefault = !!on; return Interludes_postDefault; },
  reducedMotion(v) {
    if (v !== undefined) reducedMotionOverride = (v === null ? null : !!v);
    return prefersReducedMotion();
  },
  perf() { return (typeof window !== "undefined" && window.__ilPerf) || null; }
};

// ============================================================
//  PLACEHOLDER INTERLUDE — harness self-test
//  A spinning primitive you click to "charge". Confirms mount,
//  render loop, pointer raycasting, completion, and teardown.
//  Replaced by the courtroom and molecule interludes next.
// ============================================================
window.Interludes.register("harness-test", {
  kicker: "Harness test",
  title: "Charge the core",
  step: "placeholder",
  instructions: "Click the glowing shape three times to charge it, then press Continue.",
  assets: { coreColor: 0x4f86c6, chargedColor: 0x3fae6b }, // swappable later
  build(ctx) {
    const { THREE, scene, assets } = ctx;
    const geo = new THREE.IcosahedronGeometry(1.3, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: assets.coreColor, metalness: 0.3, roughness: 0.35, flatShading: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    ctx.pickables.push(mesh);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.04, 8, 64),
      new THREE.MeshStandardMaterial({ color: 0x9aa3af, metalness: 0.6, roughness: 0.4 })
    );
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    let charge = 0;
    let spin = 0.6;

    return {
      update(dt) {
        mesh.rotation.y += spin * dt;
        mesh.rotation.x += spin * 0.4 * dt;
        ring.rotation.z += 0.3 * dt;
      },
      onPointerDown(hit) {
        if (!hit) return;
        charge++;
        spin += 0.8;
        const t = Math.min(charge / 3, 1);
        mat.color.lerpColors(
          new THREE.Color(assets.coreColor),
          new THREE.Color(assets.chargedColor), t
        );
        mesh.scale.setScalar(1 + t * 0.25);
        ctx.setHint(charge >= 3 ? "Charged. Press Continue." : ("Charge " + charge + " / 3"));
        if (charge >= 3) ctx.complete();
      },
      dispose() {
        geo.dispose(); mat.dispose();
        ring.geometry.dispose(); ring.material.dispose();
      }
    };
  }
});

// (the temporary on-screen test trigger was removed once real interludes
// were wired into the game flow; play("harness-test") remains available
// from the console for harness debugging)
