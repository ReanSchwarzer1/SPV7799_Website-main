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
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        var GW = A.graph.w, GH = A.graph.h;
        function X(q) { return (q / A.graph.qMax) * GW - GW / 2; }
        function Y(p) { return (p / A.graph.pMax) * GH - GH / 2; }

        // ---------- graph board ----------
        var board = new THREE.Mesh(
          keep(ctx.roundedBox(GW + 1.3, GH + 1.3, 0.2)),
          ctx.wood("ash", { repeat: [3, 3] }));
        board.position.z = -0.35;
        /* The board was a bare slab floating in the dark. It now has a mitred
           moulding frame with corner blocks and bolts, a pen ledge along the
           bottom on brackets, and an easel standing behind it. */
        (function () {
          var FW = GW + 1.3, FH = GH + 1.3, T = 0.16;
          var frameWood = keep(ctx.wood("walnut", { repeat: [4, 1] }));
          var trim = keep(ctx.material("brass"));

          [FH / 2 + T, -FH / 2 - T].forEach(function (y) {
            var m = new THREE.Mesh(
              keep(ctx.roundedBox(FW + T * 2, T * 2, 0.34, 0.04)), frameWood);
            m.position.set(0, y, -0.29);
            scene.add(m);
          });
          [-FW / 2 - T, FW / 2 + T].forEach(function (x) {
            var m = new THREE.Mesh(
              keep(ctx.roundedBox(T * 2, FH + T * 2, 0.34, 0.04)), frameWood);
            m.position.set(x, 0, -0.29);
            scene.add(m);
          });
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
            var blk = new THREE.Mesh(keep(ctx.roundedBox(0.44, 0.44, 0.40, 0.05)), frameWood);
            blk.position.set(c[0] * (FW / 2 + T), c[1] * (FH / 2 + T), -0.27);
            scene.add(blk);
            var b = ctx.boltHead(0.055, trim);
            b.rotation.x = -Math.PI / 2;
            b.position.set(blk.position.x, blk.position.y, -0.06);
            scene.add(b);
          });

          var ledge = new THREE.Mesh(keep(ctx.roundedBox(FW * 0.86, 0.13, 0.40, 0.04)), frameWood);
          ledge.position.set(0, -FH / 2 - T - 0.12, 0.02);
          scene.add(ledge);
          var ledgeLip = new THREE.Mesh(keep(ctx.roundedBox(FW * 0.86, 0.12, 0.07, 0.03)), trim);
          ledgeLip.position.set(0, -FH / 2 - T - 0.05, 0.20);
          scene.add(ledgeLip);
          [-1, 1].forEach(function (br) {
            var bracket = new THREE.Mesh(keep(ctx.roundedBox(0.12, 0.36, 0.34, 0.03)), trim);
            bracket.position.set(br * FW * 0.36, -FH / 2 - T - 0.24, -0.10);
            scene.add(bracket);
          });

          var legMat = keep(ctx.wood("ebony", { repeat: [1, 4] }));
          var rubber = keep(ctx.material("rubber", { color: 0x24262a }));
          [-1, 1].forEach(function (lg) {
            var leg = new THREE.Mesh(
              keep(ctx.turnedCylinder(0.09, 0.13, FH + 1.9, 0.03)), legMat);
            leg.position.set(lg * (FW / 2 - 0.35), -0.95, -0.52);
            leg.rotation.z = -lg * 0.075;
            scene.add(leg);
            var pad = new THREE.Mesh(keep(ctx.turnedCylinder(0.15, 0.19, 0.11, 0.03)), rubber);
            pad.position.set(lg * (FW / 2 - 0.02), -FH / 2 - 2.06, -0.52);
            scene.add(pad);
          });
          var prop = new THREE.Mesh(
            keep(ctx.turnedCylinder(0.08, 0.12, FH + 1.4, 0.03)), legMat);
          prop.position.set(0, -1.1, -1.25);
          prop.rotation.x = 0.30;
          scene.add(prop);
          var crossbar = new THREE.Mesh(
            keep(ctx.turnedCylinder(0.06, 0.06, FW - 0.5, 0.02)), trim);
          crossbar.rotation.z = Math.PI / 2;
          crossbar.position.set(0, -FH / 2 - 1.25, -0.62);
          scene.add(crossbar);
        })();
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
        function makeBeam(color, title, note, tagY) {
          var m = new THREE.Mesh(
            keep(ctx.roundedBox(1, A.supply.thickness, A.supply.thickness)),
            mat({ color: color, roughness: 0.35, emissive: color, emissiveIntensity: 0.3 }));
          /* The beam hangs off a holder so it can lag the hand without fighting
             layoutBeam(), which sets the beam's own transform from the model
             every refresh. The holder carries the lag, the beam carries the
             economics, and neither overwrites the other. */
          var holder = new THREE.Group();
          scene.add(holder);
          holder.add(m);
          // fat invisible grab volume so the whole beam is easy to catch
          var grab = new THREE.Mesh(
            keep(ctx.roundedBox(1, 0.95, 0.6)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          grab.userData.rimTarget = m;        // the beam, not the grab volume
          scene.add(grab);
          ctx.pickables.push(grab);

          // the grip: a chunky knurled handle sitting on the beam
          var handle = new THREE.Group();
          var barrel = new THREE.Mesh(
            keep(ctx.turnedCylinder(0.34, 0.34, 0.62)),
            mat({ color: color, roughness: 0.25, metalness: 0.25,
                  emissive: color, emissiveIntensity: 0.55 }));
          barrel.rotation.x = Math.PI / 2;
          handle.add(barrel);
          var collar = new THREE.Mesh(
            keep(new THREE.TorusGeometry(0.42, 0.05, 32, 128)),
            mat({ color: 0xffffff, roughness: 0.3,
                  emissive: 0xffffff, emissiveIntensity: 0.3 }));
          handle.add(collar);
          // arrows showing which way it slides
          [-1, 1].forEach(function (s) {
            var a = new THREE.Mesh(
              keep(new THREE.ConeGeometry(0.15, 0.34, 64)),
              mat({ color: 0xffffff, roughness: 0.4,
                    emissive: 0xffffff, emissiveIntensity: 0.45 }));
            a.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
            a.position.set(s * 0.78, 0, 0);
            handle.add(a);
          });
          handle.position.z = 0.22;
          scene.add(handle);

          /* Pinned to the left margin, clear of the board, rather than riding the
             beam. Tracking the beam is what put these two boxes across the
             middle of the graph and over the thing the player has to drag. They
             mirror the readouts on the right, and the accent keeps each tag tied
             to the beam it names. */
          var tag = makeLabel(-GW / 2 - 2.15, tagY, 0.3,
            { top: title, sub: note, accent: "#" + color.toString(16).padStart(6, "0"), box: true },
            3.0, 1.5);
          return { beam: m, grab: grab, handle: handle, tag: tag, holder: holder };
        }
        var supply = makeBeam(A.supply.color, "SUPPLY", "grab and drag →", -1.05);
        var demand = makeBeam(A.demand.color, "DEMAND", "grab and drag →", 1.05);

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
          /* The tag is deliberately not moved here. updateLabels() rewrites a
             label's position from its `home` every frame, so assigning
             tag.position was overwritten before it was ever drawn — the tags
             sat wherever they were created, which was the middle of the board.
             They are placed once, at the margin, in makeBeam. */
        }

        // ---------- equilibrium marker ----------
        var marker = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.marker.r, 64, 40)),
          mat({ color: A.marker.color, roughness: 0.25,
                emissive: A.marker.color, emissiveIntensity: 0.6 }));
        scene.add(marker);
        /* The equilibrium marker was a bare emissive sphere. Three gimbal rings
           and four sight ticks make it read as an instrument tracking a point. */
        (function () {
          var cageMat = mat({ color: 0xffffff, roughness: 0.3, metalness: 0.4,
                              emissive: A.marker.color, emissiveIntensity: 0.35 });
          [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]].forEach(function (rot) {
            var ring = new THREE.Mesh(
              keep(new THREE.TorusGeometry(A.marker.r * 1.55, A.marker.r * 0.10, 16, 96)),
              cageMat);
            ring.rotation.set(rot[0], rot[1], 0);
            marker.add(ring);
          });
          for (var tk = 0; tk < 4; tk++) {
            var tick = new THREE.Mesh(
              keep(ctx.roundedBox(A.marker.r * 0.16, A.marker.r * 0.62,
                                  A.marker.r * 0.16, A.marker.r * 0.05)),
              cageMat);
            var ta = (tk / 4) * Math.PI * 2;
            tick.position.set(Math.cos(ta) * A.marker.r * 2.0,
                              Math.sin(ta) * A.marker.r * 2.0, 0);
            tick.rotation.z = ta + Math.PI / 2;
            marker.add(tick);
          }
        })();
        var dropLine = new THREE.Mesh(
          keep(ctx.roundedBox(0.04, 1, 0.02)),
          mat({ color: A.marker.color, roughness: 0.6,
                emissive: A.marker.color, emissiveIntensity: 0.25, transparent: true, opacity: 0.5 }));
        scene.add(dropLine);

        var priceLabel = makeLabel(GW / 2 + 3.1, 2.6, 0,
          { top: "CLEARING PRICE", big: "100", sub: "target: 70 or less",
            accent: "#fffb00", box: true }, 3.20, 1.60);
        var qtyLabel = makeLabel(GW / 2 + 3.1, 0.0, 0,
          { top: "QUANTITY", big: "40", sub: "units reaching patients",
            accent: "#3fae6b", box: true }, 3.20, 1.60);
        // (the beams label themselves at their grips, so no side legend here)

        // ---------- patients ----------
        var patients = [];
        var pg = keep(new THREE.CapsuleGeometry(A.patient.r, A.patient.len, 16, 48));
        var pOn = mat({ color: A.patient.on, roughness: 0.4,
                        emissive: A.patient.on, emissiveIntensity: 0.45 });
        var pOff = mat({ color: A.patient.off, roughness: 0.8 });
        var pTrim = keep(ctx.material("machinedSteel", { color: 0x7c8694 }));
        var headGeo = keep(new THREE.SphereGeometry(A.patient.r * 0.86, 32, 20));
        var collarGeo = keep(ctx.turnedCylinder(A.patient.r * 0.80, A.patient.r * 1.02,
                                                A.patient.r * 0.34, A.patient.r * 0.10));
        var socketGeo = keep(ctx.turnedCylinder(A.patient.r * 1.15, A.patient.r * 1.42,
                                                A.patient.r * 0.42, A.patient.r * 0.12));
        var ringGeo = keep(new THREE.TorusGeometry(A.patient.r * 1.12, A.patient.r * 0.13, 10, 32));
        for (var i = 0; i < A.patient.count; i++) {
          var px = -GW / 2 + 0.28 + i * (GW / A.patient.count);
          var py = -GH / 2 - 1.15;
          var m = new THREE.Mesh(pg, pOff);
          m.position.set(px, py, 0);
          scene.add(m);
          patients.push(m);
          /* A row of bare capsules is a row of lozenges. Each one gets a head,
             a collar, a socketed base and a shoulder ring, all from four shared
             geometries so twenty-two of them cost four buffers. */
          var head = new THREE.Mesh(headGeo, pTrim);
          head.position.set(px, py + A.patient.len * 0.62 + A.patient.r * 0.5, 0);
          scene.add(head);
          var collar = new THREE.Mesh(collarGeo, pTrim);
          collar.position.set(px, py + A.patient.len * 0.42, 0);
          scene.add(collar);
          var socket = new THREE.Mesh(socketGeo, pTrim);
          socket.position.set(px, py - A.patient.len * 0.60, 0);
          scene.add(socket);
          var ring = new THREE.Mesh(ringGeo, pTrim);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(px, py - A.patient.len * 0.52, 0);
          scene.add(ring);
        }
        /* Was 5.63 x 0.97 — a 5.8:1 plane carrying a 2:1 canvas, which is why
           the caption looked squashed. At 2:1 and one step up the ladder it is
           legible, and it can afford the room now that the hint bubble has left
           the bottom of the screen. */
        makeLabel(0, -GH / 2 - 2.85, 0,
          { top: "PATIENTS SERVED", sub: "at the clearing price",
            accent: "#9aa6b4" }, 4.00, 2.00);

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
        var dragVel = 0, beamLag = 0;   // how hard the beam is being shoved, and how far it trails
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
            /* A beam that pins itself to the cursor has no weight. This trails
               it by an amount proportional to how fast it is being shoved and
               springs back when the hand stops, which costs nothing in the
               model: only the holder moves. */
            var want = dragging ? Math.max(-0.55, Math.min(0.55, -dragVel * 6)) : 0;
            beamLag += (want - beamLag) * Math.min(1, dt * 9);
            dragVel *= Math.max(0, 1 - dt * 9);
            supply.holder.position.x = dragging === "supply" ? beamLag : 0;
            demand.holder.position.x = dragging === "demand" ? beamLag : 0;
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
            dragVel = dx;            // fed to the lag in update()
            if (Math.abs(dx) > 0.02) ctx.sfx("tick");
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
