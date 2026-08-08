/* ============================================================
   interlude-equilibrium.js — where the market clears (module 4)
   Condition B embodied layer.

   Supply and demand stop being lines on a chart and become two
   heavy beams the player shoves across a standing graph. Push the
   supply beam and competition floods in; push the demand beam and
   public procurement swells. Where the beams cross, a marker rides
   the intersection and a row of patients lights up as the cleared
   quantity grows.

   Objective: drive the clearing price down to 70 or below.

   The lesson lives in the resistance: procurement moves quantity
   but pushes price UP, so the only way down is competitive supply.

   The scene drives the page's own supply and demand controls, so
   the equations, the chart and the score stay on one model:
     supply   P = (c - dS) + dQ
     demand   P = (a + dD) - bQ
   with a = 120, b = 0.5, c = 80, d = 0.5.
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

  whenReady(function () {

    window.Interludes.register("equilibrium", {
      kicker: "The clearing house",
      title: "Where the market clears",
      step: "Supply, demand and the price patients pay",
      instructions: "Drag the blue supply beam and the green demand beam. Get the clearing price to 70 or less.",

      assets: {
        graph:  { w: 11.5, h: 7.6, qMax: 200, pMax: 170, color: 0x131720, grid: 0x2b3446 },
        supply: { color: 0x4f86c6, thickness: 0.17, maxShift: 70 },
        demand: { color: 0x3fae6b, thickness: 0.17, maxShift: 40 },
        marker: { r: 0.28, color: 0xfffb00 },
        patient: { count: 22, r: 0.13, len: 0.34, on: 0xfffb00, off: 0x39404e },
        target: 70,
        camera: { elevationDeg: 4, margin: 1.12, lookAt: [0, 0.1, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(new THREE.MeshStandardMaterial(o)); }

        var GW = A.graph.w, GH = A.graph.h;
        function X(q) { return (q / A.graph.qMax) * GW - GW / 2; }
        function Y(p) { return (p / A.graph.pMax) * GH - GH / 2; }

        // ---------- graph board ----------
        var board = new THREE.Mesh(
          keep(ctx.roundedBox(GW + 1.3, GH + 1.3, 0.2)),
          mat({ color: A.graph.color, roughness: 0.9 }));
        board.position.z = -0.35;
        scene.add(board);

        var gridMat = mat({ color: A.graph.grid, roughness: 0.9 });
        var gridGeoV = keep(ctx.roundedBox(0.025, GH, 0.02));
        var gridGeoH = keep(ctx.roundedBox(GW, 0.025, 0.02));
        for (var q = 0; q <= A.graph.qMax; q += 50) {
          var gv = new THREE.Mesh(gridGeoV, gridMat);
          gv.position.set(X(q), 0, -0.22); scene.add(gv);
        }
        for (var p = 0; p <= A.graph.pMax; p += 50) {
          var gh = new THREE.Mesh(gridGeoH, gridMat);
          gh.position.set(0, Y(p), -0.22); scene.add(gh);
        }

        // ---------- label helper ----------
        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- beams ----------
        // Each beam carries a visible, labelled grip. Without one the player
        // cannot tell what is draggable, which was the whole confusion here.
        function makeBeam(color, title, note) {
          var m = new THREE.Mesh(
            keep(ctx.roundedBox(1, A.supply.thickness, A.supply.thickness)),
            mat({ color: color, roughness: 0.35, emissive: color, emissiveIntensity: 0.3 }));
          scene.add(m);
          // fat invisible grab volume so the whole beam is easy to catch
          var grab = new THREE.Mesh(
            keep(ctx.roundedBox(1, 0.95, 0.6)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          scene.add(grab);
          ctx.pickables.push(grab);

          // the grip: a chunky knurled handle sitting on the beam
          var handle = new THREE.Group();
          var barrel = new THREE.Mesh(
            keep(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 48)),
            mat({ color: color, roughness: 0.25, metalness: 0.25,
                  emissive: color, emissiveIntensity: 0.55 }));
          barrel.rotation.x = Math.PI / 2;
          handle.add(barrel);
          var collar = new THREE.Mesh(
            keep(new THREE.TorusGeometry(0.42, 0.05, 24, 96)),
            mat({ color: 0xffffff, roughness: 0.3,
                  emissive: 0xffffff, emissiveIntensity: 0.3 }));
          handle.add(collar);
          // arrows showing which way it slides
          [-1, 1].forEach(function (s) {
            var a = new THREE.Mesh(
              keep(new THREE.ConeGeometry(0.15, 0.34, 48)),
              mat({ color: 0xffffff, roughness: 0.4,
                    emissive: 0xffffff, emissiveIntensity: 0.45 }));
            a.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
            a.position.set(s * 0.78, 0, 0);
            handle.add(a);
          });
          handle.position.z = 0.22;
          scene.add(handle);

          var tag = makeLabel(0, 0, 0.3,
            { top: title, sub: note, accent: "#" + color.toString(16).padStart(6, "0"), box: true },
            3.0, 1.5);
          return { beam: m, grab: grab, handle: handle, tag: tag };
        }
        var supply = makeBeam(A.supply.color, "SUPPLY", "grab and drag →");
        var demand = makeBeam(A.demand.color, "DEMAND", "grab and drag →");

        function layoutBeam(obj, p0, p1) {
          var v0 = new THREE.Vector3(X(0), Y(p0), 0);
          var v1 = new THREE.Vector3(X(A.graph.qMax), Y(p1), 0);
          var mid = v0.clone().add(v1).multiplyScalar(0.5);
          var dir = v1.clone().sub(v0);
          var len = dir.length();
          [obj.beam, obj.grab].forEach(function (m) {
            m.position.copy(mid);
            m.scale.x = len;
            m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
          });
          // grip rides the middle of its own beam; label sits just above it
          obj.handle.position.set(mid.x, mid.y, 0.22);
          obj.handle.quaternion.setFromUnitVectors(
            new THREE.Vector3(1, 0, 0), dir.clone().normalize());
          obj.tag.position.set(mid.x, mid.y + 1.15, 0.3);
        }

        // ---------- equilibrium marker ----------
        var marker = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.marker.r, 48, 32)),
          mat({ color: A.marker.color, roughness: 0.25,
                emissive: A.marker.color, emissiveIntensity: 0.6 }));
        scene.add(marker);
        var dropLine = new THREE.Mesh(
          keep(ctx.roundedBox(0.04, 1, 0.02)),
          mat({ color: A.marker.color, roughness: 0.6,
                emissive: A.marker.color, emissiveIntensity: 0.25, transparent: true, opacity: 0.5 }));
        scene.add(dropLine);

        var priceLabel = makeLabel(GW / 2 + 3.1, 2.6, 0,
          { top: "CLEARING PRICE", big: "100", sub: "target: 70 or less",
            accent: "#fffb00", box: true }, 2.82, 1.41);
        var qtyLabel = makeLabel(GW / 2 + 3.1, 0.0, 0,
          { top: "QUANTITY", big: "40", sub: "units reaching patients",
            accent: "#3fae6b", box: true }, 2.82, 1.41);
        // (the beams label themselves at their grips, so no side legend here)

        // ---------- patients ----------
        var patients = [];
        var pg = keep(new THREE.CapsuleGeometry(A.patient.r, A.patient.len, 12, 32));
        var pOn = mat({ color: A.patient.on, roughness: 0.4,
                        emissive: A.patient.on, emissiveIntensity: 0.45 });
        var pOff = mat({ color: A.patient.off, roughness: 0.8 });
        for (var i = 0; i < A.patient.count; i++) {
          var m = new THREE.Mesh(pg, pOff);
          m.position.set(-GW / 2 + 0.28 + i * (GW / A.patient.count), -GH / 2 - 1.15, 0);
          scene.add(m);
          patients.push(m);
        }
        makeLabel(0, -GH / 2 - 2.1, 0,
          { top: "PATIENTS SERVED AT THE CLEARING PRICE", accent: "#9aa6b4" }, 5.63, 0.97);

        // ---------- state ----------
        // Competitors admitted on the market floor are already in this market:
        // they arrive as supply, so the beam starts part of the way across.
        var inherited = 0;
        if (typeof window.GameInherit === "function") {
          try {
            var h = window.GameInherit();
            if (h.marketOpen && h.firmsAdmitted > 1) {
              inherited = Math.min(45, ((h.firmsAdmitted - 1) / 49) * 45);
            }
          } catch (e) {}
        }
        var sShift = inherited, dShift = 0;
        var dragging = null, lastX = 0;
        var won = false;
        var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        var hitPt = new THREE.Vector3();

        function model() {
          var a = 120 + dShift, b = 0.5, c = 80 - sShift, d = 0.5;
          var eqQ = (a - c) / (b + d);
          var eqP = a - b * eqQ;
          return { a: a, c: c, b: b, d: d, q: eqQ, p: eqP };
        }

        function pushToPage() {
          var ss = document.getElementById("slider-supply-shift");
          var ds = document.getElementById("slider-demand-shift");
          if (ss) { ss.value = sShift; ss.dispatchEvent(new Event("input", { bubbles: true })); }
          if (ds) { ds.value = dShift; ds.dispatchEvent(new Event("input", { bubbles: true })); }
        }

        function refresh() {
          var m = model();
          layoutBeam(supply, m.c, m.c + m.d * A.graph.qMax);
          layoutBeam(demand, m.a, m.a - m.b * A.graph.qMax);

          marker.position.set(X(m.q), Y(m.p), 0.12);
          var floorY = Y(0);
          var dh = Math.max(0.05, Y(m.p) - floorY);
          dropLine.scale.y = dh;
          dropLine.position.set(X(m.q), floorY + dh / 2, 0.02);

          var hitTarget = m.p <= A.target;
          priceLabel.material.map = labelTex(
            { top: "CLEARING PRICE", big: "$" + Math.round(m.p),
              sub: hitTarget ? "target met" : "target: 70 or less",
              accent: hitTarget ? "#3fae6b" : "#fffb00",
              bigColor: hitTarget ? "#8ff0b5" : "#fff", box: true });
          priceLabel.material.needsUpdate = true;
          qtyLabel.material.map = labelTex(
            { top: "QUANTITY", big: String(Math.round(m.q)),
              sub: "units reaching patients", accent: "#3fae6b", box: true });
          qtyLabel.material.needsUpdate = true;

          var lit = Math.round((Math.min(m.q, 200) / 200) * A.patient.count);
          for (var k = 0; k < patients.length; k++) patients[k].material = k < lit ? pOn : pOff;

          if (!won) {
            if (hitTarget) {
              won = true;
              ctx.setStatus("Cleared at $" + Math.round(m.p), true);
              ctx.setHint("Competition, not procurement, is what brought the price down.");
              ctx.setAction("Leave the clearing house", null);
              ctx.complete();
            } else {
              ctx.setStatus("Clearing at $" + Math.round(m.p) + " — needs to reach $" + A.target, false);
            }
          }
        }

        ctx.setBrief(null);
        if (inherited > 0) {
          pushToPage();
          ctx.setHint("Your firms are already in this market. Push the blue supply handle the rest of the way.");
        }
        refresh();

        function pointerWorld() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
          return ctx.raycaster.ray.intersectPlane(plane, hitPt) ? hitPt.clone() : null;
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
          for (var pz = 0; pz < 6; pz++) {
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

        var pulse = 0;
        return {
          update: function (dt) {
            pulse += dt;
            marker.scale.setScalar(1 + Math.sin(pulse * 3) * 0.09);
            // the supply grip beckons until the player has actually used it,
            // because supply is the handle that solves this room
            var beckon = (sShift === 0 && !won) ? 1 + Math.sin(pulse * 4) * 0.16 : 1;
            supply.handle.scale.setScalar(
              supply.handle.scale.x + (beckon - supply.handle.scale.x) * Math.min(1, dt * 9));
            var dq = (dShift === 0 && sShift > 0 && !won) ? 1 + Math.sin(pulse * 4) * 0.08 : 1;
            demand.handle.scale.setScalar(
              demand.handle.scale.x + (dq - demand.handle.scale.x) * Math.min(1, dt * 9));
          },

          onPointerDown: function (h) {
            if (!h) return;
            var w = pointerWorld();
            lastX = w ? w.x : 0;
            if (h.object === supply.grab) dragging = "supply";
            else if (h.object === demand.grab) dragging = "demand";
          },

          onPointerMove: function (h) {
            if (!dragging) {
              ctx.renderer.domElement.style.cursor = h ? "grab" : "default";
              return;
            }
            ctx.renderer.domElement.style.cursor = "grabbing";
            var w = pointerWorld();
            if (!w) return;
            var dx = w.x - lastX;
            lastX = w.x;
            // scene units -> shift units, tuned so a full sweep covers the range
            var perUnit = A.supply.maxShift / (GW * 0.85);
            if (dragging === "supply") {
              sShift = Math.max(0, Math.min(A.supply.maxShift, sShift + dx * perUnit));
            } else {
              var perUnitD = A.demand.maxShift / (GW * 0.85);
              dShift = Math.max(0, Math.min(A.demand.maxShift, dShift + dx * perUnitD));
            }
            pushToPage();
            refresh();
          },

          onPointerUp: function () {
            dragging = null;
            ctx.renderer.domElement.style.cursor = "default";
          },

          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchEquilibrium = function () { window.Interludes.play("equilibrium"); };
  });
})();
