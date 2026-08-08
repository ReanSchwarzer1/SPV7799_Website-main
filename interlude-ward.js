/* ============================================================
   interlude-ward.js — the value of a year (module 5)
   Condition B embodied layer.

   A fixed public budget of $10,000,000 sits in the room as a
   physical block. Facing it is a ward of empty beds. Between them
   is a price wheel: turn it, and the cost per patient per year
   falls from the patented $30,000 toward the generic $2,000.

   Nothing about the medicine changes as the wheel turns. Only the
   price does. The beds fill anyway, and the tower of life-years
   behind the ward climbs with them. That is the whole argument of
   this module, delivered by hand.

   Objective: treat at least 2,000 patients on the fixed budget.

   Model is the page's own (see updateQALYChart in script.js):
     patients = floor(budget / costPerPatient)
     life-years = patients x 5 QALYs
   The 5-QALY figure comes from the artifact's imatinib survival
   source. The scene drives the page's cost control, so the chart
   and the score stay on one model.
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

    window.Interludes.register("ward", {
      kicker: "The ward",
      title: "What a budget buys",
      step: "Cost-effectiveness and life-years",
      instructions: "Grab the gold wheel and turn it left. Watch the beds fill.",

      assets: {
        budget: 10000000,
        costMin: 2000, costMax: 30000, costStep: 1000,
        qalyPerPatient: 5,
        targetPatients: 2000,
        maxPatients: 5000,          // budget / costMin, the ceiling of the ward
        wheel:  { r: 1.55, tube: 0.3, color: 0xd9a441, x: 0, y: -0.4, z: 3.2 },
        vault:  { w: 2.6, h: 3.2, d: 1.6, color: 0x2b5c3a, x: -6.2 },
        bed:    { cols: 20, rows: 5, r: 0.13, len: 0.34,
                  on: 0xfffb00, off: 0x2f3743, gap: 0.42 },
        tower:  { w: 1.1, maxH: 6.0, color: 0x3fae6b, x: 6.2 },
        camera: { elevationDeg: 20, margin: 1.12, lookAt: [0, 0.3, 0.4] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        // ---------- shared label helper ----------
        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- floor ----------
        var floor = new THREE.Mesh(
          keep(ctx.roundedBox(17, 0.3, 9)),
          ctx.wood("walnut", { repeat: [4, 2] }));
        floor.position.set(0, -2.5, 0.6);
        scene.add(floor);

        /* Substructure. A base with a moulded lip and an apron under it reads
           as a built surface rather than a floating slab, and every one of
           those edges is chamfered so it carries its own highlight. */
        (function () {
          var subMat = ctx.wood("ebony", { repeat: [3, 1] }); keep(subMat);
          var W = 17, H = 0.3, DD = 9;
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

        // ---------- the budget, as a block that never changes ----------
        var vault = new THREE.Mesh(
          keep(ctx.roundedBox(A.vault.w, A.vault.h, A.vault.d)),
          mat({ color: A.vault.color, roughness: 0.6, metalness: 0.15 }));
        vault.position.set(A.vault.x, -0.75, 0);
        /* A strongbox, not a green slab: a base plinth, a lid with a raised
           rim, corner brackets and a dial on the face. */
        (function () {
          var steel = ctx.material("machinedSteel", { color: 0x7d8794 }); keep(steel);
          var brass = ctx.material("brass"); keep(brass);
          var W = A.vault.w, H = A.vault.h, DD = A.vault.d, X = A.vault.x, Y = -0.75;
          var plinth = new THREE.Mesh(keep(ctx.roundedBox(W * 1.12, 0.14, DD * 1.12, 0.03)), steel);
          plinth.position.set(X, Y - H / 2 - 0.07, 0); scene.add(plinth);
          var lid = new THREE.Mesh(keep(ctx.roundedBox(W * 1.06, 0.10, DD * 1.06, 0.025)), steel);
          lid.position.set(X, Y + H / 2 + 0.05, 0); scene.add(lid);
          var bracket = keep(ctx.roundedBox(0.10, H * 0.94, 0.10, 0.025));
          [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function (c) {
            var br = new THREE.Mesh(bracket, steel);
            br.position.set(X + c[0] * W / 2, Y, c[1] * DD / 2); scene.add(br);
          });
          var dial = new THREE.Mesh(keep(ctx.turnedCylinder(0.16, 0.18, 0.06)), brass);
          dial.rotation.x = Math.PI / 2;
          dial.position.set(X, Y, DD / 2 + 0.04); scene.add(dial);
          var spindle = new THREE.Mesh(keep(ctx.turnedCylinder(0.03, 0.03, 0.14)), brass);
          spindle.rotation.x = Math.PI / 2;
          spindle.position.set(X, Y, DD / 2 + 0.09); scene.add(spindle);
        })();
        scene.add(vault);
        for (var b = 0; b < 4; b++) {
          var band = new THREE.Mesh(
            keep(ctx.roundedBox(A.vault.w * 1.03, 0.1, A.vault.d * 1.03)),
            mat({ color: 0x9ad3ac, roughness: 0.5 }));
          band.position.set(A.vault.x, -2.05 + b * 0.82, 0);
          scene.add(band);
        }
        makeLabel(A.vault.x, 1.6, 0,
          { top: "PUBLIC BUDGET", big: "$10M", sub: "fixed for the year",
            accent: "#9ad3ac", box: true, bigSize: 78 }, 2.64, 1.32);

        // ---------- the price wheel ----------
        /* A cast handwheel, built the way one is made: a rim with a raised
           tyre band and an inner channel, tapered spokes swelling where they
           meet the hub, a turned hub with a bolt circle and a nut, and a
           handle on a proper stem rather than a ball stuck to the rim. */
        var wheel = new THREE.Group();
        var goldMat = mat({ color: A.wheel.color, roughness: 0.34, metalness: 0.45,
                            emissive: A.wheel.color, emissiveIntensity: 0.22 });
        var darkGold = mat({ color: 0xa87f2c, roughness: 0.5, metalness: 0.4 });
        var steelMat = ctx.material("machinedSteel", { color: 0x8f98a4 }); keep(steelMat);

        var rim = new THREE.Mesh(
          keep(new THREE.TorusGeometry(A.wheel.r, A.wheel.tube, 32, 128)), goldMat);
        wheel.add(rim);
        // a proud tyre band round the outside and a recessed channel inside it
        wheel.add(new THREE.Mesh(
          keep(new THREE.TorusGeometry(A.wheel.r + A.wheel.tube * 0.42,
                                       A.wheel.tube * 0.30, 24, 128)), darkGold));
        wheel.add(new THREE.Mesh(
          keep(new THREE.TorusGeometry(A.wheel.r - A.wheel.tube * 0.52,
                                       A.wheel.tube * 0.20, 20, 128)), darkGold));

        // ten tapered spokes, thicker at the hub than at the rim
        var SPOKES = 10;
        for (var s = 0; s < SPOKES; s++) {
          var spoke = new THREE.Mesh(
            keep(ctx.turnedCylinder(0.055, 0.115, A.wheel.r * 1.90, 0.02)), goldMat);
          spoke.rotation.z = Math.PI / 2;                 // lay along the radius
          var ang = (s / SPOKES) * Math.PI * 2;
          spoke.position.set(Math.cos(ang) * A.wheel.r * 0.47,
                             Math.sin(ang) * A.wheel.r * 0.47, 0);
          spoke.rotation.z = ang + Math.PI / 2;
          wheel.add(spoke);
        }

        // hub: a turned boss, a collar, a bolt circle and a centre nut
        var hub = new THREE.Mesh(keep(ctx.turnedCylinder(0.40, 0.46, 0.34, 0.05)), goldMat);
        hub.rotation.x = Math.PI / 2; wheel.add(hub);
        var collar = new THREE.Mesh(keep(ctx.turnedCylinder(0.52, 0.52, 0.12, 0.03)), darkGold);
        collar.rotation.x = Math.PI / 2; wheel.add(collar);
        var boltGeo = keep(ctx.turnedCylinder(0.048, 0.055, 0.10, 0.012));
        for (var q = 0; q < 6; q++) {
          var bolt = new THREE.Mesh(boltGeo, steelMat);
          var ba = (q / 6) * Math.PI * 2 + 0.3;
          bolt.rotation.x = Math.PI / 2;
          bolt.position.set(Math.cos(ba) * 0.30, Math.sin(ba) * 0.30, 0.20);
          wheel.add(bolt);
        }
        var nut = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 6)), steelMat);
        nut.rotation.x = Math.PI / 2; nut.position.z = 0.24; wheel.add(nut);

        // the grip: a turned handle on a stem, with a washer at its foot
        var gripStem = new THREE.Mesh(keep(ctx.turnedCylinder(0.075, 0.085, 0.30, 0.02)), steelMat);
        gripStem.rotation.x = Math.PI / 2;
        gripStem.position.set(A.wheel.r, 0, 0.20);
        wheel.add(gripStem);
        var washer = new THREE.Mesh(keep(ctx.turnedCylinder(0.15, 0.16, 0.05, 0.015)), darkGold);
        washer.rotation.x = Math.PI / 2;
        washer.position.set(A.wheel.r, 0, 0.07);
        wheel.add(washer);
        var pointerKnob = new THREE.Mesh(
          keep(ctx.turnedCylinder(0.13, 0.115, 0.42, 0.055)),
          mat({ color: 0xf4f6f8, roughness: 0.3, metalness: 0.05,
                emissive: 0xffffff, emissiveIntensity: 0.28 }));
        pointerKnob.rotation.x = Math.PI / 2;
        pointerKnob.position.set(A.wheel.r, 0, 0.53);
        wheel.add(pointerKnob);

        // The wheel starts at the highest price, so only one direction can do
        // anything. Say which, in the world, rather than letting the player
        // turn the dead way and think the thing is broken.
        var dirArrows = new THREE.Group();
        [0.55, 1.0, 1.45].forEach(function (a) {
          var cone = new THREE.Mesh(
            keep(new THREE.ConeGeometry(0.16, 0.42, 64)),
            mat({ color: 0xffffff, roughness: 0.4,
                  emissive: 0xffffff, emissiveIntensity: 0.55 }));
          var rr = A.wheel.r + 0.62;
          cone.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.1);
          cone.rotation.z = a;          // tangential, pointing counter-clockwise
          dirArrows.add(cone);
        });
        dirArrows.position.set(A.wheel.x, A.wheel.y, A.wheel.z);
        scene.add(dirArrows);
        wheel.position.set(A.wheel.x, A.wheel.y, A.wheel.z);
        scene.add(wheel);

        var wheelGrab = new THREE.Mesh(
          keep(ctx.turnedCylinder(A.wheel.r + 0.45, A.wheel.r + 0.45, 0.7)),
          keep(new THREE.MeshBasicMaterial({ visible: false })));
        wheelGrab.rotation.x = Math.PI / 2;
        wheelGrab.position.copy(wheel.position);
        scene.add(wheelGrab);
        ctx.pickables.push(wheelGrab);

        var priceLabel = makeLabel(A.wheel.x, A.wheel.y - 2.35, A.wheel.z + 1.1,
          { top: "COST PER PATIENT / YEAR", big: "$30,000", sub: "turn the wheel LEFT to lower it",
            accent: "#d9a441", box: true, bigSize: 72 }, 3.17, 1.58);

        // ---------- the ward ----------
        var beds = [];
        var bedGeo = keep(new THREE.CapsuleGeometry(A.bed.r, A.bed.len, 16, 48));
        var bedOn = mat({ color: A.bed.on, roughness: 0.4,
                          emissive: A.bed.on, emissiveIntensity: 0.5 });
        var bedOff = mat({ color: A.bed.off, roughness: 0.85 });
        var totalBeds = A.bed.cols * A.bed.rows;
        for (var r = 0; r < A.bed.rows; r++) {
          for (var c2 = 0; c2 < A.bed.cols; c2++) {
            var m2 = new THREE.Mesh(bedGeo, bedOff);
            m2.rotation.z = Math.PI / 2;
            m2.position.set(-((A.bed.cols - 1) * A.bed.gap) / 2 + c2 * A.bed.gap,
                            -2.15 + r * 0.5, -1.1 - r * 0.55);
            scene.add(m2);
            beds.push(m2);
          }
        }
        var wardLabel = makeLabel(0, 2.9, -2.4,
          { top: "PATIENTS TREATED", big: "333", sub: "each mark is 50 patients",
            accent: "#fffb00", box: true, bigSize: 80 }, 3.17, 1.58);

        // ---------- the life-years tower ----------
        /* the life-years column gets a machined foot and a capping plate */
        var towerTrim = ctx.material("machinedSteel", { color: 0x828c99 }); keep(towerTrim);
        var towerShell = new THREE.Mesh(
          keep(ctx.roundedBox(A.tower.w, A.tower.maxH, A.tower.w)),
          mat({ color: 0x1d2a22, roughness: 0.9, transparent: true, opacity: 0.3 }));
        towerShell.position.set(A.tower.x, -2.35 + A.tower.maxH / 2, 0);
        scene.add(towerShell);
        /* The life-years column is a gauge, so it is fitted like one: a base
           flange it stands on, a rim at the mouth, and graduation bands up the
           face that give the reading a sense of scale. */
        (function () {
          var W = A.tower.w, BX = A.tower.x, BY = -2.35;
          var flange = new THREE.Mesh(
            keep(ctx.roundedBox(W * 1.30, 0.13, W * 1.30, 0.035)), towerTrim);
          flange.position.set(BX, BY + 0.065, 0); scene.add(flange);
          var fb = ctx.boltRing(W * 0.52, 6, 0.032, towerTrim);
          fb.position.set(BX, BY + 0.13, 0); scene.add(fb);
          var rim = new THREE.Mesh(
            keep(ctx.roundedBox(W * 1.16, 0.09, W * 1.16, 0.025)), towerTrim);
          rim.position.set(BX, BY + A.tower.maxH, 0); scene.add(rim);
          var bandGeo = keep(ctx.roundedBox(W * 1.08, 0.045, W * 1.08, 0.015));
          [0.25, 0.5, 0.75].forEach(function (f) {
            var band = new THREE.Mesh(bandGeo, towerTrim);
            band.position.set(BX, BY + A.tower.maxH * f, 0); scene.add(band);
          });
        })();
        var tower = new THREE.Mesh(
          keep(ctx.roundedBox(A.tower.w * 0.8, 1, A.tower.w * 0.8)),
          mat({ color: A.tower.color, roughness: 0.4,
                emissive: A.tower.color, emissiveIntensity: 0.3 }));
        scene.add(tower);
        var towerLabel = makeLabel(A.tower.x, 4.15, 0,
          { top: "LIFE-YEARS GAINED", big: "1,665", sub: "5 QALYs per patient treated",
            accent: "#3fae6b", box: true, bigSize: 70 }, 2.99, 1.50);

        // ---------- state ----------
        // The price the market settled at in the clearing house is the price
        // this budget has to pay, so the wheel starts where the player left it.
        var cost = A.costMax;
        if (typeof window.GameInherit === "function") {
          try {
            var h = window.GameInherit();
            if (h.clearingPrice != null) {
              var t = Math.max(0, Math.min(1, (h.clearingPrice - 65) / 55));
              cost = Math.round((12000 + t * 18000) / A.costStep) * A.costStep;
            }
          } catch (e) {}
        }
        var angle = 0;              // accumulated wheel rotation
        var dragging = false;
        var lastAngle = 0;
        var won = false;
        var plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -A.wheel.z);
        var hitPt = new THREE.Vector3();

        function model() {
          var patients = Math.floor(A.budget / cost);
          return { patients: patients, qalys: patients * A.qalyPerPatient };
        }

        function pushToPage() {
          var sl = document.getElementById("slider-qaly-cost");
          if (sl) { sl.value = cost; sl.dispatchEvent(new Event("input", { bubbles: true })); }
        }

        function fmt(n) { return n.toLocaleString("en-US"); }

        function refresh() {
          var m = model();
          priceLabel.material.map = labelTex(
            { top: "COST PER PATIENT / YEAR", big: "$" + fmt(cost),
              sub: cost <= 5000 ? "generic pricing" : "turn the wheel LEFT to lower it",
              accent: "#d9a441", box: true, bigSize: 72 });
          priceLabel.material.needsUpdate = true;

          var lit = Math.round((Math.min(m.patients, A.maxPatients) / A.maxPatients) * totalBeds);
          for (var i = 0; i < beds.length; i++) beds[i].material = i < lit ? bedOn : bedOff;
          wardLabel.material.map = labelTex(
            { top: "PATIENTS TREATED", big: fmt(m.patients),
              sub: "each mark is 50 patients", accent: "#fffb00", box: true, bigSize: 80 });
          wardLabel.material.needsUpdate = true;

          var maxQ = A.maxPatients * A.qalyPerPatient;
          var h = Math.max(0.08, (m.qalys / maxQ) * A.tower.maxH);
          tower.scale.y = h;
          tower.position.set(A.tower.x, -2.35 + h / 2, 0);
          towerLabel.material.map = labelTex(
            { top: "LIFE-YEARS GAINED", big: fmt(m.qalys),
              sub: "5 QALYs per patient treated", accent: "#3fae6b", box: true, bigSize: 70 });
          towerLabel.material.needsUpdate = true;

          if (!won) {
            if (m.patients >= A.targetPatients) {
              won = true;
              ctx.setStatus("Treating " + fmt(m.patients) + " patients on the same budget", true);
              ctx.setHint("Identical medicine. The budget did not grow: the price fell.");
              ctx.setAction("Leave the ward", null);
              ctx.complete();
            } else {
              ctx.setStatus(fmt(m.patients) + " treated — target is " + fmt(A.targetPatients), false);
            }
          }
        }

        ctx.setBrief(null);
        ctx.setHint(cost < A.costMax
          ? "The market you left already brought this price down. Turn the wheel LEFT to go further."
          : "Grab the gold wheel and turn it LEFT. Watch the beds fill.");
        pushToPage();
        refresh();

        function pointerAngle() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera);
          if (!ctx.raycaster.ray.intersectPlane(plane, hitPt)) return null;
          return Math.atan2(hitPt.y - wheel.position.y, hitPt.x - wheel.position.x);
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

        var pulse = 0;
        return {
          update: function (dt) {
            pulse += dt;
            wheel.rotation.z = angle;
            // the wheel beckons until it has been used
            var want = (!won && cost === A.costMax) ? 1 + Math.sin(pulse * 3.4) * 0.045 : 1;
            wheel.scale.setScalar(wheel.scale.x + (want - wheel.scale.x) * Math.min(1, dt * 8));
          },

          onPointerDown: function (h) {
            if (!h || h.object !== wheelGrab) return;
            var a = pointerAngle();
            if (a === null) return;
            dragging = true;
            lastAngle = a;
          },

          onPointerMove: function (h) {
            if (!dragging) {
              ctx.renderer.domElement.style.cursor = h ? "grab" : "default";
              return;
            }
            ctx.renderer.domElement.style.cursor = "grabbing";
            var a = pointerAngle();
            if (a === null) return;
            var d = a - lastAngle;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            lastAngle = a;
            angle += d;
            // a full turn sweeps roughly the whole price range
            var span = A.costMax - A.costMin;
            var next = cost - (d / (Math.PI * 2)) * span * 1.15;
            next = Math.max(A.costMin, Math.min(A.costMax, next));
            next = Math.round(next / A.costStep) * A.costStep;
            if (next !== cost) { cost = next; pushToPage(); refresh(); }
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

    window.launchWard = function () { window.Interludes.play("ward"); };
  });
})();
