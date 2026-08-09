/* ============================================================
   interlude-antitrust.js — competition and innovation (module 8)
   Condition B embodied layer.

   The Aghion inverted-U is built as an actual hill. A ball sits on
   it wherever the market currently is, and the player moves the
   market by putting firms onto the floor or taking them off, one
   at a time. Too few firms and the ball sits low on the left, where
   a monopolist has no reason to invent. Too many and it slides down
   the right, where nobody earns enough to fund research. The summit
   is in between.

   Objective: park the market between 3 and 8 firms.

   Both the concentration index and the curve are the page's own:
     HHI  = sum of squared market shares
     innovation intensity = 100 (n/5) e^(1 - n/5)
   The originator's share shrinks as entrants arrive, exactly as the
   page models it, so the HHI bar and the score stay on one model.
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

    window.Interludes.register("antitrust", {
      kicker: "The concentration room",
      title: "How much competition invents most",
      step: "HHI and the inverted-U",
      instructions: "Add or remove firms. Park the ball on the summit.",

      assets: {
        minFirms: 1, maxFirms: 15,
        zone: [3, 8],                        // the sweet spot the module wants
        hill:  { w: 11.0, h: 4.4, samples: 57, thickness: 0.16, color: 0x5b6270,
                 peak: 0x3fae6b },
        ball:  { r: 0.36, color: 0xfffb00 },
        firm:  { w: 0.44, h: 0.72, d: 0.44, color: 0x7f8b9c, roof: 0xa9b6c7 },
        hhi:   { w: 9.0, h: 0.72, y: -3.7 },
        button:{ w: 1.7, h: 0.9, d: 0.5 },
        camera: { elevationDeg: 8, margin: 1.13, lookAt: [0, -0.2, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- the model, mirroring the page ----------
        function shares(n) {
          if (n <= 1) return [100];
          var originator = Math.max(5, 100 - n * 7);
          var rest = (100 - originator) / (n - 1);
          var out = [originator];
          for (var i = 0; i < n - 1; i++) out.push(rest);
          return out;
        }
        function hhiOf(n) {
          return Math.round(shares(n).reduce(function (a, s) { return a + s * s; }, 0));
        }
        function innovationOf(n) { return 100 * (n / 5) * Math.exp(1 - n / 5); }

        // ---------- the hill ----------
        function curveX(n) {
          return ((n - A.minFirms) / (A.maxFirms - A.minFirms)) * A.hill.w - A.hill.w / 2;
        }
        function curveY(n) { return (innovationOf(n) / 100) * A.hill.h - 1.1; }

        /* The inverted-U reads better as a physical diorama than as a chart,
           so the hill is polished stone: veined normal and roughness maps plus
           a light clearcoat. The maps tile across the 57 segments the curve is
           built from, which is why they are generated once here rather than
           per segment. */
        var marbleH = ctx.surfaces.marble(1);
        var marbleN = ctx.normalTexture("marble", 512, 512, marbleH, 1.1, 3, 1);
        var marbleR = ctx.grayTexture("marbleR", 512, 512, marbleH, 3, 1);
        var hillMat = keep(ctx.material("polishedStone", { color: A.hill.color }));
        var peakMat = mat({ color: A.hill.peak, roughness: 0.5,
                            emissive: A.hill.peak, emissiveIntensity: 0.3 });
        /* The curve was a ribbon of 57 thin segments with nothing under it, so
           it read as a plotted line rather than a landform. The segments stay,
           as the coloured cap rail that carries the zone shading, but they now
           sit on a solid body extruded from the same curve: traced along the
           top, dropped to a base line, and bevelled so the whole silhouette
           carries an edge. */
        (function () {
          var shape = new THREE.Shape();
          var BASE = -2.35;
          var N = 96;
          shape.moveTo(curveX(A.minFirms), BASE);
          for (var i = 0; i <= N; i++) {
            var n = A.minFirms + (i / N) * (A.maxFirms - A.minFirms);
            shape.lineTo(curveX(n), curveY(n) - A.hill.thickness * 0.5);
          }
          shape.lineTo(curveX(A.maxFirms), BASE);
          shape.closePath();
          var body = new THREE.Mesh(
            keep(new THREE.ExtrudeGeometry(shape, {
              depth: 0.86, bevelEnabled: true, bevelThickness: 0.05,
              bevelSize: 0.05, bevelSegments: 3, curveSegments: 12 })),
            ctx.material("polishedStone", { color: 0x5b6270 }));
          body.position.z = -0.94;   // sits behind the rail so the curve stands proud
          scene.add(body);

          /* A flat face square to the camera catches almost no light, so the
             mass read as a black hole under the curve. Contour bands across it
             and buttress ribs under it give the light something to break on,
             and turn the fill into a landform with construction rather than a
             silhouette. The extrusion runs from z 0 to depth, so with the body
             pushed back its front face is at -0.08; these sit just proud of it,
             not at the body centre, or they would be buried inside. */
          var band = ctx.material("polishedStone", { color: 0x6d7686 });
          var ribMat = ctx.material("polishedStone", { color: 0x4a515e });
          keep(band); keep(ribMat);
          for (var lv = 0; lv < 6; lv++) {
            var yy = BASE + ((lv + 1) / 7) * (A.hill.h + 1.2);
            /* trim each contour to the width of the hill at that height */
            var lo = null, hi = null;
            for (var q = 0; q <= 160; q++) {
              var nn = A.minFirms + (q / 160) * (A.maxFirms - A.minFirms);
              if (curveY(nn) >= yy) { if (lo === null) lo = curveX(nn); hi = curveX(nn); }
            }
            if (lo === null || hi - lo < 0.3) continue;
            var contour = new THREE.Mesh(
              keep(ctx.roundedBox(hi - lo, 0.055, 0.10, 0.02)), band);
            contour.position.set((lo + hi) / 2, yy, -0.03);
            scene.add(contour);
          }
          for (var rb = 0; rb < 13; rb++) {
            var rx = -A.hill.w / 2 + ((rb + 0.5) / 13) * A.hill.w;
            var top = -1e9, nn2;
            for (var q2 = 0; q2 <= 60; q2++) {
              nn2 = A.minFirms + (q2 / 60) * (A.maxFirms - A.minFirms);
              if (Math.abs(curveX(nn2) - rx) < A.hill.w / 26) top = Math.max(top, curveY(nn2));
            }
            if (top < BASE + 0.25) continue;
            var rib = new THREE.Mesh(
              keep(ctx.roundedBox(0.10, top - BASE - 0.10, 0.14, 0.03)), ribMat);
            rib.position.set(rx, (BASE + top) / 2 - 0.05, -0.04);
            scene.add(rib);
          }
          // a plinth the landform stands on, with feet under it
          var plinth = new THREE.Mesh(
            keep(ctx.roundedBox(A.hill.w * 1.12, 0.26, 1.5, 0.05)),
            ctx.wood("oak", { repeat: [4, 1] }));
          plinth.position.set(0, BASE - 0.13, 0);
          scene.add(plinth);
          var pads = ctx.footPads(A.hill.w * 1.02, 1.3,
                                  ctx.material("rubber", { color: 0x24262a }), 0.09);
          pads.position.y = BASE - 0.28;
          scene.add(pads);
        })();
        var segGeo = keep(ctx.roundedBox(1, A.hill.thickness, 0.5));
        for (var s = 0; s < A.hill.samples; s++) {
          var n0 = A.minFirms + (s / A.hill.samples) * (A.maxFirms - A.minFirms);
          var n1 = A.minFirms + ((s + 1) / A.hill.samples) * (A.maxFirms - A.minFirms);
          var p0 = new THREE.Vector3(curveX(n0), curveY(n0), 0);
          var p1 = new THREE.Vector3(curveX(n1), curveY(n1), 0);
          var mid = p0.clone().add(p1).multiplyScalar(0.5);
          var dir = p1.clone().sub(p0);
          var inZone = n0 >= A.zone[0] && n0 <= A.zone[1];
          var seg = new THREE.Mesh(segGeo, inZone ? peakMat : hillMat);
          seg.position.copy(mid);
          seg.scale.x = dir.length() * 1.06;
          seg.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
          scene.add(seg);
        }
        // summit flag over the sweet spot
        var flagPole = new THREE.Mesh(
          keep(ctx.turnedCylinder(0.035, 0.035, 1.1)),
          mat({ color: 0xe8ecf2, roughness: 0.5 }));
        flagPole.position.set(curveX(5), curveY(5) + 0.62, 0);
        scene.add(flagPole);
        makeLabel(curveX(5), curveY(5) + 1.75, 0,
          { top: "THE SUMMIT", sub: "3 to 8 firms", accent: "#3fae6b", box: true }, 2.5, 1.25);

        // ---------- the ball ----------
        var ball = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.ball.r, 64, 40)),
          keep(ctx.material("brass", {
            // kept faintly emissive so the weight still reads against the dark
            // hall; the brass response now does the rest
            color: A.ball.color, emissive: A.ball.color, emissiveIntensity: 0.18 })));
        scene.add(ball);

        /* A perfect sphere is the one shape with no edge anywhere on it, so it
           has nothing for the light to break on and reads as a dot. Two banding
           hoops and a pair of polar bosses give it a machined look, and they
           are parented to the ball so they travel with it. */
        (function () {
          var bandMat = keep(ctx.material("brass", { color: 0x8a6321 }));
          [[0, 0], [Math.PI / 2, 0]].forEach(function (rot) {
            var hoop = new THREE.Mesh(
              keep(new THREE.TorusGeometry(A.ball.r * 1.01, A.ball.r * 0.09, 16, 96)), bandMat);
            hoop.rotation.set(rot[0], rot[1], 0);
            ball.add(hoop);
          });
          [-1, 1].forEach(function (c) {
            var boss = new THREE.Mesh(
              keep(ctx.turnedCylinder(A.ball.r * 0.30, A.ball.r * 0.36,
                                      A.ball.r * 0.24, A.ball.r * 0.07)), bandMat);
            boss.position.y = c * A.ball.r * 0.92;
            ball.add(boss);
          });
        })();

        // ---------- firms on the floor ----------
        var firmMeshes = [];
        var fMat = mat({ color: A.firm.color, roughness: 0.7 });
        var rMat = mat({ color: A.firm.roof, roughness: 0.5 });
        var fGlass = mat({ color: 0x24303f, roughness: 0.22, metalness: 0.35 });
        var firmProto = ctx.blockBuilding(A.firm.w, A.firm.h, A.firm.d, {
          bodyMat: fMat, trimMat: rMat, glassMat: fGlass });
        for (var i = 0; i < A.maxFirms; i++) {
          var grp = firmProto.clone();
          grp.position.set(-((A.maxFirms - 1) * 0.66) / 2 + i * 0.66, -2.55, 1.5);
          grp.scale.setScalar(0.001);
          grp.visible = false;
          scene.add(grp);
          firmMeshes.push(grp);
        }

        // ---------- HHI bar ----------
        var hhiSegs = [];
        var hhiBack = new THREE.Mesh(
          keep(ctx.roundedBox(A.hhi.w, A.hhi.h, 0.1)),
          mat({ color: 0x232a36, roughness: 0.85 }));
        hhiBack.position.set(0, A.hhi.y, 0);
        scene.add(hhiBack);
        var segGeo2 = keep(ctx.roundedBox(1, A.hhi.h * 0.82, 0.16));
        var origMat = mat({ color: 0x1a1a1a, roughness: 0.6 });
        var genMat = mat({ color: 0xc9ced6, roughness: 0.6 });
        for (var k = 0; k < A.maxFirms; k++) {
          var sg = new THREE.Mesh(segGeo2, k === 0 ? origMat : genMat);
          sg.visible = false;
          scene.add(sg);
          hhiSegs.push(sg);
        }
        var hhiLabel = makeLabel(0, A.hhi.y - 1.05, 0,
          { top: "HERFINDAHL-HIRSCHMAN INDEX", big: "10,000",
            sub: "highly concentrated", accent: "#d4573f", box: true, bigSize: 70 }, 4.4, 2.2);

        // ---------- add / remove buttons ----------
        function makeButton(x, sign, title, color) {
          /* The cap was the whole button, so it read as a coloured slab. It is
             now a rocker sitting in a recessed housing: a domed cap on a
             chamfered rocker, a bezel frame round the recess, corner screws,
             a raised +/- glyph and a lamp beside it. */
          var b = new THREE.Mesh(
            keep(ctx.roundedBox(A.button.w * 0.86, A.button.h * 0.62, A.button.d * 0.80,
                                A.button.h * 0.16)),
            mat({ color: color, roughness: 0.34, metalness: 0.25,
                  emissive: color, emissiveIntensity: 0.30 }));
          b.position.set(x, -2.55 + A.button.h * 0.10, 3.4);
          b.rotation.x = -0.13;
          scene.add(b);
          (function () {
            var steel = keep(ctx.material("machinedSteel", { color: 0x79828e }));
            var dark = keep(ctx.material("paintedMetal", { color: 0x232a36 }));
            var housing = new THREE.Mesh(
              keep(ctx.roundedBox(A.button.w * 1.24, A.button.h * 0.66, A.button.d * 1.28, 0.04)),
              dark);
            housing.position.set(x, -2.55 - A.button.h * 0.12, 3.4);
            scene.add(housing);
            [[-1, 0], [1, 0]].forEach(function (c) {
              var jamb = new THREE.Mesh(
                keep(ctx.roundedBox(A.button.w * 0.11, A.button.h * 0.52, A.button.d * 1.10, 0.03)),
                steel);
              jamb.position.set(x + c[0] * A.button.w * 0.56, -2.55 + A.button.h * 0.08, 3.4);
              scene.add(jamb);
            });
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
              var sc = ctx.boltHead(0.030, steel);
              sc.position.set(x + c[0] * A.button.w * 0.60, -2.55 + A.button.h * 0.20,
                              3.4 + c[1] * A.button.d * 0.62);
              scene.add(sc);
            });
            // the glyph on the cap: a bar, plus a crossbar when it is an add
            var glyphMat = mat({ color: 0xffffff, roughness: 0.3,
                                 emissive: 0xffffff, emissiveIntensity: 0.5 });
            var barH = new THREE.Mesh(
              keep(ctx.roundedBox(A.button.w * 0.28, A.button.h * 0.07,
                                  A.button.d * 0.10, 0.015)), glyphMat);
            barH.position.set(x, -2.55 + A.button.h * 0.44, 3.44);
            barH.rotation.x = -0.13;
            scene.add(barH);
            if (sign > 0) {
              var barV = new THREE.Mesh(
                keep(ctx.roundedBox(A.button.h * 0.07, A.button.w * 0.28,
                                    A.button.d * 0.10, 0.015)), glyphMat);
              barV.position.set(x, -2.55 + A.button.h * 0.44, 3.44);
              barV.rotation.x = -0.13;
              scene.add(barV);
            }
            var lampRing = new THREE.Mesh(
              keep(new THREE.TorusGeometry(0.075, 0.022, 10, 28)), steel);
            lampRing.rotation.x = Math.PI / 2;
            lampRing.position.set(x + A.button.w * 0.42, -2.55 + A.button.h * 0.24, 3.82);
            scene.add(lampRing);
            var lamp = new THREE.Mesh(
              keep(new THREE.SphereGeometry(0.055, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6)),
              mat({ color: color, roughness: 0.25,
                    emissive: color, emissiveIntensity: 0.75 }));
            lamp.position.set(x + A.button.w * 0.42, -2.55 + A.button.h * 0.26, 3.82);
            scene.add(lamp);
          })();
          /* A button, not a coloured box: a bezel it sits in, a chamfered cap
             on the face and a machined collar round the base. */
          (function () {
            var steel = ctx.material("machinedSteel", { color: 0x79828e }); keep(steel);
            var bezel = new THREE.Mesh(
              keep(ctx.roundedBox(A.button.w * 1.22, A.button.h * 0.42, A.button.d * 1.24, 0.03)), steel);
            bezel.position.set(x, -2.55 - A.button.h * 0.34, 3.4);
            scene.add(bezel);
            var capPlate = new THREE.Mesh(
              keep(ctx.roundedBox(A.button.w * 0.70, A.button.h * 0.16, A.button.d * 0.66, 0.02)),
              mat({ color: color, roughness: 0.3, emissive: color, emissiveIntensity: 0.5 }));
            capPlate.position.set(x, -2.55 + A.button.h * 0.52, 3.4);
            scene.add(capPlate);
            [-1, 1].forEach(function (sg) {
              var pin = new THREE.Mesh(keep(ctx.turnedCylinder(0.05, 0.05, 0.16, 0.015)), steel);
              pin.position.set(x + sg * A.button.w * 0.52, -2.55 - A.button.h * 0.30, 3.4);
              scene.add(pin);
            });
          })();
          var hit = new THREE.Mesh(
            keep(ctx.roundedBox(A.button.w * 1.3, A.button.h * 1.6, A.button.d * 2)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          hit.position.copy(b.position);
          hit.userData.rimTarget = b;         // the rocker cap, not the hit box
          scene.add(hit);
          ctx.pickables.push(hit);
          makeLabel(x, -3.55, 4.4,
            { top: title, accent: "#" + color.toString(16).padStart(6, "0"), box: true }, 2.4, 1.2);
          return { mesh: b, hit: hit, sign: sign };
        }
        var btnAdd = makeButton(2.4, 1, "ADD FIRM", 0x3fae6b);
        var btnRemove = makeButton(-2.4, -1, "REMOVE FIRM", 0xd4573f);

        var firmsLabel = makeLabel(-6.4, 1.9, 0,
          { top: "FIRMS IN THE MARKET", big: "1", sub: "a pure monopoly",
            accent: "#d9a441", box: true, bigSize: 84 }, 3.4, 1.7);
        var innovLabel = makeLabel(6.4, 1.9, 0,
          { top: "INNOVATION INTENSITY", big: "45%", sub: "Arrow's replacement effect",
            accent: "#4f86c6", box: true, bigSize: 78 }, 3.4, 1.7);

        // ---------- state ----------
        var firms = 1;
        var won = false;
        var flash = 0;

        function pushToPage() {
          var sl = document.getElementById("slider-hhi-firms");
          if (sl) { sl.value = firms; sl.dispatchEvent(new Event("input", { bubbles: true })); }
        }

        function refresh() {
          var hhi = hhiOf(firms);
          var innov = innovationOf(firms);
          var inZone = firms >= A.zone[0] && firms <= A.zone[1];

          for (var i2 = 0; i2 < firmMeshes.length; i2++) firmMeshes[i2].visible = i2 < firms;

          var sh = shares(firms);
          var cursor = -A.hhi.w / 2;
          for (var j = 0; j < hhiSegs.length; j++) {
            if (j < sh.length) {
              var wdt = (sh[j] / 100) * A.hhi.w;
              hhiSegs[j].visible = true;
              hhiSegs[j].scale.x = Math.max(0.02, wdt - 0.03);
              hhiSegs[j].position.set(cursor + wdt / 2, A.hhi.y, 0.08);
              cursor += wdt;
            } else hhiSegs[j].visible = false;
          }

          var band = hhi > 2500 ? "#d4573f" : hhi >= 1500 ? "#d9a441" : "#3fae6b";
          var bandTxt = hhi > 2500 ? "highly concentrated"
                      : hhi >= 1500 ? "moderately concentrated" : "unconcentrated";
          hhiLabel.material.map = labelTex(
            { top: "HERFINDAHL-HIRSCHMAN INDEX", big: hhi.toLocaleString("en-US"),
              sub: bandTxt, accent: band, box: true, bigSize: 70 });
          hhiLabel.material.needsUpdate = true;

          firmsLabel.material.map = labelTex(
            { top: "FIRMS IN THE MARKET", big: String(firms),
              sub: firms === 1 ? "a pure monopoly" : inZone ? "on the summit" : "off the summit",
              accent: "#d9a441", box: true, bigSize: 84 });
          firmsLabel.material.needsUpdate = true;

          innovLabel.material.map = labelTex(
            { top: "INNOVATION INTENSITY", big: Math.round(innov) + "%",
              sub: firms <= 2 ? "Arrow's replacement effect"
                 : inZone ? "Aghion's escape-competition effect"
                 : "Schumpeter: no margin left to fund R&D",
              accent: "#4f86c6", box: true, bigSize: 78 });
          innovLabel.material.needsUpdate = true;

          if (!won) {
            if (inZone) {
              won = true; flash = 1;
              ctx.setStatus("Parked on the summit at " + firms + " firms", true);
              ctx.setHint("Neither a monopoly nor a crowd invents most. The peak sits in between.");
              ctx.setAction("Leave the concentration room", null);
              ctx.complete();
            } else {
              ctx.setStatus(firms + (firms === 1 ? " firm" : " firms") + " — the summit is 3 to 8",
                            false);
            }
          }
        }

        ctx.setBrief(null);
        ctx.setHint("Add or remove firms. Park the ball on the summit.");
        pushToPage();
        refresh();

        function fitCamera() {
          var cam = ctx.camera;
          var el = A.camera.elevationDeg * Math.PI / 180;
          var dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).normalize();
          var look = new THREE.Vector3().fromArray(A.camera.lookAt);
          var box = new THREE.Box3();
          scene.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
          if (box.isEmpty()) return;
          var cs = [];
          for (var i3 = 0; i3 < 8; i3++) cs.push(new THREE.Vector3(
            (i3 & 1) ? box.max.x : box.min.x, (i3 & 2) ? box.max.y : box.min.y,
            (i3 & 4) ? box.max.z : box.min.z));
          var dist = box.getBoundingSphere(new THREE.Sphere()).radius * 2;
          for (var p = 0; p < 6; p++) {
            cam.position.copy(look).addScaledVector(dir, dist);
            cam.lookAt(look); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
            var worst = 0;
            for (var q = 0; q < cs.length; q++) {
              var v = cs[q].clone().project(cam);
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
            // the ball rolls to wherever the market now sits
            var want = new THREE.Vector3(curveX(firms), curveY(firms) + A.ball.r + 0.09, 0);
            ball.position.lerp(want, Math.min(1, dt * 6));
            ball.rotation.z -= (want.x - ball.position.x) * dt * 3;
            if (flash > 0) {
              flash = Math.max(0, flash - dt * 1.4);
              ball.scale.setScalar(1 + flash * 0.3);
            }
            for (var i4 = 0; i4 < firmMeshes.length; i4++) {
              var f = firmMeshes[i4];
              var w = f.visible ? 1 : 0.001;
              f.scale.setScalar(f.scale.x + (w - f.scale.x) * Math.min(1, dt * 8));
            }
            var beck = (!won && firms === 1) ? 1 + Math.sin(pulse * 3.6) * 0.07 : 1;
            btnAdd.mesh.scale.setScalar(
              btnAdd.mesh.scale.x + (beck - btnAdd.mesh.scale.x) * Math.min(1, dt * 8));
          },
          onPointerDown: function (h) {
            if (!h) return;
            var next = firms;
            if (h.object === btnAdd.hit) next = Math.min(A.maxFirms, firms + 1);
            else if (h.object === btnRemove.hit) next = Math.max(A.minFirms, firms - 1);
            else return;
            if (next !== firms) {
              firms = next; ctx.sfx("press"); pushToPage(); refresh();
            } else {
              ctx.sfx("denied");        // already at the end of the range
            }
          },
          onPointerMove: function (h) {
            ctx.renderer.domElement.style.cursor = h ? "pointer" : "default";
          },
          onResize: fitCamera,
          dispose: function () { junk.forEach(function (d) { try { d.dispose(); } catch (e) {} }); }
        };
      }
    });

    window.launchAntitrust = function () { window.Interludes.play("antitrust"); };
  });
})();
