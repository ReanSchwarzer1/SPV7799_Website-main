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

const registry = new Map();
let active = null; // current running session

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

  const overlay = buildOverlay(def, params);
  const stage = overlay.querySelector(".il-stage");
  const hintEl = overlay.querySelector(".il-hint");
  const statusEl = overlay.querySelector(".status");
  const goBtn = overlay.querySelector('[data-act="go"]');
  const skipBtn = overlay.querySelector('[data-act="skip"]');

  // renderer / scene / camera
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 1.4, 6);
  camera.lookAt(0, 0, 0); // frame the scene origin so screen-center rays hit centered objects

  // default lighting (interludes can add more)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 8, 6);
  scene.add(key);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const keys = Object.create(null);
  let completed = false;
  let actionHandler = null; // when set, the footer button runs this instead of closing

  const ctx = {
    THREE, scene, camera, renderer, container: stage,
    assets: def.assets || {},
    params: params || {},
    pickables: [],
    pointer, raycaster, keys,
    complete() {
      if (completed) return;
      completed = true;
      statusEl.textContent = "Goal complete";
      statusEl.classList.add("done");
      goBtn.disabled = false;
    },
    setHint(t) { hintEl.textContent = t || ""; },
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

  // sizing
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
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
  function onDown(ev) { setPointer(ev); instance.onPointerDown && instance.onPointerDown(firstHit(), ev); }
  function onMove(ev) { setPointer(ev); instance.onPointerMove && instance.onPointerMove(firstHit(), ev); }
  function onUp(ev) { instance.onPointerUp && instance.onPointerUp(ev); }
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e) { keys[e.code] = false; }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // animation loop
  let raf = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    instance.update && instance.update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function teardown() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    renderer.domElement.removeEventListener("pointerdown", onDown);
    renderer.domElement.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    try { instance.dispose && instance.dispose(); } catch (e) { /* ignore */ }
    renderer.dispose();
    overlay.remove();
    active = null;
  }

  function endSession(finished) {
    if (finished && def.onComplete) { try { def.onComplete(); } catch (e) {} }
    teardown();
    // let the page (the game director) react to the scene ending
    document.dispatchEvent(new CustomEvent("interlude:end", {
      detail: { id, finished: !!finished }
    }));
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

  active = { id, close: endSession,
             _internals: { ctx, get instance() { return instance; }, camera, scene } };
}

function close(finished) { if (active) active.close(finished); }

// ---------- public API ----------
window.Interludes = {
  register(id, def) { registry.set(id, def); },
  has(id) { return registry.has(id); },
  play,
  close,
  // dev/testing accessor: internals of the running session (null when idle)
  debug() { return active ? { id: active.id, ...active._internals } : null; }
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
