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
        function mat(o) { return keep(new THREE.MeshStandardMaterial(o)); }

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
        var hillMat = keep(new THREE.MeshPhysicalMaterial({
          color: A.hill.color, roughness: 0.42, metalness: 0.05,
          normalMap: marbleN,
          normalScale: new THREE.Vector2(0.45, 0.45),
          roughnessMap: marbleR,
          clearcoat: 0.4, clearcoatRoughness: 0.22 }));
        var peakMat = mat({ color: A.hill.peak, roughness: 0.5,
                            emissive: A.hill.peak, emissiveIntensity: 0.3 });
        var segGeo = keep(new THREE.BoxGeometry(1, A.hill.thickness, 0.5));
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
          keep(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 8)),
          mat({ color: 0xe8ecf2, roughness: 0.5 }));
        flagPole.position.set(curveX(5), curveY(5) + 0.62, 0);
        scene.add(flagPole);
        makeLabel(curveX(5), curveY(5) + 1.75, 0,
          { top: "THE SUMMIT", sub: "3 to 8 firms", accent: "#3fae6b", box: true }, 2.5, 1.25);

        // ---------- the ball ----------
        var ball = new THREE.Mesh(
          keep(new THREE.SphereGeometry(A.ball.r, 22, 16)),
          keep(new THREE.MeshStandardMaterial({
            color: A.ball.color, roughness: 0.16, metalness: 0.85,
            // kept emissive so it still reads against the dark hall, but far
            // lower than before: the metal response now does most of the work
            emissive: A.ball.color, emissiveIntensity: 0.22 })));
        scene.add(ball);

        // ---------- firms on the floor ----------
        var firmMeshes = [];
        var fBody = keep(new THREE.BoxGeometry(A.firm.w, A.firm.h, A.firm.d));
        var fRoof = keep(new THREE.BoxGeometry(A.firm.w * 1.16, 0.1, A.firm.d * 1.16));
        var fMat = mat({ color: A.firm.color, roughness: 0.7 });
        var rMat = mat({ color: A.firm.roof, roughness: 0.5 });
        for (var i = 0; i < A.maxFirms; i++) {
          var grp = new THREE.Group();
          var bd = new THREE.Mesh(fBody, fMat);
          var rf = new THREE.Mesh(fRoof, rMat);
          rf.position.y = A.firm.h / 2 + 0.05;
          grp.add(bd); grp.add(rf);
          grp.position.set(-((A.maxFirms - 1) * 0.66) / 2 + i * 0.66, -2.55, 1.5);
          grp.scale.setScalar(0.001);
          grp.visible = false;
          scene.add(grp);
          firmMeshes.push(grp);
        }

        // ---------- HHI bar ----------
        var hhiSegs = [];
        var hhiBack = new THREE.Mesh(
          keep(new THREE.BoxGeometry(A.hhi.w, A.hhi.h, 0.1)),
          mat({ color: 0x232a36, roughness: 0.85 }));
        hhiBack.position.set(0, A.hhi.y, 0);
        scene.add(hhiBack);
        var segGeo2 = keep(new THREE.BoxGeometry(1, A.hhi.h * 0.82, 0.16));
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
          var b = new THREE.Mesh(
            keep(new THREE.BoxGeometry(A.button.w, A.button.h, A.button.d)),
            mat({ color: color, roughness: 0.4, metalness: 0.15,
                  emissive: color, emissiveIntensity: 0.32 }));
          b.position.set(x, -2.55, 3.4);
          scene.add(b);
          var hit = new THREE.Mesh(
            keep(new THREE.BoxGeometry(A.button.w * 1.3, A.button.h * 1.6, A.button.d * 2)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          hit.position.copy(b.position);
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
            if (next !== firms) { firms = next; pushToPage(); refresh(); }
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
