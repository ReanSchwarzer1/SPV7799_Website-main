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
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        var open = marketIsOpen();

        // ---------- floor ----------
        var floor = new THREE.Mesh(
          keep(ctx.roundedBox(A.floor.w, 0.3, A.floor.d)),
          ctx.wood("oak", { repeat: [5, 2] }));
        floor.position.set(0, -1.85, 0);
        scene.add(floor);

        /* Substructure. A base with a moulded lip and an apron under it reads
           as a built surface rather than a floating slab, and every one of
           those edges is chamfered so it carries its own highlight. */
        (function () {
          var subMat = ctx.wood("walnut", { repeat: [3, 1] }); keep(subMat);
          var W = A.floor.w, H = 0.3, DD = A.floor.d;
          var lip = new THREE.Mesh(ctx.roundedBox(W + H * 0.5, H * 0.42, H * 0.7, H * 0.14), subMat);
          lip.position.set(floor.position.x, floor.position.y + H * 0.30, floor.position.z + DD / 2 + H * 0.12);
          scene.add(lip);
          var apron = new THREE.Mesh(ctx.roundedBox(W * 0.95, H * 0.9, DD * 0.92, H * 0.12), subMat);
          apron.position.set(floor.position.x, floor.position.y - H * 0.85, floor.position.z);
          scene.add(apron);
          var legGeo = ctx.roundedBox(H * 0.9, H * 3.2, H * 0.9, H * 0.12);
          [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (c) {
            var leg = new THREE.Mesh(legGeo, subMat);
            leg.position.set(floor.position.x + c[0] * (W / 2 - H * 1.1),
                             floor.position.y - H * 2.3,
                             floor.position.z + c[1] * (DD / 2 - H * 1.1));
            scene.add(leg);
          });
        })();

        // ---------- canvas label helper ----------
        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- price column ----------
        var column = new THREE.Mesh(
          keep(ctx.turnedCylinder(A.column.r, A.column.r, 1)),
          mat({ color: A.column.color, roughness: 0.4,
                emissive: A.column.color, emissiveIntensity: 0.25 }));
        scene.add(column);

        /* The column is the reading of the whole scene, so it gets the
           treatment a real gauge would have: a turned flange bolted to the
           floor and a machined crown on top. */
        (function () {
          var steel = ctx.material("machinedSteel", { color: 0x9aa3b0 }); keep(steel);
          var flange = new THREE.Mesh(
            keep(ctx.turnedCylinder(A.column.r * 1.55, A.column.r * 1.75, 0.16)), steel);
          flange.position.set(A.column.x, -1.72, 0);
          scene.add(flange);
          // the flange is bolted down, so it has bolts in it
          var bolts = ctx.boltRing(A.column.r * 1.42, 8, 0.045, steel);
          bolts.position.set(A.column.x, -1.66, 0);
          scene.add(bolts);
          var crown = new THREE.Mesh(
            keep(ctx.turnedCylinder(A.column.r * 1.12, A.column.r * 1.24, 0.12)), steel);
          crown.name = "columnCrown";
          scene.add(crown);
          column.userData.crown = crown;
        })();
        /* The column was a smooth tube between its flange and its crown. Rolled
           steel comes in courses, so it gets banding rings, a welded vertical
           seam with rivets, and a gauge strip up the front.

           The column's height is the price, so it is rescaled every refresh.
           All of this therefore lives in one group whose children are laid out
           in a 0..maxH space measured from the base, and refresh() scales the
           group by the same factor as the column. Anything positioned at a
           fixed world height would float off the top of a cheap market. */
        var columnSkin = new THREE.Group();
        columnSkin.position.set(A.column.x, -1.7, 0);
        scene.add(columnSkin);
        (function () {
          var steel = keep(ctx.material("machinedSteel", { color: 0x9aa3b0 }));
          var R = A.column.r, MH = A.column.maxH;
          for (var b = 1; b <= 5; b++) {
            var band = new THREE.Mesh(
              keep(new THREE.TorusGeometry(R + 0.035, 0.045, 14, 96)), steel);
            band.rotation.x = Math.PI / 2;
            band.position.y = (b / 6) * MH;
            columnSkin.add(band);
          }
          var seam = new THREE.Mesh(
            keep(ctx.roundedBox(0.10, MH * 0.94, 0.05, 0.02)), steel);
          seam.position.set(0, MH * 0.5, R + 0.03);
          columnSkin.add(seam);
          var rv = ctx.rivetLine(MH * 0.88, 14, 0.024, steel);
          rv.rotation.z = Math.PI / 2;
          rv.position.set(0, MH * 0.5, R + 0.08);
          columnSkin.add(rv);
          var gauge = new THREE.Mesh(
            keep(ctx.roundedBox(0.17, MH * 0.90, 0.04, 0.012)),
            keep(ctx.material("paintedMetal", { color: 0x2a3140 })));
          gauge.position.set(R * 0.86, MH * 0.5, R * 0.62);
          columnSkin.add(gauge);
          var gGeo = keep(ctx.roundedBox(0.11, 0.020, 0.05, 0.007));
          for (var g = 0; g <= 12; g++) {
            var t = new THREE.Mesh(gGeo, steel);
            t.position.set(R * 0.86, 0.10 + (g / 12) * MH * 0.84, R * 0.62 + 0.04);
            columnSkin.add(t);
          }
        })();

        var columnCap = new THREE.Mesh(
          keep(ctx.turnedCylinder(A.column.r + 0.09, A.column.r + 0.09, 0.12)),
          mat({ color: 0xe8ecf2, roughness: 0.4 }));
        scene.add(columnCap);
        var priceLabel = makeLabel(A.column.x, 5.6, 0,
          { top: "PRICE INDEX", big: "100", accent: "#d4573f" }, 3.20, 1.60);

        // ---------- surplus tanks ----------
        function makeTank(cfg, title) {
          var shell = new THREE.Mesh(
            keep(ctx.roundedBox(A.tank.w, A.tank.maxH, A.tank.d)),
            mat({ color: cfg.color, roughness: 0.85, transparent: true, opacity: 0.32 }));
          shell.position.set(cfg.x, -1.7 + A.tank.maxH / 2, 0);
          scene.add(shell);
          /* The tank is a vessel, so it gets the fittings of one: a base flange
             it is bolted down with, a rim round the mouth, and a strap band. */
          (function () {
            var steel = ctx.material("machinedSteel", { color: 0x8d97a6 }); keep(steel);
            var flange = new THREE.Mesh(
              keep(ctx.roundedBox(A.tank.w * 1.22, 0.12, A.tank.d * 1.22, 0.03)), steel);
            flange.position.set(cfg.x, -1.7 + 0.06, 0);
            scene.add(flange);
            var rim = new THREE.Mesh(
              keep(ctx.roundedBox(A.tank.w * 1.14, 0.10, A.tank.d * 1.14, 0.028)), steel);
            rim.position.set(cfg.x, -1.7 + A.tank.maxH, 0);
            scene.add(rim);
            var strap = new THREE.Mesh(
              keep(ctx.roundedBox(A.tank.w * 1.08, 0.06, A.tank.d * 1.08, 0.02)), steel);
            strap.position.set(cfg.x, -1.7 + A.tank.maxH * 0.45, 0);
            scene.add(strap);
            // rivets along the strap band, front face only
            var tr = ctx.rivetLine(A.tank.w * 0.9, 7, 0.026, steel);
            tr.position.set(cfg.x, -1.7 + A.tank.maxH * 0.45, A.tank.d * 0.58);
            scene.add(tr);
          })();
          /* Flat plates bolted to a translucent box still read as a box. What a
             pressure vessel actually has is a frame: angle-iron up all four
             corners, ribs banding it at intervals, feet under the flange, and a
             sight glass on the front with a graduated scale beside it. The
             sight glass carries the same level as the tank, so the gauge is
             not decoration. */
          var sight = null;
          (function () {
            var steel = keep(ctx.material("machinedSteel", { color: 0x8d97a6 }));
            var dark = keep(ctx.material("paintedMetal", { color: 0x2a3140 }));
            var HW = A.tank.w / 2, HD = A.tank.d / 2, H = A.tank.maxH, Y0 = -1.7;

            // angle iron up each corner: two thin webs meeting at right angles
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
              var wa = new THREE.Mesh(keep(ctx.roundedBox(0.20, H, 0.06, 0.018)), dark);
              wa.position.set(cfg.x + c[0] * (HW - 0.08), Y0 + H / 2, c[1] * (HD + 0.03));
              scene.add(wa);
              var wb = new THREE.Mesh(keep(ctx.roundedBox(0.06, H, 0.20, 0.018)), dark);
              wb.position.set(cfg.x + c[0] * (HW + 0.03), Y0 + H / 2, c[1] * (HD - 0.08));
              scene.add(wb);
            });

            // ribs banding the shell, with bolts at the corners of each
            [0.20, 0.70, 0.92].forEach(function (f) {
              var rib = new THREE.Mesh(
                keep(ctx.roundedBox(A.tank.w * 1.07, 0.09, A.tank.d * 1.07, 0.025)), dark);
              rib.position.set(cfg.x, Y0 + H * f, 0);
              scene.add(rib);
              [[-1, 1], [1, 1]].forEach(function (c) {
                var b = ctx.boltHead(0.032, steel);
                b.rotation.x = Math.PI / 2;
                b.position.set(cfg.x + c[0] * (HW - 0.16), Y0 + H * f, HD + 0.09);
                scene.add(b);
              });
            });

            var feet = ctx.footPads(A.tank.w * 1.18, A.tank.d * 1.18,
                                    keep(ctx.material("rubber", { color: 0x24262a })), 0.11);
            feet.position.set(cfg.x, Y0 - 0.05, 0);
            scene.add(feet);

            // sight glass: a clear tube, its two unions, and a graduated plate
            var tube = new THREE.Mesh(
              keep(ctx.turnedCylinder(0.085, 0.085, H * 0.94, 0.02)),
              keep(ctx.material("glass", { color: 0xbcd4e6, transparent: true,
                                           opacity: 0.30, roughness: 0.06 })));
            tube.position.set(cfg.x + HW * 0.52, Y0 + H * 0.5, HD + 0.16);
            scene.add(tube);
            [0.03, 0.97].forEach(function (u) {
              var union = new THREE.Mesh(
                keep(ctx.turnedCylinder(0.13, 0.15, 0.14, 0.03)), steel);
              union.position.set(cfg.x + HW * 0.52, Y0 + H * u, HD + 0.16);
              scene.add(union);
            });
            sight = new THREE.Mesh(
              keep(ctx.turnedCylinder(0.062, 0.062, 1, 0.015)),
              mat({ color: cfg.fill, roughness: 0.3,
                    emissive: cfg.fill, emissiveIntensity: 0.45 }));
            scene.add(sight);

            var scalePlate = new THREE.Mesh(
              keep(ctx.roundedBox(0.20, H * 0.94, 0.04, 0.012)), dark);
            scalePlate.position.set(cfg.x + HW * 0.52 + 0.20, Y0 + H * 0.5, HD + 0.16);
            scene.add(scalePlate);
            var tGeo = keep(ctx.roundedBox(0.13, 0.022, 0.05, 0.008));
            var tGeoL = keep(ctx.roundedBox(0.20, 0.030, 0.05, 0.008));
            for (var g = 0; g <= 10; g++) {
              var tick = new THREE.Mesh(g % 5 === 0 ? tGeoL : tGeo, steel);
              tick.position.set(cfg.x + HW * 0.52 + 0.22, Y0 + H * 0.03 + (g / 10) * H * 0.94,
                                HD + 0.19);
              scene.add(tick);
            }
          })();

          var fill = new THREE.Mesh(
            keep(ctx.roundedBox(A.tank.w * 0.82, 1, A.tank.d * 0.82)),
            mat({ color: cfg.fill, roughness: 0.45,
                  emissive: cfg.fill, emissiveIntensity: 0.22 }));
          scene.add(fill);
          var lab = makeLabel(cfg.x, -1.7 + A.tank.maxH + 0.95, 0,
            { top: title, accent: "#" + cfg.fill.toString(16).padStart(6, "0") }, 3.20, 1.60);
          return { fill: fill, sight: sight, x: cfg.x, label: lab, title: title,
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

        /* the lever gets a collar, a shaft and end stops on the rail */
        (function () {
          var steel = ctx.material("machinedSteel", { color: 0x8d97a6 }); keep(steel);
          [railL, railR].forEach(function (rx) {
            var stop = new THREE.Mesh(keep(ctx.turnedCylinder(0.14, 0.16, 0.30, 0.03)), steel);
            stop.rotation.z = Math.PI / 2;
            stop.position.set(rx, A.lever.y, A.lever.z);
            scene.add(stop);
          });
        })();
        /* The rail was a single dark bar and the lever a ball on top of it. A
           real slide has a channel: two side rails, mounting blocks bolted down
           at intervals, and a graduated strip so the position means something. */
        (function () {
          var steel = keep(ctx.material("machinedSteel", { color: 0x8d97a6 }));
          var dark = keep(ctx.material("paintedMetal", { color: 0x232a36 }));
          var span = railR - railL;
          [-1, 1].forEach(function (sd) {
            var side = new THREE.Mesh(keep(ctx.roundedBox(span, 0.16, 0.07, 0.025)), steel);
            side.position.set(0, A.lever.y + 0.06, A.lever.z + sd * 0.145);
            scene.add(side);
          });
          var web = new THREE.Mesh(keep(ctx.roundedBox(span, 0.09, 0.34, 0.025)), dark);
          web.position.set(0, A.lever.y - 0.10, A.lever.z);
          scene.add(web);
          for (var mb = -4; mb <= 4; mb++) {
            var blk = new THREE.Mesh(keep(ctx.roundedBox(0.32, 0.22, 0.42, 0.04)), dark);
            blk.position.set(mb * (span / 9), A.lever.y - 0.20, A.lever.z);
            scene.add(blk);
            var bb = ctx.boltRing(0.11, 2, 0.030, steel);
            bb.position.set(mb * (span / 9), A.lever.y - 0.09, A.lever.z);
            scene.add(bb);
          }
          var strip = new THREE.Mesh(keep(ctx.roundedBox(span * 0.96, 0.16, 0.04, 0.012)), dark);
          strip.position.set(0, A.lever.y + 0.02, A.lever.z + 0.20);
          scene.add(strip);
          var tGeo = keep(ctx.roundedBox(0.022, 0.11, 0.05, 0.007));
          var tGeoL = keep(ctx.roundedBox(0.030, 0.17, 0.05, 0.007));
          for (var g = 0; g <= 14; g++) {
            var t = new THREE.Mesh(g % 7 === 0 ? tGeoL : tGeo, steel);
            t.position.set(railL + (g / 14) * span, A.lever.y + 0.02, A.lever.z + 0.23);
            scene.add(t);
          }
        })();

        var knob = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.lever.knob, 64, 40)),
          mat({ color: open ? A.lever.color : 0x5b6270, roughness: 0.35,
                emissive: open ? A.lever.color : 0x000000, emissiveIntensity: 0.3 }));
        knob.position.set(railL, A.lever.y + 0.3, A.lever.z);
        scene.add(knob);
        /* A sphere alone is a ball, not a handle. The stem, collar and carriage
           are parented to the knob so the whole assembly slides as one. */
        (function () {
          var steel = keep(ctx.material("machinedSteel", { color: 0x8d97a6 }));
          var stem = new THREE.Mesh(keep(ctx.turnedCylinder(0.075, 0.10, 0.42, 0.025)), steel);
          stem.position.y = -0.26;
          knob.add(stem);
          var collar = new THREE.Mesh(keep(ctx.turnedCylinder(0.17, 0.17, 0.07, 0.025)), steel);
          collar.position.y = -0.09;
          knob.add(collar);
          var carriage = new THREE.Mesh(keep(ctx.roundedBox(0.46, 0.14, 0.40, 0.04)), steel);
          carriage.position.y = -0.44;
          knob.add(carriage);
          var cb = ctx.boltRing(0.15, 4, 0.026, steel);
          cb.position.y = -0.37;
          knob.add(cb);
          var cap = new THREE.Mesh(keep(ctx.turnedCylinder(0.13, 0.16, 0.06, 0.02)), steel);
          cap.position.y = A.lever.knob * 0.86;
          knob.add(cap);
        })();
        if (open) ctx.pickables.push(knob);

        var leverLabel = makeLabel(1.7, A.lever.y - 1.35, A.lever.z + 1.2,
          open ? { top: "GENERIC FIRMS", big: "1", sub: "drag the lever", accent: "#d9a441" }
               : { top: "GATE BOLTED", sub: "your ruling closed this market", accent: "#d4573f" },
          3.0, 1.5);

        // ---------- procurement wheel ----------
        /* This was one bare cylinder, which is why it read as a poker chip
           rather than a control. It is now built the way a cast valve handwheel
           actually is: a rim with an outer and inner bead, three tapered spokes
           cast straight through the hub, a bolted hub cap, grip knobs on the
           rim, and a shaft running back into a bracket bolted to a detent plate.
           The bracket and plate are static; only the wheel spins. */
        var WX = -3.4, WY = A.lever.y + 0.3, WZ = A.lever.z, WR = A.wheel.r;
        var wheelBlue = mat({ color: A.wheel.color, roughness: 0.34, metalness: 0.42,
                              emissive: A.wheel.color, emissiveIntensity: 0.20 });
        var wheelDark = mat({ color: 0x2f4c70, roughness: 0.45, metalness: 0.50 });
        var wheelSteel = mat({ color: 0x8b949f, roughness: 0.30, metalness: 0.85 });

        var wheel = new THREE.Group();
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(WX, WY, WZ);
        scene.add(wheel);

        wheel.add(new THREE.Mesh(
          keep(new THREE.TorusGeometry(WR, 0.125, 28, 128)), wheelBlue));
        wheel.add(new THREE.Mesh(
          keep(new THREE.TorusGeometry(WR + 0.058, 0.048, 20, 128)), wheelDark));
        wheel.add(new THREE.Mesh(
          keep(new THREE.TorusGeometry(WR - 0.062, 0.038, 20, 128)), wheelDark));

        var spokeGeo = keep(ctx.turnedCylinder(0.048, 0.082, WR * 1.78, 0.02));
        for (var sp = 0; sp < 3; sp++) {
          var bar = new THREE.Mesh(spokeGeo, wheelBlue);
          bar.rotation.z = (sp / 3) * Math.PI;
          wheel.add(bar);
        }
        /* Webs in the corner where each spoke meets the hub — cast parts are
           never a clean butt joint. */
        for (var wb = 0; wb < 6; wb++) {
          var web = new THREE.Mesh(keep(ctx.roundedBox(0.20, 0.075, 0.11, 0.02)), wheelBlue);
          var wa = (wb / 6) * Math.PI * 2;
          web.position.set(Math.cos(wa) * 0.30, Math.sin(wa) * 0.30, 0);
          web.rotation.z = wa;
          wheel.add(web);
        }

        var hub = new THREE.Mesh(keep(ctx.turnedCylinder(0.215, 0.275, 0.34, 0.03)), wheelBlue);
        hub.rotation.x = Math.PI / 2; wheel.add(hub);
        var hubCap = new THREE.Mesh(keep(ctx.turnedCylinder(0.30, 0.30, 0.07, 0.025)), wheelSteel);
        hubCap.rotation.x = Math.PI / 2; hubCap.position.z = 0.19; wheel.add(hubCap);
        var hubBolts = ctx.boltRing(0.205, 6, 0.036, wheelSteel);
        hubBolts.rotation.x = -Math.PI / 2; hubBolts.position.z = 0.22; wheel.add(hubBolts);

        /* Grip knobs, the part a hand would actually take hold of. */
        var knobGeo = keep(ctx.turnedCylinder(0.075, 0.055, 0.20, 0.03));
        for (var gk = 0; gk < 3; gk++) {
          var grip = new THREE.Mesh(knobGeo, wheelDark);
          var ga = (gk / 3) * Math.PI * 2 + Math.PI / 6;
          grip.position.set(Math.cos(ga) * WR, Math.sin(ga) * WR, 0.20);
          grip.rotation.x = Math.PI / 2;
          wheel.add(grip);
        }

        var wheelHit = new THREE.Mesh(
          keep(new THREE.CylinderGeometry(WR + 0.12, WR + 0.12, 0.5, 16)),
          new THREE.MeshBasicMaterial({ visible: false }));
        wheelHit.rotation.x = Math.PI / 2;
        wheelHit.userData.rimTarget = wheel;
        wheel.add(wheelHit);
        ctx.pickables.push(wheelHit);

        /* Static mount: shaft, detent plate with teeth, bracket and gussets. */
        var shaft = new THREE.Mesh(keep(ctx.turnedCylinder(0.10, 0.10, 0.62, 0.02)), wheelSteel);
        shaft.rotation.x = Math.PI / 2; shaft.position.set(WX, WY, WZ - 0.30);
        scene.add(shaft);

        var detent = new THREE.Mesh(keep(ctx.turnedCylinder(0.46, 0.50, 0.10, 0.03)), wheelDark);
        detent.rotation.x = Math.PI / 2; detent.position.set(WX, WY, WZ - 0.44);
        scene.add(detent);
        var toothGeo = keep(ctx.roundedBox(0.07, 0.13, 0.10, 0.018));
        for (var td = 0; td < 16; td++) {
          var tooth = new THREE.Mesh(toothGeo, wheelSteel);
          var ta = (td / 16) * Math.PI * 2;
          tooth.position.set(WX + Math.cos(ta) * 0.50, WY + Math.sin(ta) * 0.50, WZ - 0.44);
          tooth.rotation.z = ta;
          scene.add(tooth);
        }

        var bracket = new THREE.Mesh(keep(ctx.roundedBox(0.90, 0.90, 0.14, 0.05)), wheelDark);
        bracket.position.set(WX, WY, WZ - 0.58);
        scene.add(bracket);
        var bracketBolts = ctx.boltRing(0.34, 4, 0.042, wheelSteel);
        bracketBolts.rotation.x = -Math.PI / 2;
        bracketBolts.position.set(WX, WY, WZ - 0.50);
        scene.add(bracketBolts);
        for (var gu = -1; gu <= 1; gu += 2) {
          var gusset = new THREE.Mesh(keep(ctx.roundedBox(0.11, 0.62, 0.42, 0.03)), wheelDark);
          gusset.position.set(WX + gu * 0.34, WY - 0.30, WZ - 0.78);
          scene.add(gusset);
        }
        var post = new THREE.Mesh(keep(ctx.turnedCylinder(0.13, 0.19, 1.5, 0.04)), wheelDark);
        post.position.set(WX, WY - 1.05, WZ - 0.72);
        scene.add(post);
        var postBase = new THREE.Mesh(keep(ctx.turnedCylinder(0.34, 0.44, 0.16, 0.04)), wheelSteel);
        postBase.position.set(WX, WY - 1.78, WZ - 0.72);
        scene.add(postBase);
        var wheelLabel = makeLabel(-3.4, A.lever.y - 1.35, A.lever.z + 1.2,
          { top: "PROCUREMENT", sub: "LOW · click to raise", accent: "#4f86c6" }, 3.20, 1.60);

        // ---------- firms ----------
        var firmGroup = new THREE.Group();
        scene.add(firmGroup);
        var firmMeshes = [];
        var firmMat = mat({ color: A.firm.color, roughness: 0.7 });
        var roofMat = mat({ color: A.firm.roof, roughness: 0.5 });
        var firmGlass = mat({ color: 0x24303f, roughness: 0.22, metalness: 0.35 });
        /* Built once and cloned, so fourteen firms cost one set of buffers. */
        var firmProto = ctx.blockBuilding(A.firm.w, A.firm.h, A.firm.d, {
          bodyMat: firmMat, trimMat: roofMat, glassMat: firmGlass });
        for (var i = 0; i < A.firm.maxShown; i++) {
          var grp = firmProto.clone();
          var col = i % 7, row = Math.floor(i / 7);
          grp.position.set(-3.15 + col * 1.05, -1.25, 1.35 + row * 1.0);
          grp.scale.setScalar(0.001);
          grp.visible = false;
          firmGroup.add(grp);
          firmMeshes.push(grp);
        }

        // ---------- state ----------
        var N = 1, procurement = 1;
        var knobTargetX = null;      // where the hand wants the lever (see update)
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
            if (column.userData.crown) {
              column.userData.crown.position.set(A.column.x, column.position.y + column.scale.y / 2 + 0.06, 0);
            }
          column.position.set(A.column.x, -1.7 + h / 2, 0);
          columnSkin.scale.y = h / A.column.maxH;
          columnCap.position.set(A.column.x, -1.7 + h + 0.06, 0);
          priceLabel.material.map = labelTex(
            { top: "PRICE INDEX", big: String(Math.round(m.price)), accent: "#d4573f" });
          priceLabel.material.needsUpdate = true;

          function setTank(t, v) {
            var hh = Math.max(0.08, Math.min(1, v / MAXV) * A.tank.maxH);
            t.fill.scale.y = hh;
            t.fill.position.set(t.x, -1.7 + hh / 2, 0);
            // the sight glass reads the same level as the tank it is bolted to
            if (t.sight) {
              t.sight.scale.y = hh * 0.94;
              t.sight.position.set(t.x + A.tank.w * 0.26, -1.7 + 0.16 + hh * 0.47,
                                   A.tank.d * 0.5 + 0.16);
            }
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
            if (knobTargetX !== null) {
              var d = knobTargetX - knob.position.x;
              if (Math.abs(d) > 0.0005) {
                knob.position.x += d * Math.min(1, dt * 11);
                var t = (knob.position.x - railL) / (railR - railL);
                var newN = Math.max(1, Math.round(1 + t * 49));
                if (newN !== N) {
                  N = newN;
                  ctx.sfx("tick");
                  /* The floor gets busier as competitors are admitted. This is
                     the brief's crossfading trading floor, done as a parameter
                     on the bed rather than a second recording. */
                  ctx.ambience({ level: 0.16, busy: Math.min(1, (N - 1) / 24) });
                  pushToPage(); refresh();
                }
              }
            }
            for (var k = 0; k < firmMeshes.length; k++) {
              var f = firmMeshes[k];
              var want = f.visible ? 1 : 0.001;
              f.scale.setScalar(f.scale.x + (want - f.scale.x) * Math.min(1, dt * 7));
            }
          },

          onPointerDown: function (hitObj) {
            if (!hitObj) return;
            if (hitObj.object === knob && open) { dragging = true; ctx.sfx("grab"); return; }
            if (hitObj.object === wheelHit) {
              ctx.sfx("ratchet");
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
            /* The pointer sets a target, not the position. update() carries
               the lever toward it, and the firm count is read off where the
               lever actually is — so the number follows the object rather than
               the hand, and the whole thing has weight instead of being welded
               to the cursor. */
            knobTargetX = Math.max(railL, Math.min(railR, w.x));
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
