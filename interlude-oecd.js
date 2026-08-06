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
        function mat(o) { return keep(new THREE.MeshStandardMaterial(o)); }

        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // the answer is whichever system has the widest gap
        var answerIdx = 0, widest = -1;
        A.systems.forEach(function (s, i) {
          var gp = s.volume - s.value;
          if (gp > widest) { widest = gp; answerIdx = i; }
        });

        var floor = new THREE.Mesh(
          keep(new THREE.BoxGeometry(19, 0.3, 6)),
          mat({ color: 0x141821, roughness: 0.93 }));
        floor.position.set(0, -1.85, 0);
        scene.add(floor);

        // ---------- pedestals ----------
        var pods = [];
        var total = A.systems.length;
        A.systems.forEach(function (s, i) {
          var x = -((total - 1) * A.gap) / 2 + i * A.gap;
          var base = new THREE.Mesh(
            keep(new THREE.CylinderGeometry(0.95, 1.05, 0.34, 22)),
            mat({ color: 0x232a36, roughness: 0.8 }));
          base.position.set(x, -1.53, 0);
          scene.add(base);

          function tower(offset, pct, color) {
            var h = Math.max(0.1, (pct / 100) * A.tower.maxH);
            var m = new THREE.Mesh(
              keep(new THREE.BoxGeometry(A.tower.w, h, A.tower.d)),
              mat({ color: color, roughness: 0.45,
                    emissive: color, emissiveIntensity: 0.22 }));
            m.position.set(x + offset, -1.36 + h / 2, 0);
            scene.add(m);
            return m;
          }
          var tv = tower(-0.38, s.volume, A.tower.volume);
          var tm = tower(0.38, s.value, A.tower.value);

          var hit = new THREE.Mesh(
            keep(new THREE.BoxGeometry(2.1, 6.2, 2.0)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
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
            if (h.object === plaque) { lockIn(); return; }
            for (var i = 0; i < pods.length; i++) {
              if (h.object === pods[i].hit) { select(i); return; }
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
