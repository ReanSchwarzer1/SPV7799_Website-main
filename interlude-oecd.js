/* ============================================================
   interlude-oecd.js — the generic paradox (module 10)
   Condition B embodied layer.

   Seven pedestals, one per health system. On each stand two
   towers: how much of the prescribing is generic, and how much of
   the money generics actually take. In most systems the first
   tower dwarfs the second, which is the paradox: generics are
   most of the medicine and a small slice of the bill.

   Objective: find the system where that gap is widest, and lock
   it in. Getting it wrong costs nothing but a second look, which
   is the point: the player has to read the towers rather than
   guess.

   Figures are the artifact's own OECD Health at a Glance 2023
   series, the same numbers the page charts.
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

    window.Interludes.register("oecd", {
      kicker: "The hall of systems",
      title: "The generic paradox",
      step: "OECD Health at a Glance 2023",
      instructions: "Click a system to inspect it. Find the widest gap, then lock it in.",

      assets: {
        // volume = share of prescriptions, value = share of spending
        systems: [
          { name: "CHILE",       volume: 82.3, value: 67.2 },
          { name: "GERMANY",     volume: 80.3, value: 15.5 },
          { name: "UNITED KINGDOM", volume: 78.4, value: 34.3 },
          { name: "UNITED STATES",  volume: 91.0, value: 18.0 },
          { name: "JAPAN",       volume: 47.7, value: 15.4 },
          { name: "OECD AVERAGE", volume: 52.3, value: 24.5 },
          { name: "SWITZERLAND", volume: 22.1, value: 14.1 }
        ],
        tower: { w: 0.62, maxH: 5.0, d: 0.62, volume: 0xfffb00, value: 0x8892a4 },
        gap: 2.35,
        camera: { elevationDeg: 9, margin: 1.13, lookAt: [0, 0.6, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // the answer is whichever system has the widest gap
        var answerIdx = 0, widest = -1;
        A.systems.forEach(function (s, i) {
          var gp = s.volume - s.value;
          if (gp > widest) { widest = gp; answerIdx = i; }
        });

        var floor = new THREE.Mesh(
          keep(ctx.roundedBox(19, 0.3, 6)),
          ctx.wood("ebony", { repeat: [6, 2] }));
        floor.position.set(0, -1.85, 0);
        scene.add(floor);

        /* Substructure. A base with a moulded lip and an apron under it reads
           as a built surface rather than a floating slab, and every one of
           those edges is chamfered so it carries its own highlight. */
        (function () {
          var subMat = ctx.wood("walnut", { repeat: [3, 1] }); keep(subMat);
          var W = 19, H = 0.3, DD = 6;
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

        /* A balustrade along the back edge of the floor: turned posts, a top
           rail and a lower rail, so the hall has a limit rather than fading out. */
        (function () {
          var railWood = keep(ctx.wood("teak", { repeat: [8, 1] }));
          var railBrass = keep(ctx.material("brass"));
          var RZ = -2.62, RY = -1.70;
          for (var rp = -8; rp <= 8; rp++) {
            var post = new THREE.Mesh(
              keep(ctx.turnedCylinder(0.055, 0.085, 0.86, 0.025)), railBrass);
            post.position.set(rp * 1.1, RY + 0.43, RZ);
            scene.add(post);
            var knop = new THREE.Mesh(
              keep(new THREE.SphereGeometry(0.075, 24, 16)), railBrass);
            knop.position.set(rp * 1.1, RY + 0.90, RZ);
            scene.add(knop);
          }
          [0.86, 0.34].forEach(function (ry, ri) {
            var bar = new THREE.Mesh(
              keep(ctx.turnedCylinder(ri ? 0.045 : 0.065, ri ? 0.045 : 0.065, 18.4, 0.02)),
              ri ? railBrass : railWood);
            bar.rotation.z = Math.PI / 2;
            bar.position.set(0, RY + ry, RZ);
            scene.add(bar);
          });
        })();

        // ---------- pedestals ----------
        var pods = [];
        var total = A.systems.length;
        A.systems.forEach(function (s, i) {
          var x = -((total - 1) * A.gap) / 2 + i * A.gap;
          var base = new THREE.Mesh(
            keep(ctx.turnedCylinder(0.95, 1.05, 0.34)),
            mat({ color: 0x232a36, roughness: 0.8 }));
          base.position.set(x, -1.53, 0);
          scene.add(base);

          /* The pedestal was a single cylinder. It gets a stepped plinth, a
             bead, a ring of bolts and a nameplate, and the pair of towers now
             stands inside a measuring gantry with a graduated upright, which is
             what the towers are actually being read against. */
          (function () {
            var steel = keep(ctx.material("machinedSteel", { color: 0x8d97a6 }));
            var dark = keep(ctx.material("paintedMetal", { color: 0x232a36 }));

            var plinth = new THREE.Mesh(
              keep(ctx.turnedCylinder(1.18, 1.30, 0.14, 0.035)), dark);
            plinth.position.set(x, -1.63, 0);
            scene.add(plinth);
            var bead = new THREE.Mesh(
              keep(new THREE.TorusGeometry(1.08, 0.045, 16, 96)), steel);
            bead.rotation.x = Math.PI / 2;
            bead.position.set(x, -1.54, 0);
            scene.add(bead);
            var pbolts = ctx.boltRing(0.86, 8, 0.032, steel);
            pbolts.position.set(x, -1.37, 0);
            scene.add(pbolts);
            var plate = ctx.nameplate(0.86, 0.24, steel, dark);
            plate.rotation.x = Math.PI / 2;
            plate.position.set(x, -1.48, 1.02);
            scene.add(plate);

            var GT = 3.86, GB = -1.70, GH = GT - GB, GZ = -1.62;
            [-1.02, 1.02].forEach(function (ux) {
              var post = new THREE.Mesh(
                keep(ctx.turnedCylinder(0.042, 0.068, GH, 0.02)), dark);
              post.position.set(x + ux, (GT + GB) / 2, GZ);
              scene.add(post);
              var shoe = new THREE.Mesh(
                keep(ctx.roundedBox(0.30, 0.09, 0.30, 0.025)), steel);
              shoe.position.set(x + ux, GB + 0.045, GZ);
              scene.add(shoe);
            });
            var beam = new THREE.Mesh(
              keep(ctx.roundedBox(2.34, 0.11, 0.13, 0.035)), dark);
            beam.position.set(x, GT, GZ);
            scene.add(beam);
            [-1, 1].forEach(function (g) {
              var gus = new THREE.Mesh(
                keep(ctx.roundedBox(0.26, 0.26, 0.09, 0.03)), dark);
              gus.position.set(x + g * 0.86, GT - 0.16, GZ);
              gus.rotation.z = g * Math.PI / 4;
              scene.add(gus);
            });
            /* graduations up the left upright, one per 10 per cent */
            var tickGeo = keep(ctx.roundedBox(0.20, 0.024, 0.05, 0.008));
            var longGeo = keep(ctx.roundedBox(0.34, 0.030, 0.05, 0.008));
            for (var g2 = 0; g2 <= 10; g2++) {
              var tick = new THREE.Mesh(g2 % 5 === 0 ? longGeo : tickGeo, steel);
              tick.position.set(x - 1.02 - 0.14, -1.36 + (g2 / 10) * A.tower.maxH, GZ);
              scene.add(tick);
            }
          })();

          function tower(offset, pct, color) {
            var h = Math.max(0.1, (pct / 100) * A.tower.maxH);
            var m = new THREE.Mesh(
              keep(ctx.roundedBox(A.tower.w, h, A.tower.d)),
              mat({ color: color, roughness: 0.45,
                    emissive: color, emissiveIntensity: 0.22 }));
            m.position.set(x + offset, -1.36 + h / 2, 0);
            scene.add(m);
            /* A bare extruded bar reads as a chart. A machined foot at the base
               and a capping plate at the top give it two more chamfered edges
               and make it a manufactured column standing on the pedestal. */
            var trim = ctx.material("machinedSteel", { color: 0x8d97a6 });
            keep(trim);
            var foot = new THREE.Mesh(
              keep(ctx.roundedBox(A.tower.w * 1.30, 0.09, A.tower.d * 1.30, 0.02)), trim);
            foot.position.set(x + offset, -1.36 + 0.045, 0);
            scene.add(foot);
            // four bolts holding the foot plate to the pedestal
            var fb = ctx.boltRing(A.tower.w * 0.55, 4, 0.028, trim);
            fb.position.set(x + offset, -1.36 + 0.09, 0);
            scene.add(fb);
            var cap = new THREE.Mesh(
              keep(ctx.roundedBox(A.tower.w * 1.16, 0.06, A.tower.d * 1.16, 0.018)), trim);
            cap.position.set(x + offset, -1.36 + h + 0.03, 0);
            scene.add(cap);
            m.userData.cap = cap;
            return m;
          }
          var tv = tower(-0.38, s.volume, A.tower.volume);
          var tm = tower(0.38, s.value, A.tower.value);

          var hit = new THREE.Mesh(
            keep(ctx.roundedBox(2.1, 6.2, 2.0)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          // a pair of towers is a Group's worth of meshes, so this one takes
          // the emissive lift rather than a rim
          hit.userData.rimTarget = tv;
          hit.position.set(x, 1.2, 0);
          scene.add(hit);
          ctx.pickables.push(hit);

          var nameLab = makeLabel(x, -2.75, 2.2,
            { top: s.name, accent: "#9aa6b4", box: true, topSize: 26 }, 2.15, 1.05);

          pods.push({ sys: s, x: x, volume: tv, value: tm, hit: hit,
                      name: nameLab, base: base, idx: i });
        });

        makeLabel(-6.4, 5.3, 0,
          { top: "SHARE OF PRESCRIPTIONS", accent: "#fffb00", box: true, topSize: 27 }, 3.5, 1.1);
        makeLabel(-2.6, 5.3, 0,
          { top: "SHARE OF SPENDING", accent: "#8892a4", box: true, topSize: 27 }, 3.2, 1.1);

        var readout = makeLabel(6.2, 5.0, 0,
          { top: "SELECT A SYSTEM", sub: "click a pedestal to inspect it",
            accent: "#9aa6b4", box: true }, 4.4, 2.0);

        // ---------- lock-in plaque ----------
        function plaqueTex(text, sub, accent) {
          var c = document.createElement("canvas");
          var _S = ctx.texScale, _W = 900, _H = 180;
          c.width = _W * _S; c.height = _H * _S;
          var g = c.getContext("2d"); g.scale(_S, _S);
          g.fillStyle = "#1d2431"; g.fillRect(0, 0, _W, _H);
          g.strokeStyle = accent; g.lineWidth = 7; g.strokeRect(5, 5, _W - 10, _H - 10);
          g.textAlign = "center"; g.fillStyle = accent;
          g.font = "bold 42px system-ui, sans-serif";
          g.fillText(text, _W / 2, 78);
          g.fillStyle = "#9aa6b4"; g.font = "24px system-ui, sans-serif";
          g.fillText(sub, _W / 2, 128);
          return keep(ctx.tune(new THREE.CanvasTexture(c)));
        }
        var plaque = new THREE.Mesh(
          keep(new THREE.PlaneGeometry(4.6, 0.92)),
          keep(new THREE.MeshBasicMaterial(
            { map: plaqueTex("LOCK IN", "select a system first", "#5b6270"), transparent: true })));
        plaque.position.set(0, -3.35, 1.2);
        scene.add(plaque);
        ctx.pickables.push(plaque);

        // ---------- state ----------
        var selected = -1;
        var solved = false;
        var attempts = 0;
        var pulse = 0;

        function select(i) {
          selected = i;
          var s = pods[i].sys;
          var gp = s.volume - s.value;
          readout.material.map = labelTex(
            { top: s.name, big: gp.toFixed(1) + " pts",
              sub: s.volume.toFixed(1) + "% of scripts, " + s.value.toFixed(1) + "% of spend",
              accent: "#fffb00", box: true, bigSize: 72 });
          readout.material.needsUpdate = true;
          if (solved) {
            // The answer is already on the record. Inspecting another system is
            // still useful for comparison, but the plaque must not offer a fresh
            // "lock in" it will refuse, and it must keep naming the real answer
            // rather than the pedestal the player happens to be standing at.
            plaque.material.map = plaqueTex("CORRECT: " + pods[answerIdx].sys.name,
                                            "the widest gap in the hall", "#3fae6b");
            plaque.material.needsUpdate = true;
            ctx.setHint("Comparing " + s.name + ". " + pods[answerIdx].sys.name +
                        " still holds the widest gap. Close your term when you are ready.");
            return;
          }
          plaque.material.map = plaqueTex("LOCK IN " + s.name, "is this the widest gap?", "#fffb00");
          plaque.material.needsUpdate = true;
          ctx.setHint("Compare the towers. Lock in when you think you have the widest gap.");
        }

        function lockIn() {
          if (solved || selected < 0) return;
          attempts++;
          var s = pods[selected].sys;
          if (selected === answerIdx) {
            solved = true;
            pods[selected].volume.material.emissiveIntensity = 0.8;
            plaque.material.map = plaqueTex("CORRECT: " + s.name, "the widest gap in the hall", "#3fae6b");
            plaque.material.needsUpdate = true;
            ctx.setStatus("Widest gap identified: " + s.name, true);
            ctx.setHint("Generics are most of the prescribing and a fraction of the bill. That is the paradox.");
            if (typeof window.GameNote === "function") {
              window.GameNote("oecdChoice", "Named " + s.name + " as the widest gap" +
                              (attempts > 1 ? " after " + attempts + " tries" : " first time"));
              window.GameNote("oecdOutcome", s.volume.toFixed(1) + "% of prescriptions but only " +
                              s.value.toFixed(1) + "% of spending, a gap of " +
                              (s.volume - s.value).toFixed(1) + " points");
            }
            if (typeof window.GameComplete === "function") {
              window.GameComplete(9, 2, 0,
                "The generic paradox: most of the medicine, a fraction of the money.");
            }
            ctx.setAction("Close your term", null);
            ctx.complete();
          } else {
            plaque.material.map = plaqueTex("NOT " + s.name, "a wider gap stands elsewhere", "#d4573f");
            plaque.material.needsUpdate = true;
            ctx.setStatus("Not the widest — look again", false);
            ctx.setHint("Look for the tallest yellow tower sitting over the shortest grey one.");
          }
        }

        ctx.setBrief(null);
        ctx.setStatus("No system selected", false);
        ctx.setHint("Click a system to inspect it. Find the widest gap, then lock it in.");

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
            for (var k = 0; k < cs.length; k++) {
              var v = cs[k].clone().project(cam);
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
            pulse += dt;
            for (var i = 0; i < pods.length; i++) {
              var lift = (i === selected) ? 0.28 : 0;
              var p = pods[i];
              var y = -1.53 + lift;
              p.base.position.y += (y - p.base.position.y) * Math.min(1, dt * 8);
              var s = (i === selected) ? 1.06 : 1;
              p.volume.scale.x += (s - p.volume.scale.x) * Math.min(1, dt * 8);
              p.value.scale.x += (s - p.value.scale.x) * Math.min(1, dt * 8);
            }
            if (solved) plaque.scale.setScalar(1 + Math.sin(pulse * 2.4) * 0.02);
          },
          onPointerDown: function (h) {
            if (!h) return;
            if (h.object === plaque) { ctx.sfx("press"); lockIn(); return; }
            for (var i = 0; i < pods.length; i++) {
              if (h.object === pods[i].hit) { ctx.sfx("card"); select(i); return; }
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

    window.launchOecd = function () { window.Interludes.play("oecd"); };
  });
})();
