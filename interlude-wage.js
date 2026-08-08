/* ============================================================
   interlude-wage.js — the human metric (module 7)
   Condition B embodied layer.

   A worker stands on one side of the room. On the other side sits
   one month of medicine. Between them the game stacks the days of
   labour that month actually costs, one block for every ten days,
   against a line drawn where the WHO says a medicine stops being
   affordable: one day's wage.

   Two heavy switches on the bench change who is buying and which
   market they are buying in. Nothing else moves. The tower does.

   Objective: bring the cost down to 90 days of labour or fewer.

   Figures are the artifact's own: Bayer's Nexavar at $5,000 a
   month against Natco's post-compulsory-licence sorafenib at $105,
   and a day's wage of $3.20 under MGNREGA against $15 for an urban
   salaried worker. The Lerner index, L = (P - MC) / P, uses the
   artifact's $20 marginal cost.
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

    window.Interludes.register("wage", {
      kicker: "The wage floor",
      title: "What a month costs in days",
      step: "Affordability and monopoly power",
      instructions: "Flip the two switches. Watch the tower of working days.",

      assets: {
        drugs: {
          patented: { price: 5000, name: "PATENTED", sub: "Bayer's Nexavar", color: 0xd4573f },
          generic:  { price: 105,  name: "POST-LICENCE", sub: "Natco's sorafenib", color: 0x3fae6b }
        },
        wages: {
          unskilled: { daily: 3.20, name: "RURAL LABOURER", sub: "MGNREGA day wage" },
          salaried:  { daily: 15.00, name: "URBAN SALARIED", sub: "average day wage" }
        },
        marginalCost: 20,
        target: 90,                       // days of labour to clear the module
        block: { w: 0.34, h: 0.16, d: 0.34, perBlock: 10, cap: 170,
                 color: 0xd4573f, ok: 0x3fae6b },
        col: 10,                          // blocks per column
        switchGeom: { w: 0.55, h: 1.0, d: 0.34 },
        camera: { elevationDeg: 12, margin: 1.14, lookAt: [0, 1.0, 0] }
      },

      build: function (ctx) {
        var THREE = ctx.THREE, scene = ctx.scene, A = ctx.assets;
        var junk = [];
        function keep(o) { junk.push(o); return o; }
        function mat(o) { return keep(ctx.tunedStandard(o)); }

        var labelTex = ctx.labelTexture;
        var makeLabel = ctx.makeLabel;

        // ---------- floor ----------
        var floor = new THREE.Mesh(
          keep(ctx.roundedBox(18, 0.3, 8)),
          ctx.wood("teak", { repeat: [5, 2] }));
        floor.position.set(0, -0.15, 0);
        scene.add(floor);

        /* Substructure. A base with a moulded lip and an apron under it reads
           as a built surface rather than a floating slab, and every one of
           those edges is chamfered so it carries its own highlight. */
        (function () {
          var subMat = ctx.wood("walnut", { repeat: [3, 1] }); keep(subMat);
          var W = 18, H = 0.3, DD = 8;
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

        // ---------- the worker ----------
        var worker = new THREE.Group();
        var body = new THREE.Mesh(
          // torso: tapered, not a plain capsule
          keep(ctx.turnedCylinder(0.20, 0.30, 0.86, 0.05)),
          mat({ color: 0x9aa6b4, roughness: 0.7 }));
        body.position.y = 0.72;
        var head = new THREE.Mesh(
          keep(new THREE.SphereGeometry(0.24, 64, 40)),
          mat({ color: 0xb8c2cf, roughness: 0.6 }));
        head.position.y = 1.42;
        /* Shoulders, arms, hips and legs, so the scene has a person standing in
           it rather than a pill-shaped marker. All turned stock, so every limb
           carries a chamfer at its ends. */
        var skinMat = mat({ color: 0xb8c2cf, roughness: 0.62 });
        var clothMat = mat({ color: 0x8b96a5, roughness: 0.78 });

        var shoulders = new THREE.Mesh(keep(ctx.turnedCylinder(0.15, 0.15, 0.62, 0.04)), clothMat);
        shoulders.rotation.z = Math.PI / 2;
        shoulders.position.y = 1.10;

        var neck = new THREE.Mesh(keep(ctx.turnedCylinder(0.075, 0.09, 0.14, 0.02)), skinMat);
        neck.position.y = 1.22;

        var armGeo = keep(ctx.turnedCylinder(0.068, 0.082, 0.66, 0.025));
        var handGeo = keep(new THREE.SphereGeometry(0.075, 48, 32));
        [-1, 1].forEach(function (sgn) {
          var arm = new THREE.Mesh(armGeo, clothMat);
          arm.position.set(sgn * 0.34, 0.80, 0);
          arm.rotation.z = sgn * 0.13;
          worker.add(arm);
          var hand = new THREE.Mesh(handGeo, skinMat);
          hand.position.set(sgn * 0.40, 0.46, 0);
          worker.add(hand);
        });

        var hips = new THREE.Mesh(keep(ctx.turnedCylinder(0.28, 0.24, 0.20, 0.05)), clothMat);
        hips.position.y = 0.31;

        var legGeo = keep(ctx.turnedCylinder(0.095, 0.115, 0.62, 0.03));
        var bootGeo = keep(ctx.roundedBox(0.20, 0.10, 0.30, 0.035));
        [-1, 1].forEach(function (sgn) {
          var leg = new THREE.Mesh(legGeo, clothMat);
          leg.position.set(sgn * 0.13, 0.0, 0);
          worker.add(leg);
          var boot = new THREE.Mesh(bootGeo, mat({ color: 0x4a4f58, roughness: 0.85 }));
          boot.position.set(sgn * 0.13, -0.34, 0.04);
          worker.add(boot);
        });

        worker.add(body); worker.add(head);
        worker.add(shoulders); worker.add(neck); worker.add(hips);
        worker.position.set(-6.4, 0, 0);
        scene.add(worker);
        var wageLabel = makeLabel(-6.9, 3.3, 0,
          { top: "RURAL LABOURER", big: "$3.20", sub: "MGNREGA day wage",
            accent: "#9aa6b4", box: true, bigSize: 74 }, 2.50, 1.25);

        // ---------- one month of medicine ----------
        var bottle = new THREE.Mesh(
          keep(ctx.turnedCylinder(0.42, 0.42, 1.0)),
          mat({ color: 0xd4573f, roughness: 0.35,
                emissive: 0xd4573f, emissiveIntensity: 0.25 }));
        bottle.position.set(6.4, 0.5, 0);
        scene.add(bottle);
        (function () {
          var capMat = mat({ color: 0xe8e8ea, roughness: 0.42 });
          var cap = new THREE.Mesh(keep(ctx.turnedCylinder(0.44, 0.46, 0.22, 0.03)), capMat);
          cap.position.set(6.4, 1.11, 0); scene.add(cap);
          var neck = new THREE.Mesh(keep(ctx.turnedCylinder(0.36, 0.36, 0.10, 0.02)), capMat);
          neck.position.set(6.4, 0.98, 0); scene.add(neck);
          var band = new THREE.Mesh(keep(ctx.turnedCylinder(0.435, 0.435, 0.34, 0.02)),
                                    mat({ color: 0xf2efe6, roughness: 0.9 }));
          band.position.set(6.4, 0.42, 0); scene.add(band);
        })();
        var cap = new THREE.Mesh(
          keep(ctx.turnedCylinder(0.46, 0.46, 0.2)),
          mat({ color: 0xe8ecf2, roughness: 0.4 }));
        cap.position.set(6.4, 1.08, 0);
        scene.add(cap);
        var drugLabel = makeLabel(6.9, 3.3, 0,
          { top: "PATENTED", big: "$5,000", sub: "Bayer's Nexavar, one month",
            accent: "#d4573f", box: true, bigSize: 70 }, 2.65, 1.33);

        // ---------- the tower of working days ----------
        var blocks = [];
        var blockGeo = keep(ctx.roundedBox(A.block.w, A.block.h, A.block.d));
        var blockHot = mat({ color: A.block.color, roughness: 0.55,
                             emissive: A.block.color, emissiveIntensity: 0.18 });
        var blockOk = mat({ color: A.block.ok, roughness: 0.55,
                            emissive: A.block.ok, emissiveIntensity: 0.22 });
        for (var i = 0; i < A.block.cap; i++) {
          var b = new THREE.Mesh(blockGeo, blockHot);
          var colIdx = Math.floor(i / A.col), rowIdx = i % A.col;
          b.position.set(-2.6 + colIdx * (A.block.w + 0.07),
                         0.12 + rowIdx * (A.block.h + 0.035), 0);
          b.visible = false;
          scene.add(b);
          blocks.push(b);
        }
        var daysLabel = makeLabel(0, 4.35, 0,
          { top: "DAYS OF LABOUR FOR ONE MONTH", big: "1,562",
            sub: "each block is 10 days", accent: "#d4573f", box: true, bigSize: 78 }, 3.28, 1.64);

        // WHO affordability line: one day's wage
        var whoLine = new THREE.Mesh(
          keep(ctx.roundedBox(7.4, 0.045, 0.05)),
          mat({ color: 0xfffb00, roughness: 0.5,
                emissive: 0xfffb00, emissiveIntensity: 0.6 }));
        whoLine.position.set(0, 0.12 + (A.block.h + 0.035), 0.32);
        scene.add(whoLine);
        makeLabel(-5.6, -1.15, 2.6,
          { top: "WHO AFFORDABLE", sub: "one day's wage", accent: "#fffb00", box: true }, 2.03, 1.01);

        // ---------- the two switches ----------
        function makeSwitch(x, title) {
          var base = new THREE.Mesh(
            keep(ctx.roundedBox(1.5, 0.28, 0.8)),
            mat({ color: 0x2a3140, roughness: 0.75 }));
          base.position.set(x, 0.14, 2.9);
          scene.add(base);
          (function () {
            var steel = ctx.material("machinedSteel", { color: 0x8a939f }); keep(steel);
            var boss = new THREE.Mesh(keep(ctx.turnedCylinder(0.10, 0.10, 0.62, 0.02)), steel);
            boss.rotation.z = Math.PI / 2;
            boss.position.copy(base.position); boss.position.y += 0.10;
            scene.add(boss);
            var plate = new THREE.Mesh(keep(ctx.roundedBox(1.72, 0.06, 0.98, 0.02)), steel);
            plate.position.copy(base.position); plate.position.y -= 0.16;
            scene.add(plate);
          })();
          var lever = new THREE.Mesh(
            keep(ctx.roundedBox(A.switchGeom.w, A.switchGeom.h, A.switchGeom.d)),
            mat({ color: 0xd9a441, roughness: 0.35, metalness: 0.2,
                  emissive: 0xd9a441, emissiveIntensity: 0.3 }));
          lever.position.set(x, 0.62, 2.9);
          scene.add(lever);
          var hit = new THREE.Mesh(
            keep(ctx.roundedBox(1.7, 1.6, 1.2)),
            keep(new THREE.MeshBasicMaterial({ visible: false })));
          hit.position.set(x, 0.6, 2.9);
          scene.add(hit);
          ctx.pickables.push(hit);
          var lab = makeLabel(x, -0.5, 4.3,
            { top: title, sub: "click to flip", accent: "#d9a441", box: true }, 2.26, 1.13);
          return { lever: lever, hit: hit, label: lab, title: title };
        }
        var swWage = makeSwitch(-2.6, "WHO IS BUYING");
        var swDrug = makeSwitch(2.6, "WHICH MARKET");

        // ---------- Lerner gauge ----------
        var lernerBack = new THREE.Mesh(
          keep(ctx.roundedBox(3.4, 0.34, 0.12)),
          mat({ color: 0x232a36, roughness: 0.8 }));
        lernerBack.position.set(0, -0.75, 2.9);
        scene.add(lernerBack);
        var lernerFill = new THREE.Mesh(
          keep(ctx.roundedBox(1, 0.22, 0.16)),
          mat({ color: 0xd4573f, roughness: 0.4,
                emissive: 0xd4573f, emissiveIntensity: 0.35 }));
        scene.add(lernerFill);
        var lernerLabel = makeLabel(0, -2.25, 1.2,
          { top: "LERNER INDEX OF MONOPOLY POWER", sub: "0.996 — price is almost all margin",
            accent: "#d4573f", box: true }, 3.28, 1.17);

        // ---------- state ----------
        var wageKey = "unskilled", drugKey = "patented";
        var won = false;
        // The generic in this room is Natco's, and Natco only exists because a
        // compulsory licence was granted at the bench. Deny that licence and
        // there is nothing to switch to: the consequence follows the player here.
        var genericExists = true, licenceRuled = false;
        if (typeof window.GameInherit === "function") {
          try {
            var h = window.GameInherit();
            genericExists = h.genericExists;
            licenceRuled = h.licenceRuled;
          } catch (e) {}
        }

        function pushToPage() {
          var ms = document.getElementById("select-market-state");
          var wp = document.getElementById("select-wage-profile");
          if (ms) { ms.value = drugKey; ms.dispatchEvent(new Event("change", { bubbles: true })); }
          if (wp) { wp.value = wageKey; wp.dispatchEvent(new Event("change", { bubbles: true })); }
        }

        function refresh() {
          var d = A.drugs[drugKey], w = A.wages[wageKey];
          var days = Math.round(d.price / w.daily);
          var lerner = (d.price - A.marginalCost) / d.price;
          var ok = days <= A.target;

          wageLabel.material.map = labelTex(
            { top: w.name, big: "$" + w.daily.toFixed(2), sub: w.sub,
              accent: "#9aa6b4", box: true, bigSize: 74 });
          wageLabel.material.needsUpdate = true;

          drugLabel.material.map = labelTex(
            { top: d.name, big: "$" + d.price.toLocaleString("en-US"),
              sub: d.sub + ", one month", accent: "#" + d.color.toString(16).padStart(6, "0"),
              box: true, bigSize: 70 });
          drugLabel.material.needsUpdate = true;
          bottle.material.color.set(d.color);
          bottle.material.emissive.set(d.color);

          var needed = Math.min(A.block.cap, Math.max(1, Math.ceil(days / A.block.perBlock)));
          for (var i = 0; i < blocks.length; i++) {
            blocks[i].visible = i < needed;
            blocks[i].material = ok ? blockOk : blockHot;
          }
          daysLabel.material.map = labelTex(
            { top: "DAYS OF LABOUR FOR ONE MONTH", big: days.toLocaleString("en-US"),
              sub: days > A.block.cap * A.block.perBlock
                    ? "each block is 10 days · tower clipped"
                    : "each block is 10 days",
              accent: ok ? "#3fae6b" : "#d4573f", box: true, bigSize: 78 });
          daysLabel.material.needsUpdate = true;

          var lw = Math.max(0.06, lerner * 3.2);
          lernerFill.scale.x = lw;
          lernerFill.position.set(-1.6 + lw / 2, -0.75, 2.96);
          lernerFill.material.color.set(d.color);
          lernerFill.material.emissive.set(d.color);
          lernerLabel.material.map = labelTex(
            { top: "LERNER INDEX OF MONOPOLY POWER",
              sub: lerner.toFixed(3) + (drugKey === "patented"
                    ? " — price is almost all margin"
                    : " — still a margin, but constrained"),
              accent: "#" + d.color.toString(16).padStart(6, "0"), box: true });
          lernerLabel.material.needsUpdate = true;

          swWage.label.material.map = labelTex(
            { top: "WHO IS BUYING", sub: w.name.toLowerCase() + " · click to flip",
              accent: "#d9a441", box: true });
          swWage.label.material.needsUpdate = true;
          swDrug.label.material.map = labelTex(
            { top: "WHICH MARKET", sub: d.name.toLowerCase() + " · click to flip",
              accent: "#d9a441", box: true });
          swDrug.label.material.needsUpdate = true;

          if (!won) {
            if (ok) {
              won = true;
              ctx.setStatus("Within reach: " + days + " days of labour", true);
              ctx.setHint("Same molecule, same worker. The licence is what put it in reach.");
              ctx.setAction("Leave the wage floor", null);
              ctx.complete();
            } else {
              ctx.setStatus(days.toLocaleString("en-US") + " days of labour — target is " +
                            A.target + " or fewer", false);
            }
          }
        }

        ctx.setBrief(null);
        pushToPage();
        refresh();

        if (!genericExists) {
          // the switch is welded shut; say so, and give them a way out that is
          // honest about what they chose rather than a fake win
          swDrug.lever.material.color.set(0x5b6270);
          swDrug.lever.material.emissive.set(0x000000);
          swDrug.label.material.map = labelTex(
            { top: "WHICH MARKET", sub: "WELDED SHUT · no generic exists",
              accent: "#d4573f", box: true });
          swDrug.label.material.needsUpdate = true;
          ctx.setHint("You upheld Bayer's patent, so Natco's generic was never made. There is nothing to switch to.");
          ctx.setStatus("No generic exists — the tower cannot come down", false);
          ctx.setAction("I have seen enough", function () {
            if (typeof window.GameComplete === "function") {
              window.GameComplete(6, 0, 4,
                "With the licence denied, the only price on offer stayed out of reach of the people who needed it.");
            }
            ctx.finish();
          });
        } else {
          ctx.setHint("Flip the two switches. Watch the tower of working days.");
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
            // switches lean to show their state, and beckon while untouched
            var wantW = wageKey === "unskilled" ? -0.42 : 0.42;
            var wantD = drugKey === "patented" ? -0.42 : 0.42;
            swWage.lever.rotation.z += (wantW - swWage.lever.rotation.z) * Math.min(1, dt * 8);
            swDrug.lever.rotation.z += (wantD - swDrug.lever.rotation.z) * Math.min(1, dt * 8);
            var beck = (!won) ? 1 + Math.sin(pulse * 3.6) * 0.06 : 1;
            swDrug.lever.scale.setScalar(
              swDrug.lever.scale.x + (beck - swDrug.lever.scale.x) * Math.min(1, dt * 8));
          },
          onPointerDown: function (h) {
            if (!h) return;
            if (h.object === swWage.hit) {
              wageKey = wageKey === "unskilled" ? "salaried" : "unskilled";
              pushToPage(); refresh();
            } else if (h.object === swDrug.hit) {
              if (!genericExists) {
                ctx.setHint("Welded shut. The licence you denied is why this market has no generic.");
                return;
              }
              drugKey = drugKey === "patented" ? "generic" : "patented";
              pushToPage(); refresh();
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

    window.launchWage = function () { window.Interludes.play("wage"); };
  });
})();
