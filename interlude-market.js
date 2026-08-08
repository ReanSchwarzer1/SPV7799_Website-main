/* ============================================================
   interlude-market.js — the market floor (module 3)
   Condition B embodied layer.

   The player stands over the market their own rulings created and
   admits generic manufacturers into it by hauling a gate lever.
   Every firm that walks in drives the price column down along the
   FDA decay relation, and value visibly drains out of the PRIVATE
   PROFIT tank into the SOCIAL ACCESS tank. A procurement wheel on
   the floor raises government buying.

   Objective: make SOCIAL ACCESS taller than PRIVATE PROFIT.

   If the player closed the market at the bench, the gate is bolted
   shut and no firm can enter. That is not a bug to route around,
   it is the consequence of their ruling, and the scene says so and
   lets them finish having learned it.

   The scene never invents numbers. It drives the page's own
   competitor and procurement controls, so the model, the charts
   and the score all stay on one source of truth.
   ============================================================ */

(function () {
  "use strict";

  function whenReady(fn) {
    if (window.Interludes) return fn();
    var n = 0, t = setInterval(function () {
      if (window.Interludes) { clearInterval(t); fn(); }
      else if (++n > 100) clearInterval(t);
    }, 30);
  }

  function marketIsOpen() {
    var l = document.getElementById("val-monopoly-status");
    return !!(l && /REJECT|CL|OPEN/i.test(l.textContent));
  }

  whenReady(function () {

    window.Interludes.register("market-floor", {
      kicker: "The market floor",
      title: "Let them in",
      step: "Producer and consumer surplus",
      instructions: "Drag the gate lever to admit generic manufacturers.",

      assets: {
        floor:  { w: 17, d: 11, color: 0x141821 },
        lever:  { railX: [-5.6, 5.6], y: -1.2, z: 3.6, knob: 0.42, color: 0xd9a441 },
        firm:   { w: 0.52, h: 0.9, d: 0.52, color: 0x7f8b9c, roof: 0xa9b6c7, maxShown: 14 },
        column: { r: 0.5, maxH: 6.2, color: 0xd4573f, x: 0 },
        tank:   { w: 1.9, maxH: 5.4, d: 1.9,
                  profit: { x: -5.4, color: 0x2b3240, fill: 0x8892a4 },
                  access: { x: 5.4, color: 0x1d2a22, fill: 0x3fae6b } },
        wheel:  { x: 0, z: 3.6, r: 0.85, color: 0x4f86c6 },
        camera: { elevationDeg: 24, margin: 1.12, lookAt: [0, 0.4, 0.6] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(new THREE.MeshStandardMaterial(o)); }

        var open = marketIsOpen();

        // ---------- floor ----------
        var floor = new THREE.Mesh(
          keep(ctx.roundedBox(A.floor.w, 0.3, A.floor.d)),
          mat({ color: A.floor.color, roughness: 0.9 }));
        floor.position.set(0, -1.85, 0);
        scene.add(floor);

        // ---------- canvas label helper ----------
        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- price column ----------
        var column = new THREE.Mesh(
          keep(new THREE.CylinderGeometry(A.column.r, A.column.r, 1, 48)),
          mat({ color: A.column.color, roughness: 0.4,
                emissive: A.column.color, emissiveIntensity: 0.25 }));
        scene.add(column);
        var columnCap = new THREE.Mesh(
          keep(new THREE.CylinderGeometry(A.column.r + 0.09, A.column.r + 0.09, 0.12, 48)),
          mat({ color: 0xe8ecf2, roughness: 0.4 }));
        scene.add(columnCap);
        var priceLabel = makeLabel(A.column.x, 5.6, 0,
          { top: "PRICE INDEX", big: "100", accent: "#d4573f" }, 2.24, 1.12);

        // ---------- surplus tanks ----------
        function makeTank(cfg, title) {
          var shell = new THREE.Mesh(
            keep(ctx.roundedBox(A.tank.w, A.tank.maxH, A.tank.d)),
            mat({ color: cfg.color, roughness: 0.85, transparent: true, opacity: 0.32 }));
          shell.position.set(cfg.x, -1.7 + A.tank.maxH / 2, 0);
          scene.add(shell);
          var fill = new THREE.Mesh(
            keep(ctx.roundedBox(A.tank.w * 0.82, 1, A.tank.d * 0.82)),
            mat({ color: cfg.fill, roughness: 0.45,
                  emissive: cfg.fill, emissiveIntensity: 0.22 }));
          scene.add(fill);
          var lab = makeLabel(cfg.x, -1.7 + A.tank.maxH + 0.95, 0,
            { top: title, accent: "#" + cfg.fill.toString(16).padStart(6, "0") }, 2.15, 1.07);
          return { fill: fill, x: cfg.x, label: lab, title: title,
                   color: "#" + cfg.fill.toString(16).padStart(6, "0") };
        }
        var tankProfit = makeTank(A.tank.profit, "PRIVATE PROFIT");
        var tankAccess = makeTank(A.tank.access, "SOCIAL ACCESS");

        // ---------- gate + lever ----------
        var railL = A.lever.railX[0], railR = A.lever.railX[1];
        var rail = new THREE.Mesh(
          keep(ctx.roundedBox(railR - railL, 0.12, 0.28)),
          mat({ color: 0x2a3140, roughness: 0.7 }));
        rail.position.set(0, A.lever.y, A.lever.z);
        scene.add(rail);

        var knob = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.lever.knob, 48, 32)),
          mat({ color: open ? A.lever.color : 0x5b6270, roughness: 0.35,
                emissive: open ? A.lever.color : 0x000000, emissiveIntensity: 0.3 }));
        knob.position.set(railL, A.lever.y + 0.3, A.lever.z);
        scene.add(knob);
        if (open) ctx.pickables.push(knob);

        var leverLabel = makeLabel(1.7, A.lever.y - 1.35, A.lever.z + 1.2,
          open ? { top: "GENERIC FIRMS", big: "1", sub: "drag the lever", accent: "#d9a441" }
               : { top: "GATE BOLTED", sub: "your ruling closed this market", accent: "#d4573f" },
          3.0, 1.5);

        // ---------- procurement wheel ----------
        var wheel = new THREE.Mesh(
          keep(new THREE.CylinderGeometry(A.wheel.r, A.wheel.r, 0.24, 48)),
          mat({ color: A.wheel.color, roughness: 0.4,
                emissive: A.wheel.color, emissiveIntensity: 0.22 }));
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(-3.4, A.lever.y + 0.3, A.lever.z);
        scene.add(wheel);
        ctx.pickables.push(wheel);
        var wheelLabel = makeLabel(-3.4, A.lever.y - 1.35, A.lever.z + 1.2,
          { top: "PROCUREMENT", sub: "LOW · click to raise", accent: "#4f86c6" }, 2.41, 1.20);

        // ---------- firms ----------
        var firmGroup = new THREE.Group();
        scene.add(firmGroup);
        var firmMeshes = [];
        var firmBody = keep(ctx.roundedBox(A.firm.w, A.firm.h, A.firm.d));
        var firmRoof = keep(ctx.roundedBox(A.firm.w * 1.15, 0.12, A.firm.d * 1.15));
        var firmMat = mat({ color: A.firm.color, roughness: 0.7 });
        var roofMat = mat({ color: A.firm.roof, roughness: 0.5 });
        for (var i = 0; i < A.firm.maxShown; i++) {
          var grp = new THREE.Group();
          var b = new THREE.Mesh(firmBody, firmMat);
          var r = new THREE.Mesh(firmRoof, roofMat);
          r.position.y = A.firm.h / 2 + 0.06;
          grp.add(b); grp.add(r);
          var col = i % 7, row = Math.floor(i / 7);
          grp.position.set(-3.15 + col * 1.05, -1.25, 1.35 + row * 1.0);
          grp.scale.setScalar(0.001);
          grp.visible = false;
          firmGroup.add(grp);
          firmMeshes.push(grp);
        }

        // ---------- state ----------
        var N = 1, procurement = 1;
        var dragging = false;
        var won = false;
        var dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -A.lever.z);
        var hit = new THREE.Vector3();

        // mirrors the page model exactly (see updateCharts in script.js)
        function model() {
          var base = 100;
          var price = open ? base * Math.pow(N, -0.75) : base;
          var maxWilling = 120, mc = 5;
          var qty = (maxWilling - price) * (1 + procurement * 0.5);
          return {
            price: price,
            producer: Math.max(0, (price - mc) * qty),
            consumer: Math.max(0, 0.5 * (maxWilling - price) * qty)
          };
        }

        // push the value into the page controls; their input handlers run the
        // real charts and the level check, so nothing is duplicated here
        function pushToPage() {
          var sc = document.getElementById("slider-comp");
          var sp = document.getElementById("slider-procure");
          if (sc && !sc.disabled) {
            sc.value = N;
            sc.dispatchEvent(new Event("input", { bubbles: true }));
          }
          if (sp) {
            sp.value = procurement;
            sp.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }

        var MAXV = 3600;   // reference scale for the tanks
        function refresh() {
          var m = model();
          var h = Math.max(0.25, (m.price / 100) * A.column.maxH);
          column.scale.y = h;
          column.position.set(A.column.x, -1.7 + h / 2, 0);
          columnCap.position.set(A.column.x, -1.7 + h + 0.06, 0);
          priceLabel.material.map = labelTex(
            { top: "PRICE INDEX", big: String(Math.round(m.price)), accent: "#d4573f" });
          priceLabel.material.needsUpdate = true;

          function setTank(t, v) {
            var hh = Math.max(0.08, Math.min(1, v / MAXV) * A.tank.maxH);
            t.fill.scale.y = hh;
            t.fill.position.set(t.x, -1.7 + hh / 2, 0);
            t.label.material.map = labelTex(
              { top: t.title, big: String(Math.round(v)), accent: t.color });
            t.label.material.needsUpdate = true;
          }
          setTank(tankProfit, m.producer);
          setTank(tankAccess, m.consumer);

          var shown = Math.min(A.firm.maxShown, N);
          for (var k = 0; k < firmMeshes.length; k++) firmMeshes[k].visible = k < shown;

          if (open) {
            leverLabel.material.map = labelTex(
              { top: "GENERIC FIRMS", big: String(N),
                sub: N >= 50 ? "market fully open" : "drag the lever", accent: "#d9a441" });
            leverLabel.material.needsUpdate = true;
          }
          wheelLabel.material.map = labelTex(
            { top: "PROCUREMENT",
              sub: (procurement === 1 ? "LOW" : procurement === 2 ? "MEDIUM" : "HIGH") + " · click to raise",
              accent: "#4f86c6" });
          wheelLabel.material.needsUpdate = true;

          if (!won) {
            if (m.consumer > m.producer) {
              won = true;
              ctx.setStatus("Social access has overtaken private profit", true);
              ctx.setHint("With " + N + " firms in the market, most of the value now reaches patients.");
              ctx.setAction("On to the equilibrium", null);
              ctx.complete();
            } else {
              ctx.setStatus("Profit " + Math.round(m.producer) +
                            "  ·  Access " + Math.round(m.consumer), false);
            }
          }
        }

        if (open) {
          ctx.setHint("Drag the gate lever to admit generic manufacturers.");
        } else {
          // the market they closed at the bench
          ctx.setHint("You upheld the patent, so the gate is bolted. One firm sets the price.");
          ctx.setStatus("Monopoly market: no entry possible", false);
          ctx.setAction("I have seen enough", function () {
            if (typeof window.GameComplete === "function") {
              window.GameComplete(2, 0, 4,
                "You saw the closed market: with entry barred, the surplus stays with the producer.");
            }
            ctx.finish();
          });
        }

        ctx.setBrief(null);
        refresh();

        function pointerOnRail() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
          return ctx.raycaster.ray.intersectPlane(dragPlane, hit) ? hit.clone() : null;
        }

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
          if (box.isEmpty()) return;
          var cs = [];
          for (var i2 = 0; i2 < 8; i2++) cs.push(new THREE.Vector3(
            (i2 & 1) ? box.max.x : box.min.x, (i2 & 2) ? box.max.y : box.min.y,
            (i2 & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p = 0; p < 6; p++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var c2 = 0; c2 < cs.length; c2++) {
              var v = cs[c2].clone().project(cam);
              worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
            }
            if (worst < 0.0001) break;
            dist *= worst * A.camera.margin;
          }
          cam.position.copy(look).addScaledVector(dir, dist);
          cam.lookAt(look); cam.updateProjectionMatrix();
        }

        return {
          update: function (dt) {
            wheel.rotation.z += dt * (0.25 + procurement * 0.45);
            for (var k = 0; k < firmMeshes.length; k++) {
              var f = firmMeshes[k];
              var want = f.visible ? 1 : 0.001;
              f.scale.setScalar(f.scale.x + (want - f.scale.x) * Math.min(1, dt * 7));
            }
          },

          onPointerDown: function (hitObj) {
            if (!hitObj) return;
            if (hitObj.object === knob && open) { dragging = true; return; }
            if (hitObj.object === wheel) {
              procurement = procurement >= 3 ? 1 : procurement + 1;
              pushToPage();
              refresh();
            }
          },

          onPointerMove: function (hitObj) {
            if (!dragging) {
              ctx.renderer.domElement.style.cursor = hitObj ? "grab" : "default";
              return;
            }
            ctx.renderer.domElement.style.cursor = "grabbing";
            var w = pointerOnRail();
            if (!w) return;
            var x = Math.max(railL, Math.min(railR, w.x));
            knob.position.x = x;
            var t = (x - railL) / (railR - railL);
            var newN = Math.max(1, Math.round(1 + t * 49));
            if (newN !== N) { N = newN; pushToPage(); refresh(); }
          },

          onPointerUp: function () {
            dragging = false;
            ctx.renderer.domElement.style.cursor = "default";
          },

          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchMarketFloor = function () { window.Interludes.play("market-floor"); };
  });
})();
